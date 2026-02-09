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
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <ESP8266WiFi.h>
#include <PubSubClient.h>
#include <WiFiClientSecure.h>
// LaskaKit AirBoard 8266 specific I2C pins for μSup connectors
#define I2C_SDA 0 // GPIO 0 (D3) - connected to μSup connectors
#define I2C_SCL 2 // GPIO 2 (D4) - connected to μSup connectors
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
#include <Ticker.h> // Hardware timer for non-blocking LED control
#include <time.h>

// Apply configuration
const char *NTP_SERVER = "pool.ntp.org";
const unsigned long READING_INTERVAL = READING_INTERVAL_MS;

// Ticker for hardware-timed LED blinking (runs in interrupt, independent of
// main loop)
Ticker ledTicker;

// Hardware objects
SCD4x scd41;

// Data storage
struct SensorData {
  float temperature;
  float humidity;
  uint16_t co2;
  float
      voltage; // Battery/board voltage in Volts (from ADC via voltage divider)
  unsigned long timestamp;
  bool valid;
};

unsigned long lastReadingTime = 0;
bool sensorsInitialized = false;

// LED blinking state (hardware timer control)
volatile bool ledOn = false; // volatile because modified in ISR
uint16_t lastCo2Reading = 0;
bool ledBlinkingActive = false; // Track if ticker is running

// Global MAC address cache (extracted after WiFi initialization)
String deviceMacAddress = "";

#ifdef HAS_DISPLAY
bool displayInitialized = false;
#endif

// Connection status
enum ConnectionState { CONNECTING, CONNECTED, DISCONNECTED, ERROR };

ConnectionState wifiState = CONNECTING;
ConnectionState serverState = DISCONNECTED;

// MQTT client objects
WiFiClientSecure mqttSecureClient;
PubSubClient mqttClient(mqttSecureClient);
ConnectionState mqttState = DISCONNECTED;

// Forward declarations
#ifdef HAS_DISPLAY
void initDisplay();
void displayStatus(const char *message, uint16_t color);
void displayReadings(SensorData data);
void displayWarningScreen(SensorData data);
#endif
void scanI2C();
bool initSensors();
SensorData readSensors();
float readVoltage();
void connectWiFi();
bool sendSingleReading(SensorData data);
bool connectMQTT();
bool reconnectMQTT();
bool sendJsonToMQTT(const String &jsonPayload);
// bool sendJsonToUrl(const char* url, const String& jsonPayload);  //
// DEPRECATED: Replaced by MQTT
void toggleLedISR();  // Interrupt Service Routine for LED
void updateLedMode(); // Check CO2 and start/stop blinking

// Quiet hours (sleep schedule) functions
#if QUIET_HOURS_ENABLED
bool isInQuietHours();
void enterQuietHoursSleep();
void checkQuietHours();
#endif

void setup() {
  Serial.begin(115200);
  delay(100); // reduced delay

  Serial.println("\n\n=================================");
  Serial.println("Environmental Monitoring System");
  Serial.println("=================================\n");

  // Initialize LED pin
  pinMode(RED_LED_PIN, OUTPUT);
  digitalWrite(RED_LED_PIN, HIGH); // HIGH = LED off (inverted)

  // Initialize I2C
  Wire.begin(I2C_SDA, I2C_SCL);

#ifdef HAS_DISPLAY
  initDisplay();
  displayStatus("Waking Up...", TFT_YELLOW);
#endif

  // Connect to WiFi immediately (parallel with sensor init if possible, but
  // sequential here)
  connectWiFi();

  // Initialize sensors
  if (initSensors()) {
    sensorsInitialized = true;
  } else {
    Serial.println("ERROR: Sensor initialization failed!");
#ifdef HAS_DISPLAY
    displayStatus("Sensor Error!", TFT_RED);
#endif
  }

  // --- OPERATION: Single Shot Reading ---

  if (sensorsInitialized) {
    // Wait for measurement to be ready (if we just started it in init, it might
    // take 5s) For now, we rely on the loop within readSensors or the delay in
    // init. Optimization: initSensors() currently restarts measurement, taking
    // 5s. Ideally we would just read if it's already running.

    Serial.println("--- Single Shot Reading ---");
    // Ensure we have a valid reading before proceeding if possible, or wait a
    // bit But readSensors() calls readMeasurement() which is non-blocking on
    // the library usually check .getDataReadyStatus() The SparkFun library's
    // readMeasurement is a polling wrapper or single check? Note: Library usage
    // in readSensors checks readMeasurement() once. We might need a small
    // blocking wait loop here to ensure we get data if it's fresh.

    SensorData reading;
    bool readingSuccess = false;

    // Try to get a valid reading for up to 6 seconds (SCD41 period is 5s)
    unsigned long startWait = millis();
    while (millis() - startWait < 6000) {
      reading = readSensors();
      if (reading.valid) {
        readingSuccess = true;
        break;
      }
      delay(500);
    }

    if (readingSuccess) {
      lastReadingTime = millis();
#ifdef HAS_DISPLAY
      displayReadings(reading);
#endif

      // Update Global CO2 for decision making
      lastCo2Reading = reading.co2;

      // Send to MQTT
      if (wifiState == CONNECTED) {
        // Ensure MQTT is connected
        if (!mqttClient.connected()) {
          connectMQTT();
        }
        if (sendSingleReading(reading)) {
          Serial.println("✓ Data sent successfully");
        } else {
          Serial.println("✗ Failed to send data");
        }
      }

      // Always proceed to deep sleep (warning mode disabled)
      Serial.println("Data sent. Proceeding to deep sleep...");

    } else {
      Serial.println("✗ Could not get valid reading in time.");
#ifdef HAS_DISPLAY
      displayStatus("Read Error", TFT_RED);
#endif
    }
  }

// --- SAFE / NORMAL MODE: Deep Sleep ---

// Check Quiet Hours (Optional, logic inside handles sleep if needed)
#if QUIET_HOURS_ENABLED
  Serial.println("Checking quiet hours...");
  checkQuietHours(); // Might sleep longer if in quiet hours
#endif

  Serial.println("Going to Deep Sleep for 30 seconds...");
#ifdef HAS_DISPLAY
  displayStatus("Sleeping...", TFT_BLACK); // or clear
#endif

  // Ensure everything is sent
  delay(100);

  // DEEP SLEEP
  // ESP.deepSleep(microseconds)
  // 30 seconds = 30 * 1,000,000
  ESP.deepSleep(30e6);
}

void loop() {
  // ==========================================
  // WARNING MODE HANDLER
  // Code reaches here ONLY if CO2 >= WARNING
  // ==========================================

  // 1. Maintenance
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
  }
  if (!mqttClient.connected()) {
    reconnectMQTT();
  } else {
    mqttClient.loop();
  }

  // 2. Timer Check
  if (millis() - lastReadingTime >= READING_INTERVAL) {
    lastReadingTime = millis();

    Serial.println("\n--- Warning Mode Reading ---");
    SensorData reading = readSensors();

    if (reading.valid) {
      lastCo2Reading = reading.co2;

#ifdef HAS_DISPLAY
      displayReadings(reading);
#endif

      // Send Data
      if (WiFi.status() == WL_CONNECTED) {
        sendSingleReading(reading);
      }

      // 3. Re-evaluate Condition
      if (reading.co2 < WARNING_CO2_THRESHOLD) {
        Serial.println("CO2 levels normalized. Exiting Warning Mode.");
        updateLedMode(); // Will turn off LED

        Serial.println("Going to Deep Sleep...");
        delay(100);
        ESP.deepSleep(30e6);
      } else {
        Serial.println("CO2 still high. Staying active.");
        updateLedMode(); // Ensure LED ticker is active
      }

    } else {
      Serial.println("Invalid Reading in Warning Mode");
    }
  }

  delay(10); // Small delay for stability
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

void displayStatus(const char *message, uint16_t color) {
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
#endif // HAS_DISPLAY

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
      if (addr < 16)
        Serial.print("0");
      Serial.print(addr, HEX);

      // Identify known devices
      if (addr == 0x62)
        Serial.print(" (SCD41)");
      else if (addr == 0x3C)
        Serial.print(" (Display)");

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
    if (data.co2 >= 400 && data.co2 <= 5000 && data.temperature >= -10 &&
        data.temperature <= 50 && data.humidity >= 0 && data.humidity <= 100) {
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

    // Extract and cache MAC address
    deviceMacAddress = WiFi.macAddress();
    Serial.print("Device MAC Address: ");
    Serial.println(deviceMacAddress);

    wifiState = CONNECTED;
#ifdef HAS_DISPLAY
    displayStatus("WiFi Connected", TFT_GREEN);
#endif

    // Initialize MQTT client (safe to call multiple times)
    mqttClient.setServer(MQTT_BROKER_HOST, MQTT_BROKER_PORT);
    mqttSecureClient.setInsecure(); // TODO: replace with certificate validation
                                    // for production

    // Attempt MQTT connection
    reconnectMQTT();

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

// ISR (Interrupt Service Routine) - called by hardware timer
// Runs independently of main loop, even during HTTP requests
void IRAM_ATTR toggleLedISR() {
  ledOn = !ledOn;
  digitalWrite(RED_LED_PIN,
               ledOn ? LOW : HIGH); // LOW=on, HIGH=off (inverted logic)
}

// Check CO2 level and start/stop the hardware timer for LED blinking
void updateLedMode() {
  if (lastCo2Reading >= WARNING_CO2_THRESHOLD) {
    // CO2 HIGH - start blinking if not already
    if (!ledBlinkingActive) {
      ledBlinkingActive = true;
      ledTicker.attach(LED_WARNING_INTERVAL_SEC, toggleLedISR);
      Serial.println("LED: Warning mode - blinking started");
    }
  } else {
    // CO2 SAFE - stop blinking and turn off LED
    if (ledBlinkingActive) {
      ledBlinkingActive = false;
      ledTicker.detach();
      ledOn = false;
      digitalWrite(RED_LED_PIN, HIGH); // HIGH = LED off
      Serial.println("LED: Safe mode - LED off");
    }
  }
}

// MQTT connection function
bool connectMQTT() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("MQTT: WiFi not connected");
    return false;
  }

  Serial.print("MQTT: Connecting to broker ");
  Serial.print(MQTT_BROKER_HOST);
  Serial.print(":");
  Serial.println(MQTT_BROKER_PORT);

  // Generate unique client ID from MAC address
  String clientId = "ESP8266_";
  if (deviceMacAddress.length() > 0) {
    clientId += deviceMacAddress;
    clientId.replace(":", "");
  } else {
    clientId += String(random(0xffff), HEX);
  }

  if (mqttClient.connect(clientId.c_str(), MQTT_USERNAME, MQTT_PASSWORD)) {
    Serial.println("✓ MQTT connected!");
    mqttState = CONNECTED;
    return true;
  } else {
    Serial.print("✗ MQTT connection failed, rc=");
    Serial.print(mqttClient.state());
    Serial.println(" (see PubSubClient.h for error codes)");
    mqttState = ERROR;
    return false;
  }
}

// MQTT reconnection function with retry logic
bool reconnectMQTT() {
  if (WiFi.status() != WL_CONNECTED) {
    return false;
  }

  int maxAttempts = 3;
  int attempts = 0;

  while (!mqttClient.connected() && attempts < maxAttempts) {
    attempts++;
    Serial.print("MQTT: Reconnection attempt ");
    Serial.print(attempts);
    Serial.print("/");
    Serial.println(maxAttempts);

    if (connectMQTT()) {
      return true;
    }

    if (attempts < maxAttempts) {
      delay(2000); // Wait before retry
    }
  }

  return false;
}

// Send JSON payload to MQTT topic
bool sendJsonToMQTT(const String &jsonPayload) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("MQTT: WiFi not connected");
    return false;
  }

  // Ensure MQTT is connected
  if (!mqttClient.connected()) {
    Serial.println("MQTT: Not connected, attempting reconnection...");
    if (!reconnectMQTT()) {
      Serial.println("MQTT: Reconnection failed");
      return false;
    }
  }

  // Publish to MQTT topic
  Serial.print("MQTT: Publishing to topic ");
  Serial.print(MQTT_TOPIC);
  Serial.print(": ");
  Serial.println(jsonPayload);

  bool success = mqttClient.publish(MQTT_TOPIC, jsonPayload.c_str());

  if (success) {
    Serial.println("✓ MQTT publish successful");
    mqttState = CONNECTED;
    return true;
  } else {
    Serial.println("✗ MQTT publish failed");
    mqttState = ERROR;
    // Try reconnecting and retry once
    if (reconnectMQTT()) {
      success = mqttClient.publish(MQTT_TOPIC, jsonPayload.c_str());
      if (success) {
        Serial.println("✓ MQTT publish successful after reconnection");
        mqttState = CONNECTED;
        return true;
      }
    }
    return false;
  }
}

// Helper function to send JSON to any URL (HTTP or HTTPS) - DEPRECATED:
// Replaced by MQTT
/*
bool sendJsonToUrl(const char* url, const String& jsonPayload) {
  if (WiFi.status() != WL_CONNECTED) {
    return false;
  }

  HTTPClient http;
  bool isHttps = (strncmp(url, "https://", 8) == 0);

  if (isHttps) {
    BearSSL::WiFiClientSecure client;
    client.setInsecure();  // TODO: replace with certificate pinning for
production security if (!http.begin(client, url)) { Serial.print("Failed to
initialize HTTPS connection to: "); Serial.println(url); return false;
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
*/

bool sendSingleReading(SensorData data) {
  if (WiFi.status() != WL_CONNECTED) {
    return false;
  }

  // Create JSON payload (single object, not array)
  StaticJsonDocument<300>
      doc; // Increased from 256 to accommodate voltage field
  doc["timestamp"] = data.timestamp;

  // Add MAC address (primary identifier)
  if (deviceMacAddress.length() > 0) {
    doc["mac_address"] = deviceMacAddress;
  } else {
    // Fallback: read MAC directly if cache is empty
    doc["mac_address"] = WiFi.macAddress();
  }

  doc["temperature"] = round(data.temperature * 100) / 100.0;
  doc["humidity"] = round(data.humidity * 100) / 100.0;
  doc["co2"] = data.co2;
  doc["voltage"] =
      round(data.voltage * 100) / 100.0; // Voltage in Volts, 2 decimal places

  String jsonString;
  serializeJson(doc, jsonString);

  Serial.print("Sending reading: ");
  Serial.println(jsonString);

  // Send to MQTT broker
  bool success = sendJsonToMQTT(jsonString);

  if (success) {
    Serial.println("✓ Reading sent successfully");
  } else {
    Serial.println("✗ Failed to send reading");
  }

  return success;
}

// ===== QUIET HOURS (Sleep Schedule) Implementation =====
#if QUIET_HOURS_ENABLED

/**
 * Check if current time is within sleep hours
 * Sleep period: GOTOSLEEP_TIME_HOUR:GOTOSLEEP_TIME_MIN to
 * WAKEUP_TIME_HOUR:WAKEUP_TIME_MIN Default: 16:00 (4 PM) to 08:00 (8 AM)
 *
 * Returns true if should sleep, false otherwise
 */
bool isInQuietHours() {
  time_t now = time(nullptr);

  // Check if time is valid (NTP synced)
  if (now < 1000000000) { // Before ~2001, time not synced
    Serial.println("⚠️  Time not synced, cannot check sleep schedule");
    return false;
  }

  struct tm *timeinfo = localtime(&now);
  int currentHour = timeinfo->tm_hour;
  int currentMin = timeinfo->tm_min;

  // Convert times to minutes since midnight for easier comparison
  int currentTimeMinutes = currentHour * 60 + currentMin;
  int gotoSleepTimeMinutes = GOTOSLEEP_TIME_HOUR * 60 + GOTOSLEEP_TIME_MIN;
  int wakeupTimeMinutes = WAKEUP_TIME_HOUR * 60 + WAKEUP_TIME_MIN;

  Serial.print("Current time: ");
  Serial.print(currentHour);
  Serial.print(":");
  if (currentMin < 10)
    Serial.print("0");
  Serial.println(currentMin);

  Serial.print("Sleep schedule: ");
  Serial.print(GOTOSLEEP_TIME_HOUR);
  Serial.print(":");
  if (GOTOSLEEP_TIME_MIN < 10)
    Serial.print("0");
  Serial.print(GOTOSLEEP_TIME_MIN);
  Serial.print(" to ");
  Serial.print(WAKEUP_TIME_HOUR);
  Serial.print(":");
  if (WAKEUP_TIME_MIN < 10)
    Serial.print("0");
  Serial.print(WAKEUP_TIME_MIN);
  Serial.print(" (");
  Serial.print(currentTimeMinutes);
  Serial.print(" min, sleep: ");
  Serial.print(gotoSleepTimeMinutes);
  Serial.print(" min, wake: ");
  Serial.print(wakeupTimeMinutes);
  Serial.println(" min)");

  // Handle overnight sleep period (e.g., 16:00 to 08:00)
  bool inQuietHours;
  if (gotoSleepTimeMinutes > wakeupTimeMinutes) {
    // Overnight: sleep if after gotosleep_time OR before wakeup_time
    inQuietHours = (currentTimeMinutes >= gotoSleepTimeMinutes) ||
                   (currentTimeMinutes < wakeupTimeMinutes);
    Serial.print("Overnight period: ");
    if (inQuietHours) {
      Serial.println("IN sleep period (after sleep start OR before wake time)");
    } else {
      Serial.println(
          "OUTSIDE sleep period (between wake time and sleep start)");
    }
  } else {
    // Same day: sleep if between gotosleep_time and wakeup_time
    inQuietHours = (currentTimeMinutes >= gotoSleepTimeMinutes) &&
                   (currentTimeMinutes < wakeupTimeMinutes);
    Serial.print("Same-day period: ");
    if (inQuietHours) {
      Serial.println("IN sleep period (between sleep start and wake time)");
    } else {
      if (currentTimeMinutes < gotoSleepTimeMinutes) {
        Serial.println("OUTSIDE sleep period (before sleep start)");
      } else {
        Serial.println("OUTSIDE sleep period (after wake time)");
      }
    }
  }

  if (inQuietHours) {
    Serial.print("📴 In sleep period (");
    Serial.print(GOTOSLEEP_TIME_HOUR);
    Serial.print(":");
    if (GOTOSLEEP_TIME_MIN < 10)
      Serial.print("0");
    Serial.print(GOTOSLEEP_TIME_MIN);
    Serial.print(" - ");
    Serial.print(WAKEUP_TIME_HOUR);
    Serial.print(":");
    if (WAKEUP_TIME_MIN < 10)
      Serial.print("0");
    Serial.print(WAKEUP_TIME_MIN);
    Serial.print(") -> inQuietHours=");
    Serial.println(inQuietHours ? "true" : "false");
  } else {
    Serial.print("✓ Outside sleep period - inQuietHours=");
    Serial.println(inQuietHours ? "true" : "false");
  }

  return inQuietHours;
}

/**
 * Enter deep sleep mode during sleep schedule
 * The ESP8266 will turn off WiFi, CPU, sensors - only RTC remains active
 * Adapts sleep duration: if time remaining until wakeup_time is less than 30
 * minutes, uses that remaining time instead of the default 30-minute duration
 * Sleep period: GOTOSLEEP_TIME_HOUR:GOTOSLEEP_TIME_MIN to
 * WAKEUP_TIME_HOUR:WAKEUP_TIME_MIN
 *
 * IMPORTANT: GPIO16 (D0) must be connected to RST for wake-up to work!
 */
void enterQuietHoursSleep() {
  // Calculate time remaining until wakeup_time
  unsigned long sleepDurationUs =
      QUIET_HOURS_SLEEP_DURATION_US; // Default: 30 minutes
  time_t now = time(nullptr);

  if (now >= 1000000000) { // Time is synced
    struct tm *timeinfo = localtime(&now);
    int currentHour = timeinfo->tm_hour;
    int currentMin = timeinfo->tm_min;

    // Convert to minutes since midnight
    int currentTimeMinutes = currentHour * 60 + currentMin;
    int wakeupTimeMinutes = WAKEUP_TIME_HOUR * 60 + WAKEUP_TIME_MIN;
    int gotoSleepTimeMinutes = GOTOSLEEP_TIME_HOUR * 60 + GOTOSLEEP_TIME_MIN;

    // Calculate minutes until wakeup_time
    int minutesUntilWakeup;
    if (gotoSleepTimeMinutes > wakeupTimeMinutes) {
      // Overnight period (e.g., 16:00 to 08:00)
      if (currentTimeMinutes >= gotoSleepTimeMinutes) {
        // After gotosleep_time today (e.g., 17:00), wakeup is tomorrow at
        // wakeup_time
        minutesUntilWakeup = (24 * 60 - currentTimeMinutes) + wakeupTimeMinutes;
      } else {
        // Before wakeup_time today (e.g., 07:00), wakeup is today at
        // wakeup_time
        minutesUntilWakeup = wakeupTimeMinutes - currentTimeMinutes;
      }
    } else {
      // Same day period (e.g., 08:00 to 16:00)
      minutesUntilWakeup = wakeupTimeMinutes - currentTimeMinutes;
      if (minutesUntilWakeup < 0) {
        // Shouldn't happen if we're in sleep period, but handle it
        minutesUntilWakeup += 24 * 60; // Next day
      }
    }

    // Only use adaptive sleep if time until wakeup is less than default sleep
    // duration (30 minutes) This prevents integer overflow and uses 30-minute
    // intervals for longer sleep periods
    int defaultSleepMinutes = QUIET_HOURS_SLEEP_DURATION_US / (60 * 1000000UL);
    if (minutesUntilWakeup < defaultSleepMinutes && minutesUntilWakeup > 0) {
      // Convert to microseconds (safe now since minutesUntilWakeup < 30)
      sleepDurationUs = (unsigned long)minutesUntilWakeup * 60 * 1000000UL;
      Serial.print("⏰ Adaptive sleep: ");
      Serial.print(minutesUntilWakeup);
      Serial.print(" minutes until wakeup (");
      Serial.print(minutesUntilWakeup * 60);
      Serial.println(" seconds)");
    }
  }

  Serial.println("\n========================================");
  Serial.println("💤 ENTERING QUIET HOURS DEEP SLEEP");
  Serial.println("========================================");
  Serial.print("Sleep duration: ");
  Serial.print(sleepDurationUs / 1000000);
  Serial.println(" seconds");
  Serial.println("All systems shutting down...");
  Serial.println("WiFi: OFF | Sensors: OFF | Display: OFF");
  Serial.println("----------------------------------------");
  Serial.println("NOTE: GPIO16 (D0) must be connected to RST");
  Serial.println("========================================\n");

  // Turn off LED before sleep
  if (ledBlinkingActive) {
    ledTicker.detach();
    ledBlinkingActive = false;
  }
  digitalWrite(RED_LED_PIN, HIGH); // HIGH = LED off

  // Stop sensor measurements before sleep
  scd41.stopPeriodicMeasurement();

// Turn off display if available
#ifdef HAS_DISPLAY
  if (displayInitialized) {
    display.clearDisplay();
    display.setTextSize(1);
    display.setCursor(0, 20);
    display.println("Quiet Hours");
    display.setCursor(0, 35);
    display.println("Sleeping...");
    display.display();
    delay(2000);
    display.clearDisplay();
    display.display();
    display.ssd1306_command(SSD1306_DISPLAYOFF);
  }
#endif

  // Disconnect WiFi gracefully
  WiFi.disconnect();
  WiFi.mode(WIFI_OFF);

  // Small delay to ensure all operations complete
  delay(100);

  // Enter deep sleep with adaptive duration
  // WAKE_RF_DISABLED = WiFi will be off when waking up (we'll reconnect
  // manually)
  ESP.deepSleep(sleepDurationUs, WAKE_RF_DISABLED);

  // Code below this point will never execute during deep sleep
  // ESP8266 resets after deep sleep wake-up (runs setup() again)
}

/**
 * Check sleep schedule and enter sleep if needed
 * Called from setup() and loop() to enforce sleep schedule (gotosleep_time to
 * wakeup_time)
 */
void checkQuietHours() {
  if (isInQuietHours()) {
    enterQuietHoursSleep();
    // Will never reach here - ESP resets after deep sleep
  }
}

#endif // QUIET_HOURS_ENABLED
