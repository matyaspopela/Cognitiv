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

static volatile bool btn_event = false;

void IRAM_ATTR btn_isr() { btn_event = true; }

static void handle_button() {
  if (!btn_event)
    return;
  btn_event = false;

  delay(BTN_DEBOUNCE_MS);
  if (digitalRead(PIN_BUTTON) != LOW)
    return;

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

  while (digitalRead(PIN_BUTTON) == LOW)
    delay(10);
}

void setup() {
  Serial.begin(115200);
  delay(100);
  DBG("=== Cognitiv boot ===");

  // ── I2C rail ──────────────────────────────────────────────────────────────
  pinMode(PIN_I2C_POWER, OUTPUT);
  digitalWrite(PIN_I2C_POWER, I2C_RAIL_ON);
  delay(200);

  // R3/R4 are DNP on PCB — rely on ESP32 internal pull-ups (~45 kΩ).
  pinMode(PIN_SDA, INPUT_PULLUP);
  pinMode(PIN_SCL, INPUT_PULLUP);
  Wire.begin(PIN_SDA, PIN_SCL);
  Wire.setClock(25000);  // 50 kHz — tolerates higher bus capacitance from DuPont wires + two modules
  Wire.setTimeout(20);
  DBG_FMT("[i2c] started SDA=%d SCL=%d\n", PIN_SDA, PIN_SCL);

  // ── I2C scan ──────────────────────────────────────────────────────────────
  uint8_t devices = 0;
  for (uint8_t addr = 1; addr < 127; addr++) {
    Wire.beginTransmission(addr);
    if (Wire.endTransmission() == 0) {
      DBG_FMT("[i2c] found 0x%02X\n", addr);
      devices++;
    }
  }
  DBG_FMT("[i2c] scan done — %u device(s)\n", devices);

  // ── Sensor ────────────────────────────────────────────────────────────────
  sensor_init();  // SCD41: stopPeriodicMeasurement; STCC4: exitSleep→enterSleep

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

  // ── Display ───────────────────────────────────────────────────────────────
  display_ok = display_init();
  if (display_ok)
    display_show_message("Cognitiv");

  // ── LED ───────────────────────────────────────────────────────────────────
  pinMode(PIN_LED_POWER, OUTPUT);
  digitalWrite(PIN_LED_POWER, LED_RAIL_OFF);
  led_init();
#ifdef SHOWCASE_MODE
  led_showcase_init();
  DBG("[led] showcase mode — green on boot");
#else
  DBG("[led] ok");
#endif

  // ── Button ────────────────────────────────────────────────────────────────
  pinMode(PIN_BUTTON, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(PIN_BUTTON), btn_isr, FALLING);
  DBG("[button] interrupt attached");

  DBG("=== boot complete ===");
}

void loop() {
  unsigned long _loop_start = millis();
  handle_button();

  if (!sensor_ok) {
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
      } else {
        DBG_FMT("[sensor] re-init failed err=%u — retrying\n", err);
      }
    }
#else
    {
      uint16_t err = scd4x.stopPeriodicMeasurement();
      if (err) DBG_FMT("[sensor] stopPeriodicMeasurement err=%u\n", err);
      delay(600);
      i2c_reset();
      // performFactoryReset() (0x3632) clears EEPROM-persisted state — more aggressive than reinit.
      err = scd4x.performFactoryReset();
      if (err) DBG_FMT("[sensor] performFactoryReset err=%u\n", err);
      delay(1200);
      err = scd4x.measureSingleShot();
      if (err == 0) {
        DBG("[sensor] re-init succeeded");
        sensor_ok = true;
      } else {
        DBG_FMT("[sensor] re-init failed err=%u — retrying in 5 s\n", err);
#ifndef SHOWCASE_MODE
        delay(5000);
#endif
      }
    }
#endif
#ifdef SHOWCASE_MODE
    if (display_ok) display_show_message("No sensor");
    {
      unsigned long elapsed  = millis() - _loop_start;
      unsigned long deadline = millis() + (elapsed < 20000UL ? 20000UL - elapsed : 0UL);
      while (millis() < deadline) { handle_button(); delay(50); }
    }
#endif
    return;
  }

  uint16_t co2 = 0;
  float temp = 0.0f;
  float hum = 0.0f;

#ifdef SHOWCASE_MODE
  if (!sensor_read(&co2, &temp, &hum, handle_button)) {
#else
  if (!sensor_read(&co2, &temp, &hum)) {
#endif
    DBG("[sensor] read failed");
    if (display_ok) display_show_message("No sensor");
#ifdef SHOWCASE_MODE
    {
      unsigned long elapsed  = millis() - _loop_start;
      unsigned long deadline = millis() + (elapsed < 20000UL ? 20000UL - elapsed : 0UL);
      while (millis() < deadline) { handle_button(); delay(50); }
    }
#endif
    return;
  }

  DBG_FMT("[sensor] co2=%u ppm  temp=%.1f C  hum=%.1f%%\n", co2, temp, hum);

  handle_button();

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

#ifndef SHOWCASE_MODE
  uint32_t vbatt_mv = battery_read_mv();

  if (wifi_connect()) {
    ntp_sync();
    mqtt_publish(temp, hum, co2, vbatt_mv);
    wifi_disconnect();
  } else {
    DBG("[wifi] no connection — skipping MQTT");
  }
#endif

  // Hold until 20 s from loop start; button is serviced every 50 ms throughout.
  {
    unsigned long elapsed  = millis() - _loop_start;
    unsigned long deadline = millis() + (elapsed < 20000UL ? 20000UL - elapsed : 0UL);
    while (millis() < deadline) { handle_button(); delay(50); }
  }
}
