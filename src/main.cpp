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

// ESP8266 libraries (LaskaKit AirBoard 8266)
#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClientSecureBearSSL.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#ifdef WIFI_ENTERPRISE_ENABLED
extern "C" {
  #include "user_interface.h"
  #include "wpa2_enterprise.h"
}
#endif
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

// ===== CONFIGURATION =====
// Create include/config.h from include/config_template.h with your WiFi credentials
#include "config.h"

// Apply configuration
const char* NTP_SERVER = "pool.ntp.org";
const unsigned long READING_INTERVAL = READING_INTERVAL_MS;
const uint16_t WARNING_CO2_THRESHOLD = 1500;
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
bool sendDataToServer(SensorData data);

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
    // Continue anyway to attempt WiFi connection
  }
  
  // Connect to WiFi
  connectWiFi();
  
  // Initialize time
  configTime(GMT_OFFSET_SEC, DAYLIGHT_OFFSET_SEC, NTP_SERVER);
  Serial.println("Waiting for NTP time sync...");
  delay(2000);
  
  Serial.println("\nSetup complete!\n");
}

void loop() {
  // Check WiFi connection
  if (WiFi.status() != WL_CONNECTED) {
    wifiState = DISCONNECTED;
    #ifdef HAS_DISPLAY
    displayStatus("WiFi Lost!", TFT_RED);
    #endif
    connectWiFi();
  } else {
    wifiState = CONNECTED;
  }
  
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
      if (wifiState == CONNECTED) {
        if (sendDataToServer(reading)) {
          serverState = CONNECTED;
          Serial.println("✓ Data sent successfully");
        } else {
          serverState = ERROR;
          Serial.println("✗ Failed to send data");
        }
      }
    } else {
      Serial.println("✗ Invalid sensor reading");
      #ifdef HAS_DISPLAY
      displayStatus("Sensor Error!", TFT_RED);
      #endif
    }
  }
  
  delay(100);
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
  display.println("Vyvetrejte okna.");

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

void connectWiFi() {
  Serial.print("Connecting to WiFi: ");
  Serial.println(WIFI_SSID);
  
  #ifdef HAS_DISPLAY
  displayStatus("WiFi Connecting", TFT_YELLOW);
  #endif
  
  WiFi.mode(WIFI_STA);
  
  #ifdef WIFI_ENTERPRISE_ENABLED
    // WPA2 Enterprise (username + password)
    Serial.println("Using WPA2 Enterprise authentication");
    wifi_station_set_wpa2_enterprise_auth(1);
    wifi_station_set_enterprise_identity((uint8*)WIFI_IDENTITY, strlen(WIFI_IDENTITY));
    wifi_station_set_enterprise_username((uint8*)WIFI_IDENTITY, strlen(WIFI_IDENTITY));
    wifi_station_set_enterprise_password((uint8*)WIFI_EAP_PASSWORD, strlen(WIFI_EAP_PASSWORD));
    WiFi.begin(WIFI_SSID);
  #else
    // Standard WPA/WPA2 Personal (password only)
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  #endif
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n✓ WiFi connected!");
    Serial.print("IP address: ");
    Serial.println(WiFi.localIP());
    Serial.print("Signal strength: ");
    Serial.print(WiFi.RSSI());
    Serial.println(" dBm");
    
    wifiState = CONNECTED;
    #ifdef HAS_DISPLAY
    displayStatus("WiFi Connected", TFT_GREEN);
    #endif
    delay(1000);
  } else {
    Serial.println("\n✗ WiFi connection failed!");
    wifiState = ERROR;
    #ifdef HAS_DISPLAY
    displayStatus("WiFi Failed!", TFT_RED);
    #endif
    delay(2000);
  }
}

bool sendDataToServer(SensorData data) {
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
  
  // Create JSON payload
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
      Serial.println("Connection failed - is Flask server running at " + String(SERVER_URL) + "?");
    } else if (httpResponseCode == -11) {
      Serial.println("Timeout - check server IP address");
    } else {
      Serial.println(http.errorToString(httpResponseCode));
    }
  }
  
  http.end();
  
  return (httpResponseCode == 200);
}
