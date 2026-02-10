/*
 * I2CManager.h — I2C bus initialisation & recovery for ESP8266
 *
 * On every deep-sleep wake the SDA line may be held low by a peripheral
 * whose transaction was interrupted by the previous reset.  recover()
 * clocks SCL until SDA releases, then re-initialises Wire.
 */

#pragma once
#include <Arduino.h>

namespace I2CManager {

/// Initialise Wire on the configured SDA/SCL pins.
void init();

/// Toggle SCL up to 9 times to free a stuck I2C bus, then re-init.
/// Returns true if bus recovered (SDA reads HIGH).
bool recover();

/// Quick probe for a device at `address`.  Returns true on ACK.
bool devicePresent(uint8_t address);

/// Scan the full 7-bit address range and log every responding device.
void scanBus();

}  // namespace I2CManager
