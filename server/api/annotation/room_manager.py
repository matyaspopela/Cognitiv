from typing import Optional, Dict, List
import os
import json
from datetime import datetime, timezone
from pymongo import MongoClient
import certifi

UTC = timezone.utc

# Path to annotation config JSON
ANNOTATION_CONFIG_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 
    'data', 
    'annotation_config.json'
)

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

    def get_room_parameters(self, room_id: str) -> Optional[Dict]:
        """
        Get physical parameters for a room.
        Returns dict with volume_m3, window_area_m2.
        """
        room = self.get_room(room_id)
        if not room:
            return None
        
        return {
            'volume_m3': room.get('volume_m3', 0.0),
            'window_area_m2': room.get('window_area_m2', 0.0),
        }

    def sync_parameters(self, config_path: str = None) -> int:
        """
        Load room parameters from JSON config file into MongoDB.
        
        Args:
            config_path: Path to JSON file. Defaults to annotation_config.json
            
        Returns:
            Number of rooms processed
        """
        if config_path is None:
            config_path = ANNOTATION_CONFIG_PATH
        
        if not os.path.exists(config_path):
            # Fallback for local testing if path differs
            alt_path = os.path.join('server', 'data', 'annotation_config.json')
            if os.path.exists(alt_path):
                config_path = alt_path
            else:
                raise FileNotFoundError(f"Annotation config not found: {config_path}")
        
        collection = self._get_collection()
        count = 0
        
        with open(config_path, 'r', encoding='utf-8') as f:
            config = json.load(f)
            room_params = config.get('room_parameters', [])
            
            for room in room_params:
                room_id = room.get('room_id', '').strip()
                if not room_id:
                    continue
                
                doc_update = {
                    '$set': {
                        'label': room.get('label', room_id),
                        'volume_m3': float(room.get('volume_m3', 0)),
                        'window_area_m2': float(room.get('window_area_m2', 0)),
                        'last_modified': datetime.now(UTC)
                    }
                }
                
                collection.update_one(
                    {'_id': room_id},
                    doc_update,
                    upsert=True
                )
                count += 1
        
        # Invalidate cache after sync
        self._cache.clear()
        return count

    def sync_config(self) -> int:
        """Legacy sync - now calls sync_parameters."""
        return self.sync_parameters()
