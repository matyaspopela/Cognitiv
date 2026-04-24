/*
 * led.h — Cognitiv Firmware v2
 *
 * Owns the SK6812 addressable RGB LED: power gating via GPIO7 (P-channel
 * AO3401A, LOW = ON) and CO2-based colour display.
 *
 * Hardware note: R5 (470Ω) sits in series on the LEDDATAESP net between
 * GPIO10 and the SK6812 data pin — confirmed from netlist. No firmware
 * change needed; the resistor is transparent to the NeoPixel protocol.
 *
 * Call order:
 *   led_power_on()  →  led_show_co2(co2)  →  [keep on as long as needed]  →  led_power_off()
 */

#pragma once

#include <Adafruit_NeoPixel.h>
#include "config.h"

// Single SK6812 on GPIO10. NEO_GRB matches the SK6812 RGB channel order.
// The Adafruit NeoPixel library uses the ESP32-C3 RMT peripheral for
// hardware-accurate 800 kHz timing — no bit-banging required.
static Adafruit_NeoPixel led_strip(1, PIN_LED_DATA, NEO_GRB + NEO_KHZ800);

// Power on the LED rail and initialise the NeoPixel driver.
// Pixel starts off (clear) until led_show_co2() is called.
void led_power_on() {
    pinMode(PIN_LED_POWER, OUTPUT);
    digitalWrite(PIN_LED_POWER, LED_RAIL_ON);   // LOW = P-ch gate ON
    delay(LED_POWER_SETTLE_MS);                 // let gate + caps settle

    led_strip.begin();
    led_strip.setBrightness(LED_BRIGHTNESS);
    led_strip.clear();
    led_strip.show();
    DBG("[led] rail ON");
}

// Clear the pixel and cut power to the LED rail.
void led_power_off() {
    led_strip.clear();
    led_strip.show();
    digitalWrite(PIN_LED_POWER, LED_RAIL_OFF);  // HIGH = P-ch gate OFF
    DBG("[led] rail OFF");
}

// Set the LED colour based on CO2 ppm using thresholds from config.h:
//   green  (0, 255, 0)    — co2 < CO2_LEVEL_GOOD_PPM (800 ppm)
//   amber  (255, 200, 0)  — CO2_LEVEL_GOOD_PPM <= co2 < CO2_LEVEL_WARN_PPM (1200 ppm)
//   red    (255, 0, 0)    — co2 >= CO2_LEVEL_WARN_PPM
void led_show_co2(uint16_t co2) {
    uint32_t colour;

    if (co2 < CO2_LEVEL_GOOD_PPM) {
        colour = led_strip.Color(0, 255, 0);      // green — good air quality
        DBG_FMT("[led] green  (co2=%u ppm, < %u)\n", co2, CO2_LEVEL_GOOD_PPM);
    } else if (co2 < CO2_LEVEL_WARN_PPM) {
        colour = led_strip.Color(255, 200, 0);    // amber — moderate
        DBG_FMT("[led] amber  (co2=%u ppm, %u–%u)\n",
                co2, CO2_LEVEL_GOOD_PPM, CO2_LEVEL_WARN_PPM);
    } else {
        colour = led_strip.Color(255, 0, 0);      // red   — poor air quality
        DBG_FMT("[led] red    (co2=%u ppm, >= %u)\n", co2, CO2_LEVEL_WARN_PPM);
    }

    led_strip.setPixelColor(0, colour);
    led_strip.show();
}
