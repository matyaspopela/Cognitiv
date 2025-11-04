# ESP12S + LaskaKit μSup Connectors Setup Guide

## 🎯 Your Configuration

You have:
- **ESP12S** (ESP8266-based module)
- **LaskaKit μSup I2C connectors** (plug-and-play!)
- **SHT40 and SCD41 sensors** with μSup connectors

**Good news**: The μSup connectors make this super easy - no manual wiring needed! ✅

---

## 📌 Pin Configuration for ESP12S

The firmware is now configured for ESP12S:

```cpp
#define BOARD_ESP12S       // ✅ Already set in firmware
#define I2C_SDA 4          // GPIO 4 (D2 on ESP12S)
#define I2C_SCL 5          // GPIO 5 (D1 on ESP12S)
```

### ESP12S I2C Pins
- **SDA**: GPIO 4 (labeled D2 on most boards)
- **SCL**: GPIO 5 (labeled D1 on most boards)

---

## 🔌 Hardware Connection with μSup

### What is μSup?
LaskaKit's μSup is a **standardized I2C connector system** that makes connections foolproof:
- 4-pin JST-SH connectors
- Includes: VCC, GND, SDA, SCL
- Daisy-chainable (multiple sensors on one bus)
- No manual wiring required!

### Connection Steps

1. **Connect Sensors to μSup Hub/Board**
   ```
   ESP12S Board (with μSup port)
        │
        ├── μSup Port 1 → SHT40 (via μSup cable)
        │
        └── μSup Port 2 → SCD41 (via μSup cable)
   ```
   
   OR if you have a μSup hub:
   ```
   ESP12S → μSup Hub → SHT40
                     └→ SCD41
   ```

2. **Power the ESP12S**
   - USB power (5V) or
   - External 3.3V power source

3. **That's it!** The μSup connectors handle all the I2C connections automatically.

---

## 💻 Arduino IDE Setup for ESP12S

### 1. Install ESP8266 Board Support

**In Arduino IDE:**
1. Go to `File → Preferences`
2. Add to "Additional Board Manager URLs":
   ```
   http://arduino.esp8266.com/stable/package_esp8266com_index.json
   ```
3. Go to `Tools → Board → Boards Manager`
4. Search "ESP8266" and install **"esp8266 by ESP8266 Community"**

### 2. Select Board

`Tools → Board → ESP8266 Boards → Generic ESP8266 Module`

**Or if you have a specific ESP12S board:**
- NodeMCU 1.0 (if it's on a NodeMCU board)
- WeMos D1 R1 (if it's on a WeMos board)

### 3. Configure Board Settings

```
Tools → Board: Generic ESP8266 Module (or your specific board)
Tools → Flash Size: 4MB (FS:2MB OTA:~1019KB)
Tools → CPU Frequency: 80 MHz
Tools → Upload Speed: 115200
Tools → Port: (Select your COM port)
```

### 4. Install Required Libraries

Go to `Tools → Manage Libraries` and install:

**Required:**
- ✅ `Adafruit SHT4x` by Adafruit
- ✅ `SparkFun SCD4x Arduino Library` by SparkFun Electronics
- ✅ `ArduinoJson` by Benoit Blanchon

**Built-in (no install needed):**
- ESP8266WiFi
- ESP8266HTTPClient
- Wire

**NOT needed for ESP12S:**
- ❌ TFT_eSPI (no display on ESP12S)

---

## ⚙️ Firmware Configuration

The firmware is already updated for ESP12S! Just configure your settings:

### Open `firmware/environmental_monitor.ino`

**Line 23: Verify this is uncommented:**
```cpp
#define BOARD_ESP12S       // ✅ Keep this uncommented
// #define BOARD_ESP32      // ❌ Keep this commented out
```

**Lines 49-52: Configure WiFi:**
```cpp
const char* WIFI_SSID = "YourWiFiName";        // Your 2.4GHz WiFi
const char* WIFI_PASSWORD = "YourPassword";     // Your WiFi password
const char* SERVER_URL = "http://192.168.1.100:5000/data";  // Your PC's IP
const char* DEVICE_ID = "esp12s_01";           // Unique name
```

### Find Your PC's IP Address

**Windows:**
```powershell
ipconfig
```
Look for "IPv4 Address" under your active network adapter (e.g., 192.168.1.100)

**Important**: Replace `192.168.1.100` in `SERVER_URL` with YOUR actual IP!

---

## 📤 Upload Firmware

1. **Connect ESP12S via USB**
2. **Select correct COM port**: `Tools → Port → COM#`
3. **Click Upload** (→ button)
4. **Wait for "Done uploading"**

### Troubleshooting Upload

**If upload fails:**
- Hold the **FLASH/BOOT button** during upload
- Try different baud rate: `Tools → Upload Speed → 57600`
- Install CH340 or CP210x USB drivers (Google for your specific board)

---

## 🖥️ Start the Server

**On your PC:**

```powershell
cd server
pip install -r requirements.txt
python server.py
```

You should see:
```
============================================================
IoT Environmental Monitoring Server
============================================================
Server URL: http://0.0.0.0:5000
Dashboard: http://localhost:5000
============================================================
```

---

## 🔍 Verify It's Working

### 1. Open Serial Monitor

In Arduino IDE:
- `Tools → Serial Monitor`
- Set baud rate to `115200`

**You should see:**
```
=================================
Environmental Monitoring System
=================================

I2C initialized on SDA=GPIO4, SCL=GPIO5

Scanning I2C bus...
I2C device found at address 0x44  ← SHT40
I2C device found at address 0x62  ← SCD41
Found 2 I2C device(s)

Initializing sensors...
SHT40: ✓ OK
SCD41: ✓ OK
SCD41: Periodic measurement started

Connecting to WiFi: YourWiFiName
..........
✓ WiFi connected!
IP address: 192.168.x.x
Signal strength: -45 dBm

--- New Reading ---
SHT40 - Temp: 22.50°C, Humidity: 45.20%
SCD41 - CO2: 650 ppm, Temp: 22.30°C, Humidity: 44.80%
Sending to server: {"timestamp":...}
HTTP Response code: 200
✓ Data sent successfully
```

### 2. Check Dashboard

Open browser: `http://localhost:5000`

Wait 60 seconds for first data point, then you'll see:
- ✅ Current readings
- ✅ Live graphs
- ✅ Statistics

---

## 🆚 Key Differences from ESP32 Version

| Feature | ESP32 (T-Display) | ESP12S (Your Setup) |
|---------|-------------------|---------------------|
| **I2C Pins** | GPIO 21, 22 | GPIO 4, 5 |
| **Display** | Built-in TFT | None (Serial Monitor + Web Dashboard) |
| **WiFi Library** | WiFi.h | ESP8266WiFi.h |
| **HTTP Client** | HTTPClient.h | ESP8266HTTPClient.h |
| **Connectors** | Manual wiring | μSup plug-and-play ✅ |
| **Monitoring** | ESP32 screen + Web | Serial Monitor + Web |

---

## 🐛 Troubleshooting

### ❌ No I2C Devices Found

**Check:**
1. μSup cables are fully inserted (should click)
2. Sensors have power (check for LEDs if present)
3. Correct I2C pins in firmware (GPIO 4, 5)
4. Try one sensor at a time to isolate issue

**Test:**
```cpp
// The firmware automatically scans I2C bus
// Check Serial Monitor at 115200 baud
```

### ❌ WiFi Won't Connect

**ESP8266 only supports 2.4GHz WiFi!**

1. Make sure router has 2.4GHz enabled (not just 5GHz)
2. Move closer to router
3. Check SSID and password (case-sensitive!)
4. Some routers have separate 2.4GHz and 5GHz SSIDs - use the 2.4GHz one

### ❌ HTTP POST Fails (-1 or 404 error)

1. **Verify PC IP hasn't changed**:
   ```powershell
   ipconfig
   ```
   
2. **Check server is running**:
   - Look for PowerShell window with server
   - Test in browser: `http://localhost:5000/status`

3. **Check Windows Firewall**:
   - Control Panel → Windows Defender Firewall → Allow an app
   - Add Python to allowed apps

### ❌ SCD41 Shows No Data

**Normal!** SCD41 needs 60-second warm-up after power-on.

Wait at least 60 seconds, then readings will appear.

### ❌ Compilation Errors

**If you see errors about TFT_eSPI:**

Make sure you have this uncommented:
```cpp
#define BOARD_ESP12S  // Line 23 in firmware
```

This disables display code automatically.

---

## 📊 What You'll See

### Serial Monitor Output (Every 60 seconds)
```
--- New Reading ---
SHT40 - Temp: 22.50°C, Humidity: 45.20%
SCD41 - CO2: 650 ppm, Temp: 22.30°C, Humidity: 44.80%
✓ Data sent successfully
```

### Web Dashboard
- Large current readings
- Min/Max/Average stats
- Time-series graphs
- Air quality classification

---

## 🎯 Advantages of Your Setup

✅ **μSup Connectors**: No wiring errors possible!  
✅ **Daisy-Chain**: Can add more I2C sensors easily  
✅ **Hot-Swap**: Can disconnect/reconnect sensors  
✅ **Compact**: Clean, professional appearance  
✅ **Reliable**: Standardized connections  

---

## 🔧 Optional Customizations

### Change Reading Interval

**In firmware (line 58):**
```cpp
const unsigned long READING_INTERVAL = 30000;  // 30 seconds
// const unsigned long READING_INTERVAL = 60000;  // 60 seconds (default)
// const unsigned long READING_INTERVAL = 300000; // 5 minutes
```

### Add More Sensors

With μSup, you can easily add more I2C sensors:
- Another SHT40 (different address)
- BMP280 (pressure sensor)
- OLED display
- BME680 (air quality)

Just daisy-chain them to the μSup bus!

### Set Timezone

**In firmware (line 54):**
```cpp
const long GMT_OFFSET_SEC = -18000;  // EST (-5 hours)
// const long GMT_OFFSET_SEC = 3600;    // CET (+1 hour)
// const long GMT_OFFSET_SEC = 0;       // UTC
```

---

## 📝 Quick Reference

### I2C Addresses
- **SHT40**: 0x44 (fixed)
- **SCD41**: 0x62 (fixed)

### ESP12S Pins
- **SDA**: GPIO 4 (D2)
- **SCL**: GPIO 5 (D1)
- **Power**: 3.3V (from board regulator)

### Data Format
Sent to server every 60 seconds as JSON:
```json
{
  "timestamp": 1699012345,
  "device_id": "esp12s_01",
  "temp_sht40": 22.50,
  "humidity_sht40": 45.20,
  "temp_scd41": 22.30,
  "humidity_scd41": 44.80,
  "co2": 650
}
```

---

## 🚀 You're All Set!

Your ESP12S with μSup connectors is perfectly configured for environmental monitoring!

**Advantages of your setup:**
- ✅ No messy breadboard wiring
- ✅ Professional μSup connectors
- ✅ Easy to add more sensors
- ✅ Reliable I2C communication
- ✅ Clean installation

**Next Steps:**
1. Upload the updated firmware
2. Start the server
3. Open the dashboard
4. Enjoy monitoring! 🌡️💧☁️

---

**Questions?** Check `docs/TROUBLESHOOTING.md` for detailed solutions!
