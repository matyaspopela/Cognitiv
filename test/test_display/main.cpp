#include <Arduino.h>
#include <Wire.h>
#include "display.h"

void setup() {
    Serial.begin(115200);
    delay(100);

    pinMode(PIN_I2C_POWER, OUTPUT);
    digitalWrite(PIN_I2C_POWER, I2C_RAIL_ON);
    delay(200);

    // R3/R4 are DNP — rely on ESP32 internal pull-ups.
    pinMode(PIN_SDA, INPUT_PULLUP);
    pinMode(PIN_SCL, INPUT_PULLUP);
    Wire.begin(PIN_SDA, PIN_SCL);
    Wire.setTimeout(20);

    if (!display_init()) {
        DBG("[test] display init failed — check wiring");
    }
}

void loop() {
    static uint16_t n = 0;
    display_show_co2(n);
    DBG_FMT("[display] %u\n", n);
    n++;
    delay(500);
}
