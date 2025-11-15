# IoT Environmental Monitoring System

A complete IoT solution for monitoring temperature, humidity, and CO₂ levels using ESP32-based hardware with real-time visualization.

![System Overview](docs/system_overview.png)

## 📋 Table of Contents

- [Features](#features)
- [System Architecture](#system-architecture)
- [Hardware Requirements](#hardware-requirements)
- [Software Requirements](#software-requirements)
- [Installation Guide](#installation-guide)
- [Configuration](#configuration)
- [Usage](#usage)
- [API Documentation](#api-documentation)
- [Troubleshooting](#troubleshooting)
- [Data Analysis](#data-analysis)
- [Contributing](#contributing)

## ✨ Features

- **Real-time Monitoring**: Continuous tracking of environmental parameters
- **Dual Sensor System**: Redundant readings from SHT40 and SCD41 for accuracy
- **Visual Dashboard**: Beautiful web interface with live graphs
- **Cloud Data Logging**: MongoDB Atlas storage for historical analysis
- **Local Display**: ESP32 T-Display shows current readings
- **WiFi Connectivity**: Wireless data transmission to local server
- **Air Quality Alerts**: CO₂ level categorization (Good/Moderate/Poor)
- **Cloud Storage**: Historical data stored in MongoDB Atlas for analysis
- **ML Ready**: Data format optimized for machine learning

## 🏗️ System Architecture

```
┌─────────────────────────┐
│  LilyGo T-Display       │
│  + SHT40 Sensor         │
│  + SCD41 Sensor         │
└──────────┬──────────────┘
           │ WiFi
           ▼
┌─────────────────────────┐
│  Local Server (PC)      │
│  - Django REST API       │
│  - MongoDB Atlas Client │
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│  MongoDB Atlas Cluster  │
│  - Sensor Data Storage  │
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│  Web Dashboard          │
│  - Real-time Charts     │
│  - Statistics           │
│  - Data Download        │
└─────────────────────────┘
```

## 🔧 Hardware Requirements

### Required Components

| Component | Model | Quantity | Notes |
|-----------|-------|----------|-------|
| Microcontroller | LilyGo T-Display ESP32 | 1 | With built-in 1.14" TFT display |
| Temperature/Humidity | Sensirion SHT40 | 1 | I2C address: 0x44 |
| CO₂ Sensor | Sensirion SCD41 | 1 | I2C address: 0x62 |
| Breadboard | Standard | 1 | For prototyping |
| Jumper Wires | Male-to-Female | 8+ | Quality wires recommended |
| USB Cable | USB-C or Micro-USB | 1 | Depends on T-Display model |
| Power Supply | 5V/1A minimum | 1 | USB power adapter |

### Wiring Diagram

```
┌─────────────────────────┐
│   LilyGo T-Display      │
│                         │
│  3.3V ────┬────┬──────  │
│  GND  ────┼────┼──────  │
│  GPIO21───┼────┼────── (SDA) │
│  GPIO22───┼────┼────── (SCL) │
└───────────┼────┼────────┘
            │    │
    ┌───────┘    └────────┐
    │                     │
┌───┴────┐          ┌─────┴───┐
│ SHT40  │          │  SCD41  │
├────────┤          ├─────────┤
│ VCC ←──┘          │ VCC ←───┘
│ GND ←─────────────│ GND ←────
│ SDA ←─────────────│ SDA ←────
│ SCL ←─────────────│ SCL ←────
└────────┘          └─────────┘
```

### Pin Connections

| Sensor Pin | ESP32 Pin | Description |
|------------|-----------|-------------|
| SHT40 VCC | 3.3V | Power (NOT 5V!) |
| SHT40 GND | GND | Ground |
| SHT40 SDA | GPIO 21 | I2C Data |
| SHT40 SCL | GPIO 22 | I2C Clock |
| SCD41 VCC | 3.3V | Power (shared) |
| SCD41 GND | GND | Ground (shared) |
| SCD41 SDA | GPIO 21 | I2C Data (shared) |
| SCD41 SCL | GPIO 22 | I2C Clock (shared) |

⚠️ **IMPORTANT**: 
- Use **3.3V**, NOT 5V! ESP32 is 3.3V logic
- SCD41 can draw up to 200mA during measurement
- Both sensors share the same I2C bus (same SDA/SCL pins)
- Ensure good quality connections (consider soldering for permanent setup)

## 💻 Software Requirements

### For ESP32 Firmware

- [Arduino IDE](https://www.arduino.cc/en/software) v2.0+ or [PlatformIO](https://platformio.org/)
- ESP32 Board Support Package
- Required Arduino Libraries:
  - `Adafruit_SHT4x` (for SHT40 sensor)
  - `SparkFun SCD4x Arduino Library` (for SCD41 sensor)
  - `TFT_eSPI` (for T-Display screen)
  - `ArduinoJson` (for JSON formatting)
  - Built-in: `WiFi`, `HTTPClient`, `Wire`

### For Server

- Python 3.8 or higher
- pip (Python package manager)
- Required Python packages (see `server/requirements.txt`)

### For Dashboard

- Modern web browser (Chrome, Firefox, Edge, Safari)
- No additional installation needed!

## 📦 Installation Guide

### Step 1: Clone/Download Project

```bash
git clone <your-repo-url>
cd Cognitiv
```

Or download and extract the ZIP file.

### Step 2: Install Arduino IDE and Libraries

1. **Install Arduino IDE**: Download from [arduino.cc](https://www.arduino.cc/en/software)

2. **Add ESP32 Board Support**:
   - Open Arduino IDE
   - Go to `File → Preferences`
   - Add to "Additional Board Manager URLs":
     ```
     https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
     ```
   - Go to `Tools → Board → Boards Manager`
   - Search "ESP32" and install "esp32 by Espressif Systems"

3. **Install Required Libraries**:
   - Go to `Tools → Manage Libraries`
   - Install each library:
     - Search "Adafruit SHT4x" → Install
     - Search "SparkFun SCD4x" → Install
     - Search "TFT_eSPI" → Install
     - Search "ArduinoJson" → Install

4. **Configure TFT_eSPI for T-Display**:
   - Find TFT_eSPI library folder (usually in `Documents/Arduino/libraries/TFT_eSPI`)
   - Edit `User_Setup_Select.h`:
     - Comment out default setup
     - Uncomment: `#include <User_Setups/Setup25_TTGO_T_Display.h>`

### Step 3: Install Python Server Dependencies

```bash
cd server
pip install -r requirements.txt
```

This installs the Django server along with the MongoDB driver (`pymongo`).

### Step 4: Hardware Assembly

1. Connect sensors to ESP32 following the wiring diagram above
2. Double-check all connections (especially 3.3V vs GND!)
3. Verify I2C addresses using an I2C scanner sketch (optional but recommended)

## ⚙️ Configuration

### ESP32 Firmware Configuration

1. Open `firmware/environmental_monitor.ino` in Arduino IDE

2. Modify these lines at the top of the file:

```cpp
// WiFi Configuration
const char* WIFI_SSID = "YourNetworkName";
const char* WIFI_PASSWORD = "YourNetworkPassword";

// Server Configuration  
const char* SERVER_URL = "http://192.168.1.100:5000/data";  // Your PC's IP

// Device Identification
const char* DEVICE_ID = "livingroom_01";  // Unique name for this device

// Timezone (seconds from UTC)
const long GMT_OFFSET_SEC = 0;  // Example: -18000 for EST
const int DAYLIGHT_OFFSET_SEC = 0;

// Reading interval (milliseconds)
const unsigned long READING_INTERVAL = 60000;  // 60 seconds
```

3. **Find Your PC's IP Address**:
   - **Windows**: Open Command Prompt and run `ipconfig` → Look for "IPv4 Address"
   - **Mac**: System Preferences → Network → Your connection → IP Address
   - **Linux**: Run `ifconfig` or `ip addr`

4. Select board: `Tools → Board → ESP32 Arduino → ESP32 Dev Module` (or your specific T-Display variant)

5. Upload to ESP32: Click Upload button

### Server Configuration

The server uses environment variables for MongoDB connectivity. Set these before starting the server (or let the defaults kick in for quick testing):

- `MONGO_URI`: Full MongoDB connection string (`mongodb+srv://...`)
- `MONGO_DB_NAME`: Database name to use (default: `cognitiv`)
- `MONGO_COLLECTION`: Collection name to store sensor documents (default: `sensor_data`)

Example (PowerShell):

```powershell
$env:MONGO_URI="mongodb+srv://<user>:<password>@cluster.mongodb.net/"
$env:MONGO_DB_NAME="cognitiv"
$env:MONGO_COLLECTION="sensor_data"
python server.py
```

## 🚀 Usage

### Starting the System

1. **Start the Server**:
   ```bash
   cd server
   python server.py
   ```
   
   You should see:
   ```
   ============================================================
   IoT Environmental Monitoring Server
   ============================================================
   MongoDB Connection: mongodb+srv://...
   Database: cognitiv, Collection: sensor_data
   Server URL: http://0.0.0.0:5000
   Dashboard: http://localhost:5000
   ============================================================
   ```

2. **Power On ESP32**:
   - Connect USB cable
   - Device will:
     - Initialize sensors (~5 seconds)
     - Connect to WiFi (~5 seconds)
     - Display readings on screen
     - Send data to server every 60 seconds (or your configured interval)

3. **Open Dashboard**:
   - Open browser
   - Go to `http://localhost:5000` (on the server PC)
   - Or use PC's IP from other devices: `http://192.168.1.100:5000`

### Connect Page Flow (Manual Verification)

1. Keep the server running and ensure your board is connected to the PC via USB.
2. Open `http://localhost:5000/connect` in a browser.
3. Enter the WiFi network name (SSID) and optional password, then submit.
4. Wait for the on-page status banner to confirm the PlatformIO upload completed successfully; if it fails, review the log excerpt shown.
5. After a successful upload, power-cycle the board and verify it connects to the dashboard within a minute.

### Monitoring Serial Output

To see debug information from ESP32:
1. Open Arduino IDE
2. Go to `Tools → Serial Monitor`
3. Set baud rate to `115200`
4. You'll see connection status, sensor readings, and HTTP responses

### Understanding the Display

**ESP32 T-Display shows**:
- Temperature (average of both sensors)
- Humidity (average of both sensors)
- CO₂ level (color-coded: green <800, orange 800-1000, red >1000)
- WiFi status
- Server connection status

**Web Dashboard shows**:
- Current readings (large numbers)
- Min/Max/Average values
- Historical line graphs (temperature, humidity, CO₂)
- Air quality distribution
- Data point count

## 📡 API Documentation

### Endpoints

#### POST `/data`
Receive sensor data from ESP32.

**Request Body** (JSON):
```json
{
  "timestamp": 1699012345,
  "device_id": "livingroom_01",
  "temp_sht40": 22.5,
  "humidity_sht40": 45.2,
  "temp_scd41": 22.3,
  "humidity_scd41": 44.8,
  "co2": 650
}
```

**Response** (200 OK):
```json
{
  "status": "success",
  "message": "Data received and stored",
  "timestamp": "2024-11-03 10:30:00"
}
```

#### GET `/data`
Retrieve sensor data.

**Query Parameters**:
- `hours` (optional): Time range in hours (default: 24)
- `limit` (optional): Maximum data points (default: 1000)
- `device_id` (optional): Filter by device

**Example**: `/data?hours=6&limit=500`

**Response**:
```json
{
  "status": "success",
  "count": 360,
  "data": [
    {
      "timestamp": "2024-11-03 10:30:00",
      "device_id": "livingroom_01",
      "temp_sht40": 22.5,
      "humidity_sht40": 45.2,
      "temp_scd41": 22.3,
      "humidity_scd41": 44.8,
      "co2": 650,
      "temp_avg": 22.4,
      "humidity_avg": 45.0
    }
  ]
}
```

#### GET `/stats`
Get statistical summary.

**Query Parameters**:
- `hours` (optional): Time range (default: 24)

**Response**:
```json
{
  "status": "success",
  "stats": {
    "temperature": {
      "min": 20.5,
      "max": 24.3,
      "avg": 22.4,
      "current": 22.8
    },
    "humidity": {
      "min": 40.0,
      "max": 50.0,
      "avg": 45.2,
      "current": 46.1
    },
    "co2": {
      "min": 450,
      "max": 850,
      "avg": 620,
      "current": 650
    },
    "co2_quality": {
      "good": 340,
      "moderate": 15,
      "poor": 5,
      "good_percent": 94.4,
      "moderate_percent": 4.2,
      "poor_percent": 1.4
    },
    "data_points": 360,
    "time_range_hours": 24
  }
}
```

#### GET `/status`
Server health check.

**Response**:
```json
{
  "status": "online",
  "database": "cognitiv",
  "collection": "sensor_data",
  "data_points": 1500,
  "latest_entry": "2024-11-03 14:25:00",
  "server_time": "2024-11-03 14:30:00"
}
```

## 🔧 Troubleshooting

### ESP32 Issues

#### ❌ WiFi Connection Fails

**Symptoms**: ESP32 display shows "WiFi Failed!" or serial monitor shows connection timeouts

**Solutions**:
1. Double-check SSID and password (case-sensitive!)
2. Ensure ESP32 and PC are on same network (not guest network)
3. Check router's 2.4GHz is enabled (ESP32 doesn't support 5GHz)
4. Move ESP32 closer to router
5. Restart router if needed

**Test**:
```cpp
Serial.print("Connecting to: ");
Serial.println(WIFI_SSID);
Serial.print("Signal strength: ");
Serial.println(WiFi.RSSI());  // Should be > -70 dBm
```

#### ❌ Sensors Not Found

**Symptoms**: Serial monitor shows "Sensor initialization failed" or I2C scan finds no devices

**Solutions**:
1. **Check wiring**: Most common issue!
   - Verify all 8 connections
   - Ensure no loose wires
   - Check breadboard connections
2. **Verify voltage**: Must be 3.3V, not 5V
3. **Run I2C scanner**: The firmware includes automatic scanning
4. **Check I2C addresses**:
   - SHT40 should appear at 0x44
   - SCD41 should appear at 0x62

**I2C Scanner Output (Expected)**:
```
Scanning I2C bus...
I2C device found at address 0x44
I2C device found at address 0x62
Found 2 I2C device(s)
```

#### ❌ SCD41 Shows "No data available"

**Symptoms**: SHT40 works but SCD41 returns no readings

**Cause**: SCD41 needs 60-second warm-up period after power-on

**Solution**: Wait at least 60 seconds after powering on. First reading will take time.

#### ❌ HTTP POST Fails

**Symptoms**: "Failed to send data" in serial monitor, HTTP response code -1 or 404

**Solutions**:
1. **Check server is running**: Open `http://localhost:5000/status` in browser
2. **Verify PC IP**: Run `ipconfig` again (IP might change)
3. **Check firewall**: Windows Firewall might block port 5000
   - Control Panel → Windows Defender Firewall → Allow an app
   - Add Python to allowed apps
4. **Test manually**: Use browser to visit `http://YOUR_PC_IP:5000/status`

#### ❌ Display Shows Nothing

**Solutions**:
1. Check TFT_eSPI configuration (see Installation Step 2.4)
2. Verify T-Display variant matches code
3. Try rotating display: Change `tft.setRotation(1)` to `tft.setRotation(3)`

### Server Issues

#### ❌ Cannot Start Server

**Error**: `Address already in use`

**Solution**: Port 5000 is already used by another application
```bash
# Windows: Find process using port 5000
netstat -ano | findstr :5000
taskkill /PID <process_id> /F

# Or change port in server.py:
app.run(host='0.0.0.0', port=5001, debug=True)
```

#### ❌ Dashboard Shows "Server Offline"

**Solutions**:
1. Check server terminal for errors
2. Verify server is running: `http://localhost:5000/status`
3. Check CORS is enabled (should be by default)
4. Try different browser
5. Clear browser cache

#### ❌ MongoDB Connection Issues

**Symptoms**: Server logs show `MongoDB insert error` or `Failed to initialize MongoDB client`

**Solutions**:
1. Verify `MONGO_URI`, `MONGO_DB_NAME`, and `MONGO_COLLECTION` environment variables
2. Confirm your IP is allowed in the MongoDB Atlas network access list
3. Check Atlas cluster status (pause/resume if needed)
4. Test connectivity with the MongoDB shell:
   ```bash
   mongosh "your-mongo-uri"
   show dbs
   ```

### Data Quality Issues

#### ❌ Erratic CO₂ Readings

**Causes**:
- Sensor needs calibration
- Sensor needs more warm-up time
- Interference from breathing directly on sensor

**Solutions**:
1. Let sensor stabilize for 5-10 minutes
2. Perform fresh air calibration (see SCD41 datasheet)
3. Set altitude compensation if needed:
   ```cpp
   scd41.setSensorAltitude(100);  // meters above sea level
   ```

#### ❌ Temperature Difference Between Sensors

**Cause**: Normal! Sensors have slightly different calibration and placement

**Expected**: ±0.5°C difference is normal

**If difference >2°C**: Check for heat sources near one sensor (like ESP32 chip)

#### ❌ Readings Out of Range

**Validation ranges** (automatically checked):
- Temperature: -10°C to 50°C
- Humidity: 0% to 100%
- CO₂: 400 to 5000 ppm

**If out of range**: Data is rejected by server

### Network Issues

#### ❌ Cannot Access Dashboard from Other Devices

**Solutions**:
1. Use PC's IP address, not `localhost`
2. Ensure PC and device are on same network
3. Check PC firewall allows incoming connections on port 5000
4. Windows: Go to Settings → Network → Change connection properties → Set to "Private"

## 📊 Data Analysis

### Accessing Data from MongoDB

Use MongoDB tools (e.g., VS Code extension, MongoDB Compass, `mongosh`) to explore the `sensor_data` collection. For programmatic access you can load data straight into pandas:

```python
import os
from pymongo import MongoClient
import pandas as pd

client = MongoClient(os.environ["MONGO_URI"])
collection = client["cognitiv"]["sensor_data"]

cursor = collection.find({}, projection={"_id": 0, "raw_payload": 0})
df = pd.DataFrame(list(cursor))
df["timestamp"] = pd.to_datetime(df["timestamp"])

print(df.describe())
```

You can also export data for offline processing with `mongoexport`:

```bash
mongoexport \
  --uri="$MONGO_URI" \
  --collection=sensor_data \
  --type=json \
  --out=sensor_data.json
```

### Machine Learning Use Cases

1. **Predictive Maintenance**: Detect sensor drift or failures
2. **Occupancy Detection**: Identify when spaces are occupied based on CO₂ patterns
3. **Comfort Optimization**: Learn ideal temperature/humidity preferences
4. **Anomaly Detection**: Alert on unusual environmental conditions
5. **Energy Optimization**: Predict when HVAC adjustments are needed

## 🔐 Security Considerations

- This system is designed for **local network use only**
- Do not expose the server directly to the internet without authentication
- For remote access, use VPN or SSH tunnel
- Keep WiFi credentials in a separate config file (add to `.gitignore`)

## 🛠️ Advanced Configuration

### Multiple Devices

To monitor multiple rooms:

1. Flash same firmware to multiple ESP32s
2. Change `DEVICE_ID` for each device:
   ```cpp
   const char* DEVICE_ID = "bedroom_01";
   const char* DEVICE_ID = "kitchen_01";
   const char* DEVICE_ID = "office_01";
   ```
3. Dashboard will show all devices (use `device_id` filter in API)

### Custom Reading Intervals

```cpp
// Fast monitoring (every 30 seconds)
const unsigned long READING_INTERVAL = 30000;

// Slow monitoring (every 5 minutes)
const unsigned long READING_INTERVAL = 300000;
```

**Note**: SCD41 takes 5 seconds per reading, so minimum practical interval is ~10 seconds

### Database Integration

MongoDB Atlas is used by default. To connect additional tools (BI platforms, analytics notebooks), reuse the same `MONGO_URI` with your preferred MongoDB driver.

## 📝 Development Roadmap

- [ ] Mobile app (React Native)
- [ ] MQTT support for IoT integration
- [ ] Alert system (email/SMS notifications)
- [ ] Historical comparison (week over week)
- [ ] Weather API integration
- [ ] InfluxDB support for time-series data
- [ ] Grafana dashboard template
- [ ] Docker containerization
- [ ] Home Assistant integration

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is open source and available under the MIT License.

## 🙏 Acknowledgments

- Sensirion for excellent sensor documentation
- LilyGo for the T-Display board
- Adafruit and SparkFun for Arduino libraries
- Chart.js for beautiful visualizations

## 📞 Support

Having issues? Check:
1. This README's Troubleshooting section
2. Serial Monitor output from ESP32
3. Server console output
4. Open an issue on GitHub with:
   - Hardware setup description
   - Error messages
   - Serial Monitor output
   - Server logs

## 📚 Additional Resources

- [SHT40 Datasheet](https://www.sensirion.com/en/environmental-sensors/humidity-sensors/digital-humidity-sensor-sht4x/)
- [SCD41 Datasheet](https://www.sensirion.com/en/environmental-sensors/carbon-dioxide-sensors/carbon-dioxide-sensor-scd4x/)
- [ESP32 Arduino Core Documentation](https://docs.espressif.com/projects/arduino-esp32/en/latest/)
- [Django Documentation](https://docs.djangoproject.com/)
- [Chart.js Documentation](https://www.chartjs.org/docs/latest/)

---

**Built with ❤️ for environmental monitoring**
