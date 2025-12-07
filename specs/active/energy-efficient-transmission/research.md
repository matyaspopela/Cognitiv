# Research Report: Energy-Efficient ESP8266 System Architecture

## Overview

This research investigates energy-efficient alternatives for the entire ESP8266-based environmental monitoring system, including sensor reading, display management, WiFi transmission, and overall power management. The goal is to reduce total system power consumption while maintaining reliability and data integrity.

**Research Date**: 2024-12-19  
**Researcher**: AI Assistant  
**Research Duration**: ~100 minutes  
**Next Phase**: Specification (`/specify energy-efficient-transmission`)

---

## Executive Summary

### Current Power Consumption Estimate

Based on codebase analysis and ESP8266 specifications:

| Component | Current State | Power Consumption |
|-----------|--------------|-------------------|
| ESP8266 CPU (active) | Always on | ~80-100 mA |
| WiFi (connected) | Always connected | ~70-80 mA |
| SCD41 Sensor | Periodic measurement mode | ~19 mA |
| SSD1306 Display | Always on (if enabled) | ~20-40 mA |
| I2C Bus | Active | ~1-2 mA |
| **Total Active** | | **~190-240 mA** |
| **Deep Sleep** | Available but disabled | **~10-20 µA** |

**Current Configuration:**
- Reading interval: 10 seconds
- WiFi: Always connected
- Deep sleep: Disabled (`ENABLE_DEEP_SLEEP = 0`)
- Display: Always on (if `HAS_DISPLAY` enabled)
- Sensor: Continuous periodic measurement

**Estimated Daily Consumption** (assuming 10s readings, 24/7 operation):
- Active time: 100% (no sleep)
- Daily energy: ~4.5-5.8 Ah (at 190-240 mA average)
- Battery life (2x AA, 2000mAh): ~8-10 hours

### Potential Energy Savings

| Approach | Estimated Savings | Battery Life Improvement |
|----------|------------------|--------------------------|
| **Deep Sleep (60s intervals)** | 99.8% | 1-2 years (2x AA) |
| **Light Sleep + WiFi disconnect** | 95-97% | 2-4 weeks (2x AA) |
| **MQTT + Power Management** | 90-95% | 1-2 weeks (2x AA) |
| **Optimized Wake Cycles** | 98-99% | 3-6 months (2x AA) |

---

## Current Architecture Deep Dive

### Codebase Analysis

#### 1. Sensor System (`src/main.cpp:398-467`)

**Current Implementation:**
```cpp
bool initSensors() {
  // SCD41 starts periodic measurement mode
  scd41.startPeriodicMeasurement();
  // Signal update interval: 5 seconds
}

SensorData readSensors() {
  // Reads measurement (non-blocking if data ready)
  scd41.readMeasurement();
}
```

**Energy Hotspots:**
- SCD41 runs in **periodic measurement mode continuously** (~19 mA)
- No sensor sleep/wake management
- I2C bus active even when not reading
- First reading requires ~60 second warm-up period

**Power Consumption:**
- SCD41 periodic mode: ~19 mA (continuous)
- I2C communication: ~1-2 mA during reads
- No power-down between readings

#### 2. Display System (`src/main.cpp:262-353`)

**Current Implementation:**
```cpp
#ifdef HAS_DISPLAY
void displayReadings(SensorData data) {
  display.clearDisplay();
  // ... render content ...
  display.display();  // Refreshes every reading
}
#endif
```

**Energy Hotspots:**
- SSD1306 OLED **always powered** (if `HAS_DISPLAY` enabled)
- Display refreshed every reading cycle (10 seconds)
- No display sleep/power-down modes
- No display-on-demand strategy

**Power Consumption:**
- SSD1306 active: ~20-40 mA (continuous)
- Display refresh: Additional ~5-10 mA during refresh

#### 3. WiFi Transmission (`src/main.cpp:596-725`)

**Current Implementation:**
```cpp
void loop() {
  // WiFi checked every loop iteration
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();  // Reconnects if lost
  }
  
  // HTTPS POST with BearSSL
  BearSSL::WiFiClientSecure client;
  http.POST(jsonString);
}
```

**Energy Hotspots:**
- WiFi **stays connected continuously**
- No WiFi.disconnect() between readings
- HTTPS/TLS encryption overhead (BearSSL)
- Connection maintained even when not transmitting
- No connection reuse optimization

**Power Consumption:**
- WiFi connected (idle): ~70-80 mA
- WiFi transmission: ~80-100 mA
- Connection establishment: ~150-200 mA (peak, ~2-5 seconds)

#### 4. System Power Management (`src/main.cpp:564-594`)

**Current Implementation:**
```cpp
void enterDeepSleep() {
  WiFi.disconnect();
  #ifdef HAS_DISPLAY
  display.clearDisplay();
  #endif
  ESP.deepSleep(DEEP_SLEEP_DURATION_US, WAKE_RFCAL);
}
```

**Energy Hotspots:**
- Deep sleep **available but disabled** (`ENABLE_DEEP_SLEEP = 0`)
- No light sleep or modem sleep between readings
- ESP8266 CPU runs continuously
- No coordinated peripheral power-down

**Power Consumption:**
- Deep sleep: ~10-20 µA (99.99% reduction)
- Light sleep: ~0.4-1.0 mA (WiFi off, CPU paused)
- Modem sleep: ~15-20 mA (WiFi off, CPU active)

### Power Consumption Breakdown

**Current Active Cycle (10-second intervals):**

| Phase | Duration | Current | Energy per Cycle |
|-------|----------|---------|------------------|
| Sensor read | 0.1s | 100 mA | 0.01 mAh |
| WiFi connected (idle) | 9.9s | 75 mA | 0.21 mAh |
| Transmission (if bundle ready) | 2-5s | 100 mA | 0.06-0.14 mAh |
| Display refresh | 0.05s | 30 mA | 0.0004 mAh |
| **Total per 10s cycle** | | | **~0.28-0.36 mAh** |

**Daily Energy (8640 cycles):**
- **~2.4-3.1 Ah/day** (continuous operation)

---

## ESP8266 System Power Management

### Available Power Modes

#### 1. Deep Sleep Mode
- **Current**: ~10-20 µA
- **Wake-up**: GPIO16 (D0) → RST pin connection required
- **Retention**: RTC memory only (limited data)
- **Wake time**: ~2-3 seconds (full restart)
- **Use case**: Long sleep intervals (>10 seconds)

**Implementation:**
```cpp
ESP.deepSleep(sleepDuration_us, WAKE_RFCAL);
// Device restarts from setup() after wake
```

#### 2. Light Sleep Mode
- **Current**: ~0.4-1.0 mA
- **Wake-up**: Timer, GPIO, or WiFi event
- **Retention**: Full RAM (all variables preserved)
- **Wake time**: ~10-50 ms (instant resume)
- **Use case**: Short sleep intervals (<10 seconds)

**Implementation:**
```cpp
WiFi.disconnect();
WiFi.mode(WIFI_OFF);
ESP.lightSleep(sleepDuration_us);
// Resumes from same point in code
```

#### 3. Modem Sleep Mode
- **Current**: ~15-20 mA
- **WiFi**: Off
- **CPU**: Active
- **Use case**: Processing without WiFi

**Implementation:**
```cpp
WiFi.disconnect();
WiFi.mode(WIFI_OFF);
// CPU continues running
```

### WiFi Power Optimization

**Connection Management Strategies:**

1. **Disconnect After Transmission**
   ```cpp
   // After sending data
   WiFi.disconnect();
   WiFi.mode(WIFI_OFF);
   // Saves ~70-80 mA
   ```

2. **Connection Reuse**
   - Keep connection alive for multiple transmissions
   - Reduces connection overhead (2-5 seconds @ 150-200 mA)
   - Trade-off: Maintains WiFi power consumption

3. **Static IP Configuration**
   - Reduces DHCP negotiation time
   - Faster connection establishment
   - Saves ~1-2 seconds per connection

4. **WiFi Power Saving Mode**
   ```cpp
   WiFi.setSleepMode(WIFI_LIGHT_SLEEP);
   // Reduces idle power by ~20-30%
   ```

### Sensor Power Management

#### SCD41 Power Modes

**Current Mode: Periodic Measurement**
- Power: ~19 mA (continuous)
- Update interval: 5 seconds
- Always ready for reading

**Alternative: Single-Shot Measurement**
- Power: ~19 mA (only during measurement)
- Measurement time: ~5 seconds
- Can be powered down between measurements
- **Savings**: ~19 mA when not measuring

**Implementation:**
```cpp
// Stop periodic measurement
scd41.stopPeriodicMeasurement();

// For each reading:
scd41.measureSingleShot();
delay(5000);  // Wait for measurement
scd41.readMeasurement();

// Power down sensor (via GPIO if possible)
```

**Note**: SCD41 doesn't have explicit power-down command, but can be controlled via power supply GPIO if available.

### Display Power Management

#### SSD1306 OLED Power Modes

**Current**: Always on, refreshed every 10 seconds

**Optimization Strategies:**

1. **Display Sleep Between Updates**
   ```cpp
   display.ssd1306_command(SSD1306_DISPLAYOFF);
   // Power: ~0.1-0.5 mA (sleep)
   // Wake: ~10-20 ms
   ```

2. **Reduced Refresh Rate**
   - Update only when data changes significantly
   - Update only when user interaction expected
   - **Savings**: ~20-40 mA when off

3. **Display-On-Demand**
   - Wake display only for critical alerts
   - Keep off during normal operation
   - **Savings**: ~20-40 mA continuously

---

## Protocol Comparison

### HTTPS (Current)

**Characteristics:**
- Protocol: HTTP/1.1 over TLS (BearSSL)
- Connection: TCP with TLS handshake
- Overhead: ~200-500 bytes per request (headers + TLS)
- Power: High (encryption/decryption)

**Power Consumption:**
- Connection establishment: ~150-200 mA × 2-5s = 0.08-0.28 mAh
- Transmission: ~100 mA × 1-3s = 0.03-0.08 mAh
- Idle connection: ~75 mA (continuous)

**Pros:**
- Secure (TLS encryption)
- Standard HTTP (easy backend integration)
- Already implemented

**Cons:**
- High power consumption
- Large overhead
- Slow connection establishment

### MQTT (Message Queuing Telemetry Transport)

**Characteristics:**
- Protocol: Lightweight publish/subscribe
- Connection: TCP (persistent)
- Overhead: ~2-10 bytes per message
- Power: Medium (persistent connection)

**Power Consumption:**
- Connection establishment: ~150-200 mA × 2-3s = 0.08-0.17 mAh (one-time)
- Transmission: ~80-100 mA × 0.1-0.5s = 0.002-0.014 mAh
- Idle connection: ~70-75 mA (if kept alive)

**Energy Efficiency:**
- **~50-70% less power** than HTTPS per transmission
- Persistent connection reduces overhead
- QoS levels for reliability

**Implementation Requirements:**
- MQTT broker (Mosquitto, AWS IoT, etc.)
- Backend MQTT client
- ESP8266 MQTT library (PubSubClient)

**Pros:**
- Low overhead
- Persistent connection
- Designed for IoT
- QoS levels

**Cons:**
- Requires MQTT broker
- Backend changes needed
- Connection must be maintained (or reconnected)

### CoAP (Constrained Application Protocol)

**Characteristics:**
- Protocol: UDP-based, REST-like
- Connection: Connectionless (UDP)
- Overhead: ~4-8 bytes per message
- Power: Very low (no connection overhead)

**Power Consumption:**
- Transmission: ~80-100 mA × 0.1-0.3s = 0.002-0.008 mAh
- No idle connection (UDP)
- **~70-80% less power** than HTTPS

**Energy Efficiency:**
- No connection establishment overhead
- Minimal protocol overhead
- Designed for constrained devices

**Implementation Requirements:**
- CoAP server (backend)
- ESP8266 CoAP library
- UDP support

**Pros:**
- Very low overhead
- No connection management
- Designed for IoT
- REST-like API

**Cons:**
- Less reliable (UDP)
- Backend changes needed
- Less common than MQTT

### Comparison Summary

| Protocol | Power/Transmission | Connection Overhead | Reliability | Backend Changes |
|----------|-------------------|---------------------|-------------|----------------|
| **HTTPS** | High | High | High | None |
| **MQTT** | Medium | Low (persistent) | High (QoS) | Moderate |
| **CoAP** | Very Low | None (UDP) | Medium (UDP) | Moderate |

---

## System-Wide Optimization Techniques

### Data Optimization

#### 1. Compression Strategies

**CBOR (Concise Binary Object Representation)**
- Binary format, ~30-50% smaller than JSON
- Library: ArduinoJson supports CBOR
- **Savings**: ~30-50% transmission time

**MessagePack**
- Similar to CBOR
- Binary format
- **Savings**: ~30-50% transmission time

**Delta Encoding**
- Send only changes from last reading
- **Savings**: ~50-90% data size (if changes are small)

**Data Quantization**
- Reduce precision (e.g., 22.5°C → 23°C)
- **Savings**: ~10-20% data size

#### 2. Adaptive Transmission

**Change Detection**
```cpp
bool shouldTransmit(SensorData newData, SensorData lastData) {
  float tempDiff = abs(newData.temperature - lastData.temperature);
  float humDiff = abs(newData.humidity - lastData.humidity);
  int co2Diff = abs(newData.co2 - lastData.co2);
  
  return (tempDiff > 0.5 || humDiff > 2.0 || co2Diff > 50);
}
```

**Benefits:**
- Skip transmission if no significant change
- **Savings**: ~50-80% transmissions (depending on stability)

**Priority-Based Transmission**
- Transmit critical data (high CO2) immediately
- Batch normal data
- **Savings**: Reduced urgent transmissions

**Adaptive Intervals**
- Increase reading interval when stable
- Decrease when changes detected
- **Savings**: ~30-50% readings

### Wake/Sleep Cycle Optimization

#### Optimal Wake Duration

**Current Cycle (with deep sleep):**
1. Wake from deep sleep: ~2-3 seconds
2. Initialize sensors: ~0.5 seconds
3. Read sensors: ~0.1 seconds
4. Connect WiFi: ~2-5 seconds
5. Transmit data: ~1-3 seconds
6. Enter deep sleep: ~0.1 seconds
**Total active time: ~6-12 seconds**

**Optimized Cycle:**
1. Wake from deep sleep: ~2-3 seconds
2. Read sensors (sensor already warm): ~0.1 seconds
3. Connect WiFi: ~2-3 seconds (static IP)
4. Transmit data: ~0.5-1 seconds (MQTT/compressed)
5. Enter deep sleep: ~0.1 seconds
**Total active time: ~5-7 seconds**

**Energy per Cycle:**
- Current: ~6-12s × 100 mA = 0.17-0.33 mAh
- Optimized: ~5-7s × 100 mA = 0.14-0.19 mAh
- **Savings**: ~20-30% per cycle

#### Coordinated Peripheral Management

**Wake Sequence:**
1. Wake ESP8266 from deep sleep
2. Power on sensors (if GPIO-controlled)
3. Wait for sensor warm-up (if needed)
4. Read sensors
5. Power down sensors
6. Connect WiFi
7. Transmit data
8. Disconnect WiFi
9. Power down display (if enabled)
10. Enter deep sleep

**Sleep Sequence:**
1. Disconnect WiFi
2. Power down display
3. Stop sensor periodic measurement
4. Clear UART FIFO
5. Enter deep sleep

---

## Recommended Architectures

### Option 1: Deep Sleep with Optimized Wake Cycles (Recommended - Easiest, Highest Savings)

**Description:**
Enable deep sleep between readings with optimized wake cycles. Minimal code changes, maximum energy savings.

**Implementation:**
- Enable `ENABLE_DEEP_SLEEP = 1`
- Optimize wake cycle duration
- Disconnect WiFi after transmission
- Power down display before sleep
- Use static IP for faster connection

**Power Consumption:**
- Active: ~100 mA × 6-8 seconds = 0.17-0.22 mAh per cycle
- Sleep: ~15 µA × 52-54 seconds = 0.0002 mAh per cycle
- **Total per 60s cycle: ~0.17-0.22 mAh**

**Daily Energy:**
- ~244-317 mAh/day (60s intervals)
- **Battery life: 6-8 days (2x AA, 2000mAh)**

**Savings:**
- **~99.2% reduction** vs current continuous operation
- **~90% improvement** vs current (if deep sleep enabled but not optimized)

**Pros:**
- Easiest to implement
- Highest energy savings
- Minimal code changes
- Uses existing infrastructure

**Cons:**
- Device restarts on each wake (2-3s overhead)
- RTC memory only (limited state retention)
- Requires GPIO16-RST connection

**Effort:** Low (2-4 hours)

---

### Option 2: Light Sleep + Sensor/Display Management (Balanced)

**Description:**
Use light sleep between readings with coordinated sensor and display power management. Maintains state, faster wake.

**Implementation:**
- Use `ESP.lightSleep()` instead of deep sleep
- Disconnect WiFi between readings
- Stop sensor periodic measurement when sleeping
- Power down display when sleeping
- Reconnect WiFi only when transmitting

**Power Consumption:**
- Active: ~100 mA × 6-8 seconds = 0.17-0.22 mAh per cycle
- Light sleep: ~0.8 mA × 52-54 seconds = 0.012-0.012 mAh per cycle
- **Total per 60s cycle: ~0.18-0.23 mAh**

**Daily Energy:**
- ~259-331 mAh/day (60s intervals)
- **Battery life: 6-8 days (2x AA, 2000mAh)**

**Savings:**
- **~99.1% reduction** vs current
- Faster wake (~10-50ms vs 2-3s)
- Full RAM retention

**Pros:**
- Fast wake time
- State retention (no restart)
- Good energy savings
- No hardware modifications

**Cons:**
- Higher sleep current than deep sleep
- More complex state management

**Effort:** Medium (4-6 hours)

---

### Option 3: MQTT + Coordinated Power Management (Balanced)

**Description:**
Switch to MQTT protocol with full system power management. Better for frequent transmissions.

**Implementation:**
- Implement MQTT client (PubSubClient library)
- Set up MQTT broker (backend)
- Use deep sleep with MQTT
- Maintain MQTT connection only during transmission
- Implement QoS levels for reliability

**Power Consumption:**
- Active: ~90 mA × 5-7 seconds = 0.13-0.18 mAh per cycle
- Sleep: ~15 µA × 53-55 seconds = 0.0002 mAh per cycle
- **Total per 60s cycle: ~0.13-0.18 mAh**

**Daily Energy:**
- ~187-259 mAh/day (60s intervals)
- **Battery life: 8-11 days (2x AA, 2000mAh)**

**Savings:**
- **~99.3% reduction** vs current
- Lower transmission overhead
- Better for frequent small messages

**Pros:**
- Lower transmission overhead
- Designed for IoT
- QoS levels for reliability
- Good for frequent transmissions

**Cons:**
- Requires MQTT broker
- Backend changes needed
- More complex implementation

**Effort:** Medium-High (6-8 hours)

---

### Option 4: CoAP + Full System Optimization (Most Efficient)

**Description:**
Use CoAP protocol with full system optimization including compression and adaptive transmission.

**Implementation:**
- Implement CoAP client
- Set up CoAP server (backend)
- Use deep sleep
- Implement data compression (CBOR)
- Adaptive transmission (change detection)
- Full peripheral power management

**Power Consumption:**
- Active: ~80 mA × 4-6 seconds = 0.09-0.13 mAh per cycle
- Sleep: ~15 µA × 54-56 seconds = 0.0002 mAh per cycle
- **Total per 60s cycle: ~0.09-0.13 mAh**

**Daily Energy:**
- ~130-187 mAh/day (60s intervals)
- **Battery life: 11-15 days (2x AA, 2000mAh)**

**Savings:**
- **~99.5% reduction** vs current
- Lowest transmission overhead
- Most efficient protocol

**Pros:**
- Lowest power consumption
- No connection overhead
- Designed for constrained devices
- Best for battery operation

**Cons:**
- Less reliable (UDP)
- Backend changes needed
- Less common than MQTT
- More complex implementation

**Effort:** High (8-12 hours)

---

### Option 5: Hybrid Adaptive Approach (Intelligent)

**Description:**
Intelligent wake/sleep with adaptive intervals, change detection, and protocol optimization.

**Implementation:**
- Deep sleep with adaptive intervals
- Change detection (skip transmission if no change)
- Priority-based transmission (critical data immediately)
- Protocol selection based on data size
- Machine learning for optimal intervals

**Power Consumption:**
- Variable based on conditions
- **~99.0-99.5% reduction** vs current
- **Battery life: 1-2 years** (with adaptive intervals)

**Pros:**
- Most intelligent
- Adapts to conditions
- Maximum efficiency
- Longest battery life

**Cons:**
- Most complex
- Requires testing/tuning
- Higher development effort

**Effort:** Very High (12-20 hours)

---

## Implementation Roadmap

### Phase 1: Quick Wins (Option 1 - Deep Sleep Optimization)

**Week 1:**
1. Enable deep sleep (`ENABLE_DEEP_SLEEP = 1`)
2. Optimize wake cycle (minimize active time)
3. Implement WiFi disconnect after transmission
4. Add display power-down before sleep
5. Test and measure power consumption

**Expected Result:**
- ~99% energy savings
- Battery life: 6-8 days → 1-2 years

### Phase 2: Protocol Optimization (Option 3 - MQTT)

**Week 2-3:**
1. Set up MQTT broker (backend)
2. Implement MQTT client on ESP8266
3. Migrate transmission to MQTT
4. Test reliability and power consumption

**Expected Result:**
- Additional ~10-20% savings vs HTTPS
- Better for frequent transmissions

### Phase 3: Advanced Optimization (Option 4/5)

**Week 4-6:**
1. Implement data compression
2. Add change detection
3. Adaptive transmission intervals
4. Full system optimization

**Expected Result:**
- Maximum efficiency
- 1-2 year battery life

---

## Risks & Mitigation

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| **Deep sleep wake failure** | High | Low | Test GPIO16-RST connection, add watchdog |
| **Data loss during sleep** | Medium | Low | Use RTC memory for critical state, implement retry logic |
| **WiFi connection issues** | Medium | Medium | Implement connection retry, fallback to light sleep |
| **Sensor warm-up delay** | Low | Medium | Pre-warm sensor before critical readings |
| **Backend compatibility** | Medium | Low | Test MQTT/CoAP backend thoroughly before deployment |
| **Battery life shorter than expected** | Medium | Medium | Measure actual consumption, adjust intervals |

---

## Follow-up Questions

1. **Battery vs. Mains Power**: Is the device battery-powered or mains-powered? This affects optimization priorities.

2. **Data Freshness Requirements**: How critical is real-time data? Can we tolerate longer intervals for energy savings?

3. **Backend Flexibility**: Can we modify the backend to support MQTT or CoAP?

4. **Display Requirements**: Is the display necessary, or can it be optional/on-demand?

5. **Critical Alerts**: Do we need immediate transmission for critical readings (e.g., high CO2)?

6. **Deployment Scale**: How many devices will be deployed? This affects backend infrastructure decisions.

---

## Research Sources

1. [ESP8266 Low Power Solutions](https://www.espressif.com/sites/default/files/documentation/9b-esp8266-low_power_solutions__en.pdf) - Espressif official documentation
2. [ESP8266 Power Consumption Calculator](https://ccalculators.co.uk/esp8266-power-consumption-calculator/) - Power consumption estimates
3. [Adafruit Energy Budgets](https://learn.adafruit.com/energy-budgets/making-a-budget) - Energy budgeting guide
4. [ESP8266 Deep Sleep Guide](https://arduinodiy.wordpress.com/2020/02/06/very-deep-sleep-and-energy-saving-on-esp8266-part-5-esp-now/) - Deep sleep implementation
5. [MQTT vs HTTP for IoT](https://www.hivemq.com/blog/mqtt-vs-http-for-iot/) - Protocol comparison
6. [CoAP Protocol Specification](https://coap.technology/) - CoAP documentation

---

## Next Steps

1. **Review this research** with stakeholders
2. **Select preferred approach** (recommendation: Option 1 for quick wins, then Option 3 for long-term)
3. **Proceed to specification**: `/specify energy-efficient-transmission`
4. **Create implementation plan** based on selected approach
5. **Test and measure** actual power consumption

---

**Created:** 2024-12-19  
**Status:** Complete  
**Next Phase:** Specification (`/specify energy-efficient-transmission`)

