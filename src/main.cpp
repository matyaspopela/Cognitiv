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
#include <WiFiClient.h>
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

// LED Configuration
const unsigned long LED_BLINK_INTERVAL = 3000;  // Blink every  3 seconds

// Hardware objects
SCD4x scd41;

// Data storage
struct SensorData {
  float temperature;
  float humidity;
  uint16_t co2;
  float voltage;  // Battery/board voltage in Volts (from ADC via voltage divider)
  unsigned long timestamp;
  bool valid;
};

unsigned long lastReadingTime = 0;
bool sensorsInitialized = false;

// LED blinking state
unsigned long lastLedToggleTime = 0;
bool ledState = false;
uint16_t lastCo2Reading = 0;

// Global MAC address cache (extracted after WiFi initialization)
String deviceMacAddress = "";

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
float readVoltage();
void connectWiFi();
bool sendSingleReading(SensorData data);
bool sendJsonToUrl(const char* url, const String& jsonPayload);

void setup() {
  Serial.begin(115200);
  delay(1000);
  
  Serial.println("\n\n=================================");
  Serial.println("Environmental Monitoring System");
  Serial.println("=================================\n");
  
  // Initialize LED pin (GPIO4 needs inverted logic due to pull-up)
  pinMode(RED_LED_PIN, OUTPUT);
  digitalWrite(RED_LED_PIN, HIGH);  // HIGH = LED off (inverted)
  Serial.print("LED on GPIO");
  Serial.print(RED_LED_PIN);
  Serial.println(" - Testing with 3 blinks...");
  
  // Test blink 3 times to verify LED works
  for (int i = 0; i < 3; i++) {
    digitalWrite(RED_LED_PIN, LOW);   // LOW = LED on (inverted)
    delay(200);
    digitalWrite(RED_LED_PIN, HIGH);  // HIGH = LED off (inverted)
    delay(200);
  }
  Serial.println("LED test complete");
  digitalWrite(RED_LED_PIN, HIGH);  // Ensure LED is off after test
  
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
  
  // Connect to WiFi
  connectWiFi();
  
  // Extract and cache MAC address after WiFi connection
  if (WiFi.status() == WL_CONNECTED) {
    deviceMacAddress = WiFi.macAddress();
    Serial.print("Device MAC Address: ");
    Serial.println(deviceMacAddress);
  } else {
    Serial.println("⚠️  WiFi not connected, MAC address not available");
  }
  
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
      // Update CO2 for LED control
      lastCo2Reading = reading.co2;
      
      #ifdef HAS_DISPLAY
      displayReadings(reading);
      #endif
      
      // Send each reading immediately
      if (wifiState == CONNECTED) {
        if (sendSingleReading(reading)) {
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
  
  // LED control: blink if CO2 >= 2000, otherwise OFF
  // Note: GPIO4 uses inverted logic (LOW=on, HIGH=off) due to pull-up
  if (lastCo2Reading >= WARNING_CO2_THRESHOLD) {
    // CO2 HIGH - blink every 5 seconds
    if (millis() - lastLedToggleTime >= LED_BLINK_INTERVAL) {
      lastLedToggleTime = millis();
      ledState = !ledState;
      digitalWrite(RED_LED_PIN, ledState ? LOW : HIGH);  // LOW=on, HIGH=off
    }
  } else {
    // CO2 SAFE - LED OFF
    ledState = false;
    digitalWrite(RED_LED_PIN, HIGH);  // HIGH = LED off
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
  
  // Read voltage (always read, independent of sensor validity)
  data.voltage = readVoltage();
  Serial.print("Voltage: ");
  Serial.print(data.voltage, 2);
  Serial.println(" V");
  
  // Validate voltage range (warn if out of expected range, but don't block)
  if (data.voltage < 2.5 || data.voltage > 5.5) {
    Serial.print("WARNING: Voltage out of expected range: ");
    Serial.print(data.voltage, 2);
    Serial.println(" V");
  }
  
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

float readVoltage() {
  // Read ADC value (0-1023)
  int adcValue = analogRead(A0);
  
  // Convert to voltage at ADC pin (0-1V range)
  float adcVoltage = (adcValue / 1023.0) * 1.0;
  
  // Convert to actual battery voltage using divider ratio
  float batteryVoltage = adcVoltage * VOLTAGE_DIVIDER_RATIO;
  
  return batteryVoltage;
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


// Helper function to send JSON to any URL (HTTP or HTTPS)
bool sendJsonToUrl(const char* url, const String& jsonPayload) {
  if (WiFi.status() != WL_CONNECTED) {
    return false;
  }
  
  HTTPClient http;
  bool isHttps = (strncmp(url, "https://", 8) == 0);
  
  if (isHttps) {
    BearSSL::WiFiClientSecure client;
    client.setInsecure();  // TODO: replace with certificate pinning for production security
    if (!http.begin(client, url)) {
      Serial.print("Failed to initialize HTTPS connection to: ");
      Serial.println(url);
      return false;
    }
  } else {
    WiFiClient client;
    if (!http.begin(client, url)) {
      Serial.print("Failed to initialize HTTP connection to: ");
      Serial.println(url);
      return false;
    }
  }
  
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(10000);  // 10 second timeout
  
  Serial.print("Sending to: ");
  Serial.println(url);
  
  // Send POST request
  int httpResponseCode = http.POST(jsonPayload);
  
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


bool sendSingleReading(SensorData data) {
  if (WiFi.status() != WL_CONNECTED) {
    return false;
  }
  
  // Create JSON payload (single object, not array)
  StaticJsonDocument<300> doc;  // Increased from 256 to accommodate voltage field
  doc["timestamp"] = data.timestamp;
  doc["device_id"] = DEVICE_ID;  // Keep for backward compatibility
  
  // Add MAC address if available
  if (deviceMacAddress.length() > 0) {
    doc["mac_address"] = deviceMacAddress;
  }
  
  doc["temperature"] = round(data.temperature * 100) / 100.0;
  doc["humidity"] = round(data.humidity * 100) / 100.0;
  doc["co2"] = data.co2;
  doc["voltage"] = round(data.voltage * 100) / 100.0;  // Voltage in Volts, 2 decimal places
  
  String jsonString;
  serializeJson(doc, jsonString);
  
  Serial.print("Sending reading: ");
  Serial.println(jsonString);
  
  // Send to production server
  bool prodSuccess = sendJsonToUrl(SERVER_URL, jsonString);
  
  // Send to local debug server if enabled
  #if ENABLE_LOCAL_DEBUG
  bool localSuccess = sendJsonToUrl(LOCAL_SERVER_URL, jsonString);
  bool success = prodSuccess || localSuccess;  // Success if at least one works
  #else
  bool success = prodSuccess;
  #endif
  
  if (success) {
    Serial.println("✓ Reading sent successfully");
  } else {
    Serial.println("✗ Failed to send reading");
  }
  
  return success;
}

