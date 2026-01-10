# MQTT Testing Guide

This guide explains how to test the MQTT implementation without uploading to hardware.

## Prerequisites

Install the required Python package:

```bash
pip install paho-mqtt
```

## Test Scripts

### 1. Publisher Test (`test_mqtt_publisher.py`)

Simulates the ESP8266 publishing sensor data to the MQTT broker.

**What it does:**
- Connects to HiveMQ broker using the same credentials as ESP8266
- Generates test sensor data matching the ESP8266 format
- Validates the payload format
- Publishes messages to the MQTT topic
- Verifies connection and publish success

**Run it:**
```bash
python test_mqtt_publisher.py
```

**Expected output:**
```
✓ MQTT Connected successfully!
✓ Payload validation passed
✓ Successfully published to topic: sensors/esp_12s_school_1/data
```

### 2. Subscriber Test (`test_mqtt_subscriber.py`)

Listens to the MQTT topic to verify messages are being received.

**What it does:**
- Connects to HiveMQ broker
- Subscribes to the sensor data topic
- Displays received messages with validation
- Runs continuously until stopped (Ctrl+C)

**Run it:**
```bash
python test_mqtt_subscriber.py
```

**Expected output:**
```
✓ MQTT Subscriber connected successfully!
✓ Subscribed
📨 Message received at 2024-01-15 10:30:45
  Device ID: ESP8266A2
  Temperature: 22.50°C
  CO2: 650 ppm
  ...
```

## Testing Workflow

### Step 1: Test Publisher (Verify Connection)

1. Run the publisher test:
   ```bash
   python test_mqtt_publisher.py
   ```

2. Verify:
   - ✓ Connection successful
   - ✓ Payload validation passed
   - ✓ Messages published successfully

### Step 2: Test Subscriber (Verify Reception)

1. In a **separate terminal**, run the subscriber:
   ```bash
   python test_mqtt_subscriber.py
   ```

2. In the **first terminal**, run the publisher again:
   ```bash
   python test_mqtt_publisher.py
   ```

3. Verify the subscriber receives the messages.

### Step 3: Verify in HiveMQ Console

1. Go to [HiveMQ Web Console](https://www.hivemq.com/web-mqtt-client/)
2. Connect using:
   - Host: `fc716f4d434d4d7689ca16c9be2ebf2b.s1.eu.hivemq.cloud`
   - Port: `8883`
   - Username: `esp_12s_school_1`
   - Password: `espASS12`
3. Subscribe to topic: `sensors/esp_12s_school_1/data`
4. Run the publisher test and verify messages appear

### Step 4: Hardware Test

Once software tests pass:
1. Upload firmware to ESP8266
2. Monitor serial output for MQTT connection status
3. Verify messages appear in HiveMQ console or subscriber

## Troubleshooting

### Connection Failed

**Error:** `Connection failed with code 4`
- **Cause:** Bad username or password
- **Fix:** Verify credentials in `include/config.h`

**Error:** `Connection failed with code 3`
- **Cause:** Server unavailable or network issue
- **Fix:** Check internet connection and broker address

### TLS/SSL Errors

**Error:** `SSL/TLS certificate verification failed`
- **Cause:** Certificate validation issue
- **Fix:** The test scripts use system CA certificates. If issues persist, check firewall/proxy settings.

### No Messages Received

**Symptom:** Publisher succeeds but subscriber doesn't receive messages
- **Cause:** Topic mismatch or QoS issue
- **Fix:** Verify both use the same topic: `sensors/esp_12s_school_1/data`

## Payload Format

The test scripts generate payloads matching the ESP8266 format:

```json
{
  "timestamp": 1699012345,
  "device_id": "ESP8266A2",
  "mac_address": "AA:BB:CC:DD:EE:FF",
  "temperature": 22.50,
  "humidity": 45.20,
  "co2": 650,
  "voltage": 3.85
}
```

## Validation Rules

The test scripts validate payloads using the same rules as the server:

- **Required fields:** `timestamp`, `device_id`, `temperature`, `humidity`, `co2`
- **Temperature range:** -10°C to 50°C
- **Humidity range:** 0% to 100%
- **CO2 range:** 400 to 5000 ppm
- **Voltage:** Optional field

## Next Steps

After successful testing:
1. ✅ MQTT connection works
2. ✅ Payload format is correct
3. ✅ Messages are published and received
4. → Upload firmware to ESP8266 hardware
5. → Monitor serial output for MQTT status
6. → Verify real sensor data appears in broker


