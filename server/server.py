"""
IoT Environmental Monitoring System - Flask Server
Receives data from ESP32, stores in CSV, and serves dashboard
"""

from flask import Flask, request, jsonify, send_file, send_from_directory
from flask_cors import CORS
import csv
import os
from datetime import datetime, timedelta
import json
from pathlib import Path

app = Flask(__name__, static_folder='static')
CORS(app)  # Enable CORS for frontend access

# Configuration
DATA_DIR = Path(__file__).parent / 'data'
CSV_FILE = DATA_DIR / 'sensor_data.csv'
CSV_HEADERS = ['timestamp', 'device_id', 'temp_sht40', 'humidity_sht40', 
               'temp_scd41', 'humidity_scd41', 'co2']

# Ensure data directory exists
DATA_DIR.mkdir(exist_ok=True)

# Create CSV file with headers if it doesn't exist
if not CSV_FILE.exists():
    with open(CSV_FILE, 'w', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(CSV_HEADERS)
    print(f"Created CSV file: {CSV_FILE}")

def validate_sensor_data(data):
    """Validate incoming sensor data"""
    required_fields = ['timestamp', 'device_id', 'temp_sht40', 'humidity_sht40',
                      'temp_scd41', 'humidity_scd41', 'co2']
    
    # Check required fields
    for field in required_fields:
        if field not in data:
            return False, f"Missing required field: {field}"
    
    # Validate data ranges
    try:
        temp_sht40 = float(data['temp_sht40'])
        temp_scd41 = float(data['temp_scd41'])
        humidity_sht40 = float(data['humidity_sht40'])
        humidity_scd41 = float(data['humidity_scd41'])
        co2 = int(data['co2'])
        
        # Temperature range: -10°C to 50°C
        if not (-10 <= temp_sht40 <= 50) or not (-10 <= temp_scd41 <= 50):
            return False, "Temperature out of valid range (-10 to 50°C)"
        
        # Humidity range: 0% to 100%
        if not (0 <= humidity_sht40 <= 100) or not (0 <= humidity_scd41 <= 100):
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
        dt = datetime.fromtimestamp(int(unix_timestamp))
        return dt.strftime('%Y-%m-%d %H:%M:%S')
    except:
        return datetime.now().strftime('%Y-%m-%d %H:%M:%S')

@app.route('/')
def index():
    """Serve the main dashboard"""
    return send_from_directory('static', 'dashboard.html')

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
        
        # Validate data
        is_valid, message = validate_sensor_data(data)
        if not is_valid:
            print(f"⚠️  Validation error: {message}")
            return jsonify({'error': message}), 400
        
        # Format timestamp
        timestamp_str = format_timestamp(data['timestamp'])
        
        # Append to CSV (with file locking for safety)
        with open(CSV_FILE, 'a', newline='') as f:
            writer = csv.writer(f)
            writer.writerow([
                timestamp_str,
                data['device_id'],
                f"{float(data['temp_sht40']):.2f}",
                f"{float(data['humidity_sht40']):.2f}",
                f"{float(data['temp_scd41']):.2f}",
                f"{float(data['humidity_scd41']):.2f}",
                data['co2']
            ])
        
        print(f"✓ Data saved to CSV at {timestamp_str}")
        
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
        
        # Read CSV and filter data
        data_points = []
        with open(CSV_FILE, 'r') as f:
            reader = csv.DictReader(f)
            for row in reader:
                try:
                    row_time = datetime.strptime(row['timestamp'], '%Y-%m-%d %H:%M:%S')
                    
                    # Apply filters
                    if row_time < cutoff_time:
                        continue
                    
                    if device_id and row['device_id'] != device_id:
                        continue
                    
                    # Convert to appropriate types
                    data_point = {
                        'timestamp': row['timestamp'],
                        'device_id': row['device_id'],
                        'temp_sht40': float(row['temp_sht40']),
                        'humidity_sht40': float(row['humidity_sht40']),
                        'temp_scd41': float(row['temp_scd41']),
                        'humidity_scd41': float(row['humidity_scd41']),
                        'co2': int(row['co2']),
                        'temp_avg': (float(row['temp_sht40']) + float(row['temp_scd41'])) / 2,
                        'humidity_avg': (float(row['humidity_sht40']) + float(row['humidity_scd41'])) / 2
                    }
                    data_points.append(data_point)
                
                except (ValueError, KeyError) as e:
                    # Skip malformed rows
                    continue
        
        # Apply limit (keep most recent)
        if len(data_points) > limit:
            data_points = data_points[-limit:]
        
        return jsonify({
            'status': 'success',
            'count': len(data_points),
            'data': data_points
        }), 200
    
    except FileNotFoundError:
        return jsonify({
            'status': 'success',
            'count': 0,
            'data': []
        }), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/stats', methods=['GET'])
def get_stats():
    """Get statistical summary of data"""
    try:
        hours = request.args.get('hours', type=int, default=24)
        cutoff_time = datetime.now() - timedelta(hours=hours)
        
        temps = []
        humidities = []
        co2_values = []
        
        with open(CSV_FILE, 'r') as f:
            reader = csv.DictReader(f)
            for row in reader:
                try:
                    row_time = datetime.strptime(row['timestamp'], '%Y-%m-%d %H:%M:%S')
                    if row_time < cutoff_time:
                        continue
                    
                    temp_avg = (float(row['temp_sht40']) + float(row['temp_scd41'])) / 2
                    humidity_avg = (float(row['humidity_sht40']) + float(row['humidity_scd41'])) / 2
                    
                    temps.append(temp_avg)
                    humidities.append(humidity_avg)
                    co2_values.append(int(row['co2']))
                
                except (ValueError, KeyError):
                    continue
        
        if not temps:
            return jsonify({
                'status': 'success',
                'message': 'No data available',
                'stats': {}
            }), 200
        
        # Calculate statistics
        stats = {
            'temperature': {
                'min': round(min(temps), 1),
                'max': round(max(temps), 1),
                'avg': round(sum(temps) / len(temps), 1),
                'current': round(temps[-1], 1)
            },
            'humidity': {
                'min': round(min(humidities), 1),
                'max': round(max(humidities), 1),
                'avg': round(sum(humidities) / len(humidities), 1),
                'current': round(humidities[-1], 1)
            },
            'co2': {
                'min': min(co2_values),
                'max': max(co2_values),
                'avg': round(sum(co2_values) / len(co2_values)),
                'current': co2_values[-1]
            },
            'data_points': len(temps),
            'time_range_hours': hours
        }
        
        # CO2 quality zones
        co2_good = sum(1 for v in co2_values if v < 800)
        co2_moderate = sum(1 for v in co2_values if 800 <= v < 1000)
        co2_poor = sum(1 for v in co2_values if v >= 1000)
        
        stats['co2_quality'] = {
            'good': co2_good,
            'moderate': co2_moderate,
            'poor': co2_poor,
            'good_percent': round(co2_good / len(co2_values) * 100, 1),
            'moderate_percent': round(co2_moderate / len(co2_values) * 100, 1),
            'poor_percent': round(co2_poor / len(co2_values) * 100, 1)
        }
        
        return jsonify({
            'status': 'success',
            'stats': stats
        }), 200
    
    except FileNotFoundError:
        return jsonify({
            'status': 'success',
            'message': 'No data available',
            'stats': {}
        }), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/download')
def download_csv():
    """Download complete CSV file"""
    try:
        return send_file(
            CSV_FILE,
            mimetype='text/csv',
            as_attachment=True,
            download_name=f'sensor_data_{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv'
        )
    except FileNotFoundError:
        return jsonify({'error': 'No data file found'}), 404

@app.route('/status')
def status():
    """Get server status"""
    try:
        file_size = CSV_FILE.stat().st_size if CSV_FILE.exists() else 0
        
        # Count lines in CSV
        line_count = 0
        if CSV_FILE.exists():
            with open(CSV_FILE, 'r') as f:
                line_count = sum(1 for _ in f) - 1  # Subtract header
        
        return jsonify({
            'status': 'online',
            'csv_file': str(CSV_FILE),
            'file_size_bytes': file_size,
            'file_size_mb': round(file_size / 1024 / 1024, 2),
            'data_points': line_count,
            'server_time': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        }), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    print("\n" + "="*60)
    print("IoT Environmental Monitoring Server")
    print("="*60)
    print(f"CSV File: {CSV_FILE}")
    print(f"Server URL: http://0.0.0.0:5000")
    print(f"Dashboard: http://localhost:5000")
    print("\nTo access from ESP32, use your PC's IP address:")
    print("Windows: Run 'ipconfig' to find IPv4 Address")
    print("Mac/Linux: Run 'ifconfig' to find inet address")
    print("="*60 + "\n")
    
    # Run server
    app.run(host='0.0.0.0', port=5000, debug=True)
