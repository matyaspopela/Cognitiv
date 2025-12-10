# http-request-bundling Feature Brief

## 🎯 Context (2min)
**Problem**: The current architecture sends an HTTP POST request with every single CO2 transmission (every 10 seconds based on `READING_INTERVAL_MS`). This creates excessive network traffic, increases power consumption on the ESP8266 device, and places unnecessary load on the server. For a device reading every 10 seconds, this means 360 requests per hour, which is inefficient for IoT applications.

**Users**: 
- ESP8266 IoT device (primary beneficiary - reduced power consumption)
- Server infrastructure (reduced request load)
- Network infrastructure (reduced bandwidth usage)

**Success**: The system bundles multiple sensor readings and sends them periodically (e.g., every 5 minutes or every 30 readings), reducing HTTP requests by 90%+ while maintaining data integrity and ensuring no data loss during normal operation.

## 🔍 Quick Research (15min)
### Existing Patterns
- **HTTP Request Pattern** (`src/main.cpp:465-517`) → `sendDataToServer()` sends single `SensorData` struct immediately after each reading | Reuse: HTTP client setup, JSON serialization approach
- **SensorData Structure** (`src/main.cpp:58-64`) → Struct contains `temperature`, `humidity`, `co2`, `timestamp`, `valid` (~16 bytes per reading) | Reuse: Data structure for buffer entries
- **JSON Serialization** (`src/main.cpp:480-488`) → Uses `StaticJsonDocument<256>` for single reading | Reuse: JSON library, but need larger document for arrays
- **Configuration Pattern** (`include/config.h`) → Uses `#define` macros for configurable values like `READING_INTERVAL_MS` | Reuse: Add `BUNDLE_INTERVAL_MS` and `MAX_BUNDLE_SIZE` macros
- **Loop Timing** (`src/main.cpp:161-189`) → Uses `millis()` for interval checking | Reuse: Similar pattern for bundle transmission timing

### Memory Constraints
- **ESP8266 RAM**: ~80KB total, ~50KB typically free after WiFi/stack allocation
- **Current JSON Size**: 256 bytes per reading (StaticJsonDocument<256>)
- **SensorData Size**: ~16 bytes per struct (float + float + uint16_t + unsigned long + bool)
- **Buffer Capacity**: Can safely store 20-30 readings (~320-480 bytes) without memory issues
- **JSON Array Size**: For 10 readings: ~2.5KB JSON document needed (StaticJsonDocument<2560>)

### Tech Decision
**Approach**: Circular buffer or fixed-size array with periodic batch transmission
- **Why**: 
  - Simple implementation, predictable memory usage
  - No dynamic allocation (avoids heap fragmentation on ESP8266)
  - Configurable bundling interval via `config.h`
  - Maintains data even during WiFi disconnections
- **Avoid**: 
  - Dynamic arrays/vectors (heap fragmentation risk)
  - Queue libraries (unnecessary complexity)
  - SD card storage (not available, adds complexity)

## ✅ Requirements (10min)

### Core Features

**R1: Reading Buffer**
- System stores multiple `SensorData` readings in a fixed-size buffer
- Buffer size configurable via `MAX_BUNDLE_SIZE` in `config.h` (default: 10 readings)
- Buffer persists across WiFi disconnections
- **Acceptance**: Device can store 10 readings without sending, verified via serial output

**R2: Periodic Batch Transmission**
- System sends bundled readings at configurable interval via `BUNDLE_INTERVAL_MS` in `config.h`
- Default: 300000ms (5 minutes) or when buffer reaches `MAX_BUNDLE_SIZE`
- Transmission occurs even if buffer not full (time-based trigger)
- **Acceptance**: Readings sent every 5 minutes or when 10 readings accumulated, whichever comes first

**R3: Array JSON Format**
- Bundled data sent as JSON array: `[{reading1}, {reading2}, ...]`
- Each reading maintains same structure: `timestamp`, `device_id`, `temperature`, `humidity`, `co2`
- Server must accept array format (may require server-side update)
- **Acceptance**: Server receives array of readings, all fields present and valid

**R4: Buffer Overflow Protection**
- If buffer reaches `MAX_BUNDLE_SIZE`, oldest readings are overwritten (circular buffer) OR transmission forced
- Prevents memory exhaustion
- Logs warning when overflow occurs
- **Acceptance**: After 11 readings without transmission, oldest reading replaced or transmission triggered

**R5: WiFi Disconnection Handling**
- Buffer retained during WiFi disconnection
- Transmission attempted when WiFi reconnects
- No data loss during temporary network issues
- **Acceptance**: Device disconnects WiFi, accumulates 5 readings, reconnects, sends all 5 readings

**R6: Backward Compatibility Consideration**
- Implementation in `main.cpp` only (as requested)
- Server endpoint may need update to handle array format
- Consider fallback to single-reading format if server doesn't support arrays
- **Acceptance**: Code structured to easily support both formats if needed

## 🏗️ Implementation (5min)

### Components

**Buffer Management**:
- Add `SensorData readingBuffer[MAX_BUNDLE_SIZE]` array
- Add `uint8_t bufferIndex = 0` and `uint8_t bufferCount = 0` tracking variables
- Add `unsigned long lastBundleTime = 0` for timing
- Function: `void addToBuffer(SensorData data)` - adds reading, handles overflow
- Function: `bool shouldTransmitBundle()` - checks time interval and buffer size

**Modified Transmission**:
- Modify `sendDataToServer()` to accept array: `bool sendDataToServer(SensorData* readings, uint8_t count)`
- Create JSON array using `StaticJsonDocument<2560>` (for up to 10 readings)
- Serialize array format: `[{...}, {...}, ...]`
- Clear buffer after successful transmission
- Retry logic: Keep buffer if transmission fails

**Configuration**:
- Add to `include/config.h`:
  - `#define BUNDLE_INTERVAL_MS 300000` (5 minutes)
  - `#define MAX_BUNDLE_SIZE 10` (number of readings per bundle)

**Loop Modification**:
- In `loop()`, replace immediate `sendDataToServer(reading)` call
- Add reading to buffer: `addToBuffer(reading)`
- Check if bundle should be sent: `if (shouldTransmitBundle())`
- Send bundle: `sendDataToServer(readingBuffer, bufferCount)`
- Reset buffer after successful send

### APIs

**Modified Function**:
- `bool sendDataToServer(SensorData* readings, uint8_t count)` - Sends array of readings
  - Request body: `[{timestamp, device_id, temperature, humidity, co2}, ...]`
  - Response: HTTP 200 on success

**Server Compatibility**:
- Current endpoint: `POST /data` expects single reading object
- May need server update to accept array: `POST /data` expects array of reading objects
- Alternative: Use new endpoint `POST /data/batch` if server supports it

### Data Changes
- No database schema changes (server-side may need array handling)
- Memory usage: +~160 bytes for buffer (10 readings × 16 bytes)
- JSON document size: 256 bytes → 2560 bytes (for 10 readings)

## 📋 Next Actions (2min)
- [ ] Add buffer variables and configuration to `src/main.cpp` (10min)
- [ ] Implement `addToBuffer()` function with overflow handling (15min)
- [ ] Implement `shouldTransmitBundle()` function with time/count checks (10min)
- [ ] Modify `sendDataToServer()` to accept array and create JSON array format (20min)
- [ ] Update `loop()` to use buffer instead of immediate transmission (10min)
- [ ] Add `BUNDLE_INTERVAL_MS` and `MAX_BUNDLE_SIZE` to `include/config.h` (5min)
- [ ] Test with various bundling intervals and buffer sizes (20min)
- [ ] Verify server compatibility (may need server-side update) (15min)
- [ ] Test WiFi disconnection/reconnection scenario (10min)

**Start Coding In**: ~2 hours total implementation time

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

### Memory Considerations
- **ESP8266 Free RAM**: ~50KB typically available
- **Buffer Size**: 10 readings × 16 bytes = 160 bytes (safe)
- **JSON Document**: StaticJsonDocument<2560> = 2560 bytes (acceptable, but monitor)
- **Total Overhead**: ~2.7KB additional memory usage
- **Recommendation**: Start with MAX_BUNDLE_SIZE=10, adjust based on testing

### Bundling Strategy
- **Time-Based**: Send every `BUNDLE_INTERVAL_MS` regardless of buffer fill
- **Size-Based**: Send when buffer reaches `MAX_BUNDLE_SIZE`
- **Combined**: Send when either condition met (whichever comes first)
- **Default**: 5 minutes OR 10 readings (whichever comes first)

### Server Compatibility
- **Current Format**: Single object `{timestamp, device_id, temperature, humidity, co2}`
- **New Format**: Array `[{...}, {...}, ...]`
- **Server Update Needed**: Backend must accept array and process each reading
- **Fallback Option**: If server doesn't support arrays, can send individual requests from buffer (defeats purpose but maintains compatibility)

### Error Handling
- **Transmission Failure**: Keep buffer, retry on next interval
- **WiFi Disconnect**: Retain buffer, send when reconnected
- **Buffer Overflow**: Log warning, overwrite oldest or force transmission
- **JSON Serialization Failure**: Log error, clear buffer to prevent memory leak

### Testing Scenarios
1. **Normal Operation**: Readings accumulate, sent every 5 minutes
2. **Rapid Readings**: Buffer fills quickly, sent when MAX_BUNDLE_SIZE reached
3. **WiFi Disconnect**: Buffer retained, sent on reconnect
4. **Server Unavailable**: Buffer retained, retry on next interval
5. **Power Cycle**: Buffer lost (acceptable - device resets)

### Performance Impact
- **Network Traffic**: Reduced by ~90% (1 request per 10 readings vs 10 requests)
- **Power Consumption**: Reduced WiFi radio usage (fewer connection cycles)
- **Server Load**: Reduced by ~90% (fewer HTTP requests to process)
- **Latency**: Data may be up to 5 minutes old (acceptable for environmental monitoring)






