# Cognitiv Firmware v2 — Software Design Document

## Context

The original firmware targets an ESP8266 (ESP-12S) with a complex feature set: quiet hours, NTP sync, RTC memory persistence, chunked deep sleep. The new PCB uses an **ESP32-C3-WROOM-02** with a different pin layout, P-channel power gating, and a different ADC configuration. We need a clean rewrite that does exactly one thing well: **wake → read sensors → publish MQTT → deep sleep**.

A small backend change is also needed: the current `DataService.normalize_sensor_data()` raises `KeyError` if `timestamp` is missing from the payload. Making this field optional (defaulting to server UTC time) eliminates the need for NTP sync in firmware, saving 2-5 seconds of wake time per cycle and significant code complexity.

---

## Critical Hardware Corrections (vs. initial assumptions)

| Item | Assumed | Actual (from netlist) |
|------|---------|----------------------|
| I2C power gate polarity | GPIO6 HIGH = ON | GPIO6 **LOW = ON** (P-channel AO3401A, Q2) |
| LED power gate polarity | GPIO7 HIGH = ON | GPIO7 **LOW = ON** (P-channel AO3401A, Q5) |
| Battery ADC pin | GPIO14 | **GPIO1** (U2 pin 17 = IO1 = ADC1_CH1) |
| Battery voltage divider ratio | 4.62 | **2.0** (R18=1M, R19=1M equal divider) |
| I2C pins | GPIO0/GPIO2 | **GPIO4** (SDA) / **GPIO5** (SCL) |

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
- Pin definitions: `SDA=4, SCL=5, I2C_POWER=6, LED_POWER=7, LED_DATA=10, BATT_ADC=1`
- Power gate logic: `I2C_POWER_ON=LOW, I2C_POWER_OFF=HIGH`
- Network credentials with `#ifndef` guards and fallbacks
- Timing: `SLEEP_INTERVAL_US` (5 min default), `WIFI_TIMEOUT_MS` (10s), `MQTT_TIMEOUT_MS` (5s), `SENSOR_TIMEOUT_MS` (10s)
- Validation ranges: CO2 400-5000, temp -10 to 50, humidity 0-100
- Battery: `VOLTAGE_DIVIDER_RATIO=2.0f`, `MIN_VOLTAGE=3.0f`
- Debug macro

**Verification:** Compiles, all constants accessible from `main.cpp`.

---

### Step 3: Sensor module
**File:** `include/sensor.h` — inline functions in header

Functions:
- `sensor_power_on()` — set GPIO6 LOW, `delay(100)` for rail stabilization
- `sensor_power_off()` — set GPIO6 HIGH
- `sensor_init(Wire)` — call `Wire.begin(SDA, SCL)`, init SCD4x driver
- `sensor_read(float* temp, float* hum, uint16_t* co2)` — single-shot measurement, poll for data ready (100ms intervals, timeout), read values, validate ranges, return bool success
- `read_battery_voltage()` — `analogRead(BATT_ADC)`, apply divider ratio, return float

Key details:
- SCD41 single-shot takes ~5 seconds
- Use `scd4x.measureSingleShot()` then poll `getDataReadyStatus()`
- Validate all three readings before returning success
- Power off sensors after read regardless of success/failure

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
2. Read battery voltage
   - If < MIN_VOLTAGE → deep sleep immediately (emergency)
3. Power on I2C rail (GPIO6 LOW)
4. Init and read SCD41 (single-shot)
5. Power off I2C rail (GPIO6 HIGH)
6. If sensor read failed → deep sleep (don't waste power on WiFi)
7. Connect WiFi (with timeout)
8. If WiFi failed → deep sleep
9. Get MAC address string
10. Publish MQTT (with timeout)
11. Disconnect WiFi
12. Enter deep sleep for SLEEP_INTERVAL_US
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
