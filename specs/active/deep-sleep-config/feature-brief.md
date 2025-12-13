# deep-sleep-config Feature Brief

## 🎯 Context (2min)
**Problem**: The device currently runs continuously in `loop()`, consuming significant power even when idle. For battery-powered or solar-powered deployments (common with LaskaKit AirBoard-8266), this leads to rapid battery drain and requires frequent recharging or large battery capacity. The ESP8266 supports deep sleep mode which can reduce power consumption by 90%+ (from ~80mA active to ~20µA in deep sleep), but this feature is not currently implemented or configurable.

**Users**: 
- Battery-powered IoT devices (primary beneficiary - extended battery life)
- Solar-powered deployments (reduced power requirements)
- Long-term monitoring installations (weeks/months without maintenance)
- Users deploying LaskaKit AirBoard-8266 with battery/solar power

**Success**: The system supports configurable deep sleep mode that can be enabled/disabled and duration adjusted via `config.h`, allowing users to optimize power consumption for their deployment scenario. Device enters deep sleep after completing sensor reading and transmission cycle, then wakes up automatically to repeat the cycle.

## 🔍 Quick Research (15min)
### Existing Patterns
- **Configuration Pattern** (`include/config.h`) → Uses `#define` macros for configurable values like `ENABLE_BUNDLING`, `READING_INTERVAL_MS` | Reuse: Add `ENABLE_DEEP_SLEEP` and `DEEP_SLEEP_DURATION_US` macros following same pattern
- **Loop Structure** (`src/main.cpp:156-210`) → Continuous loop with sensor reading and transmission | Reuse: Add deep sleep call after cycle completion
- **Conditional Compilation** (`src/main.cpp:183-197`) → Uses `#if ENABLE_BUNDLING` for feature toggling | Reuse: Similar pattern for `#if ENABLE_DEEP_SLEEP`
- **WiFi Management** (`src/main.cpp:401-504`) → `connectWiFi()` function handles WiFi connection | Reuse: Disconnect WiFi before deep sleep to save power
- **Display Management** (`src/main.cpp:194-285`) → Display functions with `#ifdef HAS_DISPLAY` | Reuse: Turn off display before deep sleep

### ESP8266 Deep Sleep Technical Details
- **API**: `ESP.deepSleep(microseconds, mode)` - ESP8266 built-in function
- **Modes**: `WAKE_NO_RFCAL`, `WAKE_RFCAL`, `WAKE_NO_RFCAL`, `WAKE_DEFAULT` (recommended: `WAKE_RFCAL` for WiFi)
- **Duration**: Specified in microseconds (e.g., 60 seconds = 60,000,000 µs)
- **Wake-up**: Device completely restarts (setup() runs again) - no state preservation by default
- **RTC Memory**: Available for state preservation (optional, 512 bytes)
- **Power Consumption**: ~20µA in deep sleep vs ~80mA active (99.975% reduction)

### LaskaKit AirBoard-8266 Requirements
- **Hardware Setup**: EN (Enable) and IO16 (GPIO16) pins must be connected for deep sleep wake-up
- **Documentation**: According to [LaskaKit AirBoard-8266 product page](https://www.laskakit.cz/en/laskakit-airboard-8266-deska-pro-mereni-kvality-vzduchu/), deep sleep requires connecting EN and IO16 pins
- **Wake-up Mechanism**: RTC timer wakes device, GPIO16 pulls EN low to reset and wake
- **Power Management**: Board supports battery operation with proper deep sleep implementation

### Tech Decision
**Approach**: Configurable deep sleep with cleanup before sleep
- **Why**: 
  - Simple implementation using ESP8266 built-in API
  - Configurable via `config.h` (consistent with existing patterns)
  - Significant power savings (90%+ reduction)
  - No additional dependencies required
  - Follows same pattern as `ENABLE_BUNDLING` feature
- **Avoid**: 
  - Light sleep mode (less power savings, more complex)
  - External RTC modules (unnecessary complexity)
  - Complex state preservation (device restarts anyway, setup() handles initialization)

## ✅ Requirements (10min)

### Core Features

**R1: Deep Sleep Enable/Disable**
- System supports enabling/disabling deep sleep via `ENABLE_DEEP_SLEEP` flag in `config.h`
- Default: Disabled (0) for backward compatibility
- When enabled: Device enters deep sleep after completing cycle
- When disabled: Device runs continuously (current behavior)
- **Acceptance**: Setting `ENABLE_DEEP_SLEEP 0` maintains current behavior, setting to `1` enables deep sleep

**R2: Configurable Sleep Duration**
- Sleep duration configurable via `DEEP_SLEEP_DURATION_US` in `config.h` (microseconds)
- Default: 60 seconds (60,000,000 microseconds)
- Range: 10 seconds minimum (10,000,000 µs) to 71 minutes maximum (4,294,967,295 µs - ESP8266 limit)
- Duration should align with `READING_INTERVAL_MS` for predictable behavior
- **Acceptance**: Device sleeps for configured duration, wakes up, and repeats cycle

**R3: Cycle Completion Before Sleep**
- Device completes full sensor reading and transmission cycle before entering deep sleep
- Ensures no data loss or incomplete operations
- Sleep occurs after successful transmission or timeout
- **Acceptance**: Serial output shows cycle completion before "Entering deep sleep" message

**R4: Proper Cleanup Before Sleep**
- WiFi disconnected before deep sleep (saves power)
- Display turned off before deep sleep (if HAS_DISPLAY enabled)
- Serial output logged before sleep (for debugging)
- All pending operations completed
- **Acceptance**: Serial monitor shows cleanup messages, device enters sleep cleanly

**R5: Wake-up Handling**
- Device wakes up automatically after sleep duration
- `setup()` function runs again (normal ESP8266 behavior)
- All initialization happens automatically (sensors, WiFi, etc.)
- Cycle repeats: setup → reading → transmission → sleep
- **Acceptance**: Device wakes up, initializes, takes reading, transmits, sleeps again

**R6: Hardware Requirement Documentation**
- Feature brief documents EN + IO16 connection requirement
- Implementation includes comments about hardware setup
- User must connect pins for deep sleep to work
- **Acceptance**: Documentation clearly states hardware requirement

## 🏗️ Implementation (5min)

### Components

**Configuration**:
- Add to `include/config.h`:
  - `#define ENABLE_DEEP_SLEEP 0` (default: disabled)
  - `#define DEEP_SLEEP_DURATION_US 60000000` (default: 60 seconds)

**Deep Sleep Function**:
- Function: `void enterDeepSleep()` - handles cleanup and enters deep sleep
- Location: After `connectWiFi()` function (around line 504)
- Behavior:
  - Disconnect WiFi
  - Turn off display (if HAS_DISPLAY)
  - Log sleep message to Serial
  - Call `ESP.deepSleep(DEEP_SLEEP_DURATION_US, WAKE_RFCAL)`

**Loop Modification**:
- In `loop()`, after sensor reading and transmission cycle completes
- Add conditional: `#if ENABLE_DEEP_SLEEP` check
- Call `enterDeepSleep()` after cycle completion
- Ensure sleep only happens after successful cycle (or timeout)

**Forward Declaration**:
- Add `void enterDeepSleep();` to forward declarations section (around line 100)

### APIs

**New Function**:
- `void enterDeepSleep()` - Enters deep sleep mode with proper cleanup
  - No parameters (uses global configuration)
  - No return value (device restarts after sleep)

**ESP8266 API Used**:
- `ESP.deepSleep(microseconds, mode)` - ESP8266 built-in deep sleep function
  - Parameters: Duration in microseconds, wake mode
  - Mode: `WAKE_RFCAL` (recommended for WiFi operation)

### Data Changes
- No database schema changes
- No memory changes (RTC memory optional, not required)
- Configuration only (compile-time flags)

## 📋 Next Actions (2min)
- [ ] Add deep sleep configuration macros to `include/config.h` (5min)
- [ ] Implement `enterDeepSleep()` function with cleanup (15min)
- [ ] Add forward declaration for `enterDeepSleep()` (2min)
- [ ] Modify `loop()` to call `enterDeepSleep()` after cycle completion (10min)
- [ ] Test deep sleep wake-up behavior (20min)
- [ ] Verify power consumption reduction (optional, requires hardware measurement) (10min)
- [ ] Document hardware requirement (EN + IO16 connection) (5min)

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

### Deep Sleep Duration Guidelines
- **Minimum**: 10 seconds (10,000,000 µs) - allows time for WiFi connection and transmission
- **Recommended**: 60 seconds (60,000,000 µs) - good balance of power savings and data frequency
- **Maximum**: 71 minutes (4,294,967,295 µs) - ESP8266 hardware limit
- **Alignment**: Should match or be multiple of `READING_INTERVAL_MS` for predictable behavior

### Power Consumption Impact
- **Active Mode**: ~80mA (WiFi connected, sensors active)
- **Deep Sleep Mode**: ~20µA (all systems off, RTC only)
- **Power Reduction**: 99.975% reduction in sleep mode
- **Battery Life**: 4,000x longer in sleep mode (e.g., 1 day active = 11 years sleep)

### Wake-up Behavior
- **Complete Restart**: Device fully reboots after wake-up
- **Setup() Runs**: All initialization happens automatically
- **No State Loss**: Since device restarts, no state preservation needed
- **Cycle Repeats**: setup() → loop() → reading → transmission → sleep → (wake) → setup() → ...

### Hardware Requirements
- **EN + IO16 Connection**: Must be connected for deep sleep wake-up to work
- **LaskaKit AirBoard-8266**: According to [product documentation](https://www.laskakit.cz/en/laskakit-airboard-8266-deska-pro-mereni-kvality-vzduchu/), connect EN and IO16 pins
- **Battery Operation**: Deep sleep essential for battery-powered deployments
- **Solar Power**: Deep sleep reduces power requirements, making solar viable

### Integration with Bundling
- **Compatible**: Deep sleep works with both bundling and immediate transmission modes
- **Sleep Timing**: Should enter sleep after bundle transmission (if bundling enabled)
- **Wake-up**: Device wakes, takes reading, adds to buffer (if bundling), sleeps again
- **No Conflict**: Both features can be enabled simultaneously

### Error Handling
- **Transmission Failure**: Should still enter sleep (prevents infinite retry loops)
- **WiFi Disconnect**: Disconnect before sleep regardless of connection state
- **Sensor Error**: Enter sleep even if sensor reading fails (prevents power drain)
- **Serial Output**: Log all cleanup steps for debugging

### Testing Scenarios
1. **Normal Operation**: Device completes cycle, enters sleep, wakes up, repeats
2. **Short Duration**: Test with 10-second sleep (quick verification)
3. **Long Duration**: Test with 5-minute sleep (verify wake-up reliability)
4. **Disabled Mode**: Verify `ENABLE_DEEP_SLEEP 0` maintains current behavior
5. **Hardware Test**: Verify EN + IO16 connection requirement (if hardware available)

### Performance Impact
- **Power Consumption**: 99.975% reduction during sleep
- **Data Frequency**: Determined by sleep duration (not reading interval when sleeping)
- **Battery Life**: Extended from hours/days to weeks/months
- **Solar Compatibility**: Makes solar-powered deployments viable















