import os
import requests
from datetime import datetime, date, timedelta, timezone
from typing import Optional, Dict, List
from pymongo import MongoClient
import certifi

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

class WeatherService:
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(WeatherService, cls).__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return
            
        self._client = None
        self._collection = None
        self._initialized = True
        
        # Default to Brno coordinates if not set
        self.lat = float(os.getenv('SCHOOL_LAT', '49.1951'))
        self.lon = float(os.getenv('SCHOOL_LON', '16.6068'))

    def _get_collection(self):
        """Lazy initialization of MongoDB collection."""
        if self._collection is None:
            self._client = MongoClient(
                get_mongo_uri(),
                serverSelectionTimeoutMS=5000,
                tlsCAFile=certifi.where(),
                tz_aware=True,
                tzinfo=UTC,
            )
            db = self._client[get_mongo_db_name()]
            self._collection = db['weather_history']
            
            # Create index
            try:
                self._collection.create_index([('timestamp', 1)], unique=True)
            except Exception as e:
                print(f"Warning: Failed to create weather index: {e}")
                
        return self._collection

    def fetch_historical_weather(self, start_date: date, end_date: date) -> int:
        """
        Fetch weather data from Open-Meteo Archive API and save to DB.
        
        Args:
            start_date: Start date (inclusive)
            end_date: End date (inclusive)
            
        Returns:
            Number of records inserted/updated
        """
        url = "https://archive-api.open-meteo.com/v1/archive"
        params = {
            "latitude": self.lat,
            "longitude": self.lon,
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "hourly": ["temperature_2m", "relative_humidity_2m", "weather_code"],
            "timezone": "UTC"
        }
        
        try:
            response = requests.get(url, params=params, timeout=10)
            response.raise_for_status()
            data = response.json()
        except Exception as e:
            print(f"Error fetching weather data: {e}")
            return 0
            
        hourly = data.get('hourly', {})
        times = hourly.get('time', [])
        temps = hourly.get('temperature_2m', [])
        humidities = hourly.get('relative_humidity_2m', [])
        codes = hourly.get('weather_code', [])
        
        collection = self._get_collection()
        count = 0
        
        for i, time_str in enumerate(times):
            # Open-Meteo returns ISO string "YYYY-MM-DDTHH:MM" (no seconds, no Z if UTC requested?)
            # Actually with timezone=UTC it behaves predictably.
            try:
                # Append Z if missing to ensure fromisoformat treats as UTC or aware
                if not time_str.endswith('Z') and not '+' in time_str:
                    time_str += 'Z'
                
                dt = datetime.fromisoformat(time_str).replace(tzinfo=UTC)
                
                doc = {
                    'timestamp': dt,
                    'temp_c': temps[i],
                    'humidity_rel': humidities[i],
                    'condition_code': codes[i],
                    'source': 'open-meteo'
                }
                
                collection.replace_one(
                    {'timestamp': dt},
                    doc,
                    upsert=True
                )
                count += 1
            except Exception as e:
                print(f"Error processing weather entry {time_str}: {e}")
                
        return count

    def get_weather_for_timestamp(self, timestamp: datetime) -> Optional[Dict]:
        """
        Get weather data for a specific timestamp.
        Rounds to the nearest hour (or floor).
        
        Args:
            timestamp: Timezone-aware datetime
            
        Returns:
            Dict with weather data or None
        """
        if not timestamp:
            return None
            
        # Ensure UTC
        if timestamp.tzinfo is None:
            timestamp = timestamp.replace(tzinfo=UTC)
        else:
            timestamp = timestamp.astimezone(UTC)
            
        # Round down to hour (Open-Meteo uses hourly slots)
        hour_start = timestamp.replace(minute=0, second=0, microsecond=0)
        
        collection = self._get_collection()
        return collection.find_one({'timestamp': hour_start})