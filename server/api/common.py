"""
Shared MongoDB connection and utility functions for the API.
Extracted from views.py to avoid duplication and circular imports.
"""

import os
from datetime import datetime, timezone
from urllib.parse import quote_plus, urlparse, urlunparse
from pathlib import Path
from pymongo import MongoClient, ASCENDING
import certifi

try:
    from zoneinfo import ZoneInfo
except ImportError:  # Python < 3.9 fallback
    from backports.zoneinfo import ZoneInfo


# Constants
LOCAL_TIMEZONE = os.getenv('LOCAL_TIMEZONE', 'Europe/Prague')
UTC = timezone.utc


def resolve_local_timezone():
    """Resolve the local timezone from environment or fallback to system/UTC."""
    try:
        return ZoneInfo(LOCAL_TIMEZONE)
    except Exception:
        fallback_tz = datetime.now().astimezone().tzinfo
        if fallback_tz is not None:
            print(
                f"⚠️  Nepodařilo se načíst časovou zónu '{LOCAL_TIMEZONE}'. "
                f"Používám systémovou časovou zónu {fallback_tz}."
            )
            return fallback_tz
        print(
            f"⚠️  Nepodařilo se načíst časovou zónu '{LOCAL_TIMEZONE}'. "
            "Používám UTC."
        )
        return ZoneInfo('UTC')


LOCAL_TZ = resolve_local_timezone()


def get_mongo_uri():
    """Get MONGO_URI from environment, ensuring .env is loaded first and properly formatted"""
    uri = os.getenv('MONGO_URI')
    
    # Only load .env files in local development (NOT in production on Render)
    is_production = os.getenv('RENDER') is not None or os.getenv('RENDER_EXTERNAL_HOSTNAME') is not None
    
    if not is_production:
        try:
            from dotenv import load_dotenv
            env_path = Path(__file__).resolve().parent.parent.parent / '.env'
            if env_path.exists():
                load_dotenv(env_path, override=True)
                uri = os.getenv('MONGO_URI') or uri
                print(f"[DEBUG] Loaded MONGO_URI from {env_path}")
            else:
                print(f"[DEBUG] .env file not found at {env_path}")
        except ImportError:
            pass
        except Exception as e:
            print(f"[WARN] Error loading .env file: {e}")
    else:
        print(f"[DEBUG] Production environment (Render). Using MONGO_URI from Render environment variables only.")
    
    if not uri:
        return None
    
    # Clean up common issues with connection strings
    uri = uri.strip().rstrip('\n\r\t ')
    
    # Parse and reconstruct URI to ensure proper encoding
    try:
        parsed = urlparse(uri)
        
        if parsed.username or parsed.password:
            username_encoded = quote_plus(parsed.username) if parsed.username else ''
            password_encoded = quote_plus(parsed.password) if parsed.password else ''
            
            if username_encoded:
                netloc = f"{username_encoded}:{password_encoded}@{parsed.hostname}"
            else:
                netloc = parsed.hostname
                
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
        else:
            netloc = parsed.hostname or ''
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
        
        if uri.startswith('mongodb+srv://'):
            if not parsed.query:
                if not parsed.path or parsed.path == '/':
                    if not uri.endswith('/'):
                        uri = uri.rstrip('/') + '/'
        
    except Exception as e:
        print(f"[WARN] Could not parse MongoDB URI: {e}")
        print(f"[WARN] Using URI as-is with basic cleanup")
        if uri.startswith('mongodb+srv://') and not uri.endswith('/') and '?' not in uri:
            uri = uri + '/'
    
    return uri


def get_mongo_db_name():
    """Get MongoDB database name based on DEVELOPMENT_DB environment variable."""
    is_dev_db = os.getenv('DEVELOPMENT_DB', 'false').lower() == 'true'
    
    if is_dev_db:
        db_name = 'cognitiv_dev'
        print(f"[INFO] Using DEVELOPMENT database: {db_name}")
    else:
        db_name = 'cognitiv'
        print(f"[INFO] Using PRODUCTION database: {db_name}")
        
    return db_name


def get_mongo_collection_name():
    """Get MongoDB collection name from environment."""
    return os.getenv('MONGO_COLLECTION', 'sensor_data_')


# Lazy MongoDB connection initialization
_mongo_collection = None
_registry_collection = None
_settings_collection = None


def get_mongo_collection():
    """Get MongoDB collection, initializing if necessary"""
    global _mongo_collection
    if _mongo_collection is None:
        try:
            mongo_uri = get_mongo_uri()
            mongo_db_name = get_mongo_db_name()
            mongo_collection_name = get_mongo_collection_name()
            
            if not mongo_uri:
                raise RuntimeError("MONGO_URI must be set")
            
            client = MongoClient(
                mongo_uri,
                serverSelectionTimeoutMS=10000,
                tlsCAFile=certifi.where(),
                tz_aware=True,
                tzinfo=UTC,
                retryWrites=True,
                retryReads=True,
            )
            client.admin.command('ping')
            db = client[mongo_db_name]
            collection = db[mongo_collection_name]
            
            # Check if this is a timeseries collection
            collection_info = db.command('listCollections', filter={'name': mongo_collection_name})
            is_timeseries = False
            for info in collection_info['cursor']['firstBatch']:
                if 'timeseries' in info.get('options', {}):
                    is_timeseries = True
                    break
            
            # Create indexes
            try:
                if is_timeseries:
                    collection.create_index([('metadata.device_id', ASCENDING)])
                    collection.create_index([('metadata.mac_address', ASCENDING)])
                else:
                    collection.create_index([('device_id', ASCENDING), ('timestamp', ASCENDING)])
                    try:
                        collection.create_index([('mac_address', ASCENDING), ('timestamp', ASCENDING)], sparse=True)
                    except Exception:
                        pass
            except Exception as idx_err:
                print(f"[INFO] Index creation note: {idx_err}")
            
            collection_type = "timeseries" if is_timeseries else "regular"
            print(f"Připojeno k MongoDB. Databáze: {mongo_db_name}, kolekce: {mongo_collection_name} ({collection_type})")
            _mongo_collection = collection
        except Exception as e:
            print(f"✗ Chyba při inicializaci MongoDB: {e}")
            raise RuntimeError(f"Nepodařilo se připojit k MongoDB: {str(e)}")
    return _mongo_collection


def get_registry_collection():
    """Get device registry collection, initializing if necessary"""
    global _registry_collection
    if _registry_collection is None:
        try:
            mongo_uri = get_mongo_uri()
            mongo_db_name = get_mongo_db_name()
            
            if not mongo_uri:
                print("✗ MONGO_URI not set, cannot initialize device registry")
                return None
                
            client = MongoClient(
                mongo_uri,
                serverSelectionTimeoutMS=5000,
                tlsCAFile=certifi.where(),
                tz_aware=True,
                tzinfo=UTC,
                retryWrites=True,
                retryReads=True,
            )
            client.admin.command('ping')
            db = client[mongo_db_name]
            _registry_collection = db['device_registry']
            
            # Create indexes
            _registry_collection.create_index(
                [('mac_address', ASCENDING)], 
                unique=True
            )
            _registry_collection.create_index([('display_name', ASCENDING)])
            _registry_collection.create_index([('last_data_received', ASCENDING)])
            _registry_collection.create_index([('whitelisted', ASCENDING)])
            
            print(f"Device registry collection initialized")
        except Exception as err:
            print(f"✗ Failed to initialize device registry: {err}")
            raise
    return _registry_collection


def normalize_mac_address(mac):
    """
    Normalize MAC address to uppercase colon-separated format.
    
    Args:
        mac: MAC address in any format (string, lowercase, hyphens, etc.)
    
    Returns:
        Normalized MAC address: "AA:BB:CC:DD:EE:FF"
    
    Raises:
        ValueError: If MAC address is invalid
    """
    if not mac:
        raise ValueError("MAC address is required")
    
    mac_str = str(mac).strip().upper()
    mac_clean = ''.join(c for c in mac_str if c.isalnum())
    
    if len(mac_clean) != 12:
        raise ValueError(f"Invalid MAC address length: expected 12 hex characters, got {len(mac_clean)}")
    
    try:
        int(mac_clean, 16)
    except ValueError:
        raise ValueError(f"Invalid hexadecimal MAC address: {mac_clean}")
    
    return ':'.join(mac_clean[i:i+2] for i in range(0, 12, 2))


def resolve_device_identifier(device_identifier):
    """
    Resolve device identifier to MAC address.
    
    The identifier can be:
    - A device_id (legacy)
    - A MAC address (new system)
    - A display_name (looked up in registry)
    
    Returns:
        MAC address string, or None if not found
    """
    if not device_identifier:
        return None
    
    device_identifier = str(device_identifier).strip()
    
    # Try to normalize as MAC address first
    try:
        mac_normalized = normalize_mac_address(device_identifier)
        return mac_normalized
    except ValueError:
        pass
    
    # Check if it's a display_name in the registry
    try:
        registry = get_registry_collection()
        entry = registry.find_one({'display_name': device_identifier})
        if entry and entry.get('mac_address'):
            return entry.get('mac_address')
    except Exception:
        pass
    
    # Check if it's a legacy_device_id in the registry
    try:
        registry = get_registry_collection()
        entry = registry.find_one({'legacy_device_id': device_identifier})
        if entry and entry.get('mac_address'):
            return entry.get('mac_address')
    except Exception:
        pass
    
    return None


def to_local_datetime(value):
    """Convert datetime to local timezone."""
    if not value:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=UTC)
    return value.astimezone(LOCAL_TZ)


def parse_iso_datetime(value, default=None):
    """Parse ISO8601 string to timezone-aware datetime."""
    if not value:
        return default
    try:
        if isinstance(value, str):
            sanitized = value.strip()
            if not sanitized:
                return default
            if sanitized.endswith('Z'):
                sanitized = sanitized[:-1] + '+00:00'
            dt = datetime.fromisoformat(sanitized)
        elif isinstance(value, datetime):
            dt = value
        else:
            raise ValueError(f"Unexpected data type: {type(value)}")
        
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=LOCAL_TZ)
        return dt.astimezone(UTC)
    except ValueError as e:
        raise ValueError(
            f"Invalid date format: '{value}'. Use ISO 8601, e.g. 2024-01-31T12:00:00. Error: {str(e)}"
        )
    except Exception as e:
        raise ValueError(
            f"Error parsing date '{value}': {str(e)}"
        )
