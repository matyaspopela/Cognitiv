import csv
import io
import json
import os
import sys
from typing import Generator, Dict, Any, List, Optional
from datetime import datetime, date, timezone
from pymongo import MongoClient
import certifi

from api.services.weather_service import WeatherService
from api.analytics.mold_calculator import calculate_mold_factor_simple
from .query_builder import QueryBuilder

try:
    from zoneinfo import ZoneInfo
except ImportError:
    from backports.zoneinfo import ZoneInfo

UTC = timezone.utc

def get_mongo_uri() -> str:
    """Get MongoDB URI from environment."""
    return os.getenv('MONGO_URI', 'mongodb://localhost:27017/')

def get_mongo_db_name() -> str:
    """Get MongoDB database name."""
    return os.getenv('MONGO_DB_NAME', 'cognitiv')

def get_annotated_readings_collection():
    """Get annotated readings collection."""
    client = MongoClient(
        get_mongo_uri(),
        serverSelectionTimeoutMS=5000,
        tlsCAFile=certifi.where(),
        tz_aware=True,
        tzinfo=UTC,
    )
    db = client[get_mongo_db_name()]
    return db['annotated_readings']

class ExportEngine:
    def __init__(self):
        self.weather_svc = WeatherService()
        self.qb = QueryBuilder()
    
    def _generate_manifest(self, filters: Dict, bucketing: str = None, row_count: int = 0) -> Dict[str, Any]:
        """
        Generate manifest metadata for reproducibility. 
        
        Args:
            filters: Query filters used
            bucketing: Aggregation interval
            row_count: Total number of rows exported
            
        Returns:
            Manifest dictionary
        """
        return {
            'generation_timestamp': datetime.now(UTC).isoformat(),
            'query_params': {
                'start_date': filters.get('start'),
                'end_date': filters.get('end'),
                'rooms': filters.get('rooms', []),
                'bucketing': bucketing or 'raw',
            },
            'row_count': row_count,
            'version': '1.1',
            'exported_by': 'Cognitiv DataLab'
        }
    
    def _calculate_delta_co2(self, readings: List[Dict], room_id: str) -> List[Dict]:
        """
        Calculate delta CO2 (change from previous reading) for a room.
        
        Args:
            readings: List of reading dictionaries
            room_id: Room identifier
            
        Returns:
            Readings with delta_co2 field added
        """
        enriched_readings = []
        prev_co2 = None
        
        for reading in readings:
            current_co2 = reading.get('co2')
            delta_co2 = reading.get('delta_co2') # Use pre-calculated delta if available
            
            # Recalculate if not present (legacy support or raw data without gap handling)
            if delta_co2 is None and current_co2 is not None and prev_co2 is not None:
                delta_co2 = current_co2 - prev_co2
            
            enriched_reading = {**reading}
            if 'delta_co2' not in enriched_reading or enriched_reading['delta_co2'] is None:
                 enriched_reading['delta_co2'] = delta_co2
                 
            enriched_readings.append(enriched_reading)
            
            prev_co2 = current_co2
        
        return enriched_readings
    
    def export_stream(self, filters: Dict, format: str = 'csv', bucketing: str = None) -> Generator[bytes, None, None]:
        """
        Stream exported data in specified format.
        
        Args:
            filters: Dict with 'start', 'end', 'rooms' (optional)
            format: 'csv' or 'jsonl'
            bucketing: '15m', '1h', '1d' or None
            
        Yields:
            Bytes of exported data
        """
        # Dispatch to format-specific method
        if format == 'csv':
            yield from self._export_csv(filters, bucketing)
        elif format == 'jsonl':
            yield from self._export_jsonl(filters, bucketing)
        else:
            raise ValueError(f"Unsupported export format: {format}")
    
    def _export_csv(self, filters: Dict, bucketing: str = None) -> Generator[bytes, None, None]:
        """Export data as CSV with manifest header."""
        try:
            pipeline = self.qb.build_export_pipeline(filters, bucketing=bucketing)
            
            collection = get_annotated_readings_collection()
            cursor = collection.aggregate(pipeline)
            
        except ValueError:
            return

        output = io.StringIO()
        writer = csv.writer(output)
        
        # Generate and write manifest as comments
        manifest = self._generate_manifest(filters, bucketing)
        output.write(f"# Cognitiv DataLab Export\n")
        output.write(f"# Generated: {manifest['generation_timestamp']}\n")
        output.write(f"# Query: {json.dumps(manifest['query_params'])}\n")
        output.write(f"#\n")
        
        yield output.getvalue().encode('utf-8')
        output.seek(0)
        output.truncate(0)
        
        # Header
        header = [
            'timestamp', 'room_id', 'device_mac', 
            'co2', 'temp', 'humidity',
            'delta_co2', 'mold_factor',
            'weather_temp_c', 'weather_humidity',
            'subject', 'teacher', 'class_name', 'occupancy'
        ]
        
        writer.writerow(header)
        yield output.getvalue().encode('utf-8')
        output.seek(0)
        output.truncate(0)
        
        # Weather cache
        weather_cache = {}
        
        for bucket in cursor:
            room_id = bucket.get('room_id')
            device_mac = bucket.get('device_mac')
            readings = bucket.get('readings', [])
            context = bucket.get('context', {})
            lesson_ctx = context.get('lesson', {})
            occupancy_est = lesson_ctx.get('estimated_occupancy', 0)
            
            # Calculate delta CO2 for this bucket's readings if needed
            # (If aggregated, QueryBuilder already handles this, but this is safe)
            enriched_readings = self._calculate_delta_co2(readings, room_id)
            
            for reading in enriched_readings:
                ts = reading.get('ts')
                if isinstance(ts, str):
                    try:
                        ts = datetime.fromisoformat(ts).replace(tzinfo=UTC)
                    except:
                        pass
                
                # Fetch Weather
                weather_temp = None
                weather_hum = None
                
                if isinstance(ts, datetime):
                    hour_key = ts.replace(minute=0, second=0, microsecond=0)
                    
                    if hour_key not in weather_cache:
                        w_data = self.weather_svc.get_weather_for_timestamp(hour_key)
                        weather_cache[hour_key] = w_data
                    
                    w_entry = weather_cache.get(hour_key)
                    if w_entry:
                        weather_temp = w_entry.get('temp_c')
                        weather_hum = w_entry.get('humidity_rel')
                
                
                # Use pre-calculated mold risk from annotation or aggregation
                mold_factor = reading.get('mold_factor') or reading.get('mold_risk')
                if mold_factor is None and reading.get('humidity') is not None and reading.get('temp') is not None:
                    mold_factor = calculate_mold_factor_simple(
                        humidity_rel=reading.get('humidity'),
                        temp_c=reading.get('temp')
                    )
                
                row = [
                    ts.isoformat() if isinstance(ts, datetime) else ts,
                    room_id,
                    device_mac,
                    reading.get('co2'),
                    reading.get('temp'),
                    reading.get('humidity'),
                    reading.get('delta_co2'),
                    mold_factor,
                    weather_temp,
                    weather_hum,
                    reading.get('subject'),
                    reading.get('teacher'),
                    reading.get('class_name'),
                    occupancy_est
                ]
                
                writer.writerow(row)
                yield output.getvalue().encode('utf-8')
                output.seek(0)
                output.truncate(0)
    
    def _export_jsonl(self, filters: Dict, bucketing: str = None) -> Generator[bytes, None, None]:
        """Export data as JSON Lines with manifest as first line."""
        try:
            pipeline = self.qb.build_export_pipeline(filters, bucketing=bucketing)
            
            collection = get_annotated_readings_collection()
            cursor = collection.aggregate(pipeline)
            
        except ValueError:
            return

        # First line: Manifest
        manifest = self._generate_manifest(filters, bucketing)
        manifest_line = json.dumps({'manifest': manifest}) + '\n'
        yield manifest_line.encode('utf-8')
        
        # Weather cache
        weather_cache = {}
        
        for bucket in cursor:
            room_id = bucket.get('room_id')
            device_mac = bucket.get('device_mac')
            readings = bucket.get('readings', [])
            context = bucket.get('context', {})
            lesson_ctx = context.get('lesson', {})
            occupancy_est = lesson_ctx.get('estimated_occupancy', 0)
            
            # Calculate delta CO2
            enriched_readings = self._calculate_delta_co2(readings, room_id)
            
            for reading in enriched_readings:
                ts = reading.get('ts')
                if isinstance(ts, str):
                    try:
                        ts = datetime.fromisoformat(ts).replace(tzinfo=UTC)
                    except:
                        pass
                
                # Fetch Weather
                weather_temp = None
                weather_hum = None
                
                if isinstance(ts, datetime):
                    hour_key = ts.replace(minute=0, second=0, microsecond=0)
                    
                    if hour_key not in weather_cache:
                        w_data = self.weather_svc.get_weather_for_timestamp(hour_key)
                        weather_cache[hour_key] = w_data
                    
                    w_entry = weather_cache.get(hour_key)
                    if w_entry:
                        weather_temp = w_entry.get('temp_c')
                        weather_hum = w_entry.get('humidity_rel')
                
                mold_factor = reading.get('mold_factor') or reading.get('mold_risk')
                if mold_factor is None and reading.get('humidity') is not None and reading.get('temp') is not None:
                    mold_factor = calculate_mold_factor_simple(
                        humidity_rel=reading.get('humidity'),
                        temp_c=reading.get('temp')
                    )
                
                record = {
                    'timestamp': ts.isoformat() if isinstance(ts, datetime) else ts,
                    'room_id': room_id,
                    'device_mac': device_mac,
                    'co2': reading.get('co2'),
                    'temp': reading.get('temp'),
                    'humidity': reading.get('humidity'),
                    'delta_co2': reading.get('delta_co2'),
                    'mold_factor': mold_factor,
                    'weather': {
                        'temp_c': weather_temp,
                        'humidity_rel': weather_hum
                    },
                    'lesson': {
                        'subject': reading.get('subject'),
                        'teacher': reading.get('teacher'),
                        'class_name': reading.get('class_name'),
                        'occupancy': occupancy_est
                    }
                }
                
                json_line = json.dumps(record) + '\n'
                yield json_line.encode('utf-8')
