#include <Arduino.h>
#include "config.h"
#include "sensor.h"
#include "display.h"
#include "led.h"

static bool led_enabled = true;  // plain bool — no deep sleep, no RTC needed

void setup() {
    Serial.begin(115200);
    delay(100);

    // Force both P-channel gates HIGH immediately — GPIO floats after reset.
    pinMode(PIN_I2C_POWER, OUTPUT);
    digitalWrite(PIN_I2C_POWER, I2C_RAIL_OFF);
    pinMode(PIN_LED_POWER, OUTPUT);
    digitalWrite(PIN_LED_POWER, LED_RAIL_OFF);

    pinMode(PIN_BUTTON, INPUT);  // R11 10kΩ on PCB handles the pull-up

    sensor_power_on();  // powers I2C rail (SCD41 + OLED share it via Q2)

    bool disp_ok = display_init();
    if (!disp_ok) DBG("[display] init failed — continuing without display");

    if (!sensor_init()) {
        if (disp_ok) display_show_error("SCD41 not found");
        while (true) delay(1000);  // nothing useful to do without the sensor
    }

    led_power_on();
}

void loop() {
    // R11 keeps GPIO3 HIGH when SW1 is absent (DNP). Safe to check every tick.
    if (digitalRead(PIN_BUTTON) == LOW) {
        delay(50);  // debounce
        if (digitalRead(PIN_BUTTON) == LOW) {
            led_enabled = !led_enabled;
            DBG_FMT("[button] LED %s\n", led_enabled ? "ON" : "OFF");
            led_enabled ? led_power_on() : led_power_off();
        }
    }

    if (sensor_is_ready()) {
        uint16_t co2      = 0;
        float    temp     = 0.0f;
        float    humidity = 0.0f;

        if (sensor_read(&co2, &temp, &humidity)) {
            display_update(co2, temp, humidity);
            if (led_enabled) led_show_co2(co2);
        }
    }

    delay(LOOP_DELAY_MS);
}
