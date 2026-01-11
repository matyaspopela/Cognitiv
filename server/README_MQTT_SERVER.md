# MQTT Server Subscriber

The Django server includes an MQTT subscriber service that listens to the broker and processes incoming sensor data.

## Architecture

```
ESP8266 → MQTT Publish → HiveMQ Broker → Django Subscriber → MongoDB
```

- **ESP8266** publishes with credentials: `esp_12s_school_1` / `espASS12`
- **Django Server** subscribes with credentials: `Mongo_puller` / `espASS12`
- Both connect to the same broker and topic: `sensors/esp_12s_school_1/data`

## Setup

1. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

2. **Configure environment variables (optional):**
   ```bash
   export MQTT_BROKER_HOST="fc716f4d434d4d7689ca16c9be2ebf2b.s1.eu.hivemq.cloud"
   export MQTT_BROKER_PORT="8883"
   export MQTT_USERNAME="Mongo_puller"
   export MQTT_PASSWORD="espASS12"
   export MQTT_TOPIC="sensors/esp_12s_school_1/data"
   ```

   Defaults are already set in the command, so this is optional.

## Running the Subscriber

### Development (Manual)

Run the Django management command:

```bash
cd server
python manage.py mqtt_subscriber
```

The subscriber will:
- Connect to the MQTT broker
- Subscribe to the sensor data topic
- Process incoming messages using the same validation/storage logic as the HTTP endpoint
- Display status messages for each received message

Press `Ctrl+C` to stop.

### Production (Background Service)

Run as a background process or systemd service:

```bash
# Using nohup
nohup python manage.py mqtt_subscriber > mqtt_subscriber.log 2>&1 &

# Or using systemd (create /etc/systemd/system/mqtt-subscriber.service)
```

**Example systemd service file:**

```ini
[Unit]
Description=Django MQTT Subscriber
After=network.target

[Service]
Type=simple
User=your-user
WorkingDirectory=/path/to/server
ExecStart=/path/to/venv/bin/python manage.py mqtt_subscriber
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

## How It Works

1. **Connection**: Subscribes to MQTT broker using server credentials
2. **Message Reception**: Receives JSON payloads from ESP8266 devices
3. **Processing**: Reuses existing `receive_data()` view function for:
   - JSON parsing and validation
   - MAC address normalization
   - Data range validation
   - MongoDB storage
4. **Logging**: Displays status for each message processed

## Testing

1. **Test with Python publisher:**
   ```bash
   # Terminal 1: Run Django subscriber
   python manage.py mqtt_subscriber
   
   # Terminal 2: Run test publisher
   python test_mqtt_publisher.py
   ```

2. **Test with ESP8266:**
   - Upload firmware to ESP8266
   - Monitor serial output for MQTT connection status
   - Run Django subscriber to receive messages

## Troubleshooting

### Connection Failed

**Error:** `Bad username or password (code 4)`
- Verify credentials: `Mongo_puller` / `espASS12`
- Check environment variables if using custom config

**Error:** `Server unavailable (code 3)`
- Check broker address: `fc716f4d434d4d7689ca16c9be2ebf2b.s1.eu.hivemq.cloud`
- Verify network connectivity
- Check firewall/proxy settings

### No Messages Received

- Verify ESP8266 is publishing to the same topic
- Check ESP8266 MQTT connection status
- Verify topic name matches: `sensors/esp_12s_school_1/data`
- Check HiveMQ console to see if messages are being published

### Messages Received But Not Stored

- Check MongoDB connection
- Verify `MONGO_URI` environment variable
- Check Django logs for validation errors
- Ensure data format matches expected schema

## Integration with Django

The subscriber reuses the existing `receive_data()` view function, which means:
- ✅ Same validation rules
- ✅ Same data normalization
- ✅ Same MongoDB storage
- ✅ Same error handling
- ✅ Compatible with existing dashboard/API

No changes needed to existing Django views or models!






