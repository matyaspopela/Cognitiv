# Audit Report: src/main.cpp

**Date:** February 9, 2026
**Target:** `src/main.cpp`
**Auditor:** Gemini CLI (Security & Quality Auditor)

## 1. Executive Summary
The file `src/main.cpp` contains the firmware logic for the ESP8266-based environmental monitor. The analysis reveals one critical security vulnerability regarding MQTT communication. Additionally, there are operational improvements needed for power management (WiFi shutdown) and sensor accuracy (warmup stabilization). "Warning Mode" logic is identified as unreachable but is to be preserved for future use.

## 2. 🚨 Critical Vulnerabilities

### 2.1 TLS Certificate Validation Disabled
- **Location:** `src/main.cpp:322`
  ```cpp
  mqttSecureClient.setInsecure(); // TODO: replace with certificate validation
  ```
- **Risk:** The device explicitly disables SSL/TLS certificate verification. This makes the MQTT communication vulnerable to Man-in-the-Middle (MitM) attacks. An attacker could intercept or modify sensor data and inject false commands.
- **Recommendation:** Implement proper certificate verification. Load the CA certificate for the MQTT broker (HiveMQ) and use `mqttSecureClient.setTrustAnchors()` or `setFingerprint()`.

## 3. ⚠️ High-Priority Improvements

### 3.1 Unreachable Code (Warning Mode)
- **Location:** `src/main.cpp:520` (loop function)
- **Issue:** The `setup()` function always terminates with `ESP.deepSleep()`.
  ```cpp
  // src/main.cpp:495
  // Always proceed to deep sleep (warning mode disabled)
  Serial.println("Data sent. Proceeding to deep sleep...");
  ...
  ESP.deepSleep(30e6);
  ```
- **Status:** **Intentionally Disabled.** The "Warning Mode" (continuous monitoring) is not currently required but the logic should be preserved.
- **Recommendation:** Retain the code in `loop()` but ensure `setup()` continues to prevent it from running. Add a comment explicitly stating this is intentional dead code for future feature activation.

### 3.2 Heap Fragmentation Risk
- **Location:** `src/main.cpp:663`
  ```cpp
  String jsonString;
  serializeJson(doc, jsonString);
  ```
- **Issue:** The use of `String` for JSON serialization involves dynamic memory allocation. On memory-constrained devices like the ESP8266, frequent allocation/deallocation can lead to heap fragmentation.
- **Recommendation:** Serialize JSON directly to a static buffer or stream it directly to the MQTT client to avoid intermediate `String` objects.

### 3.3 WiFi Power Management
- **Location:** `src/main.cpp:528` (Before Deep Sleep)
- **Issue:** WiFi is not explicitly turned off before entering deep sleep.
- **Risk:** Higher power consumption during the sleep transition or potential issues with state reset.
- **Recommendation:** Call `WiFi.mode(WIFI_OFF);` explicitly before `ESP.deepSleep()`.

### 3.4 Sensor Stabilization (SCD41)
- **Location:** `src/main.cpp:468` (Reading Logic)
- **Issue:** The SCD41 sensor requires a stabilization period (warmup) after initialization. The current implementation tries to read almost immediately or within a short window.
- **Observation:** The sensor typically returns stable readings after ~7 measurement shots.
- **Recommendation:** Implement a warmup routine that discards the first ~7 readings or waits a sufficient duration (e.g., `scd41.readMeasurement()` loop with validation) before accepting a value for transmission.

## 4. 💡 Refactoring Suggestions

### 4.1 Monolithic Structure
- **Issue:** `src/main.cpp` handles hardware initialization, WiFi connection, MQTT protocol, display rendering, and sensor logic.
- **Suggestion:** Extract distinct modules:
  - `NetworkManager` (WiFi + MQTT)
  - `DisplayManager` (OLED handling)
  - `SensorManager` (SCD41 + Voltage)
  - `PowerManager` (Deep Sleep logic)

### 4.2 Inconsistent Sleep Duration
- **Location:** `src/main.cpp:506` vs `include/config.h.example`
- **Issue:** The code uses a hardcoded `30e6` (30 seconds) for deep sleep, while `config.h` defines `READING_INTERVAL_MS` as 10000 (10 seconds).
- **Suggestion:** Use a configuration constant (e.g., `DEEP_SLEEP_SECONDS`) to ensure consistency.

## 5. ✅ Policy Compliance

| Category | Status | Notes |
| :--- | :--- | :--- |
| **Governance** | **FAIL** | `setInsecure()` violates the safety requirement for secure communication. |
| **Constraints** | **PASS** | Uses `config.h` for secrets (via macros). No hardcoded credentials in source. |
| **Standards** | **PASS** | Naming is clear (`connectWiFi`, `readSensors`). Comments explain *why*. |

**Final Verdict:** **REQUEST CHANGES** (Must fix TLS, WiFi sleep, and Sensor Warmup)