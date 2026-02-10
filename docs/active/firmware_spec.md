# Firmware Specification: IoT Environmental Monitor

## 1. Overview
This document defines the requirements for the firmware of an IoT Environmental Monitoring System. The device monitors CO2, Temperature, Humidity, and Battery Voltage, transmitting data via MQTT over WiFi. The system is battery-powered and requires aggressive power management (Deep Sleep) to maximize operational life.

## 2. Hardware Requirements

### 2.1. Microcontroller
*   **Platform:** ESP8266 (ESP-12S/ESP-12E module).
*   **Clock Speed:** 80MHz recommended for power efficiency.
*   **Flash Mode:** DIO (standard for ESP-12 modules).

### 2.2. Pin Definitions (Critical)
*   **I2C Bus:**
    *   **SDA:** GPIO 0 (D3) *[Note: Check board revision, standard ESP12S is often GPIO 4, but LaskaKit uses 0]*
    *   **SCL:** GPIO 2 (D4) *[Note: Check board revision, standard ESP12S is often GPIO 5, but LaskaKit uses 2]*
*   **Analog Input:**
    *   **A0:** Battery voltage monitoring (via voltage divider).
*   **Wakeup:**
    *   **GPIO 16 (D0):** Connected to **RST** (Required for Deep Sleep wake).
*   **Status LED:** 
    *   **GPIO 2 (D4)** (Built-in LED, active low) - Optional for debugging, but note conflict with I2C SCL if used simultaneously.

### 2.3. Peripherals
*   **Primary Sensor:** Sensirion SCD41 (CO2, Temperature, Humidity).
    *   Interface: I2C (Address: `0x62`).
    *   Supply Voltage: 3.3V.
*   **Power Source:** LiPo/Li-Ion Battery (measured via A0).

## 3. Functional Requirements

### 3.1. Operational Lifecycle (The "Loop")
The firmware must operate in a strict linear cycle to minimize wake time:
1.  **Wake & Initialize:** Boot from Deep Sleep.
2.  **Bus Recovery:** Perform I2C bus clearing sequence (toggle SCL) to prevent sensor deadlocks.
3.  **Measure (Priority):** Power up and read sensors *before* enabling WiFi.
4.  **Connect (Lazy Loading):** Connect to WiFi/MQTT only if valid sensor data is obtained.
5.  **Transmit:** Publish data to MQTT broker.
6.  **Sleep:** Enter Deep Sleep immediately.

### 3.2. Sensor Management
*   **Module:** `SensorManager` (Conceptual)
*   **Mode:** Must use **Single Shot Mode** (`measureSingleShot`) for SCD41.
    *   *Rationale:* Optimized for low duty cycles (< 5 readings/hour) and eliminates power-hungry continuous modes.
*   **Stabilization:** Implementation must discard initial readings if necessary to ensure sensor stability (configurable warmup count).
*   **Timeout:** Must enforce strictly timed measurements (e.g., 5-6s max) to prevent battery drain during sensor hangs.
*   **Fail-Safe:** If sensor fails, the device must **skip network connection** and return to deep sleep immediately.

### 3.3. Network Management
*   **Module:** `NetworkManager` (Conceptual)
*   **WiFi Lifecycle:**
    *   **Persistence:** Must explicitly disable flash persistence (`WiFi.persistent(false)`) to prevent flash memory destruction.
    *   **Mode:** Explicitly switch `WIFI_STA` on connect and `WIFI_OFF` on disconnect.
*   **MQTT:**
    *   **Security:** Must support TLS/SSL connection (can allow insecure/self-signed for dev/testing via config).
    *   **Reliability:** clean session = true.
    *   **Retries:** Limited retries (e.g., 1-2 attempts) before giving up to save battery.
*   **Client ID:** unique ID based on MAC address.

### 3.4. Power Management
*   **Module:** `PowerManager` (Conceptual)
*   **Deep Sleep:** Primary power mode. All peripherals (WiFi, Sensors) must be powered down or put in standby *before* calling `ESP.deepSleep`.
*   **Quiet Hours:**
    *   Device must check current time (via NTP).
    *   If within configured "Quiet Hours" window (e.g., 22:00 - 06:00), device should enter an extended sleep period or stop sampling to preserve battery/reduce light pollution.
*   **Safety:** Watchdog timer should be active to reset device if it hangs > 10s.

## 4. Data Specification

### 4.1. MQTT Payload
Data must be published as a JSON object to the configured topic.

**Format:**
```json
{
  "timestamp": <integer, unix_epoch>,
  "mac_address": "<string, format AA:BB:CC:DD:EE:FF>",
  "temperature": <float, 2 decimals, degrees_celsius>,
  "humidity": <float, 2 decimals, percent_rh>,
  "co2": <integer, ppm>,
  "voltage": <float, 2 decimals, volts>
}
```

### 4.2. Topics
*   **Data Topic:** Configurable (e.g., `sensors/environment/living_room`).

## 5. Configuration Interface
The firmware must not have hardcoded credentials. All configuration must be injectable at build time or runtime via a configuration header/file.

**Required Configuration Parameters:**
*   **WiFi:** `SSID`, `PASSWORD`
*   **MQTT:** `BROKER_HOST`, `BROKER_PORT`, `USERNAME`, `PASSWORD`, `TOPIC`
*   **Timing:** `READING_INTERVAL` (s), `DEEP_SLEEP_DURATION` (s)
*   **Hardware:** `VOLTAGE_DIVIDER_RATIO` (for battery calibration)
*   **System:** `QUIET_HOURS_START`, `QUIET_HOURS_END`

## 6. Error Handling & Robustness

### 6.1. I2C Bus Recovery
*   **Condition:** On boot, if SLAVE holds SDA low.
*   **Action:** Master (ESP) must toggle SCL line ~9 times to clock out the remaining bits of the stalled transaction, releasing the bus.

### 6.2. Network Failure
*   **Condition:** WiFi or MQTT unreachable.
*   **Action:** Log error (Serial), Disconnect WiFi, Enter Deep Sleep. Do *not* loop indefinitely.

### 6.3. Low Battery
*   **Recommended:** If voltage drops below threshold (e.g., 3.3V), enter indefinite deep sleep or significantly increase sleep interval to protect battery.
