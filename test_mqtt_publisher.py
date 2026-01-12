#!/usr/bin/env python3
"""
MQTT Publisher Test Script
Simulates ESP8266 sensor data publishing to HiveMQ broker

This script tests the MQTT connection and message format without needing hardware.
"""

import json
import time
import random
from datetime import datetime
import paho.mqtt.client as mqtt

# MQTT Configuration (from config.h)
MQTT_BROKER_HOST = "fc716f4d434d4d7689ca16c9be2ebf2b.s1.eu.hivemq.cloud"
MQTT_BROKER_PORT = 8883  # TLS port
MQTT_USERNAME = "esp_12s_school_1"
MQTT_PASSWORD = "espASS12"
MQTT_TOPIC = "sensors/esp_12s_school_1/data"

# Device configuration (from config.h)
DEVICE_ID = "ESP8266A2"
DEVICE_MAC = "AA:BB:CC:DD:EE:FF"  # Simulated MAC address

# Callback functions
def on_connect(client, userdata, flags, rc):
    """Called when the broker responds to our connection request"""
    if rc == 0:
        print("✓ MQTT Connected successfully!")
        print(f"  Connection flags: {flags}")
    else:
        print(f"✗ MQTT Connection failed with code {rc}")
        print("  Error codes:")
        print("    0 = Success")
        print("    1 = Incorrect protocol version")
        print("    2 = Invalid client identifier")
        print("    3 = Server unavailable")
        print("    4 = Bad username or password")
        print("    5 = Not authorized")

def on_disconnect(client, userdata, rc):
    """Called when the client disconnects from the broker"""
    if rc != 0:
        print(f"⚠️  Unexpected MQTT disconnection (rc={rc})")
    else:
        print("✓ MQTT Disconnected cleanly")

def on_publish(client, userdata, mid):
    """Called when a message has been sent to the broker"""
    print(f"✓ Message published (mid={mid})")

def create_test_sensor_data():
    """
    Creates a test sensor reading matching the ESP8266 format
    
    Returns:
        dict: Sensor data in the same format as ESP8266 sendSingleReading()
    """
    # Generate realistic test data
    timestamp = int(time.time())
    
    # Simulate sensor readings with some variation
    temperature = round(random.uniform(18.0, 25.0), 2)
    humidity = round(random.uniform(30.0, 60.0), 2)
    co2 = random.randint(400, 1200)  # Normal indoor range
    voltage = round(random.uniform(3.5, 4.2), 2)  # Battery voltage
    
    payload = {
        "timestamp": timestamp,
        "device_id": DEVICE_ID,
        "mac_address": DEVICE_MAC,
        "temperature": temperature,
        "humidity": humidity,
        "co2": co2,
        "voltage": voltage
    }
    
    return payload

def validate_payload(payload):
    """
    Validates the payload matches server expectations
    
    Args:
        payload (dict): Sensor data payload
        
    Returns:
        tuple: (is_valid, error_message)
    """
    required_fields = ['timestamp', 'device_id', 'temperature', 'humidity', 'co2']
    
    # Check required fields
    for field in required_fields:
        if field not in payload:
            return False, f"Missing required field: {field}"
    
    # Validate data ranges (matching server validation)
    try:
        temperature = float(payload['temperature'])
        humidity = float(payload['humidity'])
        co2 = int(payload['co2'])
        
        if not (-10 <= temperature <= 50):
            return False, f"Temperature out of range: {temperature}°C (expected -10 to 50)"
        
        if not (0 <= humidity <= 100):
            return False, f"Humidity out of range: {humidity}% (expected 0 to 100)"
        
        if not (400 <= co2 <= 5000):
            return False, f"CO2 out of range: {co2} ppm (expected 400 to 5000)"
        
        return True, "Valid"
    except (ValueError, TypeError) as e:
        return False, f"Invalid data type: {str(e)}"

def main():
    """Main test function"""
    print("=" * 60)
    print("MQTT Publisher Test - ESP8266 Sensor Data Simulator")
    print("=" * 60)
    print()
    
    # Create MQTT client with unique client ID
    client_id = f"test_publisher_{int(time.time())}"
    client = mqtt.Client(client_id=client_id, protocol=mqtt.MQTTv311)
    
    # Set callbacks
    client.on_connect = on_connect
    client.on_disconnect = on_disconnect
    client.on_publish = on_publish
    
    # Set credentials
    client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD)
    
    # Enable TLS
    client.tls_set()  # Uses system CA certificates
    
    print(f"Connecting to MQTT broker...")
    print(f"  Host: {MQTT_BROKER_HOST}")
    print(f"  Port: {MQTT_BROKER_PORT}")
    print(f"  Username: {MQTT_USERNAME}")
    print(f"  Topic: {MQTT_TOPIC}")
    print()
    
    try:
        # Connect to broker
        client.connect(MQTT_BROKER_HOST, MQTT_BROKER_PORT, 60)
        
        # Start network loop (non-blocking)
        client.loop_start()
        
        # Wait for connection
        timeout = 10
        start_time = time.time()
        while not client.is_connected() and (time.time() - start_time) < timeout:
            time.sleep(0.1)
        
        if not client.is_connected():
            print("✗ Connection timeout!")
            return
        
        # Generate and validate test data
        print("\n" + "=" * 60)
        print("Generating test sensor data...")
        print("=" * 60)
        
        test_data = create_test_sensor_data()
        
        # Validate payload
        is_valid, message = validate_payload(test_data)
        if not is_valid:
            print(f"✗ Payload validation failed: {message}")
            return
        
        print("✓ Payload validation passed")
        print()
        print("Test payload:")
        print(json.dumps(test_data, indent=2))
        print()
        
        # Convert to JSON string (matching ESP8266 format)
        json_payload = json.dumps(test_data)
        
        # Publish message
        print("=" * 60)
        print("Publishing to MQTT broker...")
        print("=" * 60)
        
        result = client.publish(MQTT_TOPIC, json_payload, qos=0)
        
        # Wait for publish to complete
        result.wait_for_publish()
        
        if result.rc == mqtt.MQTT_ERR_SUCCESS:
            print(f"✓ Successfully published to topic: {MQTT_TOPIC}")
            print(f"  Message ID: {result.mid}")
            print(f"  Payload size: {len(json_payload)} bytes")
        else:
            print(f"✗ Publish failed with error code: {result.rc}")
        
        # Wait a bit to ensure message is sent
        time.sleep(1)
        
        # Publish a few more test messages
        print("\n" + "=" * 60)
        print("Publishing additional test messages...")
        print("=" * 60)
        
        for i in range(3):
            test_data = create_test_sensor_data()
            json_payload = json.dumps(test_data)
            
            print(f"\nMessage {i+1}:")
            print(f"  CO2: {test_data['co2']} ppm")
            print(f"  Temperature: {test_data['temperature']}°C")
            print(f"  Humidity: {test_data['humidity']}%")
            
            result = client.publish(MQTT_TOPIC, json_payload, qos=0)
            result.wait_for_publish()
            
            if result.rc == mqtt.MQTT_ERR_SUCCESS:
                print(f"  ✓ Published successfully")
            else:
                print(f"  ✗ Publish failed")
            
            time.sleep(1)
        
        print("\n" + "=" * 60)
        print("Test completed!")
        print("=" * 60)
        print("\nNext steps:")
        print("1. Check HiveMQ web console to verify messages were received")
        print("2. Run test_mqtt_subscriber.py to verify message reception")
        print("3. If successful, upload firmware to ESP8266 hardware")
        
    except Exception as e:
        print(f"✗ Error: {e}")
        import traceback
        traceback.print_exc()
    
    finally:
        # Disconnect
        client.loop_stop()
        client.disconnect()
        print("\n✓ Disconnected from MQTT broker")

if __name__ == "__main__":
    main()








