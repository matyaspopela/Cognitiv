// Configuration file - copy this to config.h and fill in your values
// Add config.h to .gitignore to keep credentials private

#ifndef CONFIG_H
#define CONFIG_H

// WiFi Configuration
// Standard WPA/WPA2 Personal networks (password only)
#define WIFI_SSID "YOUR_WIFI_SSID"
#define WIFI_PASSWORD "YOUR_WIFI_PASSWORD"

// Server Configuration
// Replace with your Render service URL (e.g. https://your-app.onrender.com/api/data)
#define SERVER_URL "https://cognitiv.onrender.com/api/data"

// Local development server (for debugging)
// Set ENABLE_LOCAL_DEBUG to 1 to also send data to local server
// IMPORTANT: Replace 192.168.1.100 with your computer's IP address on the WiFi network
// Find your IP: Windows: ipconfig | Linux/Mac: ifconfig or ip addr
// The ESP8266 cannot use "localhost" - it needs the actual IP address
#define ENABLE_LOCAL_DEBUG 1
#define LOCAL_SERVER_URL "http://192.168.1.100:8000/api/data"

// Device ID (unique name for this sensor)
#define DEVICE_ID "ESP8266A2"

// Timezone (in seconds from UTC)
// Examples: EST = -18000, CET = 3600, UTC = 0
#define GMT_OFFSET_SEC 0
#define DAYLIGHT_OFFSET_SEC 0

// Reading interval (milliseconds)
// 5000 = 5 seconds (testing), 30000 = 30 seconds, 60000 = 1 minute, 300000 = 5 minutes
#define READING_INTERVAL_MS 10000

// Voltage measurement configuration
// Divider ratio for voltage calculation
// Default: 2.0 (common for 3.3V systems with 2:1 voltage divider)
// To calibrate: 
//   1. Measure actual battery voltage with multimeter
//   2. Compare with device reading
//   3. Adjust ratio: new_ratio = actual_voltage / device_reading
// Common values: 2.0 (3.3V systems), 3.0 (5V systems)
#define VOLTAGE_DIVIDER_RATIO 2.0

#endif
