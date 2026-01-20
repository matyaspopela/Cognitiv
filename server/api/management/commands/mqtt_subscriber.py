"""
Django management command to subscribe to MQTT broker and process sensor data

Usage:
    python manage.py mqtt_subscriber

This command runs continuously, subscribing to the MQTT topic and processing
incoming sensor data messages. It uses the same validation and storage logic
as the HTTP endpoint.
"""

import json
import os
import sys
from django.core.management.base import BaseCommand
from django.http import JsonResponse
from django.test import RequestFactory
import paho.mqtt.client as mqtt
from api.views import receive_data

# MQTT Configuration - all values from environment variables (no hardcoded fallbacks)
# Note: Server uses different credentials than ESP8266 publisher
MQTT_BROKER_HOST = os.getenv('MQTT_BROKER_HOST')
MQTT_BROKER_PORT = int(os.getenv('MQTT_BROKER_PORT', '8883'))
MQTT_USERNAME = os.getenv('MQTT_USERNAME')
MQTT_PASSWORD = os.getenv('MQTT_PASSWORD')
MQTT_TOPIC = os.getenv('MQTT_TOPIC')

# Validate required environment variables
_REQUIRED_MQTT_VARS = ['MQTT_BROKER_HOST', 'MQTT_USERNAME', 'MQTT_PASSWORD', 'MQTT_TOPIC']
_missing_vars = [var for var in _REQUIRED_MQTT_VARS if not os.getenv(var)]
if _missing_vars:
    import warnings
    warnings.warn(f"Missing MQTT environment variables: {', '.join(_missing_vars)}. MQTT subscriber may fail.")


class Command(BaseCommand):
    help = 'Subscribe to MQTT broker and process sensor data messages'

    def __init__(self):
        super().__init__()
        self.client = None
        self.factory = RequestFactory()
        self.message_count = 0

    def on_connect(self, client, userdata, flags, rc):
        """Called when the broker responds to our connection request"""
        if rc == 0:
            self.stdout.write(
                self.style.SUCCESS(f'✓ MQTT Connected to {MQTT_BROKER_HOST}:{MQTT_BROKER_PORT}')
            )
            self.stdout.write(f'  Subscribing to topic: {MQTT_TOPIC}')
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
            self.stdout.write(
                self.style.ERROR(f'✗ MQTT Connection failed: {error_msg} (code {rc})')
            )
            sys.exit(1)

    def on_message(self, client, userdata, msg):
        """Called when a message is received from the broker"""
        try:
            # Parse JSON payload
            payload = json.loads(msg.payload.decode('utf-8'))
            
            self.message_count += 1
            self.stdout.write(
                self.style.SUCCESS(f'\n📨 Message #{self.message_count} received')
            )
            self.stdout.write(f'  Topic: {msg.topic}')
            self.stdout.write(f'  Device: {payload.get("device_id", "unknown")}')
            
            # Create a mock HTTP request to reuse existing receive_data() logic
            # This allows us to use the same validation, normalization, and storage code
            request = self.factory.post(
                '/api/data',
                data=json.dumps(payload),
                content_type='application/json'
            )
            
            # Process the data using existing view function
            response = receive_data(request)
            
            # Check response status
            if response.status_code == 200:
                response_data = json.loads(response.content.decode('utf-8'))
                self.stdout.write(
                    self.style.SUCCESS(f'  ✓ Data stored successfully: {response_data.get("message", "")}')
                )
            else:
                response_data = json.loads(response.content.decode('utf-8'))
                self.stdout.write(
                    self.style.ERROR(f'  ✗ Error: {response_data.get("error", "Unknown error")}')
                )
                self.stdout.write(f'  Status code: {response.status_code}')
            
        except json.JSONDecodeError as e:
            self.stdout.write(
                self.style.ERROR(f'✗ Error parsing JSON: {e}')
            )
            self.stdout.write(f'  Raw message: {msg.payload.decode("utf-8", errors="ignore")[:200]}')
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f'✗ Error processing message: {e}')
            )
            import traceback
            self.stdout.write(traceback.format_exc())

    def on_subscribe(self, client, userdata, mid, granted_qos):
        """Called when the broker responds to a subscribe request"""
        self.stdout.write(
            self.style.SUCCESS(f'✓ Subscribed to {MQTT_TOPIC} (QoS: {granted_qos})')
        )
        self.stdout.write('  Waiting for messages...\n')

    def on_disconnect(self, client, userdata, rc):
        """Called when the client disconnects from the broker"""
        if rc != 0:
            self.stdout.write(
                self.style.WARNING(f'⚠️  Unexpected MQTT disconnection (rc={rc})')
            )
        else:
            self.stdout.write(
                self.style.SUCCESS('✓ Disconnected from MQTT broker')
            )

    def handle(self, *args, **options):
        """Main command handler"""
        self.stdout.write('=' * 60)
        self.stdout.write('MQTT Subscriber Service')
        self.stdout.write('=' * 60)
        self.stdout.write(f'Broker: {MQTT_BROKER_HOST}:{MQTT_BROKER_PORT}')
        self.stdout.write(f'Topic: {MQTT_TOPIC}')
        self.stdout.write(f'Username: {MQTT_USERNAME}')
        self.stdout.write('')
        self.stdout.write('Press Ctrl+C to stop\n')
        
        # Create MQTT client
        client_id = f'django_subscriber_{os.getpid()}'
        self.client = mqtt.Client(client_id=client_id, protocol=mqtt.MQTTv311)
        
        # Set callbacks
        self.client.on_connect = self.on_connect
        self.client.on_message = self.on_message
        self.client.on_subscribe = self.on_subscribe
        self.client.on_disconnect = self.on_disconnect
        
        # Set credentials
        self.client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD)
        
        # Enable TLS
        self.client.tls_set()
        
        try:
            # Connect and start loop
            self.client.connect(MQTT_BROKER_HOST, MQTT_BROKER_PORT, 60)
            self.client.loop_forever()  # Blocking call - runs until interrupted
        
        except KeyboardInterrupt:
            self.stdout.write('\n\nStopping MQTT subscriber...')
            self.client.disconnect()
            self.stdout.write(
                self.style.SUCCESS(f'✓ Subscriber stopped. Processed {self.message_count} messages.')
            )
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f'✗ Error: {e}')
            )
            import traceback
            self.stdout.write(traceback.format_exc())
            sys.exit(1)

