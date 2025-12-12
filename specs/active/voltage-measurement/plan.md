# Voltage Measurement - Technical Implementation Plan

## Architecture Overview

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                    LaskaKit AirBoard-8266                     │
│  ┌──────────────┐         ┌──────────────┐                 │
│  │   Battery    │         │ Voltage       │                 │
│  │  (3.0-4.2V)  │─────────▶│  Divider      │                 │
│  └──────────────┘         │  Circuit      │                 │
│                            └───────┬────────┘                 │
│                                    │ (scaled to 0-1V)          │
│                                    ▼                           │
│                            ┌──────────────┐                   │
│                            │ ESP8266 ADC  │                   │
│                            │    (A0 pin)  │                   │
│                            └───────┬──────┘                   │
└────────────────────────────────────┼──────────────────────────┘
                                     │
                                     │ analogRead(A0)
                                     │ (returns 0-1023)
                                     ▼
┌─────────────────────────────────────────────────────────────┐
│                    Software Layer                            │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ readVoltage()                                          │ │
│  │  - Reads ADC value                                     │ │
│  │  - Converts to voltage at ADC pin (0-1V)              │ │
│  │  - Applies divider ratio                              │ │
│  │  - Returns battery voltage                             │ │
│  └───────────────────┬──────────────────────────────────┘ │
│                      │                                     │
│                      ▼                                     │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ readSensors()                                        │ │
│  │  - Calls readVoltage()                               │ │
│  │  - Populates data.voltage                            │ │
│  │  - Logs voltage to Serial                            │ │
│  └───────────────────┬──────────────────────────────────┘ │
│                      │                                     │
│                      ▼                                     │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ SensorData struct                                     │ │
│  │  {                                                    │ │
│  │    float temperature;                                 │ │
│  │    float humidity;                                    │ │
│  │    uint16_t co2;                                      │ │
│  │    float voltage;  ← NEW                              │ │
│  │    unsigned long timestamp;                          │ │
│  │    bool valid;                                        │ │
│  │  }                                                    │ │
│  └───────────────────┬──────────────────────────────────┘ │
│                      │                                     │
│                      ▼                                     │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ sendSingleReading()                                   │ │
│  │  - Adds voltage to JSON document                      │ │
│  │  - Sends to server                                    │ │
│  └───────────────────┬──────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
                            ┌─────────────────┐
                            │  Server/API     │
                            │  (receives      │
                            │   voltage)      │
                            └─────────────────┘
```

### Design Patterns

**1. Sensor Reading Pattern**
- Follows existing pattern from `readSensors()` function
- Separate function for voltage reading (similar to how SCD41 is handled)
- Independent reading (doesn't affect sensor validity)

**2. Configuration Pattern**
- Uses `#define` macro in `config.h` (consistent with existing config)
- Compile-time configuration (no runtime overhead)
- Easy calibration without code changes

**3. Data Structure Pattern**
- Additive modification to `SensorData` struct
- Maintains backward compatibility
- Follows existing field naming conventions

**4. Error Handling Pattern**
- Non-blocking (voltage reading doesn't prevent data transmission)
- Logging for debugging
- Validation with warnings (not errors)

## Technology Stack

### Hardware
- **ESP8266 ADC**: Built-in 10-bit analog-to-digital converter
  - Pin: A0 (single ADC input)
  - Range: 0-1V direct measurement
  - Resolution: 10-bit (0-1023 digital values)
  - API: `analogRead(A0)` - Arduino standard function

- **LaskaKit AirBoard-8266**: Hardware platform
  - Built-in voltage divider circuit
  - Connected to ESP8266 ADC input
  - Scales battery voltage to ADC range

### Software
- **Arduino Core for ESP8266**: Platform framework
  - Provides `analogRead()` function
  - No additional libraries required

- **ArduinoJson**: Existing library (already in use)
  - Used for JSON payload creation
  - No changes needed (just add voltage field)

### Dependencies
- **No new dependencies required**
- Uses existing ESP8266 and ArduinoJson libraries

## Data Model

### SensorData Structure Modification

**Current Structure** (`src/main.cpp:58-64`):
```cpp
struct SensorData {
  float temperature;
  float humidity;
  uint16_t co2;
  unsigned long timestamp;
  bool valid;
};
```

**Modified Structure**:
```cpp
struct SensorData {
  float temperature;
  float humidity;
  uint16_t co2;
  float voltage;        // NEW: Battery/board voltage in Volts
  unsigned long timestamp;
  bool valid;
};
```

**Rationale**:
- `float` type matches other sensor readings (temperature, humidity)
- Positioned after CO2, before timestamp (logical grouping)
- Maintains all existing fields (backward compatible)

### JSON Payload Schema

**Current Payload**:
```json
{
  "timestamp": 1703001234,
  "device_id": "ESP8266A2",
  "temperature": 22.5,
  "humidity": 60.0,
  "co2": 450
}
```

**Modified Payload**:
```json
{
  "timestamp": 1703001234,
  "device_id": "ESP8266A2",
  "temperature": 22.5,
  "humidity": 60.0,
  "co2": 450,
  "voltage": 3.75
}
```

**Rationale**:
- Field name: `"voltage"` (clear, standard unit)
- Type: `float` (allows decimal precision)
- Unit: Volts (implicit, standard unit)
- Format: 2 decimal places (e.g., 3.75V)
- Position: After CO2 (logical grouping with sensor data)

### Configuration Model

**New Configuration Parameter** (`include/config.h`):
```cpp
// Voltage measurement configuration
// Divider ratio for voltage calculation (default: 2.0 for common 2:1 divider)
// To calibrate: Measure actual battery voltage with multimeter, compare with
// reading, adjust ratio until they match.
// Common values: 2.0 (3.3V systems), 3.0 (5V systems)
#define VOLTAGE_DIVIDER_RATIO 2.0
```

**Rationale**:
- Compile-time constant (no runtime overhead)
- Well-documented with calibration instructions
- Default value based on common hardware configuration
- Easy to adjust for calibration

## Implementation Details

### Function: readVoltage()

**Location**: After `readSensors()` function (around line 400 in `src/main.cpp`)

**Signature**:
```cpp
float readVoltage();
```

**Implementation**:
```cpp
float readVoltage() {
  // Read ADC value (0-1023)
  int adcValue = analogRead(A0);
  
  // Convert to voltage at ADC pin (0-1V range)
  float adcVoltage = (adcValue / 1023.0) * 1.0;
  
  // Convert to actual battery voltage using divider ratio
  float batteryVoltage = adcVoltage * VOLTAGE_DIVIDER_RATIO;
  
  return batteryVoltage;
}
```

**Error Handling**:
- ADC values 0 or 1023 may indicate hardware issues
- Log warning if value is at extremes
- Still return calculated voltage (let validation handle it)

**Performance**:
- Execution time: ~1-2ms (ADC read + calculation)
- Memory: Minimal (local variables only)
- Power: ~1mA for ~1ms (negligible)

### Function: readSensors() Modification

**Location**: `src/main.cpp:368-400`

**Current Implementation** (excerpt):
```cpp
SensorData readSensors() {
  SensorData data;
  data.valid = false;
  data.timestamp = time(nullptr);
  
  // Read SCD41
  if (scd41.readMeasurement()) {
    // ... existing code ...
    data.valid = true;
  }
  
  return data;
}
```

**Modified Implementation**:
```cpp
SensorData readSensors() {
  SensorData data;
  data.valid = false;
  data.timestamp = time(nullptr);
  
  // Read voltage (always read, independent of sensor validity)
  data.voltage = readVoltage();
  Serial.print("Voltage: ");
  Serial.print(data.voltage, 2);
  Serial.println(" V");
  
  // Optional: Validate voltage range
  if (data.voltage < 2.5 || data.voltage > 5.5) {
    Serial.print("WARNING: Voltage out of expected range: ");
    Serial.println(data.voltage);
  }
  
  // Read SCD41
  if (scd41.readMeasurement()) {
    // ... existing code ...
    data.valid = true;
  }
  
  // Note: voltage reading doesn't affect data.valid
  // Voltage is useful even if sensors fail (helps diagnose power issues)
  
  return data;
}
```

**Key Changes**:
1. Call `readVoltage()` at start of function
2. Populate `data.voltage` field
3. Add Serial logging (consistent with other sensor logging)
4. Optional validation with warning (non-blocking)
5. Voltage reading independent of sensor validity

### Function: sendSingleReading() Modification

**Location**: `src/main.cpp:527-564`

**Current Implementation** (excerpt):
```cpp
bool sendSingleReading(SensorData data) {
  // ...
  StaticJsonDocument<256> doc;
  doc["timestamp"] = data.timestamp;
  doc["device_id"] = DEVICE_ID;
  doc["temperature"] = round(data.temperature * 100) / 100.0;
  doc["humidity"] = round(data.humidity * 100) / 100.0;
  doc["co2"] = data.co2;
  // ...
}
```

**Modified Implementation**:
```cpp
bool sendSingleReading(SensorData data) {
  // ...
  StaticJsonDocument<256> doc;  // Size may need increase to 300 if needed
  doc["timestamp"] = data.timestamp;
  doc["device_id"] = DEVICE_ID;
  doc["temperature"] = round(data.temperature * 100) / 100.0;
  doc["humidity"] = round(data.humidity * 100) / 100.0;
  doc["co2"] = data.co2;
  doc["voltage"] = round(data.voltage * 100) / 100.0;  // NEW: 2 decimal places
  // ...
}
```

**Key Changes**:
1. Add voltage field to JSON document
2. Format to 2 decimal places (consistent with temperature/humidity)
3. May need to increase `StaticJsonDocument` size (currently 256, voltage adds ~10 bytes)

### Configuration: config.h Addition

**Location**: `include/config.h`

**Addition**:
```cpp
// Voltage measurement configuration
// Divider ratio for voltage calculation
// Default: 2.0 (common for 3.3V systems with 2:1 voltage divider)
// To calibrate: 
//   1. Measure actual battery voltage with multimeter
//   2. Compare with device reading
//   3. Adjust ratio: new_ratio = actual_voltage / device_reading
// Common values: 2.0 (3.3V systems), 3.0 (5V systems)
#define VOLTAGE_DIVIDER_RATIO 2.0
```

**Placement**: After `READING_INTERVAL_MS` definition (logical grouping with other sensor config)

### Forward Declaration

**Location**: `src/main.cpp:85-97` (forward declarations section)

**Addition**:
```cpp
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
float readVoltage();  // NEW
void connectWiFi();
bool sendSingleReading(SensorData data);
bool sendJsonToUrl(const char* url, const String& jsonPayload, bool isArray);
```

## Hardware Integration

### ADC Pin Usage

**Pin**: A0 (ESP8266's single ADC input)

**Connection**: 
- Hardware: Voltage divider circuit on LaskaKit AirBoard-8266
- Software: Access via `analogRead(A0)`
- No additional wiring required (built into board)

### Voltage Divider Circuit

**Understanding**:
- Battery voltage (3.0-4.2V) is divided down to 0-1V range
- Divider ratio determines scaling factor
- Common ratios: 2:1 (for 3.3V systems), 3:1 (for 5V systems)

**Calculation**:
```
V_adc = V_battery / divider_ratio
V_battery = V_adc * divider_ratio
```

**Example**:
- If divider ratio = 2.0
- ADC reads 0.825V
- Battery voltage = 0.825V × 2.0 = 1.65V (incorrect - indicates calibration needed)
- After calibration: If actual battery = 3.7V, ratio should be 3.7 / 0.825 = 4.48

### Calibration Procedure

**Step 1: Initial Setup**
1. Connect fully charged battery (should read ~4.2V for LiPo)
2. Measure actual voltage with multimeter
3. Flash code with default `VOLTAGE_DIVIDER_RATIO 2.0`
4. Read voltage from Serial output

**Step 2: Calculate Correct Ratio**
```
actual_voltage = multimeter_reading (e.g., 4.15V)
device_reading = Serial output (e.g., 2.075V)
correct_ratio = actual_voltage / device_reading
correct_ratio = 4.15 / 2.075 = 2.0
```

**Step 3: Update Configuration**
1. Update `VOLTAGE_DIVIDER_RATIO` in `config.h`
2. Recompile and flash
3. Verify readings match multimeter

**Step 4: Validate at Different Levels**
- Test at full charge (~4.2V)
- Test at nominal (~3.7V)
- Test at low charge (~3.3V)
- Verify accuracy across range

## Security Considerations

### No Security Impact
- Voltage reading is local hardware operation
- No network exposure of sensitive data
- Voltage data is diagnostic information (not sensitive)
- No authentication/authorization changes needed

### Data Validation
- Validate voltage range (2.5V - 5.5V) to detect hardware issues
- Log warnings for out-of-range values
- Don't reject data (voltage issues shouldn't block transmission)

## Performance Strategy

### Execution Time
- **ADC Read**: ~1ms (hardware operation)
- **Calculation**: < 1ms (simple math)
- **Total Overhead**: ~2ms per reading cycle
- **Impact**: Negligible (reading cycle is 10+ seconds)

### Memory Usage
- **Code Size**: ~100-200 bytes (small function)
- **RAM**: ~4 bytes (float variable in SensorData)
- **Stack**: ~12 bytes (local variables in readVoltage())
- **Impact**: Minimal (ESP8266 has ~80KB RAM)

### Power Consumption
- **ADC Reading**: ~1mA for ~1ms
- **Total Energy**: ~1µAh per reading (negligible)
- **Impact**: Much less than WiFi transmission or sensor reading
- **Battery Life**: No measurable impact

### Optimization Opportunities (Future)
- **Averaging**: Take 5-10 readings and average (improves accuracy)
- **Median Filter**: Discard outliers (reduces noise)
- **Conditional Reading**: Only read voltage if battery-powered (save power)
- **Current**: Single reading is sufficient for battery monitoring

## Testing Strategy

### Unit Testing (Hardware-Dependent)

**Test 1: ADC Reading**
- **Setup**: Connect multimeter to battery
- **Action**: Read voltage via Serial output
- **Expected**: Voltage reading appears in Serial output
- **Validation**: Value is reasonable (2.5V - 5.5V range)

**Test 2: Calibration**
- **Setup**: Measure actual battery voltage with multimeter
- **Action**: Compare with device reading
- **Expected**: Readings match within ±0.1V after calibration
- **Validation**: Adjust `VOLTAGE_DIVIDER_RATIO` until match

**Test 3: JSON Payload**
- **Setup**: Monitor Serial output or server logs
- **Action**: Send sensor reading
- **Expected**: JSON contains `"voltage": X.XX` field
- **Validation**: Voltage value matches Serial output

**Test 4: Different Voltage Levels**
- **Setup**: Test with battery at different charge levels
- **Action**: Read voltage at full, half, empty
- **Expected**: Readings reflect actual battery state
- **Validation**: Values decrease as battery discharges

**Test 5: Error Handling**
- **Setup**: Test with extreme ADC values (if possible)
- **Action**: Monitor Serial output for warnings
- **Expected**: Warnings logged, data still transmitted
- **Validation**: System continues operating

### Integration Testing

**Test 1: Sensor Reading Cycle**
- **Setup**: Normal operation
- **Action**: Complete sensor reading cycle
- **Expected**: Voltage included in every reading
- **Validation**: Voltage appears in all sensor data

**Test 2: Deep Sleep Compatibility**
- **Setup**: Enable deep sleep mode
- **Action**: Complete cycle with deep sleep
- **Expected**: Voltage measured before sleep, included in last reading
- **Validation**: No conflicts with deep sleep functionality

**Test 3: Bundling Compatibility**
- **Setup**: Enable request bundling
- **Action**: Send bundled readings
- **Expected**: Voltage included in each bundled reading
- **Validation**: All readings contain voltage data

**Test 4: Display Integration (Optional)**
- **Setup**: Device with OLED display
- **Action**: Complete sensor reading cycle
- **Expected**: Voltage displayed on screen (if implemented)
- **Validation**: Display shows voltage value

### Edge Cases

**Case 1: Very Low Battery**
- **Scenario**: Battery voltage < 2.5V
- **Expected**: Warning logged, voltage still sent
- **Handling**: Non-blocking, helps diagnose power issues

**Case 2: Very High Voltage**
- **Scenario**: Voltage > 5.5V (USB power or overvoltage)
- **Expected**: Warning logged, voltage still sent
- **Handling**: Non-blocking, helps identify power source

**Case 3: ADC Failure**
- **Scenario**: ADC returns 0 or 1023 consistently
- **Expected**: Warning logged, voltage = 0.0 or calculated value sent
- **Handling**: System continues, helps identify hardware issues

**Case 4: Sensor Failure**
- **Scenario**: SCD41 sensor fails, but voltage reading succeeds
- **Expected**: Voltage still included in payload
- **Handling**: Voltage reading independent of sensor validity

## Deployment Plan

### Code Changes
1. **Modify `include/config.h`**: Add `VOLTAGE_DIVIDER_RATIO` definition
2. **Modify `src/main.cpp`**:
   - Add `float voltage;` to `SensorData` struct (line ~61)
   - Add `float readVoltage();` forward declaration (line ~97)
   - Implement `readVoltage()` function (after line ~400)
   - Modify `readSensors()` to call `readVoltage()` (line ~368)
   - Modify `sendSingleReading()` to include voltage in JSON (line ~527)

### Compilation
- **No new dependencies**: Uses existing libraries
- **No build system changes**: Standard Arduino/PlatformIO build
- **Backward compatible**: Existing code continues to work

### Calibration Process
1. **Initial Deployment**: Use default `VOLTAGE_DIVIDER_RATIO 2.0`
2. **Field Calibration**: Measure actual voltage, adjust ratio
3. **Validation**: Test at different voltage levels
4. **Documentation**: Record calibrated ratio for future reference

### Server-Side Considerations
- **Database Schema**: Server must accept `voltage` field (float)
- **API Compatibility**: JSON payload includes new field (additive, non-breaking)
- **Data Validation**: Server should validate voltage range (2.5V - 5.5V)
- **Monitoring**: Server can track voltage trends for battery health

### Rollback Strategy
- **If Issues**: Remove voltage field from JSON (comment out one line)
- **Backward Compatible**: Old code works with new server (ignores voltage field)
- **No Breaking Changes**: Feature is purely additive

## Implementation Checklist

### Code Modifications
- [ ] Add `VOLTAGE_DIVIDER_RATIO` to `include/config.h`
- [ ] Add `float voltage;` to `SensorData` struct
- [ ] Add `float readVoltage();` forward declaration
- [ ] Implement `readVoltage()` function
- [ ] Modify `readSensors()` to call `readVoltage()` and populate voltage field
- [ ] Add Serial logging for voltage in `readSensors()`
- [ ] Add voltage validation (optional, with warnings)
- [ ] Modify `sendSingleReading()` to include voltage in JSON
- [ ] Increase `StaticJsonDocument` size if needed (256 → 300)

### Testing
- [ ] Test ADC reading functionality
- [ ] Calibrate voltage divider ratio with multimeter
- [ ] Verify voltage appears in Serial output
- [ ] Verify voltage appears in JSON payload
- [ ] Test at different battery voltage levels
- [ ] Test with USB power (should read ~5V)
- [ ] Test error handling (out-of-range values)
- [ ] Test integration with deep sleep (if enabled)
- [ ] Test integration with bundling (if enabled)
- [ ] Optional: Test display integration

### Documentation
- [ ] Update code comments for voltage reading
- [ ] Document calibration procedure
- [ ] Document voltage ranges (LiPo, USB, Solar)
- [ ] Update feature brief with implementation notes

## Success Criteria

### Functional Requirements
- ✅ Voltage reading included in every sensor cycle
- ✅ Voltage appears in JSON payload sent to server
- ✅ Voltage values are accurate within ±0.1V after calibration
- ✅ Voltage reading doesn't affect sensor validity
- ✅ System continues operating even if voltage reading fails

### Performance Requirements
- ✅ Voltage reading adds < 5ms overhead per cycle
- ✅ Code size increase < 500 bytes
- ✅ No measurable impact on battery life
- ✅ No impact on existing functionality

### Quality Requirements
- ✅ Code follows existing patterns and style
- ✅ Proper error handling and validation
- ✅ Clear Serial logging for debugging
- ✅ Well-documented configuration parameter
- ✅ Backward compatible (no breaking changes)

---

**Plan Status**: Ready for Implementation  
**Estimated Implementation Time**: ~1 hour  
**Complexity**: Low (hardware integration, minimal code changes)  
**Risk Level**: Low (additive feature, non-breaking changes)




