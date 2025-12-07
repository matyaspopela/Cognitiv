# HTTP Request Bundling - Technical Implementation Plan

## 📋 Plan Overview

**Feature**: HTTP Request Bundling for CO2 Transmission  
**Source**: [feature-brief.md](feature-brief.md)  
**Target File**: `src/main.cpp`  
**Platform**: ESP8266 (PlatformIO)  
**Date**: 2024-12-19

## 🎯 Objectives

Transform the current immediate HTTP transmission architecture into a batched bundling system that:
- Reduces HTTP requests by 90%+ (from 360/hour to ~12/hour)
- Maintains data integrity with no loss during normal operation
- Handles WiFi disconnections gracefully
- Operates within ESP8266 memory constraints (~50KB free RAM)

## 🏗️ Architecture Overview

### System Components

```
┌─────────────────┐
│  Sensor Reading │
│   (Every 10s)   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Buffer Manager │ ◄─── Configuration: MAX_BUNDLE_SIZE
│  - addToBuffer()│
│  - Fixed Array  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Transmission    │ ◄─── Configuration: BUNDLE_INTERVAL_MS
│ Controller      │
│ - shouldSend()  │
│ - Time/Size     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  HTTP Client    │
│  - sendBatch()  │
│  - JSON Array   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Server API    │
│  POST /data     │
└─────────────────┘
```

### Design Patterns

**1. Fixed-Size Buffer Pattern**
- Static array allocation (no dynamic memory)
- Prevents heap fragmentation on ESP8266
- Predictable memory usage

**2. Dual-Trigger Strategy**
- Time-based: Periodic transmission regardless of buffer fill
- Size-based: Immediate transmission when buffer full
- Whichever condition met first triggers transmission

**3. State Retention Pattern**
- Buffer persists across WiFi disconnections
- Failed transmissions retain buffer for retry
- Clear buffer only on successful transmission

### Data Flow

1. **Reading Phase**: Sensor reads data every `READING_INTERVAL_MS`
2. **Buffering Phase**: Valid readings added to `readingBuffer[]`
3. **Trigger Check**: Every loop iteration checks `shouldTransmitBundle()`
4. **Transmission Phase**: If triggered, serialize buffer to JSON array and POST
5. **Cleanup Phase**: On success, clear buffer and reset counters

## 🔧 Technology Stack

### Existing Technologies (No Changes)

- **Platform**: ESP8266 Arduino Core (via PlatformIO)
- **WiFi**: ESP8266WiFi library
- **HTTP**: ESP8266HTTPClient library
- **JSON**: ArduinoJson v6.21.3
- **Security**: BearSSL::WiFiClientSecure (HTTPS)

### Technology Justification

- **ArduinoJson StaticJsonDocument**: 
  - Static allocation prevents heap fragmentation
  - Upgraded from 256 to 2560 bytes for array support
  - No dynamic memory allocation needed

- **Fixed-Size Array**:
  - Simpler than circular buffer
  - Predictable memory footprint
  - Easier debugging and testing

- **No New Dependencies**:
  - All required libraries already in use
  - No additional PlatformIO dependencies needed

## 📊 Data Model

### Buffer Structure

```cpp
// Buffer storage
SensorData readingBuffer[MAX_BUNDLE_SIZE];  // Static array
uint8_t bufferCount = 0;                     // Current number of readings
unsigned long lastBundleTime = 0;            // Last transmission timestamp
```

### SensorData Structure (Existing)

```cpp
struct SensorData {
  float temperature;      // 4 bytes
  float humidity;         // 4 bytes
  uint16_t co2;          // 2 bytes
  unsigned long timestamp; // 4 bytes
  bool valid;            // 1 byte
  // Total: ~15 bytes per reading (rounded to 16 for alignment)
};
```

### JSON Payload Format

**Current Format (Single Reading)**:
```json
{
  "timestamp": 1234567890,
  "device_id": "esp12s_school_01",
  "temperature": 22.5,
  "humidity": 45.0,
  "co2": 450
}
```

**New Format (Bundled Array)**:
```json
[
  {
    "timestamp": 1234567890,
    "device_id": "esp12s_school_01",
    "temperature": 22.5,
    "humidity": 45.0,
    "co2": 450
  },
  {
    "timestamp": 1234567900,
    "device_id": "esp12s_school_01",
    "temperature": 22.6,
    "humidity": 45.1,
    "co2": 451
  }
]
```

### Memory Layout

- **Buffer Array**: `MAX_BUNDLE_SIZE × 16 bytes = 160 bytes` (default: 10 readings)
- **JSON Document**: `StaticJsonDocument<2560>` = 2560 bytes
- **Buffer Metadata**: `8 bytes` (bufferCount + lastBundleTime)
- **Total Overhead**: ~2.7KB (well within ESP8266's ~50KB free RAM)

## 🔌 API Design

### Modified Function Signature

**Current**:
```cpp
bool sendDataToServer(SensorData data);
```

**New**:
```cpp
bool sendDataToServer(SensorData* readings, uint8_t count);
```

### Function Contracts

#### `void addToBuffer(SensorData data)`
- **Input**: Single `SensorData` reading
- **Behavior**: 
  - Adds reading to `readingBuffer[bufferCount]`
  - Increments `bufferCount`
  - If `bufferCount >= MAX_BUNDLE_SIZE`, forces transmission
- **Side Effects**: Updates `bufferCount`, may trigger transmission
- **Error Handling**: Logs warning if buffer overflow occurs

#### `bool shouldTransmitBundle()`
- **Returns**: `true` if bundle should be transmitted
- **Conditions**:
  - Time-based: `(millis() - lastBundleTime) >= BUNDLE_INTERVAL_MS`
  - Size-based: `bufferCount >= MAX_BUNDLE_SIZE`
- **Logic**: Returns `true` if either condition met

#### `bool sendDataToServer(SensorData* readings, uint8_t count)`
- **Input**: Array pointer and count of readings
- **Returns**: `true` if HTTP 200 received
- **Behavior**:
  - Creates JSON array from readings
  - POSTs to `SERVER_URL`
  - On success: clears buffer, resets counters
  - On failure: retains buffer for retry
- **Error Handling**: Logs HTTP errors, retains buffer on failure

### HTTP Contract

**Endpoint**: `POST /data` (existing endpoint, may need server update)

**Request Headers**:
```
Content-Type: application/json
```

**Request Body**: JSON array of reading objects (see Data Model section)

**Response Codes**:
- `200 OK`: Success, buffer cleared
- `400 Bad Request`: Invalid JSON format
- `500 Internal Server Error`: Server processing error
- `-1`: Connection failed (WiFi/server unavailable)
- `-11`: Timeout

**Response Handling**:
- Success (200): Clear buffer, reset `bufferCount` and `lastBundleTime`
- Failure (any other): Retain buffer, log error, retry on next interval

## 🔒 Security Considerations

### Existing Security (No Changes)

- **HTTPS**: Already using `BearSSL::WiFiClientSecure`
- **Certificate**: Currently `setInsecure()` (TODO: certificate pinning for production)
- **No Authentication**: Server endpoint doesn't require auth (assumed internal network)

### New Security Implications

- **Buffer Overflow Protection**: Prevents memory corruption from excessive readings
- **Data Integrity**: Buffer retention ensures no data loss during network issues
- **No New Attack Surface**: Bundling doesn't introduce new security concerns

## ⚡ Performance Strategy

### Memory Optimization

- **Static Allocation**: All buffers statically allocated at compile time
- **Fixed Size**: No dynamic resizing, predictable memory footprint
- **Minimal Overhead**: Only 2.7KB additional memory usage

### Network Optimization

- **Request Reduction**: 90% reduction (360 → ~12 requests/hour)
- **Payload Size**: Larger but fewer requests (better for connection overhead)
- **Connection Reuse**: HTTPClient handles connection pooling automatically

### Power Optimization

- **Fewer WiFi Cycles**: Reduced connection establishment overhead
- **Sleep Opportunities**: Could add deep sleep between readings (future enhancement)
- **Radio Usage**: Less frequent WiFi radio activation

### Performance Metrics

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| HTTP Requests/Hour | 360 | ~12 | 96.7% reduction |
| Network Traffic | 360 × 256B = 92KB | 12 × 2.5KB = 30KB | 67% reduction |
| WiFi Connections/Hour | 360 | ~12 | 96.7% reduction |
| Max Data Latency | 10s | 5min | Acceptable for monitoring |

## 🧪 Testing Approach

### Unit Testing (Manual via Serial)

**Test 1: Buffer Addition**
- Add reading to empty buffer
- Verify `bufferCount` increments
- Verify reading stored correctly
- **Expected**: `bufferCount = 1`, reading in `readingBuffer[0]`

**Test 2: Buffer Overflow**
- Fill buffer to `MAX_BUNDLE_SIZE`
- Add 11th reading
- Verify transmission triggered or overflow handled
- **Expected**: Transmission forced or warning logged

**Test 3: Time-Based Transmission**
- Add reading to buffer
- Wait `BUNDLE_INTERVAL_MS`
- Verify `shouldTransmitBundle()` returns `true`
- **Expected**: Returns `true` after interval elapsed

**Test 4: Size-Based Transmission**
- Add readings until `bufferCount == MAX_BUNDLE_SIZE`
- Verify `shouldTransmitBundle()` returns `true`
- **Expected**: Returns `true` when buffer full

### Integration Testing

**Test 5: Full Transmission Cycle**
- Add 5 readings to buffer
- Trigger transmission
- Verify JSON array format correct
- Verify HTTP POST succeeds
- Verify buffer cleared after success
- **Expected**: All readings sent, buffer empty, HTTP 200

**Test 6: WiFi Disconnection**
- Add 3 readings to buffer
- Disconnect WiFi (simulate)
- Add 2 more readings
- Reconnect WiFi
- Verify all 5 readings transmitted
- **Expected**: Buffer retained, all readings sent on reconnect

**Test 7: Server Unavailable**
- Add readings to buffer
- Make server unavailable (simulate)
- Trigger transmission
- Verify buffer retained
- Make server available
- Verify readings sent on retry
- **Expected**: Buffer retained on failure, sent on success

### Edge Case Testing

**Test 8: Empty Buffer Transmission**
- Call `sendDataToServer()` with `count = 0`
- Verify no HTTP request sent
- **Expected**: Function returns early, no network activity

**Test 9: Single Reading Transmission**
- Add 1 reading, wait for time interval
- Verify single-element array sent
- **Expected**: `[{reading}]` format, HTTP 200

**Test 10: Maximum Buffer Size**
- Add exactly `MAX_BUNDLE_SIZE` readings
- Verify transmission triggered
- Verify all readings in JSON array
- **Expected**: Array with `MAX_BUNDLE_SIZE` elements

### Performance Testing

**Test 11: Memory Usage**
- Monitor free heap before/after implementation
- Verify no memory leaks over 24 hours
- **Expected**: Stable memory usage, no leaks

**Test 12: Long-Running Operation**
- Run device for 24 hours
- Verify no buffer corruption
- Verify all readings eventually transmitted
- **Expected**: Stable operation, no data loss

## 🚀 Implementation Details

### Code Structure

#### 1. Configuration Additions (`include/config.h`)

```cpp
// Bundle configuration
#define BUNDLE_INTERVAL_MS 300000  // 5 minutes (300000ms)
#define MAX_BUNDLE_SIZE 10         // Maximum readings per bundle
```

#### 2. Global Variables (`src/main.cpp`)

Add after existing global variables (around line 67):

```cpp
// Bundle buffer
SensorData readingBuffer[MAX_BUNDLE_SIZE];
uint8_t bufferCount = 0;
unsigned long lastBundleTime = 0;
```

#### 3. New Functions

**Function: `addToBuffer()`**
- Location: After `readSensors()` function (around line 399)
- Purpose: Add reading to buffer, handle overflow
- Implementation: See detailed code below

**Function: `shouldTransmitBundle()`**
- Location: After `addToBuffer()` function
- Purpose: Check if bundle should be transmitted
- Implementation: See detailed code below

#### 4. Modified Functions

**Function: `sendDataToServer()`**
- Location: Line 465-517
- Changes:
  - Change signature to accept array
  - Create JSON array instead of single object
  - Update JSON document size to 2560
  - Clear buffer on success

**Function: `loop()`**
- Location: Line 148-192
- Changes:
  - Replace immediate `sendDataToServer(reading)` call
  - Add `addToBuffer(reading)` call
  - Add bundle transmission check and call

### Detailed Implementation Code

#### `addToBuffer()` Implementation

```cpp
void addToBuffer(SensorData data) {
  if (bufferCount >= MAX_BUNDLE_SIZE) {
    // Buffer full - force transmission
    Serial.println("⚠ Buffer full, forcing transmission");
    // Transmission will be handled by shouldTransmitBundle() check
    // For now, we'll overwrite oldest (or could force transmission)
    // Strategy: Force transmission by setting bufferCount to trigger
    return; // Don't add, let transmission happen first
  }
  
  readingBuffer[bufferCount] = data;
  bufferCount++;
  Serial.print("Reading added to buffer (");
  Serial.print(bufferCount);
  Serial.print("/");
  Serial.print(MAX_BUNDLE_SIZE);
  Serial.println(")");
}
```

**Alternative Overflow Strategy** (Force Transmission):
```cpp
void addToBuffer(SensorData data) {
  if (bufferCount >= MAX_BUNDLE_SIZE) {
    Serial.println("⚠ Buffer full, forcing transmission");
    // Don't add - transmission will be triggered
    // The reading will be lost, but prevents buffer overflow
    return;
  }
  
  readingBuffer[bufferCount] = data;
  bufferCount++;
}
```

#### `shouldTransmitBundle()` Implementation

```cpp
bool shouldTransmitBundle() {
  // Check time-based condition
  bool timeTrigger = (millis() - lastBundleTime) >= BUNDLE_INTERVAL_MS;
  
  // Check size-based condition
  bool sizeTrigger = (bufferCount >= MAX_BUNDLE_SIZE);
  
  // Also check if we have any readings to send
  bool hasReadings = (bufferCount > 0);
  
  // Transmit if (time OR size) AND has readings
  return hasReadings && (timeTrigger || sizeTrigger);
}
```

#### Modified `sendDataToServer()` Implementation

```cpp
bool sendDataToServer(SensorData* readings, uint8_t count) {
  if (WiFi.status() != WL_CONNECTED) {
    return false;
  }
  
  if (count == 0) {
    Serial.println("No readings to send");
    return false;
  }
  
  BearSSL::WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;
  if (!http.begin(client, SERVER_URL)) {
    Serial.println("Failed to initialize HTTPS connection");
    return false;
  }
  http.addHeader("Content-Type", "application/json");
  
  // Create JSON array payload
  StaticJsonDocument<2560> doc;  // Increased from 256 to 2560
  JsonArray readingsArray = doc.to<JsonArray>();
  
  for (uint8_t i = 0; i < count; i++) {
    JsonObject readingObj = readingsArray.createNestedObject();
    readingObj["timestamp"] = readings[i].timestamp;
    readingObj["device_id"] = DEVICE_ID;
    readingObj["temperature"] = round(readings[i].temperature * 100) / 100.0;
    readingObj["humidity"] = round(readings[i].humidity * 100) / 100.0;
    readingObj["co2"] = readings[i].co2;
  }
  
  String jsonString;
  serializeJson(doc, jsonString);
  
  Serial.print("Sending bundle to server (");
  Serial.print(count);
  Serial.print(" readings): ");
  Serial.println(jsonString);
  
  // Send POST request
  int httpResponseCode = http.POST(jsonString);
  
  Serial.print("HTTP Response code: ");
  Serial.println(httpResponseCode);
  
  if (httpResponseCode > 0) {
    String response = http.getString();
    Serial.print("Response: ");
    Serial.println(response);
  } else {
    Serial.print("Error: ");
    if (httpResponseCode == -1) {
      Serial.println("Connection failed - is server running?");
    } else if (httpResponseCode == -11) {
      Serial.println("Timeout - check server address");
    } else {
      Serial.println(http.errorToString(httpResponseCode));
    }
  }
  
  http.end();
  
  bool success = (httpResponseCode == 200);
  
  if (success) {
    // Clear buffer on success
    bufferCount = 0;
    lastBundleTime = millis();
    Serial.println("✓ Bundle sent successfully, buffer cleared");
  } else {
    Serial.println("✗ Bundle transmission failed, buffer retained");
  }
  
  return success;
}
```

#### Modified `loop()` Implementation

Replace lines 173-182 with:

```cpp
      // Add to buffer instead of immediate transmission
      addToBuffer(reading);
      
      // Check if bundle should be transmitted
      if (wifiState == CONNECTED && shouldTransmitBundle()) {
        if (sendDataToServer(readingBuffer, bufferCount)) {
          serverState = CONNECTED;
          Serial.println("✓ Bundle sent successfully");
        } else {
          serverState = ERROR;
          Serial.println("✗ Failed to send bundle");
        }
      }
```

### Forward Declarations

Add to forward declarations section (around line 96):

```cpp
void addToBuffer(SensorData data);
bool shouldTransmitBundle();
```

## 📝 Configuration

### New Configuration Macros

Add to `include/config.h`:

```cpp
// Bundle configuration
// BUNDLE_INTERVAL_MS: Time interval between bundle transmissions (milliseconds)
//  300000 = 5 minutes, 600000 = 10 minutes, 180000 = 3 minutes
#define BUNDLE_INTERVAL_MS 300000

// MAX_BUNDLE_SIZE: Maximum number of readings per bundle
//  Higher = more memory, fewer transmissions
//  Lower = less memory, more frequent transmissions
//  Recommended: 5-15 for ESP8266
#define MAX_BUNDLE_SIZE 10
```

### Configuration Guidelines

- **BUNDLE_INTERVAL_MS**: 
  - Minimum: 60000 (1 minute) - balances latency vs. efficiency
  - Recommended: 300000 (5 minutes) - good balance
  - Maximum: 1800000 (30 minutes) - acceptable for monitoring

- **MAX_BUNDLE_SIZE**:
  - Minimum: 5 - ensures meaningful batching
  - Recommended: 10 - good balance of memory and efficiency
  - Maximum: 20 - depends on available RAM

## 🔄 Error Handling

### Buffer Overflow
- **Detection**: `bufferCount >= MAX_BUNDLE_SIZE`
- **Action**: Force transmission (don't add new reading)
- **Logging**: Warning message via Serial

### Transmission Failure
- **Detection**: HTTP response code != 200
- **Action**: Retain buffer, retry on next interval
- **Logging**: Error message with HTTP code

### WiFi Disconnection
- **Detection**: `WiFi.status() != WL_CONNECTED`
- **Action**: Retain buffer, attempt transmission on reconnect
- **Logging**: WiFi status messages

### JSON Serialization Failure
- **Detection**: `serializeJson()` returns 0 or document too small
- **Action**: Log error, clear buffer to prevent memory leak
- **Logging**: Serial error message

### Empty Buffer Transmission
- **Detection**: `count == 0` in `sendDataToServer()`
- **Action**: Return early, no HTTP request
- **Logging**: Debug message

## 🚢 Deployment Plan

### Pre-Deployment Checklist

- [ ] Update `include/config.h` with bundle configuration
- [ ] Verify `MAX_BUNDLE_SIZE` fits available memory
- [ ] Test bundle transmission with server
- [ ] Verify server accepts array format (or update server)
- [ ] Test WiFi disconnection scenario
- [ ] Monitor memory usage for 24 hours

### Deployment Steps

1. **Backup Current Code**: Save current `main.cpp`
2. **Update Configuration**: Add bundle macros to `config.h`
3. **Implement Buffer Functions**: Add `addToBuffer()` and `shouldTransmitBundle()`
4. **Modify Transmission**: Update `sendDataToServer()` signature and implementation
5. **Update Loop**: Replace immediate transmission with buffering
6. **Compile and Upload**: Build and flash to device
7. **Monitor**: Watch Serial output for first few hours
8. **Verify**: Check server receives bundled data correctly

### Rollback Plan

If issues occur:
1. Revert to previous `main.cpp` version
2. Remove bundle configuration from `config.h`
3. Recompile and upload
4. System returns to immediate transmission mode

### Server-Side Considerations

**Current Server Behavior**:
- Expects single reading object: `{timestamp, device_id, temperature, humidity, co2}`
- May need update to accept array format

**Server Update Options**:
1. **Update Existing Endpoint**: Modify `/data` to accept both single object and array
2. **New Endpoint**: Create `/data/batch` for array format
3. **Client Fallback**: If server doesn't support arrays, send individual requests (defeats purpose)

**Recommended**: Update server to accept array format for optimal efficiency.

## 📈 Success Metrics

### Performance Metrics

- **HTTP Request Reduction**: Target 90%+ reduction (360 → ~12/hour)
- **Network Traffic**: Reduced by 60-70% (fewer connection overhead)
- **Memory Usage**: Stable, no leaks over 24+ hours
- **Data Loss**: Zero data loss during normal operation

### Functional Metrics

- **Buffer Accuracy**: All readings in buffer correctly transmitted
- **Transmission Reliability**: 95%+ success rate
- **WiFi Resilience**: Buffer retained during disconnections
- **Server Compatibility**: Server accepts and processes array format

## 🔗 Dependencies

### Code Dependencies

- **Existing Functions**: `readSensors()`, `connectWiFi()`, WiFi status checks
- **Existing Libraries**: ESP8266WiFi, ESP8266HTTPClient, ArduinoJson
- **Existing Configuration**: `SERVER_URL`, `DEVICE_ID`, `READING_INTERVAL_MS`

### Server Dependencies

- **Endpoint**: `POST /data` (may need update for array format)
- **Response**: HTTP 200 on success
- **Format**: JSON array of reading objects

## 📚 References

- [Feature Brief](feature-brief.md) - Original requirements
- [ArduinoJson Documentation](https://arduinojson.org/) - JSON array serialization
- [ESP8266 Memory Management](https://arduino-esp8266.readthedocs.io/en/latest/) - Memory constraints
- [ESP8266HTTPClient](https://github.com/esp8266/Arduino/tree/master/libraries/ESP8266HTTPClient) - HTTP client usage

---

**Plan Status**: Ready for Implementation  
**Estimated Implementation Time**: ~2 hours  
**Risk Level**: Low (single file modification, well-defined scope)  
**Last Updated**: 2024-12-19

