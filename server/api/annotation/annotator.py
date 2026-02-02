"""
Annotator module for creating annotated sensor data documents.
Combines sensor readings with timetable information using the bucket pattern.
One document per room per hour for efficient querying and ML export.
"""

import os
from datetime import datetime, date, timedelta, timezone, time as dt_time
from typing import Optional, List, Dict, Any
from dataclasses import dataclass, asdict
import json
from pathlib import Path

try:
    from zoneinfo import ZoneInfo
except ImportError:
    from backports.zoneinfo import ZoneInfo

from pymongo import MongoClient, ASCENDING
from pymongo.errors import PyMongoError
import certifi

from .timetable_fetcher import get_timetable_fetcher, LOCAL_TZ
from .room_config import VALID_ROOM_CODES
from .room_manager import RoomManager


UTC = timezone.utc

# MongoDB collections (lazy initialization)
_sensor_collection = None
_annotated_readings_collection = None
_registry_collection = None


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


def get_sensor_collection():
    """Get the sensor data collection."""
    global _sensor_collection
    if _sensor_collection is None:
        client = _get_mongo_client()
        db = client[get_mongo_db_name()]
        _sensor_collection = db['sensor_data_']
    return _sensor_collection


def get_annotated_readings_collection():
    """Get or initialize the annotated_readings collection (bucket pattern)."""
    global _annotated_readings_collection
    if _annotated_readings_collection is None:
        client = _get_mongo_client()
        db = client[get_mongo_db_name()]
        _annotated_readings_collection = db['annotated_readings']
        
        # Create indexes for efficient querying
        _annotated_readings_collection.create_index([
            ('room_id', ASCENDING),
            ('bucket_start', ASCENDING)
        ])
        _annotated_readings_collection.create_index([('bucket_start', ASCENDING)])
        _annotated_readings_collection.create_index([('stats.avg_co2', ASCENDING)])
        
        print("✓ Annotated readings collection initialized with indexes")
    return _annotated_readings_collection


def get_registry_collection():
    """Get the device registry collection."""
    global _registry_collection
    if _registry_collection is None:
        client = _get_mongo_client()
        db = client[get_mongo_db_name()]
        _registry_collection = db['device_registry']
    return _registry_collection


@dataclass
class AnnotatedReading:
    """A single sensor reading with timetable annotation."""
    ts: datetime  # BSON datetime for proper indexing
    temp: float
    humidity: float
    co2: int
    subject: Optional[str]
    teacher: Optional[str]
    lesson_number: Optional[int]
    class_name: Optional[str]
    is_lesson: bool


def get_devices_with_rooms() -> List[Dict]:
    """
    Get all devices that have room_code assigned.
    
    Returns:
        List of dicts with mac_address, room_code, display_name
    """
    registry = get_registry_collection()
    devices = list(registry.find({
        'room_code': {'$exists': True, '$ne': None, '$ne': ''}
    }))
    
    return [
        {
            'mac_address': d['mac_address'],
            'room_code': d['room_code'],
            'display_name': d.get('display_name', d['mac_address'])
        }
        for d in devices
    ]


def get_readings_for_date(mac_address: str, target_date: date) -> List[Dict]:
    """
    Get all sensor readings for a device on a specific date.
    
    Args:
        mac_address: Device MAC address
        target_date: The date to get readings for
    
    Returns:
        List of reading documents
    """
    collection = get_sensor_collection()
    
    # Calculate date range in UTC
    local_start = datetime.combine(target_date, datetime.min.time())
    local_end = datetime.combine(target_date, datetime.max.time())
    
    # Convert to UTC
    start_utc = local_start.replace(tzinfo=LOCAL_TZ).astimezone(UTC)
    end_utc = local_end.replace(tzinfo=LOCAL_TZ).astimezone(UTC)
    
    # Query with both old and new format support
    query = {
        '$or': [
            {'metadata.mac_address': mac_address},
            {'mac_address': mac_address}
        ],
        'timestamp': {
            '$gte': start_utc,
            '$lte': end_utc
        }
    }
    
    readings = list(collection.find(query).sort('timestamp', 1))
    return readings


def annotate_reading(reading: Dict, room_code: str, fetcher) -> AnnotatedReading:
    """
    Annotate a single sensor reading with timetable information.
    
    Args:
        reading: Sensor reading document
        room_code: Room code for the device
        fetcher: Timetable fetcher instance
    
    Returns:
        AnnotatedReading with lesson info if applicable
    """
    timestamp = reading.get('timestamp')
    if isinstance(timestamp, datetime):
        ts_aware = timestamp if timestamp.tzinfo else timestamp.replace(tzinfo=UTC)
    else:
        # Try to parse string
        ts_aware = datetime.fromisoformat(str(timestamp)).replace(tzinfo=UTC)
    
    # Get lesson info
    lesson = fetcher.get_lesson_at(room_code, ts_aware)
    
    return AnnotatedReading(
        ts=ts_aware,  # Keep as datetime for BSON
        temp=round(float(reading.get('temperature', 0)), 2),
        humidity=round(float(reading.get('humidity', 0)), 2),
        co2=int(reading.get('co2', 0)),
        subject=lesson['subject'] if lesson else None,
        teacher=lesson['teacher'] if lesson else None,
        lesson_number=lesson['lesson_number'] if lesson else None,
        class_name=lesson['class_name'] if lesson else None,
        is_lesson=lesson['is_lesson'] if lesson else False
    )


def compute_bucket_stats(readings: List[AnnotatedReading]) -> Dict:
    """
    Compute aggregate statistics for a bucket of readings.
    
    Args:
        readings: List of AnnotatedReading objects
    
    Returns:
        Dict with min/max/avg statistics
    """
    if not readings:
        return {}
    
    temps = [r.temp for r in readings]
    humidities = [r.humidity for r in readings]
    co2s = [r.co2 for r in readings]
    lesson_count = sum(1 for r in readings if r.is_lesson)
    
    return {
        'min_temp': round(min(temps), 2),
        'max_temp': round(max(temps), 2),
        'avg_temp': round(sum(temps) / len(temps), 2),
        'min_humidity': round(min(humidities), 2),
        'max_humidity': round(max(humidities), 2),
        'avg_humidity': round(sum(humidities) / len(humidities), 2),
        'min_co2': min(co2s),
        'max_co2': max(co2s),
        'avg_co2': round(sum(co2s) / len(co2s), 2),
        'reading_count': len(readings),
        'lesson_count': lesson_count
    }


def group_readings_by_hour(readings: List[AnnotatedReading]) -> Dict[datetime, List[AnnotatedReading]]:
    """
    Group readings into hourly buckets.
    
    Args:
        readings: List of AnnotatedReading objects
    
    Returns:
        Dict mapping bucket_start datetime to list of readings
    """
    buckets: Dict[datetime, List[AnnotatedReading]] = {}
    
    for reading in readings:
        # Get the hour start (floor to hour)
        local_ts = reading.ts.astimezone(LOCAL_TZ)
        bucket_start = local_ts.replace(minute=0, second=0, microsecond=0)
        bucket_start_utc = bucket_start.astimezone(UTC)
        
        if bucket_start_utc not in buckets:
            buckets[bucket_start_utc] = []
        buckets[bucket_start_utc].append(reading)
    
    return buckets


def load_class_occupancy() -> Dict[str, int]:
    """Load class occupancy mapping from JSON file."""
    try:
        # Resolve path relative to server root
        # annotator.py is in server/api/annotation/
        base_dir = Path(__file__).resolve().parent.parent.parent
        data_path = base_dir / 'data' / 'annotation_config.json'
        
        if not data_path.exists():
            print(f"⚠️ Annotation config file not found at {data_path}")
            return {}
            
        with open(data_path, 'r', encoding='utf-8') as f:
            config = json.load(f)
            return config.get('class_occupancy', {})
    except Exception as e:
        print(f"⚠️ Error loading class occupancy: {e}")
        return {}


def annotate_day(target_date: date) -> Dict:
    """
    Annotate all sensor readings for a specific date.
    Creates bucket documents (one per room per hour) in the new schema.
    
    Args:
        target_date: The date to annotate
    
    Returns:
        Summary dict with annotation results
    """
    print(f"\n{'='*60}")
    print(f"📅 Annotating data for {target_date.isoformat()}")
    print(f"{'='*60}")
    
    fetcher = get_timetable_fetcher()
    # Clear cache to ensure fresh timetable data
    fetcher.clear_cache()
    
    devices = get_devices_with_rooms()
    
    if not devices:
        print("⚠️  No devices with room assignments found")
        return {
            'date': target_date.isoformat(),
            'generated_at': datetime.now(UTC).isoformat(),
            'total_readings': 0,
            'rooms_annotated': 0,
            'buckets_created': 0
        }
    
    print(f"Found {len(devices)} devices with room assignments")
    
    collection = get_annotated_readings_collection()
    total_readings = 0
    total_buckets = 0
    rooms_processed = set()
    
    # Initialize RoomManager
    room_mgr = RoomManager()
    
    for device in devices:
        mac = device['mac_address']
        room_code = device['room_code']
        display_name = device['display_name']
        
        print(f"\n📍 Processing {display_name} ({mac}) in room {room_code}")
        
        # Pre-fetch timetable for this room
        fetcher.fetch_for_room(room_code, target_date)
        
        # Get readings
        readings = get_readings_for_date(mac, target_date)
        print(f"   Found {len(readings)} readings")
        
        if not readings:
            continue
        
        # Annotate each reading
        annotated_readings = []
        for reading in readings:
            annotated = annotate_reading(reading, room_code, fetcher)
            annotated_readings.append(annotated)
        
        # Group into hourly buckets
        buckets = group_readings_by_hour(annotated_readings)
        
        # Store each bucket as a separate document
        for bucket_start, bucket_readings in buckets.items():
            bucket_end = bucket_start + timedelta(hours=1)
            
            # Compute stats for the bucket
            stats = compute_bucket_stats(bucket_readings)
            
            # Convert readings to dicts for storage
            readings_data = [asdict(r) for r in bucket_readings]
            
            # --- Enrichment Logic ---
            
            # 1. Room Metadata
            room_meta = room_mgr.get_room(room_code) or {}
            
            # 2. Occupancy Estimation
            # Logic: Use class name from the lesson to lookup standard occupancy
            estimated_occupancy = 0
            dominant_class = None
            
            # Find dominant class in this bucket (most frequent class name)
            classes_in_bucket = [r.class_name for r in bucket_readings if r.is_lesson and r.class_name]
            
            if classes_in_bucket:
                # Get most common class
                from collections import Counter
                dominant_class = Counter(classes_in_bucket).most_common(1)[0][0]
                
                # Lookup occupancy
                occupancy_map = load_class_occupancy()
                
                if dominant_class in occupancy_map:
                    estimated_occupancy = occupancy_map[dominant_class]
                elif ' ' in dominant_class:
                    # Heuristic: Split classes (e.g. "4.O sk1") default to 15
                    estimated_occupancy = 15
                else:
                    # Default full class
                    estimated_occupancy = 30
                
                # Verify we actually have a lesson majority before assigning occupancy
                if stats.get('lesson_count', 0) < (stats.get('reading_count', 0) / 2):
                     # If lessons are minor part of the hour (e.g. break or end of day), reduce or zero?
                     # Spec says "fetch from timetable". If timetable says class is there, they are there.
                     # But we are hourly bucketing.
                     # We'll stick to assignment if a class was detected.
                     pass
            else:
                # No class name found (or no lesson)
                estimated_occupancy = 0
            
            # 3. Ventilation Score
            # Simple heuristic: 0-10 based on CO2 average
            avg_co2 = stats.get('avg_co2', 400)
            if avg_co2 < 1000:
                vent_score = 10.0
            else:
                # Decay: 1000->10, 2000->5, 3000->0
                # Formula: 10 - (avg - 1000) / 200
                vent_score = 10.0 - ((avg_co2 - 1000) / 200.0)
                vent_score = max(0.0, min(10.0, vent_score))
            
            bucket_doc = {
                'room_id': room_code,
                'device_mac': mac,
                'device_name': display_name,
                'bucket_start': bucket_start,
                'bucket_end': bucket_end,
                'stats': stats,
                'readings': readings_data,
                'context': {
                    'room': room_meta,
                    'lesson': {
                        'estimated_occupancy': estimated_occupancy,
                        'class_name': dominant_class
                    }
                },
                'analysis': {
                    'ventilation_score': round(vent_score, 1)
                }
            }
            
            try:
                # Upsert: replace if same room + bucket_start exists
                collection.replace_one(
                    {
                        'room_id': room_code,
                        'bucket_start': bucket_start
                    },
                    bucket_doc,
                    upsert=True
                )
                total_buckets += 1
            except PyMongoError as e:
                print(f"✗ Failed to save bucket: {e}")
        
        total_readings += len(annotated_readings)
        rooms_processed.add(room_code)
        print(f"   ✓ Created {len(buckets)} hourly buckets ({len(annotated_readings)} readings)")
    
    summary = {
        'date': target_date.isoformat(),
        'generated_at': datetime.now(UTC).isoformat(),
        'total_readings': total_readings,
        'rooms_annotated': len(rooms_processed),
        'buckets_created': total_buckets
    }
    
    print(f"\n✓ Annotation complete for {target_date.isoformat()}")
    print(f"   Total readings: {total_readings}")
    print(f"   Rooms annotated: {len(rooms_processed)}")
    print(f"   Buckets created: {total_buckets}")
    
    return summary


def annotate_yesterday() -> Dict:
    """
    Convenience function to annotate yesterday's data.
    
    WARNING: This may not work correctly if called the next day,
    as the BakalAPI only returns the current week's timetable.
    Use annotate_today() for reliable same-day annotation.
    
    Returns:
        Summary dict with annotation results
    """
    yesterday = date.today() - timedelta(days=1)
    return annotate_day(yesterday)


def annotate_today() -> Dict:
    """
    Annotate today's sensor data with the current timetable.
    
    This is the recommended function for scheduled annotation because
    the BakalAPI returns the current week's timetable. Running this
    at the end of each day (e.g., 23:00) ensures timetable entries
    are still available for matching.
    
    Returns:
        Summary dict with annotation results
    """
    today = date.today()
    return annotate_day(today)


def get_annotation_status() -> Dict:
    """
    Get the status of the annotation system.
    
    Returns:
        Dict with status info
    """
    try:
        collection = get_annotated_readings_collection()
        
        # Get latest bucket
        latest = collection.find_one(sort=[('bucket_start', -1)])
        
        # Count total buckets
        total_buckets = collection.count_documents({})
        
        # Get unique rooms
        rooms = collection.distinct('room_id')
        
        # Get devices with rooms
        devices = get_devices_with_rooms()
        
        return {
            'status': 'ok',
            'total_buckets': total_buckets,
            'latest_bucket_start': latest['bucket_start'].isoformat() if latest else None,
            'rooms_with_data': rooms,
            'devices_with_rooms': len(devices)
        }
    except Exception as e:
        return {
            'status': 'error',
            'error': str(e)
        }
