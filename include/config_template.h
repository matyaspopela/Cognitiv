// Configuration file - copy this to config.h and fill in your values
// Add config.h to .gitignore to keep credentials private

#ifndef CONFIG_H
#define CONFIG_H

// WiFi Configuration
#define WIFI_SSID "YourWiFiName"
#define WIFI_PASSWORD "YourWiFiPassword"

// Server Configuration
// Replace with your Render service URL (e.g. https://your-app.onrender.com/data)
#define SERVER_URL "https://your-app.onrender.com/data"

// Device ID (unique name for this sensor)
#define DEVICE_ID "YOUR_DEVICE_ID"

// Timezone (in seconds from UTC)
// Examples: EST = -18000, CET = 3600, UTC = 0
#define GMT_OFFSET_SEC 0
#define DAYLIGHT_OFFSET_SEC 0

// Reading interval (milliseconds)
// 30000 = 30 seconds, 60000 = 1 minute, 300000 = 5 minutes
#define READING_INTERVAL_MS 60000

// Bundle configuration
// ENABLE_BUNDLING: Set to 1 to enable bundling mode, 0 to disable (immediate transmission)
//  When enabled: Readings are buffered and sent in batches
//  When disabled: Each reading is sent immediately (normal HTTP request mode)
//  Useful for testing: Set to 0 to get immediate transmissions
#define ENABLE_BUNDLING 1

// BUNDLE_INTERVAL_MS: Time interval between bundle transmissions (milliseconds)
//  300000 = 5 minutes, 600000 = 10 minutes, 180000 = 3 minutes
//  Only used when ENABLE_BUNDLING is 1
#define BUNDLE_INTERVAL_MS 300000

// MAX_BUNDLE_SIZE: Maximum number of readings per bundle
//  Higher = more memory, fewer transmissions
//  Lower = less memory, more frequent transmissions
//  Recommended: 5-15 for ESP8266
//  Only used when ENABLE_BUNDLING is 1
#define MAX_BUNDLE_SIZE 10

// Deep sleep configuration
// ENABLE_DEEP_SLEEP: Set to 1 to enable deep sleep mode, 0 to disable (continuous operation)
//  When enabled: Device enters deep sleep after completing sensor reading and transmission cycle
//  When disabled: Device runs continuously (current behavior)
//  Note: Requires EN and IO16 pins to be connected for wake-up (see LaskaKit AirBoard-8266 documentation)
//  Power consumption: ~20µA in sleep vs ~80mA active (99.975% reduction)
#define ENABLE_DEEP_SLEEP 0

// DEEP_SLEEP_DURATION_US: Deep sleep duration in microseconds
//  60000000 = 60 seconds, 300000000 = 5 minutes, 3600000000 = 1 hour
//  Minimum: 10000000 (10 seconds) - allows time for WiFi connection and transmission
//  Maximum: 4294967295 (71 minutes) - ESP8266 hardware limit
//  Recommended: 60000000 (60 seconds) - good balance of power savings and data frequency
//  Only used when ENABLE_DEEP_SLEEP is 1
#define DEEP_SLEEP_DURATION_US 60000000

// WiFi-on-demand configuration
// ENABLE_WIFI_ON_DEMAND: Set to 1 to enable WiFi-on-demand mode, 0 to disable (normal mode)
//  When enabled: WiFi connects only when buffer is ready for transmission, then disconnects immediately after
//  When disabled: WiFi stays connected (normal mode)
//  Note: Requires ENABLE_BUNDLING to be enabled (enforced at compile time)
//  Note: Automatically enables ENABLE_DEEP_SLEEP
//  Note: DEEP_SLEEP_DURATION_US should be 10000000 (10 seconds) for optimal power savings
//  Power consumption: ~99% reduction vs continuous WiFi connection
#define ENABLE_WIFI_ON_DEMAND 0

// Scheduled shutdown configuration
// ENABLE_SCHEDULED_SHUTDOWN: Set to 1 to enable scheduled shutdown, 0 to disable
//  When enabled: Device stops measuring at SHUTDOWN_HOUR:SHUTDOWN_MINUTE and sleeps until WAKE_HOUR:WAKE_MINUTE next day
//  When disabled: Device runs continuously (no scheduled shutdown)
//  Useful for school/work schedules: Stop measuring when not needed (e.g., after school hours)
#define ENABLE_SCHEDULED_SHUTDOWN 0

// SHUTDOWN_HOUR: Hour when device should stop measuring (24-hour format)
//  0-23 (e.g., 16 = 4pm, 17 = 5pm)
//  Only used when ENABLE_SCHEDULED_SHUTDOWN is 1
#define SHUTDOWN_HOUR 16

// SHUTDOWN_MINUTE: Minute when device should stop measuring
//  0-59 (e.g., 0 = top of hour, 30 = half past)
//  Only used when ENABLE_SCHEDULED_SHUTDOWN is 1
#define SHUTDOWN_MINUTE 0

// WAKE_HOUR: Hour when device should resume measuring next day (24-hour format)
//  0-23 (e.g., 8 = 8am, 7 = 7am)
//  Device will sleep from SHUTDOWN time until WAKE time next day
//  Only used when ENABLE_SCHEDULED_SHUTDOWN is 1
#define WAKE_HOUR 8

// WAKE_MINUTE: Minute when device should resume measuring next day
//  0-59 (e.g., 0 = top of hour, 30 = half past)
//  Only used when ENABLE_SCHEDULED_SHUTDOWN is 1
#define WAKE_MINUTE 0

#endif
