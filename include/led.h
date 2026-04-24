#pragma once

#include <Adafruit_NeoPixel.h>
#include "config.h"

// NEO_GRB matches the SK6812 channel order.
static Adafruit_NeoPixel led_strip(1, PIN_LED_DATA, NEO_GRB + NEO_KHZ800);

void led_power_on() {
    pinMode(PIN_LED_POWER, OUTPUT);
    digitalWrite(PIN_LED_POWER, LED_RAIL_ON);
    delay(LED_POWER_SETTLE_MS);  // let P-ch gate and decoupling caps settle

    led_strip.begin();
    led_strip.setBrightness(LED_BRIGHTNESS);
    led_strip.clear();
    led_strip.show();
}

void led_power_off() {
    led_strip.clear();
    led_strip.show();
    digitalWrite(PIN_LED_POWER, LED_RAIL_OFF);
}

void led_show_co2(uint16_t co2) {
    uint32_t colour;

    if (co2 < CO2_LEVEL_GOOD_PPM) {
        colour = led_strip.Color(0, 255, 0);    // green
    } else if (co2 < CO2_LEVEL_WARN_PPM) {
        colour = led_strip.Color(255, 200, 0);  // amber
    } else {
        colour = led_strip.Color(255, 0, 0);    // red
    }

    DBG_FMT("[led] co2=%u ppm\n", co2);
    led_strip.setPixelColor(0, colour);
    led_strip.show();
}
