# Deep Sleep Configuration - Implementation Todo List

**Feature**: Configurable Deep Sleep Mode  
**Source**: [feature-brief.md](feature-brief.md)  
**Date**: 2024-12-19

## Phase 1: Configuration and Setup

- [x] **Add deep sleep configuration to `include/config.h`** (5min)
  - **Acceptance criteria**: `ENABLE_DEEP_SLEEP` and `DEEP_SLEEP_DURATION_US` macros added
  - **Files**: `include/config.h`
  - **Dependencies**: None

## Phase 2: Core Functionality

- [ ] **Add forward declaration for `enterDeepSleep()`** (2min)
  - **Acceptance criteria**: Function declared in forward declarations section
  - **Files**: `src/main.cpp` (around line 100)
  - **Dependencies**: None

- [x] **Implement `enterDeepSleep()` function** (15min)
  - **Acceptance criteria**: 
    - Function disconnects WiFi
    - Turns off display (if HAS_DISPLAY)
    - Logs sleep message to Serial
    - Calls `ESP.deepSleep()` with configured duration
  - **Files**: `src/main.cpp` (after `connectWiFi()` function, around line 504)
  - **Dependencies**: Configuration macros must exist

## Phase 3: Integration

- [x] **Modify `loop()` to call `enterDeepSleep()` after cycle completion** (10min)
  - **Acceptance criteria**: 
    - Deep sleep called after sensor reading and transmission cycle
    - Conditional compilation with `#if ENABLE_DEEP_SLEEP`
    - Sleep only happens after cycle completion (success or timeout)
  - **Files**: `src/main.cpp` (in `loop()` function, after transmission logic)
  - **Dependencies**: `enterDeepSleep()` function must exist

## Phase 4: Verification

- [x] **Verify code compiles without errors** (5min)
  - **Acceptance criteria**: PlatformIO build succeeds, no compilation errors
  - **Files**: All modified files
  - **Dependencies**: All previous tasks complete

---

**Total Estimated Time**: ~37 minutes  
**Status**: ✅ Complete

## Implementation Summary

All tasks completed successfully:
- ✅ Configuration added to `include/config.h`
- ✅ Forward declaration added
- ✅ `enterDeepSleep()` function implemented with proper cleanup
- ✅ `loop()` modified to call deep sleep after cycle completion
- ✅ Code compiles successfully (RAM: 38.9%, Flash: 39.7%)

**Ready for device testing. Note: EN and IO16 pins must be connected for deep sleep wake-up to work.**

