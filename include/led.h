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
    led_strip.setBrightness(LED_BRIGHTNESS); //max brightness jestli to mam dobre
    led_strip.clear(); //cisticka
    led_strip.show(); //zapne (0,0,0) -> tzn zhasne
}

void led_power_off() {
    led_strip.clear(); //cisticka
    led_strip.show(); //rosviti (0,0,0)
    digitalWrite(PIN_LED_POWER, LED_RAIL_OFF); //vypne power
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
    led_strip.setPixelColor(0, colour); //prvni parametr rika kolikaka ledka (mame jen nultou)
    led_strip.show(); //kaboom shaboom
}
