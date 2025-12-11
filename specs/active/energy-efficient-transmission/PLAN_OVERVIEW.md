# Implementation Plan Overview: Energy-Efficient WiFi-On-Demand Mode

## Requirements Summary

1. **WiFi Connection Strategy**: Connect to WiFi ONLY when buffer is full and data is ready for transmission
2. **WiFi Disconnection**: Turn off WiFi immediately after successful transmission
3. **Deep Sleep Cycle**: Board enters deep sleep for 10 seconds, then wakes up to measure sensors
4. **Frontend Configuration**: Web-based configuration via Connect page (no console commands)

## Architecture Overview

### Current Flow (Continuous Operation)
```
Loop → Check WiFi → Read Sensors → Add to Buffer → 
Check Bundle → Transmit (if ready) → Continue Loop
```

### New Flow (WiFi-On-Demand + Deep Sleep)
```
Wake from Deep Sleep (10s) → 
Read Sensors → 
Add to Buffer → 
Check if Buffer Full → 
  [If Full] → Connect WiFi → Transmit → Disconnect WiFi → Deep Sleep (10s)
  [If Not Full] → Deep Sleep (10s)
```

## Technical Decisions

### 1. Configuration Mode
- **New Config Flag**: `ENABLE_WIFI_ON_DEMAND` (boolean)
- **Deep Sleep Duration**: Fixed at 10 seconds (10000000 microseconds)
- **Compatibility**: Works with existing bundling system

### 2. WiFi Management
- **Connection**: Only when `bufferCount >= MAX_BUNDLE_SIZE` OR `shouldTransmitBundle() == true`
- **Disconnection**: Immediately after transmission (success or failure)
- **No Persistent Connection**: WiFi always off except during transmission

### 3. Deep Sleep Integration
- **Always Enabled**: When `ENABLE_WIFI_ON_DEMAND` is enabled, deep sleep is mandatory
- **Fixed Duration**: 10 seconds (configurable via `DEEP_SLEEP_DURATION_US`)
- **Wake Behavior**: Device restarts from `setup()`, then proceeds to `loop()`

### 4. Frontend Integration
- **New UI Option**: "WiFi-On-Demand Mode" checkbox
- **Auto-enables**: Deep sleep when WiFi-on-demand is enabled
- **Validation**: Ensures bundling is enabled (required for this mode)

## Implementation Components

### Firmware Changes (`src/main.cpp`)
1. Add `ENABLE_WIFI_ON_DEMAND` configuration check
2. Modify `loop()` to skip WiFi connection check when in on-demand mode
3. Add WiFi connection logic only when buffer is ready
4. Ensure WiFi disconnection after transmission
5. Force deep sleep after each cycle (10 seconds)

### Configuration Changes (`include/config.h`)
1. Add `ENABLE_WIFI_ON_DEMAND` define
2. Ensure `ENABLE_BUNDLING` is required when WiFi-on-demand is enabled
3. Set default deep sleep duration to 10 seconds for this mode

### Backend Changes (`server/board_manager.py`)
1. Add `enable_wifi_on_demand` parameter to `apply_wifi_credentials()`
2. Update config.h generation to include new flag
3. Validate that bundling is enabled when WiFi-on-demand is enabled

### Frontend Changes (`frontend/src/pages/Connect.jsx`)
1. Add "WiFi-On-Demand Mode" checkbox
2. Auto-enable bundling when WiFi-on-demand is checked
3. Auto-enable deep sleep when WiFi-on-demand is checked
4. Show/hide related configuration options
5. Update API call to include new parameter

### API Changes (`frontend/src/services/api.js`)
1. Add `enableWifiOnDemand` parameter to `uploadFirmware()`

## Key Implementation Details

### WiFi Connection Logic
```cpp
#if ENABLE_WIFI_ON_DEMAND
  // Only connect WiFi when buffer is ready for transmission
  if (shouldTransmitBundle()) {
    if (WiFi.status() != WL_CONNECTED) {
      connectWiFi();
    }
    // Transmit...
    // Disconnect after transmission
    WiFi.disconnect();
    WiFi.mode(WIFI_OFF);
  }
#else
  // Normal mode: maintain WiFi connection
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
  }
#endif
```

### Deep Sleep Integration
```cpp
#if ENABLE_WIFI_ON_DEMAND
  // Always deep sleep after cycle (10 seconds)
  enterDeepSleep();  // Uses DEEP_SLEEP_DURATION_US (10 seconds)
#elif ENABLE_DEEP_SLEEP
  // Optional deep sleep (existing behavior)
  enterDeepSleep();
#endif
```

## Testing Strategy

1. **Unit Tests**: Verify buffer logic and WiFi connection timing
2. **Integration Tests**: Test full cycle (wake → measure → buffer → transmit → sleep)
3. **Power Consumption Tests**: Measure actual power usage
4. **Frontend Tests**: Verify configuration UI and API integration

## Migration Path

1. **Phase 1**: Implement firmware changes (backward compatible)
2. **Phase 2**: Update backend to support new configuration
3. **Phase 3**: Update frontend UI
4. **Phase 4**: Testing and validation
5. **Phase 5**: Documentation and deployment

---

**Next**: Create detailed plan.md with full technical specifications






