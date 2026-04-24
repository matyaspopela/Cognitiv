/*
 * main.cpp — Cognitiv Firmware v2
 *
 * Boot-to-sleep cycle for the ESP32-C3-WROOM-02 air quality sensor node.
 * The entire firmware runs inside setup(). loop() is unreachable by design —
 * every execution path ends with esp_deep_sleep_start(), which resets the chip.
 *
 * Execution order:
 *   1. Serial init
 *   2. Power gate defaults (I2C + LED rails both OFF at startup)
 *   3. Button check — toggles LED on/off persistently via RTC memory
 *   4. Battery check — emergency sleep if critically low
 *   5. Sensor read (SCD41 single-shot: CO2, temperature, humidity)
 *   6. LED on (if enabled) — colour reflects CO2 level
 *   7. WiFi connect
 *   8. MQTT publish
 *   9. WiFi disconnect + LED off
 *  10. Deep sleep (5 minutes)
 */

#include <Arduino.h>
#include "config.h"
#include "sensor.h"
#include "led.h"
#include "network.h"

// ── Persistent LED state ───────────────────────────────────────────────────────
// RTC_DATA_ATTR survives deep sleep resets.
// Resets to true only on a full power-on reset (battery removed / first boot).
RTC_DATA_ATTR bool led_enabled = true;

// ── loop() — intentionally empty ─────────────────────────────────────────────
void loop() {}

// ── setup() — the complete firmware lifecycle ──────────────────────────────────
void setup() {
    Serial.begin(115200);
    delay(100);  // give Serial time to initialise before the first log line
    DBG("\n[boot] Cognitiv v2 — wake");

    // ── Power gate defaults ────────────────────────────────────────────────────
    // Drive both P-channel gates HIGH (OFF) immediately so the rails are in a
    // known state regardless of what the GPIO defaulted to after reset.
    pinMode(PIN_I2C_POWER, OUTPUT);
    digitalWrite(PIN_I2C_POWER, I2C_RAIL_OFF);

    pinMode(PIN_LED_POWER, OUTPUT);
    digitalWrite(PIN_LED_POWER, LED_RAIL_OFF);

    // ── 1. Button check — LED toggle ───────────────────────────────────────────
    // R11 (10 kΩ) is a hardware pull-up on INPUTSW1 — use INPUT, not INPUT_PULLUP.
    // Button is active-low: pressed = GPIO3 pulled to GND.
    // No hardware debounce cap; we confirm with a second read after 50 ms.
    // Measurement and publishing are completely unaffected by this check.
    pinMode(PIN_BUTTON, INPUT);
    delay(10);  // let GPIO settle before reading
    if (digitalRead(PIN_BUTTON) == LOW) {
        delay(50);                              // wait out contact bounce
        if (digitalRead(PIN_BUTTON) == LOW) {  // confirmed press
            led_enabled = !led_enabled;
            DBG_FMT("[button] LED toggled → %s\n", led_enabled ? "ON" : "OFF");
        }
    }

    // ── 2. Battery check ───────────────────────────────────────────────────────
    uint32_t vbatt_mv = battery_read_mv();
    if (vbatt_mv < MIN_BATTERY_MV) {
        DBG_FMT("[boot] battery critical (%u mV) — emergency sleep\n", vbatt_mv);
        esp_sleep_enable_timer_wakeup(SLEEP_INTERVAL_US);
        esp_deep_sleep_start();
        // unreachable — chip resets
    }
    DBG_FMT("[boot] battery OK: %u mV\n", vbatt_mv);

    // ── 3. Sensor read ─────────────────────────────────────────────────────────
    sensor_power_on();   // GPIO6 LOW + 1 s stabilisation
    sensor_init();       // Wire.begin(4, 5) + SCD41 driver init

    uint16_t co2      = 0;
    float    temp     = 0.0f;
    float    humidity = 0.0f;
    bool sensor_ok = sensor_read(&co2, &temp, &humidity);

    sensor_power_off();  // GPIO6 HIGH — always, success or failure

    if (!sensor_ok) {
        DBG("[boot] sensor read failed — sleeping");
        esp_sleep_enable_timer_wakeup(SLEEP_INTERVAL_US);
        esp_deep_sleep_start();
    }

    // ── 4. LED on (conditional) ────────────────────────────────────────────────
    // The LED stays on through WiFi connect + MQTT publish (~5–15 s) so the
    // colour is visible without adding any extra delay to the cycle.
    if (led_enabled) {
        led_power_on();       // GPIO7 LOW + 5 ms settle
        led_show_co2(co2);    // green / amber / red based on ppm
    }

    // ── 5. WiFi connect ────────────────────────────────────────────────────────
    if (!wifi_connect()) {
        DBG("[boot] WiFi failed — sleeping");
        if (led_enabled) led_power_off();  // never leave LED on during sleep
        esp_sleep_enable_timer_wakeup(SLEEP_INTERVAL_US);
        esp_deep_sleep_start();
    }

    // ── 6. MQTT publish ────────────────────────────────────────────────────────
    bool published = mqtt_publish(temp, humidity, co2, vbatt_mv);
    if (!published) {
        // Non-fatal: next cycle will try again. Don't retry indefinitely here.
        DBG("[boot] MQTT publish failed — will retry next cycle");
    }

    // ── 7. Shutdown ────────────────────────────────────────────────────────────
    wifi_disconnect();
    if (led_enabled) led_power_off();   // GPIO7 HIGH — off before sleep

    DBG_FMT("[boot] sleeping for %llu s\n", SLEEP_INTERVAL_US / 1000000ULL);
    esp_sleep_enable_timer_wakeup(SLEEP_INTERVAL_US);
    esp_deep_sleep_start();
    // unreachable — chip resets on wake
}
