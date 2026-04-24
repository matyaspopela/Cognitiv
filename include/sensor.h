#pragma once

#include <Wire.h>
#include <SensirionI2CScd4x.h>
#include "config.h"

static SensirionI2CScd4x scd4x;

void sensor_power_on() {
    pinMode(PIN_I2C_POWER, OUTPUT);
    digitalWrite(PIN_I2C_POWER, I2C_RAIL_ON); //zase pres ten P mosfet (mozna nebude potreba)
    delay(SENSOR_STABILIZE_MS);  // SCD41 --> delsi startup na stabiliziaci (typicky >1s)

void sensor_power_off() {
    digitalWrite(PIN_I2C_POWER, I2C_RAIL_OFF);
}

bool sensor_init() {
    Wire.begin(PIN_SDA, PIN_SCL);
    scd4x.begin(Wire);

    //tohle je kdyby nahodou byl nastavenej v periodickym modu ten senzor - chceme single shot
    uint16_t err = scd4x.stopPeriodicMeasurement();
    if (err) {
        DBG_FMT("[sensor] stopPeriodicMeasurement: err=%u\n", err);
    }
    return true;
}

bool sensor_read(uint16_t* co2, float* temp, float* humidity) {
    uint16_t err = scd4x.measureSingleShot();
    if (err) {
        DBG_FMT("[sensor] measureSingleShot error: %u\n", err);
        return false;
    }

    //single shot -> cca 5s
    unsigned long deadline = millis() + SENSOR_TIMEOUT_MS;
    bool ready = false;
    while (millis() < deadline) {
        delay(SENSOR_POLL_MS);
        err = scd4x.getDataReadyFlag(ready);
        if (err) {
            DBG_FMT("[sensor] getDataReadyFlag error: %u\n", err);
            continue;
        }
        if (ready) break;
    }

    if (!ready) {
        DBG("[sensor] timeout");
        return false;
    }

    err = scd4x.readMeasurement(*co2, *temp, *humidity);
    if (err) {
        DBG_FMT("[sensor] readMeasurement error: %u\n", err);
        return false;
    }

    // SCD41 faulty byvaj casto cisla, ne jen boolean error state
    bool valid = (*co2      >= CO2_MIN_PPM  && *co2      <= CO2_MAX_PPM)  &&
                 (*temp     >= TEMP_MIN_C   && *temp     <= TEMP_MAX_C)   &&
                 (*humidity >= HUM_MIN_PCT  && *humidity <= HUM_MAX_PCT);

    if (!valid) {
        DBG_FMT("[sensor] out-of-range: co2=%u temp=%.1f hum=%.1f\n",
                *co2, *temp, *humidity);
        return false;
    }

    DBG_FMT("[sensor] co2=%u ppm  temp=%.1f°C  hum=%.1f%%\n",
            *co2, *temp, *humidity);
    return true;
    //mozna se ptas proc tady nedavam &reference ale *pointry, je to protoze potom ve zbytku kodu kontroluju
    //velmi lehce jestli ptr != nullptr a zaroven to enforcuje aby ve zbytku kodu do tyhle funkce byla passovana reference, ne primo var.
}

uint32_t battery_read_mv() {
    // analogReadMilliVolts uses factory ADC calibration - vic presny ze zacatku, pak vymenit.
    // sam nevim co je lepsi, v tomhle jsem matlak
    uint32_t adc_mv   = analogReadMilliVolts(PIN_BATT_ADC);
    uint32_t vbatt_mv = (uint32_t)(adc_mv * VOLTAGE_DIVIDER_RATIO);
    DBG_FMT("[batt] adc=%u mV  vbatt=%u mV\n", adc_mv, vbatt_mv);
    return vbatt_mv;
}
