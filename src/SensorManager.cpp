#include "SensorManager.h"
#include <Wire.h>
#include <time.h>

SensorManager::SensorManager() 
  : sensorsInitialized(false),
    warmupCount(0),
    warmupTarget(0) {
}

bool SensorManager::initSensors(uint16_t warmupReadings) {
  Serial.println("SensorManager: Initializing sensors...");
  
  warmupTarget = warmupReadings;
  warmupCount = 0;
  
  // Give sensors time to power up
  delay(500);
  
  // Initialize SCD41 (I2C address 0x62)
  Serial.print("SCD41 (0x62): ");
  if (scd41.begin(Wire)) {
    Serial.println("✓ OK");
    
    // Stop any ongoing measurement
    scd41.stopPeriodicMeasurement();
    delay(500);
    
    // Start periodic measurements
    Serial.print("SCD41: Starting measurements... ");
    if (scd41.startPeriodicMeasurement()) {
      Serial.println("✓ OK");
      
      // Addresses audit finding 3.4 - Sensor Stabilization
      if (warmupTarget > 0) {
        Serial.print("SCD41: Warming up (discarding first ");
        Serial.print(warmupTarget);
        Serial.println(" readings for stability)");
        
        // Discard warmup readings
        unsigned long warmupStart = millis();
        while (warmupCount < warmupTarget && (millis() - warmupStart) < 60000) {
          if (scd41.readMeasurement()) {
            warmupCount++;
            Serial.print("  Warmup reading ");
            Serial.print(warmupCount);
            Serial.print("/");
            Serial.print(warmupTarget);
            Serial.print(": CO2=");
            Serial.print(scd41.getCO2());
            Serial.print(" ppm, Temp=");
            Serial.print(scd41.getTemperature(), 1);
            Serial.println("°C (discarded)");
          }
          delay(5000); // SCD41 measures every 5 seconds
        }
        
        if (warmupCount >= warmupTarget) {
          Serial.println("✓ SCD41: Warmup complete, sensor stabilized");
        } else {
          Serial.println("⚠️  SCD41: Warmup timeout, proceeding anyway");
        }
      } else {
        Serial.println("⚠️  SCD41: No warmup configured (first reading may be unstable)");
      }
      
      sensorsInitialized = true;
      return true;
    } else {
      Serial.println("✗ FAILED to start measurements");
      return false;
    }
  } else {
    Serial.println("✗ FAILED - Check I2C connections");
    sensorsInitialized = false;
    return false;
  }
}

SensorData SensorManager::readSensors() {
  SensorData data;
  data.valid = false;
  data.timestamp = time(nullptr);
  data.voltage = 0.0;
  data.temperature = 0.0;
  data.humidity = 0.0;
  data.co2 = 0;
  
  if (!sensorsInitialized) {
    Serial.println("SensorManager: Sensors not initialized");
    return data;
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
    if (validateReading(data)) {
      data.valid = true;
    } else {
      Serial.println("SensorManager: Reading out of valid range");
    }
  } else {
    Serial.println("SensorManager: No data available from SCD41");
  }
  
  return data;
}

float SensorManager::readVoltage(float dividerRatio) {
  // Read ADC value (0-1023)
  int adcValue = analogRead(A0);
  
  // Convert to voltage at ADC pin (0-1V range)
  float adcVoltage = (adcValue / 1023.0) * 1.0;
  
  // Convert to actual battery voltage using divider ratio
  float batteryVoltage = adcVoltage * dividerRatio;
  
  Serial.print("Voltage: ");
  Serial.print(batteryVoltage, 2);
  Serial.println(" V");
  
  // Warn if out of expected range
  if (batteryVoltage < 2.5 || batteryVoltage > 5.5) {
    Serial.print("⚠️  Voltage out of expected range: ");
    Serial.print(batteryVoltage, 2);
    Serial.println(" V");
  }
  
  return batteryVoltage;
}

void SensorManager::stopSensors() {
  if (sensorsInitialized) {
    scd41.stopPeriodicMeasurement();
    Serial.println("SensorManager: Sensors stopped");
  }
}

bool SensorManager::waitForValidReading(SensorData& data, unsigned long timeoutMs) {
  unsigned long startWait = millis();
  
  while (millis() - startWait < timeoutMs) {
    data = readSensors();
    if (data.valid) {
      return true;
    }
    delay(500);
  }
  
  Serial.println("SensorManager: Timeout waiting for valid reading");
  return false;
}

bool SensorManager::validateReading(const SensorData& data) const {
  // Validate CO2 (400-5000 ppm is reasonable range)
  if (data.co2 < 400 || data.co2 > 5000) {
    return false;
  }
  
  // Validate temperature (-10 to 50°C)
  if (data.temperature < -10 || data.temperature > 50) {
    return false;
  }
  
  // Validate humidity (0-100%)
  if (data.humidity < 0 || data.humidity > 100) {
    return false;
  }
  
  return true;
}
