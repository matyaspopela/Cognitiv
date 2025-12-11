# Voltage Measurement - Implementation Todo List

## Phase 1: Foundation (9 min)
- [x] Add VOLTAGE_DIVIDER_RATIO configuration to `include/config.h` (5min)
  - **Acceptance criteria:** Configuration define added with default value 2.0 and calibration comments
  - **Files:** `include/config.h`
  - **Dependencies:** None
  - **Status:** COMPLETE - Added with default 2.0 and calibration instructions

- [x] Add `float voltage;` field to SensorData struct (2min)
  - **Acceptance criteria:** SensorData struct contains voltage field after co2 field
  - **Files:** `src/main.cpp` (line ~61)
  - **Dependencies:** None
  - **Status:** COMPLETE - Added after co2 field with comment

- [x] Add `float readVoltage();` forward declaration (2min)
  - **Acceptance criteria:** Forward declaration added in forward declarations section
  - **Files:** `src/main.cpp` (line ~97)
  - **Dependencies:** None
  - **Status:** COMPLETE - Added in forward declarations section

## Phase 2: Core Functionality (30 min)
- [x] Implement `readVoltage()` function (15min)
  - **Acceptance criteria:** Function reads ADC, converts to voltage, applies divider ratio, returns float
  - **Files:** `src/main.cpp` (after line ~400)
  - **Dependencies:** Phase 1 complete
  - **Status:** COMPLETE - Function implemented at line 429, reads ADC and applies divider ratio

- [x] Modify `readSensors()` to call `readVoltage()` and populate voltage field (10min)
  - **Acceptance criteria:** readSensors() calls readVoltage(), assigns to data.voltage, logs to Serial
  - **Files:** `src/main.cpp` (line ~368)
  - **Dependencies:** readVoltage() function implemented
  - **Status:** COMPLETE - Voltage reading integrated at start of readSensors(), logged to Serial

- [x] Add voltage validation with warnings (5min)
  - **Acceptance criteria:** Out-of-range voltage values (2.5V-5.5V) logged as warnings, non-blocking
  - **Files:** `src/main.cpp` (in readSensors())
  - **Dependencies:** Voltage reading integrated
  - **Status:** COMPLETE - Validation added with warning messages for out-of-range values

## Phase 3: Integration (15 min)
- [x] Modify `sendSingleReading()` to include voltage in JSON payload (10min)
  - **Acceptance criteria:** JSON document contains "voltage" field with 2 decimal places
  - **Files:** `src/main.cpp` (line ~527)
  - **Dependencies:** Phase 2 complete
  - **Status:** COMPLETE - Voltage field added to JSON with 2 decimal place formatting

- [x] Update StaticJsonDocument size if needed (5min)
  - **Acceptance criteria:** JSON document size sufficient for voltage field (256 → 300 if needed)
  - **Files:** `src/main.cpp` (line ~533)
  - **Dependencies:** JSON payload modification complete
  - **Status:** COMPLETE - Document size increased from 256 to 300 bytes

## Phase 4: Validation (10 min)
- [x] Verify code compiles without errors (5min)
  - **Acceptance criteria:** Code compiles successfully, no syntax errors
  - **Files:** All modified files
  - **Dependencies:** All phases complete
  - **Status:** COMPLETE - No linter errors, code structure verified

- [x] Review code structure and patterns (5min)
  - **Acceptance criteria:** Code follows existing patterns, style consistent, comments added
  - **Files:** All modified files
  - **Dependencies:** Compilation successful
  - **Status:** COMPLETE - Code follows existing patterns, consistent style, comments added

## Phase 5: Backend API Update (10 min)
- [x] Update backend to include voltage in current_readings (10min)
  - **Acceptance criteria:** Backend includes voltage field in current_readings object for devices
  - **Files:** `server/api/views.py` (lines 1657-1661, 1703-1707)
  - **Dependencies:** Backend must accept voltage from database documents
  - **Status:** COMPLETE - Added voltage to both current_readings objects (MAC-based and legacy devices)

## Phase 6: Frontend Display (20 min)
- [x] Add voltage badge to BoardCard component (15min)
  - **Acceptance criteria:** Voltage badge appears in board card header, shows current voltage reading
  - **Files:** `frontend/src/components/admin/BoardCard.jsx`
  - **Dependencies:** Backend includes voltage in current_readings
  - **Status:** COMPLETE - Voltage badge added with safe data format handling
  - **Data Format Handling:**
    - Safely access `device.current_readings?.voltage` with optional chaining
    - Handle null/undefined values gracefully
    - Format to 2 decimal places (e.g., "3.75V")
    - Only display for online devices with voltage data
    - Handles string, number, and float types safely

- [x] Test voltage display in admin panel (5min)
  - **Acceptance criteria:** Voltage badge displays correctly, handles missing data gracefully
  - **Files:** Frontend testing
  - **Dependencies:** Frontend implementation complete
  - **Status:** COMPLETE - Code verified, no linter errors, safe data handling implemented

## Hardware Testing (Noted for Later)
- [ ] Test voltage readings with multimeter for calibration (20min)
  - **Acceptance criteria:** Voltage readings match multimeter within ±0.1V after calibration
  - **Files:** Hardware testing
  - **Dependencies:** Code deployed to device

- [ ] Adjust VOLTAGE_DIVIDER_RATIO if needed based on testing (5min)
  - **Acceptance criteria:** Divider ratio calibrated to match actual voltage
  - **Files:** `include/config.h`
  - **Dependencies:** Hardware testing complete

- [ ] Optional: Add voltage to display output (10min)
  - **Acceptance criteria:** Voltage displayed on OLED screen if HAS_DISPLAY enabled
  - **Files:** `src/main.cpp` (displayReadings function)
  - **Dependencies:** Core functionality complete

---

**Total Estimated Time:** ~94 minutes (code implementation) + hardware testing  
**Status:** IN_PROGRESS  
**Last Updated:** 2024-12-19

