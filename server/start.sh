#!/bin/bash
# Start script that runs both MQTT subscriber and web server in the same process
# This avoids needing a separate $7/month background worker on Render

set -e  # Exit on error

# We're already in the server directory when this runs
# Start MQTT subscriber in the background
echo "Starting MQTT subscriber..."
python manage.py mqtt_subscriber > /tmp/mqtt_subscriber.log 2>&1 &
MQTT_PID=$!

# Wait a moment for MQTT to initialize
sleep 3

# Check if MQTT subscriber is still running
if ! kill -0 $MQTT_PID 2>/dev/null; then
    echo "ERROR: MQTT subscriber failed to start. Check logs:"
    cat /tmp/mqtt_subscriber.log
    exit 1
fi

echo "MQTT subscriber started (PID: $MQTT_PID)"
echo "Starting Gunicorn web server..."

# Start Gunicorn web server (foreground - this keeps the container alive)
# If gunicorn exits, the script will exit and Render will restart the service
gunicorn cognitiv.wsgi:application --bind 0.0.0.0:$PORT

# Cleanup: If gunicorn exits, kill the MQTT subscriber
echo "Gunicorn stopped. Stopping MQTT subscriber..."
kill $MQTT_PID 2>/dev/null || true
wait $MQTT_PID 2>/dev/null || true

