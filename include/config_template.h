// Configuration file - copy this to config.h and fill in your values
// Add config.h to .gitignore to keep credentials private

#ifndef CONFIG_H
#define CONFIG_H

// WiFi Configuration
#define WIFI_SSID "YourWiFiName"
#define WIFI_PASSWORD "YourWiFiPassword"

// Server Configuration
// Run 'ipconfig' in PowerShell to find your PC's IP address
#define SERVER_URL "http://192.168.1.100:5000/data"

// Device ID (unique name for this sensor)
#define DEVICE_ID "YOUR_DEVICE_ID"

// Timezone (in seconds from UTC)
// Examples: EST = -18000, CET = 3600, UTC = 0
#define GMT_OFFSET_SEC 0
#define DAYLIGHT_OFFSET_SEC 0

// Reading interval (milliseconds)
// 30000 = 30 seconds, 60000 = 1 minute, 300000 = 5 minutes
#define READING_INTERVAL_MS 60000

#endif
