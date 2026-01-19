"""
Timetable fetcher for BakalAPI integration.
Fetches timetable data from BakalAPI with in-memory caching per annotation run.
"""

import os
from datetime import datetime, date, timedelta, timezone
from typing import Optional, List, Dict, Any

try:
    from zoneinfo import ZoneInfo
except ImportError:
    from backports.zoneinfo import ZoneInfo

# BakalAPI client
try:
    from bakalapi import BakalapiClient, TimetableResponse, TimetableEntry, Hour
except ImportError:
    print("⚠️  bakalapi package not installed. Run: pip install bakalapi")
    BakalapiClient = None
    TimetableResponse = None
    TimetableEntry = None
    Hour = None


UTC = timezone.utc
LOCAL_TZ = ZoneInfo(os.getenv('LOCAL_TIMEZONE', 'Europe/Prague'))


class DailyTimetableFetcher:
    """
    Fetches timetables from BakalAPI with in-memory caching.
    Cache is valid only for the duration of a single annotation run.
    Timetables are fetched fresh from BakalAPI each day.
    """
    
    def __init__(self):
        self.client = None
        # In-memory cache: key = (room_code, date_str), value = timetable dict
        self._cache: Dict[tuple, Dict] = {}
    
    def _get_client(self) -> Optional[Any]:
        """Get or create BakalAPI client."""
        if BakalapiClient is None:
            print("⚠️  BakalAPI client not available")
            return None
        
        if self.client is None:
            self.client = BakalapiClient()
        return self.client
    
    def _close_client(self):
        """Close the BakalAPI client."""
        if self.client is not None:
            try:
                self.client.close()
            except:
                pass
            self.client = None
    
    def clear_cache(self):
        """Clear the in-memory cache. Called at the start of each annotation run."""
        self._cache.clear()
        print("✓ Timetable cache cleared")
    
    def fetch_for_room(self, room_code: str, target_date: date) -> Optional[Dict]:
        """
        Fetch timetable for a specific room and date.
        Uses in-memory cache if available, otherwise fetches from BakalAPI.
        
        Args:
            room_code: Room identifier (e.g., "a1", "b3")
            target_date: The date to get timetable for
        
        Returns:
            Dict with timetable data or None if not found
        """
        date_str = target_date.isoformat()
        cache_key = (room_code, date_str)
        
        # Check in-memory cache first
        if cache_key in self._cache:
            print(f"✓ Using cached timetable for {room_code} on {date_str}")
            return self._cache[cache_key]
        
        # Fetch from BakalAPI
        print(f"📡 Fetching timetable for {room_code} from BakalAPI...")
        client = self._get_client()
        if client is None:
            return None
        
        try:
            response = client.get_room_timetable(room_code)
            
            # Convert to storable format
            hours_data = []
            if response.hours:
                for hour in response.hours:
                    hours_data.append({
                        'number': hour.number,
                        'start_time': hour.start_time,
                        'end_time': hour.end_time
                    })
            
            entries_data = []
            if response.timetable:
                for entry in response.timetable:
                    entries_data.append({
                        'day': entry.day,
                        'date': entry.date,
                        'hour_number': entry.hour_number,
                        'time': entry.time,
                        'subject': entry.subject,
                        'teacher': entry.teacher,
                        'room': entry.room,
                        'class_name': entry.class_name,
                        'theme': getattr(entry, 'theme', None),
                        'changeinfo': getattr(entry, 'changeinfo', None),
                    })
            
            # Store in in-memory cache
            document = {
                'room_code': room_code,
                'date': date_str,
                'hours': hours_data,
                'entries': entries_data,
                'fetched_at': datetime.now(UTC)
            }
            
            self._cache[cache_key] = document
            print(f"✓ Cached timetable for {room_code} on {date_str} ({len(entries_data)} entries)")
            
            return document
            
        except Exception as e:
            print(f"✗ Failed to fetch timetable for {room_code}: {e}")
            return None
    
    def get_lesson_at(
        self,
        room_code: str,
        timestamp: datetime,
        timetable: Optional[Dict] = None
    ) -> Optional[Dict]:
        """
        Find the lesson occurring at a specific timestamp.
        
        Args:
            room_code: Room identifier
            timestamp: The timestamp to check (should be timezone-aware)
            timetable: Optional pre-fetched timetable data
        
        Returns:
            Dict with lesson info or None if no lesson at that time
        """
        if timetable is None:
            target_date = timestamp.astimezone(LOCAL_TZ).date()
            timetable = self.fetch_for_room(room_code, target_date)
        
        if timetable is None or not timetable.get('entries'):
            return None
        
        # Convert timestamp to local time
        local_time = timestamp.astimezone(LOCAL_TZ)
        local_date = local_time.date()
        local_time_only = local_time.time()
        
        # Build hour lookup
        hours_lookup = {}
        for hour in timetable.get('hours', []):
            hours_lookup[hour['number']] = hour
        
        # Find matching entry
        for entry in timetable.get('entries', []):
            # Parse entry date (format: "12.1." or "12.1.2026")
            entry_date = self._parse_entry_date(entry.get('date', ''), local_date.year)
            if entry_date != local_date:
                continue
            
            # Check time
            hour_num = entry.get('hour_number')
            hour_def = hours_lookup.get(hour_num)
            if hour_def is None:
                continue
            
            start_time = self._parse_time(hour_def.get('start_time', ''))
            end_time = self._parse_time(hour_def.get('end_time', ''))
            
            if start_time and end_time:
                if start_time <= local_time_only <= end_time:
                    return {
                        'subject': entry.get('subject'),
                        'teacher': entry.get('teacher'),
                        'lesson_number': hour_num,
                        'class_name': entry.get('class_name'),
                        'is_lesson': True
                    }
        
        return None
    
    def _parse_entry_date(self, date_str: str, year: int) -> Optional[date]:
        """Parse date string like '12.1.' or '12.1.2026' to date object."""
        if not date_str:
            return None
        
        try:
            parts = date_str.strip('.').split('.')
            if len(parts) >= 2:
                day = int(parts[0])
                month = int(parts[1])
                if len(parts) >= 3 and parts[2]:
                    year = int(parts[2])
                return date(year, month, day)
        except (ValueError, IndexError):
            pass
        
        return None
    
    def _parse_time(self, time_str: str) -> Optional[Any]:
        """Parse time string like '8:00' to time object."""
        if not time_str:
            return None
        
        try:
            from datetime import time as dt_time
            parts = time_str.split(':')
            hour = int(parts[0])
            minute = int(parts[1]) if len(parts) > 1 else 0
            return dt_time(hour, minute)
        except (ValueError, IndexError):
            return None


# Singleton instance
_fetcher_instance = None


def get_timetable_fetcher() -> DailyTimetableFetcher:
    """Get the singleton timetable fetcher instance."""
    global _fetcher_instance
    if _fetcher_instance is None:
        _fetcher_instance = DailyTimetableFetcher()
    return _fetcher_instance
