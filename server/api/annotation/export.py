"""
Export module for CSV export of sensor data.
Unified handling for both raw (sensor_data_) and annotated (annotated_readings) collections.
"""

import os
import csv
import io
import re
from datetime import datetime, date, timedelta, timezone
from typing import Optional, List, Dict, Any

from pymongo import MongoClient, ASCENDING
import certifi

try:
    from zoneinfo import ZoneInfo
except ImportError:
    from backports.zoneinfo import ZoneInfo


UTC = timezone.utc
LOCAL_TZ = ZoneInfo(os.getenv('LOCAL_TIMEZONE', 'Europe/Prague'))


def get_mongo_uri() -> str:
    """Get MongoDB URI from environment."""
    return os.getenv('MONGO_URI', 'mongodb://localhost:27017/')


def get_mongo_db_name() -> str:
    """Get MongoDB database name."""
    return os.getenv('MONGO_DB_NAME', 'cognitiv')


def _get_mongo_client():
    """Create a new MongoDB client."""
    return MongoClient(
        get_mongo_uri(),
        serverSelectionTimeoutMS=5000,
        tlsCAFile=certifi.where(),
        tz_aware=True,
        tzinfo=UTC,
    )


def get_annotated_readings_collection():
    """Get the annotated_readings collection."""
    client = _get_mongo_client()
    db = client[get_mongo_db_name()]
    return db['annotated_readings']


def get_sensor_collection():
    """Get the raw sensor_data_ collection."""
    client = _get_mongo_client()
    db = client[get_mongo_db_name()]
    return db['sensor_data_']


def sanitize_filename(s: str) -> str:
    """Remove or replace characters that are invalid in filenames."""
    if not s:
        return ''
    # Replace spaces, colons, and other problematic chars
    s = s.replace(' ', '_').replace(':', '-').replace('/', '-')
    # Remove any remaining problematic characters
    s = re.sub(r'[<>"|?*]', '', s)
    return s


def to_readable_timestamp(dt) -> str:
    """Convert datetime to readable string in local time."""
    if dt is None:
        return ""
    if isinstance(dt, str):
        # Already a string, try to parse? Or just return
        return dt
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=UTC)
    
    local_dt = dt.astimezone(LOCAL_TZ)
    return local_dt.strftime('%Y-%m-%d %H:%M:%S')


def export_readings_csv(
    start_date: date,
    end_date: date,
    rooms: Optional[List[str]] = None
) -> str:
    """
    Export annotated readings to CSV format (ML Ready).
    
    Args:
        start_date: Start date (inclusive)
        end_date: End date (inclusive)
        rooms: Optional list of room_ids to filter by
    
    Returns:
        CSV string with flattened reading data
    """
    collection = get_annotated_readings_collection()
    
    # Build match filter
    match_filter = {
        'bucket_start': {
            '$gte': datetime.combine(start_date, datetime.min.time()).replace(tzinfo=UTC),
            '$lt': datetime.combine(end_date + timedelta(days=1), datetime.min.time()).replace(tzinfo=UTC)
        }
    }
    
    if rooms:
        match_filter['room_id'] = {'$in': rooms}
    
    # Aggregation pipeline to flatten readings
    pipeline = [
        {'$match': match_filter},
        {'$unwind': '$readings'},
        {'$project': {
            '_id': 0,
            'room': '$room_id',
            'device_mac': '$device_mac',
            'device_name': '$device_name',
            'timestamp': '$readings.ts',
            'temperature': '$readings.temp',
            'humidity': '$readings.humidity',
            'co2': '$readings.co2',
            'subject': '$readings.subject',
            'teacher': '$readings.teacher',
            'lesson_number': '$readings.lesson_number',
            'is_lesson': '$readings.is_lesson'
        }},
        {'$sort': {'timestamp': 1}}
    ]
    
    results = list(collection.aggregate(pipeline))
    
    # Convert to CSV
    output = io.StringIO()
    if results:
        fieldnames = [
            'room', 'device_mac', 'device_name', 'timestamp',
            'temperature', 'humidity', 'co2',
            'subject', 'teacher', 'lesson_number', 'is_lesson'
        ]
        writer = csv.DictWriter(output, fieldnames=fieldnames)
        writer.writeheader()
        
        for row in results:
            # Convert datetime to ISO string
            if isinstance(row.get('timestamp'), datetime):
                row['timestamp'] = row['timestamp'].isoformat()
            writer.writerow(row)
    
    return output.getvalue()


def export_hourly_stats_csv(
    start_date: date,
    end_date: date,
    rooms: Optional[List[str]] = None
) -> str:
    """
    Export hourly statistics to CSV format.
    Uses pre-computed bucket stats for fast export.
    
    Args:
        start_date: Start date (inclusive)
        end_date: End date (inclusive)
        rooms: Optional list of room_ids to filter by
    
    Returns:
        CSV string with hourly statistics
    """
    collection = get_annotated_readings_collection()
    
    # Build match filter
    match_filter = {
        'bucket_start': {
            '$gte': datetime.combine(start_date, datetime.min.time()).replace(tzinfo=UTC),
            '$lt': datetime.combine(end_date + timedelta(days=1), datetime.min.time()).replace(tzinfo=UTC)
        }
    }
    
    if rooms:
        match_filter['room_id'] = {'$in': rooms}
    
    # Query bucket-level stats directly (no unwind needed)
    pipeline = [
        {'$match': match_filter},
        {'$project': {
            '_id': 0,
            'room': '$room_id',
            'bucket_start': 1,
            'bucket_end': 1,
            'reading_count': '$stats.reading_count',
            'lesson_count': '$stats.lesson_count',
            'min_temp': '$stats.min_temp',
            'max_temp': '$stats.max_temp',
            'avg_temp': '$stats.avg_temp',
            'min_co2': '$stats.min_co2',
            'max_co2': '$stats.max_co2',
            'avg_co2': '$stats.avg_co2'
        }},
        {'$sort': {'bucket_start': 1}}
    ]
    
    results = list(collection.aggregate(pipeline))
    
    # Convert to CSV
    output = io.StringIO()
    if results:
        fieldnames = [
            'room', 'bucket_start', 'bucket_end',
            'reading_count', 'lesson_count',
            'min_temp', 'max_temp', 'avg_temp',
            'min_co2', 'max_co2', 'avg_co2'
        ]
        writer = csv.DictWriter(output, fieldnames=fieldnames)
        writer.writeheader()
        
        for row in results:
            # Convert datetimes to ISO strings
            for key in ['bucket_start', 'bucket_end']:
                if isinstance(row.get(key), datetime):
                    row[key] = row[key].isoformat()
            writer.writerow(row)
    
    return output.getvalue()


def export_raw_csv(
    start_dt: datetime,
    end_dt: datetime,
    device_id: Optional[str] = None
) -> str:
    """
    Export raw sensor data to CSV string.
    Matches the format expected by the frontend 'History Export'.
    
    Args:
        start_dt: Start datetime (aware)
        end_dt: End datetime (aware)
        device_id: Optional device identifier filter
        
    Returns:
        CSV string content
    """
    mongo_filter = {
        'timestamp': {
            '$gte': start_dt,
            '$lte': end_dt
        }
    }
    
    if device_id:
        # Use proper backward-compatible filter construction
        # Note: We duplicate logic here slightly to avoid circular imports from views.py
        mongo_filter['$or'] = [
            {'metadata.mac_address': device_id},
            {'metadata.device_id': device_id},
            {'mac_address': device_id},
            {'device_id': device_id}
        ]
        
    cursor = get_sensor_collection().find(mongo_filter).sort('timestamp', 1)
    
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Write header (czech, matching existing frontend expectation)
    writer.writerow([
        'Časové razítko',
        'Zařízení',
        'Teplota (°C)',
        'Vlhkost (%)',
        'CO₂ (ppm)'
    ])
    
    # Write data rows
    count = 0
    for doc in cursor:
        timestamp_str = to_readable_timestamp(doc.get('timestamp'))
        
        # Extract device_id with fallback
        doc_device = doc.get('metadata', {}).get('device_id') or doc.get('device_id') or ''
        
        writer.writerow([
            timestamp_str,
            doc_device,
            doc.get('temperature', ''),
            doc.get('humidity', ''),
            doc.get('co2', '')
        ])
        count += 1
    
    if count == 0:
        writer.writerow(['Žádná data v zadaném období', '', '', '', ''])
        
    return output.getvalue()


def get_available_date_range() -> Dict[str, Optional[str]]:
    """
    Get the available date range in the annotated_readings collection.
    
    Returns:
        Dict with 'start_date' and 'end_date' (ISO format) or None if no data
    """
    collection = get_annotated_readings_collection()
    
    # Find earliest bucket
    earliest = collection.find_one(sort=[('bucket_start', ASCENDING)])
    latest = collection.find_one(sort=[('bucket_start', -1)])
    
    return {
        'start_date': earliest['bucket_start'].date().isoformat() if earliest else None,
        'end_date': latest['bucket_start'].date().isoformat() if latest else None
    }


def get_available_rooms() -> List[str]:
    """
    Get list of all rooms with annotated data.
    
    Returns:
        List of room_id strings
    """
    collection = get_annotated_readings_collection()
    return collection.distinct('room_id')
