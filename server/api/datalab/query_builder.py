from typing import Dict, Any, List
from datetime import datetime, timezone

try:
    from zoneinfo import ZoneInfo
except ImportError:
    from backports.zoneinfo import ZoneInfo

UTC = timezone.utc

class QueryBuilder:
    def build_pipeline(self, filters: Dict[str, Any]) -> List[Dict]:
        """
        Build MongoDB aggregation pipeline from filters.
        Queries annotated_readings buckets and unwinds readings array.
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
            
        # Pipeline: Match buckets, then unwind readings array
        pipeline = [
            {'$match': match_stage},
            {'$sort': {'bucket_start': 1}},
            # Unwind the readings array to get individual data points
            {'$unwind': '$readings'},
            # Limit total readings to prevent excessive data
            {'$limit': 2000},
        ]
        
        return pipeline