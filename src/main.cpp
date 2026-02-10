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
#include "PowerManager.h"
#include "SensorManager.h"

// ESP8266 libraries
#include <time.h>

// LaskaKit AirBoard 8266 specific I2C pins for μSup connectors
#define I2C_SDA 0 // GPIO 0 (D3) - connected to μSup connectors
#define I2C_SCL 2 // GPIO 2 (D4) - connected to μSup connectors

// Apply configuration
const char *NTP_SERVER = "pool.ntp.org";
const unsigned long READING_INTERVAL = READING_INTERVAL_MS;

// Manager instances
NetworkManager networkManager;
SensorManager sensorManager;
PowerManager powerManager;

unsigned long lastReadingTime = 0;

/**
 * I2C Bus Recovery (Audit Finding 2.3)
 * 
 * If the ESP8266 reboots while the SCD41 is pulling SDA low (transmitting a 0),
 * the I2C bus will lock up. Wire.begin() does not automatically clear this.
 * 
 * Solution: Toggle SCL 9 times to complete any partial byte transmission,
 * allowing the slave device to release SDA.
 */
void recoverI2C() {
  Serial.println("I2C: Performing bus recovery...");
  
  // Temporarily take control of SCL to clock out any stuck transmission
  pinMode(I2C_SCL, OUTPUT);
  
  // Toggle SCL 9 times to complete any partial byte
  for (int i = 0; i < 9; i++) {
    digitalWrite(I2C_SCL, HIGH);
    delayMicroseconds(5);
    digitalWrite(I2C_SCL, LOW);
    delayMicroseconds(5);
  }
  
  // Release SCL back to default state
  // Wire.begin() will properly configure both pins for I2C
  pinMode(I2C_SCL, INPUT);
  pinMode(I2C_SDA, INPUT);
  
  Serial.println("I2C: Bus recovery complete");
}

void setup() {
  Serial.begin(115200);
  delay(100);

  Serial.println("\\n\\n=================================");
  Serial.println("Environmental Monitoring System");
  Serial.println("(Refactored with Manager Classes)");
  Serial.println("=================================\\n");

  // ========================================
  // PHASE 1: Boot & I2C Initialization
  // ========================================
  
  // Recover I2C bus before initialization (audit finding 2.3)
  // TEMPORARILY DISABLED: Test if this is causing sensor init failures
  // recoverI2C();

  // Initialize I2C
  Wire.begin(I2C_SDA, I2C_SCL);

  // ========================================
  // PHASE 2: Sensor Read (PRIORITY)
  // ========================================
  // Audit finding: Read sensor BEFORE WiFi to save battery on failures
  // If sensor fails, skip WiFi entirely (saves ~300mA current spike)
  
  // Initialize sensors with warmup
  // Reduce warmup to 4 readings (20s) to balance stability vs battery life
  if (!sensorManager.initSensors(4)) {
    Serial.println("✗ Sensor initialization failed");
    Serial.println("⚠️  Skipping WiFi to save battery, going to sleep...");
    delay(100);
    sensorManager.stopSensors();
    powerManager.enterDeepSleep(DEEP_SLEEP_DURATION_SEC);
    // Never returns
  }

  Serial.println("--- Single Shot Reading ---");
  SensorData reading;
  
  // Use single-shot mode (audit finding 2.2)
  if (!sensorManager.measureSingleShot(reading, 6000)) {
    Serial.println("✗ Could not get valid reading in time");
    Serial.println("⚠️  Skipping WiFi to save battery, going to sleep...");
    delay(100);
    sensorManager.stopSensors();
    powerManager.enterDeepSleep(DEEP_SLEEP_DURATION_SEC);
    // Never returns
  }

  // Read voltage after successful sensor measurement
  reading.voltage = sensorManager.readVoltage(VOLTAGE_DIVIDER_RATIO);
  lastReadingTime = millis();

  // ========================================
  // PHASE 3: Network (LAZY LOADING)
  // ========================================
  // Audit finding: Only enable WiFi AFTER valid data acquired
  // This is the lazy loading optimization
  
  Serial.println("\\n--- Network Initialization (Lazy Loading) ---");
  
  // Connect to WiFi (WiFi.persistent(false) is set in NetworkManager)
  if (!networkManager.connectWiFi(WIFI_SSID, WIFI_PASSWORD)) {
    Serial.println("✗ WiFi connection failed");
    Serial.println("⚠️  Proceeding to sleep without sending data...");
    delay(100);
    sensorManager.stopSensors();
    powerManager.enterDeepSleep(DEEP_SLEEP_DURATION_SEC);
    // Never returns
  }

  // Initialize MQTT
  networkManager.initMQTT(MQTT_BROKER_HOST, MQTT_BROKER_PORT, MQTT_USERNAME,
                          MQTT_PASSWORD);
  networkManager.setMQTTTopic(MQTT_TOPIC);

  // SECURITY NOTE: Using insecure mode for now (audit finding 2.1)
  // TODO: Replace with proper certificate validation
  // Example: networkManager.setCACertificate(CA_CERT_PEM);
  networkManager.setInsecureMode();

  // Connect MQTT
  if (!networkManager.connectMQTT()) {
    Serial.println("✗ MQTT connection failed, retrying once...");
    delay(1000);
    networkManager.connectMQTT(); // One retry
  }

  // Send to MQTT
  if (networkManager.getWiFiState() == CONNECTED) {
    if (!networkManager.isConnected()) {
      networkManager.connectMQTT();
    }

    if (networkManager.publishSensorData(
            reading.timestamp, networkManager.getMacAddress(),
            reading.temperature, reading.humidity, reading.co2,
            reading.voltage)) {
      Serial.println("✓ Data sent successfully");
    } else {
      Serial.println("✗ Failed to send data");
    }
  }

  Serial.println("Data sent. Proceeding to deep sleep...");

  // ========================================
  // PHASE 4: Sleep
  // ========================================

  // Check Quiet Hours (addresses audit finding for power management)
#if QUIET_HOURS_ENABLED
  Serial.println("Checking quiet hours...");
  if (powerManager.isInQuietHours(GOTOSLEEP_TIME_HOUR, GOTOSLEEP_TIME_MIN,
                                  WAKEUP_TIME_HOUR, WAKEUP_TIME_MIN)) {
    // Stop sensors before sleep
    sensorManager.stopSensors();

    // Enter quiet hours sleep (will not return)
    powerManager.enterQuietHoursSleep(GOTOSLEEP_TIME_HOUR, GOTOSLEEP_TIME_MIN,
                                      WAKEUP_TIME_HOUR, WAKEUP_TIME_MIN,
                                      QUIET_HOURS_SLEEP_DURATION_US);
  }
#endif

  Serial.print("Going to Deep Sleep for ");
  Serial.print(DEEP_SLEEP_DURATION_SEC);
  Serial.println(" seconds...");

  delay(100);

  // Stop sensors
  sensorManager.stopSensors();

  // DEEP SLEEP (addresses audit finding 4.2 - use constant)
  // PowerManager owns all WiFi shutdown logic (audit finding 2.4)
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

      // Send Data
      if (networkManager.getWiFiState() == CONNECTED) {
        networkManager.publishSensorData(reading.timestamp,
                                         networkManager.getMacAddress(),
                                         reading.temperature, reading.humidity,
                                         reading.co2, reading.voltage);
      }

      // 3. Re-evaluate Condition
      if (reading.co2 < WARNING_CO2_THRESHOLD) {
        Serial.println("CO2 levels normalized. Exiting Warning Mode.");

        Serial.println("Going to Deep Sleep...");

        // Stop sensors
        sensorManager.stopSensors();

        delay(100);
        // PowerManager owns all WiFi shutdown logic
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
