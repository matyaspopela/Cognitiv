/*
 * SensorManager.cpp — SCD41 single-shot acquisition + battery voltage
 */

#include "managers/SensorManager.h"
#include "config.h"
#include <SparkFun_SCD4x_Arduino_Library.h>
#include <Wire.h>

namespace {
    SCD4x sensor;

    uint16_t _co2  = 0;
    float    _temp  = 0.0f;
    float    _hum   = 0.0f;
    bool     _valid = false;
}

namespace SensorManager {

bool init() {
    // begin(Wire, autoStartMeasurement=false) avoids power-hungry periodic mode.
    if (!sensor.begin(Wire, false, true, false)) {
        DBG("SCD41 not found at 0x%02X", SCD41_I2C_ADDR);
        return false;
    }

    // Belt-and-suspenders: ensure periodic mode is stopped.
    sensor.stopPeriodicMeasurement();
    delay(500);  // SCD41 needs ≥500 ms after stop before accepting new commands.

    DBG("SCD41 initialised (single-shot mode)");
    return true;
}

bool measure() {
    _valid = false;

    // ── Optional warm-up throws ───────────────────────────────────
    for (uint8_t w = 0; w < SCD41_WARMUP_READS; ++w) {
        DBG("Warmup read %u/%u", w + 1, SCD41_WARMUP_READS);
        sensor.measureSingleShot();
        delay(5000);
        sensor.readMeasurement();
    }

    // ── Production reading ────────────────────────────────────────
    if (!sensor.measureSingleShot()) {
        DBG("measureSingleShot() command failed");
        return false;
    }

    // Poll data-ready with a hard ceiling.
    unsigned long t0 = millis();
    while (!sensor.getDataReadyStatus()) {
        if (millis() - t0 > SENSOR_TIMEOUT_MS) {
            DBG("Sensor timeout after %lu ms", SENSOR_TIMEOUT_MS);
            return false;
        }
        delay(100);
    }

    if (!sensor.readMeasurement()) {
        DBG("readMeasurement() failed");
        return false;
    }

    _co2  = sensor.getCO2();
    _temp = sensor.getTemperature();
    _hum  = sensor.getHumidity();

    // ── Range validation ──────────────────────────────────────────
    _valid = (_co2  >= CO2_VALID_MIN  && _co2  <= CO2_VALID_MAX)
          && (_temp >= TEMP_VALID_MIN && _temp <= TEMP_VALID_MAX)
          && (_hum  >= HUM_VALID_MIN  && _hum  <= HUM_VALID_MAX);

    DBG("CO2=%u ppm  T=%.2f °C  H=%.2f %%  valid=%s",
        _co2, _temp, _hum, _valid ? "YES" : "NO");
    return true;
}

bool     isValid()          { return _valid; }
uint16_t getCO2()           { return _co2;   }
float    getTemperature()   { return _temp;  }
float    getHumidity()      { return _hum;   }

float readBatteryVoltage() {
    int raw = analogRead(PIN_BAT);
    float v = (raw / 1024.0f) * VOLTAGE_DIVIDER_RATIO;
    DBG("Battery ADC=%d  V=%.2f", raw, v);
    return v;
}

}  // namespace SensorManager
