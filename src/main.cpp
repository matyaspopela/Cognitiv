/*
 * IoT Environmental Monitoring System
 * ESP12S + SCD41 Sensor with LaskaKit μSup I2C Connector
 * 
 * ESP12S I2C Pins:
 * - SDA: GPIO 4 (D2)
 * - SCL: GPIO 5 (D1)
 * 
 * With μSup Connectors (I2C):
 * - Sensors connect to I2C bus via μSup connectors
 * - Power: 3.3V from ESP12S
 * - No manual wiring needed - μSup handles connections!
 */

// Arduino core
#include <Wire.h>

// ===== CONFIGURATION (must be loaded first for conditional compilation) =====
#include "config.h"

// ESP8266 libraries (LaskaKit AirBoard 8266)
#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClientSecureBearSSL.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
// LaskaKit AirBoard 8266 specific I2C pins for μSup connectors
#define I2C_SDA 0  // GPIO 0 (D3) - connected to μSup connectors
#define I2C_SCL 2  // GPIO 2 (D4) - connected to μSup connectors
#define HAS_DISPLAY
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);
#ifndef TFT_BLACK
  #define TFT_BLACK SSD1306_BLACK
  #define TFT_WHITE SSD1306_WHITE
  #define TFT_RED 0xF800
  #define TFT_GREEN 0x07E0
  #define TFT_YELLOW 0xFFE0
  #define TFT_ORANGE 0xFD20
  #define TFT_CYAN 0x07FF
#endif

#include <ArduinoJson.h>
#include <SparkFun_SCD4x_Arduino_Library.h>
#include <time.h>

// Apply configuration
const char* NTP_SERVER = "pool.ntp.org";
const unsigned long READING_INTERVAL = READING_INTERVAL_MS;
const uint16_t WARNING_CO2_THRESHOLD = 2000;

// WiFi-on-demand configuration validation
#if ENABLE_WIFI_ON_DEMAND
  #ifndef ENABLE_BUNDLING
    #error "ENABLE_BUNDLING must be enabled when ENABLE_WIFI_ON_DEMAND is enabled"
  #elif ENABLE_BUNDLING == 0
    #error "ENABLE_BUNDLING must be enabled (set to 1) when ENABLE_WIFI_ON_DEMAND is enabled"
  #endif
  
  #ifndef ENABLE_DEEP_SLEEP
    #define ENABLE_DEEP_SLEEP 1  // Auto-enable deep sleep
  #elif ENABLE_DEEP_SLEEP == 0
    #define ENABLE_DEEP_SLEEP 1  // Force enable deep sleep
  #endif
  
  #if DEEP_SLEEP_DURATION_US != 10000000
    #warning "DEEP_SLEEP_DURATION_US should be 10000000 (10 seconds) for optimal WiFi-on-demand mode"
  #endif
#endif
// ========================================

// Hardware objects
SCD4x scd41;

// Data storage
struct SensorData {
  float temperature;
  float humidity;
  uint16_t co2;
  unsigned long timestamp;
  bool valid;
};

SensorData lastReading;
unsigned long lastReadingTime = 0;
bool sensorsInitialized = false;

// Bundle buffer
SensorData readingBuffer[MAX_BUNDLE_SIZE];
uint8_t bufferCount = 0;
unsigned long lastBundleTime = 0;

#ifdef HAS_DISPLAY
bool displayInitialized = false;
#endif

// Connection status
enum ConnectionState {
  CONNECTING,
  CONNECTED,
  DISCONNECTED,
  ERROR
};

ConnectionState wifiState = CONNECTING;
ConnectionState serverState = DISCONNECTED;

// Forward declarations
#ifdef HAS_DISPLAY
void initDisplay();
void displayStatus(const char* message, uint16_t color);
void displayReadings(SensorData data);
void displayWarningScreen(SensorData data);
#endif
void scanI2C();
bool initSensors();
SensorData readSensors();
void connectWiFi();
bool sendDataToServer(SensorData* readings, uint8_t count);
bool sendSingleReading(SensorData data);
void addToBuffer(SensorData data);
bool shouldTransmitBundle();
void enterDeepSleep();
bool isShutdownTime();
unsigned long calculateSleepUntilWake();

void setup() {
  Serial.begin(115200);
  delay(1000);
  
  Serial.println("\n\n=================================");
  Serial.println("Environmental Monitoring System");
  Serial.println("=================================\n");
  
  // Initialize I2C with correct pins for ESP12S
  Wire.begin(I2C_SDA, I2C_SCL);
  Serial.print("I2C initialized on SDA=GPIO");
  Serial.print(I2C_SDA);
  Serial.print(", SCL=GPIO");
  Serial.println(I2C_SCL);

  #ifdef HAS_DISPLAY
  initDisplay();
  displayStatus("Initializing...", TFT_YELLOW);
  #endif
  
  // Scan I2C bus
  scanI2C();
  
  // Initialize sensors
  if (initSensors()) {
    sensorsInitialized = true;
    #ifdef HAS_DISPLAY
    displayStatus("Sensors OK", TFT_GREEN);
    #endif
    Serial.println("✓ Sensors initialized successfully");
    delay(1000);
  } else {
    #ifdef HAS_DISPLAY
    displayStatus("Sensor Error!", TFT_RED);
    #endif
    Serial.println("ERROR: Sensor initialization failed!");
    // Continue anyway
  }
  
  // Connect to WiFi (skip in WiFi-on-demand mode)
  #if ENABLE_WIFI_ON_DEMAND
    Serial.println("WiFi-on-demand mode: Skipping WiFi connection in setup");
    Serial.println("WiFi will be connected only when buffer is ready for transmission");
  #else
    connectWiFi();
  #endif
  
  // Initialize time (only if WiFi connected, or skip in WiFi-on-demand mode)
  #if ENABLE_WIFI_ON_DEMAND
    Serial.println("WiFi-on-demand mode: Skipping NTP sync in setup");
    Serial.println("Time will be synced when WiFi connects for transmission");
  #else
    configTime(GMT_OFFSET_SEC, DAYLIGHT_OFFSET_SEC, NTP_SERVER);
    Serial.println("Waiting for NTP time sync...");
    delay(2000);
  #endif
  
  Serial.println("\nSetup complete!\n");
}

void loop() {
  // Check scheduled shutdown time (if enabled)
  #if ENABLE_SCHEDULED_SHUTDOWN
    if (isShutdownTime()) {
      unsigned long sleepDuration = calculateSleepUntilWake();
      Serial.print("\n--- Scheduled Shutdown ---");
      Serial.print("\nCurrent time reached shutdown time (");
      Serial.print(SHUTDOWN_HOUR);
      Serial.print(":");
      if (SHUTDOWN_MINUTE < 10) Serial.print("0");
      Serial.print(SHUTDOWN_MINUTE);
      Serial.print(")");
      Serial.print("\nSleeping until wake time (");
      Serial.print(WAKE_HOUR);
      Serial.print(":");
      if (WAKE_MINUTE < 10) Serial.print("0");
      Serial.print(WAKE_MINUTE);
      Serial.print(") next day...");
      Serial.flush();
      
      // Enter deep sleep until wake time
      ESP.deepSleep(sleepDuration, WAKE_RFCAL);
      delay(1000);  // Safety delay (unreachable)
      return;
    }
  #endif
  
  // Check WiFi connection
  #if ENABLE_WIFI_ON_DEMAND
    // WiFi-on-demand mode: Don't check WiFi connection here
    // WiFi will be connected only when buffer is ready for transmission
    wifiState = DISCONNECTED;  // Assume disconnected until we connect
  #else
    // Normal mode: Check WiFi connection
    if (WiFi.status() != WL_CONNECTED) {
      wifiState = DISCONNECTED;
      #ifdef HAS_DISPLAY
      displayStatus("WiFi Lost!", TFT_RED);
      #endif
      connectWiFi();
    } else {
      wifiState = CONNECTED;
    }
  #endif
  
  // Read sensors at specified interval
  if (sensorsInitialized && (millis() - lastReadingTime >= READING_INTERVAL)) {
    lastReadingTime = millis();
    
    Serial.println("\n--- New Reading ---");
    SensorData reading = readSensors();
    
    if (reading.valid) {
      lastReading = reading;
      #ifdef HAS_DISPLAY
      displayReadings(reading);
      #endif
      
      // Send to server if WiFi connected
      #if ENABLE_BUNDLING
        // Bundling mode: Add to buffer and transmit in batches
        addToBuffer(reading);
        
        // Check if bundle should be transmitted
        if (shouldTransmitBundle()) {
          #if ENABLE_WIFI_ON_DEMAND
            // WiFi-on-demand: Connect WiFi only now
            if (WiFi.status() != WL_CONNECTED) {
              Serial.println("--- WiFi-On-Demand: Connecting WiFi ---");
              connectWiFi();
              if (WiFi.status() == WL_CONNECTED) {
                wifiState = CONNECTED;
                // Sync time now that WiFi is connected
                configTime(GMT_OFFSET_SEC, DAYLIGHT_OFFSET_SEC, NTP_SERVER);
                Serial.println("Syncing time via NTP...");
                delay(1000);  // Brief delay for NTP sync
              }
            }
          #endif
          
          // Transmit bundle (only if WiFi connected)
          if (wifiState == CONNECTED || WiFi.status() == WL_CONNECTED) {
            if (sendDataToServer(readingBuffer, bufferCount)) {
              serverState = CONNECTED;
              Serial.println("✓ Bundle sent successfully");
            } else {
              serverState = ERROR;
              Serial.println("✗ Failed to send bundle");
            }
            
            #if ENABLE_WIFI_ON_DEMAND
              // WiFi-on-demand: Disconnect WiFi immediately after transmission
              Serial.println("--- WiFi-On-Demand: Disconnecting WiFi ---");
              WiFi.disconnect();
              WiFi.mode(WIFI_OFF);
              wifiState = DISCONNECTED;
              Serial.println("WiFi disconnected");
            #endif
          } else {
            Serial.println("✗ WiFi not connected, cannot send bundle");
            serverState = ERROR;
          }
        }
      #else
        // Immediate mode: Send each reading right away (normal HTTP request mode)
        #if ENABLE_WIFI_ON_DEMAND
          #error "ENABLE_BUNDLING must be enabled when ENABLE_WIFI_ON_DEMAND is enabled"
        #endif
        
        if (wifiState == CONNECTED) {
          if (sendSingleReading(reading)) {
            serverState = CONNECTED;
            Serial.println("✓ Data sent successfully");
          } else {
            serverState = ERROR;
            Serial.println("✗ Failed to send data");
          }
        }
      #endif
      
      // Enter deep sleep after completing cycle
      #if ENABLE_WIFI_ON_DEMAND
        // WiFi-on-demand: Always deep sleep (10 seconds)
        Serial.println("\n--- WiFi-On-Demand: Entering Deep Sleep (10s) ---");
        enterDeepSleep();
      #elif ENABLE_DEEP_SLEEP
        // Optional deep sleep (existing behavior)
        enterDeepSleep();
      #endif
    } else {
      Serial.println("✗ Invalid sensor reading");
      #ifdef HAS_DISPLAY
      displayStatus("Sensor Error!", TFT_RED);
      #endif
      
      // Enter deep sleep even if reading invalid
      // Prevents infinite loop on sensor errors
      #if ENABLE_WIFI_ON_DEMAND
        // WiFi-on-demand: Always deep sleep (10 seconds)
        Serial.println("\n--- WiFi-On-Demand: Entering Deep Sleep (10s) ---");
        enterDeepSleep();
      #elif ENABLE_DEEP_SLEEP
        enterDeepSleep();
      #endif
    }
  }
  
  // WiFi-on-demand mode: Always enter deep sleep if no reading occurred
  // This ensures we don't stay awake waiting for next reading interval
  #if ENABLE_WIFI_ON_DEMAND
    // If we haven't entered deep sleep yet (no reading cycle), enter it now
    // This handles cases where sensors aren't initialized or reading interval hasn't passed
    Serial.println("\n--- WiFi-On-Demand: Entering Deep Sleep (10s) ---");
    enterDeepSleep();
  #endif
  
  // If deep sleep is disabled, continue normal loop
  #if !ENABLE_DEEP_SLEEP && !ENABLE_WIFI_ON_DEMAND
    delay(100);
  #endif
}

#ifdef HAS_DISPLAY
void initDisplay() {
  if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println("✗ SSD1306 display not found at 0x3C");
    displayInitialized = false;
    return;
  }
  displayInitialized = true;
  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);
  display.setTextSize(2);
  display.setCursor(0, 0);
  display.println("Environmental");
  display.setCursor(0, 20);
  display.println("Monitor");
  display.display();
}

void displayStatus(const char* message, uint16_t color) {
  if (!displayInitialized) {
    return;
  }
  (void)color;
  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);
  display.setTextSize(1);
  display.setCursor(0, 0);
  display.println(message);
  display.display();
}

void displayWarningScreen(SensorData data) {
  display.clearDisplay();

  // Yellow header (top 16 px are rendered in yellow by the module)
  display.setTextColor(SSD1306_WHITE);
  display.setTextSize(2);
  display.setCursor(4, 4);
  display.println("POZOR");

  // Blue section content
  display.setTextSize(1);
  display.setCursor(0, 28);
  display.print("CO2: ");
  display.print(data.co2);
  display.println(" ppm");
  display.setCursor(0, 40);
  display.println("Vyvetrejte mistnost.");

  static bool invertToggle = false;
  invertToggle = !invertToggle;
  display.invertDisplay(invertToggle);

  display.display();
}

void displayReadings(SensorData data) {
  if (!displayInitialized) {
    return;
  }

  if (data.co2 >= WARNING_CO2_THRESHOLD) {
    displayWarningScreen(data);
    return;
  }

  display.invertDisplay(false);
  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);
  display.setTextSize(1);
  display.setCursor(0, 0);
  display.println("Monitor kvality");

  display.setTextSize(1);
  display.setCursor(0, 18);
  display.print("CO2: ");
  display.print(data.co2);
  display.println(" ppm");

  display.setTextSize(1);
  display.setCursor(0, 46);
  display.print("Teplota: ");
  display.print(data.temperature, 1);
  display.println(" C");
  display.setCursor(0, 58);
  display.print("WiFi:");
  display.print(wifiState == CONNECTED ? "OK" : "ERR");
  display.print("  Srv:");
  display.print(serverState == CONNECTED ? "OK" : "ERR");
  display.display();
}
#endif  // HAS_DISPLAY

void scanI2C() {
  Serial.println("\nScanning I2C bus...");
  Serial.println("LaskaKit AirBoard 8266 - μSup connectors");
  Serial.println("Expected devices:");
  Serial.println("  - SCD41 at 0x62");
  Serial.println("  - Optional display at 0x3C");
  Serial.println("\nScanning addresses 0x01-0x7F...");
  
  int deviceCount = 0;
  
  for (byte addr = 1; addr < 127; addr++) {
    Wire.beginTransmission(addr);
    byte error = Wire.endTransmission();
    
    if (error == 0) {
      Serial.print("✓ I2C device found at 0x");
      if (addr < 16) Serial.print("0");
      Serial.print(addr, HEX);
      
      // Identify known devices
      if (addr == 0x62) Serial.print(" (SCD41)");
      else if (addr == 0x3C) Serial.print(" (Display)");
      
      Serial.println();
      deviceCount++;
    }
  }
  
  Serial.println();
  if (deviceCount == 0) {
    Serial.println("✗ No I2C devices found!");
    Serial.println("  Check:");
    Serial.println("  1. μSup connectors are firmly connected");
    Serial.println("  2. Sensors have power (3.3V)");
    Serial.println("  3. I2C pins: SDA=GPIO0, SCL=GPIO2 (LaskaKit AirBoard)");
  } else {
    Serial.print("✓ Found ");
    Serial.print(deviceCount);
    Serial.println(" I2C device(s)");
  }
  Serial.println();
}

bool initSensors() {
  Serial.println("Initializing sensors...");
  bool success = true;
  
  // Give sensors time to power up
  delay(500);
  
  // Initialize SCD41 (I2C address 0x62)
  Serial.print("SCD41 (0x62): ");
  if (scd41.begin(Wire)) {
    Serial.println("✓ OK");
    
    // Stop any ongoing measurement
    scd41.stopPeriodicMeasurement();
    delay(500);
    
    // Optional: Set altitude for better accuracy (meters above sea level)
    // scd41.setSensorAltitude(100);
    
    // Start periodic measurements
    Serial.print("SCD41: Starting measurements... ");
    if (scd41.startPeriodicMeasurement()) {
      Serial.println("✓ OK");
      Serial.println("SCD41: Warming up (first reading needs ~60 seconds)");
      // First reading takes ~60 seconds to stabilize
    } else {
      Serial.println("✗ FAILED");
      success = false;
    }
  } else {
    Serial.println("✗ FAILED - Check I2C connections and address");
    success = false;
  }
  
  return success;
}

SensorData readSensors() {
  SensorData data;
  data.valid = false;
  data.timestamp = time(nullptr);
  
  // Read SCD41
  if (scd41.readMeasurement()) {
    data.co2 = scd41.getCO2();
    data.temperature = scd41.getTemperature();
    data.humidity = scd41.getHumidity();
    
    Serial.print("SCD41 - CO2: ");
    Serial.print(data.co2);
    Serial.print(" ppm, Temp: ");
    Serial.print(data.temperature, 2);
    Serial.print("°C, Humidity: ");
    Serial.print(data.humidity, 2);
    Serial.println("%");
    
    // Validate readings
    if (data.co2 >= 400 && data.co2 <= 5000 &&
        data.temperature >= -10 && data.temperature <= 50 &&
        data.humidity >= 0 && data.humidity <= 100) {
      data.valid = true;
    } else {
      Serial.println("SCD41: Reading out of valid range");
    }
  } else {
    Serial.println("SCD41: No data available (may still be warming up)");
  }
  
  return data;
}

void addToBuffer(SensorData data) {
  if (bufferCount >= MAX_BUNDLE_SIZE) {
    Serial.println("⚠ Buffer full, forcing transmission");
    // Don't add - transmission will be triggered
    // The reading will be lost, but prevents buffer overflow
    return;
  }
  
  readingBuffer[bufferCount] = data;
  bufferCount++;
  Serial.print("Reading added to buffer (");
  Serial.print(bufferCount);
  Serial.print("/");
  Serial.print(MAX_BUNDLE_SIZE);
  Serial.println(")");
}

bool shouldTransmitBundle() {
  // Check time-based condition
  bool timeTrigger = (millis() - lastBundleTime) >= BUNDLE_INTERVAL_MS;
  
  // Check size-based condition
  bool sizeTrigger = (bufferCount >= MAX_BUNDLE_SIZE);
  
  // Also check if we have any readings to send
  bool hasReadings = (bufferCount > 0);
  
  // Transmit if (time OR size) AND has readings
  return hasReadings && (timeTrigger || sizeTrigger);
}

void connectWiFi() {
  Serial.print("Connecting to WiFi: ");
  Serial.println(WIFI_SSID);
  
  #ifdef HAS_DISPLAY
  displayStatus("WiFi Connecting", TFT_YELLOW);
  #endif
  
  WiFi.mode(WIFI_STA);
  WiFi.disconnect();
  delay(100);
  
  // Standard WPA/WPA2 Personal (password only)
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  
  int attempts = 0;
  int maxAttempts = 20;
  
  while (WiFi.status() != WL_CONNECTED && attempts < maxAttempts) {
    delay(500);
    Serial.print(".");
    attempts++;
    
    // Print status every 5 seconds for debugging
    if (attempts % 10 == 0) {
      Serial.print(" [");
      Serial.print(attempts * 500 / 1000);
      Serial.print("s]");
    }
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n✓ WiFi connected!");
    Serial.print("IP address: ");
    Serial.println(WiFi.localIP());
    Serial.print("Signal strength: ");
    Serial.print(WiFi.RSSI());
    Serial.println(" dBm");
    Serial.print("Gateway: ");
    Serial.println(WiFi.gatewayIP());
    Serial.print("Subnet: ");
    Serial.println(WiFi.subnetMask());
    
    wifiState = CONNECTED;
    #ifdef HAS_DISPLAY
    displayStatus("WiFi Connected", TFT_GREEN);
    #endif
    delay(1000);
  } else {
    Serial.println("\n✗ WiFi connection failed!");
    Serial.print("Final status code: ");
    Serial.println(WiFi.status());
    Serial.println("Possible issues:");
    Serial.println("  - Wrong SSID or password");
    Serial.println("  - Network not in range");
    Serial.println("  - Router not responding");
    wifiState = ERROR;
    #ifdef HAS_DISPLAY
    displayStatus("WiFi Failed!", TFT_RED);
    #endif
    delay(2000);
  }
}

void enterDeepSleep() {
  Serial.println("\n--- Entering Deep Sleep ---");
  
  // Disconnect WiFi to save power
  if (WiFi.status() == WL_CONNECTED) {
    WiFi.disconnect();
    Serial.println("WiFi disconnected");
  }
  
  // Turn off display if available
  #ifdef HAS_DISPLAY
  if (displayInitialized) {
    display.clearDisplay();
    display.display();
    Serial.println("Display turned off");
  }
  #endif
  
  Serial.print("Sleeping for ");
  Serial.print(DEEP_SLEEP_DURATION_US / 1000000);
  Serial.println(" seconds...");
  Serial.println("(Note: EN and IO16 pins must be connected for wake-up)");
  Serial.flush();  // Ensure all messages are sent before sleep
  
  // Enter deep sleep mode
  // WAKE_RFCAL: Wake with RF calibration (recommended for WiFi operation)
  ESP.deepSleep(DEEP_SLEEP_DURATION_US, WAKE_RFCAL);
  
  // This line should never be reached (device restarts after deep sleep)
  delay(1000);  // Safety delay (unreachable)
}

bool sendDataToServer(SensorData* readings, uint8_t count) {
  if (WiFi.status() != WL_CONNECTED) {
    return false;
  }
  
  if (count == 0) {
    Serial.println("No readings to send");
    return false;
  }
  
  BearSSL::WiFiClientSecure client;
  client.setInsecure();  // TODO: replace with certificate pinning for production security
  HTTPClient http;
  if (!http.begin(client, SERVER_URL)) {
    Serial.println("Failed to initialize HTTPS connection");
    return false;
  }
  http.addHeader("Content-Type", "application/json");
  
  // Create JSON array payload
  StaticJsonDocument<2560> doc;  // Increased from 256 to 2560 for array support
  JsonArray readingsArray = doc.to<JsonArray>();
  
  for (uint8_t i = 0; i < count; i++) {
    JsonObject readingObj = readingsArray.createNestedObject();
    readingObj["timestamp"] = readings[i].timestamp;
    readingObj["device_id"] = DEVICE_ID;
    readingObj["temperature"] = round(readings[i].temperature * 100) / 100.0;
    readingObj["humidity"] = round(readings[i].humidity * 100) / 100.0;
    readingObj["co2"] = readings[i].co2;
  }
  
  String jsonString;
  serializeJson(doc, jsonString);
  
  Serial.print("Sending bundle to server (");
  Serial.print(count);
  Serial.print(" readings): ");
  Serial.println(jsonString);
  
  // Send POST request
  int httpResponseCode = http.POST(jsonString);
  
  Serial.print("HTTP Response code: ");
  Serial.println(httpResponseCode);
  
  if (httpResponseCode > 0) {
    String response = http.getString();
    Serial.print("Response: ");
    Serial.println(response);
  } else {
    Serial.print("Error: ");
    if (httpResponseCode == -1) {
      Serial.println("Connection failed - is server running?");
    } else if (httpResponseCode == -11) {
      Serial.println("Timeout - check server address");
    } else {
      Serial.println(http.errorToString(httpResponseCode));
    }
  }
  
  http.end();
  
  bool success = (httpResponseCode == 200);
  
  if (success) {
    // Clear buffer on success
    bufferCount = 0;
    lastBundleTime = millis();
    Serial.println("✓ Bundle sent successfully, buffer cleared");
  } else {
    Serial.println("✗ Bundle transmission failed, buffer retained");
  }
  
  return success;
}

bool sendSingleReading(SensorData data) {
  if (WiFi.status() != WL_CONNECTED) {
    return false;
  }
  
  BearSSL::WiFiClientSecure client;
  client.setInsecure();  // TODO: replace with certificate pinning for production security
  HTTPClient http;
  if (!http.begin(client, SERVER_URL)) {
    Serial.println("Failed to initialize HTTPS connection");
    return false;
  }
  http.addHeader("Content-Type", "application/json");
  
  // Create JSON payload (single object, not array)
  StaticJsonDocument<256> doc;
  doc["timestamp"] = data.timestamp;
  doc["device_id"] = DEVICE_ID;
  doc["temperature"] = round(data.temperature * 100) / 100.0;
  doc["humidity"] = round(data.humidity * 100) / 100.0;
  doc["co2"] = data.co2;
  
  String jsonString;
  serializeJson(doc, jsonString);
  
  Serial.print("Sending to server: ");
  Serial.println(jsonString);
  
  // Send POST request
  int httpResponseCode = http.POST(jsonString);
  
  Serial.print("HTTP Response code: ");
  Serial.println(httpResponseCode);
  
  if (httpResponseCode > 0) {
    String response = http.getString();
    Serial.print("Response: ");
    Serial.println(response);
  } else {
    Serial.print("Error: ");
    if (httpResponseCode == -1) {
      Serial.println("Connection failed - is server running?");
    } else if (httpResponseCode == -11) {
      Serial.println("Timeout - check server address");
    } else {
      Serial.println(http.errorToString(httpResponseCode));
    }
  }
  
  http.end();
  
  return (httpResponseCode == 200);
}

bool isShutdownTime() {
  time_t now = time(nullptr);
  if (now < 0) {
    // Time not synced yet, don't shutdown
    return false;
  }
  
  struct tm* timeinfo = localtime(&now);
  if (!timeinfo) {
    return false;
  }
  
  int currentHour = timeinfo->tm_hour;
  int currentMinute = timeinfo->tm_min;
  
  // Calculate current time and shutdown/wake times in minutes from midnight
  int currentMinutes = currentHour * 60 + currentMinute;
  int shutdownMinutes = SHUTDOWN_HOUR * 60 + SHUTDOWN_MINUTE;
  int wakeMinutes = WAKE_HOUR * 60 + WAKE_MINUTE;
  
  // Check if we're in the shutdown period (between shutdown time and wake time next day)
  // If shutdown time is before wake time (e.g., 16:00 to 08:00 next day)
  if (shutdownMinutes > wakeMinutes) {
    // Shutdown time is later in day than wake time (e.g., 4pm to 8am next day)
    // We're in shutdown period if: current >= shutdown OR current < wake
    return (currentMinutes >= shutdownMinutes || currentMinutes < wakeMinutes);
  } else {
    // Shutdown time is before wake time (e.g., 8am to 4pm same day)
    // We're in shutdown period if: current >= shutdown AND current < wake
    return (currentMinutes >= shutdownMinutes && currentMinutes < wakeMinutes);
  }
}

unsigned long calculateSleepUntilWake() {
  time_t now = time(nullptr);
  if (now < 0) {
    // If time not synced, sleep for max duration (71 minutes) as fallback
    return 4294967295UL;  // Max deep sleep duration
  }
  
  struct tm* timeinfo = localtime(&now);
  if (!timeinfo) {
    return 4294967295UL;
  }
  
  // Calculate seconds until wake time
  int currentHour = timeinfo->tm_hour;
  int currentMinute = timeinfo->tm_min;
  int currentSecond = timeinfo->tm_sec;
  
  // Calculate seconds from midnight to current time
  unsigned long currentSeconds = currentHour * 3600UL + currentMinute * 60UL + currentSecond;
  
  // Calculate seconds from midnight to wake time
  unsigned long wakeSeconds = WAKE_HOUR * 3600UL + WAKE_MINUTE * 60UL;
  
  // Calculate seconds from midnight to shutdown time
  unsigned long shutdownSeconds = SHUTDOWN_HOUR * 3600UL + SHUTDOWN_MINUTE * 60UL;
  
  // Calculate sleep duration: seconds until wake time
  unsigned long sleepSeconds;
  
  if (shutdownSeconds > wakeSeconds) {
    // Shutdown time is later than wake time (e.g., 4pm to 8am next day)
    if (currentSeconds >= shutdownSeconds) {
      // We're past shutdown time, sleep until wake time next day
      sleepSeconds = (24UL * 3600UL) - currentSeconds + wakeSeconds;
    } else if (currentSeconds < wakeSeconds) {
      // We're before wake time (early morning), sleep until wake time today
      sleepSeconds = wakeSeconds - currentSeconds;
    } else {
      // We're between wake and shutdown (active period), shouldn't happen
      // But if it does, sleep for max duration
      sleepSeconds = 4260UL;  // 71 minutes
    }
  } else {
    // Shutdown time is before wake time (e.g., 8am to 4pm same day)
    // This means shutdown period is within same day
    if (currentSeconds >= shutdownSeconds) {
      // We're past shutdown, sleep until wake time next day
      sleepSeconds = (24UL * 3600UL) - currentSeconds + wakeSeconds;
    } else {
      // Shouldn't happen if isShutdownTime() is correct
      sleepSeconds = shutdownSeconds - currentSeconds;
    }
  }
  
  // Convert to microseconds
  unsigned long sleepMicroseconds = sleepSeconds * 1000000UL;
  
  // ESP8266 max deep sleep is 4294967295 microseconds (~71 minutes)
  // If sleep duration exceeds this, cap it at max
  // Device will wake up, check time again, and sleep again if needed
  if (sleepMicroseconds > 4294967295UL) {
    sleepMicroseconds = 4294967295UL;  // Max deep sleep duration (~71 minutes)
  }
  
  return sleepMicroseconds;
}
