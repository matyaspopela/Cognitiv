# Implementation Strategy: WiFi-On-Demand Mode

## Execution Order

### Phase 1: Firmware Foundation (30 min)
- Add `ENABLE_WIFI_ON_DEMAND` configuration to `include/config.h`
- Add configuration validation checks in `src/main.cpp`
- Ensure bundling requirement is enforced

### Phase 2: Firmware Core Logic (45 min)
- Modify `loop()` function to skip WiFi connection check in WiFi-on-demand mode
- Add WiFi connection logic only when buffer is ready
- Add WiFi disconnection after transmission
- Ensure deep sleep always happens in WiFi-on-demand mode

### Phase 3: Backend Integration (30 min)
- Update `server/board_manager.py` to handle `enable_wifi_on_demand` parameter
- Update `server/api/views.py` to process new parameter
- Add validation and auto-enable logic

### Phase 4: Frontend UI (40 min)
- Add WiFi-on-demand checkbox to Connect page
- Implement auto-enable logic for bundling and deep sleep
- Update API service to include new parameter
- Add UI feedback and validation

### Phase 5: Testing & Verification (20 min)
- Verify firmware compiles
- Test configuration flow
- Verify end-to-end functionality

**Total Estimated Time**: ~2.5 hours

## Pattern Reuse

- **Configuration Pattern**: Follow existing `ENABLE_BUNDLING` and `ENABLE_DEEP_SLEEP` pattern
- **UI Pattern**: Follow existing checkbox pattern in Connect.jsx
- **Backend Pattern**: Follow existing `apply_wifi_credentials()` parameter handling
- **Firmware Pattern**: Follow existing `#if ENABLE_*` conditional compilation pattern

## Key Implementation Details

1. **WiFi Connection**: Only when `shouldTransmitBundle()` returns true
2. **WiFi Disconnection**: Immediately after transmission (success or failure)
3. **Deep Sleep**: Always enabled and set to 10 seconds in WiFi-on-demand mode
4. **Bundling**: Auto-enabled when WiFi-on-demand is enabled
5. **Validation**: Backend ensures bundling is enabled when WiFi-on-demand is enabled

## Success Criteria

- ✅ WiFi connects only when buffer ready
- ✅ WiFi disconnects after transmission
- ✅ Deep sleep always happens (10 seconds)
- ✅ Configuration works through web UI
- ✅ Code compiles without errors
- ✅ All existing functionality preserved (backward compatible)






