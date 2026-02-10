/*
 * SensorManager.h — SCD41 + battery voltage acquisition
 *
 * Uses SCD41 Single-Shot mode to minimise power consumption.
 * All readings are validated before being considered usable.
 */

#pragma once
#include <Arduino.h>

namespace SensorManager {

/// Initialise SCD41 (single-shot, no periodic mode).
/// Returns false if sensor does not ACK on I2C.
bool init();

/// Trigger single-shot measurement, block until data ready or timeout.
/// Returns false on timeout or I2C error.
bool measure();

/// True when the last measure() produced values inside valid ranges.
bool isValid();

// ── Getters (valid only after a successful measure()) ────────────
uint16_t getCO2();          // ppm
float    getTemperature();  // °C
float    getHumidity();     // %RH

/// Read battery voltage from A0 via resistive divider.
float    readBatteryVoltage();

}  // namespace SensorManager
