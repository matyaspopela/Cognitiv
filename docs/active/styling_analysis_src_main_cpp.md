# Code Styling & Maintainability Analysis: src/main.cpp

**Date:** February 9, 2026
**Target:** `src/main.cpp`
**Auditor:** Gemini CLI (Security & Quality Auditor)

## 1. Executive Summary
`src/main.cpp` follows a monolithic Arduino-style structure. While functional, the codebase mixes low-level hardware control, network logic, and business rules, leading to poor maintainability. The style is generally consistent but suffers from excessive use of global variables and preprocessor directives, making it hard to test and extend.

## 2. ⚠️ Styling & Structure Issues

### 2.1 Monolithic File Structure
- **Issue:** All logic (WiFi, MQTT, Sensors, Display, Power Management) is contained in a single 600+ line file.
- **Impact:**
  - **Readability:** Hard to navigate.
  - **Maintainability:** Changes in one area (e.g., changing the display library) require editing the main logic file.
  - **Testing:** Impossible to unit test individual components (e.g., sensor validation logic) in isolation.
- **Recommendation:** Refactor into classes:
  - `NetworkManager`: Handles WiFi and MQTT connection/reconnection.
  - `SensorManager`: Wraps SCD41 and voltage reading, including validation and warmup logic.
  - `DisplayManager`: Encapsulates all OLED drawing commands.
  - `PowerManager`: Manages deep sleep and quiet hours logic.

### 2.2 Global State Abuse
- **Issue:** Excessive reliance on global variables (`wifiState`, `mqttClient`, `scd41`, `ledOn`, `deviceMacAddress`).
- **Impact:** Makes state management unpredictable and functions dependent on hidden side effects.
- **Recommendation:** Pass dependencies into functions or class constructors. For example, pass `mqttClient` to a function that needs to publish data, rather than accessing the global instance.

### 2.3 Preprocessor Directive Clutter
- **Issue:** `#ifdef HAS_DISPLAY` and `#if QUIET_HOURS_ENABLED` are scattered throughout the code.
- **Impact:** Reduces code readability and makes the control flow harder to follow.
- **Recommendation:** Use polymorphism or null-object patterns. For example, a `DisplayManager` could have a mock implementation when the display is disabled, allowing the main code to call `display.showStatus()` without checking `#ifdef` every time.

### 2.4 Magic Numbers & Strings
- **Issue:** Hardcoded values scattered in logic (e.g., `delay(500)`, `30e6`, `"ESP8266_"`).
- **Impact:** Makes tuning and configuration difficult.
- **Recommendation:** Move all constants to `config.h` or defined constants at the top of the file/class.

## 3. 💡 Maintainability Improvements

### 3.1 Commenting Style
- **Observation:** Comments are generally helpful but sometimes redundant (e.g., `// Initialize LED pin`).
- **Recommendation:** Focus comments on *why* a decision was made (e.g., "Inverted logic: HIGH = OFF") rather than describing what the code does, which should be evident from variable/function names.

### 3.2 Naming Conventions
- **Observation:** Variable names are mostly clear (camelCase).
- **Recommendation:**
  - Standardize private class members with a trailing underscore (e.g., `mqttClient_`) or `m_` prefix if refactoring to classes.
  - Ensure all constants are `UPPER_SNAKE_CASE`.

### 3.3 String Usage
- **Issue:** Extensive use of `String` class (see Audit Report).
- **Recommendation:** Use `snprintf` and `char` arrays for fixed-format strings (like Topics or IDs) to improve memory stability.

## 4. ✅ Action Plan

1.  **Phase 1 (Immediate):** Fix critical formatting and clean up dead code (Warning Mode).
2.  **Phase 2 (Refactoring):** Extract `DisplayManager` and `NetworkManager` classes.
3.  **Phase 3 (Optimization):** Replace `String` usage with C-strings.

**Final Verdict:** **NEEDS REFACTORING** (To improve long-term maintainability)
