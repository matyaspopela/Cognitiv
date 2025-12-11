# voltage-measurement Feature Brief

## 🎯 Context (2min)
**Problem**: The device currently has no way to monitor battery or board voltage levels. For battery-powered or solar-powered deployments (common with LaskaKit AirBoard-8266), this makes it impossible to:
- Monitor battery health and remaining capacity
- Detect low battery conditions before device failure
- Optimize power management based on voltage levels
- Diagnose power-related issues remotely
- Track battery degradation over time

The LaskaKit AirBoard-8266 has built-in hardware support for voltage measurement via a voltage divider connected to the ESP8266's ADC input, but this functionality is not currently implemented in software.

**Users**: 
- Battery-powered IoT devices (primary beneficiary - battery monitoring)
- Solar-powered deployments (voltage tracking for solar charging status)
- Long-term monitoring installations (battery health tracking)
- Users deploying LaskaKit AirBoard-8266 with battery/solar power
- System administrators monitoring device health remotely

**Success**: The system reads board/battery voltage using the built-in ADC and voltage divider, includes voltage in every sensor reading payload, displays voltage in the admin panel for easy monitoring, and provides accurate voltage measurements (within ±0.1V) for monitoring and diagnostics. Voltage data enables proactive battery management and power optimization.

## 🔍 Quick Research (15min)
### Existing Patterns
- **SensorData Structure** (`src/main.cpp:58-64`) → Struct contains temperature, humidity, CO2, timestamp, valid flag | Reuse: Add `float voltage` field following same pattern
- **readSensors() Function** (`src/main.cpp:368-400`) → Reads sensor data and populates SensorData struct | Reuse: Add voltage reading logic here or create separate function
- **sendSingleReading() Function** (`src/main.cpp:527-564`) → Creates JSON payload from SensorData | Reuse: Add voltage to JSON document
- **Serial Logging Pattern** (`src/main.cpp:379-385`) → Logs sensor readings with formatted output | Reuse: Add voltage logging with same format
- **Display Integration** (`src/main.cpp:251-285`) → Optional display of sensor data | Reuse: Optionally display voltage on OLED screen

### LaskaKit AirBoard-8266 Hardware Details
- **Built-in Voltage Divider**: According to [LaskaKit AirBoard-8266 product page](https://www.laskakit.cz/en/laskakit-airboard-8266-deska-pro-mereni-kvality-vzduchu/), the board has "ADC input from the voltage divider connected to the battery" connected to the single ADC input of the ESP8266
- **ADC Pin**: ESP8266 has one ADC input (A0) that can measure 0-1V directly
- **Voltage Divider**: Scales down battery voltage (typically 3.0V-4.2V for LiPo) to fit within ADC's 0-1V range
- **Common Divider Ratios**: Typical values are 2:1 (for 3.3V systems) or 3:1 (for 5V systems), but exact ratio needs to be determined from board schematic or testing
- **Battery Range**: LiPo batteries typically range from 3.0V (empty) to 4.2V (full), with 3.7V being nominal

### ESP8266 ADC Technical Details
- **Resolution**: 10-bit ADC (0-1023 digital values)
- **Voltage Range**: 0-1V (direct measurement)
- **API**: `analogRead(A0)` - returns integer 0-1023
- **Conversion**: ADC value represents voltage at ADC pin (0-1V), not actual battery voltage
- **Accuracy**: ±0.1V typical (adequate for battery monitoring)
- **Noise**: ADC can have some noise, averaging multiple readings improves accuracy

### Voltage Calculation Formula
- **Step 1**: Read ADC value: `int adcValue = analogRead(A0);`
- **Step 2**: Convert to voltage at ADC pin: `float adcVoltage = (adcValue / 1023.0) * 1.0;` (0-1V)
- **Step 3**: Convert to actual battery voltage using divider ratio: `float batteryVoltage = adcVoltage * dividerRatio;`
- **Divider Ratio**: If divider is 2:1 (common), ratio = 2.0 (actual voltage is 2x ADC voltage)
- **Example**: ADC reads 0.825V → Battery voltage = 0.825V × 2.0 = 1.65V (if 2:1 divider) OR 0.825V × 3.0 = 2.475V (if 3:1 divider)

### Tech Decision
**Approach**: Direct ADC reading with configurable divider ratio
- **Why**: 
  - Simple implementation using ESP8266 built-in ADC
  - No additional hardware required (board has built-in divider)
  - Configurable divider ratio allows calibration
  - Follows existing sensor reading patterns
  - Minimal code changes required
- **Avoid**: 
  - External voltage monitoring ICs (unnecessary complexity, board already has divider)
  - Complex calibration routines (simple ratio calculation sufficient)
  - Multiple ADC readings with averaging (can add later if needed for accuracy)
  - Voltage thresholds/alarms (out of scope, can add in future)

## ✅ Requirements (10min)

### Core Features

**R1: Voltage Reading Functionality**
- System reads voltage from ESP8266 ADC (A0) pin
- Uses `analogRead(A0)` to get raw ADC value (0-1023)
- Converts ADC value to actual battery/board voltage using configurable divider ratio
- Voltage reading happens during sensor reading cycle (same interval as other sensors)
- **Acceptance**: Serial output shows voltage reading with each sensor cycle

**R2: Voltage Field in SensorData**
- `SensorData` struct includes `float voltage` field
- Voltage is populated during `readSensors()` call
- Voltage value stored alongside temperature, humidity, CO2
- **Acceptance**: SensorData struct contains voltage field, value is set during reading

**R3: Voltage in JSON Payload**
- Voltage included in JSON payload sent to server
- Voltage field name: `"voltage"` (float, in Volts)
- Voltage included in both production and local debug server payloads
- Voltage formatted to 2 decimal places (e.g., 3.75V)
- **Acceptance**: JSON payload contains voltage field, server receives voltage data

**R4: Configurable Divider Ratio**
- Divider ratio configurable via `VOLTAGE_DIVIDER_RATIO` in `config.h`
- Default value: 2.0 (common for 3.3V systems)
- Allows calibration if actual divider ratio differs
- Ratio applied: `batteryVoltage = adcVoltage * VOLTAGE_DIVIDER_RATIO`
- **Acceptance**: Changing divider ratio in config.h changes voltage readings appropriately

**R5: Voltage Validation (Optional)**
- Voltage values validated to reasonable range (2.5V - 5.0V typical)
- Invalid readings logged but don't prevent data transmission
- Out-of-range values indicate potential hardware issue
- **Acceptance**: Voltage outside valid range logged as warning, data still sent

**R6: Serial Output for Debugging**
- Voltage reading logged to Serial with each sensor cycle
- Format: `"Voltage: X.XX V"` (consistent with other sensor logging)
- Helps with calibration and troubleshooting
- **Acceptance**: Serial monitor shows voltage reading with each cycle

**R7: Voltage Display in Admin Panel**
- Voltage displayed in board card in admin panel
- Displayed as a badge component in the board box header
- Shows voltage value in Volts (e.g., "3.75V")
- Badge positioned alongside status badge (Online/Offline)
- Only displays for online devices with voltage data
- Format: "X.XX V" (2 decimal places)
- **Acceptance**: Voltage badge appears in board card header, shows current voltage reading

## 🏗️ Implementation (5min)

### Components

**Configuration**:
- Add to `include/config.h`:
  - `#define VOLTAGE_DIVIDER_RATIO 2.0` (default: 2.0 for common 2:1 divider)
  - Comment explaining how to calibrate if needed

**SensorData Structure Modification**:
- Modify `src/main.cpp:58-64`:
  - Add `float voltage;` field to `SensorData` struct
  - Maintains backward compatibility (existing fields unchanged)

**Voltage Reading Function**:
- Function: `float readVoltage()` - reads ADC and converts to voltage
- Location: After `readSensors()` function (around line 400)
- Behavior:
  - Read ADC value: `int adcValue = analogRead(A0);`
  - Convert to ADC pin voltage: `float adcVoltage = (adcValue / 1023.0) * 1.0;`
  - Convert to battery voltage: `float batteryVoltage = adcVoltage * VOLTAGE_DIVIDER_RATIO;`
  - Return battery voltage
- Optional: Add multiple readings with averaging for better accuracy

**readSensors() Modification**:
- In `readSensors()` function (`src/main.cpp:368-400`):
  - Call `readVoltage()` to get voltage reading
  - Assign to `data.voltage` field
  - Add Serial logging: `Serial.print("Voltage: "); Serial.print(data.voltage, 2); Serial.println(" V");`
  - Voltage reading doesn't affect `data.valid` flag (always read, even if other sensors fail)

**sendSingleReading() Modification**:
- In `sendSingleReading()` function (`src/main.cpp:527-564`):
  - Add voltage to JSON document: `doc["voltage"] = round(data.voltage * 100) / 100.0;`
  - Increase `StaticJsonDocument` size if needed (currently 256 bytes, voltage adds ~10 bytes)

**Forward Declaration**:
- Add `float readVoltage();` to forward declarations section (around line 97)

**Optional: Display Integration**:
- In `displayReadings()` function (`src/main.cpp:251-285`):
  - Optionally display voltage on OLED screen (if space available)
  - Format: `"V: X.XX V"` (compact format)

**Frontend Display Integration**:
- Modify `frontend/src/components/admin/BoardCard.jsx`:
  - Add voltage badge in `board-card__header-actions` section
  - Display voltage from `device.current_readings.voltage`
  - Format: Badge with voltage value (e.g., "3.75V")
  - Position: After status badge, before rename button
  - Conditional: Only show if voltage data exists and device is online
  - Use existing Badge component with appropriate color (e.g., "info" or "primary")

### APIs

**New Function**:
- `float readVoltage()` - Reads ADC and converts to battery voltage
  - Parameters: None (uses global `VOLTAGE_DIVIDER_RATIO` from config)
  - Returns: `float` - Battery/board voltage in Volts
  - Behavior: Reads ADC, converts using divider ratio

**ESP8266 API Used**:
- `analogRead(A0)` - ESP8266 built-in ADC reading function
  - Returns: `int` - ADC value from 0-1023
  - Pin: A0 (ESP8266's single ADC input)

### Data Changes
- **SensorData struct**: Add `float voltage;` field
- **JSON payload**: Add `"voltage": X.XX` field (float, Volts)
- **No database schema changes** (server must accept new field)
- **No breaking changes** (voltage is additive, existing fields unchanged)

## 📋 Next Actions (2min)
- [ ] Add `VOLTAGE_DIVIDER_RATIO` configuration to `include/config.h` (5min)
- [ ] Add `float voltage;` field to `SensorData` struct (2min)
- [ ] Implement `readVoltage()` function (15min)
- [ ] Add forward declaration for `readVoltage()` (2min)
- [ ] Modify `readSensors()` to call `readVoltage()` and populate voltage field (10min)
- [ ] Modify `sendSingleReading()` to include voltage in JSON payload (10min)
- [ ] Test voltage readings with multimeter for calibration (20min)
- [ ] Adjust `VOLTAGE_DIVIDER_RATIO` if needed based on testing (5min)
- [ ] Optional: Add voltage to display output (10min)
- [ ] Add voltage badge to BoardCard component (15min)
- [ ] Test voltage display in admin panel (5min)

**Start Coding In**: ~1 hour total implementation time

---
**Total Planning Time**: ~30min | **Owner**: Development Team | **Date**: 2024-12-19

<!-- Living Document - Update as you code -->

## 🔄 Implementation Tracking

**CRITICAL**: Follow the todo-list systematically. Mark items as complete, document blockers, update progress.

### Progress
- [ ] Track completed items here
- [ ] Update daily

### Blockers
- [ ] Document any blockers

**See**: [.sdd/IMPLEMENTATION_GUIDE.md](mdc:.sdd/IMPLEMENTATION_GUIDE.md) for detailed execution rules.

## 📝 Implementation Notes

### Voltage Divider Ratio Calibration

**Determining the Divider Ratio**:
- **Method 1**: Check board schematic/documentation for exact resistor values
- **Method 2**: Measure with multimeter:
  - Measure actual battery voltage (V_battery)
  - Read ADC value and convert to ADC pin voltage (V_adc)
  - Calculate ratio: `ratio = V_battery / V_adc`
- **Method 3**: Common values:
  - **2.0**: Common for 3.3V systems (220kΩ + 100kΩ divider)
  - **3.0**: Common for 5V systems (200kΩ + 100kΩ divider)
  - **4.0**: Less common but possible

**Calibration Process**:
1. Connect fully charged battery (should read ~4.2V for LiPo)
2. Read ADC value and calculate voltage
3. Compare with multimeter reading
4. Adjust `VOLTAGE_DIVIDER_RATIO` until readings match
5. Test at different voltage levels (full, half, empty)

### Typical Voltage Ranges

**LiPo Battery**:
- **Full**: 4.2V (100% charged)
- **Nominal**: 3.7V (typical operating voltage)
- **Empty**: 3.0V (discharge cutoff)
- **Warning**: < 3.3V (low battery, consider charging)

**USB Power**:
- **Typical**: 4.8V - 5.2V (USB power supply)
- **Range**: 4.5V - 5.5V (USB specification)

**Solar Power**:
- **Charging**: 4.0V - 4.2V (when solar panel is active)
- **Discharging**: 3.0V - 3.7V (when solar panel is inactive)

### ADC Accuracy Considerations

**Noise and Stability**:
- ESP8266 ADC can have some noise (±0.05V typical)
- Multiple readings with averaging can improve accuracy
- For battery monitoring, ±0.1V accuracy is sufficient
- Single reading is acceptable for most use cases

**Improving Accuracy** (Optional):
- Take 5-10 readings and average
- Discard outliers (min/max)
- Use median value
- Add small delay between readings (10-20ms)

### Integration with Existing Features

**Deep Sleep Compatibility**:
- Voltage reading works with deep sleep mode
- Voltage measured before entering sleep
- Voltage included in last reading before sleep
- No impact on deep sleep functionality

**Bundling Compatibility**:
- Voltage included in each bundled reading
- No special handling needed
- Voltage sent with other sensor data

**Display Integration** (Optional):
- Can display voltage on OLED screen
- Format: `"V: 3.75V"` (compact)
- Position: Bottom of screen or replace WiFi status
- Useful for on-device monitoring

### Error Handling

**Invalid ADC Readings**:
- ADC value 0 or 1023 may indicate hardware issue
- Log warning but don't fail entire reading
- Set voltage to 0.0 or -1.0 to indicate error
- Continue with other sensor readings

**Out-of-Range Voltage**:
- Voltage < 2.5V: Possible hardware issue or very low battery
- Voltage > 5.5V: Possible overvoltage or measurement error
- Log warning but still send data
- Helps identify hardware problems remotely

### Testing Scenarios

1. **Normal Operation**: Voltage reading included in each cycle, values in expected range
2. **Battery Power**: Test with battery at different charge levels (full, half, empty)
3. **USB Power**: Test with USB power supply (should read ~5V)
4. **Calibration**: Compare readings with multimeter, adjust divider ratio
5. **JSON Payload**: Verify voltage appears in server logs/database
6. **Display**: Optional - verify voltage appears on OLED screen

### Performance Impact

**Code Size**: 
- Minimal increase (~100-200 bytes)
- Function is simple, no external libraries

**Execution Time**:
- ADC read: ~1ms
- Calculation: < 1ms
- Total overhead: ~2ms per reading cycle
- Negligible impact on overall performance

**Power Consumption**:
- ADC reading: ~1mA for ~1ms
- Negligible impact on battery life
- Much less than WiFi transmission or sensor reading

### Future Enhancements (Out of Scope)

**Low Battery Warning**:
- Monitor voltage and warn when < 3.3V
- Could trigger deep sleep or reduce transmission frequency
- Could send alert to server

**Battery Percentage**:
- Convert voltage to battery percentage
- Requires battery discharge curve
- More complex, can add later

**Voltage History**:
- Track voltage over time
- Detect battery degradation
- Requires server-side storage and analysis

**Multiple Voltage Readings**:
- Average multiple readings for accuracy
- Discard outliers
- Can improve accuracy if needed

## Changelog

### 2024-12-19 - Feature Extension
**Change:** Added frontend requirement to display voltage in admin panel board cards  
**Reason:** User requested voltage visibility in admin interface for easier monitoring  
**Impact:** Extends scope to include frontend implementation in BoardCard component  
**Files Affected:** `frontend/src/components/admin/BoardCard.jsx`  
**New Requirement:** R7 - Voltage Display in Admin Panel

