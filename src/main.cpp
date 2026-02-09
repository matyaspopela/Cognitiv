/*
 * IoT Environmental Monitoring System
 * ESP12S + SCD41 Sensor with LaskaKit μSup I2C Connector
 *
 * Refactored to use modular manager classes:
 * - NetworkManager: WiFi + MQTT (with TLS support)
 * - SensorManager: SCD41 + voltage (with warmup stabilization)
 * - DisplayManager: OLED display
 * - PowerManager: Deep sleep with WiFi shutdown
 *
 * ESP12S I2C Pins:
 * - SDA: GPIO 4 (D2)
 * - SCL: GPIO 5 (D1)
 */

// Arduino core
#include <Wire.h>

// ===== CONFIGURATION (must be loaded first for conditional compilation) =====
#include "config.h"

// Manager classes
#include "NetworkManager.h"
#include "SensorManager.h"
#include "DisplayManager.h"
#include "PowerManager.h"

// ESP8266 libraries
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <time.h>

// LaskaKit AirBoard 8266 specific I2C pins for μSup connectors
#define I2C_SDA 0 // GPIO 0 (D3) - connected to μSup connectors
#define I2C_SCL 2 // GPIO 2 (D4) - connected to μSup connectors

// Display configuration
#define HAS_DISPLAY
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64

// Apply configuration
const char *NTP_SERVER = "pool.ntp.org";
const unsigned long READING_INTERVAL = READING_INTERVAL_MS;

// Hardware objects
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);

// Manager instances
NetworkManager networkManager;
SensorManager sensorManager;
DisplayManager displayManager(display);
PowerManager powerManager;

unsigned long lastReadingTime = 0;

void setup() {
  Serial.begin(115200);
  delay(100);

  Serial.println("\n\n=================================");
  Serial.println("Environmental Monitoring System");
  Serial.println("(Refactored with Manager Classes)");
  Serial.println("=================================\n");

  // Initialize I2C
  Wire.begin(I2C_SDA, I2C_SCL);

#ifdef HAS_DISPLAY
  displayManager.init();
  displayManager.showStatus("Waking Up...", TFT_YELLOW);
#endif

  // Connect to WiFi
  displayManager.showStatus("WiFi Connecting", TFT_YELLOW);
  if (!networkManager.connectWiFi(WIFI_SSID, WIFI_PASSWORD)) {
    Serial.println("✗ WiFi connection failed");
    displayManager.showStatus("WiFi Failed!", TFT_RED);
    delay(2000);
  }

  // Initialize MQTT
  networkManager.initMQTT(MQTT_BROKER_HOST, MQTT_BROKER_PORT, 
                         MQTT_USERNAME, MQTT_PASSWORD);
  networkManager.setMQTTTopic(MQTT_TOPIC);
  
  // SECURITY NOTE: Using insecure mode for now (audit finding 2.1)
  // TODO: Replace with proper certificate validation
  // Example: networkManager.setCACertificate(CA_CERT_PEM);
  networkManager.setInsecureMode();
  
  // Connect MQTT
  networkManager.connectMQTT();

  // Initialize sensors with warmup (addresses audit finding 3.4)
  displayManager.showStatus("Sensor Init", TFT_YELLOW);
  // Reduce warmup to 4 readings (20s) to balance stability vs battery life
  if (!sensorManager.initSensors(4)) { 
    Serial.println("✗ Sensor initialization failed");
    displayManager.showStatus("Sensor Error!", TFT_RED);
    delay(2000);
  }

  // --- OPERATION: Single Shot Reading ---
  Serial.println("--- Single Shot Reading ---");
  
  SensorData reading;
  reading.voltage = sensorManager.readVoltage(VOLTAGE_DIVIDER_RATIO);
  
  if (sensorManager.waitForValidReading(reading, 6000)) {
    // Update voltage (waitForValidReading doesn't read voltage)
    reading.voltage = sensorManager.readVoltage(VOLTAGE_DIVIDER_RATIO);
    
    lastReadingTime = millis();

#ifdef HAS_DISPLAY
    displayManager.showReadings(reading, networkManager.getWiFiState(),
                               networkManager.getMQTTState(), 
                               WARNING_CO2_THRESHOLD);
#endif

    // Send to MQTT
    if (networkManager.getWiFiState() == CONNECTED) {
      if (!networkManager.isConnected()) {
        networkManager.connectMQTT();
      }
      
      if (networkManager.publishSensorData(reading.timestamp, 
                                          networkManager.getMacAddress(),
                                          reading.temperature, 
                                          reading.humidity,
                                          reading.co2, 
                                          reading.voltage)) {
        Serial.println("✓ Data sent successfully");
      } else {
        Serial.println("✗ Failed to send data");
      }
    }

    Serial.println("Data sent. Proceeding to deep sleep...");
  } else {
    Serial.println("✗ Could not get valid reading in time");
    displayManager.showStatus("Read Error", TFT_RED);
  }

  // --- SAFE / NORMAL MODE: Deep Sleep ---

  // Check Quiet Hours (addresses audit finding for power management)
#if QUIET_HOURS_ENABLED
  Serial.println("Checking quiet hours...");
  if (powerManager.isInQuietHours(GOTOSLEEP_TIME_HOUR, GOTOSLEEP_TIME_MIN,
                                  WAKEUP_TIME_HOUR, WAKEUP_TIME_MIN)) {
    // Stop sensors before sleep
    sensorManager.stopSensors();
    
    // Turn off display
    displayManager.turnOff();
    
    // Enter quiet hours sleep (will not return)
    powerManager.enterQuietHoursSleep(GOTOSLEEP_TIME_HOUR, GOTOSLEEP_TIME_MIN,
                                     WAKEUP_TIME_HOUR, WAKEUP_TIME_MIN,
                                     QUIET_HOURS_SLEEP_DURATION_US);
  }
#endif

  Serial.print("Going to Deep Sleep for ");
  Serial.print(DEEP_SLEEP_DURATION_SEC);
  Serial.println(" seconds...");
  
#ifdef HAS_DISPLAY
  displayManager.showStatus("Sleeping...", TFT_BLACK);
#endif

  delay(100);
  
  // Stop sensors
  sensorManager.stopSensors();
  
  // Disconnect network (addresses audit finding 3.3 - WiFi shutdown)
  networkManager.disconnectWiFi();
  
  // Turn off display
#ifdef HAS_DISPLAY
  displayManager.turnOff();
#endif

  // DEEP SLEEP (addresses audit finding 4.2 - use constant)
  powerManager.enterDeepSleep(DEEP_SLEEP_DURATION_SEC);
}

void loop() {
  // ==========================================
  // WARNING MODE HANDLER
  // Code reaches here ONLY if CO2 >= WARNING
  // ==========================================
  // NOTE: This code is currently UNREACHABLE because setup() always
  // calls ESP.deepSleep(). This is INTENTIONAL - the warning mode
  // is disabled but preserved for future activation.
  // (Audit finding 3.1 - intentional dead code)
  
  // 1. Maintenance
  if (networkManager.getWiFiState() != CONNECTED) {
    networkManager.connectWiFi(WIFI_SSID, WIFI_PASSWORD);
  }
  if (!networkManager.isConnected()) {
    networkManager.reconnectMQTT();
  } else {
    networkManager.loop();
  }

  // 2. Timer Check
  if (millis() - lastReadingTime >= READING_INTERVAL) {
    lastReadingTime = millis();

    Serial.println("\n--- Warning Mode Reading ---");
    SensorData reading = sensorManager.readSensors();
    reading.voltage = sensorManager.readVoltage(VOLTAGE_DIVIDER_RATIO);

    if (reading.valid) {

#ifdef HAS_DISPLAY
      displayManager.showReadings(reading, networkManager.getWiFiState(),
                                 networkManager.getMQTTState(),
                                 WARNING_CO2_THRESHOLD);
#endif

      // Send Data
      if (networkManager.getWiFiState() == CONNECTED) {
        networkManager.publishSensorData(reading.timestamp,
                                        networkManager.getMacAddress(),
                                        reading.temperature,
                                        reading.humidity,
                                        reading.co2,
                                        reading.voltage);
      }

      // 3. Re-evaluate Condition
      if (reading.co2 < WARNING_CO2_THRESHOLD) {
        Serial.println("CO2 levels normalized. Exiting Warning Mode.");

        Serial.println("Going to Deep Sleep...");
        
        // Stop sensors
        sensorManager.stopSensors();
        
        // Disconnect network
        networkManager.disconnectWiFi();
        
        delay(100);
        powerManager.enterDeepSleep(DEEP_SLEEP_DURATION_SEC);
      } else {
        Serial.println("CO2 still high. Staying active.");
      }

    } else {
      Serial.println("Invalid Reading in Warning Mode");
    }
  }

  delay(10); // Small delay for stability
}
