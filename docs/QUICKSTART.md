# Quick Start Guide - IoT Environmental Monitoring System

## 🚀 Get Running in 15 Minutes

This guide will get your system up and running as quickly as possible.

### Prerequisites Checklist

- [ ] LilyGo T-Display ESP32 board
- [ ] SHT40 sensor
- [ ] SCD41 sensor
- [ ] 8 jumper wires
- [ ] USB cable
- [ ] PC with Python 3.8+ installed
- [ ] WiFi network credentials

---

## Step 1: Hardware Assembly (5 minutes)

### Connect the Sensors

**Connect Both Sensors to ESP32:**

```
ESP32 3.3V  ──┬──→ SHT40 VCC
              └──→ SCD41 VCC

ESP32 GND   ──┬──→ SHT40 GND
              └──→ SCD41 GND

ESP32 GPIO21 ─┬──→ SHT40 SDA (I2C Data)
              └──→ SCD41 SDA

ESP32 GPIO22 ─┬──→ SHT40 SCL (I2C Clock)
              └──→ SCD41 SCL
```

⚠️ **CRITICAL**: Use 3.3V, NOT 5V! This will damage your ESP32.

### Visual Check
- All 8 connections secure
- No crossed wires
- Sensors powered (may have indicator LEDs)

---

## Step 2: Install Arduino Software (3 minutes)

### A. Install Arduino IDE

1. Download from: https://www.arduino.cc/en/software
2. Install and open Arduino IDE

### B. Add ESP32 Support

1. Go to **File → Preferences**
2. In "Additional Board Manager URLs", add:
   ```
   https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
   ```
3. Click OK
4. Go to **Tools → Board → Boards Manager**
5. Search "ESP32" and click **Install** on "esp32 by Espressif Systems"

### C. Install Libraries

Go to **Tools → Manage Libraries** and install:

1. `Adafruit SHT4x` by Adafruit
2. `SparkFun SCD4x Arduino Library` by SparkFun
3. `TFT_eSPI` by Bodmer
4. `ArduinoJson` by Benoit Blanchon

---

## Step 3: Configure and Upload Firmware (4 minutes)

### A. Find Your PC's IP Address

**Windows:**
```powershell
ipconfig
```
Look for "IPv4 Address" (e.g., 192.168.1.100)

**Mac/Linux:**
```bash
ifconfig
```
Look for "inet" address

### B. Edit Firmware Configuration

1. Open `firmware/environmental_monitor.ino` in Arduino IDE
2. Change these lines (around line 18):

```cpp
const char* WIFI_SSID = "YourWiFiName";          // Your WiFi name
const char* WIFI_PASSWORD = "YourWiFiPassword";   // Your WiFi password
const char* SERVER_URL = "http://192.168.1.100:5000/data";  // Your PC's IP
const char* DEVICE_ID = "livingroom_01";          // Any name you like
```

### C. Upload to ESP32

1. Connect ESP32 via USB
2. Select **Tools → Board → ESP32 Arduino → ESP32 Dev Module**
3. Select **Tools → Port** → (Your ESP32's port)
4. Click **Upload** button (→)
5. Wait for "Done uploading" message

---

## Step 4: Start the Server (2 minutes)

### A. Install Python Dependencies

Open PowerShell in the project folder:

```powershell
cd server
pip install -r requirements.txt
```

### B. Start the Server

```powershell
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

⚠️ **Keep this window open!** The server must run continuously.

---

## Step 5: View Your Dashboard (1 minute)

1. Open your web browser
2. Go to: **http://localhost:5000**
3. You should see the dashboard loading

**Wait 60 seconds** for the first data point to arrive!

---

## 🎉 Success Checklist

- [ ] ESP32 display shows temperature, humidity, and CO2
- [ ] ESP32 display shows "WiFi: OK" and "Server: OK"
- [ ] Web dashboard shows live readings
- [ ] Graphs are populating with data
- [ ] Server console shows "Data received" messages

---

## 🔧 Quick Troubleshooting

### ESP32 shows "WiFi Failed"
- Check WiFi name and password (case-sensitive!)
- Make sure you're using 2.4GHz WiFi (ESP32 doesn't support 5GHz)
- Move ESP32 closer to router

### ESP32 shows "Sensor Error"
- Check all 8 wire connections
- Verify you're using 3.3V, not 5V
- Open **Tools → Serial Monitor** (set to 115200 baud) to see detailed errors

### "Server: ERR" on ESP32 Display
- Check your PC's IP address hasn't changed
- Make sure server is running (check PowerShell window)
- Try accessing http://localhost:5000/status in your browser

### Dashboard shows "No data available"
- Wait at least 60 seconds for first reading
- Check server console for error messages
- Verify ESP32 shows "Server: OK"

### Can't access dashboard from phone/tablet
- Use your PC's IP instead of localhost: `http://192.168.1.100:5000`
- Make sure phone and PC are on same WiFi network

---

## 📊 What to Do Next

### Monitor Your Environment
- Check CO2 levels (Good: <800, Moderate: 800-1000, Poor: >1000 ppm)
- Track temperature and humidity patterns
- Download CSV data for analysis

### Experiment with Settings

**Change reading interval** (in firmware):
```cpp
const unsigned long READING_INTERVAL = 30000;  // 30 seconds instead of 60
```

**View different time ranges** (in dashboard):
- Use dropdown: 1 Hour, 6 Hours, 24 Hours, 7 Days, 30 Days

### Analyze Your Data

After collecting data for a day or more:

```powershell
cd analysis
pip install -r requirements.txt
mongoexport --uri "$env:MONGO_URI" --collection sensor_data \
  --type=csv --fields timestamp_str,device_id,temperature,humidity,co2 \
  --out sensor_data.csv
python data_quality.py ../sensor_data.csv
python visualize.py ../sensor_data.csv
```

---

## 💡 Understanding Your Readings

### Temperature
- **Comfortable**: 20-24°C (68-75°F)
- **Too Cold**: <18°C (64°F)
- **Too Hot**: >26°C (79°F)

### Humidity
- **Comfortable**: 30-60%
- **Too Dry**: <30% (can cause dry skin, static)
- **Too Humid**: >60% (can cause mold, discomfort)

### CO₂ Levels
- **Good**: <800 ppm (well ventilated)
- **Moderate**: 800-1000 ppm (acceptable)
- **Poor**: >1000 ppm (needs ventilation!)
- **Very Poor**: >1500 ppm (open windows immediately)

### What Affects CO₂?
- **Number of people** in room
- **Ventilation** (open/closed windows)
- **HVAC** system operation
- **Room size**

**Tip**: CO₂ spikes when people enter a room, drops when they leave or windows open!

---

## 🔒 Safety Notes

- System is for monitoring only, not life-safety purposes
- High CO₂ (>5000 ppm) can be dangerous - ventilate immediately
- If sensors show unusual readings, verify with other sources
- Keep electrical connections away from water

---

## 📞 Need Help?

1. Check the full **README.md** for detailed troubleshooting
2. Open **Tools → Serial Monitor** in Arduino IDE to see debug messages
3. Check server console for error messages
4. Review wiring diagram carefully

---

## 🎯 Next Level Features

Once your system is running smoothly:

- **Add more devices**: Monitor multiple rooms (change DEVICE_ID for each)
- **Set up alerts**: Modify server.py to send notifications when CO₂ is high
- **Machine learning**: Use `analysis/prepare_ml.py` to prepare data for ML
- **Long-term storage**: Switch from CSV to database (SQLite, PostgreSQL)
- **Mobile access**: Access dashboard from anywhere using port forwarding/VPN

---

**Enjoy your environmental monitoring system! 🌡️💧☁️**
