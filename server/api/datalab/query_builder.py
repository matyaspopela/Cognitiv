from typing import Dict, Any, List
from datetime import datetime, timezone

try:
    from zoneinfo import ZoneInfo
except ImportError:
    from backports.zoneinfo import ZoneInfo

UTC = timezone.utc

class QueryBuilder:
    def build_pipeline(self, filters: Dict[str, Any], for_export: bool = False) -> List[Dict]:
        """
        Build MongoDB aggregation pipeline from filters.
        
        Args:
            filters: Dict with 'start', 'end', 'rooms' (optional)
            for_export: If True, returns raw buckets for streaming export.
                        If False, unwinds readings for preview with limit.
        
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
        
        # 3. Additional filters (teacher, subject, class, etc.)
        teacher = filters.get('teacher')
        if teacher:
            match_stage['readings.teacher'] = teacher
            
        subject = filters.get('subject')
        if subject:
            match_stage['readings.subject'] = subject
            
        class_name = filters.get('class_name')
        if class_name:
            match_stage['context.lesson.class_name'] = class_name
        
        lesson_of_day = filters.get('lesson_of_day')
        if lesson_of_day:
            match_stage['context.lesson.lesson_of_day'] = int(lesson_of_day)
        
        if for_export:
            # Export doesn't use bucketing to preserve full fidelity
            pipeline = [
                {'$match': match_stage},
                {'$sort': {'bucket_start': 1}},
            ]
        else:
            # Calculate granularity based on target resolution
            # User request: "count data point amount and based on the data point amount... be more precise"
            # We assume 1-minute density data.
            duration = end_dt - start_dt
            total_minutes = duration.total_seconds() / 60
            
            # Target ~2500 points for high-resolution 4k displays
            target_points = 2500
            
            # Calculate exact minutes needed per bucket to hit target
            minutes_per_bucket = total_minutes / target_points
            
            granularity = None

            if minutes_per_bucket <= 1.0:
                 # Less than 1 minute per pixel? No bucketing needed.
                 granularity = None
            elif minutes_per_bucket < 60:
                # Sub-hourly bucketing: Use exact calculated integer minutes
                # e.g. 5.2 -> 5 min bucket. 21.6 -> 21 min bucket.
                bin_size = int(minutes_per_bucket)
                if bin_size < 1: bin_size = 1
                granularity = {"unit": "minute", "binSize": bin_size}
            elif minutes_per_bucket < 1440:
                # Sub-daily bucketing: Use exact calculated integer hours
                # e.g. 64 min -> 1 hour. 300 min -> 5 hours.
                bin_size_hours = int(minutes_per_bucket / 60)
                if bin_size_hours < 1: bin_size_hours = 1
                granularity = {"unit": "hour", "binSize": bin_size_hours}
            else:
                 # Multi-day bucketing
                 bin_size_days = int(minutes_per_bucket / 1440)
                 if bin_size_days < 1: bin_size_days = 1
                 granularity = {"unit": "day", "binSize": bin_size_days}

            if granularity:
                # Apply bucketing pipeline
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
                        'occupancy': {'$max': '$context.lesson.estimated_occupancy'}
                    }},
                    {'$sort': {'_id.ts': 1}},
                    {'$project': {
                        '_id': 0,
                        'room_id': '$_id.room',
                        'readings': {
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
                        },
                        'context': {
                            'lesson': {
                                'estimated_occupancy': '$occupancy'
                            }
                        }
                    }}
                ]
            else:
                # Short Duration: Return raw 1-minute data
                pipeline = [
                    {'$match': match_stage},
                    {'$sort': {'bucket_start': 1}},
                    {'$unwind': '$readings'},
                    # Limit removed
                ]
        
        return pipeline

    def build_export_pipeline(self, filters: Dict[str, Any]) -> List[Dict]:
        """Convenience method for export pipeline."""
        return self.build_pipeline(filters, for_export=True)
    
    def build_preview_pipeline(self, filters: Dict[str, Any]) -> List[Dict]:
        """Convenience method for preview pipeline."""
        return self.build_pipeline(filters, for_export=False)