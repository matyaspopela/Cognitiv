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
        
        # Build pipeline based on use case
        if for_export:
            # Export: Return raw buckets with readings arrays (no unwind, no limit)
            pipeline = [
                {'$match': match_stage},
                {'$sort': {'bucket_start': 1}},
            ]
        else:
            # Preview: Unwind readings and limit for UI display
            pipeline = [
                {'$match': match_stage},
                {'$sort': {'bucket_start': 1}},
                # Unwind the readings array to get individual data points
                {'$unwind': '$readings'},
                # Limit total readings to prevent excessive data
                {'$limit': 2000},
            ]
        
        return pipeline
    
    def build_export_pipeline(self, filters: Dict[str, Any]) -> List[Dict]:
        """Convenience method for export pipeline."""
        return self.build_pipeline(filters, for_export=True)
    
    def build_preview_pipeline(self, filters: Dict[str, Any]) -> List[Dict]:
        """Convenience method for preview pipeline."""
        return self.build_pipeline(filters, for_export=False)