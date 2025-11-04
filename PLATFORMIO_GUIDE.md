# PlatformIO ESP12S Environmental Monitor

## Quick Start from VS Code

### 1. Install PlatformIO Extension

1. Open VS Code Extensions (Ctrl+Shift+X)
2. Search "PlatformIO IDE"
3. Click Install
4. Restart VS Code

### 2. Configure Your Settings

Create `include/config.h` from the template:

```powershell
Copy-Item include\config_template.h include\config.h
```

Edit `include/config.h` with your settings:
```cpp
#define WIFI_SSID "YourWiFiName"
#define WIFI_PASSWORD "YourPassword"
#define SERVER_URL "http://192.168.1.100:5000/data"  // Your PC's IP
#define DEVICE_ID "YOUR_DEVICE_ID"
```

### 3. Build and Upload

**Method 1: VS Code UI**
- Click the ✓ (Build) button in the status bar
- Click the → (Upload) button in the status bar

**Method 2: Command Palette**
- Press `Ctrl+Shift+P`
- Type "PlatformIO: Build"
- Then "PlatformIO: Upload"

**Method 3: Terminal**
```powershell
pio run --target upload
```

### 4. Monitor Serial Output

**In VS Code:**
- Click the 🔌 (Serial Monitor) button in status bar

**Or in terminal:**
```powershell
pio device monitor
```

## PlatformIO Commands

### Build
```powershell
pio run
```

### Upload
```powershell
pio run --target upload
```

### Monitor
```powershell
pio device monitor
```

### Upload + Monitor
```powershell
pio run --target upload && pio device monitor
```

### Clean
```powershell
pio run --target clean
```

## Project Structure

```
Cognitiv/
├── platformio.ini          # PlatformIO configuration
├── src/
│   └── main.cpp           # Main firmware (ESP12S)
├── include/
│   ├── config_template.h  # Configuration template
│   └── config.h           # Your settings (create this)
├── lib/                    # Custom libraries (if needed)
└── .pio/                   # PlatformIO build files (auto-generated)
```

## Configuration File

The `platformio.ini` is already configured for ESP12S:

```ini
[env:esp12e]
platform = espressif8266
board = esp12e
framework = arduino
upload_speed = 115200
monitor_speed = 115200

build_flags = 
    -D BOARD_ESP12S

lib_deps = 
    adafruit/Adafruit SHT4x Library
    sparkfun/SparkFun SCD4x Arduino Library
    bblanchon/ArduinoJson
```

## Troubleshooting

### Port Not Found
```powershell
pio device list
```
Lists all connected devices. Use the correct port in `platformio.ini`:
```ini
upload_port = COM3
monitor_port = COM3
```

### Upload Fails
- Hold BOOT/FLASH button on ESP12S while uploading
- Try lower baud rate: `upload_speed = 57600`
- Check USB cable (must be data cable, not charge-only)

### Library Issues
```powershell
pio pkg update
```

### Clean Build
```powershell
pio run --target clean
pio run
```

## VS Code Integration

### Status Bar Buttons
- ✓ Build (Compile)
- → Upload (Flash to board)
- 🔌 Serial Monitor
- 🗑️ Clean
- 🏠 PlatformIO Home

### Keyboard Shortcuts
- Build: `Ctrl+Alt+B`
- Upload: `Ctrl+Alt+U`
- Monitor: `Ctrl+Alt+S`

## Advantages of PlatformIO

✅ Everything in VS Code  
✅ Automatic library management  
✅ Better IntelliSense  
✅ Faster builds  
✅ Professional toolchain  
✅ Easy CI/CD integration  

## Next Steps

1. Install PlatformIO Extension
2. Create `include/config.h`
3. Click Build (✓)
4. Click Upload (→)
5. Click Monitor (🔌)
6. See sensor readings!

That's it! 🚀
