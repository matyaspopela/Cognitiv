# Audit Task 01: TLS Certificate Validation (Critical) - UPDATED

**Status:** Open
**Priority:** Critical
**Target:** `src/main.cpp`, `src/NetworkManager.cpp`
**Related Finding:** 2.1 in `audit_src_main_cpp.md`

## 1. Problem Description
The device currently establishes an MQTT connection using `WiFiClientSecure` but explicitly disables TLS certificate validation.

- **File:** `src/main.cpp`
- **Line:** ~76 (in `setup()`)
- **Code:** `networkManager.setInsecureMode();`

This method calls `mqttSecureClient.setInsecure()` in `src/NetworkManager.cpp`, which skips the verification of the server's certificate chain.

### Risk Analysis
- **Vulnerability:** Man-in-the-Middle (MitM) Attack.
- **Impact:** An attacker on the same network (or upstream) can intercept the connection, read sensor data, or inject malicious MQTT payloads/commands.
- **Severity:** High (CVSS ~7.4).

## 2. Technical Context & Missing Dependencies
The `NetworkManager` class supports certificate validation via `setCACertificate`. However, **TLS validation requires the device to know the current time** to check the certificate's validity period (NotBefore / NotAfter).

**Critical Gap:** The current `src/main.cpp` **does not initialize the system clock via NTP**.
- `const char *NTP_SERVER = "pool.ntp.org";` is defined but never used.
- `configTime()` is never called.

**Result:** If we only apply the certificate, the connection will **FAIL** because the ESP8266 defaults to Jan 1st 1970, which is outside the validity window of modern certificates.

## 3. Implementation Plan

### Stage 1: Certificate Acquisition
We need the Root CA certificate that signed the HiveMQ broker's certificate. For HiveMQ Cloud (and most modern web services), this is typically **ISRG Root X1** (Let's Encrypt).

**Action:**
1.  Verify the broker's certificate chain using OpenSSL.
2.  Download the Root CA in PEM format.

### Stage 2: Storage Strategy
Storing the certificate as a hardcoded string in `src/main.cpp` is messy.
**Action:**
1.  Create a new header file `include/certs.h`.
2.  Define the certificate as a `PROGMEM` string.

### Stage 3: Time Synchronization (New Requirement)
**Action:**
1.  In `src/main.cpp`, implemented a `waitForTime()` helper function.
2.  Call `configTime` with the existing constants (`GMT_OFFSET_SEC`, etc.) immediately after WiFi connection.
3.  Block execution (with a timeout) until time is set.

### Stage 4: Code Modification
**Action:**
1.  In `src/main.cpp`, include `certs.h`.
2.  Initialize Time Sync.
3.  Replace `networkManager.setInsecureMode()` with `networkManager.setCACertificate(ROOT_CA_CERT)`.

## 4. Verification Plan
1.  **Build & Flash:** Ensure the code compiles and uploads.
2.  **Serial Monitor:**
    - Verify "WiFi connected".
    - Verify "Waiting for NTP time sync...".
    - Verify "Time updated: [Current Date]".
    - Verify "MQTT: TLS certificate validation ENABLED".
3.  **Functional Test:** Verify data is still arriving at the broker.