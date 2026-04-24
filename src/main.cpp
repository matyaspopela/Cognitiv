#include <Arduino.h>
#include "config.h"
#include "sensor.h"
#include "led.h"
#include "network.h"

// Survives deep sleep; reset only on a full power-on (battery removed).
RTC_DATA_ATTR bool led_enabled = true; //toggled via btn?

void setup() {
    Serial.begin(115200);
    delay(100);

    // Drive both P-channel gates HIGH immediately — GPIO state is undefined after reset.
    pinMode(PIN_I2C_POWER, OUTPUT);
    digitalWrite(PIN_I2C_POWER, I2C_RAIL_OFF);
    pinMode(PIN_LED_POWER, OUTPUT);
    digitalWrite(PIN_LED_POWER, LED_RAIL_OFF);
}

void loop() {
    DBG("\n[boot] wake");

    // Confirm press with a second read to debounce (no debounce cap on board).
    pinMode(PIN_BUTTON, INPUT);
    delay(10);
    if (digitalRead(PIN_BUTTON) == LOW) {
        delay(50);
        if (digitalRead(PIN_BUTTON) == LOW) {
            led_enabled = !led_enabled;
            DBG_FMT("[button] LED %s\n", led_enabled ? "ON" : "OFF"); // jen oneliner na simple bool expression
        }
    }
    //cteni voltage - potreba zkalibrovat, pravdepodobne bude psat bullshid (v milivoltech)
    uint32_t vbatt_mv = battery_read_mv();
    if (vbatt_mv < MIN_BATTERY_MV) {
        DBG_FMT("[batt] critical (%u mV)\n", vbatt_mv);
        //TODO: spadne do do deepsleepu kdyz bude moc mala voltage
    }

    sensor_power_on();
    sensor_init();

    uint16_t co2      = 0;
    float    temp     = 0.0f;
    float    humidity = 0.0f;
    bool sensor_ok = sensor_read(&co2, &temp, &humidity); // pass by refference vsechny hodnoty predtim

    sensor_power_off();  //po readu uz neni duvod mit powerupnuty

    if (!sensor_ok) {
        DBG("[sensor] read failed");
        esp_sleep_enable_timer_wakeup(SLEEP_INTERVAL_US);
        esp_deep_sleep_start(); //deepsleep abysme nezkouseli opakovane nonstop reads kdyz bude spadly xyz
    }

    //ledka behem awake window (5-15s)
    if (led_enabled) {
        led_power_on();
        led_show_co2(co2); //rozsviti barvu na ledce based on CO2 ppm
    }

    if (!wifi_connect()) {
        if (led_enabled) led_power_off();
        esp_sleep_enable_timer_wakeup(SLEEP_INTERVAL_US);
        esp_deep_sleep_start(); //musi to jit spat. Kdyby spadla wifi na 2 h a pak se zase zapla tak bez ds bude 50% baterky v prdeli
    }

    mqtt_publish(temp, humidity, co2, vbatt_mv); //publishne na MQTT brokera (pouzivam HiveMQ).
    //NOTE: tohle se da vypnout, jestli te zajima jen jestli facha hardware, vykomentuj vsechno od L63-L74

    wifi_disconnect();
    if (led_enabled) led_power_off();

    esp_sleep_enable_timer_wakeup(SLEEP_INTERVAL_US);
    esp_deep_sleep_start();
}
