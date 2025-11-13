// Configuration file - copy this to config.h and fill in your values
// Add config.h to .gitignore to keep credentials private

#ifndef CONFIG_H
#define CONFIG_H

// WiFi Configuration
// Standard WPA/WPA2 Personal networks (password only)
#define WIFI_SSID "gymzr hw"  // Replace with your WiFi network SSID
#define WIFI_PASSWORD "1ENO8VNG0BMD7EF" 
//#define WIFI_SSID "YOUR_WIFI_SSID"  // Replace with your WiFi network SSID
//#define WIFI_PASSWORD "YOUR_WIFI_PASSWORD"  // Replace with your WiFi password

// Server Configuration
// Replace with your Render service URL (e.g. https://your-app.onrender.com/data)
#define SERVER_URL "https://cognitiv.onrender.com/data"

// Device ID (unique name for this sensor)
#define DEVICE_ID "esp12s_school_01"

// Timezone (in seconds from UTC)
// Examples: EST = -18000, CET = 3600, UTC = 0
#define GMT_OFFSET_SEC 0
#define DAYLIGHT_OFFSET_SEC 0

// Reading interval (milliseconds)
// 5000 = 5 seconds (testing), 30000 = 30 seconds, 60000 = 1 minute, 300000 = 5 minutes
#define READING_INTERVAL_MS 10000

#endif
