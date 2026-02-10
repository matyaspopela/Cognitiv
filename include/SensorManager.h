#ifndef SENSOR_MANAGER_H
#define SENSOR_MANAGER_H

#include <SparkFun_SCD4x_Arduino_Library.h>
#include <Arduino.h>

// Sensor data structure
struct SensorData {
  float temperature;
  float humidity;
  uint16_t co2;
  float voltage;
  unsigned long timestamp;
  bool valid;
};

class SensorManager {
public:
  SensorManager();
  
  // Initialization with warmup (addresses audit finding 3.4)
  bool initSensors(uint16_t warmupReadings = 7);
  
  // Read sensor data with validation
  SensorData readSensors();
  
  // Single-shot measurement (audit finding 2.2 - optimized for deep sleep)
  bool measureSingleShot(SensorData& data, unsigned long timeoutMs = 6000);
  
  // Read voltage from ADC
  float readVoltage(float dividerRatio);
  
  // Stop sensors before deep sleep
  void stopSensors();
  
  // Wait for a valid reading (with timeout)
  bool waitForValidReading(SensorData& data, unsigned long timeoutMs = 6000);
  
private:
  SCD4x scd41;
  bool sensorsInitialized;
  uint16_t warmupCount;
  uint16_t warmupTarget;
  
  // Validate sensor readings
  bool validateReading(const SensorData& data) const;
};

#endif // SENSOR_MANAGER_H
