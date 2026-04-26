#pragma once

#include <Adafruit_NeoPixel.h>
#include "config.h"

// NEO_GRB matches the SK6812 channel order.
static Adafruit_NeoPixel led_strip(1, PIN_LED_DATA, NEO_GRB + NEO_KHZ800);

void led_init() {
    pinMode(PIN_LED_POWER, OUTPUT);
    digitalWrite(PIN_LED_POWER, LED_RAIL_OFF);
    led_strip.begin();
    led_strip.setBrightness(LED_BRIGHTNESS);
    led_strip.clear();
    led_strip.show();
}

void led_power_on() {
    digitalWrite(PIN_LED_POWER, LED_RAIL_ON);
    delay(LED_POWER_SETTLE_MS);
}

void led_power_off() {
    led_strip.clear();
    led_strip.show();
    digitalWrite(PIN_LED_POWER, LED_RAIL_OFF);
}

void led_show_co2(uint16_t co2) {
    uint32_t colour;
    if (co2 < CO2_LEVEL_GOOD_PPM)      colour = led_strip.Color(0, 255, 0);
    else if (co2 < CO2_LEVEL_WARN_PPM) colour = led_strip.Color(255, 200, 0);
    else                                colour = led_strip.Color(255, 0, 0);

    led_strip.setPixelColor(0, colour);
    led_strip.show();
    DBG_FMT("[led] co2=%u -> %s\n", co2,
            co2 < CO2_LEVEL_GOOD_PPM ? "green" :
            co2 < CO2_LEVEL_WARN_PPM ? "amber" : "red");
}
