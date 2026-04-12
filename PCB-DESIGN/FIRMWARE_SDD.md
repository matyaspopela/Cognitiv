# Cognitiv Firmware v2 — Software Design Document

## Context

The original firmware targets an ESP8266 (ESP-12S) with a complex feature set: quiet hours, NTP sync, RTC memory persistence, chunked deep sleep. The new PCB uses an **ESP32-C3-WROOM-02** with a different pin layout, P-channel power gating, and a different ADC configuration. We need a clean rewrite that does exactly one thing well: **wake → read sensors → publish MQTT → deep sleep**.

A small backend change is also needed: the current `DataService.normalize_sensor_data()` raises `KeyError` if `timestamp` is missing from the payload. Making this field optional (defaulting to server UTC time) eliminates the need for NTP sync in firmware, saving 2-5 seconds of wake time per cycle and significant code complexity.

---

## Critical Hardware Corrections (vs. initial assumptions)

| Item | Assumed | Actual (from netlist + EasyEDA schema) |
|------|---------|---------------------------------------|
| I2C power gate polarity | GPIO6 HIGH = ON | GPIO6 **LOW = ON** (P-channel AO3401A, Q2) |
| LED power gate polarity | GPIO7 HIGH = ON | GPIO7 **LOW = ON** (P-channel AO3401A, Q5) |
| Battery ADC pin | GPIO14 | **GPIO1** (module pin 17 = IO1 = ADC1_CH1) |
| Battery voltage divider ratio | 4.62 | **2.0** (R18=1M, R19=1M equal divider) |
| I2C pins | GPIO0/GPIO2 | **GPIO4** (SDA) / **GPIO5** (SCL) |
| I2C pull-ups on PCB | Populated | **DNP (R3=R4=4.7k not placed)** — rely on LaskaKit module's on-board pull-ups |

---

## Complete GPIO Map (ESP32-C3-WROOM-02, confirmed from EasyEDA schema + netlist)

| Module Pin | GPIO | Net / Signal | Firmware Role |
|-----------|------|-------------|---------------|
| 1 | 3V3 | 3V3 | Power input |
| 2 | EN | EN | Enable (RC + PB2 reset) |
| 3 | IO4 | SDA | I2C data |
| 4 | IO5 | SCL | I2C clock |
| 5 | IO6 | I2CONESP → I2C_ON | I2C rail power gate (LOW=ON) |
| 6 | IO7 | LEDONESP → LED_ON | SK6812 power gate (LOW=ON) |
| 7 | IO8 | — | Unused |
| 8 | IO9 | BOOT | Strapping / H2 header |
| 9 | GND | GND | Ground |
| 10 | IO10 | LEDDATAESP → LED_DATA | SK6812 addressable LED data |
| 11 | IO20/RXD0 | RXD | UART RX (H1 debug header) |
| 12 | IO21/TXD0 | TXD | UART TX (H1 debug header) |
| 13 | IO18 | DN | USB D− |
| 14 | IO19 | DP | USB D+ |
| 15 | IO3 | INPUTSW1 | SW1 user button |
| 16 | IO2 | — | Unused |
| 17 | IO1 | BATT_MONITOR | Battery voltage ADC |
| 18 | IO0 | PIEZO_CIRC | Buzzer (R15 → BUZZER1) |
| 19 | GND | GND | Ground (module bottom pad) |

---

## Sensor: LaskaKit SCD41 (CO2 + Temperature + Humidity)

The SCD41 CO2 sensor module by LaskaKit plugs into the **PIN_SCD** 4-pin 2.54mm header.

**PIN_SCD header pinout (left to right on PCB):**

| Pin | Net | Signal |
|-----|-----|--------|
| 1 | 3V3_I2C | VCC (power-gated, GPIO6 LOW = ON) |
| 2 | GND | Ground |
| 3 | SCL | GPIO5 |
| 4 | SDA | GPIO4 |

**Critical notes:**
- I2C address: **0x62** (fixed, cannot be changed)
- The LaskaKit SCD41 module has **on-board I2C pull-up resistors** — these are **required** because PCB pull-ups R3/R4 (4.7k) are **DNP**. Do not connect SCD41 without the LaskaKit module (bare chip will have no pull-ups).
- The sensor requires ~1 second stabilization after power-on before issuing commands. SCD41 single-shot measurement takes ~5 seconds additional. Budget **≥6 seconds** between `sensor_power_on()` and data-ready.
- The 3V3_I2C power rail also feeds PIN_OLED and PIN_EXTRA headers — all three share the same gated rail. Powering on for SCD41 also powers any OLED/extra device on the bus.
- R7 (0Ω, DNP) is a bypass jumper between 3V3 and 3V3_I2C. Installing R7 permanently enables the I2C rail (bypasses power gate) — keep it DNP for power gating to work.

---

## Architecture

Single `main.cpp` with three minimal header files. No classes, no state machines, no manager pattern.

```
src/
  main.cpp              # Boot-to-sleep cycle
include/
  config.h              # Pin map, credentials, timing constants
  sensor.h              # SCD41 single-shot read with power gating
  network.h             # WiFi connect + MQTT TLS publish
```

---

## Implementation Steps

### Step 0: Backend — Make timestamp optional
**File:** `server/api/services/data.py` (lines 34-49)

Change `normalize_sensor_data()` so a missing `timestamp` defaults to `datetime.now(timezone.utc)` instead of raising `KeyError`. This is a ~3-line change in the try/except block.

**Verification:** Run the Django dev server locally, publish an MQTT message without a `timestamp` field, confirm it ingests with server-generated timestamp.

---

### Step 1: PlatformIO configuration
**File:** `platformio.ini` — replace the existing `[env:esp12e]` with `[env:esp32c3]`

- Platform: `espressif32`
- Board: `esp32-c3-devkitc-02` (or `lolin_c3_mini` — closest match for WROOM-02)
- Framework: `arduino`
- Build flags: same credential injection pattern as old firmware
- Libraries:
  - `sensirion/Sensirion I2C SCD4x` (official Sensirion lib, more maintained than SparkFun)
  - `bblanchon/ArduinoJson@^7` (v7 for ESP32, more memory efficient)
  - `knolleary/PubSubClient@^2.8`
- Monitor speed: 115200
- Upload via USB-C (no explicit port needed, auto-detect)

**Verification:** `pio run` compiles with empty `main.cpp`.

---

### Step 2: Pin definitions and constants
**File:** `include/config.h` — complete rewrite

Contents:
- Pin definitions:
  ```cpp
  #define SDA_PIN       4
  #define SCL_PIN       5
  #define I2C_POWER     6   // LOW = rail ON (P-ch Q2, AO3401A)
  #define LED_POWER     7   // LOW = SK6812 ON (P-ch Q5, AO3401A)
  #define LED_DATA      10  // SK6812 addressable LED data
  #define BATT_ADC      1   // ADC1_CH1, voltage divider R18/R19 (2×1MΩ, ratio 2.0)
  #define BUZZER_PIN    0   // Piezo buzzer via R15
  #define BUTTON_PIN    3   // SW1 user button
  ```
- Power gate logic: `I2C_POWER_ON = LOW`, `I2C_POWER_OFF = HIGH`
- Network credentials with `#ifndef` guards and fallbacks
- Timing: `SLEEP_INTERVAL_US` (5 min default), `WIFI_TIMEOUT_MS` (10s), `MQTT_TIMEOUT_MS` (5s), `SENSOR_TIMEOUT_MS` (12s — 1s stabilization + up to 6s single-shot + margin)
- Validation ranges: CO2 400-5000 ppm, temp -10 to 50 °C, humidity 0-100 %RH
- Battery: `VOLTAGE_DIVIDER_RATIO 2.0f`, `MIN_VOLTAGE 3.0f`
- Debug macro

**Verification:** Compiles, all constants accessible from `main.cpp`.

---

### Step 3: Sensor module
**File:** `include/sensor.h` — inline functions in header

Functions:
- `sensor_power_on()` — `pinMode(I2C_POWER, OUTPUT)` first, then set GPIO6 LOW, then `delay(1000)` for both rail stabilization **and** SCD41 power-on stabilization (the datasheet requires ~1s before first command)
- `sensor_power_off()` — set GPIO6 HIGH
- `sensor_init(Wire)` — call `Wire.begin(SDA_PIN, SCL_PIN)`, init SCD4x driver. SCD41 I2C address is **0x62** (fixed, no address selection pins on the chip).
- `sensor_read(float* temp, float* hum, uint16_t* co2)` — single-shot measurement:
  1. `scd4x.measureSingleShot()` — triggers measurement (~5 s)
  2. Poll `scd4x.getDataReadyStatus()` every 100ms until ready, up to `SENSOR_TIMEOUT_MS`
  3. `scd4x.readMeasurement(co2, temp, hum)`
  4. Validate ranges, return bool success
- `read_battery_voltage()` — `analogRead(BATT_ADC)`, convert to volts (ADC ref 3.3V, 12-bit = 4095 counts), multiply by `VOLTAGE_DIVIDER_RATIO`, return float

Key details:
- **Do not call `scd4x.begin()` before `Wire.begin()`** — the Sensirion lib wraps the Wire object; Wire must be initialized first with the correct SDA/SCL pins.
- Power off sensors after read regardless of success/failure (put in `finally`-style code path).

**Verification:** Read sensor with Serial output, confirm values are reasonable.

---

### Step 4: Network module
**File:** `include/network.h` — inline functions in header

Functions:
- `wifi_connect()` — `WiFi.mode(WIFI_STA)`, `WiFi.begin(SSID, PASS)`, poll with timeout, return bool
- `wifi_disconnect()` — `WiFi.disconnect(true)`, `WiFi.mode(WIFI_OFF)`
- `mqtt_publish(mac, temp, hum, co2, voltage)` — construct JSON with ArduinoJson, connect to broker over TLS, publish, disconnect, return bool

MQTT details:
- Use `WiFiClientSecure` with `setInsecure()` (same as old firmware — no cert pinning)
- Client ID: `cognitiv_` + MAC (no colons)
- JSON payload: `{"mac_address":"AA:BB:CC:DD:EE:FF","temperature":22.5,"humidity":45.3,"co2":650,"voltage":3.8}`
- No timestamp field (server generates it after Step 0)
- Topic from `MQTT_TOPIC` build flag

**Verification:** Publish test message, confirm it appears in Django server logs.

---

### Step 5: Main boot-to-sleep cycle
**File:** `src/main.cpp`

`setup()` function (the entire firmware runs here — `loop()` is empty and unreachable):

```
1. Serial.begin(115200)
2. Read battery voltage (analogRead GPIO1)
   - If < MIN_VOLTAGE → deep sleep immediately (emergency)
3. Power on I2C rail (GPIO6 LOW) — includes 1s stabilization delay
4. Init Wire on GPIO4/GPIO5, init SCD4x driver (address 0x62)
5. Trigger SCD41 single-shot, poll for data ready (up to SENSOR_TIMEOUT_MS)
6. Power off I2C rail (GPIO6 HIGH) — regardless of read success/failure
7. If sensor read failed → deep sleep (don't waste power on WiFi)
8. Connect WiFi (with timeout)
9. If WiFi failed → deep sleep
10. Get MAC address string
11. Publish MQTT (with timeout)
12. Disconnect WiFi
13. Enter deep sleep for SLEEP_INTERVAL_US
```

Deep sleep: `esp_deep_sleep(SLEEP_INTERVAL_US)` — device resets on wake, re-enters `setup()`.

**Verification:** Full cycle test — confirm data appears in MongoDB via Django admin or direct DB query.

---

### Step 6: Update `.env.example`
**File:** `.env.example`

Update comments to reference ESP32-C3 instead of ESP8266. No structural changes needed — the env vars are the same.

---

## Files Modified/Created Summary

| File | Action | Description |
|------|--------|-------------|
| `server/api/services/data.py` | Modify | Make timestamp optional (default to UTC now) |
| `platformio.ini` | Rewrite | ESP32-C3 config replacing ESP8266 |
| `include/config.h` | Rewrite | New pin map, constants for ESP32-C3 |
| `include/sensor.h` | Create | SCD41 + battery reading functions |
| `include/network.h` | Create | WiFi + MQTT TLS publish functions |
| `src/main.cpp` | Rewrite | Simple boot-to-sleep cycle |
| `.env.example` | Modify | Update comments for ESP32-C3 |

Old firmware headers in `include/managers/` are left untouched (they belong to the old firmware in `old_firmware/`).

---

## Verification Plan

1. **Compile check:** `pio run` succeeds with no errors or warnings
2. **Serial monitor:** Connect via USB-C, observe boot log showing battery voltage, sensor readings, WiFi connection, MQTT publish
3. **Backend ingestion:** Check Django server logs for `[MQTT] Message received` with correct payload format
4. **Deep sleep current:** Verify with multimeter that sleep current is in the microamp range (I2C rail powered off)
5. **Error paths:** Test with sensor disconnected (should log error, go to sleep), WiFi off (should timeout, go to sleep)

---

## Hardware Notes for Debugging

- **BOOT button (PB2):** Connected to EN pin — this is actually a **reset** button, not BOOT/flash mode. To enter flash mode, hold GPIO9 (H2 header) LOW while resetting.
- **H1 debug header:** 3-pin, pin1=TXD (GPIO21), pin2=RXD (GPIO20), pin3=GND. Exposes UART0 for serial monitor without USB.
- **SK6812 RGB LED:** Powered from V_SYS via Q5 (GPIO7 LOW = ON), data on GPIO10. Not needed for v1 firmware but pin is reserved.
- **Buzzer (BUZZER1):** Piezo, 4100 Hz rated, on GPIO0 via R15 (130Ω). GPIO0 is a regular IO pin on ESP32-C3 (not a strapping pin — that's an ESP8266 leftover concern). Safe to use normally.
- **BOOT strapping pin is GPIO9** (module pin 8, H2 header). R6 (10k pull-up to 3V3) is DNP — the C3's internal weak pull-up on GPIO9 is sufficient to hold it HIGH for normal boot. If the device ever gets stuck in download mode, short H2 to verify GPIO9 isn't being pulled low externally.
- **NTC thermistor (R29, 10k):** Connected to TP4056 TEMP pin for battery temperature protection during charging. Not connected to ESP32 ADC — this is NOT an air temperature sensor.
