# Implementation Plan: Energy-Efficient WiFi-On-Demand Mode

## Overview

This plan implements an energy-efficient mode where the ESP8266 board:
1. Connects to WiFi **only** when the buffer is full and data is ready for transmission
2. Disconnects WiFi immediately after transmission
3. Enters deep sleep for 10 seconds between measurement cycles
4. Can be configured entirely through the web frontend (Connect page)

**Goal**: Reduce power consumption by ~99% by eliminating continuous WiFi connection and implementing optimized wake/sleep cycles.

---

## Architecture Overview

### System Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    WAKE FROM DEEP SLEEP                      │
│              (10 seconds sleep duration)                     │
└───────────────────────┬───────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                      SETUP() RUNS                            │
│  - Initialize sensors                                        │
│  - Initialize I2C                                            │
│  - (WiFi NOT connected)                                      │
└───────────────────────┬───────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                       LOOP() RUNS                            │
│  - Read sensors                                              │
│  - Add reading to buffer                                     │
│  - Check if buffer ready for transmission                    │
└───────────────────────┬───────────────────────────────────────┘
                        │
            ┌───────────┴───────────┐
            │                       │
            ▼                       ▼
    ┌───────────────┐     ┌──────────────────────┐
    │ Buffer NOT    │     │ Buffer READY         │
    │ Ready         │     │ (Full or Timeout)    │
    └───────┬───────┘     └──────┬───────────────┘
            │                     │
            │                     ▼
            │         ┌───────────────────────────┐
            │         │   CONNECT WiFi            │
            │         │   (Only now!)             │
            │         └──────┬────────────────────┘
            │                │
            │                ▼
            │         ┌───────────────────────────┐
            │         │   TRANSMIT Data           │
            │         │   (HTTPS POST)            │
            │         └──────┬────────────────────┘
            │                │
            │                ▼
            │         ┌───────────────────────────┐
            │         │   DISCONNECT WiFi         │
            │         │   WiFi.mode(WIFI_OFF)     │
            │         └──────┬────────────────────┘
            │                │
            └────────┬───────┘
                     │
                     ▼
        ┌────────────────────────────┐
        │   ENTER DEEP SLEEP         │
        │   (10 seconds)             │
        └────────────┬───────────────┘
                     │
                     └───► (Cycle repeats)
```

### Component Interactions

```
┌─────────────┐      ┌──────────────┐      ┌─────────────┐
│   Sensors   │◄────►│  ESP8266     │◄────►│   Buffer    │
│  (SCD41)    │ I2C  │  Firmware    │      │  (Memory)   │
└─────────────┘      └──────┬───────┘      └─────────────┘
                            │
                            │ (Only when buffer ready)
                            ▼
                    ┌──────────────┐
                    │     WiFi     │
                    │  (On-Demand) │
                    └──────┬───────┘
                           │
                           ▼
                    ┌──────────────┐
                    │   Backend    │
                    │   (HTTPS)    │
                    └──────────────┘
```

---

## Technology Stack

### Firmware
- **Language**: C++ (Arduino/ESP8266)
- **Libraries**:
  - `ESP8266WiFi.h` - WiFi management
  - `ESP8266HTTPClient.h` - HTTP client
  - `WiFiClientSecureBearSSL.h` - HTTPS support
  - `ArduinoJson.h` - JSON serialization
  - `SparkFun_SCD4x_Arduino_Library.h` - SCD41 sensor

### Backend
- **Language**: Python 3.x
- **Framework**: Django
- **Dependencies**: 
  - `board_manager.py` - Config file management
  - PlatformIO - Firmware compilation/upload

### Frontend
- **Framework**: React (Vite)
- **UI Library**: Custom Material Design 3 components
- **HTTP Client**: Axios
- **State Management**: React Hooks (useState)

---

## Data Model

### Configuration Structure (`include/config.h`)

```cpp
// WiFi-On-Demand Mode Configuration
#define ENABLE_WIFI_ON_DEMAND 1  // Enable WiFi-on-demand mode
#define ENABLE_BUNDLING 1        // Required when WiFi-on-demand enabled
#define ENABLE_DEEP_SLEEP 1      // Auto-enabled when WiFi-on-demand enabled
#define DEEP_SLEEP_DURATION_US 10000000  // 10 seconds (fixed for this mode)

// Bundle Configuration (existing)
#define BUNDLE_INTERVAL_MS 300000  // 5 minutes
#define MAX_BUNDLE_SIZE 10         // 10 readings per bundle
```

### Runtime State (Firmware)

```cpp
// Buffer state (existing)
SensorData readingBuffer[MAX_BUNDLE_SIZE];
uint8_t bufferCount = 0;
unsigned long lastBundleTime = 0;

// WiFi state (new)
bool wifiConnected = false;  // Track WiFi connection state
bool wifiOnDemandMode = false;  // Track if in WiFi-on-demand mode
```

---

## API Design

### Backend API Endpoint

**Endpoint**: `POST /api/connect/upload`

**Request Body**:
```json
{
  "boardName": "esp12s_school_01",
  "ssid": "MyWiFiNetwork",
  "password": "MyPassword",
  "enableBundling": true,
  "enableWifiOnDemand": true,  // NEW
  "enableDeepSleep": true,     // Auto-enabled if WiFi-on-demand
  "deepSleepDurationSeconds": 10,  // Fixed at 10 for WiFi-on-demand
  "enableScheduledShutdown": false,
  "shutdownHour": null,
  "shutdownMinute": null,
  "wakeHour": null,
  "wakeMinute": null
}
```

**Response**:
```json
{
  "status": "success",
  "message": "Firmware byl na desku úspěšně nahrán.",
  "log_excerpt": "..."
}
```

### Frontend API Function

**File**: `frontend/src/services/api.js`

```javascript
export const connectAPI = {
  uploadFirmware: async (
    boardName, 
    ssid, 
    password, 
    enableBundling = null, 
    enableWifiOnDemand = null,  // NEW
    enableDeepSleep = null,
    deepSleepDurationSeconds = null,
    enableScheduledShutdown = null,
    shutdownHour = null,
    shutdownMinute = null,
    wakeHour = null,
    wakeMinute = null
  ) => {
    return apiClient.post('/connect/upload', {
      boardName,
      ssid,
      password,
      enableBundling,
      enableWifiOnDemand,  // NEW
      enableDeepSleep,
      deepSleepDurationSeconds,
      enableScheduledShutdown,
      shutdownHour,
      shutdownMinute,
      wakeHour,
      wakeMinute,
    })
  },
}
```

---

## Implementation Details

### 1. Firmware Changes (`src/main.cpp`)

#### 1.1 Configuration Check (Top of file)

```cpp
// After existing #include statements
#if ENABLE_WIFI_ON_DEMAND
  #ifndef ENABLE_BUNDLING
    #error "ENABLE_BUNDLING must be enabled when ENABLE_WIFI_ON_DEMAND is enabled"
  #endif
  #ifndef ENABLE_DEEP_SLEEP
    #define ENABLE_DEEP_SLEEP 1  // Auto-enable deep sleep
  #endif
  #if DEEP_SLEEP_DURATION_US != 10000000
    #warning "DEEP_SLEEP_DURATION_US should be 10000000 (10 seconds) for WiFi-on-demand mode"
  #endif
#endif
```

#### 1.2 Modified `loop()` Function

**Location**: `src/main.cpp:159-260`

**Changes**:
1. Remove WiFi connection check at start of loop (when WiFi-on-demand enabled)
2. Only check WiFi connection when buffer is ready for transmission
3. Disconnect WiFi immediately after transmission
4. Always enter deep sleep after cycle (when WiFi-on-demand enabled)

**New Implementation**:
```cpp
void loop() {
  // Check scheduled shutdown time (if enabled)
  #if ENABLE_SCHEDULED_SHUTDOWN
    if (isShutdownTime()) {
      unsigned long sleepDuration = calculateSleepUntilWake();
      Serial.print("\n--- Scheduled Shutdown ---");
      // ... existing code ...
      ESP.deepSleep(sleepDuration, WAKE_RFCAL);
      delay(1000);
      return;
    }
  #endif
  
  #if ENABLE_WIFI_ON_DEMAND
    // WiFi-on-demand mode: Don't check WiFi connection here
    // WiFi will be connected only when buffer is ready
  #else
    // Normal mode: Check WiFi connection
    if (WiFi.status() != WL_CONNECTED) {
      wifiState = DISCONNECTED;
      #ifdef HAS_DISPLAY
      displayStatus("WiFi Lost!", TFT_RED);
      #endif
      connectWiFi();
    } else {
      wifiState = CONNECTED;
    }
  #endif
  
  // Read sensors at specified interval
  if (sensorsInitialized && (millis() - lastReadingTime >= READING_INTERVAL)) {
    lastReadingTime = millis();
    
    Serial.println("\n--- New Reading ---");
    SensorData reading = readSensors();
    
    if (reading.valid) {
      lastReading = reading;
      #ifdef HAS_DISPLAY
      displayReadings(reading);
      #endif
      
      // Add to buffer (bundling mode)
      #if ENABLE_BUNDLING
        addToBuffer(reading);
        
        // Check if bundle should be transmitted
        if (shouldTransmitBundle()) {
          #if ENABLE_WIFI_ON_DEMAND
            // WiFi-on-demand: Connect WiFi only now
            if (WiFi.status() != WL_CONNECTED) {
              Serial.println("--- WiFi-On-Demand: Connecting WiFi ---");
              connectWiFi();
            }
          #endif
          
          // Transmit bundle
          if (sendDataToServer(readingBuffer, bufferCount)) {
            serverState = CONNECTED;
            Serial.println("✓ Bundle sent successfully");
          } else {
            serverState = ERROR;
            Serial.println("✗ Failed to send bundle");
          }
          
          #if ENABLE_WIFI_ON_DEMAND
            // WiFi-on-demand: Disconnect WiFi immediately after transmission
            Serial.println("--- WiFi-On-Demand: Disconnecting WiFi ---");
            WiFi.disconnect();
            WiFi.mode(WIFI_OFF);
            wifiState = DISCONNECTED;
            Serial.println("WiFi disconnected");
          #endif
        }
      #else
        // Immediate mode (not compatible with WiFi-on-demand)
        #if ENABLE_WIFI_ON_DEMAND
          #error "ENABLE_BUNDLING must be enabled when ENABLE_WIFI_ON_DEMAND is enabled"
        #endif
        
        if (wifiState == CONNECTED) {
          if (sendSingleReading(reading)) {
            serverState = CONNECTED;
            Serial.println("✓ Data sent successfully");
          } else {
            serverState = ERROR;
            Serial.println("✗ Failed to send data");
          }
        }
      #endif
      
      // Enter deep sleep after completing cycle
      #if ENABLE_WIFI_ON_DEMAND
        // WiFi-on-demand: Always deep sleep (10 seconds)
        Serial.println("\n--- WiFi-On-Demand: Entering Deep Sleep (10s) ---");
        enterDeepSleep();
      #elif ENABLE_DEEP_SLEEP
        // Optional deep sleep (existing behavior)
        enterDeepSleep();
      #endif
    } else {
      Serial.println("✗ Invalid sensor reading");
      #ifdef HAS_DISPLAY
      displayStatus("Sensor Error!", TFT_RED);
      #endif
      
      // Enter deep sleep even if reading invalid
      #if ENABLE_WIFI_ON_DEMAND
        Serial.println("\n--- WiFi-On-Demand: Entering Deep Sleep (10s) ---");
        enterDeepSleep();
      #elif ENABLE_DEEP_SLEEP
        enterDeepSleep();
      #endif
    }
  }
  
  // If deep sleep is disabled, continue normal loop
  #if !ENABLE_DEEP_SLEEP && !ENABLE_WIFI_ON_DEMAND
    delay(100);
  #endif
}
```

#### 1.3 Modified `enterDeepSleep()` Function

**Location**: `src/main.cpp:564-594`

**Changes**: Ensure WiFi is disconnected before deep sleep (already implemented, but verify)

```cpp
void enterDeepSleep() {
  Serial.println("\n--- Entering Deep Sleep ---");
  
  // Disconnect WiFi to save power
  if (WiFi.status() == WL_CONNECTED) {
    WiFi.disconnect();
    Serial.println("WiFi disconnected");
  }
  
  // Turn off display if available
  #ifdef HAS_DISPLAY
  if (displayInitialized) {
    display.clearDisplay();
    display.display();
    Serial.println("Display turned off");
  }
  #endif
  
  Serial.print("Sleeping for ");
  Serial.print(DEEP_SLEEP_DURATION_US / 1000000);
  Serial.println(" seconds...");
  Serial.println("(Note: EN and IO16 pins must be connected for wake-up)");
  Serial.flush();
  
  // Enter deep sleep mode
  ESP.deepSleep(DEEP_SLEEP_DURATION_US, WAKE_RFCAL);
  
  delay(1000);  // Safety delay (unreachable)
}
```

### 2. Configuration Changes (`include/config.h`)

#### 2.1 Add WiFi-On-Demand Configuration

**Location**: After deep sleep configuration section

```cpp
// WiFi-on-demand configuration
// ENABLE_WIFI_ON_DEMAND: Set to 1 to enable WiFi-on-demand mode, 0 to disable
//  When enabled: WiFi connects only when buffer is ready for transmission
//  When disabled: WiFi stays connected (normal mode)
//  Note: Requires ENABLE_BUNDLING to be enabled
//  Note: Automatically enables ENABLE_DEEP_SLEEP
//  Power consumption: ~99% reduction vs continuous WiFi
#define ENABLE_WIFI_ON_DEMAND 0

// When ENABLE_WIFI_ON_DEMAND is enabled, deep sleep duration should be 10 seconds
// This ensures optimal power savings while maintaining reasonable data frequency
// DEEP_SLEEP_DURATION_US is used (should be 10000000 for 10 seconds)
```

### 3. Backend Changes (`server/board_manager.py`)

#### 3.1 Update `apply_wifi_credentials()` Function

**Location**: `server/board_manager.py:55-153`

**Changes**: Add `enable_wifi_on_demand` parameter

```python
def apply_wifi_credentials(
    ssid: str, 
    password: str, 
    device_id: str = None,
    enable_bundling: bool = None,
    enable_wifi_on_demand: bool = None,  # NEW
    enable_deep_sleep: bool = None,
    deep_sleep_duration_seconds: int = None,
    enable_scheduled_shutdown: bool = None,
    shutdown_hour: int = None,
    shutdown_minute: int = None,
    wake_hour: int = None,
    wake_minute: int = None
) -> Path:
    if not ssid or not isinstance(ssid, str):
        raise ConfigWriteError("SSID is required to update config.h")

    base_content = _load_config_source()
    updated_content = _replace_define(base_content, "WIFI_SSID", ssid)

    password_value = password if password is not None else ""
    updated_content = _replace_define(updated_content, "WIFI_PASSWORD", password_value)

    if device_id:
        if not isinstance(device_id, str):
            raise ConfigWriteError("device_id must be a string")
        updated_content = _replace_define(updated_content, "DEVICE_ID", device_id)

    # Update bundling setting if provided
    if enable_bundling is not None:
        bundling_value = "1" if enable_bundling else "0"
        updated_content = _replace_define(updated_content, "ENABLE_BUNDLING", bundling_value, is_string=False)

    # Update WiFi-on-demand setting if provided
    if enable_wifi_on_demand is not None:
        wifi_on_demand_value = "1" if enable_wifi_on_demand else "0"
        updated_content = _replace_define(updated_content, "ENABLE_WIFI_ON_DEMAND", wifi_on_demand_value, is_string=False)
        
        # Auto-enable bundling if WiFi-on-demand is enabled
        if enable_wifi_on_demand:
            updated_content = _replace_define(updated_content, "ENABLE_BUNDLING", "1", is_string=False)
            # Auto-enable deep sleep
            updated_content = _replace_define(updated_content, "ENABLE_DEEP_SLEEP", "1", is_string=False)
            # Set deep sleep duration to 10 seconds if not specified
            if deep_sleep_duration_seconds is None:
                updated_content = _replace_define(updated_content, "DEEP_SLEEP_DURATION_US", "10000000", is_string=False)

    # Update deep sleep setting if provided
    if enable_deep_sleep is not None:
        deep_sleep_value = "1" if enable_deep_sleep else "0"
        updated_content = _replace_define(updated_content, "ENABLE_DEEP_SLEEP", deep_sleep_value, is_string=False)
    
    # Update deep sleep duration if provided
    if deep_sleep_duration_seconds is not None:
        try:
            duration_seconds = int(deep_sleep_duration_seconds)
            if duration_seconds < 10 or duration_seconds > 4260:
                raise ConfigWriteError("Deep sleep duration must be between 10 and 4260 seconds (71 minutes)")
            duration_microseconds = duration_seconds * 1000000
            updated_content = _replace_define(updated_content, "DEEP_SLEEP_DURATION_US", str(duration_microseconds), is_string=False)
        except (ValueError, TypeError) as exc:
            raise ConfigWriteError(f"Invalid deep sleep duration: {exc}") from exc

    # ... rest of existing code for scheduled shutdown ...
    
    try:
        CONFIG_DIR.mkdir(parents=True, exist_ok=True)
        CONFIG_PATH.write_text(updated_content, encoding="utf-8")
    except OSError as exc:
        raise ConfigWriteError(f"Failed to write config.h: {exc}") from exc

    return CONFIG_PATH
```

#### 3.2 Update Backend View (`server/api/views.py`)

**Location**: `server/api/views.py:1096-1290` (connect_upload function)

**Changes**: Add `enable_wifi_on_demand` parameter handling

```python
@csrf_exempt
@require_http_methods(["POST"])
def connect_upload(request):
    """Zápis WiFi údajů a nahrání firmware do připojené desky"""
    try:
        payload = json.loads(request.body) if request.body else {}
    except json.JSONDecodeError:
        payload = {}

    board_name = (payload.get('boardName') or '').strip()
    ssid = (payload.get('ssid') or '').strip()
    password = payload.get('password', '')
    enable_bundling = payload.get('enableBundling')
    enable_wifi_on_demand = payload.get('enableWifiOnDemand')  # NEW
    enable_deep_sleep = payload.get('enableDeepSleep')
    deep_sleep_duration_seconds = payload.get('deepSleepDurationSeconds')
    enable_scheduled_shutdown = payload.get('enableScheduledShutdown')
    shutdown_hour = payload.get('shutdownHour')
    shutdown_minute = payload.get('shutdownMinute')
    wake_hour = payload.get('wakeHour')
    wake_minute = payload.get('wakeMinute')

    # ... existing validation ...

    # Convert boolean values
    if enable_wifi_on_demand is not None:
        if isinstance(enable_wifi_on_demand, str):
            enable_wifi_on_demand = enable_wifi_on_demand.lower() in ('true', '1', 'yes')
        enable_wifi_on_demand = bool(enable_wifi_on_demand)
        
        # Auto-enable bundling and deep sleep if WiFi-on-demand is enabled
        if enable_wifi_on_demand:
            enable_bundling = True
            enable_deep_sleep = True
            if deep_sleep_duration_seconds is None:
                deep_sleep_duration_seconds = 10  # Default 10 seconds

    # ... rest of existing validation and processing ...

    try:
        apply_wifi_credentials(
            ssid, 
            password, 
            board_name, 
            enable_bundling, 
            enable_wifi_on_demand,  # NEW
            enable_deep_sleep, 
            deep_sleep_duration,
            scheduled_shutdown,
            shutdown_h,
            shutdown_m,
            wake_h,
            wake_m
        )
    except ConfigWriteError as exc:
        # ... error handling ...
```

### 4. Frontend Changes

#### 4.1 Update Connect Page (`frontend/src/pages/Connect.jsx`)

**Location**: `frontend/src/pages/Connect.jsx`

**Changes**:
1. Add `enableWifiOnDemand` state
2. Add checkbox for WiFi-on-demand mode
3. Auto-enable bundling and deep sleep when WiFi-on-demand is checked
4. Update form submission

```javascript
const Connect = () => {
  const [boardName, setBoardName] = useState('')
  const [ssid, setSsid] = useState('')
  const [password, setPassword] = useState('')
  const [enableBundling, setEnableBundling] = useState(true)
  const [enableWifiOnDemand, setEnableWifiOnDemand] = useState(false)  // NEW
  const [enableDeepSleep, setEnableDeepSleep] = useState(false)
  const [deepSleepDuration, setDeepSleepDuration] = useState(60)
  // ... rest of state ...

  // Handle WiFi-on-demand checkbox change
  const handleWifiOnDemandChange = (checked) => {
    setEnableWifiOnDemand(checked)
    if (checked) {
      // Auto-enable bundling and deep sleep
      setEnableBundling(true)
      setEnableDeepSleep(true)
      setDeepSleepDuration(10)  // Fixed at 10 seconds for WiFi-on-demand
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    // ... existing validation ...

    try {
      const response = await connectAPI.uploadFirmware(
        boardName.trim(), 
        ssid.trim(), 
        password,
        enableBundling,
        enableWifiOnDemand,  // NEW
        enableDeepSleep,
        enableDeepSleep ? parseInt(deepSleepDuration, 10) : null,
        enableScheduledShutdown,
        enableScheduledShutdown ? parseInt(shutdownHour, 10) : null,
        enableScheduledShutdown ? parseInt(shutdownMinute, 10) : null,
        enableScheduledShutdown ? parseInt(wakeHour, 10) : null,
        enableScheduledShutdown ? parseInt(wakeMinute, 10) : null
      )
      // ... rest of submission handling ...
    } catch (error) {
      // ... error handling ...
    }
  }

  return (
    <div className="connect-page">
      {/* ... existing JSX ... */}
      <div className="connect-page__settings">
        <h3 className="connect-page__settings-title">Nastavení funkce</h3>
        
        {/* NEW: WiFi-On-Demand Mode */}
        <div className="connect-page__setting-item">
          <label className="connect-page__checkbox-label">
            <input
              type="checkbox"
              checked={enableWifiOnDemand}
              onChange={(e) => handleWifiOnDemandChange(e.target.checked)}
              disabled={loading}
              className="connect-page__checkbox"
            />
            <span className="connect-page__checkbox-text">
              <strong>WiFi-On-Demand Mode</strong>
              <span className="connect-page__checkbox-description">
                Připojí WiFi pouze když je buffer plný a data jsou připravena k odeslání. 
                Po odeslání se WiFi vypne a deska přejde do hlubokého spánku na 10 sekund. 
                Maximální úspora energie (~99%).
              </span>
            </span>
          </label>
        </div>

        {/* Existing bundling checkbox - disabled if WiFi-on-demand is enabled */}
        <div className="connect-page__setting-item">
          <label className="connect-page__checkbox-label">
            <input
              type="checkbox"
              checked={enableBundling}
              onChange={(e) => setEnableBundling(e.target.checked)}
              disabled={loading || enableWifiOnDemand}  // Disabled if WiFi-on-demand enabled
              className="connect-page__checkbox"
            />
            <span className="connect-page__checkbox-text">
              <strong>HTTP Bundling</strong>
              <span className="connect-page__checkbox-description">
                Seskupuje HTTP požadavky do balíčků (snižuje počet požadavků o ~90%)
                {enableWifiOnDemand && " (Automaticky zapnuto v režimu WiFi-On-Demand)"}
              </span>
            </span>
          </label>
        </div>

        {/* Existing deep sleep checkbox - disabled if WiFi-on-demand is enabled */}
        <div className="connect-page__setting-item">
          <label className="connect-page__checkbox-label">
            <input
              type="checkbox"
              checked={enableDeepSleep}
              onChange={(e) => setEnableDeepSleep(e.target.checked)}
              disabled={loading || enableWifiOnDemand}  // Disabled if WiFi-on-demand enabled
              className="connect-page__checkbox"
            />
            <span className="connect-page__checkbox-text">
              <strong>Deep Sleep Mode</strong>
              <span className="connect-page__checkbox-description">
                Režim hlubokého spánku pro úsporu energie (vyžaduje připojení EN + IO16 pinů)
                {enableWifiOnDemand && " (Automaticky zapnuto v režimu WiFi-On-Demand)"}
              </span>
            </span>
          </label>
        </div>
        {/* ... rest of form ... */}
      </div>
    </div>
  )
}
```

#### 4.2 Update API Service (`frontend/src/services/api.js`)

**Location**: `frontend/src/services/api.js:89-117`

**Changes**: Add `enableWifiOnDemand` parameter

```javascript
export const connectAPI = {
  uploadFirmware: async (
    boardName, 
    ssid, 
    password, 
    enableBundling = null, 
    enableWifiOnDemand = null,  // NEW
    enableDeepSleep = null, 
    deepSleepDurationSeconds = null,
    enableScheduledShutdown = null,
    shutdownHour = null,
    shutdownMinute = null,
    wakeHour = null,
    wakeMinute = null
  ) => {
    return apiClient.post('/connect/upload', {
      boardName,
      ssid,
      password,
      enableBundling,
      enableWifiOnDemand,  // NEW
      enableDeepSleep,
      deepSleepDurationSeconds,
      enableScheduledShutdown,
      shutdownHour,
      shutdownMinute,
      wakeHour,
      wakeMinute,
    })
  },
}
```

---

## Security Considerations

1. **WiFi Credentials**: Stored in `config.h` (already in `.gitignore`)
2. **HTTPS Transmission**: BearSSL used for secure transmission
3. **Input Validation**: All user inputs validated on backend
4. **Configuration Validation**: Backend validates WiFi-on-demand requires bundling

---

## Performance Strategy

1. **Power Consumption**: 
   - Target: ~99% reduction vs continuous operation
   - WiFi only active during transmission (~2-5 seconds per bundle)
   - Deep sleep between cycles (10 seconds @ ~15 µA)

2. **Data Frequency**:
   - Reading interval: 10 seconds (configurable)
   - Bundle transmission: When buffer full (10 readings) or 5 minutes
   - Effective transmission frequency: ~1 per 100 seconds (with 10s readings)

3. **Memory Usage**:
   - Buffer: 10 readings × ~16 bytes = 160 bytes
   - No additional memory overhead

---

## Testing Approach

### Unit Tests

1. **Buffer Logic**: Verify `shouldTransmitBundle()` works correctly
2. **WiFi Connection**: Verify WiFi connects only when buffer ready
3. **WiFi Disconnection**: Verify WiFi disconnects after transmission

### Integration Tests

1. **Full Cycle Test**:
   - Wake from deep sleep
   - Read sensors
   - Add to buffer
   - Connect WiFi when buffer full
   - Transmit data
   - Disconnect WiFi
   - Enter deep sleep
   - Verify cycle repeats

2. **Power Consumption Test**:
   - Measure current draw during active phase
   - Measure current draw during deep sleep
   - Calculate average power consumption
   - Verify ~99% reduction

### Frontend Tests

1. **UI Interaction**: Verify WiFi-on-demand checkbox works
2. **Auto-enable Logic**: Verify bundling and deep sleep auto-enable
3. **Form Submission**: Verify API call includes new parameter
4. **Validation**: Verify form validation works correctly

---

## Deployment Plan

### Phase 1: Firmware Implementation
1. Update `src/main.cpp` with WiFi-on-demand logic
2. Update `include/config.h` template
3. Test firmware compilation
4. Test on hardware (single device)

### Phase 2: Backend Implementation
1. Update `server/board_manager.py`
2. Update `server/api/views.py`
3. Test config file generation
4. Test API endpoint

### Phase 3: Frontend Implementation
1. Update `frontend/src/pages/Connect.jsx`
2. Update `frontend/src/services/api.js`
3. Test UI interactions
4. Test end-to-end flow

### Phase 4: Integration Testing
1. Test full cycle on hardware
2. Measure power consumption
3. Verify data transmission
4. Test edge cases

### Phase 5: Documentation
1. Update user documentation
2. Add configuration guide
3. Document power consumption improvements

---

## Risks & Mitigation

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| **WiFi connection fails** | Medium | Low | Implement retry logic, fallback to next cycle |
| **Buffer overflow** | Low | Low | Buffer size check prevents overflow |
| **Deep sleep wake failure** | High | Low | Verify GPIO16-RST connection, add watchdog |
| **Data loss during sleep** | Medium | Low | Buffer persists in memory, retry on next wake |
| **Frontend/Backend mismatch** | Medium | Medium | Comprehensive testing, type validation |
| **Power consumption not as expected** | Medium | Medium | Measure actual consumption, adjust if needed |

---

## Success Criteria

1. ✅ WiFi connects only when buffer is ready for transmission
2. ✅ WiFi disconnects immediately after transmission
3. ✅ Board enters deep sleep for 10 seconds between cycles
4. ✅ Configuration can be set entirely through web frontend
5. ✅ Power consumption reduced by ~99% vs continuous operation
6. ✅ Data transmission works correctly
7. ✅ No data loss during normal operation
8. ✅ System stable over extended periods (24+ hours)

---

## Next Steps

1. **Review this plan** with stakeholders
2. **Create task breakdown**: `/tasks energy-efficient-transmission`
3. **Begin implementation**: Start with firmware changes
4. **Test incrementally**: Test each component before moving to next
5. **Measure and validate**: Verify power consumption improvements

---

**Created**: 2024-12-19  
**Status**: Ready for Implementation  
**Next Phase**: Task Breakdown (`/tasks energy-efficient-transmission`)



