# HTTP Request Bundling - Implementation Todo List

**Feature**: HTTP Request Bundling for CO2 Transmission  
**Source**: [plan.md](plan.md)  
**Date**: 2024-12-19

## Phase 1: Configuration and Setup

- [x] **Add bundle configuration to `include/config.h`** (5min)
  - **Acceptance criteria**: `BUNDLE_INTERVAL_MS` and `MAX_BUNDLE_SIZE` macros added
  - **Files**: `include/config.h`
  - **Dependencies**: None

## Phase 2: Core Buffer Functionality

- [x] **Add buffer global variables to `src/main.cpp`** (5min)
  - **Acceptance criteria**: `readingBuffer[]`, `bufferCount`, and `lastBundleTime` variables declared
  - **Files**: `src/main.cpp` (after line 67)
  - **Dependencies**: Configuration macros must exist

- [x] **Add forward declarations for new functions** (2min)
  - **Acceptance criteria**: `addToBuffer()` and `shouldTransmitBundle()` declared in forward declarations section
  - **Files**: `src/main.cpp` (around line 96)
  - **Dependencies**: None

- [x] **Implement `addToBuffer()` function** (10min)
  - **Acceptance criteria**: Function adds reading to buffer, handles overflow, logs status
  - **Files**: `src/main.cpp` (after `readSensors()` function, around line 399)
  - **Dependencies**: Buffer variables must exist

- [x] **Implement `shouldTransmitBundle()` function** (10min)
  - **Acceptance criteria**: Function checks time and size conditions, returns boolean
  - **Files**: `src/main.cpp` (after `addToBuffer()` function)
  - **Dependencies**: Buffer variables and configuration must exist

## Phase 3: Transmission Integration

- [x] **Modify `sendDataToServer()` function signature and implementation** (20min)
  - **Acceptance criteria**: 
    - Function accepts `SensorData* readings, uint8_t count`
    - Creates JSON array instead of single object
    - Uses `StaticJsonDocument<2560>` instead of `<256>`
    - Clears buffer on success, retains on failure
  - **Files**: `src/main.cpp` (lines 465-517)
  - **Dependencies**: Buffer functions must exist

- [x] **Update `loop()` to use buffer instead of immediate transmission** (10min)
  - **Acceptance criteria**: 
    - Replaces `sendDataToServer(reading)` with `addToBuffer(reading)`
    - Adds bundle transmission check and call
    - Maintains WiFi state checking
  - **Files**: `src/main.cpp` (lines 173-182)
  - **Dependencies**: All buffer functions must exist

## Phase 4: Verification

- [x] **Verify code compiles without errors** (5min)
  - **Acceptance criteria**: PlatformIO build succeeds, no compilation errors
  - **Files**: All modified files
  - **Dependencies**: All previous tasks complete

---

**Total Estimated Time**: ~67 minutes  
**Status**: ✅ Complete

## Implementation Summary

All tasks completed successfully:
- ✅ Configuration added to `include/config.h`
- ✅ Buffer variables added to `src/main.cpp`
- ✅ Forward declarations added
- ✅ `addToBuffer()` and `shouldTransmitBundle()` functions implemented
- ✅ `sendDataToServer()` modified for array format
- ✅ `loop()` updated to use buffering
- ✅ Code compiles successfully (RAM: 38.9%, Flash: 39.7%)

**Ready for device testing and deployment.**

