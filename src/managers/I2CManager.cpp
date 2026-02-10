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
    DBG("Attempting I2C bus recovery …");

    // Reconfigure pins for manual bit-bang (ESP8266 Wire has no end()).
    pinMode(PIN_SDA, INPUT_PULLUP);
    pinMode(PIN_SCL, OUTPUT);

    // Clock SCL up to 9 times; exit early if SDA releases.
    bool recovered = false;
    for (uint8_t i = 0; i < 9; ++i) {
        digitalWrite(PIN_SCL, LOW);
        delayMicroseconds(5);
        digitalWrite(PIN_SCL, HIGH);
        delayMicroseconds(5);

        if (digitalRead(PIN_SDA) == HIGH) {
            recovered = true;
            break;
        }
    }

    // Generate STOP condition: SDA LOW→HIGH while SCL is HIGH.
    pinMode(PIN_SDA, OUTPUT);
    digitalWrite(PIN_SDA, LOW);
    delayMicroseconds(5);
    digitalWrite(PIN_SCL, HIGH);
    delayMicroseconds(5);
    digitalWrite(PIN_SDA, HIGH);
    delayMicroseconds(5);

    // Re-initialise Wire.
    init();

    DBG("Bus recovery %s", recovered ? "OK" : "FAILED – SDA stuck LOW");
    return recovered;
}

bool devicePresent(uint8_t address) {
    Wire.beginTransmission(address);
    uint8_t err = Wire.endTransmission();
    return (err == 0);
}

}  // namespace I2CManager
