/*
 * I2CManager.cpp — I2C bus recovery implementation
 */

#include "managers/I2CManager.h"
#include "config.h"
#include <Wire.h>

namespace I2CManager {

void init() {
    Wire.begin(PIN_SDA, PIN_SCL);
    DBG("Wire started  SDA=%d  SCL=%d", PIN_SDA, PIN_SCL);
}

bool recover() {
    DBG("Attempting I2C bus recovery (9 clocks) …");

    // 1. Force Software mode for pins (release Wire control)
    pinMode(PIN_SDA, INPUT_PULLUP);
    pinMode(PIN_SCL, OUTPUT);

    // 2. Clock up to 9 cycles
    bool released = false;
    for (int i = 0; i < 9; i++) {
        digitalWrite(PIN_SCL, LOW);
        delayMicroseconds(10);
        digitalWrite(PIN_SCL, HIGH);
        delayMicroseconds(10);

        // Check if device released SDA
        if (digitalRead(PIN_SDA) == HIGH) {
            released = true;
            DBG("  → Bus released at clock %d", i + 1);
            break;
        }
    }

    // 3. Send STOP condition: SCL High, then SDA Low->High
    digitalWrite(PIN_SCL, LOW);
    delayMicroseconds(10);
    pinMode(PIN_SDA, OUTPUT);
    digitalWrite(PIN_SDA, LOW); // SDA Low
    delayMicroseconds(10);
    
    digitalWrite(PIN_SCL, HIGH); // SCL High
    delayMicroseconds(10);
    digitalWrite(PIN_SDA, HIGH); // SDA High (STOP)
    delayMicroseconds(10);

    // 4. Restore pins for hardware I2C
    pinMode(PIN_SDA, INPUT);
    pinMode(PIN_SCL, OUTPUT); // Wire library will take over

    if (!released) {
        DBG("  x Bus still held LOW after 9 clocks");
    }

    // Explicitly re-init Wire
    init();
    return released;
}

bool devicePresent(uint8_t address) {
    Wire.beginTransmission(address);
    uint8_t err = Wire.endTransmission();
    return (err == 0);
}

void scanBus() {
    DBG("I2C bus scan (0x03–0x77):");
    uint8_t found = 0;
    for (uint8_t addr = 0x03; addr <= 0x77; ++addr) {
        Wire.beginTransmission(addr);
        if (Wire.endTransmission() == 0) {
            DBG("  → Device found at 0x%02X", addr);
            ++found;
        }
        yield();   // Feed ESP8266 watchdog during scan
    }
    DBG("  Scan complete: %u device(s)", found);
}

}  // namespace I2CManager

