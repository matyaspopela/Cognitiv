#include "buzzer.h"
#include "config.h"
#include "display.h"
#include "led.h"
#include "network.h"
#include "sensor.h"
#include <Arduino.h>


RTC_DATA_ATTR bool led_enabled = true;

static bool sensor_ok = false;
static bool display_ok = false;

// Async button handling — runs on a dedicated FreeRTOS task so presses are
// serviced even while the main loop is blocked inside WiFi/MQTT/I2C calls.
static SemaphoreHandle_t btn_sem            = nullptr;
static volatile uint32_t btn_last_isr_ms    = 0;

void IRAM_ATTR btn_isr() {
  uint32_t now = millis();
  if (now - btn_last_isr_ms < BTN_DEBOUNCE_MS) return;
  btn_last_isr_ms = now;
  BaseType_t hpw = pdFALSE;
  xSemaphoreGiveFromISR(btn_sem, &hpw);
  if (hpw) portYIELD_FROM_ISR();
}

static void btn_task(void*) {
  for (;;) {
    if (xSemaphoreTake(btn_sem, portMAX_DELAY) != pdTRUE) continue;

    buzzer_play_tune();
#ifdef SHOWCASE_MODE
    led_showcase_next();
    DBG("[button] showcase step advanced");
#else
    led_enabled = !led_enabled;
    DBG_FMT("[button] LED %s\n", led_enabled ? "on" : "off (quiet mode)");
    if (!led_enabled)
      led_power_off();
#endif
  }
}

void setup() {
  Serial.begin(115200);
  // USB-CDC on ESP32-C3 needs the host to enumerate before output is visible.
  // Wait up to 3 s, then boot regardless so the device isn't stuck without a monitor.
  { unsigned long t = millis(); while (!Serial && millis() - t < 3000) delay(10); }
  DBG("=== Cognitiv boot ===");

  // I2C rail
  pinMode(PIN_I2C_POWER, OUTPUT);
  digitalWrite(PIN_I2C_POWER, I2C_RAIL_ON);
  delay(200);

  // R3/R4 are DNP on PCB — rely on ESP32 internal pull-ups (~45 kΩ).
  pinMode(PIN_SDA, INPUT_PULLUP);
  pinMode(PIN_SCL, INPUT_PULLUP);
  Wire.begin(PIN_SDA, PIN_SCL);
  Wire.setClock(25000);  // 25 kHz — tolerates the higher bus capacitance from DuPont wires + two modules
  Wire.setTimeout(20);
  DBG_FMT("[i2c] started SDA=%d SCL=%d\n", PIN_SDA, PIN_SCL);

  // I2C scan
  uint8_t devices = 0;
  for (uint8_t addr = 1; addr < 127; addr++) {
    Wire.beginTransmission(addr);
    if (Wire.endTransmission() == 0) {
      DBG_FMT("[i2c] found 0x%02X\n", addr);
      devices++;
    }
  }
  DBG_FMT("[i2c] scan done — %u device(s)\n", devices);

  // sensor — SCD41: stopPeriodicMeasurement; STCC4: exitSleep→enterSleep
  sensor_init();

#ifdef SENSOR_STCC4
  {
    uint16_t err = stcc4.exitSleepMode();
    if (err == 0) err = stcc4.measureSingleShot();
    stcc4.enterSleepMode();
    sensor_ok = (err == 0);
    if (sensor_ok)
      DBG("[sensor] STCC4 ok");
    else
      DBG_FMT("[sensor] STCC4 unreachable — err=%u\n", err);
  }
#else
  {
    uint16_t err = scd4x.measureSingleShot();
    sensor_ok = (err == 0);
    if (sensor_ok)
      DBG("[sensor] SCD41 ok — waiting for first reading (~5 s)");
    else
      DBG_FMT("[sensor] SCD41 unreachable — err=%u\n", err);
  }
#endif

  // display
  display_ok = display_init();
  if (display_ok)
    display_show_message("Cognitiv");

  // LED
  pinMode(PIN_LED_POWER, OUTPUT);
  digitalWrite(PIN_LED_POWER, LED_RAIL_OFF);
  led_init();
#ifdef SHOWCASE_MODE
  led_showcase_init();
  DBG("[led] showcase mode — green on boot");
#else
  DBG("[led] ok");
#endif

  // button — async via FreeRTOS so it can preempt the main loop
  pinMode(PIN_BUTTON, INPUT_PULLUP);
  btn_sem = xSemaphoreCreateCounting(10, 0);
  // priority 5 — well above Arduino loopTask (priority 1), so it preempts immediately
  xTaskCreate(btn_task, "btn_task", 4096, nullptr, 5, nullptr);
  attachInterrupt(digitalPinToInterrupt(PIN_BUTTON), btn_isr, FALLING);
  DBG("[button] async task ready");

  DBG("=== boot complete ===");
}

void loop() {
  unsigned long _loop_start = millis();

  if (!sensor_ok) {
    static uint8_t  _reinit_attempts = 0;
    static uint32_t _next_reinit_ms  = 0;

    if (millis() < _next_reinit_ms) {
      delay(50);
      return;
    }

    // I2C scan so we can see whether the sensor is on the bus at all.
    DBG("[sensor] not available — scanning I2C bus...");
    uint8_t found = 0;
    for (uint8_t addr = 1; addr < 127; addr++) {
      Wire.beginTransmission(addr);
      if (Wire.endTransmission() == 0) {
        DBG_FMT("[i2c] found 0x%02X\n", addr);
        found++;
      }
    }
    if (found == 0) DBG("[i2c] no devices found");

    // Attempt re-init so we recover without a reflash.
    i2c_reset();
#ifdef SENSOR_STCC4
    stcc4.begin(Wire, STCC4_I2C_ADDR_64);
    {
      uint16_t err = stcc4.exitSleepMode();
      if (err == 0) err = stcc4.measureSingleShot();
      stcc4.enterSleepMode();
      if (err == 0) {
        DBG("[sensor] re-init succeeded");
        sensor_ok = true;
        _reinit_attempts = 0;
      } else {
        _reinit_attempts++;
        uint32_t wait = (_reinit_attempts >= 3) ? 30000 : 5000;
        DBG_FMT("[sensor] re-init failed err=%u — retry in %u s\n", err, wait / 1000);
        _next_reinit_ms = millis() + wait;
      }
    }
#else
    {
      uint16_t err = scd4x.stopPeriodicMeasurement();
      if (err) DBG_FMT("[sensor] stopPeriodicMeasurement err=%u\n", err);
      delay(600);
      i2c_reset();
      err = scd4x.measureSingleShot();
      if (err == 0) {
        DBG("[sensor] re-init succeeded");
        sensor_ok = true;
        _reinit_attempts = 0;
      } else {
        _reinit_attempts++;
        uint32_t wait = (_reinit_attempts >= 3) ? 30000 : 5000;
        DBG_FMT("[sensor] re-init failed err=%u — retry in %u s\n", err, wait / 1000);
        _next_reinit_ms = millis() + wait;
      }
    }
#endif
#ifdef SHOWCASE_MODE
    if (display_ok) display_show_message("No sensor");
    {
      unsigned long elapsed  = millis() - _loop_start;
      unsigned long deadline = millis() + (elapsed < LOOP_PERIOD_MS ? LOOP_PERIOD_MS - elapsed : 0UL);
      while (millis() < deadline) delay(50);
    }
#endif
    return;
  }

  uint16_t co2 = 0;
  float temp = 0.0f;
  float hum = 0.0f;

  if (!sensor_read(&co2, &temp, &hum)) {
    DBG("[sensor] read failed");
    if (display_ok) display_show_message("No sensor");
#ifdef SHOWCASE_MODE
    {
      unsigned long elapsed  = millis() - _loop_start;
      unsigned long deadline = millis() + (elapsed < LOOP_PERIOD_MS ? LOOP_PERIOD_MS - elapsed : 0UL);
      while (millis() < deadline) delay(50);
    }
#endif
    return;
  }

  DBG_FMT("[sensor] co2=%u ppm  temp=%.1f C  hum=%.1f%%\n", co2, temp, hum);

  if (display_ok)
    display_show_co2(co2);

#ifndef SHOWCASE_MODE
  if (led_enabled) {
    led_power_on();
    led_show_co2(co2);
  } else {
    led_power_off();
  }
#endif

#if !defined(SHOWCASE_MODE) && !defined(STC_NO_DATA)
  uint32_t vbatt_mv = battery_read_mv();

  if (wifi_connect()) {
    ntp_sync();
    mqtt_publish(temp, hum, co2, vbatt_mv);
    wifi_disconnect();
  } else {
    DBG("[wifi] no connection — skipping MQTT");
  }
#endif

  // Hold until LOOP_PERIOD_MS from loop start. Button is async (FreeRTOS task), so it preempts this hold automatically.
  {
    unsigned long elapsed  = millis() - _loop_start;
    unsigned long deadline = millis() + (elapsed < LOOP_PERIOD_MS ? LOOP_PERIOD_MS - elapsed : 0UL);
    while (millis() < deadline) delay(50);
  }
}
