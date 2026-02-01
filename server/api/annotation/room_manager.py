from typing import Optional, Dict, List
import os
from datetime import datetime, timezone
import functools
from pymongo import MongoClient
import certifi
from django.conf import settings

# Import legacy config
from .room_config import VALID_ROOM_CODES, ROOM_CODE_LABELS

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

class RoomManager:
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(RoomManager, cls).__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return
            
        self._client = None
        self._collection = None
        self._cache = {}
        self._initialized = True

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
            self._collection = db['room_definitions']
        return self._collection

    def get_room(self, room_id: str) -> Optional[Dict]:
        """
        Get room metadata by ID.
        Uses in-memory cache to minimize DB hits.
        """
        if not room_id:
            return None
            
        # Check cache first
        if room_id in self._cache:
            return self._cache[room_id]

        collection = self._get_collection()
        room = collection.find_one({'_id': room_id})
        
        if room:
            self._cache[room_id] = room
            return room
            
        return None

    def sync_config(self) -> int:
        """
        Migrate room_config.py data to the database.
        Returns the number of rooms processed.
        """
        collection = self._get_collection()
        count = 0
        
        for code in VALID_ROOM_CODES:
            label = ROOM_CODE_LABELS.get(code, code.upper())
            
            # Default metadata structure
            doc = {
                '_id': code,
                'label': label,
                # Default physics placeholders - to be updated via UI later
                'volume_m3': 0.0,
                'window_area_m2': 0.0,
                'floor_area_m2': 0.0,
                'metadata': {},
                'last_modified': datetime.now(UTC)
            }
            
            # Upsert: Don't overwrite existing physics data if it exists
            # We use $setOnInsert for static fields and $set for updates if needed
            # But here we want to ensure the room exists.
            # If we use replace_one(upsert=True), we overwrite everything.
            # Let's use update_one with $set for basic info and $setOnInsert for physics
            
            update_result = collection.update_one(
                {'_id': code},
                {
                    '$set': {
                        'label': label,
                        'last_modified': datetime.now(UTC)
                    },
                    '$setOnInsert': {
                        'volume_m3': 100.0, # Default dummy volume
                        'window_area_m2': 0.0,
                        'floor_area_m2': 0.0,
                        'metadata': {}
                    }
                },
                upsert=True
            )
            count += 1
            
        # Invalidate cache after sync
        self._cache.clear()
        return count