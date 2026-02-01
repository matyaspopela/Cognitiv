# 2. Hardware & Firmware

This document covers the physical devices used in Cognitiv and the firmware running on them.

## 🛠️ Hardware Specifications

### Components
| Component | Model | Purpose | Connection |
| :--- | :--- | :--- | :--- |
| **Microcontroller** | ESP8266 (ESP-12F/S) | Main processor & WiFi | N/A |
| **Carrier Board** | LaskaKit AirBoard 8266 | Power regulation & breakout | N/A |
| **Sensor** | Sensirion SCD41 | CO2, Temperature, Humidity | I2C (0x62) |
| **Display** (Optional) | SSD1306 0.96" OLED | Local data visualization | I2C (0x3C) |
| **LED** | 5mm Red LED | High CO2 Warning | GPIO4 (D2) |

### Wiring (LaskaKit AirBoard)
The LaskaKit AirBoard uses **μSup** connectors (JST-SH 1.0mm) for I2C, eliminating most soldering.

-   **I2C SDA:** GPIO 0 (D3)
-   **I2C SCL:** GPIO 2 (D4)
-   **LED Pin:** GPIO 4 (D2) - *Note: Active LOW logic is used in code, but verify board schematic.*
-   **Wake Pin:** GPIO 16 (D0) connected to RST (Required for Deep Sleep).

## 💾 Firmware (PlatformIO)

The firmware is written in C++ using the Arduino framework, managed by **PlatformIO**.

### Project Structure
```text
src/
├── main.cpp       # Main application logic
include/
├── config.h       # Configuration macros (WiFi, MQTT)
platformio.ini     # Build environments and library dependencies
```

### Key Libraries
-   `SparkFun SCD4x Arduino Library`: Sensor driver.
-   `PubSubClient`: MQTT communication.
-   `ArduinoJson`: JSON serialization.
-   `Adafruit SSD1306` / `GFX`: Display drivers.

### Configuration (`platformio.ini`)
Credentials are injected at build time using environment variables to keep secrets out of git.

```ini
[env:esp12e]
build_flags = 
    '-D WIFI_SSID="${sysenv.WIFI_SSID}"'
    '-D WIFI_PASSWORD="${sysenv.WIFI_PASSWORD}"'
    '-D MQTT_BROKER_HOST="${sysenv.MQTT_BROKER_HOST}"'
    ...
```

### Features

#### 1. Sensor Polling
-   **Interval:** Defines how often data is read (Default: `30000ms` / 30s).
-   **Validation:** Readings are checked against valid ranges (CO2: 400-5000ppm) before sending.

#### 2. MQTT Communication
-   **Protocol:** MQTT v3.1.1 over TLS (Port 8883).
-   **Topic:** Configurable via `MQTT_TOPIC`.
-   **Payload Format:**
    ```json
    {
      "timestamp": 1706691200,
      "device_id": "ESP8266_A020A6...",
      "mac_address": "A0:20:A6:...",
      "co2": 850,
      "temperature": 22.4,
      "humidity": 45.1,
      "voltage": 4.15
    }
    ```

#### 3. Quiet Hours (Deep Sleep)
To conserve power (if battery operated) and reduce light pollution in schools at night.
-   **Mechanism:** Checks NTP time against scheduled hours (e.g., 22:00 - 06:00).
-   **Action:** If in quiet hours, calculates time remaining until wakeup and enters `ESP.deepSleep()`.
-   **Requirement:** GPIO16 must be wired to RST.

#### 4. Visual Warnings
-   **OLED:** Displays current values. Inverts colors or shows specific warning screen if CO2 > Threshold.
-   **LED:** Blinks using a hardware timer (`Ticker`) if CO2 > 1500ppm.

## ⚡ Flashing Guide

1.  **Install PlatformIO:** Extension for VS Code.
2.  **Set Environment Variables:**
    ```bash
    # Windows
    set WIFI_SSID="School_WiFi"
    set WIFI_PASSWORD="secret_password"
    # ... set other MQTT variables
    ```
3.  **Connect Device:** Via USB.
4.  **Upload:**
    ```bash
    pio run --target upload
    ```
5.  **Monitor:**
    ```bash
    pio device monitor
    ```
