#!/usr/bin/env python3
"""
MQTT Subscriber Test Script
Listens to the MQTT topic to verify messages are being published correctly

Run this in a separate terminal to monitor incoming messages.
"""

import json
import paho.mqtt.client as mqtt
from datetime import datetime

# MQTT Configuration
# Note: Use server subscriber credentials for testing server functionality
# ESP8266 publisher uses: esp_12s_school_1 / espASS12
# Server subscriber uses: Mongo_puller / espASS12
MQTT_BROKER_HOST = "fc716f4d434d4d7689ca16c9be2ebf2b.s1.eu.hivemq.cloud"
MQTT_BROKER_PORT = 8883  # TLS port
MQTT_USERNAME = "Mongo_puller"  # Server subscriber credentials
MQTT_PASSWORD = "espASS12"
MQTT_TOPIC = "sensors/esp_12s_school_1/data"

def on_connect(client, userdata, flags, rc):
    """Called when the broker responds to our connection request"""
    if rc == 0:
        print("✓ MQTT Subscriber connected successfully!")
        print(f"  Subscribing to topic: {MQTT_TOPIC}")
        client.subscribe(MQTT_TOPIC)
        print("  Waiting for messages...\n")
    else:
        print(f"✗ Connection failed with code {rc}")

def on_message(client, userdata, msg):
    """Called when a message is received from the broker"""
    try:
        # Parse JSON payload
        payload = json.loads(msg.payload.decode('utf-8'))
        
        # Format timestamp
        timestamp = payload.get('timestamp', 0)
        if timestamp:
            dt = datetime.fromtimestamp(timestamp)
            timestamp_str = dt.strftime('%Y-%m-%d %H:%M:%S')
        else:
            timestamp_str = "N/A"
        
        # Print received message
        print("=" * 60)
        print(f"📨 Message received at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print("=" * 60)
        print(f"Topic: {msg.topic}")
        print(f"QoS: {msg.qos}")
        print(f"Retain: {msg.retain}")
        print()
        print("Sensor Data:")
        print(f"  Device ID: {payload.get('device_id', 'N/A')}")
        print(f"  MAC Address: {payload.get('mac_address', 'N/A')}")
        print(f"  Timestamp: {timestamp_str} ({timestamp})")
        print(f"  Temperature: {payload.get('temperature', 'N/A')}°C")
        print(f"  Humidity: {payload.get('humidity', 'N/A')}%")
        print(f"  CO2: {payload.get('co2', 'N/A')} ppm")
        print(f"  Voltage: {payload.get('voltage', 'N/A')} V")
        print()
        print("Raw JSON:")
        print(json.dumps(payload, indent=2))
        print()
        
        # Validate payload
        required_fields = ['timestamp', 'device_id', 'temperature', 'humidity', 'co2']
        missing_fields = [f for f in required_fields if f not in payload]
        
        if missing_fields:
            print(f"⚠️  Warning: Missing required fields: {', '.join(missing_fields)}")
        else:
            print("✓ All required fields present")
        
        # Check data ranges
        temp = payload.get('temperature')
        hum = payload.get('humidity')
        co2 = payload.get('co2')
        
        warnings = []
        if temp and not (-10 <= temp <= 50):
            warnings.append(f"Temperature out of range: {temp}°C")
        if hum and not (0 <= hum <= 100):
            warnings.append(f"Humidity out of range: {hum}%")
        if co2 and not (400 <= co2 <= 5000):
            warnings.append(f"CO2 out of range: {co2} ppm")
        
        if warnings:
            print("⚠️  Validation warnings:")
            for warning in warnings:
                print(f"    - {warning}")
        else:
            print("✓ Data ranges valid")
        
        print()
        
    except json.JSONDecodeError as e:
        print(f"✗ Error parsing JSON: {e}")
        print(f"Raw message: {msg.payload.decode('utf-8', errors='ignore')}")
    except Exception as e:
        print(f"✗ Error processing message: {e}")
        import traceback
        traceback.print_exc()

def on_subscribe(client, userdata, mid, granted_qos):
    """Called when the broker responds to a subscribe request"""
    print(f"✓ Subscribed (mid={mid}, QoS={granted_qos})")

def on_disconnect(client, userdata, rc):
    """Called when the client disconnects from the broker"""
    if rc != 0:
        print(f"⚠️  Unexpected disconnection (rc={rc})")
    else:
        print("✓ Disconnected cleanly")

def main():
    """Main subscriber function"""
    print("=" * 60)
    print("MQTT Subscriber Test - Message Monitor")
    print("=" * 60)
    print()
    print(f"Broker: {MQTT_BROKER_HOST}:{MQTT_BROKER_PORT}")
    print(f"Topic: {MQTT_TOPIC}")
    print(f"Username: {MQTT_USERNAME}")
    print()
    print("Press Ctrl+C to stop\n")
    
    # Create MQTT client
    client_id = f"test_subscriber_{int(datetime.now().timestamp())}"
    client = mqtt.Client(client_id=client_id, protocol=mqtt.MQTTv311)
    
    # Set callbacks
    client.on_connect = on_connect
    client.on_message = on_message
    client.on_subscribe = on_subscribe
    client.on_disconnect = on_disconnect
    
    # Set credentials
    client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD)
    
    # Enable TLS
    client.tls_set()
    
    try:
        # Connect and start loop
        client.connect(MQTT_BROKER_HOST, MQTT_BROKER_PORT, 60)
        client.loop_forever()  # Blocking call
    
    except KeyboardInterrupt:
        print("\n\nStopping subscriber...")
        client.disconnect()
        print("✓ Subscriber stopped")
    except Exception as e:
        print(f"✗ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()

