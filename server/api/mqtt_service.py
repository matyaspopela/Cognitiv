"""
MQTT Subscriber Service - runs as background thread when Django starts
"""

import os
import threading
import paho.mqtt.client as mqtt
from django.test import RequestFactory
from django.http import JsonResponse
import json
import sys

# MQTT Configuration - All values MUST be set via environment variables
MQTT_BROKER_HOST = os.getenv('MQTT_BROKER_HOST')
MQTT_BROKER_PORT = int(os.getenv('MQTT_BROKER_PORT', '8883'))
MQTT_USERNAME = os.getenv('MQTT_USERNAME')
MQTT_PASSWORD = os.getenv('MQTT_PASSWORD')
MQTT_TOPIC = os.getenv('MQTT_TOPIC')

# Validate required environment variables
_REQUIRED_MQTT_VARS = ['MQTT_BROKER_HOST', 'MQTT_USERNAME', 'MQTT_PASSWORD', 'MQTT_TOPIC']
_MISSING_VARS = [var for var in _REQUIRED_MQTT_VARS if not os.getenv(var)]
if _MISSING_VARS:
    print(f"[WARN] MQTT environment variables not set: {', '.join(_MISSING_VARS)}")
    print("       MQTT subscriber will not be available until these are configured.")

# Global state
_mqtt_thread = None
_mqtt_client = None
_message_count = 0
_factory = RequestFactory()

def on_connect(client, userdata, flags, rc):
    """Called when the broker responds to our connection request"""
    if rc == 0:
        print(f'[OK] MQTT Connected to {MQTT_BROKER_HOST}:{MQTT_BROKER_PORT}')
        print(f'  Subscribing to topic: {MQTT_TOPIC}')
        client.subscribe(MQTT_TOPIC)
    else:
        error_messages = {
            1: 'Incorrect protocol version',
            2: 'Invalid client identifier',
            3: 'Server unavailable',
            4: 'Bad username or password',
            5: 'Not authorized'
        }
        error_msg = error_messages.get(rc, f'Unknown error (code {rc})')
        print(f'[ERROR] MQTT Connection failed: {error_msg} (code {rc})')

def on_message(client, userdata, msg):
    """Called when a message is received from the broker"""
    global _message_count
    try:
        # Import here to avoid circular imports
        from api.views import receive_data
        
        # Parse JSON payload
        payload = json.loads(msg.payload.decode('utf-8'))
        
        _message_count += 1
        print(f'\n[MQTT] Message #{_message_count} received')
        print(f'  Device: {payload.get("mac_address", "unknown")}')
        
        # Create a mock HTTP request to reuse existing receive_data() logic
        request = _factory.post(
            '/api/data',
            data=json.dumps(payload),
            content_type='application/json'
        )
        
        # Process the data using existing view function
        response = receive_data(request)
        
        # Check response status
        if response.status_code == 200:
            response_data = json.loads(response.content.decode('utf-8'))
            print(f'  [OK] Data stored: {response_data.get("message", "")}')
        else:
            response_data = json.loads(response.content.decode('utf-8'))
            print(f'  [ERROR] {response_data.get("error", "Unknown error")}')
            
    except json.JSONDecodeError as e:
        print(f'[ERROR] Error parsing JSON: {e}')
    except Exception as e:
        print(f'[ERROR] Error processing message: {e}')
        import traceback
        traceback.print_exc()

def on_subscribe(client, userdata, mid, granted_qos):
    """Called when the broker responds to a subscribe request"""
    print(f'[OK] Subscribed to {MQTT_TOPIC} (QoS: {granted_qos})')
    print('  Waiting for messages...\n')

def on_disconnect(client, userdata, rc):
    """Called when the client disconnects from the broker"""
    if rc != 0:
        print(f'[WARN] Unexpected MQTT disconnection (rc={rc})')
    else:
        print('[OK] Disconnected from MQTT broker')

def mqtt_worker():
    """Background thread function that runs MQTT subscriber"""
    global _mqtt_client
    
    print('=' * 60)
    print('MQTT Subscriber Service (Background Thread)')
    print('=' * 60)
    print(f'Broker: {MQTT_BROKER_HOST}:{MQTT_BROKER_PORT}')
    print(f'Topic: {MQTT_TOPIC}')
    print(f'Username: {MQTT_USERNAME}')
    print('')
    
    # Create MQTT client
    client_id = f'django_subscriber_{os.getpid()}_{threading.get_ident()}'
    _mqtt_client = mqtt.Client(client_id=client_id, protocol=mqtt.MQTTv311)
    
    # Set callbacks
    _mqtt_client.on_connect = on_connect
    _mqtt_client.on_message = on_message
    _mqtt_client.on_subscribe = on_subscribe
    _mqtt_client.on_disconnect = on_disconnect
    
    # Set credentials
    _mqtt_client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD)
    
    # Enable TLS
    _mqtt_client.tls_set()
    
    try:
        # Connect and start loop
        _mqtt_client.connect(MQTT_BROKER_HOST, MQTT_BROKER_PORT, 60)
        _mqtt_client.loop_forever()  # Blocking call - runs until interrupted
    except Exception as e:
        print(f'[ERROR] MQTT Error: {e}')
        import traceback
        traceback.print_exc()

def start_mqtt_subscriber():
    """Start MQTT subscriber in background thread"""
    global _mqtt_thread
    
    # Check if all required variables are set before starting
    if _MISSING_VARS:
        print(f'[SKIP] MQTT subscriber not started: missing variables {", ".join(_MISSING_VARS)}')
        print('       Set these environment variables to enable MQTT subscriber.')
        return
    
    # Only start if not already running
    if _mqtt_thread is not None and _mqtt_thread.is_alive():
        print('MQTT subscriber already running')
        return
    
    # Check if MQTT password is configured (must be set explicitly in production)
    # In development, the default is fine, but in production we want it set explicitly
    if os.getenv('MQTT_PASSWORD') is None and os.getenv('RENDER') is not None:
        print('[WARN] MQTT_PASSWORD not set in environment. MQTT subscriber will not start.')
        print('       Set MQTT_PASSWORD in Render dashboard to enable MQTT subscriber.')
        return
    
    print('Starting MQTT subscriber in background thread...')
    _mqtt_thread = threading.Thread(target=mqtt_worker, daemon=True)
    _mqtt_thread.start()
    print('[OK] MQTT subscriber thread started')

def stop_mqtt_subscriber():
    """Stop MQTT subscriber"""
    global _mqtt_client, _mqtt_thread
    
    if _mqtt_client:
        print('Stopping MQTT subscriber...')
        _mqtt_client.disconnect()
        _mqtt_client = None
    
    if _mqtt_thread:
        _mqtt_thread.join(timeout=5)
        _mqtt_thread = None

