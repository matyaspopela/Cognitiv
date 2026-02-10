# Firmware Audit: Deep Sleep & Reliability Analysis

## 1. Executive Summary
**Target:** `src/` (ESP8266 Firmware)
**Issue:** Device fails to wake from Deep Sleep after 1-2 cycles.
**Verdict:** **CRITICAL**. The current implementation contains a fatal flaw regarding Flash memory usage and inefficient sensor state management that likely causes the reported instability.

## 2. Critical Vulnerabilities (🚨)

### 2.1. Flash Memory Wear & Latency (The "Zombie" Cause)
**Location:** `PowerManager.cpp:20` (`WiFi.mode(WIFI_OFF)`) and `NetworkManager.cpp:16` (`WiFi.mode(WIFI_STA)`)
**Severity:** Critical
**Analysis:**
The ESP8266 SDK saves the WiFi mode (`WIFI_OFF`, `WIFI_STA`, etc.) to flash memory *every time it changes* unless persistence is disabled.
- The current loop switches mode twice every 30 seconds.
- This results in ~5,700 flash writes/day.
- **Immediate Impact:** Flash writes take time and can cause system instability if power is fluctuating (e.g., during sensor warmup). It introduces non-deterministic latency.
- **Long-term Impact:** Permanent destruction of the ESP8266 flash chip within weeks.
**Fix:**
Add `WiFi.persistent(false);` immediately after `WiFi.begin()` or at the start of `setup()`. This forces configuration to be RAM-only.

### 2.2. Inefficient Sensor State Management
**Location:** `SensorManager.cpp:25` (`startPeriodicMeasurement`)
**Severity:** High
**Analysis:**
The code starts *Periodic Measurement* mode on every boot, takes a reading, and then stops it.
- **SCD41 behavior:** `startPeriodicMeasurement` enters a continuous mode. Stopping it takes 500ms (`stopPeriodicMeasurement`).
- **Issue:** This is a misuse of the sensor. For a 30s sleep cycle, "Single Shot" mode (`measureSingleShot`) is intended. It consumes less power and simplifies the state machine.
- **Risk:** If the sensor is still processing a "Stop" command when the ESP cuts power (or resets), the sensor state might become indeterminate, potentially holding the I2C bus low (hanging the ESP on next boot).

### 2.3. Missing I2C Bus Recovery
**Location:** `main.cpp:44` (`Wire.begin`)
**Severity:** Medium
**Analysis:**
If the ESP8266 reboots while a slave device (SCD41) is pulling SDA low (transmitting a 0), the I2C bus will lock up. `Wire.begin()` does not automatically clear this condition. The code will hang at `Wire.begin` or subsequent sensor calls, making it look like the device "didn't wake up".
**Fix:** Implement a bus clearing sequence (toggle SCL 9 times) before `Wire.begin()`.

## 3. Deep Sleep & Power Architecture

### 3.1. The "1/2 Cycle" Failure Mechanism
The reported failure after 1-2 cycles is consistent with:
1.  **WiFi Calibration Current Spike:** When `WiFi.mode(WIFI_STA)` is called after being `WIFI_OFF`, the ESP performs a full RF calibration. This draws high current (~300mA).
2.  **Flash Write Collision:** Writing `WIFI_OFF` to flash just before sleep might not complete if the capacitor drains too fast (brownout).
3.  **Zombie State:** If `WIFI_OFF` is written to flash, the next boot starts with RF disabled. The code then calls `WiFi.begin`, which *should* enable it, but combined with the `persistent` flag issue, it creates an unstable boot state.

### 3.2. Redundant WiFi Shutdowns
**Location:** `main.cpp:129` and `PowerManager.cpp:20`
**Analysis:**
WiFi is disconnected in `main.cpp`, then again in `PowerManager`. While safe, it indicates a lack of ownership. `PowerManager` should own the sleep transition entirely.

## 4. Rewriting Plan (Critical)

### Phase 1: Core Stability (Immediate Fix)
1.  **Disable WiFi Persistence:** Add `WiFi.persistent(false)` in `NetworkManager::connectWiFi`.
2.  **Fix I2C Init:** Add `recoverI2C()` function to toggle SCL before `Wire.begin()`.
3.  **Single Shot Mode:** Refactor `SensorManager` to use `measureSingleShot()` instead of periodic start/stop.

### Phase 2: Architecture Redesign (Recommended)
Refactor `setup()` into a linear pipeline optimized for battery:
1.  **Boot & Init:**
    - `Serial` (Debug only)
    - `I2C Recovery` -> `Wire.begin`
2.  **Sensor Read (Priority):**
    - Measure Sensor (Single Shot).
    - If Sensor fails, *do not* attempt WiFi (save battery), just sleep.
3.  **Network (Lazy Loading):**
    - Only enable WiFi (`WiFi.mode(WIFI_STA)`) *after* valid data is acquired.
    - `WiFi.persistent(false)`.
    - Connect -> Publish -> Disconnect (`WiFi.mode(WIFI_OFF)`).
4.  **Sleep:**
    - `ESP.deepSleep`.

### Phase 3: Hardware Verification
- Ensure **GPIO16** is connected to **RST**.
- Ensure Power Supply can handle 400mA peaks (add 470µF capacitor across VCC/GND if unstable).

## 5. Proposed Code Changes (Snippet)

**NetworkManager.cpp:**
```cpp
// In connectWiFi
WiFi.mode(WIFI_STA);
WiFi.persistent(false); // CRITICAL FIX
WiFi.disconnect();
WiFi.begin(ssid, password);
```

**SensorManager.cpp:**
```cpp
// Replace initSensors/readSensors with:
bool readSingleShot(SensorData& data) {
    scd41.measureSingleShot(); 
    delay(5000); // Wait for measurement (SCD41 takes 5s)
    if (scd41.readMeasurement()) { ... }
}
```
