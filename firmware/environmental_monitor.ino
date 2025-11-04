/*
 * IoT Environmental Monitoring System
 * ESP12S + SHT40 + SCD41 Sensors with LaskaKit μSup I2C Connectors
 * 
 * ESP12S I2C Pins:
 * - SDA: GPIO 4 (D2)
 * - SCL: GPIO 5 (D1)
 * 
 * With μSup Connectors (I2C):
 * - Both sensors connect to same I2C bus via μSup connectors
 * - Power: 3.3V from ESP12S
 * - No manual wiring needed - μSup handles connections!
 */

// Board selection - uncomment your board
#define BOARD_ESP12S       // ESP8266-based ESP12S
// #define BOARD_ESP32      // ESP32-based (LilyGo T-Display, etc.)

#ifdef BOARD_ESP12S
  // ESP8266 libraries
  #include <ESP8266WiFi.h>
  #include <ESP8266HTTPClient.h>
  #include <WiFiClient.h>
  #define I2C_SDA 4  // GPIO 4 (D2)
  #define I2C_SCL 5  // GPIO 5 (D1)
  #define HAS_DISPLAY false
#else
  // ESP32 libraries
  #include <WiFi.h>
  #include <HTTPClient.h>
  #include <TFT_eSPI.h>
  #define I2C_SDA 21
  #define I2C_SCL 22
  #define HAS_DISPLAY true
  TFT_eSPI tft = TFT_eSPI();
#endif

#include <Wire.h>
#include <ArduinoJson.h>
#include <Adafruit_SHT4x.h>
#include <SparkFun_SCD4x_Arduino_Library.h>
#include <time.h>

// ===== CONFIGURATION - MODIFY THESE =====
const char* WIFI_SSID = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
const char* SERVER_URL = "http://YOUR_PC_IP:5000/data";
const char* DEVICE_ID = "livingroom_01";

// NTP Configuration for time synchronization
const char* NTP_SERVER = "pool.ntp.org";
const long GMT_OFFSET_SEC = 0;  // Adjust for your timezone (e.g., -18000 for EST)
const int DAYLIGHT_OFFSET_SEC = 0;  // Adjust for daylight saving

// Reading interval in milliseconds (default: 60 seconds)
const unsigned long READING_INTERVAL = 60000;
// ========================================

// Hardware objects
Adafruit_SHT4x sht40;
SCD4x scd41;

// Data storage
struct SensorData {
  float temp_sht40;
  float humidity_sht40;
  float temp_scd41;
  float humidity_scd41;
  uint16_t co2;
  unsigned long timestamp;
  bool valid;
};

SensorData lastReading;
unsigned long lastReadingTime = 0;
bool sensorsInitialized = false;

// Connection status
enum ConnectionState {
  CONNECTING,
  CONNECTED,
  DISCONNECTED,
  ERROR
};

ConnectionState wifiState = CONNECTING;
ConnectionState serverState = DISCONNECTED;

void setup() {
  Serial.begin(115200);
  delay(1000);
  
  Serial.println("\n\n=================================");
  Serial.println("Environmental Monitoring System");
  Serial.println("=================================\n");
  
  #ifdef HAS_DISPLAY
  // Initialize display (ESP32 only)
  initDisplay();
  displayStatus("Initializing...", TFT_YELLOW);
  #endif
  
  // Initialize I2C with correct pins for ESP12S
  Wire.begin(I2C_SDA, I2C_SCL);
  Serial.print("I2C initialized on SDA=GPIO");
  Serial.print(I2C_SDA);
  Serial.print(", SCL=GPIO");
  Serial.println(I2C_SCL);
  
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
  tft.init();
  tft.setRotation(1);  // Landscape mode
  tft.fillScreen(TFT_BLACK);
  tft.setTextColor(TFT_WHITE, TFT_BLACK);
  tft.setTextSize(2);
  tft.setCursor(0, 0);
  tft.println("Environmental");
  tft.println("Monitor v1.0");
}

void displayStatus(const char* message, uint16_t color) {
  tft.fillRect(0, 60, 240, 30, TFT_BLACK);
  tft.setTextColor(color, TFT_BLACK);
  tft.setTextSize(2);
  tft.setCursor(10, 65);
  tft.println(message);
}

void displayReadings(SensorData data) {
  tft.fillScreen(TFT_BLACK);
  tft.setTextSize(1);
  
  // Header
  tft.setTextColor(TFT_CYAN, TFT_BLACK);
  tft.setCursor(0, 0);
  tft.println("Environmental Monitor");
  tft.setTextColor(TFT_WHITE, TFT_BLACK);
  
  // Timestamp
  char timeStr[30];
  time_t now = data.timestamp;
  struct tm* timeinfo = localtime(&now);
  strftime(timeStr, sizeof(timeStr), "%Y-%m-%d %H:%M:%S", timeinfo);
  tft.setCursor(0, 12);
  tft.print("Time: ");
  tft.println(timeStr);
  
  // Temperature (average of both sensors)
  float avgTemp = (data.temp_sht40 + data.temp_scd41) / 2.0;
  tft.setTextSize(2);
  tft.setTextColor(TFT_YELLOW, TFT_BLACK);
  tft.setCursor(0, 30);
  tft.print("Temp: ");
  tft.print(avgTemp, 1);
  tft.println(" C");
  
  // Humidity (average of both sensors)
  float avgHum = (data.humidity_sht40 + data.humidity_scd41) / 2.0;
  tft.setTextColor(TFT_CYAN, TFT_BLACK);
  tft.setCursor(0, 50);
  tft.print("Hum:  ");
  tft.print(avgHum, 1);
  tft.println(" %");
  
  // CO2 with color coding
  uint16_t co2Color = TFT_GREEN;
  if (data.co2 > 1000) co2Color = TFT_ORANGE;
  if (data.co2 > 1500) co2Color = TFT_RED;
  
  tft.setTextColor(co2Color, TFT_BLACK);
  tft.setCursor(0, 70);
  tft.print("CO2:  ");
  tft.print(data.co2);
  tft.println(" ppm");
  
  // Connection status
  tft.setTextSize(1);
  tft.setCursor(0, 100);
  tft.setTextColor(wifiState == CONNECTED ? TFT_GREEN : TFT_RED, TFT_BLACK);
  tft.print("WiFi: ");
  tft.println(wifiState == CONNECTED ? "OK" : "ERR");
  
  tft.setCursor(0, 110);
  tft.setTextColor(serverState == CONNECTED ? TFT_GREEN : TFT_RED, TFT_BLACK);
  tft.print("Server: ");
  tft.println(serverState == CONNECTED ? "OK" : "ERR");
}
#endif  // HAS_DISPLAY

void scanI2C() {
  Serial.println("\nScanning I2C bus...");
  int deviceCount = 0;
  
  for (byte addr = 1; addr < 127; addr++) {
    Wire.beginTransmission(addr);
    byte error = Wire.endTransmission();
    
    if (error == 0) {
      Serial.print("I2C device found at address 0x");
      if (addr < 16) Serial.print("0");
      Serial.print(addr, HEX);
      Serial.println();
      deviceCount++;
    }
  }
  
  if (deviceCount == 0) {
    Serial.println("No I2C devices found!");
  } else {
    Serial.print("Found ");
    Serial.print(deviceCount);
    Serial.println(" I2C device(s)");
  }
  Serial.println();
}

bool initSensors() {
  Serial.println("Initializing sensors...");
  bool success = true;
  
  // Initialize SHT40
  Serial.print("SHT40: ");
  if (sht40.begin()) {
    Serial.println("✓ OK");
    sht40.setPrecision(SHT4X_HIGH_PRECISION);
    sht40.setHeater(SHT4X_NO_HEATER);
  } else {
    Serial.println("✗ FAILED");
    success = false;
  }
  
  // Initialize SCD41
  Serial.print("SCD41: ");
  if (scd41.begin()) {
    Serial.println("✓ OK");
    
    // Stop any ongoing measurement
    scd41.stopPeriodicMeasurement();
    delay(500);
    
    // Optional: Set altitude for better accuracy (meters above sea level)
    // scd41.setSensorAltitude(100);
    
    // Start periodic measurements
    if (scd41.startPeriodicMeasurement()) {
      Serial.println("SCD41: Periodic measurement started");
      Serial.println("SCD41: Warming up (60 seconds)...");
      // First reading takes ~60 seconds to stabilize
    } else {
      Serial.println("SCD41: Failed to start measurements");
      success = false;
    }
  } else {
    Serial.println("✗ FAILED");
    success = false;
  }
  
  return success;
}

SensorData readSensors() {
  SensorData data;
  data.valid = false;
  data.timestamp = time(nullptr);
  
  // Read SHT40
  sensors_event_t humidity, temp;
  if (sht40.getEvent(&humidity, &temp)) {
    data.temp_sht40 = temp.temperature;
    data.humidity_sht40 = humidity.relative_humidity;
    
    Serial.print("SHT40 - Temp: ");
    Serial.print(data.temp_sht40, 2);
    Serial.print("°C, Humidity: ");
    Serial.print(data.humidity_sht40, 2);
    Serial.println("%");
  } else {
    Serial.println("SHT40: Read failed");
    return data;
  }
  
  // Read SCD41
  if (scd41.readMeasurement()) {
    data.co2 = scd41.getCO2();
    data.temp_scd41 = scd41.getTemperature();
    data.humidity_scd41 = scd41.getHumidity();
    
    Serial.print("SCD41 - CO2: ");
    Serial.print(data.co2);
    Serial.print(" ppm, Temp: ");
    Serial.print(data.temp_scd41, 2);
    Serial.print("°C, Humidity: ");
    Serial.print(data.humidity_scd41, 2);
    Serial.println("%");
    
    // Validate readings
    if (data.co2 >= 400 && data.co2 <= 5000 &&
        data.temp_scd41 >= -10 && data.temp_scd41 <= 50 &&
        data.humidity_scd41 >= 0 && data.humidity_scd41 <= 100) {
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
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  
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
  
  #ifdef BOARD_ESP12S
  WiFiClient client;
  HTTPClient http;
  http.begin(client, SERVER_URL);
  #else
  HTTPClient http;
  http.begin(SERVER_URL);
  #endif
  http.addHeader("Content-Type", "application/json");
  
  // Create JSON payload
  StaticJsonDocument<256> doc;
  doc["timestamp"] = data.timestamp;
  doc["device_id"] = DEVICE_ID;
  doc["temp_sht40"] = round(data.temp_sht40 * 100) / 100.0;
  doc["humidity_sht40"] = round(data.humidity_sht40 * 100) / 100.0;
  doc["temp_scd41"] = round(data.temp_scd41 * 100) / 100.0;
  doc["humidity_scd41"] = round(data.humidity_scd41 * 100) / 100.0;
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
  }
  
  http.end();
  
  return (httpResponseCode == 200);
}
