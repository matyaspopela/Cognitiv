#pragma once

#include <Wire.h>
#include <SensirionI2CScd4x.h>
#include "config.h"

static SensirionI2CScd4x scd4x;

void sensor_power_on() {
    pinMode(PIN_I2C_POWER, OUTPUT);
    digitalWrite(PIN_I2C_POWER, I2C_RAIL_ON);
    delay(SENSOR_STABILIZE_MS);  // SCD41 requires ≥1 s before first I2C command
}

bool sensor_init() {
    Wire.begin(PIN_SDA, PIN_SCL);
    scd4x.begin(Wire);

    // Sensor may be in periodic mode from a previous run — stop it before
    // restarting. Error here is non-fatal.
    scd4x.stopPeriodicMeasurement();
    delay(500);  // datasheet §3.8: 500 ms required between stop and next command

    uint16_t err = scd4x.startPeriodicMeasurement();
    if (err) {
        DBG_FMT("[sensor] start error: %u\n", err);
        return false;
    }
    DBG("[sensor] periodic mode started");
    return true;
}

// Returns true when the SCD41 has a fresh sample buffered and ready to read.
bool sensor_is_ready() {
    bool ready = false;
    uint16_t err = scd4x.getDataReadyFlag(ready);
    if (err) {
        DBG_FMT("[sensor] ready flag error: %u\n", err);
        return false;
    }
    return ready;
}

// Must only be called after sensor_is_ready() returns true.
// SCD41 will NACK a read when no sample is buffered.
bool sensor_read(uint16_t* co2, float* temp, float* humidity) {
    uint16_t err = scd4x.readMeasurement(*co2, *temp, *humidity);
    if (err) {
        DBG_FMT("[sensor] read error: %u\n", err);
        return false;
    }

    // SCD41 faults can surface as 0 or 65535 rather than an error code.
    bool valid = (*co2      >= CO2_MIN_PPM  && *co2      <= CO2_MAX_PPM)  &&
                 (*temp     >= TEMP_MIN_C   && *temp     <= TEMP_MAX_C)   &&
                 (*humidity >= HUM_MIN_PCT  && *humidity <= HUM_MAX_PCT);

    if (!valid) {
        DBG_FMT("[sensor] out-of-range: co2=%u temp=%.1f hum=%.1f\n",
                *co2, *temp, *humidity);
        return false;
    }

    DBG_FMT("[sensor] co2=%u ppm  temp=%.1f C  hum=%.1f%%\n",
            *co2, *temp, *humidity);
    return true;
}

uint32_t battery_read_mv() {
    uint32_t adc_mv   = analogReadMilliVolts(PIN_BATT_ADC);
    uint32_t vbatt_mv = (uint32_t)(adc_mv * VOLTAGE_DIVIDER_RATIO);
    DBG_FMT("[batt] adc=%u mV  vbatt=%u mV\n", adc_mv, vbatt_mv);
    return vbatt_mv;
}
