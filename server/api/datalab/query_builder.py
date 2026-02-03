from typing import Dict, Any, List
from datetime import datetime, timezone

try:
    from zoneinfo import ZoneInfo
except ImportError:
    from backports.zoneinfo import ZoneInfo

UTC = timezone.utc

class QueryBuilder:
    def build_pipeline(self, filters: Dict[str, Any], bucketing: str = None) -> List[Dict]:
        """
        Build MongoDB aggregation pipeline from filters.
        
        Args:
            filters: Dict with 'start', 'end', 'rooms' (optional)
            bucketing: Aggregation interval ('15m', '1h', '1d'). If None, returns raw data.
        
        Returns:
            MongoDB aggregation pipeline
        """
        match_stage = {}
        
        # 1. Date Range - filter on bucket_start
        start_str = filters.get('start')
        end_str = filters.get('end')
        
        if not start_str or not end_str:
            raise ValueError("Start and End dates are required")
            
        try:
            start_dt = datetime.fromisoformat(str(start_str)).replace(tzinfo=UTC)
            end_dt = datetime.fromisoformat(str(end_str)).replace(hour=23, minute=59, second=59, tzinfo=UTC)
        except ValueError:
             raise ValueError("Invalid date format")

        match_stage['bucket_start'] = {
            '$gte': start_dt,
            '$lte': end_dt
        }
        
        # 2. Rooms filter
        rooms = filters.get('rooms')
        if rooms and len(rooms) > 0:
            if not isinstance(rooms, list):
                raise ValueError("Rooms must be a list of strings")
            
            # Validate contents are strings
            for r in rooms:
                if not isinstance(r, str):
                    raise ValueError("Room IDs must be strings")
            
            match_stage['room_id'] = {'$in': rooms}
            
        # Determine granularity
        granularity = None
        if bucketing == '15m':
            granularity = {"unit": "minute", "binSize": 15}
        elif bucketing == '1h':
            granularity = {"unit": "hour", "binSize": 1}
        elif bucketing == '1d':
            granularity = {"unit": "day", "binSize": 1}
        
        if not granularity:
            # Raw Data Export
            pipeline = [
                {'$match': match_stage},
                {'$sort': {'bucket_start': 1}},
            ]
        else:
            # Aggregated Export
            pipeline = [
                {'$match': match_stage},
                {'$unwind': '$readings'},
                {'$group': {
                    '_id': {
                        'room': '$room_id',
                        'ts': {
                            '$dateTrunc': {
                                'date': '$readings.ts',
                                'unit': granularity['unit'],
                                'binSize': granularity['binSize']
                            }
                        }
                    },
                    # Numeric averages
                    'avg_co2': {'$avg': '$readings.co2'},
                    'avg_temp': {'$avg': '$readings.temp'},
                    'avg_humidity': {'$avg': '$readings.humidity'},
                    'avg_mold': {'$avg': '$readings.mold_factor'},
                    'avg_delta': {'$avg': '$readings.delta_co2'},
                    
                    # Metadata (take first/max)
                    'subject': {'$first': '$readings.subject'},
                    'teacher': {'$first': '$readings.teacher'},
                    'class_name': {'$first': '$readings.class_name'},
                    'is_lesson': {'$max': '$readings.is_lesson'},
                    'occupancy': {'$max': '$context.lesson.estimated_occupancy'},
                    'device_mac': {'$first': '$device_mac'}
                }},
                {'$sort': {'_id.ts': 1}},
                {'$project': {
                    '_id': 0,
                    'room_id': '$_id.room',
                    'device_mac': '$device_mac',
                    'readings': [{ # Wrap in list to match raw format
                        'ts': '$_id.ts',
                        'co2': '$avg_co2',
                        'temp': '$avg_temp',
                        'humidity': '$avg_humidity',
                        'mold_factor': '$avg_mold',
                        'delta_co2': '$avg_delta',
                        'subject': '$subject',
                        'teacher': '$teacher',
                        'class_name': '$class_name',
                        'is_lesson': '$is_lesson'
                    }],
                    'context': {
                        'lesson': {
                            'estimated_occupancy': '$occupancy'
                        }
                    }
                }}
            ]
        
        return pipeline

    def build_export_pipeline(self, filters: Dict[str, Any], bucketing: str = None) -> List[Dict]:
        """Convenience method for export pipeline."""
        return self.build_pipeline(filters, bucketing=bucketing)
    
    def build_preview_pipeline(self, filters: Dict[str, Any], bucketing: str = None) -> List[Dict]:
        """Convenience method for preview pipeline."""
        return self.build_pipeline(filters, bucketing=bucketing)