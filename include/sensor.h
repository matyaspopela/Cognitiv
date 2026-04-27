#pragma once

#include <Wire.h>
#include "config.h"

// ─────────────────────────────────────────────────────────────────────────────
// STCC4 driver  (./flash.sh normal_stcc4  →  -D SENSOR_STCC4)
// ─────────────────────────────────────────────────────────────────────────────
#ifdef SENSOR_STCC4

#include <SensirionI2cStcc4.h>
static SensirionI2cStcc4 stcc4;

// ESP32-C3 I2C peripheral can get stuck after a failed or stretched transaction.
// Cycling Wire resets the peripheral and releases SDA/SCL so other bus devices work.
static void i2c_reset() {
    Wire.end();
    delay(5);
    Wire.begin(PIN_SDA, PIN_SCL);
    Wire.setClock(25000);
    stcc4.begin(Wire, STCC4_I2C_ADDR_64);
}

void sensor_power_on() {
    pinMode(PIN_I2C_POWER, OUTPUT);
    digitalWrite(PIN_I2C_POWER, I2C_RAIL_ON);
    delay(SENSOR_STABILIZE_MS);
}

void sensor_power_off() {
    digitalWrite(PIN_I2C_POWER, I2C_RAIL_OFF);
}

bool sensor_init() {
    Wire.begin(PIN_SDA, PIN_SCL);
    Wire.setClock(25000);
    stcc4.begin(Wire, STCC4_I2C_ADDR_64);
    // Wake then immediately sleep — clears any stale state after power-on.
    uint16_t err = stcc4.exitSleepMode();
    if (err) DBG_FMT("[sensor] exitSleepMode err=%u (ok on first boot)\n", err);
    delay(10);
    err = stcc4.enterSleepMode();
    if (err) DBG_FMT("[sensor] enterSleepMode err=%u\n", err);
    // Reset I2C peripheral so the OLED can initialise on the same bus next.
    i2c_reset();
    return true;
}

bool sensor_read(uint16_t* co2, float* temp, float* humidity, void (*yield_fn)() = nullptr) {
    // Wake the sensor — required before every command.
    uint16_t err = stcc4.exitSleepMode();
    if (err) {
        DBG_FMT("[sensor] exitSleepMode err=%u\n", err);
        i2c_reset();
        return false;
    }

    // Trigger single-shot measurement.
    err = stcc4.measureSingleShot();
    if (err) {
        DBG_FMT("[sensor] measureSingleShot err=%u\n", err);
        stcc4.enterSleepMode();
        i2c_reset();
        return false;
    }

    // Poll readMeasurement directly — STCC4 has no getDataReadyFlag.
    unsigned long deadline = millis() + SENSOR_TIMEOUT_MS;
    int16_t co2_raw = 0;
    float t = 0.0f, rh = 0.0f;
    uint16_t status = 0;
    bool ok = false;

    while (millis() < deadline) {
        delay(SENSOR_POLL_MS);
        if (yield_fn) yield_fn();
        if (stcc4.readMeasurement(co2_raw, t, rh, status) == 0) {
            ok = true;
            break;
        }
        // Non-zero means measurement not ready yet — keep polling.
    }

    // Always put sensor back to sleep to save power.
    stcc4.enterSleepMode();

    if (!ok) {
        DBG("[sensor] timeout waiting for data");
        i2c_reset();
        return false;
    }

    // co2_raw is int16_t; clamp negatives (sensor artefact in very clean air).
    *co2      = (uint16_t)(co2_raw < 0 ? 0 : co2_raw);
    *temp     = t;
    *humidity = rh;

    bool valid = (*co2      >= CO2_MIN_PPM && *co2      <= CO2_MAX_PPM) &&
                 (*temp     >= TEMP_MIN_C  && *temp     <= TEMP_MAX_C)  &&
                 (*humidity >= HUM_MIN_PCT && *humidity <= HUM_MAX_PCT);
    if (!valid) {
        DBG_FMT("[sensor] out-of-range: co2=%u temp=%.1f hum=%.1f\n", *co2, *temp, *humidity);
        i2c_reset();
        return false;
    }

    DBG_FMT("[sensor] co2=%u ppm  temp=%.1f C  hum=%.1f%%\n", *co2, *temp, *humidity);
    return true;
}

uint32_t battery_read_mv() {
    uint32_t adc_mv   = analogReadMilliVolts(PIN_BATT_ADC);
    uint32_t vbatt_mv = (uint32_t)(adc_mv * VOLTAGE_DIVIDER_RATIO);
    DBG_FMT("[batt] adc=%u mV  vbatt=%u mV\n", adc_mv, vbatt_mv);
    return vbatt_mv;
}

// ─────────────────────────────────────────────────────────────────────────────
// SCD41 driver  (default — normal / showcase modes)
// ─────────────────────────────────────────────────────────────────────────────
#else

#include <SensirionI2CScd4x.h>
static SensirionI2CScd4x scd4x;

// ESP32-C3 I2C peripheral can get stuck after a failed or stretched transaction.
// Cycling Wire resets the peripheral and releases SDA/SCL so other bus devices work.
static void i2c_reset() {
    Wire.end();
    delay(5);
    Wire.begin(PIN_SDA, PIN_SCL);
    Wire.setClock(25000);
    scd4x.begin(Wire);
}

void sensor_power_on() {
    pinMode(PIN_I2C_POWER, OUTPUT);
    digitalWrite(PIN_I2C_POWER, I2C_RAIL_ON);
    delay(SENSOR_STABILIZE_MS);
}

void sensor_power_off() {
    digitalWrite(PIN_I2C_POWER, I2C_RAIL_OFF);
}

bool sensor_init() {
    Wire.begin(PIN_SDA, PIN_SCL);
    scd4x.begin(Wire);

    // Stop periodic mode in case the sensor was left in it from a prior run.
    // Datasheet requires ≥500 ms idle time before the next command after stop.
    uint16_t err = scd4x.stopPeriodicMeasurement();
    if (err) DBG_FMT("[sensor] stopPeriodicMeasurement err=%u\n", err);
    delay(600);

    // Reset the I2C peripheral after SCD41 init so the OLED can be initialised next.
    i2c_reset();
    return true;
}

bool sensor_read(uint16_t* co2, float* temp, float* humidity, void (*yield_fn)() = nullptr) {
    uint16_t err = scd4x.measureSingleShot();
    if (err) {
        DBG_FMT("[sensor] measureSingleShot err=%u\n", err);
        i2c_reset();
        return false;
    }

    unsigned long deadline = millis() + SENSOR_TIMEOUT_MS;
    bool ready = false;
    while (millis() < deadline) {
        delay(SENSOR_POLL_MS);
        if (yield_fn) yield_fn();
        err = scd4x.getDataReadyFlag(ready);
        if (err) {
            DBG_FMT("[sensor] getDataReadyFlag err=%u\n", err);
            continue;
        }
        if (ready) break;
    }

    if (!ready) {
        DBG("[sensor] timeout waiting for data");
        i2c_reset();
        return false;
    }

    err = scd4x.readMeasurement(*co2, *temp, *humidity);
    if (err) {
        DBG_FMT("[sensor] readMeasurement err=%u\n", err);
        i2c_reset();
        return false;
    }

    bool valid = (*co2      >= CO2_MIN_PPM && *co2      <= CO2_MAX_PPM) &&
                 (*temp     >= TEMP_MIN_C  && *temp     <= TEMP_MAX_C)  &&
                 (*humidity >= HUM_MIN_PCT && *humidity <= HUM_MAX_PCT);
    if (!valid) {
        DBG_FMT("[sensor] out-of-range: co2=%u temp=%.1f hum=%.1f\n", *co2, *temp, *humidity);
        i2c_reset();
        return false;
    }

    DBG_FMT("[sensor] co2=%u ppm  temp=%.1f C  hum=%.1f%%\n", *co2, *temp, *humidity);
    return true;
}

uint32_t battery_read_mv() {
    uint32_t adc_mv   = analogReadMilliVolts(PIN_BATT_ADC);
    uint32_t vbatt_mv = (uint32_t)(adc_mv * VOLTAGE_DIVIDER_RATIO);
    DBG_FMT("[batt] adc=%u mV  vbatt=%u mV\n", adc_mv, vbatt_mv);
    return vbatt_mv;
}

#endif  // SENSOR_STCC4
