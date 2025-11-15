# Common Issues and Solutions

## Table of Contents
1. [Hardware Issues](#hardware-issues)
2. [Firmware Issues](#firmware-issues)
3. [Server Issues](#server-issues)
4. [Dashboard Issues](#dashboard-issues)
5. [Data Quality Issues](#data-quality-issues)
6. [Network Issues](#network-issues)

---

## Hardware Issues

### ❌ No I2C Devices Found

**Symptoms**: Serial monitor shows "No I2C devices found!"

**Possible Causes**:
- Incorrect wiring
- Loose connections
- Wrong voltage (5V instead of 3.3V)
- Defective sensor

**Solutions**:

1. **Verify wiring step by step**:
   ```
   SHT40 VCC → ESP32 3.3V  ✓
   SHT40 GND → ESP32 GND   ✓
   SHT40 SDA → ESP32 GPIO21 ✓
   SHT40 SCL → ESP32 GPIO22 ✓
   SCD41 VCC → ESP32 3.3V  ✓
   SCD41 GND → ESP32 GND   ✓
   SCD41 SDA → ESP32 GPIO21 ✓
   SCD41 SCL → ESP32 GPIO22 ✓
   ```

2. **Test each connection**:
   - Gently wiggle wires
   - Push breadboard connections firmly
   - Check for bent pins

3. **Verify voltage**:
   - Use multimeter to check 3.3V at sensor VCC
   - Should read 3.2-3.4V

4. **Try one sensor at a time**:
   - Disconnect SCD41
   - Run I2C scanner
   - Should find SHT40 at 0x44
   - Reconnect SCD41 and test again

### ❌ SCD41 Not Responding

**Symptoms**: SHT40 works, but SCD41 shows no data

**Causes**:
- SCD41 needs longer warm-up time
- Insufficient power
- Bad connection

**Solutions**:

1. **Wait longer**: SCD41 needs 60 seconds minimum after power-on
2. **Check power supply**: SCD41 draws up to 200mA
   - Use powered USB hub if needed
   - Check USB cable quality
3. **Verify I2C address**: Should be 0x62
4. **Try hardware reset**: Disconnect power for 10 seconds

### ❌ Display Not Working

**Symptoms**: Sensors work but T-Display shows nothing

**Solutions**:

1. **Check TFT_eSPI configuration**:
   - Find library folder: `Documents/Arduino/libraries/TFT_eSPI`
   - Edit `User_Setup_Select.h`
   - Uncomment: `#include <User_Setups/Setup25_TTGO_T_Display.h>`
   
2. **Try different rotation**:
   ```cpp
   tft.setRotation(1);  // Try 0, 1, 2, or 3
   ```

3. **Verify T-Display model**: Different models have different pin configurations

---

## Firmware Issues

### ❌ Won't Compile

**Error**: `'WiFi.h' file not found` or similar

**Solutions**:
1. Install ESP32 board support (see QUICKSTART.md)
2. Restart Arduino IDE after installing boards
3. Verify board selection: Tools → Board → ESP32 Dev Module

**Error**: `'Adafruit_SHT4x' does not name a type`

**Solutions**:
1. Install missing library: Tools → Manage Libraries
2. Restart Arduino IDE after installing libraries

### ❌ Upload Failed

**Error**: `Failed to connect to ESP32: Timed out waiting for packet header`

**Solutions**:
1. Hold BOOT button on ESP32 while clicking Upload
2. Try different USB cable (data cable, not charge-only)
3. Try different USB port
4. Check COM port: Tools → Port
5. Install CP210x or CH340 USB driver (search online for your specific board)

### ❌ WiFi Connection Timeout

**Serial Monitor Output**:
```
Connecting to WiFi: MyNetwork
....................
✗ WiFi connection failed!
```

**Solutions**:

1. **Verify credentials**:
   ```cpp
   const char* WIFI_SSID = "ExactNetworkName";  // Case-sensitive!
   const char* WIFI_PASSWORD = "ExactPassword123";  // Case-sensitive!
   ```

2. **Check WiFi band**: ESP32 only supports 2.4GHz
   - Check router settings
   - Enable 2.4GHz if disabled
   - Some routers have separate 2.4GHz/5GHz networks

3. **Check WiFi signal**:
   ```cpp
   Serial.print("Signal strength: ");
   Serial.print(WiFi.RSSI());
   Serial.println(" dBm");
   ```
   - Should be > -70 dBm
   - Move ESP32 closer to router

4. **Router issues**:
   - Restart router
   - Check MAC filtering is disabled
   - Check if too many devices connected

### ❌ HTTP POST Fails

**Serial Monitor Output**:
```
Sending to server: {...}
HTTP Response code: -1
✗ Failed to send data
```

**Response code meanings**:
- `-1`: Cannot connect to server
- `400`: Bad request (data format error)
- `404`: Server not found
- `500`: Server error

**Solutions**:

1. **Verify server URL**:
   ```cpp
   const char* SERVER_URL = "http://192.168.1.100:5000/data";
   //                        ^^^^                     ^^^^
   //                        Must be http           Must be /data
   ```

2. **Check PC IP address** (might have changed):
   ```powershell
   ipconfig
   ```

3. **Test server manually**:
   - Open browser on same network
   - Go to `http://YOUR_PC_IP:5000/status`
   - Should see server status JSON

4. **Check firewall** (see Network Issues section)

---

## Server Issues

### ❌ Cannot Start Server

**Error**: `Address already in use`

**Cause**: Port 5000 is already used by another application

**Solutions**:

**Windows**:
```powershell
# Find what's using port 5000
netstat -ano | findstr :5000

# Kill the process (replace PID with actual process ID)
taskkill /PID 12345 /F
```

**Or change port** in `server.py`:
```python
app.run(host='0.0.0.0', port=5001, debug=True)  # Use 5001 instead
```

Then update ESP32 firmware:
```cpp
const char* SERVER_URL = "http://192.168.1.100:5001/data";  // Note 5001
```

### ❌ ModuleNotFoundError: No module named 'django'

**Solutions**:
```powershell
# Install dependencies
cd server
pip install -r requirements.txt

# If still failing, try:
python -m pip install django django-cors-headers

# Verify installation
python -c "import django; print(django.__version__)"
```

### ❌ MongoDB Authentication Error

**Error**: `pymongo.errors.OperationFailure: Authentication failed`

**Cause**: Invalid username/password or IP not allowed in Atlas.

**Solutions**:
1. Verify the credentials embedded in `MONGO_URI`
2. In MongoDB Atlas, ensure your current IP is in the Network Access allowlist
3. Reset Atlas user password if needed and update `MONGO_URI`
4. Retest with `mongosh "your-mongo-uri"`

### ❌ Data Not Being Saved

**Symptoms**: Server receives data but MongoDB collection remains empty

**Debug Steps**:

1. **Check server console output**:
   ```
   ✓ Data saved to MongoDB at 2024-11-03 10:30:00  ← Should see this
   ```

2. **Verify connection string**:
   ```powershell
   echo $env:MONGO_URI
   ```
   Ensure it matches your Atlas cluster.

3. **Check Atlas collection**:
   ```bash
   mongosh "your-mongo-uri"
   use cognitiv
   db.sensor_data.findOne()
   ```

4. **Monitor Atlas metrics**: Open Atlas dashboard → Metrics → Connections to confirm inserts

---

## Dashboard Issues

### ❌ Dashboard Shows "Server Offline"

**Symptoms**: Dashboard loads but shows red "Server Offline" indicator

**Solutions**:

1. **Check server is running**:
   - Look for PowerShell window with server
   - Should show "Running on http://0.0.0.0:5000"

2. **Test server directly**:
   ```
   http://localhost:5000/status
   ```
   Should return JSON with server status

3. **Check browser console** (F12):
   - Look for CORS errors
   - Look for network errors

4. **Clear browser cache**:
   - Press Ctrl+Shift+Delete
   - Clear cache and cookies
   - Refresh page (Ctrl+F5)

### ❌ Charts Not Displaying

**Symptoms**: Dashboard loads but charts are empty/broken

**Solutions**:

1. **Wait for data**: Need at least one data point (60 seconds)

2. **Check browser console** (F12):
   - Look for JavaScript errors
   - Look for Chart.js load errors

3. **Verify Chart.js loads**:
   ```html
   <!-- Should see this in dashboard.html -->
   <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0"></script>
   ```

4. **Check internet connection**: Dashboard needs to download Chart.js from CDN

### ❌ Dashboard Shows Old Data

**Symptoms**: Dashboard doesn't update with new readings

**Solutions**:

1. **Check auto-refresh**: Dashboard refreshes every 30 seconds
2. **Manual refresh**: Click 🔄 Refresh button
3. **Hard refresh**: Press Ctrl+F5 to clear cache
4. **Check time range**: Make sure you're viewing correct time range (dropdown)

---

## Data Quality Issues

### ❌ CO₂ Readings Stuck at 400 ppm

**Cause**: SCD41 not fully initialized or not receiving commands

**Solutions**:

1. **Wait longer**: First reading takes ~60 seconds
2. **Check serial monitor**: Should see "Periodic measurement started"
3. **Power cycle**: Disconnect USB for 10 seconds
4. **Verify firmware**:
   ```cpp
   scd41.startPeriodicMeasurement();  // Make sure this is called
   ```

### ❌ CO₂ Readings Seem Inaccurate

**Symptoms**: CO₂ shows unusual values (e.g., 5000 ppm in normal room)

**Solutions**:

1. **Perform calibration**: Place sensor in fresh outdoor air (400 ppm)
   ```cpp
   // Add to setup() after sensor init:
   scd41.performForcedRecalibration(400);
   delay(500);
   ```

2. **Set altitude compensation** (if above sea level):
   ```cpp
   scd41.setSensorAltitude(100);  // meters above sea level
   ```

3. **Check for interference**:
   - Don't breathe directly on sensor
   - Keep away from air vents
   - Allow 5-10 minutes for stabilization

4. **Verify reading is valid**:
   - Indoor CO₂ typically: 400-2000 ppm
   - Outdoor: ~400 ppm
   - Crowded room: 1000-2000 ppm
   - >3000 ppm: likely sensor error

### ❌ Large Temperature Difference Between Sensors

**Symptoms**: SHT40 shows 23°C, SCD41 shows 26°C

**If difference >2°C**:

1. **Check sensor placement**: One might be near heat source
2. **Check ESP32 heating**: ESP32 generates heat, affects nearby sensor
3. **Wait for thermal equilibrium**: Give sensors 10+ minutes
4. **Verify in Serial Monitor**: Check both raw readings
5. **Consider recalibration**: Sensors may need factory calibration

**Normal difference**: ±0.5°C is expected and OK

### ❌ Erratic/Jumping Readings

**Symptoms**: Values change drastically between readings

**Solutions**:

1. **Check connections**: Loose wire causes intermittent readings
2. **Add capacitors**: 0.1µF near sensor power pins reduces noise
3. **Check power supply**: Use quality USB cable and power source
4. **Add averaging**: Modify firmware to average multiple readings
   ```cpp
   // Average last 3 readings
   float temp_avg = (reading1 + reading2 + reading3) / 3.0;
   ```

---

## Network Issues

### ❌ Can't Access Dashboard from Phone/Tablet

**Solutions**:

1. **Use PC's IP address**, not localhost:
   ```
   http://192.168.1.100:5000  ✓ Correct
   http://localhost:5000       ✗ Won't work from other devices
   ```

2. **Check devices on same network**:
   - Phone/tablet must be on same WiFi as PC
   - Not on guest network

3. **Check Windows Firewall**:
   ```powershell
   # Allow Python through firewall
   # Control Panel → Windows Defender Firewall → Allow an app
   # Add Python to allowed apps
   ```

4. **Set network to Private** (Windows 11):
   - Settings → Network & Internet → WiFi
   - Click on your network → Network profile type → Private

### ❌ ESP32 Can Connect but Server Can't

**Symptoms**: ESP32 shows "Server: ERR" but WiFi is connected

**Solutions**:

1. **Verify IP address matches**:
   - Check firmware: `const char* SERVER_URL`
   - Check actual IP: `ipconfig`
   - IPs must match exactly

2. **Test from ESP32 network perspective**:
   - Connect laptop to same WiFi
   - Try accessing `http://YOUR_PC_IP:5000/status`

3. **Check router settings**:
   - Disable AP isolation (guest network isolation)
   - Check firewall rules
   - Try connecting ESP32 to main network, not guest

4. **Try static IP**: In router settings, assign static IP to your PC

---

## Advanced Debugging

### Enable Detailed Logging

**In firmware**, add more serial output:
```cpp
void sendDataToServer(SensorData data) {
  Serial.println("\n=== HTTP Request Details ===");
  Serial.print("URL: ");
  Serial.println(SERVER_URL);
  Serial.print("JSON: ");
  Serial.println(jsonString);
  
  // ... rest of function
  
  Serial.print("Response: ");
  Serial.println(http.getString());
  Serial.println("===========================\n");
}
```

**In server**, enable debug mode:
```python
# server.py
app.run(host='0.0.0.0', port=5000, debug=True)  # Debug already on
```

Check console for detailed error messages.

### Check Server Logs

All received data is printed to console:
```
==================================================
Received data from livingroom_01
==================================================
{
  "timestamp": 1699012345,
  "temp_sht40": 22.5,
  ...
}
✓ Data saved to MongoDB at 2024-11-03 10:30:00
```

Look for error messages or validation failures.

### Inspect Data in MongoDB

```bash
mongosh "your-mongo-uri"
use cognitiv
db.sensor_data.find().sort({ timestamp: -1 }).limit(5)
```

Or export a CSV snapshot:
```bash
mongoexport --uri "$MONGO_URI" --collection sensor_data \
  --type=csv --fields timestamp_str,device_id,temperature,humidity,co2 \
  --out sensor_data.csv
```

---

## Still Having Issues?

### Gather Debug Information

1. **Hardware Setup**:
   - Take photo of wiring
   - Note which T-Display model you have

2. **Serial Monitor Output**:
   - Tools → Serial Monitor (115200 baud)
   - Copy full output including errors

3. **Server Console Output**:
   - Copy any error messages
   - Note HTTP response codes

4. **Browser Console** (F12):
   - Copy any JavaScript errors
   - Check Network tab for failed requests

5. **Check versions**:
   ```powershell
   python --version
   pip show django
   ```

### Getting Help

With the above information:
- Check README.md Troubleshooting section
- Open GitHub issue with debug info
- Search for similar issues online

---

## Prevention Tips

### Regular Maintenance

1. **Check connections monthly**: Ensure nothing has come loose
2. **Calibrate CO₂ sensor**: Every 3-6 months in fresh air
3. **Clean sensors**: Gently dust with soft brush
4. **Update firmware**: Check for improvements/fixes
5. **Backup data**: Schedule Atlas backups or run `mongodump`

### Best Practices

1. **Use quality components**: Good wires, reliable power supply
2. **Document changes**: Note any configuration changes
3. **Test incrementally**: Make one change at a time
4. **Monitor logs**: Check server console occasionally
5. **Keep firmware simple**: Don't modify unless necessary

---

**Remember**: Most issues are wiring or configuration problems. Double-check basics first!
