"""
MongoDB Database Layer - Centralized connection management
Implements thread-safe Singleton pattern for MongoDB connections
"""

import os
import threading
from typing import Optional
from datetime import datetime, timezone
from pymongo import MongoClient, ASCENDING
from pymongo.collection import Collection
from pymongo.database import Database
from pymongo.errors import PyMongoError
import certifi
from urllib.parse import quote_plus, urlparse, urlunparse


class MongoManager:
    """
    Thread-safe Singleton for MongoDB connection management.
    Handles connection pooling, index management, and collection access.
    """
    
    _instance: Optional['MongoManager'] = None
    _lock = threading.Lock()
    
    def __init__(self):
        """Private constructor - use get_instance() instead"""
        if MongoManager._instance is not None:
            raise RuntimeError("Use MongoManager.get_instance() instead of direct instantiation")
        
        self._client: Optional[MongoClient] = None
        self._db: Optional[Database] = None
        self._initialized = False
        self._init_lock = threading.Lock()
    
    @classmethod
    def get_instance(cls) -> 'MongoManager':
        """Get singleton instance (thread-safe)"""
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = cls()
        return cls._instance
    
    def _get_mongo_uri(self) -> str:
        """Get and validate MongoDB URI from environment"""
        uri = os.getenv('MONGO_URI')
        
        # Load .env in development
        is_production = os.getenv('RENDER') is not None or os.getenv('RENDER_EXTERNAL_HOSTNAME') is not None
        
        if not is_production:
            try:
                from dotenv import load_dotenv
                from pathlib import Path
                env_path = Path(__file__).resolve().parent.parent.parent / '.env'
                if env_path.exists():
                    load_dotenv(env_path, override=True)
                    uri = os.getenv('MONGO_URI') or uri
            except ImportError:
                pass
        
        if not uri:
            raise RuntimeError("MONGO_URI environment variable must be set")
        
        # Clean and encode URI
        uri = uri.strip().rstrip('\n\r\t ')
        
        try:
            parsed = urlparse(uri)
            if parsed.username or parsed.password:
                username_encoded = quote_plus(parsed.username) if parsed.username else ''
                password_encoded = quote_plus(parsed.password) if parsed.password else ''
                
                netloc = f"{username_encoded}:{password_encoded}@{parsed.hostname}" if username_encoded else parsed.hostname
                if parsed.port:
                    netloc += f":{parsed.port}"
                
                uri = urlunparse((
                    parsed.scheme,
                    netloc,
                    parsed.path or '/',
                    parsed.params,
                    parsed.query,
                    parsed.fragment
                ))
        except Exception as e:
            print(f"[WARN] Could not parse MongoDB URI: {e}")
        
        return uri
    
    def _get_db_name(self) -> str:
        """Get database name based on environment"""
        is_dev_db = os.getenv('DEVELOPMENT_DB', 'false').lower() == 'true'
        db_name = 'cognitiv_dev' if is_dev_db else 'cognitiv'
        print(f"[INFO] Using database: {db_name}")
        return db_name
    
    def initialize(self) -> None:
        """Initialize MongoDB connection (idempotent, thread-safe)"""
        if self._initialized:
            return
        
        with self._init_lock:
            if self._initialized:
                return
            
            mongo_uri = self._get_mongo_uri()
            db_name = self._get_db_name()
            
            # Connection pool configuration
            max_pool_size = int(os.getenv('MONGO_MAX_POOL_SIZE', '50'))
            min_pool_size = int(os.getenv('MONGO_MIN_POOL_SIZE', '10'))
            
            print(f"[INFO] Initializing MongoDB connection (pool: {min_pool_size}-{max_pool_size})")
            
            try:
                self._client = MongoClient(
                    mongo_uri,
                    maxPoolSize=max_pool_size,
                    minPoolSize=min_pool_size,
                    serverSelectionTimeoutMS=10000,
                    tlsCAFile=certifi.where(),
                    tz_aware=True,
                    tzinfo=timezone.utc,
                    retryWrites=True,
                    retryReads=True,
                )
                
                # Test connection
                self._client.admin.command('ping')
                self._db = self._client[db_name]
                
                # Apply indexes
                self._ensure_indexes()
                
                self._initialized = True
                print(f"[OK] MongoDB connected: {db_name}")
                
            except Exception as e:
                print(f"[ERROR] MongoDB initialization failed: {e}")
                self._provide_connection_hints(str(e))
                raise
    
    def _ensure_indexes(self) -> None:
        """Create required indexes on all collections"""
        try:
            # Sensor data collection
            data_collection_name = os.getenv('MONGO_COLLECTION', 'sensor_data_')
            data_col = self._db[data_collection_name]
            
            # Check if timeseries
            collection_info = self._db.command('listCollections', filter={'name': data_collection_name})
            is_timeseries = any('timeseries' in info.get('options', {}) 
                              for info in collection_info['cursor']['firstBatch'])
            
            if is_timeseries:
                data_col.create_index([('metadata.device_id', ASCENDING)])
                data_col.create_index([('metadata.mac_address', ASCENDING)])
            else:
                data_col.create_index([('device_id', ASCENDING), ('timestamp', ASCENDING)])
                data_col.create_index([('mac_address', ASCENDING), ('timestamp', ASCENDING)], sparse=True)
            
            # Device registry
            registry = self._db['device_registry']
            registry.create_index([('mac_address', ASCENDING)], unique=True)
            registry.create_index([('display_name', ASCENDING)])
            registry.create_index([('last_data_received', ASCENDING)])
            registry.create_index([('whitelisted', ASCENDING)])
            
            # Settings
            settings = self._db['settings']
            settings.create_index([('key', ASCENDING)], unique=True)
            
            # Initialize default settings
            settings.update_one(
                {'key': 'whitelist_enabled'},
                {'$setOnInsert': {'key': 'whitelist_enabled', 'value': False, 'updated_at': datetime.now(timezone.utc)}},
                upsert=True
            )
            
            print("[OK] Indexes created/verified")
            
        except Exception as e:
            print(f"[WARN] Index creation issue: {e}")
    
    def _provide_connection_hints(self, error_msg: str) -> None:
        """Provide helpful error messages for common connection issues"""
        error_lower = error_msg.lower()
        
        if 'authentication failed' in error_lower or 'bad auth' in error_lower:
            print("⚠️  MongoDB Authentication Error:")
            print("   - Verify username and password in MONGO_URI")
            print("   - Ensure special characters are URL-encoded")
            print("   - Check user permissions in MongoDB Atlas")
        elif 'enotfound' in error_lower or 'querysrv' in error_lower or 'dns' in error_lower:
            print("⚠️  MongoDB DNS/SRV Lookup Error:")
            print("   - Verify cluster name in connection string")
            print("   - Check network connectivity")
        elif 'server selection timeout' in error_lower:
            print("⚠️  MongoDB Connection Timeout:")
            print("   - Check IP whitelist in MongoDB Atlas")
            print("   - Verify network connectivity")
    
    def get_collection(self, name: str) -> Collection:
        """Get a collection by name (initializes connection if needed)"""
        if not self._initialized:
            self.initialize()
        return self._db[name]
    
    def get_database(self) -> Database:
        """Get the database instance"""
        if not self._initialized:
            self.initialize()
        return self._db
    
    def close(self) -> None:
        """Close MongoDB connection (for cleanup)"""
        if self._client:
            self._client.close()
            self._initialized = False
            print("[INFO] MongoDB connection closed")


# Convenience functions for backward compatibility
def get_mongo_collection() -> Collection:
    """Get the main sensor data collection"""
    collection_name = os.getenv('MONGO_COLLECTION', 'sensor_data_')
    return MongoManager.get_instance().get_collection(collection_name)


def get_registry_collection() -> Collection:
    """Get the device registry collection"""
    return MongoManager.get_instance().get_collection('device_registry')


def get_settings_collection() -> Collection:
    """Get the settings collection"""
    return MongoManager.get_instance().get_collection('settings')
