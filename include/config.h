// Configuration file - copy this to config.h and fill in your values
// Add config.h to .gitignore to keep credentials private

#ifndef CONFIG_H
#define CONFIG_H

// WiFi Configuration
#define WIFI_SSID "YOUR_WIFI_SSID"
#define WIFI_PASSWORD "YOUR_WIFI_PASSWORD"

// For WPA2 Enterprise networks (username + password)
// Uncomment these lines and comment out WIFI_PASSWORD above if using Enterprise WiFi
// #define WIFI_ENTERPRISE_ENABLED
// #define WIFI_IDENTITY "your_username"
// #define WIFI_EAP_PASSWORD "your_password"

// Server Configuration
// Run 'ipconfig' in PowerShell to find your PC's IP address
#define SERVER_URL "http://192.168.0.172:5000/data"

// Device ID (unique name for this sensor)
#define DEVICE_ID "YOUR_DEVICE_ID"

// Timezone (in seconds from UTC)
// Examples: EST = -18000, CET = 3600, UTC = 0
#define GMT_OFFSET_SEC 0
#define DAYLIGHT_OFFSET_SEC 0

// Reading interval (milliseconds)
// 5000 = 5 seconds (testing), 30000 = 30 seconds, 60000 = 1 minute, 300000 = 5 minutes
#define READING_INTERVAL_MS 5000

#endif
