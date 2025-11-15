"""
IoT Environmental Monitoring System - Django Views
Receives data from ESP32, stores in MongoDB, and serves dashboard
"""

import os
import json
from datetime import datetime, timedelta, timezone
from django.http import JsonResponse, HttpResponse, Http404
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.conf import settings
from pathlib import Path
from pymongo import MongoClient, ASCENDING
from pymongo.errors import PyMongoError
import certifi

try:
    from zoneinfo import ZoneInfo
except ImportError:  # Python < 3.9 fallback
    from backports.zoneinfo import ZoneInfo

from board_manager import (
    apply_wifi_credentials,
    run_platformio_upload,
    summarize_logs,
    ConfigWriteError,
)
from board_manager import BoardManagerError, upload_firmware

# Configuration
MONGO_URI = os.getenv('MONGO_URI')
MONGO_DB_NAME = os.getenv('MONGO_DB_NAME', 'cognitiv')
MONGO_COLLECTION_NAME = os.getenv('MONGO_COLLECTION', 'sensor_data')
LOCAL_TIMEZONE = os.getenv('LOCAL_TIMEZONE', 'Europe/Prague')

CO2_GOOD_MAX = 1000
CO2_MODERATE_MAX = 1500
CO2_HIGH_MAX = 2000


def resolve_local_timezone():
    try:
        return ZoneInfo(LOCAL_TIMEZONE)
    except Exception:
        fallback_tz = datetime.now().astimezone().tzinfo
        if fallback_tz is not None:
            print(
                f"⚠️  Nepodařilo se načíst časovou zónu '{LOCAL_TIMEZONE}'. "
                f"Používám systémovou časovou zónu {fallback_tz}."
            )
            return fallback_tz
        print(
            f"⚠️  Nepodařilo se načíst časovou zónu '{LOCAL_TIMEZONE}'. "
            "Používám UTC."
        )
        return ZoneInfo('UTC')


LOCAL_TZ = resolve_local_timezone()
UTC = timezone.utc


def init_mongo_client():
    if not MONGO_URI:
        raise RuntimeError(
            "Proměnná prostředí MONGO_URI musí být nastavena. "
            "Zadejte platný připojovací řetězec MongoDB (např. v administraci Renderu)."
        )
    try:
        client = MongoClient(
            MONGO_URI,
            serverSelectionTimeoutMS=5000,
            tlsCAFile=certifi.where(),
            tz_aware=True,
            tzinfo=UTC,
        )
        # Trigger server selection to fail fast if misconfigured
        client.admin.command('ping')
        db = client[MONGO_DB_NAME]
        collection = db[MONGO_COLLECTION_NAME]
        collection.create_index([('device_id', ASCENDING), ('timestamp', ASCENDING)])
        print(f"Připojeno k MongoDB. Databáze: {MONGO_DB_NAME}, kolekce: {MONGO_COLLECTION_NAME}")
        return collection
    except Exception as err:
        print(f"✗ Nepodařilo se inicializovat klienta MongoDB: {err}")
        raise


# Lazy MongoDB connection initialization
_mongo_collection = None

def get_mongo_collection():
    """Get MongoDB collection, initializing if necessary"""
    global _mongo_collection
    if _mongo_collection is None:
        _mongo_collection = init_mongo_client()
    return _mongo_collection


def to_local_datetime(value):
    if not value:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=UTC)
    return value.astimezone(LOCAL_TZ)


def normalize_sensor_data(data):
    """Mapování příchozího JSONu na standardizované klíče."""
    normalized = {}
    try:
        normalized['timestamp'] = data['timestamp']
        normalized['device_id'] = data['device_id']
    except KeyError as exc:
        raise KeyError(f"Chybí povinné pole: {exc.args[0]}")

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
    """Validace příchozích měření"""
    required_fields = ['timestamp', 'device_id', 'temperature', 'humidity', 'co2']
    
    # Check required fields
    for field in required_fields:
        if field not in data:
            return False, f"Chybí povinné pole: {field}"
    
    # Validate data ranges
    try:
        temperature = float(data['temperature'])
        humidity = float(data['humidity'])
        co2 = int(data['co2'])
        
        # Temperature range: -10°C to 50°C
        if not (-10 <= temperature <= 50):
            return False, "Teplota je mimo povolený rozsah (-10 až 50 °C)"
        
        # Humidity range: 0% to 100%
        if not (0 <= humidity <= 100):
            return False, "Vlhkost je mimo povolený rozsah (0 až 100 %)"
        
        # CO2 range: 400 to 5000 ppm (normal indoor range)
        if not (400 <= co2 <= 5000):
            return False, "CO₂ je mimo povolený rozsah (400 až 5000 ppm)"
        
        return True, "Valid"
    
    except (ValueError, TypeError) as e:
        return False, f"Neplatný datový typ: {str(e)}"


def format_timestamp(unix_timestamp):
    """Převod Unix časového razítka na čitelný formát"""
    try:
        ts = float(unix_timestamp)
        dt_utc = datetime.fromtimestamp(ts, tz=UTC)
        return to_local_datetime(dt_utc).strftime('%Y-%m-%d %H:%M:%S')
    except (TypeError, ValueError, OSError):
        return datetime.now(LOCAL_TZ).strftime('%Y-%m-%d %H:%M:%S')


def parse_iso_datetime(value, default=None):
    """Převede ISO8601 řetězec na datetime (bez časové zóny)."""
    if not value:
        return default
    try:
        sanitized = value.strip()
        if sanitized.endswith('Z'):
            sanitized = sanitized[:-1] + '+00:00'
        dt = datetime.fromisoformat(sanitized)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=LOCAL_TZ)
        return dt.astimezone(UTC)
    except ValueError:
        raise ValueError(
            f"Neplatný formát data: '{value}'. Použijte ISO 8601, např. 2024-01-31T12:00:00."
        )


def build_history_filter(start_dt, end_dt, device_id=None):
    """Sestaví dotaz pro historická data podle zadaného rozsahu."""
    query = {}
    if start_dt or end_dt:
        time_filter = {}
        if start_dt:
            time_filter['$gte'] = start_dt
        if end_dt:
            time_filter['$lte'] = end_dt
        query['timestamp'] = time_filter
    if device_id:
        query['device_id'] = device_id
    return query


def to_readable_timestamp(dt):
    if not dt:
        return None
    return to_local_datetime(dt).strftime('%Y-%m-%d %H:%M:%S')


def round_or_none(value, ndigits=2):
    if value is None:
        return None
    return round(value, ndigits)


# Static file serving views
def home(request):
    """Úvodní stránka"""
    static_dir = Path(settings.BASE_DIR) / 'static'
    html_file = static_dir / 'index.html'
    if html_file.exists():
        return HttpResponse(html_file.read_text(encoding='utf-8'), content_type='text/html')
    raise Http404("Page not found")


def dashboard(request):
    """Interaktivní dashboard"""
    static_dir = Path(settings.BASE_DIR) / 'static'
    html_file = static_dir / 'dashboard.html'
    if html_file.exists():
        return HttpResponse(html_file.read_text(encoding='utf-8'), content_type='text/html')
    raise Http404("Page not found")


def history(request):
    """Historická analytika"""
    static_dir = Path(settings.BASE_DIR) / 'static'
    html_file = static_dir / 'history.html'
    if html_file.exists():
        return HttpResponse(html_file.read_text(encoding='utf-8'), content_type='text/html')
    raise Http404("Page not found")


def connect(request):
    """Průvodce připojením desky"""
    static_dir = Path(settings.BASE_DIR) / 'static'
    html_file = static_dir / 'connect.html'
    if html_file.exists():
        return HttpResponse(html_file.read_text(encoding='utf-8'), content_type='text/html')
    raise Http404("Page not found")


# API views
@csrf_exempt
def data_endpoint(request):
    """Handle both GET and POST for /data endpoint"""
    if request.method == 'POST':
        return receive_data(request)
    elif request.method == 'GET':
        return get_data(request)
    else:
        return JsonResponse({'error': 'Method not allowed'}, status=405)


def receive_data(request):
    """Příjem dat ze senzoru"""
    try:
        data = json.loads(request.body)
        
        if not data:
            return JsonResponse({'error': 'Nebyla přijata žádná data.'}, status=400)
        
        print(f"\n{'='*50}")
        print(f"Přijata data z {data.get('device_id', 'unknown')}")
        print(f"{'='*50}")
        print(json.dumps(data, indent=2))
        
        # Normalize payload to canonical keys
        try:
            normalized = normalize_sensor_data(data)
        except KeyError as exc:
            message = f"Chybí povinné pole: {exc.args[0]}"
            print(f"⚠️  Chyba validace: {message}")
            return JsonResponse({'error': message}, status=400)

        # Validate data
        is_valid, message = validate_sensor_data(normalized)
        if not is_valid:
            print(f"⚠️  Chyba validace: {message}")
            return JsonResponse({'error': message}, status=400)
        
        # Format timestamp
        timestamp_utc = datetime.fromtimestamp(float(normalized['timestamp']), tz=UTC)
        timestamp_local = to_local_datetime(timestamp_utc)
        timestamp_str = timestamp_local.strftime('%Y-%m-%d %H:%M:%S')

        temperature = float(normalized['temperature'])
        humidity = float(normalized['humidity'])
        co2 = int(normalized['co2'])

        document = {
            'timestamp': timestamp_utc,
            'timestamp_str': timestamp_str,
            'device_id': normalized['device_id'],
            'temperature': temperature,
            'humidity': humidity,
            'co2': co2,
            'raw_payload': data
        }

        try:
            get_mongo_collection().insert_one(document)
            print(f"✓ Data uložena do MongoDB v {timestamp_str}")
        except PyMongoError as exc:
            print(f"✗ Chyba při ukládání do MongoDB: {exc}")
            return JsonResponse({'error': 'Data se nepodařilo uložit.'}, status=500)
        
        return JsonResponse({
            'status': 'success',
            'message': 'Data byla přijata a uložena.',
            'timestamp': timestamp_str
        }, status=200)
    
    except Exception as e:
        print(f"✗ Neočekávaná chyba: {str(e)}")
        return JsonResponse({'error': str(e)}, status=500)


def get_data(request):
    """Vrací data pro dashboard (volitelná filtrace)"""
    try:
        # Get query parameters
        hours = int(request.GET.get('hours', 24))
        limit = int(request.GET.get('limit', 1000))
        device_id = request.GET.get('device_id', None)

        # Calculate cutoff time
        cutoff_time = datetime.now(UTC) - timedelta(hours=hours)

        mongo_filter = {'timestamp': {'$gte': cutoff_time}}
        if device_id:
            mongo_filter['device_id'] = device_id

        cursor = get_mongo_collection().find(mongo_filter).sort('timestamp', -1)
        if limit:
            cursor = cursor.limit(limit)

        documents = list(cursor)
        documents.reverse()  # Restore chronological order

        data_points = []
        for doc in documents:
            temperature = float(doc.get('temperature', 0))
            humidity = float(doc.get('humidity', 0))
            co2 = int(doc.get('co2', 0))
            timestamp_local = None
            if 'timestamp' in doc:
                timestamp_local = to_local_datetime(doc['timestamp'])

            timestamp_str = doc.get('timestamp_str')
            if not timestamp_str and timestamp_local:
                timestamp_str = timestamp_local.strftime('%Y-%m-%d %H:%M:%S')
            timestamp_iso = timestamp_local.isoformat() if timestamp_local else None

            data_points.append({
                'timestamp': timestamp_str,
                'timestamp_iso': timestamp_iso,
                'device_id': doc.get('device_id'),
                'temperature': temperature,
                'humidity': humidity,
                'co2': co2,
                'temp_avg': temperature,
                'humidity_avg': humidity
            })

        return JsonResponse({
            'status': 'success',
            'count': len(data_points),
            'data': data_points
        }, status=200)
    
    except PyMongoError as exc:
        return JsonResponse({'error': f'Databázová chyba: {exc}'}, status=500)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@require_http_methods(["GET"])
def history_series(request):
    """Vrací agregované historické časové řady pro analýzu trendů."""
    try:
        now = datetime.now(UTC)
        default_start = now - timedelta(days=30)

        start_dt = parse_iso_datetime(request.GET.get('start'), default_start)
        end_dt = parse_iso_datetime(request.GET.get('end'), now)

        if start_dt and end_dt and start_dt > end_dt:
            return JsonResponse({'error': 'Počáteční datum nesmí být pozdější než koncové.'}, status=400)

        bucket = (request.GET.get('bucket') or 'day').lower()
        if bucket not in ('hour', 'day', 'raw', 'none'):
            return JsonResponse({'error': "Parametr 'bucket' podporuje pouze hodnoty 'hour', 'day', 'raw' nebo 'none'."}, status=400)

        device_id = request.GET.get('device_id')
        mongo_filter = build_history_filter(start_dt, end_dt, device_id)
        bucket_unit = None

        # Handle raw data (no aggregation)
        if bucket in ('raw', 'none'):
            cursor = get_mongo_collection().find(mongo_filter).sort('timestamp', 1)
            series = []
            for doc in cursor:
                timestamp_local = to_local_datetime(doc.get('timestamp'))
                entry = {
                    'bucket_start': to_readable_timestamp(doc.get('timestamp')),
                    'count': 1,
                    'temperature': {
                        'avg': round_or_none(doc.get('temperature')),
                        'min': round_or_none(doc.get('temperature')),
                        'max': round_or_none(doc.get('temperature')),
                    },
                    'humidity': {
                        'avg': round_or_none(doc.get('humidity')),
                        'min': round_or_none(doc.get('humidity')),
                        'max': round_or_none(doc.get('humidity')),
                    },
                    'co2': {
                        'avg': doc.get('co2'),
                        'min': doc.get('co2'),
                        'max': doc.get('co2'),
                    }
                }
                if not device_id:
                    entry['device_id'] = doc.get('device_id')
                series.append(entry)
        else:
            # Aggregated data
            bucket_unit = 'hour' if bucket == 'hour' else 'day'

            group_id = {
                'bucket': {
                    '$dateTrunc': {
                        'date': '$timestamp',
                        'unit': bucket_unit,
                    }
                }
            }
            if not device_id:
                group_id['device_id'] = '$device_id'

            pipeline = [
                {'$match': mongo_filter},
                {
                    '$group': {
                        '_id': group_id,
                        'count': {'$sum': 1},
                        'temperature_avg': {'$avg': '$temperature'},
                        'temperature_min': {'$min': '$temperature'},
                        'temperature_max': {'$max': '$temperature'},
                        'humidity_avg': {'$avg': '$humidity'},
                        'humidity_min': {'$min': '$humidity'},
                        'humidity_max': {'$max': '$humidity'},
                        'co2_avg': {'$avg': '$co2'},
                        'co2_min': {'$min': '$co2'},
                        'co2_max': {'$max': '$co2'},
                    }
                },
                {
                    '$sort': {
                        '_id.bucket': 1,
                        '_id.device_id': 1 if not device_id else 0
                    }
                }
            ]

            cursor = get_mongo_collection().aggregate(pipeline, allowDiskUse=True)
            series = []

            for doc in cursor:
                bucket_dt = doc['_id']['bucket']
                entry = {
                    'bucket_start': to_readable_timestamp(bucket_dt),
                    'count': doc.get('count', 0),
                    'temperature': {
                        'avg': round_or_none(doc.get('temperature_avg')),
                        'min': round_or_none(doc.get('temperature_min')),
                        'max': round_or_none(doc.get('temperature_max')),
                    },
                    'humidity': {
                        'avg': round_or_none(doc.get('humidity_avg')),
                        'min': round_or_none(doc.get('humidity_min')),
                        'max': round_or_none(doc.get('humidity_max')),
                    },
                    'co2': {
                        'avg': round_or_none(doc.get('co2_avg')),
                        'min': doc.get('co2_min'),
                        'max': doc.get('co2_max'),
                    }
                }
                if not device_id:
                    entry['device_id'] = doc['_id'].get('device_id')
                series.append(entry)

        bucket_display = 'raw' if bucket in ('raw', 'none') else bucket_unit
        
        return JsonResponse({
            'status': 'success',
            'bucket': bucket_display,
            'device_id': device_id,
            'count': len(series),
            'series': series
        }, status=200)

    except ValueError as exc:
        return JsonResponse({'error': str(exc)}, status=400)
    except PyMongoError as exc:
        return JsonResponse({'error': f'Databázová chyba: {exc}'}, status=500)
    except Exception as exc:
        return JsonResponse({'error': str(exc)}, status=500)


@require_http_methods(["GET"])
def history_summary(request):
    """Shrnutí historických dat, trendy a anomálie."""
    try:
        now = datetime.now(UTC)
        default_start = now - timedelta(days=30)

        start_dt = parse_iso_datetime(request.GET.get('start'), default_start)
        end_dt = parse_iso_datetime(request.GET.get('end'), now)

        if start_dt and end_dt and start_dt > end_dt:
            return JsonResponse({'error': 'Počáteční datum nesmí být pozdější než koncové.'}, status=400)

        device_id = request.GET.get('device_id')
        mongo_filter = build_history_filter(start_dt, end_dt, device_id)

        pipeline = [
            {'$match': mongo_filter},
            {
                '$group': {
                    '_id': None,
                    'count': {'$sum': 1},
                    'temp_min': {'$min': '$temperature'},
                    'temp_max': {'$max': '$temperature'},
                    'temp_avg': {'$avg': '$temperature'},
                    'humidity_min': {'$min': '$humidity'},
                    'humidity_max': {'$max': '$humidity'},
                    'humidity_avg': {'$avg': '$humidity'},
                    'co2_min': {'$min': '$co2'},
                    'co2_max': {'$max': '$co2'},
                    'co2_avg': {'$avg': '$co2'},
                    'first_ts': {'$min': '$timestamp'},
                    'last_ts': {'$max': '$timestamp'},
                    'co2_good': {'$sum': {'$cond': [{'$lt': ['$co2', CO2_GOOD_MAX]}, 1, 0]}},
                    'co2_moderate': {'$sum': {'$cond': [
                        {'$and': [{'$gte': ['$co2', CO2_GOOD_MAX]}, {'$lt': ['$co2', CO2_MODERATE_MAX]}]}, 1, 0
                    ]}},
                    'co2_high': {'$sum': {'$cond': [
                        {'$and': [{'$gte': ['$co2', CO2_MODERATE_MAX]}, {'$lt': ['$co2', CO2_HIGH_MAX]}]}, 1, 0
                    ]}},
                    'co2_critical': {'$sum': {'$cond': [{'$gte': ['$co2', CO2_HIGH_MAX]}, 1, 0]}}
                }
            }
        ]

        agg = list(get_mongo_collection().aggregate(pipeline, allowDiskUse=True))
        if not agg:
            return JsonResponse({
                'status': 'success',
                'message': 'V daném období nejsou žádná data.',
                'summary': {}
            }, status=200)

        stats = agg[0]
        count = stats.get('count', 0)

        first_doc_cursor = get_mongo_collection().find(mongo_filter).sort('timestamp', 1).limit(1)
        last_doc_cursor = get_mongo_collection().find(mongo_filter).sort('timestamp', -1).limit(1)
        first_doc = next(first_doc_cursor, None)
        last_doc = next(last_doc_cursor, None)

        def calc_trend(metric):
            if not first_doc or not last_doc:
                return {'absolute': None, 'percent': None}
            first_val = first_doc.get(metric)
            last_val = last_doc.get(metric)
            if first_val is None or last_val is None:
                return {'absolute': None, 'percent': None}
            absolute = round_or_none(last_val - first_val)
            percent = None
            if first_val not in (0, None):
                percent = round_or_none(((last_val - first_val) / first_val) * 100)
            return {'absolute': absolute, 'percent': percent}

        co2_quality = {
            'good': stats.get('co2_good', 0),
            'moderate': stats.get('co2_moderate', 0),
            'high': stats.get('co2_high', 0),
            'critical': stats.get('co2_critical', 0),
        }
        if count > 0:
            co2_quality.update({
                'good_percent': round_or_none(co2_quality['good'] / count * 100),
                'moderate_percent': round_or_none(co2_quality['moderate'] / count * 100),
                'high_percent': round_or_none(co2_quality['high'] / count * 100),
                'critical_percent': round_or_none(co2_quality['critical'] / count * 100),
            })
        else:
            co2_quality.update({
                'good_percent': 0,
                'moderate_percent': 0,
                'high_percent': 0,
                'critical_percent': 0,
            })

        summary = {
            'device_id': device_id,
            'range': {
                'requested_start': to_readable_timestamp(start_dt),
                'requested_end': to_readable_timestamp(end_dt),
                'data_start': to_readable_timestamp(stats.get('first_ts')),
                'data_end': to_readable_timestamp(stats.get('last_ts')),
            },
            'samples': count,
            'temperature': {
                'min': round_or_none(stats.get('temp_min')),
                'max': round_or_none(stats.get('temp_max')),
                'avg': round_or_none(stats.get('temp_avg')),
                'trend': calc_trend('temperature'),
            },
            'humidity': {
                'min': round_or_none(stats.get('humidity_min')),
                'max': round_or_none(stats.get('humidity_max')),
                'avg': round_or_none(stats.get('humidity_avg')),
                'trend': calc_trend('humidity'),
            },
            'co2': {
                'min': stats.get('co2_min'),
                'max': stats.get('co2_max'),
                'avg': round_or_none(stats.get('co2_avg')),
                'trend': calc_trend('co2'),
            },
            'co2_quality': co2_quality
        }

        return JsonResponse({
            'status': 'success',
            'summary': summary
        }, status=200)

    except ValueError as exc:
        return JsonResponse({'error': str(exc)}, status=400)
    except PyMongoError as exc:
        return JsonResponse({'error': f'Databázová chyba: {exc}'}, status=500)
    except Exception as exc:
        return JsonResponse({'error': str(exc)}, status=500)


@require_http_methods(["GET"])
def get_stats(request):
    """Statistické shrnutí dat"""
    try:
        hours = int(request.GET.get('hours', 24))
        cutoff_time = datetime.now(UTC) - timedelta(hours=hours)

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
                    'co2_good': {'$sum': {'$cond': [{'$lt': ['$co2', CO2_GOOD_MAX]}, 1, 0]}},
                    'co2_moderate': {'$sum': {'$cond': [
                        {'$and': [{'$gte': ['$co2', CO2_GOOD_MAX]}, {'$lt': ['$co2', CO2_MODERATE_MAX]}]}, 1, 0
                    ]}},
                    'co2_high': {'$sum': {'$cond': [
                        {'$and': [{'$gte': ['$co2', CO2_MODERATE_MAX]}, {'$lt': ['$co2', CO2_HIGH_MAX]}]}, 1, 0
                    ]}},
                    'co2_critical': {'$sum': {'$cond': [{'$gte': ['$co2', CO2_HIGH_MAX]}, 1, 0]}},
                }
            }
        ]

        agg_result = list(get_mongo_collection().aggregate(pipeline))
        if not agg_result:
            return JsonResponse({
                'status': 'success',
                'message': 'Nejsou k dispozici žádná data.',
                'stats': {}
            }, status=200)
        
        stats_doc = agg_result[0]

        # Fetch most recent document for "current" values
        latest_doc = get_mongo_collection().find(mongo_filter).sort('timestamp', -1).limit(1)
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
        co2_high = stats_doc.get('co2_high', 0)
        co2_critical = stats_doc.get('co2_critical', 0)

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
                'high': co2_high,
                'critical': co2_critical,
                'good_percent': round(co2_good / count * 100, 1),
                'moderate_percent': round(co2_moderate / count * 100, 1),
                'high_percent': round(co2_high / count * 100, 1),
                'critical_percent': round(co2_critical / count * 100, 1)
            }
        else:
            stats['co2_quality'] = {
                'good': 0,
                'moderate': 0,
                'high': 0,
                'critical': 0,
                'good_percent': 0,
                'moderate_percent': 0,
                'high_percent': 0,
                'critical_percent': 0
            }
        
        return JsonResponse({
            'status': 'success',
            'stats': stats
        }, status=200)
    
    except PyMongoError as exc:
        return JsonResponse({'error': f'Databázová chyba: {exc}'}, status=500)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@require_http_methods(["GET"])
def status_view(request):
    """Stav serveru"""
    try:
        total_documents = get_mongo_collection().count_documents({})
        latest_doc = get_mongo_collection().find().sort('timestamp', -1).limit(1)
        latest_doc = next(latest_doc, None)

        latest_timestamp = None
        if latest_doc:
            latest_timestamp = latest_doc.get('timestamp_str')
            if not latest_timestamp:
                latest_timestamp = to_readable_timestamp(latest_doc.get('timestamp'))

        return JsonResponse({
            'status': 'online',
            'database': MONGO_DB_NAME,
            'collection': MONGO_COLLECTION_NAME,
            'data_points': total_documents,
            'latest_entry': latest_timestamp,
            'server_time': datetime.now(LOCAL_TZ).strftime('%Y-%m-%d %H:%M:%S')
        }, status=200)

    except PyMongoError as exc:
        return JsonResponse({'error': f'Databázová chyba: {exc}'}, status=500)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def connect_upload(request):
    """Zápis WiFi údajů a nahrání firmware do připojené desky"""
    try:
        payload = json.loads(request.body) if request.body else {}
    except json.JSONDecodeError:
        payload = {}

    ssid = (payload.get('ssid') or '').strip()
    password = payload.get('password', '')

    if not ssid:
        return JsonResponse({
            'status': 'error',
            'message': 'Pro nahrání firmware je nutné zadat SSID.'
        }, status=400)

    if password is None:
        password = ''

    if not isinstance(password, str):
        return JsonResponse({
            'status': 'error',
            'message': 'Heslo musí být textový řetězec.'
        }, status=400)

    try:
        apply_wifi_credentials(ssid, password)
    except ConfigWriteError as exc:
        print(f"✗ Nepodařilo se upravit config.h: {exc}")
        return JsonResponse({
            'status': 'error',
            'message': 'Konfigurační soubor se nepodařilo upravit. Zkontrolujte oprávnění serveru.'
        }, status=500)

    try:
        return_code, stdout, stderr = run_platformio_upload()
    except FileNotFoundError:
        return JsonResponse({
            'status': 'error',
            'message': 'Na serveru není nainstalováno PlatformIO. Bez něj nelze nahrávat firmware.'
        }, status=500)
    except OSError as exc:
        return JsonResponse({
            'status': 'error',
            'message': f'PlatformIO se nepodařilo spustit: {exc}'
        }, status=500)

    log_excerpt = summarize_logs(stdout, stderr)

    if return_code != 0:
        print(f"✗ Nahrávání přes PlatformIO pro SSID '{ssid}' selhalo.")
        return JsonResponse({
            'status': 'error',
            'message': 'Nahrávání firmware selhalo. Podrobnosti najdete v logu.',
            'log_excerpt': log_excerpt
        }, status=500)

    print(f"✓ Nahrávání přes PlatformIO pro SSID '{ssid}' proběhlo úspěšně.")
    return JsonResponse({
        'status': 'success',
        'message': 'Firmware byl na desku úspěšně nahrán.',
        'log_excerpt': log_excerpt
    }, status=200)
