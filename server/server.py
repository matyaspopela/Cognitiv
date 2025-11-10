"""
IoT Environmental Monitoring System - Flask Server
Receives data from ESP32, stores in MongoDB, and serves dashboard
"""

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import os
from datetime import datetime, timedelta
import json
from pymongo import MongoClient, ASCENDING
from pymongo.errors import PyMongoError

from board_manager import (
    apply_wifi_credentials,
    run_platformio_upload,
    summarize_logs,
    ConfigWriteError,
)
from board_manager import BoardManagerError, upload_firmware

app = Flask(__name__, static_folder='static')
CORS(app)  # Enable CORS for frontend access

# Configuration
MONGO_URI = os.getenv(
    'MONGO_URI',
    'mongodb+srv://matyaspopela:w8TuhFkstboeuem2@kognitiv.ihdrkc7.mongodb.net/'
)
MONGO_DB_NAME = os.getenv('MONGO_DB_NAME', 'cognitiv')
MONGO_COLLECTION_NAME = os.getenv('MONGO_COLLECTION', 'sensor_data')


def init_mongo_client():
    try:
        client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
        # Trigger server selection to fail fast if misconfigured
        client.admin.command('ping')
        db = client[MONGO_DB_NAME]
        collection = db[MONGO_COLLECTION_NAME]
        collection.create_index([('device_id', ASCENDING), ('timestamp', ASCENDING)])
        print(f"Connected to MongoDB cluster. Database: {MONGO_DB_NAME}, Collection: {MONGO_COLLECTION_NAME}")
        return collection
    except Exception as err:
        print(f"✗ Failed to initialize MongoDB client: {err}")
        raise


mongo_collection = init_mongo_client()

def normalize_sensor_data(data):
    """Map incoming payload to canonical temperature/humidity keys."""
    normalized = {}
    try:
        normalized['timestamp'] = data['timestamp']
        normalized['device_id'] = data['device_id']
    except KeyError as exc:
        raise KeyError(f"Missing required field: {exc.args[0]}")

    def first_present(keys):
        for key in keys:
            if key in data and data[key] is not None:
                return data[key]
        return None

    temperature = first_present(['temperature', 'temp_scd41', 'temp_sht40'])
    humidity = first_present(['humidity', 'humidity_scd41', 'humidity_sht40'])

    if temperature is None:
        raise KeyError("temperature")
    if humidity is None:
        raise KeyError("humidity")

    normalized['temperature'] = temperature
    normalized['humidity'] = humidity

    if 'co2' not in data:
        raise KeyError("co2")
    normalized['co2'] = data['co2']

    return normalized


def validate_sensor_data(data):
    """Validate incoming sensor data"""
    required_fields = ['timestamp', 'device_id', 'temperature', 'humidity', 'co2']
    
    # Check required fields
    for field in required_fields:
        if field not in data:
            return False, f"Missing required field: {field}"
    
    # Validate data ranges
    try:
        temperature = float(data['temperature'])
        humidity = float(data['humidity'])
        co2 = int(data['co2'])
        
        # Temperature range: -10°C to 50°C
        if not (-10 <= temperature <= 50):
            return False, "Temperature out of valid range (-10 to 50°C)"
        
        # Humidity range: 0% to 100%
        if not (0 <= humidity <= 100):
            return False, "Humidity out of valid range (0 to 100%)"
        
        # CO2 range: 400 to 5000 ppm (normal indoor range)
        if not (400 <= co2 <= 5000):
            return False, "CO2 out of valid range (400 to 5000 ppm)"
        
        return True, "Valid"
    
    except (ValueError, TypeError) as e:
        return False, f"Invalid data type: {str(e)}"

def format_timestamp(unix_timestamp):
    """Convert Unix timestamp to readable format"""
    try:
        dt = datetime.fromtimestamp(float(unix_timestamp))
        return dt.strftime('%Y-%m-%d %H:%M:%S')
    except:
        return datetime.now().strftime('%Y-%m-%d %H:%M:%S')

@app.route('/')
def home():
    """Serve the landing page"""
    return send_from_directory('static', 'index.html')


@app.route('/dashboard')
def dashboard():
    """Serve the interactive dashboard"""
    return send_from_directory('static', 'dashboard.html')


@app.route('/connect')
def connect():
    """Serve the board connection page"""
    return send_from_directory('static', 'connect.html')


@app.route('/connect/upload', methods=['POST'])
def connect_upload():
    """Apply WiFi credentials and upload firmware to the connected board"""
    payload = request.get_json(silent=True) or {}

    ssid = (payload.get('ssid') or '').strip()
    password = payload.get('password', '')

    if not ssid:
        return jsonify({
            'status': 'error',
            'message': 'SSID is required to upload firmware.'
        }), 400

    if password is None:
        password = ''

    if not isinstance(password, str):
        return jsonify({
            'status': 'error',
            'message': 'Password must be a string value.'
        }), 400

    try:
        apply_wifi_credentials(ssid, password)
    except ConfigWriteError as exc:
        print(f"✗ Failed to update config.h: {exc}")
        return jsonify({
            'status': 'error',
            'message': 'Unable to update configuration file. Check server permissions.'
        }), 500

    try:
        return_code, stdout, stderr = run_platformio_upload()
    except FileNotFoundError:
        return jsonify({
            'status': 'error',
            'message': 'PlatformIO is not installed on the server. Install it to enable uploads.'
        }), 500
    except OSError as exc:
        return jsonify({
            'status': 'error',
            'message': f'Failed to launch PlatformIO: {exc}'
        }), 500

    log_excerpt = summarize_logs(stdout, stderr)

    if return_code != 0:
        print(f"✗ PlatformIO upload failed for SSID '{ssid}'.")
        return jsonify({
            'status': 'error',
            'message': 'PlatformIO upload failed. Review the log excerpt for details.',
            'log_excerpt': log_excerpt
        }), 500

    print(f"✓ PlatformIO upload succeeded for SSID '{ssid}'.")
    return jsonify({
        'status': 'success',
        'message': 'Firmware uploaded to board successfully.',
        'log_excerpt': log_excerpt
    }), 200

@app.route('/data', methods=['POST'])
def receive_data():
    """Receive sensor data from ESP32"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data received'}), 400
        
        print(f"\n{'='*50}")
        print(f"Received data from {data.get('device_id', 'unknown')}")
        print(f"{'='*50}")
        print(json.dumps(data, indent=2))
        
        # Normalize payload to canonical keys
        try:
            normalized = normalize_sensor_data(data)
        except KeyError as exc:
            message = f"Missing required field: {exc.args[0]}"
            print(f"⚠️  Validation error: {message}")
            return jsonify({'error': message}), 400

        # Validate data
        is_valid, message = validate_sensor_data(normalized)
        if not is_valid:
            print(f"⚠️  Validation error: {message}")
            return jsonify({'error': message}), 400
        
        # Format timestamp
        timestamp_str = format_timestamp(normalized['timestamp'])

        temperature = float(normalized['temperature'])
        humidity = float(normalized['humidity'])
        co2 = int(normalized['co2'])

        document = {
            'timestamp': datetime.fromtimestamp(float(normalized['timestamp'])),
            'timestamp_str': timestamp_str,
            'device_id': normalized['device_id'],
            'temperature': temperature,
            'humidity': humidity,
            'co2': co2,
            'raw_payload': data
        }

        try:
            mongo_collection.insert_one(document)
            print(f"✓ Data saved to MongoDB at {timestamp_str}")
        except PyMongoError as exc:
            print(f"✗ MongoDB insert error: {exc}")
            return jsonify({'error': 'Failed to store data'}), 500
        
        return jsonify({
            'status': 'success',
            'message': 'Data received and stored',
            'timestamp': timestamp_str
        }), 200
    
    except Exception as e:
        print(f"✗ Error: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/data', methods=['GET'])
def get_data():
    """Get sensor data for dashboard (with optional filtering)"""
    try:
        # Get query parameters
        hours = request.args.get('hours', type=int, default=24)
        limit = request.args.get('limit', type=int, default=1000)
        device_id = request.args.get('device_id', type=str, default=None)

        # Calculate cutoff time
        cutoff_time = datetime.now() - timedelta(hours=hours)

        mongo_filter = {'timestamp': {'$gte': cutoff_time}}
        if device_id:
            mongo_filter['device_id'] = device_id

        cursor = mongo_collection.find(mongo_filter).sort('timestamp', -1)
        if limit:
            cursor = cursor.limit(limit)

        documents = list(cursor)
        documents.reverse()  # Restore chronological order

        data_points = []
        for doc in documents:
            temperature = float(doc.get('temperature', 0))
            humidity = float(doc.get('humidity', 0))
            co2 = int(doc.get('co2', 0))
            timestamp_str = doc.get('timestamp_str')
            if not timestamp_str and 'timestamp' in doc:
                timestamp_str = doc['timestamp'].strftime('%Y-%m-%d %H:%M:%S')

            data_points.append({
                'timestamp': timestamp_str,
                'device_id': doc.get('device_id'),
                'temperature': temperature,
                'humidity': humidity,
                'co2': co2,
                'temp_avg': temperature,
                'humidity_avg': humidity
            })

        return jsonify({
            'status': 'success',
            'count': len(data_points),
            'data': data_points
        }), 200
    
    except PyMongoError as exc:
        return jsonify({'error': f'Database error: {exc}'}), 500
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/stats', methods=['GET'])
def get_stats():
    """Get statistical summary of data"""
    try:
        hours = request.args.get('hours', type=int, default=24)
        cutoff_time = datetime.now() - timedelta(hours=hours)

        mongo_filter = {'timestamp': {'$gte': cutoff_time}}

        pipeline = [
            {'$match': mongo_filter},
            {
                '$group': {
                    '_id': None,
                    'temp_min': {'$min': '$temperature'},
                    'temp_max': {'$max': '$temperature'},
                    'temp_avg': {'$avg': '$temperature'},
                    'humidity_min': {'$min': '$humidity'},
                    'humidity_max': {'$max': '$humidity'},
                    'humidity_avg': {'$avg': '$humidity'},
                    'co2_min': {'$min': '$co2'},
                    'co2_max': {'$max': '$co2'},
                    'co2_avg': {'$avg': '$co2'},
                    'count': {'$sum': 1},
                    'co2_good': {'$sum': {'$cond': [{'$lt': ['$co2', 800]}, 1, 0]}},
                    'co2_moderate': {'$sum': {'$cond': [
                        {'$and': [{'$gte': ['$co2', 800]}, {'$lt': ['$co2', 1000]}]}, 1, 0
                    ]}},
                    'co2_poor': {'$sum': {'$cond': [{'$gte': ['$co2', 1000]}, 1, 0]}},
                }
            }
        ]

        agg_result = list(mongo_collection.aggregate(pipeline))
        if not agg_result:
            return jsonify({
                'status': 'success',
                'message': 'No data available',
                'stats': {}
            }), 200
        
        stats_doc = agg_result[0]

        # Fetch most recent document for "current" values
        latest_doc = mongo_collection.find(mongo_filter).sort('timestamp', -1).limit(1)
        latest_doc = next(latest_doc, None)

        current_temperature = None
        current_humidity = None
        current_co2 = None

        if latest_doc:
            current_temperature = round(float(latest_doc.get('temperature', 0)), 1)
            current_humidity = round(float(latest_doc.get('humidity', 0)), 1)
            current_co2 = int(latest_doc.get('co2', 0))

        count = stats_doc.get('count', 0)
        co2_good = stats_doc.get('co2_good', 0)
        co2_moderate = stats_doc.get('co2_moderate', 0)
        co2_poor = stats_doc.get('co2_poor', 0)

        stats = {
            'temperature': {
                'min': round(stats_doc.get('temp_min', 0), 1),
                'max': round(stats_doc.get('temp_max', 0), 1),
                'avg': round(stats_doc.get('temp_avg', 0), 1),
                'current': current_temperature
            },
            'humidity': {
                'min': round(stats_doc.get('humidity_min', 0), 1),
                'max': round(stats_doc.get('humidity_max', 0), 1),
                'avg': round(stats_doc.get('humidity_avg', 0), 1),
                'current': current_humidity
            },
            'co2': {
                'min': int(stats_doc.get('co2_min', 0)),
                'max': int(stats_doc.get('co2_max', 0)),
                'avg': round(stats_doc.get('co2_avg', 0)),
                'current': current_co2
            },
            'data_points': count,
            'time_range_hours': hours
        }
        
        if count > 0:
            stats['co2_quality'] = {
                'good': co2_good,
                'moderate': co2_moderate,
                'poor': co2_poor,
                'good_percent': round(co2_good / count * 100, 1) if count else 0,
                'moderate_percent': round(co2_moderate / count * 100, 1) if count else 0,
                'poor_percent': round(co2_poor / count * 100, 1) if count else 0
            }
        
        if count == 0:
            stats['co2_quality'] = {
                'good': 0,
                'moderate': 0,
                'poor': 0,
                'good_percent': 0,
                'moderate_percent': 0,
                'poor_percent': 0
            }
        
        return jsonify({
            'status': 'success',
            'stats': stats
        }), 200
    
    except PyMongoError as exc:
        return jsonify({'error': f'Database error: {exc}'}), 500
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/status')
def status():
    """Get server status"""
    try:
        total_documents = mongo_collection.count_documents({})
        latest_doc = mongo_collection.find().sort('timestamp', -1).limit(1)
        latest_doc = next(latest_doc, None)

        latest_timestamp = None
        if latest_doc:
            latest_timestamp = latest_doc.get('timestamp_str')
            if not latest_timestamp and latest_doc.get('timestamp'):
                latest_timestamp = latest_doc['timestamp'].strftime('%Y-%m-%d %H:%M:%S')

        return jsonify({
            'status': 'online',
            'database': MONGO_DB_NAME,
            'collection': MONGO_COLLECTION_NAME,
            'data_points': total_documents,
            'latest_entry': latest_timestamp,
            'server_time': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        }), 200

    except PyMongoError as exc:
        return jsonify({'error': f'Database error: {exc}'}), 500
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    print("\n" + "="*60)
    print("IoT Environmental Monitoring Server")
    print("="*60)
    print(f"MongoDB Connection: {MONGO_URI}")
    print(f"Database: {MONGO_DB_NAME}, Collection: {MONGO_COLLECTION_NAME}")
    print(f"Server URL: http://0.0.0.0:5000")
    print(f"Homepage: http://localhost:5000")
    print(f"Dashboard: http://localhost:5000/dashboard")
    print("\nTo access from ESP32, use your PC's IP address:")
    print("Windows: Run 'ipconfig' to find IPv4 Address")
    print("Mac/Linux: Run 'ifconfig' to find inet address")
    print("="*60 + "\n")
    
    # Run server
    app.run(host='0.0.0.0', port=5000, debug=True)
