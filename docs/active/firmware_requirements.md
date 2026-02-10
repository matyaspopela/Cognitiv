# Firmware Specification: IoT Environmental Monitor

## 1. Overview
This document outlines the comprehensive requirements for the firmware of an IoT Environmental Monitoring System. The device is designed to monitor air quality (CO2, Temperature, Humidity) and battery voltage, transmitting data via MQTT over WiFi. The system must be optimized for battery operation using deep sleep and intelligent power management.

## 2. Hardware Requirements

### 2.1 Microcontroller
- **Target Platform:** ESP8266 (specifically ESP-12S module).
- **Architecture:** The firmware must be compatible with the ESP8266 Arduino core or equivalent framework.

### 2.2 Pin Configuration
The software must utilize the following pin definitions (specifically mapped for LaskaKit AirBoard 8266):
- **I2C SDA:** GPIO 0
- **I2C SCL:** GPIO 2
- **Battery Voltage (ADC):** A0 (Analog Input)
- **Deep Sleep Wake:** GPIO 16 (connected to RST for deep sleep wake-up)

### 2.3 Peripherals
- **Primary Sensor:** Sensirion SCD41 (CO2, Temperature, Humidity) connected via I2C (Address 0x62).
- **Voltage Divider:** Connected to A0 for battery monitoring.

## 3. Functional Requirements

### 3.1 Operational Cycle
The device shall operate in a cyclical "Wake-Measure-Transmit-Sleep" loop to maximize battery life. The standard cycle must proceed as follows:
1.  **Boot & Initialization:** Initialize Serial and I2C bus.
2.  **I2C Recovery:** Perform a bus recovery sequence (toggling SCL) on boot to clear any stuck low states on SDA from previous incomplete transmissions.
3.  **Sensor Reading (Lazy Loading):**
    *   Initialize sensors *before* enabling WiFi.
    *   Perform measurement (Single-Shot mode recommended for SCD41).
    *   **Constraint:** If sensor initialization fails or readings are invalid, the device must immediately enter deep sleep without attempting WiFi connection (to save power).
4.  **Network Connection:**
    *   Enable WiFi and connect to the configured SSID.
    *   Connect to the MQTT broker using TLS/SSL credentials.
5.  **Data Transmission:** Publish sensor data to the configured MQTT topic.
6.  **Shutdown:**
    *   Explicitly disconnect and power down the WiFi radio.
    *   Enter Deep Sleep for the configured interval.

### 3.2 Power Management
- **Deep Sleep:** The device must utilize the ESP8266 Deep Sleep mode for the majority of its lifecycle.
- **WiFi Power Control:** WiFi radio must be explicitly turned off (`WiFi.mode(WIFI_OFF)`) before entering deep sleep.
- **Quiet Hours:**
    *   The system shall support a configurable "Quiet Hours" schedule (Start Time, End Time).
    *   If the current time falls within Quiet Hours, the device must calculate the remaining time until the "Wake Up" time and enter Deep Sleep for that entire duration.
    *   No data transmission shall occur during Quiet Hours.

### 3.3 Sensor Management
- **SCD41 Integration:**
    *   Must use **Single-Shot Measurement** mode to minimize power consumption (avoids continuous internal periodic measurement).
    *   Support configurable "warmup" readings if necessary to stabilize the sensor before the final reading.
- **Data Validation:**
    *   Readings must be validated against reasonable ranges before transmission:
        *   CO2: 400 - 5000 ppm
        *   Temperature: -10°C to 50°C
        *   Humidity: 0% to 100%
- **Battery Monitoring:**
    *   Read analog value from A0.
    *   Convert to actual voltage using a configurable divider ratio.

### 3.4 Active Monitoring Mode (Warning Mode)
- **Condition:** If the measured CO2 level exceeds a configured `WARNING_THRESHOLD`.
- **Behavior:** The device should bypass standard deep sleep and remain active (or sleep for much shorter intervals) to report data more frequently until levels normalize.

## 4. Data Interface

### 4.1 Transport Protocol
- **Protocol:** MQTT (Message Queuing Telemetry Transport).
- **Security:** TLS/SSL encryption is preferred. The implementation should support certificate validation (or allow insecure mode for testing).
- **Authentication:** Username and Password authentication required.

### 4.2 Data Payload
Data shall be published as a JSON object containing the following keys:
- `timestamp`: Unix timestamp of the reading.
- `mac_address`: Unique device identifier (MAC).
- `temperature`: Air temperature in Celsius (float, 2 decimal precision).
- `humidity`: Relative humidity in % (float, 2 decimal precision).
- `co2`: CO2 concentration in ppm (integer).
- `voltage`: Battery voltage in Volts (float, 2 decimal precision).

**Example Payload:**
```json
{
  "timestamp": 1678886400,
  "mac_address": "A0:20:A6:12:34:56",
  "temperature": 24.5,
  "humidity": 45.2,
  "co2": 850,
  "voltage": 4.15
}
```

## 5. Configuration
All configurable parameters must be isolated (e.g., in a `config.h` file or environment variables) and not hardcoded in the logic. Required configuration parameters include:

- **Network:** WiFi SSID, WiFi Password.
- **MQTT:** Broker Host, Port, Username, Password, Topic.
- **Timing:**
    *   `READING_INTERVAL`: Time between standard readings (e.g., 300 seconds).
    *   `DEEP_SLEEP_DURATION`: Duration of sleep cycle.
- **Thresholds:**
    *   `WARNING_CO2_THRESHOLD`: Level at which to trigger Warning Mode.
- **Hardware:**
    *   `VOLTAGE_DIVIDER_RATIO`: Calibration factor for battery measurement.
- **Quiet Hours:**
    *   `QUIET_HOURS_ENABLED`: Boolean toggle.
    *   `GOTOSLEEP_TIME`: Hour/Minute to start quiet time.
    *   `WAKEUP_TIME`: Hour/Minute to end quiet time.
