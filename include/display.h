#pragma once

#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include "config.h"

#define OLED_WIDTH   128
#define OLED_HEIGHT  32
#define OLED_ADDR    0x3C
#define OLED_RESET   -1

static Adafruit_SSD1306 oled(OLED_WIDTH, OLED_HEIGHT, &Wire, OLED_RESET);

bool display_init() {
    if (!oled.begin(SSD1306_SWITCHCAPVCC, OLED_ADDR)) {
        DBG("[display] SSD1306 init failed");
        return false;
    }
    oled.clearDisplay();
    oled.display();
    DBG("[display] ok");
    return true;
}

void display_show_message(const char* msg) {
    oled.clearDisplay();
    oled.setTextColor(SSD1306_WHITE);
    oled.setTextSize(1);

    int16_t  x1, y1;
    uint16_t w, h;
    oled.getTextBounds(msg, 0, 0, &x1, &y1, &w, &h);
    oled.setCursor((OLED_WIDTH - w) / 2, (OLED_HEIGHT - h) / 2);
    oled.print(msg);

    oled.display();
}

void display_show_co2(uint16_t co2) {
    char buf[12];
    snprintf(buf, sizeof(buf), "%u ppm", co2);

    oled.clearDisplay();
    oled.setTextColor(SSD1306_WHITE);
    oled.setTextSize(2);

    // Centre the text on the 128x32 canvas.
    int16_t  x1, y1;
    uint16_t w, h;
    oled.getTextBounds(buf, 0, 0, &x1, &y1, &w, &h);
    oled.setCursor((OLED_WIDTH - w) / 2, (OLED_HEIGHT - h) / 2);
    oled.print(buf);

    oled.display();
}
