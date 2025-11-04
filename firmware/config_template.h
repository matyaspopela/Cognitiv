/*
 * Configuration Template
 * 
 * Copy this to config.h and fill in your values
 * (Add config.h to .gitignore to keep credentials private)
 */

#ifndef CONFIG_H
#define CONFIG_H

// WiFi credentials
#define WIFI_SSID "eduroam"
// #define WIFI_PASSWORD "YourNetworkPassword"

// For WPA2 Enterprise networks (username + password)
// Uncomment these lines and comment out WIFI_PASSWORD above
#define WIFI_ENTERPRISE_ENABLED
#define WIFI_IDENTITY "popela.matyas@student.gymzr.cz"
#define WIFI_EAP_PASSWORD "Kursk_1942"

// Server configuration
// Use ipconfig (Windows) or ifconfig (Mac/Linux) to find your PC's IP
#define SERVER_URL "http://192.168.11.233:5000/data"

// Device identification
#define DEVICE_ID "livingroom_01"

// Timezone configuration (in seconds)
// EST: -18000, PST: -28800, UTC: 0
#define GMT_OFFSET_SEC 0
#define DAYLIGHT_OFFSET_SEC 0

// Reading interval (milliseconds)
// 30000 = 30 seconds, 60000 = 1 minute
#define READING_INTERVAL_MS 60000

// Optional: Altitude in meters (for CO2 sensor accuracy)
// Uncomment and set if you know your altitude
// #define SENSOR_ALTITUDE 100

#endif
