/*
 * sensor.h — Cognitiv Firmware v2
 *
 * Owns everything SCD41-related: I2C power gating, driver init,
 * single-shot measurement, range validation, and battery voltage reading.
 *
 * Call order:
 *   sensor_power_on()  →  sensor_init()  →  sensor_read()  →  sensor_power_off()
 *
 * sensor_power_off() must be called regardless of success/failure.
 */

#pragma once

#include <Wire.h>
#include <SensirionI2CScd4x.h>
#include "config.h"

static SensirionI2CScd4x scd4x;

// Power on the I2C rail and wait for the SCD41 to boot.
// The AO3401A P-channel gate (GPIO6) is driven LOW to energise 3V3_I2C.
// SCD41 datasheet requires ≥1 s before the first I2C command.
void sensor_power_on() {
    pinMode(PIN_I2C_POWER, OUTPUT);
    digitalWrite(PIN_I2C_POWER, I2C_RAIL_ON);   // LOW = rail ON
    delay(SENSOR_STABILIZE_MS);
    DBG("[sensor] I2C rail ON");
}

// Power off the I2C rail. Always call this — even on error paths.
void sensor_power_off() {
    digitalWrite(PIN_I2C_POWER, I2C_RAIL_OFF);  // HIGH = rail OFF
    DBG("[sensor] I2C rail OFF");
}

// Initialise the I2C bus and SCD41 driver.
// Must be called after sensor_power_on().
// Stops any leftover periodic measurement (safe no-op if sensor was off).
bool sensor_init() {
    Wire.begin(PIN_SDA, PIN_SCL);
    scd4x.begin(Wire);

    // If a previous firmware cycle left the sensor in periodic mode, stop it.
    // The error code here is non-fatal (sensor may not have been in that mode).
    uint16_t err = scd4x.stopPeriodicMeasurement();
    if (err) {
        DBG_FMT("[sensor] stopPeriodicMeasurement: err=%u (non-fatal)\n", err);
    }
    return true;
}

// Trigger a single-shot measurement and block until data is ready.
// Polls getDataReadyFlag() every SENSOR_POLL_MS up to SENSOR_TIMEOUT_MS.
// Populates co2 (ppm), temp (°C), humidity (%RH).
// Returns true on success, false on timeout or out-of-range values.
bool sensor_read(uint16_t* co2, float* temp, float* humidity) {
    uint16_t err = scd4x.measureSingleShot();
    if (err) {
        DBG_FMT("[sensor] measureSingleShot error: %u\n", err);
        return false;
    }

    // SCD41 single-shot takes ~5 seconds — poll until ready
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
        DBG("[sensor] timeout waiting for data");
        return false;
    }

    err = scd4x.readMeasurement(*co2, *temp, *humidity);
    if (err) {
        DBG_FMT("[sensor] readMeasurement error: %u\n", err);
        return false;
    }

    // Sanity-check: SCD41 errors can manifest as 0 or 65535
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
}

// Read battery voltage in millivolts.
// analogReadMilliVolts() uses factory ADC calibration (±5% accuracy).
// Multiply by VOLTAGE_DIVIDER_RATIO (2.0) to recover actual battery voltage.
uint32_t battery_read_mv() {
    uint32_t adc_mv   = analogReadMilliVolts(PIN_BATT_ADC);
    uint32_t vbatt_mv = (uint32_t)(adc_mv * VOLTAGE_DIVIDER_RATIO);
    DBG_FMT("[batt] adc=%u mV  vbatt=%u mV\n", adc_mv, vbatt_mv);
    return vbatt_mv;
}
