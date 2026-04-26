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

  led_enabled = !led_enabled;
  DBG_FMT("[button] LED %s\n", led_enabled ? "on" : "off (quiet mode)");
  buzzer_play_tune();
  if (!led_enabled)
    led_power_off();

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
  scd4x.begin(Wire);
  uint16_t err = scd4x.stopPeriodicMeasurement();
  if (err)
    DBG_FMT("[sensor] stopPeriodicMeasurement err=%u (ok if idle)\n", err);
  delay(600);
  i2c_reset();

  err = scd4x.measureSingleShot();
  sensor_ok = (err == 0);
  if (sensor_ok)
    DBG("[sensor] SCD41 ok — waiting for first reading (~5 s)");
  else
    DBG_FMT("[sensor] SCD41 unreachable — err=%u\n", err);

  // ── Display ───────────────────────────────────────────────────────────────
  display_ok = display_init();
  if (display_ok)
    display_show_message("Cognitiv");

  // ── LED ───────────────────────────────────────────────────────────────────
  pinMode(PIN_LED_POWER, OUTPUT);
  digitalWrite(PIN_LED_POWER, LED_RAIL_OFF);
  led_init();
  DBG("[led] ok");

  // ── Button ────────────────────────────────────────────────────────────────
  pinMode(PIN_BUTTON, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(PIN_BUTTON), btn_isr, FALLING);
  DBG("[button] interrupt attached");

  DBG("=== boot complete ===");
}

void loop() {
  handle_button();

  if (!sensor_ok) {
    DBG("[sensor] not available — skipping");
    delay(2000);
    return;
  }

  uint16_t co2 = 0;
  float temp = 0.0f;
  float hum = 0.0f;

  if (!sensor_read(&co2, &temp, &hum)) {
    DBG("[sensor] read failed");
    if (display_ok)
      display_show_message("Cognitiv");
    return;
  }

  DBG_FMT("[sensor] co2=%u ppm  temp=%.1f C  hum=%.1f%%\n", co2, temp, hum);

  // Check button again — a press during the ~5 s blocking sensor read is caught
  // here.
  handle_button();

  if (display_ok)
    display_show_co2(co2);

  if (led_enabled) {
    led_power_on();
    led_show_co2(co2);
  } else {
    led_power_off();
  }

  uint32_t vbatt_mv = battery_read_mv();

  if (wifi_connect()) {
    ntp_sync();
    mqtt_publish(temp, hum, co2, vbatt_mv);
    wifi_disconnect();
  } else {
    DBG("[wifi] no connection — skipping MQTT");
  }
}
