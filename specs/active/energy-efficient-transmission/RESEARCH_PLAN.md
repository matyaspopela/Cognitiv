# Research Plan: Energy-Efficient Data Transmission Architecture

## Research Objective

Investigate and document energy-efficient alternatives for the **entire ESP8266 system**, including:
- Sensor reading/measurement system (SCD41)
- Display system (SSD1306 OLED, if enabled)
- I2C bus and peripheral management
- WiFi data transmission
- Overall system power management and wake/sleep cycles

Focus on reducing **total system power consumption** while maintaining reliability and data integrity.

## Current Architecture Analysis

### Current Implementation Overview

**Device**: ESP8266 (ESP12S) with SCD41 sensor  
**Transmission Protocol**: HTTPS POST (BearSSL::WiFiClientSecure)  
**Backend**: Django server at `https://cognitiv.onrender.com/data`  
**Data Format**: JSON (single reading or bundled array)

### Current Energy Consumption Issues

1. **Sensor System**
   - SCD41 runs in periodic measurement mode continuously
   - No sensor power management (sensors always powered)
   - I2C bus active even when not reading
   - First reading requires ~60 second warm-up period

2. **Display System** (if HAS_DISPLAY enabled)
   - SSD1306 OLED display always on
   - Display refreshed every reading cycle
   - No display sleep/power-down modes
   - Display consumes ~20-40mA continuously

3. **WiFi Connection Management**
   - WiFi stays connected continuously between readings
   - No power-saving modes (light sleep, modem sleep) implemented
   - Connection maintained even when not transmitting
   - WiFi radio consumes ~70-80mA when active

4. **Transmission Overhead**
   - HTTPS/TLS encryption overhead (BearSSL)
   - HTTP headers and connection establishment
   - No data compression
   - Full JSON payload even for small changes

5. **Transmission Frequency**
   - Reading interval: 10 seconds (configurable)
   - Bundle interval: 5 minutes (when bundling enabled)
   - No adaptive transmission based on data change magnitude

6. **System Power Management**
   - Deep sleep available but disabled (`ENABLE_DEEP_SLEEP = 0`)
   - No light sleep or modem sleep between readings
   - ESP8266 CPU runs continuously
   - No coordinated power-down of peripherals

## Research Strategy

### Phase 1: Codebase Analysis (15 minutes)

**Areas to examine:**
- `src/main.cpp`: Current transmission implementation
- `include/config.h`: Configuration parameters
- `server/api/views.py`: Backend endpoint capabilities
- Existing bundling mechanism (`specs/active/http-request-bundling/`)

**Key questions:**
- How is WiFi currently managed?
- What's the exact transmission flow?
- What backend modifications are possible?
- What's the current power consumption profile?

### Phase 2: ESP8266 System Power Optimization Research (25 minutes)

**Topics to investigate:**

**ESP8266 Core:**
- Power modes (active, light sleep, modem sleep, deep sleep)
- CPU frequency scaling (80MHz vs 160MHz)
- Power consumption in each mode (mA measurements)

**WiFi Management:**
- WiFi.disconnect() vs WiFi.mode() power implications
- Connection reuse vs reconnection energy costs
- BearSSL vs plain HTTP energy comparison
- WiFi power consumption measurements (mA)

**Sensor System:**
- SCD41 power consumption and modes
- Sensor sleep/wake strategies
- I2C bus power management
- Periodic vs on-demand measurement modes
- Sensor warm-up time optimization

**Display System:**
- SSD1306 OLED power consumption
- Display sleep/power-down modes
- Refresh rate optimization
- Display-on-demand vs always-on strategies

**External research:**
- ESP8266 datasheet power specifications
- SCD41 datasheet power modes
- SSD1306 OLED power specifications
- Arduino ESP8266 WiFi library power management
- Industry best practices for ESP8266 IoT power optimization

### Phase 3: Alternative Transmission Protocols (20 minutes)

**Protocols to compare:**
- **MQTT** (Message Queuing Telemetry Transport)
  - Lightweight publish/subscribe
  - Persistent connections
  - QoS levels
  - Energy efficiency characteristics
  
- **CoAP** (Constrained Application Protocol)
  - UDP-based, low overhead
  - Designed for IoT
  - Energy efficiency
  
- **HTTP/2** vs HTTP/1.1
  - Connection multiplexing
  - Header compression
  - Energy implications
  
- **LoRaWAN** (if applicable)
  - Long-range, low-power
  - Trade-offs vs WiFi

**Comparison criteria:**
- Power consumption per transmission
- Connection overhead
- Implementation complexity
- Backend compatibility
- Data reliability

### Phase 4: System-Wide Optimization Techniques (20 minutes)

**Data Optimization:**
- JSON compression (CBOR, MessagePack)
- Delta encoding (send only changes)
- Data quantization (reduce precision)
- Binary protocols vs JSON

**Adaptive System Behavior:**
- Change detection (only read/send if significant change expected)
- Priority-based transmission (critical data first)
- Adaptive intervals (longer when stable)
- Threshold-based bundling
- Sensor reading frequency optimization

**Wake/Sleep Cycle Optimization:**
- Optimal wake duration (minimize active time)
- Coordinated peripheral wake/sleep
- Sensor warm-up time management
- Display wake-on-demand
- WiFi connection timing optimization

### Phase 5: Architecture Recommendations (10 minutes)

**Synthesize findings into:**
- Recommended architecture(s)
- Implementation complexity assessment
- Expected energy savings
- Trade-offs and considerations
- Migration path from current implementation

## Research Document Structure

The final `research.md` will include:

1. **Executive Summary**
   - Current power consumption estimate
   - Potential savings with each approach
   - Recommended path forward

2. **Current Architecture Deep Dive**
   - Detailed code analysis with energy hotspots
   - Power consumption breakdown by component:
     - ESP8266 CPU (active/idle)
     - WiFi radio (connected/idle/off)
     - SCD41 sensor (periodic measurement)
     - SSD1306 display (if enabled)
     - I2C bus
   - Bottleneck identification

3. **ESP8266 System Power Management**
   - Available power modes (CPU, WiFi, peripherals)
   - Sensor power management strategies
   - Display power management strategies
   - WiFi power optimization techniques
   - Coordinated wake/sleep cycles
   - Code examples and measurements

4. **Protocol Comparison**
   - MQTT vs HTTPS vs CoAP
   - Energy consumption comparison
   - Implementation requirements
   - Backend compatibility

5. **Data Optimization**
   - Compression techniques
   - Adaptive transmission strategies
   - Change detection algorithms

6. **Recommended Architectures**
   - **Option 1**: Deep sleep with optimized wake cycles (easiest, highest savings)
   - **Option 2**: Light sleep + sensor/display management (balanced)
   - **Option 3**: MQTT + coordinated power management (balanced)
   - **Option 4**: CoAP + full system optimization (most efficient)
   - **Option 5**: Hybrid adaptive approach (intelligent wake/sleep)

7. **Implementation Roadmap**
   - Phased approach
   - Testing strategy
   - Migration plan

## Success Criteria

Research is complete when:
- ✅ Current architecture fully understood
- ✅ At least 3 alternative approaches documented
- ✅ Energy consumption estimates for each approach
- ✅ Implementation complexity assessed
- ✅ Backend compatibility verified
- ✅ Clear recommendation with rationale
- ✅ Migration path defined

## Time Allocation

- **Codebase analysis**: 20 minutes (expanded to include sensors/display)
- **ESP8266 system power research**: 25 minutes
- **Protocol comparison**: 20 minutes
- **System-wide optimization**: 20 minutes
- **Documentation**: 15 minutes
- **Total**: ~100 minutes

## Output

Creates: `specs/active/energy-efficient-transmission/research.md`

---

**Next Steps After Research:**
1. Review research findings
2. Select preferred approach
3. Proceed to `/specify energy-efficient-transmission` for detailed specification

