"""
IoT Environmental Monitoring System - Django Views
Receives data from ESP32, stores in MongoDB, and serves dashboard
"""

import os
import json
import csv
import re
from datetime import datetime, timedelta, timezone
from urllib.parse import quote_plus, urlparse, urlunparse, parse_qs, urlencode
from django.http import JsonResponse, HttpResponse, Http404
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.conf import settings
from pathlib import Path
from pymongo import MongoClient, ASCENDING
from pymongo.errors import PyMongoError
import certifi

try:
    from zoneinfo import ZoneInfo
except ImportError:  # Python < 3.9 fallback
    from backports.zoneinfo import ZoneInfo

from board_manager import (
    summarize_logs,
    ConfigWriteError,
    BoardManagerError,
    upload_firmware,
)

# Configuration - Use functions to read env vars lazily (after .env is loaded)
def get_mongo_uri():
    """Get MONGO_URI from environment, ensuring .env is loaded first and properly formatted"""
    uri = os.getenv('MONGO_URI')
    
    # Only load .env files in local development (NOT in production on Render)
    # In production, use only environment variables set by Render
    is_production = os.getenv('RENDER') is not None or os.getenv('RENDER_EXTERNAL_HOSTNAME') is not None
    
    if not is_production:
        # Always try to load .env from project root (in case it wasn't loaded in settings.py)
        # Use override=True to ensure .env values take precedence for local development
        try:
            from dotenv import load_dotenv
            from pathlib import Path
            # Calculate path to root .env file: server/api/views.py -> root/.env
            env_path = Path(__file__).resolve().parent.parent.parent / '.env'
            if env_path.exists():
                load_dotenv(env_path, override=True)
                # Re-read after loading
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
    uri = uri.strip()
    # Remove trailing whitespace or newlines
    uri = uri.rstrip('\n\r\t ')
    
    # Parse and reconstruct URI to ensure proper encoding
    try:
        # Handle credentials that might not be properly encoded
        # MongoDB URI format: mongodb[+srv]://[username:password@]host[:port][/database][?options]
        parsed = urlparse(uri)
        
        # If the URI has credentials, ensure they're properly encoded
        if parsed.username or parsed.password:
            # Username and password from urlparse are already URL-decoded
            # Re-encode them properly using quote_plus to handle special characters
            # This ensures passwords with special chars like @, #, /, etc. are correctly encoded
            username_encoded = quote_plus(parsed.username) if parsed.username else ''
            password_encoded = quote_plus(parsed.password) if parsed.password else ''
            
            # Reconstruct netloc with properly encoded credentials
            if username_encoded:
                netloc = f"{username_encoded}:{password_encoded}@{parsed.hostname}"
            else:
                netloc = parsed.hostname
                
            if parsed.port:
                netloc += f":{parsed.port}"
            
            # Reconstruct URI with encoded credentials
            uri = urlunparse((
                parsed.scheme,
                netloc,
                parsed.path or '/',
                parsed.params,
                parsed.query,
                parsed.fragment
            ))
        else:
            # No credentials, just ensure netloc is correct
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
        
        # Ensure it ends with / if it's a mongodb+srv:// connection and no path/query
        if uri.startswith('mongodb+srv://'):
            # Only add trailing slash if there's no path or path is just '/', and no query string
            if not parsed.query:
                if not parsed.path or parsed.path == '/':
                    if not uri.endswith('/'):
                        uri = uri.rstrip('/') + '/'
        
    except Exception as e:
        # If parsing fails, use original URI with basic cleanup
        # This might happen if the URI format is unusual
        print(f"[WARN] Could not parse MongoDB URI: {e}")
        print(f"[WARN] Using URI as-is with basic cleanup")
        if uri.startswith('mongodb+srv://') and not uri.endswith('/') and '?' not in uri:
            uri = uri + '/'
    
    return uri

def get_mongo_db_name():
    """Get MongoDB database name, automatically appending '_dev' in local development if using production MongoDB"""
    base_db_name = os.getenv('MONGO_DB_NAME', 'cognitiv')
    
    # If in local development and connecting to production MongoDB, use dev database
    # If in local development and connecting to production MongoDB, use dev database
    is_production = os.getenv('RENDER') is not None or os.getenv('RENDER_EXTERNAL_HOSTNAME') is not None
    
    # USER REQUEST: Allow dev server to access production DB
    # Auto-appending _dev is disabled to allow viewing production data
    if not is_production:
        mongo_uri = get_mongo_uri()
        if mongo_uri:
            # Check if MongoDB URI points to production cluster (MongoDB Atlas)
            is_production_mongo = '.mongodb.net' in mongo_uri or mongo_uri.startswith('mongodb+srv://')
            is_local_mongo = mongo_uri.startswith('mongodb://localhost') or mongo_uri.startswith('mongodb://127.0.0.1')
            
            if is_production_mongo and not is_local_mongo:
                 print(f"[INFO] Local development detected with production MongoDB.")
                 print(f"[INFO] Using database: {base_db_name}")
                 print(f"[WARN] CAUTION: You are connected to the PRODUCTION database!")

    return base_db_name

def get_mongo_collection_name():
    return os.getenv('MONGO_COLLECTION', 'sensor_data_')

LOCAL_TIMEZONE = os.getenv('LOCAL_TIMEZONE', 'Europe/Prague')

CO2_GOOD_MAX = 1000
CO2_MODERATE_MAX = 1500
CO2_HIGH_MAX = 2000


def resolve_local_timezone():
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
UTC = timezone.utc


def init_mongo_client():
    mongo_uri = get_mongo_uri()
    mongo_db_name = get_mongo_db_name()
    mongo_collection_name = get_mongo_collection_name()
    
    if not mongo_uri:
        raise RuntimeError(
            "Proměnná prostředí MONGO_URI musí být nastavena. "
            "Zadejte platný připojovací řetězec MongoDB (např. v administraci Renderu)."
        )
    
    # Debug: Print connection info (mask password) and show source
    uri_display = mongo_uri.split('@')[0] + '@***' if '@' in mongo_uri else mongo_uri[:50] + '...'
    
    # Check if MONGO_URI is from environment or .env (only in local dev)
    is_production = os.getenv('RENDER') is not None or os.getenv('RENDER_EXTERNAL_HOSTNAME') is not None
    
    if is_production:
        env_source = "Render environment variable (production)"
    else:
        from pathlib import Path
        env_path = Path(__file__).resolve().parent.parent.parent / '.env'
        env_source = "system environment variable"
        if env_path.exists():
            try:
                from dotenv import dotenv_values
                env_vars = dotenv_values(env_path)
                if 'MONGO_URI' in env_vars:
                    env_source = f".env file at {env_path}"
            except:
                pass
    
    print(f"[DEBUG] MongoDB URI source: {env_source}")
    print(f"[DEBUG] Connecting to MongoDB: {uri_display}")
    print(f"[DEBUG] Database: {mongo_db_name}, Collection: {mongo_collection_name}")
    
    # Warn if local development is connecting to production MongoDB (could cause data duplication)
    if not is_production:
        # Check if MongoDB URI points to a remote/production cluster (MongoDB Atlas)
        is_production_mongo = '.mongodb.net' in mongo_uri or mongo_uri.startswith('mongodb+srv://')
        is_local_mongo = mongo_uri.startswith('mongodb://localhost') or mongo_uri.startswith('mongodb://127.0.0.1')
        
        if is_production_mongo and not is_local_mongo:
            # Note: Production database access enabled as per user request
            print(f"\n{'='*70}")
            print(f"⚠️  WARNING: Local development server is connecting to PRODUCTION MongoDB cluster.")
            print(f"   Using database: '{mongo_db_name}'")
            print(f"   Writing to this database WILL affect production data!")
            print(f"   MongoDB URI points to: {uri_display}")
            print(f"{'='*70}\n")
    
    # Validate connection string format
    if not mongo_uri.startswith(('mongodb://', 'mongodb+srv://')):
        raise ValueError(
            "MONGO_URI must start with 'mongodb://' or 'mongodb+srv://'\n"
            f"Current format: {mongo_uri[:30]}..."
        )
    
    # Extract cluster name for better error messages
    cluster_name = None
    if '@' in mongo_uri and '.mongodb.net' in mongo_uri:
        try:
            # Extract cluster name from connection string
            # Format: mongodb+srv://user:pass@cluster-name.xxxxx.mongodb.net/
            cluster_part = mongo_uri.split('@')[1].split('.mongodb.net')[0]
            cluster_name = cluster_part.split('.')[0] if '.' in cluster_part else cluster_part
        except:
            pass
    
    try:
        # MongoDB Atlas connection strings should be in format: mongodb+srv://username:password@cluster.mongodb.net/
        # Note: Passwords with special characters are now automatically URL-encoded in get_mongo_uri()
        client = MongoClient(
            mongo_uri,
            serverSelectionTimeoutMS=10000,  # Increased timeout for debugging
            tlsCAFile=certifi.where(),
            tz_aware=True,
            tzinfo=UTC,
            retryWrites=True,  # Enable retryable writes
            retryReads=True,   # Enable retryable reads
        )
        # Trigger server selection to fail fast if misconfigured
        # This will raise an exception if authentication fails
        # Use a simple operation instead of ping to test auth
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
        
        # Create indexes - timeseries collections don't support sparse indexes
        # and we should index metadata fields, not top-level fields
        try:
            if is_timeseries:
                # For timeseries: index metadata fields (no sparse indexes allowed)
                collection.create_index([('metadata.device_id', ASCENDING)])
                collection.create_index([('metadata.mac_address', ASCENDING)])
            else:
                # For regular collections: use original indexes with sparse support
                collection.create_index([('device_id', ASCENDING), ('timestamp', ASCENDING)])
                try:
                    collection.create_index([('mac_address', ASCENDING), ('timestamp', ASCENDING)], sparse=True)
                except Exception:
                    # Sparse index might already exist, continue
                    pass
        except Exception as idx_err:
            # Indexes might already exist, just log and continue
            print(f"[INFO] Index creation note: {idx_err}")
        
        collection_type = "timeseries" if is_timeseries else "regular"
        print(f"Připojeno k MongoDB. Databáze: {mongo_db_name}, kolekce: {mongo_collection_name} ({collection_type})")
        return collection
    except Exception as err:
        error_msg = str(err)
        print(f"✗ Nepodařilo se inicializovat klienta MongoDB: {err}")
        
        # Provide helpful error messages for common issues
        if 'authentication failed' in error_msg.lower() or 'bad auth' in error_msg.lower():
            print("⚠️  MongoDB Authentication Error:")
            print("   - Check that username and password in MONGO_URI are correct")
            print("   - Verify the connection string matches exactly what's shown in MongoDB Atlas")
            print("   - Make sure password is copied correctly (no extra spaces or characters)")
            print("   - If password contains special characters, ensure they're properly URL-encoded")
            print("   - Common encoding: @ = %40, # = %23, / = %2F, : = %3A, ? = %3F, & = %26")
            print("   - Verify the database user exists and has proper permissions in MongoDB Atlas")
            print("   - Try resetting the database password in MongoDB Atlas and updating MONGO_URI")
        elif 'enotfound' in error_msg.lower() or 'querySrv' in error_msg.lower() or 'dns' in error_msg.lower():
            print("⚠️  MongoDB DNS/SRV Lookup Error:")
            print("   - The cluster name in MONGO_URI might be incorrect")
            print("   - Verify the connection string from MongoDB Atlas:")
            print("     1. Go to MongoDB Atlas → Connect → Drivers")
            print("     2. Copy the connection string (should include cluster name)")
            print("     3. Format: mongodb+srv://username:password@cluster-name.xxxxx.mongodb.net/")
            if cluster_name:
                print(f"   - Detected cluster name: {cluster_name}")
                print(f"   - Verify this cluster exists in your MongoDB Atlas account")
            print("   - Check network connectivity and DNS resolution")
            print("   - If using mongodb+srv://, ensure SRV records are accessible")
        elif 'server selection timeout' in error_msg.lower():
            print("⚠️  MongoDB Connection Timeout:")
            print("   - Check network connectivity")
            print("   - Verify MONGO_URI points to correct cluster")
            print("   - Check if IP address is whitelisted in MongoDB Atlas")
            print("   - For local development, ensure '0.0.0.0/0' is whitelisted (or your IP)")
        
        raise


# Lazy MongoDB connection initialization
_mongo_collection = None

def get_mongo_collection():
    """Get MongoDB collection, initializing if necessary"""
    global _mongo_collection
    if _mongo_collection is None:
        try:
            _mongo_collection = init_mongo_client()
        except Exception as e:
            print(f"✗ Chyba při inicializaci MongoDB: {e}")
            raise RuntimeError(f"Nepodařilo se připojit k MongoDB: {str(e)}")
    return _mongo_collection


# Lazy device registry collection initialization
_registry_collection = None

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


# Lazy settings collection initialization
_settings_collection = None

def get_settings_collection():
    """Get settings collection for global configuration, initializing if necessary"""
    global _settings_collection
    if _settings_collection is None:
        try:
            mongo_uri = get_mongo_uri()
            mongo_db_name = get_mongo_db_name()
            
            if not mongo_uri:
                print("✗ MONGO_URI not set, cannot initialize settings collection")
                raise RuntimeError("MONGO_URI must be set")
                
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
            _settings_collection = db['settings']
            
            # Create index on key field
            _settings_collection.create_index([('key', ASCENDING)], unique=True)
            
            # Initialize default settings if not present
            _settings_collection.update_one(
                {'key': 'whitelist_enabled'},
                {'$setOnInsert': {'key': 'whitelist_enabled', 'value': False, 'updated_at': datetime.now(UTC)}},
                upsert=True
            )
            
            print(f"Settings collection initialized")
        except Exception as err:
            print(f"✗ Failed to initialize settings collection: {err}")
            raise
    return _settings_collection


def is_whitelist_enabled():
    """Check if MAC address whitelisting is enabled"""
    try:
        settings = get_settings_collection()
        setting = settings.find_one({'key': 'whitelist_enabled'})
        return setting.get('value', False) if setting else False
    except Exception as e:
        print(f"⚠️  Error checking whitelist setting: {e}")
        return False  # Default to disabled if there's an error


def is_mac_whitelisted(mac_address):
    """Check if a MAC address is whitelisted"""
    if not mac_address:
        return False
    
    try:
        mac_normalized = normalize_mac_address(mac_address)
        registry = get_registry_collection()
        entry = registry.find_one({'mac_address': mac_normalized})
        
        if entry:
            # Default to True for existing entries (backward compatibility)
            return entry.get('whitelisted', True)
        return False
    except Exception as e:
        print(f"⚠️  Error checking whitelist for {mac_address}: {e}")
        return False


def ensure_registry_entry(mac_address, device_id=None):
    """
    Ensure device registry entry exists, creating if missing.
    
    Args:
        mac_address: MAC address (will be normalized)
        device_id: Optional device_id for default display name
    
    Returns:
        Registry entry document, or None if MAC address is invalid
    """
    try:
        mac_normalized = normalize_mac_address(mac_address)
    except ValueError:
        # Invalid MAC - don't create registry entry
        return None
    
    registry = get_registry_collection()
    now = datetime.now(UTC)
    
    # Try to find existing entry
    entry = registry.find_one({'mac_address': mac_normalized})
    
    if entry:
        # Update last_data_received timestamp
        update_data = {
            '$set': {
                'last_data_received': now,
                'updated_at': now
            }
        }
        # Ensure display_name exists and is MAC-based
        if not entry.get('display_name'):
            update_data['$set'] = update_data['$set'].copy()
            update_data['$set']['display_name'] = mac_normalized
        # Only set legacy_device_id if it's missing
        if device_id and 'legacy_device_id' not in entry:
            update_data['$set'] = update_data['$set'].copy()
            update_data['$set']['legacy_device_id'] = device_id
        
        # Ensure whitelisted field exists (default True for backward compatibility)
        if 'whitelisted' not in entry:
            update_data['$set']['whitelisted'] = True
        
        registry.update_one(
            {'mac_address': mac_normalized},
            update_data
        )
        # Refresh entry after update
        entry = registry.find_one({'mac_address': mac_normalized})
    else:
        # Create new entry - new devices are NOT whitelisted by default when whitelist is enabled
        default_name = mac_normalized
        entry = {
            'mac_address': mac_normalized,
            'display_name': default_name,
            'created_at': now,
            'updated_at': now,
            'last_data_received': now,
            'whitelisted': True,  # Default to True for backward compatibility
        }
        if device_id:
            entry['legacy_device_id'] = device_id
        
        registry.insert_one(entry)
    
    return entry


def to_local_datetime(value):
    if not value:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=UTC)
    return value.astimezone(LOCAL_TZ)


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
    
    # Convert to string and uppercase
    mac_str = str(mac).strip().upper()
    
    # Remove all separators (colons, hyphens, spaces)
    mac_clean = ''.join(c for c in mac_str if c.isalnum())
    
    # Validate length (must be 12 hex characters)
    if len(mac_clean) != 12:
        raise ValueError(f"Invalid MAC address length: expected 12 hex characters, got {len(mac_clean)}")
    
    # Validate hex characters
    try:
        int(mac_clean, 16)
    except ValueError:
        raise ValueError(f"Invalid hexadecimal MAC address: {mac_clean}")
    
    # Reformat with colons: AA:BB:CC:DD:EE:FF
    return ':'.join(mac_clean[i:i+2] for i in range(0, 12, 2))


def normalize_sensor_data(data):
    """Mapování příchozího JSONu na standardizované klíče."""
    normalized = {}
    try:
        normalized['timestamp'] = data['timestamp']
        normalized['device_id'] = data['device_id']
    except KeyError as exc:
        raise KeyError(f"Chybí povinné pole: {exc.args[0]}")

    # Extract temperature (support both 'temperature' and legacy 'temp_scd41' keys)
    temperature = data.get('temperature') or data.get('temp_scd41')
    # Extract humidity (support both 'humidity' and legacy 'humidity_scd41' keys)
    humidity = data.get('humidity') or data.get('humidity_scd41')

    if temperature is None:
        raise KeyError("temperature")
    if humidity is None:
        raise KeyError("humidity")

    normalized['temperature'] = temperature
    normalized['humidity'] = humidity

    if 'co2' not in data:
        raise KeyError("co2")
    normalized['co2'] = data['co2']

    return normalized


def validate_sensor_data(data):
    """Validace příchozích měření"""
    required_fields = ['timestamp', 'device_id', 'temperature', 'humidity', 'co2']
    
    # Check required fields
    for field in required_fields:
        if field not in data:
            return False, f"Chybí povinné pole: {field}"
    
    # Validate data ranges
    try:
        temperature = float(data['temperature'])
        humidity = float(data['humidity'])
        co2 = int(data['co2'])
        
        # Temperature range: -10°C to 50°C
        if not (-10 <= temperature <= 50):
            return False, "Teplota je mimo povolený rozsah (-10 až 50 °C)"
        
        # Humidity range: 0% to 100%
        if not (0 <= humidity <= 100):
            return False, "Vlhkost je mimo povolený rozsah (0 až 100 %)"
        
        # CO2 range: 400 to 5000 ppm (normal indoor range)
        if not (400 <= co2 <= 5000):
            return False, "CO₂ je mimo povolený rozsah (400 až 5000 ppm)"
        
        return True, "Valid"
    
    except (ValueError, TypeError) as e:
        return False, f"Neplatný datový typ: {str(e)}"


def format_timestamp(unix_timestamp):
    """Převod Unix časového razítka na čitelný formát"""
    try:
        ts = float(unix_timestamp)
        dt_utc = datetime.fromtimestamp(ts, tz=UTC)
        return to_local_datetime(dt_utc).strftime('%Y-%m-%d %H:%M:%S')
    except (TypeError, ValueError, OSError):
        return datetime.now(LOCAL_TZ).strftime('%Y-%m-%d %H:%M:%S')


def parse_iso_datetime(value, default=None):
    """Převede ISO8601 řetězec na datetime (bez časové zóny)."""
    if not value:
        return default
    try:
        # Handle string input
        if isinstance(value, str):
            sanitized = value.strip()
            if not sanitized:
                return default
            # Handle 'Z' suffix (UTC indicator)
            if sanitized.endswith('Z'):
                sanitized = sanitized[:-1] + '+00:00'
            dt = datetime.fromisoformat(sanitized)
        elif isinstance(value, datetime):
            dt = value
        else:
            raise ValueError(f"Neočekávaný typ dat: {type(value)}")
        
        # Ensure timezone info is set
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=LOCAL_TZ)
        return dt.astimezone(UTC)
    except ValueError as e:
        # Re-raise with more context
        raise ValueError(
            f"Neplatný formát data: '{value}'. Použijte ISO 8601, např. 2024-01-31T12:00:00. Chyba: {str(e)}"
        )
    except Exception as e:
        raise ValueError(
            f"Chyba při parsování data '{value}': {str(e)}"
        )


def resolve_device_identifier(device_identifier):
    """
    Resolve device identifier to device_id and/or mac_address.
    
    The identifier can be:
    - A device_id (legacy)
    - A MAC address (new system)
    - A display_name (looked up in registry)
    
    Returns:
        dict with 'device_id' and/or 'mac_address' keys for filtering
    """
    if not device_identifier:
        return {}
    
    device_identifier = str(device_identifier).strip()
    
    # Try to normalize as MAC address first
    try:
        mac_normalized = normalize_mac_address(device_identifier)
        # If successful, it's a MAC address - also try to get associated device_id
        result = {'mac_address': mac_normalized}
        try:
            registry = get_registry_collection()
            entry = registry.find_one({'mac_address': mac_normalized})
            if entry and entry.get('legacy_device_id'):
                result['device_id'] = entry.get('legacy_device_id')
        except Exception:
            # Registry lookup failed, continue with just MAC
            pass
        return result
    except ValueError:
        # Not a MAC address, continue checking
        pass
    
    # Check if it's a display_name in the registry
    try:
        registry = get_registry_collection()
        entry = registry.find_one({'display_name': device_identifier})
        if entry:
            mac = entry.get('mac_address')
            device_id = entry.get('legacy_device_id')
            result = {}
            if mac:
                result['mac_address'] = mac
            if device_id:
                result['device_id'] = device_id
            # If we found a match, return it
            if result:
                return result
    except Exception:
        # Registry lookup failed, continue with device_id
        pass
    
    # Default: treat as device_id (legacy support)
    # Also try to find MAC address for this device_id in registry
    result = {'device_id': device_identifier}
    try:
        registry = get_registry_collection()
        entry = registry.find_one({'legacy_device_id': device_identifier})
        if entry and entry.get('mac_address'):
            result['mac_address'] = entry.get('mac_address')
    except Exception:
        # Registry lookup failed, continue with just device_id
        pass
    return result


def build_history_filter(start_dt, end_dt, device_id=None):
    """Sestaví dotaz pro historická data podle zadaného rozsahu."""
    query = {}
    if start_dt or end_dt:
        time_filter = {}
        if start_dt:
            time_filter['$gte'] = start_dt
        if end_dt:
            time_filter['$lte'] = end_dt
        query['timestamp'] = time_filter
    
    if device_id:
        # Resolve device identifier (supports device_id, MAC address, or display_name)
        device_filter = resolve_device_identifier(device_id)
        if device_filter:
            # Timeseries format: use metadata.device_id and metadata.mac_address
            # Also support old format for backward compatibility
            if 'mac_address' in device_filter and 'device_id' in device_filter:
                query['$or'] = [
                    {'metadata.mac_address': device_filter['mac_address']},
                    {'metadata.device_id': device_filter['device_id']},
                    # Backward compatibility with old format
                    {'mac_address': device_filter['mac_address']},
                    {'device_id': device_filter['device_id']}
                ]
            elif 'mac_address' in device_filter:
                query['$or'] = [
                    {'metadata.mac_address': device_filter['mac_address']},
                    {'mac_address': device_filter['mac_address']}  # Backward compatibility
                ]
            elif 'device_id' in device_filter:
                query['$or'] = [
                    {'metadata.device_id': device_filter['device_id']},
                    {'device_id': device_filter['device_id']}  # Backward compatibility
                ]
    
    return query


def to_readable_timestamp(dt):
    if not dt:
        return None
    return to_local_datetime(dt).strftime('%Y-%m-%d %H:%M:%S')


def round_or_none(value, ndigits=2):
    if value is None:
        return None
    return round(value, ndigits)


# Static file serving views
def home(request):
    """Úvodní stránka"""
    static_dir = Path(settings.BASE_DIR) / 'static'
    html_file = static_dir / 'index.html'
    if html_file.exists():
        return HttpResponse(html_file.read_text(encoding='utf-8'), content_type='text/html')
    raise Http404("Page not found")


def dashboard(request):
    """Interaktivní dashboard"""
    static_dir = Path(settings.BASE_DIR) / 'static'
    html_file = static_dir / 'dashboard.html'
    if html_file.exists():
        return HttpResponse(html_file.read_text(encoding='utf-8'), content_type='text/html')
    raise Http404("Page not found")


def history(request):
    """Historická analytika"""
    static_dir = Path(settings.BASE_DIR) / 'static'
    html_file = static_dir / 'history.html'
    if html_file.exists():
        return HttpResponse(html_file.read_text(encoding='utf-8'), content_type='text/html')
    raise Http404("Page not found")


def connect(request):
    """Průvodce připojením desky"""
    static_dir = Path(settings.BASE_DIR) / 'static'
    html_file = static_dir / 'connect.html'
    if html_file.exists():
        return HttpResponse(html_file.read_text(encoding='utf-8'), content_type='text/html')
    raise Http404("Page not found")


def get_react_build_dir():
    """Get the React build directory path"""
    possible_paths = [
        Path(settings.BASE_DIR).parent / 'frontend' / 'dist',
        Path(settings.BASE_DIR).parent.parent / 'frontend' / 'dist',
        Path('/opt/render/project/src/frontend/dist'),  # Render default path
        Path.cwd() / 'frontend' / 'dist',  # Current working directory
    ]
    
    # Add REACT_BUILD_DIR if it exists in settings
    if hasattr(settings, 'REACT_BUILD_DIR'):
        react_build_path = Path(settings.REACT_BUILD_DIR)
        if react_build_path.exists():
            possible_paths.insert(0, react_build_path)
    
    for react_build_dir in possible_paths:
        try:
            if react_build_dir.exists() and (react_build_dir / 'index.html').exists():
                return react_build_dir
        except (OSError, ValueError):
            continue
    
    return None


def serve_react_asset(request, path):
    """Serve React app assets (JS, CSS, etc.) from /assets/ path"""
    react_build_dir = get_react_build_dir()
    if not react_build_dir:
        raise Http404("React build not found")
    
    # Vite builds assets in an 'assets' subdirectory
    # path parameter is everything after /assets/, so construct full path
    asset_file = react_build_dir / 'assets' / path
    
    # Security check: ensure the resolved path is within the build directory
    try:
        asset_file_resolved = asset_file.resolve()
        react_build_dir_resolved = react_build_dir.resolve()
        # Check that the file is within the assets subdirectory
        assets_dir = react_build_dir_resolved / 'assets'
        if not str(asset_file_resolved).startswith(str(assets_dir)):
            raise Http404("Asset not found")
    except (OSError, ValueError):
        raise Http404("Asset not found")
    
    if not asset_file.exists():
        raise Http404(f"Asset not found: {path}")
    
    # Determine content type based on file extension
    content_type = 'application/octet-stream'
    path_lower = path.lower()
    if path_lower.endswith('.js'):
        content_type = 'application/javascript; charset=utf-8'
    elif path_lower.endswith('.mjs'):
        content_type = 'application/javascript; charset=utf-8'
    elif path_lower.endswith('.css'):
        content_type = 'text/css; charset=utf-8'
    elif path_lower.endswith('.json'):
        content_type = 'application/json; charset=utf-8'
    elif path_lower.endswith('.png'):
        content_type = 'image/png'
    elif path_lower.endswith('.jpg') or path_lower.endswith('.jpeg'):
        content_type = 'image/jpeg'
    elif path_lower.endswith('.svg'):
        content_type = 'image/svg+xml'
    elif path_lower.endswith('.woff'):
        content_type = 'font/woff'
    elif path_lower.endswith('.woff2'):
        content_type = 'font/woff2'
    elif path_lower.endswith('.ttf'):
        content_type = 'font/ttf'
    elif path_lower.endswith('.ico'):
        content_type = 'image/x-icon'
    
    response = HttpResponse(asset_file.read_bytes(), content_type=content_type)
    # Add cache headers for production
    if not settings.DEBUG:
        response['Cache-Control'] = 'public, max-age=31536000, immutable'
    return response


def serve_react_app(request):
    """Serve React app index.html for all non-API routes"""
    react_build_dir = get_react_build_dir()
    
    if react_build_dir:
        index_file = react_build_dir / 'index.html'
        if index_file.exists():
            html_content = index_file.read_text(encoding='utf-8')
            response = HttpResponse(html_content, content_type='text/html; charset=utf-8')
            # Add no-cache headers for index.html to ensure fresh content
            if not settings.DEBUG:
                response['Cache-Control'] = 'no-cache, no-store, must-revalidate'
                response['Pragma'] = 'no-cache'
                response['Expires'] = '0'
            return response
    
    # Fallback to old static HTML if React build doesn't exist
    static_dir = Path(settings.BASE_DIR) / 'static'
    fallback_file = static_dir / 'index.html'
    if fallback_file.exists():
        return HttpResponse(fallback_file.read_text(encoding='utf-8'), content_type='text/html; charset=utf-8')
    
    # If we get here, provide a helpful error message
    error_msg = f"React app not found. Build directory: {react_build_dir}"
    if react_build_dir:
        error_msg += f" (exists: {react_build_dir.exists()})"
    raise Http404(error_msg)


# API views
@csrf_exempt
def data_endpoint(request):
    """Handle both GET and POST for /data endpoint"""
    if request.method == 'POST':
        return receive_data(request)
    elif request.method == 'GET':
        return get_data(request)
    else:
        return JsonResponse({'error': 'Method not allowed'}, status=405)


def receive_data(request):
    """Příjem dat ze senzoru"""
    try:
        data = json.loads(request.body)
        
        if not data:
            return JsonResponse({'error': 'Nebyla přijata žádná data.'}, status=400)
        
        print(f"\n{'='*50}")
        print(f"Přijata data z {data.get('device_id', 'unknown')}")
        print(f"{'='*50}")
        print(json.dumps(data, indent=2))
        
        # Check MAC address whitelist if enabled
        mac_address_raw = data.get('mac_address')
        if is_whitelist_enabled():
            if not mac_address_raw:
                print(f"⚠️  MAC address whitelist is enabled but no MAC address provided - rejecting data")
                return JsonResponse({
                    'error': 'MAC address is required when whitelist is enabled',
                    'whitelist_enabled': True
                }, status=403)
            
            if not is_mac_whitelisted(mac_address_raw):
                try:
                    mac_normalized = normalize_mac_address(mac_address_raw)
                    print(f"⚠️  MAC address {mac_normalized} is not whitelisted - rejecting data")
                except ValueError:
                    print(f"⚠️  Invalid MAC address {mac_address_raw} - rejecting data")
                return JsonResponse({
                    'error': 'MAC address is not whitelisted',
                    'mac_address': mac_address_raw,
                    'whitelist_enabled': True
                }, status=403)
        
        # Normalize payload to canonical keys
        try:
            normalized = normalize_sensor_data(data)
        except KeyError as exc:
            message = f"Chybí povinné pole: {exc.args[0]}"
            print(f"⚠️  Chyba validace: {message}")
            return JsonResponse({'error': message}, status=400)

        # Validate data
        is_valid, message = validate_sensor_data(normalized)
        if not is_valid:
            print(f"⚠️  Chyba validace: {message}")
            return JsonResponse({'error': message}, status=400)
        
        # Extract and normalize MAC address (if present)
        mac_address = None
        if mac_address_raw:
            try:
                mac_address = normalize_mac_address(mac_address_raw)
                # Ensure registry entry exists
                ensure_registry_entry(mac_address, normalized.get('device_id'))
            except ValueError as e:
                print(f"⚠️  Neplatná MAC adresa: {e}, pokračuji bez ní")
                # Continue without MAC address (backward compatibility)

        # Format timestamp
        timestamp_utc = datetime.fromtimestamp(float(normalized['timestamp']), tz=UTC)
        timestamp_local = to_local_datetime(timestamp_utc)
        timestamp_str = timestamp_local.strftime('%Y-%m-%d %H:%M:%S')

        temperature = float(normalized['temperature'])
        humidity = float(normalized['humidity'])
        co2 = int(normalized['co2'])

        # Timeseries document structure: metadata field for grouping, measurements at root
        document = {
            'timestamp': timestamp_utc,  # timeField - must be at root level
            'timestamp_str': timestamp_str,  # Human-readable format
            # Measurements at root level
            'temperature': temperature,
            'humidity': humidity,
            'co2': co2,
            # Metadata for grouping (metaField in timeseries collection)
            'metadata': {
                'device_id': normalized['device_id']
            }
        }
        
        # Add MAC address to metadata if available
        if mac_address:
            document['metadata']['mac_address'] = mac_address
        
        # Add voltage if available (measurement, so at root level)
        if 'voltage' in data and data['voltage'] is not None:
            try:
                document['voltage'] = float(data['voltage'])
            except (ValueError, TypeError):
                pass  # Skip if voltage can't be converted to float

        try:
            get_mongo_collection().insert_one(document)
            print(f"✓ Data uložena do MongoDB v {timestamp_str}")
        except PyMongoError as exc:
            print(f"✗ Chyba při ukládání do MongoDB: {exc}")
            return JsonResponse({'error': 'Data se nepodařilo uložit.'}, status=500)
        
        return JsonResponse({
            'status': 'success',
            'message': 'Data byla přijata a uložena.',
            'timestamp': timestamp_str
        }, status=200)
    
    except Exception as e:
        print(f"✗ Neočekávaná chyba: {str(e)}")
        return JsonResponse({'error': str(e)}, status=500)


def get_data(request):
    """Vrací data pro dashboard (volitelná filtrace)"""
    try:
        # Get query parameters
        hours = int(request.GET.get('hours', 24))
        limit = int(request.GET.get('limit', 1000))
        device_id = request.GET.get('device_id', None)

        # Calculate cutoff time
        cutoff_time = datetime.now(UTC) - timedelta(hours=hours)

        mongo_filter = {'timestamp': {'$gte': cutoff_time}}
        if device_id:
            # Resolve device identifier (supports device_id, MAC address, or display_name)
            device_filter = resolve_device_identifier(device_id)
            if device_filter:
                # Timeseries format: use metadata.device_id and metadata.mac_address
                # Also support old format for backward compatibility
                if 'mac_address' in device_filter and 'device_id' in device_filter:
                    mongo_filter['$or'] = [
                        {'metadata.mac_address': device_filter['mac_address']},
                        {'metadata.device_id': device_filter['device_id']},
                        # Backward compatibility with old format
                        {'mac_address': device_filter['mac_address']},
                        {'device_id': device_filter['device_id']}
                    ]
                elif 'mac_address' in device_filter:
                    mongo_filter['$or'] = [
                        {'metadata.mac_address': device_filter['mac_address']},
                        {'mac_address': device_filter['mac_address']}  # Backward compatibility
                    ]
                elif 'device_id' in device_filter:
                    mongo_filter['$or'] = [
                        {'metadata.device_id': device_filter['device_id']},
                        {'device_id': device_filter['device_id']}  # Backward compatibility
                    ]

        try:
            collection = get_mongo_collection()
        except RuntimeError as e:
            return JsonResponse({
                'status': 'error',
                'error': f'Nepodařilo se připojit k databázi: {str(e)}'
            }, status=503)

        cursor = collection.find(mongo_filter).sort('timestamp', -1)
        if limit:
            cursor = cursor.limit(limit)

        documents = list(cursor)
        documents.reverse()  # Restore chronological order

        data_points = []
        now_utc = datetime.now(UTC)
        max_future = now_utc + timedelta(hours=1)  # Allow 1 hour for clock skew
        
        for doc in documents:
            temperature = float(doc.get('temperature', 0))
            humidity = float(doc.get('humidity', 0))
            co2 = int(doc.get('co2', 0))
            
            # Use raw MongoDB timestamp (UTC) - this is the source of truth
            timestamp_utc = doc.get('timestamp')
            timestamp_iso = None
            timestamp_str = None
            
            if timestamp_utc:
                # Ensure it's timezone-aware (UTC)
                if timestamp_utc.tzinfo is None:
                    timestamp_utc = timestamp_utc.replace(tzinfo=UTC)
                
                # Extract device_id for logging (with backward compatibility)
                metadata = doc.get('metadata', {})
                device_id_for_log = metadata.get('device_id') or doc.get('device_id')
                
                # CRITICAL: Skip documents with future timestamps (data corruption)
                if timestamp_utc > max_future:
                    print(f"⚠️  Skipping document with future timestamp: {timestamp_utc.isoformat()} (device: {device_id_for_log})")
                    continue
                
                # Convert to ISO format in UTC - this is what frontend will parse
                timestamp_iso = timestamp_utc.isoformat()
                # Also create local time string for display
                timestamp_local = to_local_datetime(timestamp_utc)
                timestamp_str = timestamp_local.strftime('%Y-%m-%d %H:%M:%S')
            else:
                # Fallback to timestamp_str if timestamp is missing
                timestamp_str = doc.get('timestamp_str')
                if timestamp_str:
                    # Try to parse it and create ISO
                    try:
                        # Parse the string as local time and convert to UTC
                        dt_local = datetime.strptime(timestamp_str, '%Y-%m-%d %H:%M:%S')
                        dt_local = dt_local.replace(tzinfo=LOCAL_TZ)
                        timestamp_utc = dt_local.astimezone(UTC)
                        # Extract device_id for logging (with backward compatibility)
                        metadata = doc.get('metadata', {})
                        device_id_for_log = metadata.get('device_id') or doc.get('device_id')
                        
                        # Validate it's not in the future
                        if timestamp_utc > max_future:
                            print(f"⚠️  Skipping document with future timestamp_str: {timestamp_str} (device: {device_id_for_log})")
                            continue
                        timestamp_iso = timestamp_utc.isoformat()
                    except Exception as e:
                        print(f"⚠️  Failed to parse timestamp_str '{timestamp_str}': {e}")
                        continue

            # Extract device_id with backward compatibility (support both old and new format)
            metadata = doc.get('metadata', {})
            device_id_from_doc = metadata.get('device_id') or doc.get('device_id')
            
            data_points.append({
                'timestamp': timestamp_str,
                'timestamp_iso': timestamp_iso,
                'device_id': device_id_from_doc,
                'temperature': temperature,
                'humidity': humidity,
                'co2': co2,
                'temp_avg': temperature,
                'humidity_avg': humidity
            })

        return JsonResponse({
            'status': 'success',
            'count': len(data_points),
            'data': data_points
        }, status=200)
    
    except PyMongoError as exc:
        print(f"✗ MongoDB chyba v get_data: {exc}")
        return JsonResponse({
            'status': 'error',
            'error': f'Databázová chyba: {exc}'
        }, status=500)
    except Exception as e:
        print(f"✗ Neočekávaná chyba v get_data: {e}")
        return JsonResponse({
            'status': 'error',
            'error': str(e)
        }, status=500)


@require_http_methods(["GET"])
def history_series(request):
    """Vrací agregované historické časové řady pro analýzu trendů."""
    try:
        now = datetime.now(UTC)
        default_start = now - timedelta(days=30)

        # Parse dates with proper error handling
        try:
            start_dt = parse_iso_datetime(request.GET.get('start'), default_start)
        except ValueError as e:
            return JsonResponse({
                'status': 'error',
                'error': f'Neplatný formát počátečního data: {str(e)}'
            }, status=400)
        except Exception as e:
            print(f"✗ Chyba při parsování počátečního data: {e}")
            return JsonResponse({
                'status': 'error',
                'error': f'Chyba při zpracování počátečního data: {str(e)}'
            }, status=400)

        try:
            end_dt = parse_iso_datetime(request.GET.get('end'), now)
        except ValueError as e:
            return JsonResponse({
                'status': 'error',
                'error': f'Neplatný formát koncového data: {str(e)}'
            }, status=400)
        except Exception as e:
            print(f"✗ Chyba při parsování koncového data: {e}")
            return JsonResponse({
                'status': 'error',
                'error': f'Chyba při zpracování koncového data: {str(e)}'
            }, status=400)

        if start_dt and end_dt and start_dt > end_dt:
            return JsonResponse({
                'status': 'error',
                'error': 'Počáteční datum nesmí být pozdější než koncové.'
            }, status=400)

        bucket = (request.GET.get('bucket') or 'day').lower()
        if bucket not in ('hour', 'day', 'raw', 'none', '10min'):
            return JsonResponse({'error': "Parametr 'bucket' podporuje pouze hodnoty 'hour', 'day', 'raw', 'none' nebo '10min'."}, status=400)

        device_id = request.GET.get('device_id')
        mongo_filter = build_history_filter(start_dt, end_dt, device_id)
        bucket_unit = None

        # Handle raw data (no aggregation)
        if bucket in ('raw', 'none'):
            cursor = get_mongo_collection().find(mongo_filter).sort('timestamp', 1)
            series = []
            for doc in cursor:
                timestamp_local = to_local_datetime(doc.get('timestamp'))
                entry = {
                    'bucket_start': to_readable_timestamp(doc.get('timestamp')),
                    'count': 1,
                    'temperature': {
                        'avg': round_or_none(doc.get('temperature')),
                        'min': round_or_none(doc.get('temperature')),
                        'max': round_or_none(doc.get('temperature')),
                    },
                    'humidity': {
                        'avg': round_or_none(doc.get('humidity')),
                        'min': round_or_none(doc.get('humidity')),
                        'max': round_or_none(doc.get('humidity')),
                    },
                    'co2': {
                        'avg': doc.get('co2'),
                        'min': doc.get('co2'),
                        'max': doc.get('co2'),
                    }
                }
                if not device_id:
                    # Extract device_id with backward compatibility
                    metadata = doc.get('metadata', {})
                    entry['device_id'] = metadata.get('device_id') or doc.get('device_id')
                series.append(entry)
        else:
            # Aggregated data
            if bucket == '10min':
                # 10-minute buckets: round timestamp down to nearest 10-minute boundary
                # Calculate milliseconds to subtract: (minute % 10) * 60 + seconds
                # Then subtract from timestamp in milliseconds
                pipeline = [
                    {'$match': mongo_filter},
                    {
                        '$addFields': {
                            'minute_remainder_ms': {
                                '$multiply': [
                                    {
                                        '$mod': [
                                            {'$minute': '$timestamp'},
                                            10
                                        ]
                                    },
                                    60000  # minutes to milliseconds
                                ]
                            },
                            'seconds_ms': {
                                '$multiply': [
                                    {'$second': '$timestamp'},
                                    1000  # seconds to milliseconds
                                ]
                            }
                        }
                    },
                    {
                        '$addFields': {
                            'total_ms_to_subtract': {
                                '$add': ['$minute_remainder_ms', '$seconds_ms']
                            }
                        }
                    },
                    {
                        '$addFields': {
                            'bucket': {
                                '$subtract': [
                                    '$timestamp',
                                    '$total_ms_to_subtract'
                                ]
                            }
                        }
                    },
                    {
                        '$group': {
                            '_id': {
                                'bucket': '$bucket',
                                **({} if device_id else {'device_id': {'$ifNull': ['$metadata.device_id', '$device_id']}})
                            },
                            'count': {'$sum': 1},
                            'temperature_avg': {'$avg': '$temperature'},
                            'temperature_min': {'$min': '$temperature'},
                            'temperature_max': {'$max': '$temperature'},
                            'humidity_avg': {'$avg': '$humidity'},
                            'humidity_min': {'$min': '$humidity'},
                            'humidity_max': {'$max': '$humidity'},
                            'co2_avg': {'$avg': '$co2'},
                            'co2_min': {'$min': '$co2'},
                            'co2_max': {'$max': '$co2'},
                        }
                    },
                    {
                        '$sort': {
                            '_id.bucket': 1,
                            **({'_id.device_id': 1} if not device_id else {})
                        }
                    }
                ]
                bucket_unit = '10min'
            else:
                bucket_unit = 'hour' if bucket == 'hour' else 'day'

                group_id = {
                    'bucket': {
                        '$dateTrunc': {
                            'date': '$timestamp',
                            'unit': bucket_unit,
                        }
                    }
                }
                if not device_id:
                    # Use metadata.device_id from timeseries, fallback to old format
                    group_id['device_id'] = {'$ifNull': ['$metadata.device_id', '$device_id']}

                pipeline = [
                    {'$match': mongo_filter},
                    {
                        '$group': {
                            '_id': group_id,
                            'count': {'$sum': 1},
                            'temperature_avg': {'$avg': '$temperature'},
                            'temperature_min': {'$min': '$temperature'},
                            'temperature_max': {'$max': '$temperature'},
                            'humidity_avg': {'$avg': '$humidity'},
                            'humidity_min': {'$min': '$humidity'},
                            'humidity_max': {'$max': '$humidity'},
                            'co2_avg': {'$avg': '$co2'},
                            'co2_min': {'$min': '$co2'},
                            'co2_max': {'$max': '$co2'},
                        }
                    },
                    {
                        '$sort': {
                            '_id.bucket': 1,
                            **({'_id.device_id': 1} if not device_id else {})
                        }
                    }
                ]

            cursor = get_mongo_collection().aggregate(pipeline, allowDiskUse=True)
            series = []

            for doc in cursor:
                bucket_dt = doc['_id']['bucket']
                entry = {
                    'bucket_start': to_readable_timestamp(bucket_dt),
                    'count': doc.get('count', 0),
                    'temperature': {
                        'avg': round_or_none(doc.get('temperature_avg')),
                        'min': round_or_none(doc.get('temperature_min')),
                        'max': round_or_none(doc.get('temperature_max')),
                    },
                    'humidity': {
                        'avg': round_or_none(doc.get('humidity_avg')),
                        'min': round_or_none(doc.get('humidity_min')),
                        'max': round_or_none(doc.get('humidity_max')),
                    },
                    'co2': {
                        'avg': round_or_none(doc.get('co2_avg')),
                        'min': doc.get('co2_min'),
                        'max': doc.get('co2_max'),
                    }
                }
                if not device_id:
                    entry['device_id'] = doc['_id'].get('device_id')
                series.append(entry)

        bucket_display = 'raw' if bucket in ('raw', 'none') else bucket_unit
        
        return JsonResponse({
            'status': 'success',
            'bucket': bucket_display,
            'device_id': device_id,
            'count': len(series),
            'series': series
        }, status=200)

    except ValueError as exc:
        print(f"✗ ValueError v history_series: {exc}")
        return JsonResponse({
            'status': 'error',
            'error': str(exc)
        }, status=400)
    except PyMongoError as exc:
        print(f"✗ MongoDB chyba v history_series: {exc}")
        return JsonResponse({
            'status': 'error',
            'error': f'Databázová chyba: {exc}'
        }, status=500)
    except Exception as exc:
        print(f"✗ Neočekávaná chyba v history_series: {exc}")
        import traceback
        traceback.print_exc()
        return JsonResponse({
            'status': 'error',
            'error': f'Neočekávaná chyba: {str(exc)}'
        }, status=500)


@require_http_methods(["GET"])
def history_export(request):
    """Export historických dat do CSV souboru pro zadané časové období."""
    try:
        now = datetime.now(UTC)
        default_start = now - timedelta(days=30)

        start_dt = parse_iso_datetime(request.GET.get('start'), default_start)
        end_dt = parse_iso_datetime(request.GET.get('end'), now)

        if start_dt and end_dt and start_dt > end_dt:
            return JsonResponse({'error': 'Počáteční datum nesmí být pozdější než koncové.'}, status=400)

        device_id = request.GET.get('device_id')
        
        # Use the centralized export logic
        from .annotation.export import export_raw_csv, sanitize_filename
        
        # Generate CSV content
        csv_content = export_raw_csv(start_dt, end_dt, device_id)
        
        # Prepare response
        response = HttpResponse(csv_content, content_type='text/csv; charset=utf-8')
        
        # Create filename
        start_str = sanitize_filename(start_dt.strftime('%Y-%m-%d_%H-%M-%S')) if start_dt else 'start'
        end_str = sanitize_filename(end_dt.strftime('%Y-%m-%d_%H-%M-%S')) if end_dt else 'end'
        device_safe = sanitize_filename(device_id) if device_id else ''
        
        if device_safe:
            filename = f'cognitiv_export_{device_safe}_{start_str}_to_{end_str}.csv'
        else:
            filename = f'cognitiv_export_{start_str}_to_{end_str}.csv'
        
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        
        # Add BOM for Excel compatibility (if not already handled by export logic string generation - 
        # export.py returns string via getValue(), so we prepend it here or ensure export.py doesn't duplicate)
        # Note: export_raw_csv returns just the content string. 
        # We should modify csv_content to allow BOM prefixing if needed, 
        # but StringIO.getvalue() returns a string. 
        # Best way is to write BOM to response first, then content.
        # But we already passed `csv_content` to HttpResponse constructor.
        # Let's rebuild response to strictly match previous behavior including BOM.
        
        response = HttpResponse(content_type='text/csv; charset=utf-8')
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        response.write('\ufeff') # BOM
        response.write(csv_content)
        
        return response

    except ValueError as exc:
        return JsonResponse({'error': str(exc)}, status=400)
    except PyMongoError as exc:
        return JsonResponse({'error': f'Databázová chyba: {exc}'}, status=500)
    except Exception as exc:
        return JsonResponse({'error': str(exc)}, status=500)


@require_http_methods(["GET"])
def history_summary(request):
    """Shrnutí historických dat, trendy a anomálie."""
    try:
        now = datetime.now(UTC)
        default_start = now - timedelta(days=30)

        start_dt = parse_iso_datetime(request.GET.get('start'), default_start)
        end_dt = parse_iso_datetime(request.GET.get('end'), now)

        if start_dt and end_dt and start_dt > end_dt:
            return JsonResponse({'error': 'Počáteční datum nesmí být pozdější než koncové.'}, status=400)

        device_id = request.GET.get('device_id')
        mongo_filter = build_history_filter(start_dt, end_dt, device_id)

        pipeline = [
            {'$match': mongo_filter},
            {
                '$group': {
                    '_id': None,
                    'count': {'$sum': 1},
                    'temp_min': {'$min': '$temperature'},
                    'temp_max': {'$max': '$temperature'},
                    'temp_avg': {'$avg': '$temperature'},
                    'humidity_min': {'$min': '$humidity'},
                    'humidity_max': {'$max': '$humidity'},
                    'humidity_avg': {'$avg': '$humidity'},
                    'co2_min': {'$min': '$co2'},
                    'co2_max': {'$max': '$co2'},
                    'co2_avg': {'$avg': '$co2'},
                    'first_ts': {'$min': '$timestamp'},
                    'last_ts': {'$max': '$timestamp'},
                    'co2_good': {'$sum': {'$cond': [{'$lt': ['$co2', CO2_GOOD_MAX]}, 1, 0]}},
                    'co2_moderate': {'$sum': {'$cond': [
                        {'$and': [{'$gte': ['$co2', CO2_GOOD_MAX]}, {'$lt': ['$co2', CO2_MODERATE_MAX]}]}, 1, 0
                    ]}},
                    'co2_high': {'$sum': {'$cond': [
                        {'$and': [{'$gte': ['$co2', CO2_MODERATE_MAX]}, {'$lt': ['$co2', CO2_HIGH_MAX]}]}, 1, 0
                    ]}},
                    'co2_critical': {'$sum': {'$cond': [{'$gte': ['$co2', CO2_HIGH_MAX]}, 1, 0]}}
                }
            }
        ]

        agg = list(get_mongo_collection().aggregate(pipeline, allowDiskUse=True))
        if not agg:
            return JsonResponse({
                'status': 'success',
                'message': 'V daném období nejsou žádná data.',
                'summary': {}
            }, status=200)

        stats = agg[0]
        count = stats.get('count', 0)

        first_doc_cursor = get_mongo_collection().find(mongo_filter).sort('timestamp', 1).limit(1)
        last_doc_cursor = get_mongo_collection().find(mongo_filter).sort('timestamp', -1).limit(1)
        first_doc = next(first_doc_cursor, None)
        last_doc = next(last_doc_cursor, None)

        def calc_trend(metric):
            if not first_doc or not last_doc:
                return {'absolute': None, 'percent': None}
            first_val = first_doc.get(metric)
            last_val = last_doc.get(metric)
            if first_val is None or last_val is None:
                return {'absolute': None, 'percent': None}
            absolute = round_or_none(last_val - first_val)
            percent = None
            if first_val not in (0, None):
                percent = round_or_none(((last_val - first_val) / first_val) * 100)
            return {'absolute': absolute, 'percent': percent}

        co2_quality = {
            'good': stats.get('co2_good', 0),
            'moderate': stats.get('co2_moderate', 0),
            'high': stats.get('co2_high', 0),
            'critical': stats.get('co2_critical', 0),
        }
        if count > 0:
            co2_quality.update({
                'good_percent': round_or_none(co2_quality['good'] / count * 100),
                'moderate_percent': round_or_none(co2_quality['moderate'] / count * 100),
                'high_percent': round_or_none(co2_quality['high'] / count * 100),
                'critical_percent': round_or_none(co2_quality['critical'] / count * 100),
            })
        else:
            co2_quality.update({
                'good_percent': 0,
                'moderate_percent': 0,
                'high_percent': 0,
                'critical_percent': 0,
            })

        summary = {
            'device_id': device_id,
            'range': {
                'requested_start': to_readable_timestamp(start_dt),
                'requested_end': to_readable_timestamp(end_dt),
                'data_start': to_readable_timestamp(stats.get('first_ts')),
                'data_end': to_readable_timestamp(stats.get('last_ts')),
            },
            'samples': count,
            'temperature': {
                'min': round_or_none(stats.get('temp_min')),
                'max': round_or_none(stats.get('temp_max')),
                'avg': round_or_none(stats.get('temp_avg')),
                'trend': calc_trend('temperature'),
            },
            'humidity': {
                'min': round_or_none(stats.get('humidity_min')),
                'max': round_or_none(stats.get('humidity_max')),
                'avg': round_or_none(stats.get('humidity_avg')),
                'trend': calc_trend('humidity'),
            },
            'co2': {
                'min': stats.get('co2_min'),
                'max': stats.get('co2_max'),
                'avg': round_or_none(stats.get('co2_avg')),
                'trend': calc_trend('co2'),
            },
            'co2_quality': co2_quality
        }

        return JsonResponse({
            'status': 'success',
            'summary': summary
        }, status=200)

    except ValueError as exc:
        return JsonResponse({'error': str(exc)}, status=400)
    except PyMongoError as exc:
        return JsonResponse({'error': f'Databázová chyba: {exc}'}, status=500)
    except Exception as exc:
        return JsonResponse({'error': str(exc)}, status=500)


@require_http_methods(["GET"])
def get_stats(request):
    """Statistické shrnutí dat"""
    try:
        hours = int(request.GET.get('hours', 24))
        device_id = request.GET.get('device_id', None)
        cutoff_time = datetime.now(UTC) - timedelta(hours=hours)

        mongo_filter = {'timestamp': {'$gte': cutoff_time}}
        if device_id:
            # Resolve device identifier (supports device_id, MAC address, or display_name)
            device_filter = resolve_device_identifier(device_id)
            if device_filter:
                # Timeseries format: use metadata.device_id and metadata.mac_address
                # Also support old format for backward compatibility
                if 'mac_address' in device_filter and 'device_id' in device_filter:
                    mongo_filter['$or'] = [
                        {'metadata.mac_address': device_filter['mac_address']},
                        {'metadata.device_id': device_filter['device_id']},
                        # Backward compatibility with old format
                        {'mac_address': device_filter['mac_address']},
                        {'device_id': device_filter['device_id']}
                    ]
                elif 'mac_address' in device_filter:
                    mongo_filter['$or'] = [
                        {'metadata.mac_address': device_filter['mac_address']},
                        {'mac_address': device_filter['mac_address']}  # Backward compatibility
                    ]
                elif 'device_id' in device_filter:
                    mongo_filter['$or'] = [
                        {'metadata.device_id': device_filter['device_id']},
                        {'device_id': device_filter['device_id']}  # Backward compatibility
                    ]

        try:
            collection = get_mongo_collection()
        except RuntimeError as e:
            return JsonResponse({
                'status': 'error',
                'error': f'Nepodařilo se připojit k databázi: {str(e)}'
            }, status=503)

        pipeline = [
            {'$match': mongo_filter},
            {
                '$group': {
                    '_id': None,
                    'temp_min': {'$min': '$temperature'},
                    'temp_max': {'$max': '$temperature'},
                    'temp_avg': {'$avg': '$temperature'},
                    'humidity_min': {'$min': '$humidity'},
                    'humidity_max': {'$max': '$humidity'},
                    'humidity_avg': {'$avg': '$humidity'},
                    'co2_min': {'$min': '$co2'},
                    'co2_max': {'$max': '$co2'},
                    'co2_avg': {'$avg': '$co2'},
                    'count': {'$sum': 1},
                    'co2_good': {'$sum': {'$cond': [{'$lt': ['$co2', CO2_GOOD_MAX]}, 1, 0]}},
                    'co2_moderate': {'$sum': {'$cond': [
                        {'$and': [{'$gte': ['$co2', CO2_GOOD_MAX]}, {'$lt': ['$co2', CO2_MODERATE_MAX]}]}, 1, 0
                    ]}},
                    'co2_high': {'$sum': {'$cond': [
                        {'$and': [{'$gte': ['$co2', CO2_MODERATE_MAX]}, {'$lt': ['$co2', CO2_HIGH_MAX]}]}, 1, 0
                    ]}},
                    'co2_critical': {'$sum': {'$cond': [{'$gte': ['$co2', CO2_HIGH_MAX]}, 1, 0]}},
                }
            }
        ]

        agg_result = list(collection.aggregate(pipeline))
        if not agg_result:
            return JsonResponse({
                'status': 'success',
                'message': 'Nejsou k dispozici žádná data.',
                'stats': {}
            }, status=200)
        
        stats_doc = agg_result[0]

        # Fetch most recent document for "current" values
        latest_doc = collection.find(mongo_filter).sort('timestamp', -1).limit(1)
        latest_doc = next(latest_doc, None)

        current_temperature = None
        current_humidity = None
        current_co2 = None

        if latest_doc:
            current_temperature = round(float(latest_doc.get('temperature', 0)), 1)
            current_humidity = round(float(latest_doc.get('humidity', 0)), 1)
            current_co2 = int(latest_doc.get('co2', 0))

        count = stats_doc.get('count', 0)
        co2_good = stats_doc.get('co2_good', 0)
        co2_moderate = stats_doc.get('co2_moderate', 0)
        co2_high = stats_doc.get('co2_high', 0)
        co2_critical = stats_doc.get('co2_critical', 0)

        stats = {
            'temperature': {
                'min': round(stats_doc.get('temp_min', 0), 1),
                'max': round(stats_doc.get('temp_max', 0), 1),
                'avg': round(stats_doc.get('temp_avg', 0), 1),
                'current': current_temperature
            },
            'humidity': {
                'min': round(stats_doc.get('humidity_min', 0), 1),
                'max': round(stats_doc.get('humidity_max', 0), 1),
                'avg': round(stats_doc.get('humidity_avg', 0), 1),
                'current': current_humidity
            },
            'co2': {
                'min': int(stats_doc.get('co2_min', 0)),
                'max': int(stats_doc.get('co2_max', 0)),
                'avg': round(stats_doc.get('co2_avg', 0)),
                'current': current_co2
            },
            'data_points': count,
            'time_range_hours': hours
        }
        
        if count > 0:
            stats['co2_quality'] = {
                'good': co2_good,
                'moderate': co2_moderate,
                'high': co2_high,
                'critical': co2_critical,
                'good_percent': round(co2_good / count * 100, 1),
                'moderate_percent': round(co2_moderate / count * 100, 1),
                'high_percent': round(co2_high / count * 100, 1),
                'critical_percent': round(co2_critical / count * 100, 1)
            }
        else:
            stats['co2_quality'] = {
                'good': 0,
                'moderate': 0,
                'high': 0,
                'critical': 0,
                'good_percent': 0,
                'moderate_percent': 0,
                'high_percent': 0,
                'critical_percent': 0
            }
        
        return JsonResponse({
            'status': 'success',
            'stats': stats
        }, status=200)
    
    except PyMongoError as exc:
        print(f"✗ MongoDB chyba v get_stats: {exc}")
        return JsonResponse({
            'status': 'error',
            'error': f'Databázová chyba: {exc}'
        }, status=500)
    except Exception as e:
        print(f"✗ Neočekávaná chyba v get_stats: {e}")
        return JsonResponse({
            'status': 'error',
            'error': str(e)
        }, status=500)


@require_http_methods(["GET"])
def status_view(request):
    """Stav serveru"""
    try:
        try:
            collection = get_mongo_collection()
        except RuntimeError as e:
            return JsonResponse({
                'status': 'error',
                'error': f'Nepodařilo se připojit k databázi: {str(e)}',
                'database': get_mongo_db_name(),
                'collection': get_mongo_collection_name(),
                'data_points': 0,
                'latest_entry': None,
                'server_time': datetime.now(LOCAL_TZ).strftime('%Y-%m-%d %H:%M:%S')
            }, status=503)

        total_documents = collection.count_documents({})
        latest_doc = collection.find().sort('timestamp', -1).limit(1)
        latest_doc = next(latest_doc, None)

        latest_timestamp = None
        if latest_doc:
            latest_timestamp = latest_doc.get('timestamp_str')
            if not latest_timestamp:
                latest_timestamp = to_readable_timestamp(latest_doc.get('timestamp'))

        return JsonResponse({
            'status': 'online',
            'database': get_mongo_db_name(),
            'collection': get_mongo_collection_name(),
            'data_points': total_documents,
            'latest_entry': latest_timestamp,
            'server_time': datetime.now(LOCAL_TZ).strftime('%Y-%m-%d %H:%M:%S')
        }, status=200)

    except PyMongoError as exc:
        print(f"✗ MongoDB chyba v status_view: {exc}")
        return JsonResponse({
            'status': 'error',
            'error': f'Databázová chyba: {exc}',
            'database': get_mongo_db_name(),
            'collection': get_mongo_collection_name(),
            'data_points': 0,
            'latest_entry': None,
            'server_time': datetime.now(LOCAL_TZ).strftime('%Y-%m-%d %H:%M:%S')
        }, status=500)
    except Exception as e:
        print(f"✗ Neočekávaná chyba v status_view: {e}")
        return JsonResponse({
            'status': 'error',
            'error': str(e),
            'database': get_mongo_db_name(),
            'collection': get_mongo_collection_name(),
            'data_points': 0,
            'latest_entry': None,
            'server_time': datetime.now(LOCAL_TZ).strftime('%Y-%m-%d %H:%M:%S')
        }, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def connect_upload(request):
    """Zápis WiFi údajů a nahrání firmware do připojené desky"""
    try:
        payload = json.loads(request.body) if request.body else {}
    except json.JSONDecodeError:
        payload = {}

    board_name = (payload.get('boardName') or '').strip()
    ssid = (payload.get('ssid') or '').strip()
    password = payload.get('password', '')

    if not board_name:
        return JsonResponse({
            'status': 'error',
            'message': 'Pro nahrání firmware je nutné zadat název desky.'
        }, status=400)

    if not ssid:
        return JsonResponse({
            'status': 'error',
            'message': 'Pro nahrání firmware je nutné zadat SSID.'
        }, status=400)

    if password is None:
        password = ''

    if not isinstance(password, str):
        return JsonResponse({
            'status': 'error',
            'message': 'Heslo musí být textový řetězec.'
        }, status=400)

    try:
        # Use upload_firmware() which handles both config update and upload
        return_code, stdout, stderr = upload_firmware(
            ssid, 
            password, 
            board_name
        )
    except ConfigWriteError as exc:
        print(f"✗ Nepodařilo se upravit config.h: {exc}")
        return JsonResponse({
            'status': 'error',
            'message': 'Konfigurační soubor se nepodařilo upravit. Zkontrolujte oprávnění serveru.'
        }, status=500)
    except FileNotFoundError as exc:
        print(f"✗ PlatformIO CLI nebyl nalezen: {exc}")
        return JsonResponse({
            'status': 'error',
            'message': 'Na serveru není nainstalováno PlatformIO. Bez něj nelze nahrávat firmware. Zkontrolujte, zda je PlatformIO Core nainstalován a dostupný v PATH.'
        }, status=500)
    except OSError as exc:
        print(f"✗ PlatformIO se nepodařilo spustit: {exc}")
        return JsonResponse({
            'status': 'error',
            'message': f'PlatformIO se nepodařilo spustit: {exc}'
        }, status=500)
    except BoardManagerError as exc:
        print(f"✗ Chyba při nahrávání firmware: {exc}")
        return JsonResponse({
            'status': 'error',
            'message': f'Chyba při nahrávání firmware: {exc}'
        }, status=500)

    log_excerpt = summarize_logs(stdout, stderr)

    if return_code != 0:
        print(f"✗ Nahrávání přes PlatformIO pro desku '{board_name}' (SSID: '{ssid}') selhalo.")
        return JsonResponse({
            'status': 'error',
            'message': 'Nahrávání firmware selhalo. Podrobnosti najdete v logu.',
            'log_excerpt': log_excerpt
        }, status=500)

    print(f"✓ Nahrávání přes PlatformIO pro desku '{board_name}' (SSID: '{ssid}') proběhlo úspěšně.")
    return JsonResponse({
        'status': 'success',
        'message': f'Firmware byl na desku "{board_name}" úspěšně nahrán.',
        'log_excerpt': log_excerpt
    }, status=200)


# Admin API endpoints
ADMIN_USERNAME = 'gymzr_admin'
ADMIN_PASSWORD = '8266brainguard'


def check_admin_auth(request):
    """Check if request has valid admin authentication"""
    # Check session-based authentication
    if request.session.get('admin_authenticated', False):
        return True
    # Also check header for API calls (for development/testing)
    username = request.headers.get('X-Admin-User')
    return username == ADMIN_USERNAME


@csrf_exempt
@require_http_methods(["POST"])
def admin_login(request):
    """Admin login endpoint"""
    try:
        data = json.loads(request.body)
        username = data.get('username', '').strip()
        password = data.get('password', '')

        if username == ADMIN_USERNAME and password == ADMIN_PASSWORD:
            request.session['admin_authenticated'] = True
            request.session['admin_username'] = username
            return JsonResponse({
                'status': 'success',
                'message': 'Přihlášení úspěšné',
                'username': username
            }, status=200)
        else:
            return JsonResponse({
                'status': 'error',
                'message': 'Neplatné přihlašovací údaje'
            }, status=401)
    except json.JSONDecodeError:
        return JsonResponse({
            'status': 'error',
            'message': 'Neplatný formát požadavku'
        }, status=400)
    except Exception as e:
        return JsonResponse({
            'status': 'error',
            'message': f'Chyba při přihlašování: {str(e)}'
        }, status=500)


@require_http_methods(["GET"])
def debug_build_info(request):
    """Debug endpoint to check React build directory location"""
    react_build_dir = get_react_build_dir()
    info = {
        'react_build_dir': str(react_build_dir) if react_build_dir else None,
        'react_build_exists': react_build_dir.exists() if react_build_dir else False,
        'index_html_exists': (react_build_dir / 'index.html').exists() if react_build_dir else False,
        'assets_dir_exists': (react_build_dir / 'assets').exists() if react_build_dir else False,
        'base_dir': str(settings.BASE_DIR),
        'cwd': str(Path.cwd()),
        'possible_paths': [
            str(Path(settings.BASE_DIR).parent / 'frontend' / 'dist'),
            str(Path(settings.BASE_DIR).parent.parent / 'frontend' / 'dist'),
        ],
    }
    
    if react_build_dir:
        assets_dir = react_build_dir / 'assets'
        if assets_dir.exists():
            try:
                asset_files = list(assets_dir.iterdir())[:10]  # First 10 files
                info['sample_assets'] = [f.name for f in asset_files]
            except Exception as e:
                info['assets_error'] = str(e)
    
    return JsonResponse(info)


@require_http_methods(["GET"])
def get_devices(request):
    """Get list of all devices with status info (public endpoint, no auth required)"""
    try:
        collection = get_mongo_collection()
    except RuntimeError as e:
        return JsonResponse({
            'status': 'error',
            'message': f'Nepodařilo se připojit k databázi: {str(e)}'
        }, status=503)

    try:
        now = datetime.now(UTC)
        cutoff_time = now - timedelta(minutes=5)  # Consider device online if seen in last 5 minutes
        
        devices = []
        processed_macs = set()
        
        # Get devices with MAC addresses from registry
        try:
            registry = get_registry_collection()
            if registry is None:
                registry_entries = []
            else:
                registry_entries = list(registry.find({}))
            
            for entry in registry_entries:
                mac = entry.get('mac_address')
                if not mac:
                    print("⚠️  Skipping registry entry without mac_address")
                    continue
                processed_macs.add(mac)
                
                # Get sensor data for this MAC (timeseries format with backward compatibility)
                mac_filter = {
                    '$or': [
                        {'metadata.mac_address': mac},
                        {'mac_address': mac}  # Backward compatibility
                    ]
                }
                total_count = collection.count_documents(mac_filter)
                
                status = 'offline'
                last_seen = None
                current_readings = None
                device_id = entry.get('legacy_device_id')
                
                if total_count > 0:
                    latest_doc = collection.find_one(mac_filter, sort=[('timestamp', -1)])
                    
                    if latest_doc:
                        # Get device_id from latest doc if not in registry (with backward compatibility)
                        if not device_id:
                            metadata = latest_doc.get('metadata', {})
                            device_id = metadata.get('device_id') or latest_doc.get('device_id')
                        
                        last_seen_dt = latest_doc.get('timestamp')
                        if last_seen_dt:
                            if isinstance(last_seen_dt, datetime):
                                last_seen = to_readable_timestamp(last_seen_dt)
                                if last_seen_dt >= cutoff_time:
                                    status = 'online'
                            
                            # Get voltage from top-level or fall back to raw_payload
                            voltage = latest_doc.get('voltage')
                            if voltage is None:
                                raw_payload = latest_doc.get('raw_payload', {})
                                if isinstance(raw_payload, dict):
                                    voltage = raw_payload.get('voltage')
                            
                            current_readings = {
                                'temperature': latest_doc.get('temperature'),
                                'humidity': latest_doc.get('humidity'),
                                'co2': latest_doc.get('co2'),
                                'voltage': voltage
                            }
                
                devices.append({
                    'mac_address': mac,
                    'display_name': entry.get('display_name', mac),
                    'device_id': device_id,
                    'status': status,
                    'total_data_points': total_count,
                    'last_seen': last_seen,
                    'current_readings': current_readings
                })
        except Exception as e:
            print(f"⚠️  Warning: Could not access registry: {e}")
        
        # Get legacy devices (by device_id, excluding those with MAC)
        # Support both old and new formats
        all_device_ids_old = collection.distinct('device_id')
        all_device_ids_new = collection.distinct('metadata.device_id')
        # Filter out None/null values
        all_device_ids = [did for did in set(all_device_ids_old + all_device_ids_new) if did is not None]
        
        devices_with_mac = set()
        # Check for MAC addresses in both old and new formats
        for doc in collection.find({
            '$or': [
                {'mac_address': {'$exists': True, '$ne': None}},
                {'metadata.mac_address': {'$exists': True, '$ne': None}}
            ]
        }, {'device_id': 1, 'metadata': 1}):
            metadata = doc.get('metadata', {})
            did = metadata.get('device_id') or doc.get('device_id')
            if did:
                devices_with_mac.add(did)
        
        legacy_device_ids = [did for did in all_device_ids if did not in devices_with_mac and did is not None]
        
        for device_id in legacy_device_ids:
            if not device_id:  # Skip None, empty string, etc.
                continue
            device_filter = {
                '$or': [
                    {'metadata.device_id': device_id},
                    {'device_id': device_id}  # Backward compatibility
                ]
            }
            total_count = collection.count_documents(device_filter)
            
            latest_doc = collection.find_one(
                device_filter,
                sort=[('timestamp', -1)]
            )
            
            status = 'offline'
            last_seen = None
            current_readings = None
            
            if latest_doc:
                last_seen_dt = latest_doc.get('timestamp')
                if last_seen_dt:
                    if isinstance(last_seen_dt, datetime):
                        last_seen = to_readable_timestamp(last_seen_dt)
                        if last_seen_dt >= cutoff_time:
                            status = 'online'
                
                # Get voltage from top-level or fall back to raw_payload
                voltage = latest_doc.get('voltage')
                if voltage is None:
                    raw_payload = latest_doc.get('raw_payload', {})
                    if isinstance(raw_payload, dict):
                        voltage = raw_payload.get('voltage')
                
                current_readings = {
                    'temperature': latest_doc.get('temperature'),
                    'humidity': latest_doc.get('humidity'),
                    'co2': latest_doc.get('co2'),
                    'voltage': voltage
                }

            # Only add if device_id is valid
            if device_id:
                devices.append({
                    'mac_address': None,  # No MAC for legacy devices
                    'display_name': device_id,  # Use device_id as display name
                    'device_id': device_id,
                    'status': status,
                    'total_data_points': total_count,
                    'last_seen': last_seen,
                    'current_readings': current_readings
                })
        
        # Sort by display_name or device_id (guard against None)
        devices.sort(key=lambda x: x.get('display_name') or x.get('device_id') or '')
        
        return JsonResponse({
            'status': 'success',
            'devices': devices
        }, status=200)
    except PyMongoError as exc:
        return JsonResponse({
            'status': 'error',
            'message': f'Databázová chyba: {exc}'
        }, status=500)
    except Exception as exc:
        return JsonResponse({
            'status': 'error',
            'message': f'Chyba: {str(exc)}'
        }, status=500)


@require_http_methods(["GET"])
def admin_devices(request):
    """Get list of all devices with summary statistics"""
    if not check_admin_auth(request):
        return JsonResponse({
            'status': 'error',
            'message': 'Neautorizovaný přístup'
        }, status=401)

    try:
        collection = get_mongo_collection()
    except RuntimeError as e:
        return JsonResponse({
            'status': 'error',
            'message': f'Nepodařilo se připojit k databázi: {str(e)}'
        }, status=503)

    try:
        now = datetime.now(UTC)
        cutoff_time = now - timedelta(minutes=5)  # Consider device online if seen in last 5 minutes
        
        # Get devices with MAC addresses (from registry)
        try:
            registry = get_registry_collection()
            if registry is None:
                registry_entries = []
            else:
                registry_entries = list(registry.find({}))
            mac_to_display = {entry['mac_address']: entry.get('display_name', entry['mac_address']) 
                              for entry in registry_entries}
        except Exception as e:
            print(f"⚠️  Warning: Could not access registry: {e}")
            registry_entries = []
            mac_to_display = {}
        
        devices = []
        processed_macs = set()
        
        # Process devices with MAC addresses
        for entry in registry_entries:
            mac = entry['mac_address']
            processed_macs.add(mac)
            
            # Get sensor data for this MAC (timeseries format with backward compatibility)
            mac_filter = {
                '$or': [
                    {'metadata.mac_address': mac},
                    {'mac_address': mac}  # Backward compatibility
                ]
            }
            total_count = collection.count_documents(mac_filter)
            
            if total_count > 0:
                latest_doc = collection.find_one(mac_filter, sort=[('timestamp', -1)])
                
                status = 'offline'
                last_seen = None
                current_readings = None
                
                if latest_doc:
                    last_seen_dt = latest_doc.get('timestamp')
                    if last_seen_dt:
                        if isinstance(last_seen_dt, datetime):
                            last_seen = to_readable_timestamp(last_seen_dt)
                            if last_seen_dt >= cutoff_time:
                                status = 'online'
                        
                        # Get voltage from top-level or fall back to raw_payload
                        voltage = latest_doc.get('voltage')
                        if voltage is None:
                            raw_payload = latest_doc.get('raw_payload', {})
                            if isinstance(raw_payload, dict):
                                voltage = raw_payload.get('voltage')
                        
                        current_readings = {
                            'temperature': latest_doc.get('temperature'),
                            'humidity': latest_doc.get('humidity'),
                            'co2': latest_doc.get('co2'),
                            'voltage': voltage
                        }
                
                # Extract device_id from timeseries metadata or old format
                device_id = None
                if latest_doc:
                    metadata = latest_doc.get('metadata', {})
                    device_id = metadata.get('device_id') or latest_doc.get('device_id')
                
                devices.append({
                    'mac_address': mac,
                    'display_name': entry.get('display_name', mac),
                    'device_id': device_id or entry.get('legacy_device_id'),
                    'class': entry.get('class', ''),
                    'school': entry.get('school', ''),
                    'room_code': entry.get('room_code', ''),
                    'status': status,
                    'total_data_points': total_count,
                    'last_seen': last_seen,
                    'current_readings': current_readings
                })
        
        # Only return MAC-tracked devices (legacy devices excluded)
        # This prevents duplicates and ensures all devices have MAC addresses for rename functionality

        # Sort by display_name or device_id (guard against None)
        devices.sort(key=lambda x: x.get('display_name') or x.get('device_id') or '')

        return JsonResponse({
            'status': 'success',
            'devices': devices
        }, status=200)

    except PyMongoError as exc:
        return JsonResponse({
            'status': 'error',
            'message': f'Databázová chyba: {exc}'
        }, status=500)
    except Exception as exc:
        return JsonResponse({
            'status': 'error',
            'message': f'Chyba: {str(exc)}'
        }, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def admin_rename_device(request, mac_address):
    """Rename device by MAC address"""
    if not check_admin_auth(request):
        return JsonResponse({
            'status': 'error',
            'message': 'Neautorizovaný přístup'
        }, status=401)
    
    try:
        data = json.loads(request.body) if request.body else {}
        new_name = (data.get('display_name') or '').strip()
        
        if not new_name:
            return JsonResponse({
                'status': 'error',
                'message': 'Název je povinný'
            }, status=400)
        
        if len(new_name) > 100:
            return JsonResponse({
                'status': 'error',
                'message': 'Název nesmí být delší než 100 znaků'
            }, status=400)
        
        mac_normalized = normalize_mac_address(mac_address)
        registry = get_registry_collection()
        
        result = registry.update_one(
            {'mac_address': mac_normalized},
            {
                '$set': {
                    'display_name': new_name,
                    'updated_at': datetime.now(UTC)
                }
            }
        )
        
        if result.matched_count == 0:
            return JsonResponse({
                'status': 'error',
                'message': 'Zařízení nenalezeno'
            }, status=404)
        
        return JsonResponse({
            'status': 'success',
            'message': 'Název byl aktualizován',
            'mac_address': mac_normalized,
            'display_name': new_name
        }, status=200)
    except ValueError as e:
        return JsonResponse({
            'status': 'error',
            'message': f'Neplatná MAC adresa: {str(e)}'
        }, status=400)
    except Exception as e:
        return JsonResponse({
            'status': 'error',
            'message': f'Chyba: {str(e)}'
        }, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def admin_customize_device(request, mac_address):
    """Customize device by MAC address - update name, class, school, and room_code"""
    if not check_admin_auth(request):
        return JsonResponse({
            'status': 'error',
            'message': 'Neautorizovaný přístup'
        }, status=401)
    
    try:
        # Import room codes for validation
        from api.annotation.room_config import VALID_ROOM_CODES
        
        data = json.loads(request.body) if request.body else {}
        display_name = (data.get('display_name') or '').strip()
        class_name = (data.get('class') or '').strip()
        school = (data.get('school') or '').strip()
        room_code = (data.get('room_code') or '').strip()
        
        if not display_name:
            return JsonResponse({
                'status': 'error',
                'message': 'Name is required'
            }, status=400)
        
        if len(display_name) > 100:
            return JsonResponse({
                'status': 'error',
                'message': 'Name must not exceed 100 characters'
            }, status=400)
        
        if len(class_name) > 50:
            return JsonResponse({
                'status': 'error',
                'message': 'Class must not exceed 50 characters'
            }, status=400)
        
        if len(school) > 100:
            return JsonResponse({
                'status': 'error',
                'message': 'School must not exceed 100 characters'
            }, status=400)
        
        # Validate room_code if provided
        if room_code and room_code not in VALID_ROOM_CODES:
            return JsonResponse({
                'status': 'error',
                'message': f'Invalid room code: {room_code}. Valid codes are: {", ".join(VALID_ROOM_CODES[:10])}...'
            }, status=400)
        
        mac_normalized = normalize_mac_address(mac_address)
        registry = get_registry_collection()
        
        update_data = {
            '$set': {
                'display_name': display_name,
                'updated_at': datetime.now(UTC)
            }
        }
        
        # Add class if provided, otherwise unset it
        if class_name:
            update_data['$set']['class'] = class_name
        else:
            if '$unset' not in update_data:
                update_data['$unset'] = {}
            update_data['$unset']['class'] = ''
        
        # Add school if provided, otherwise unset it
        if school:
            update_data['$set']['school'] = school
        else:
            if '$unset' not in update_data:
                update_data['$unset'] = {}
            update_data['$unset']['school'] = ''
        
        # Add room_code if provided, otherwise unset it
        if room_code:
            update_data['$set']['room_code'] = room_code
        else:
            if '$unset' not in update_data:
                update_data['$unset'] = {}
            update_data['$unset']['room_code'] = ''
        
        result = registry.update_one(
            {'mac_address': mac_normalized},
            update_data
        )
        
        if result.matched_count == 0:
            return JsonResponse({
                'status': 'error',
                'message': 'Device not found'
            }, status=404)
        
        # Get updated entry
        updated_entry = registry.find_one({'mac_address': mac_normalized})
        
        return JsonResponse({
            'status': 'success',
            'message': 'Device customized successfully',
            'mac_address': mac_normalized,
            'display_name': display_name,
            'class': updated_entry.get('class', ''),
            'school': updated_entry.get('school', ''),
            'room_code': updated_entry.get('room_code', '')
        }, status=200)
    except ValueError as e:
        return JsonResponse({
            'status': 'error',
            'message': f'Invalid MAC address: {str(e)}'
        }, status=400)
    except Exception as e:
        return JsonResponse({
            'status': 'error',
            'message': f'Error: {str(e)}'
        }, status=500)


@require_http_methods(["GET"])
def debug_build_info(request):
    """Debug endpoint to check React build directory location"""
    from django.http import JsonResponse
    import os
    
    react_build_dir = get_react_build_dir()
    info = {
        'react_build_dir': str(react_build_dir) if react_build_dir else None,
        'react_build_exists': react_build_dir.exists() if react_build_dir else False,
        'index_html_exists': (react_build_dir / 'index.html').exists() if react_build_dir else False,
        'assets_dir_exists': (react_build_dir / 'assets').exists() if react_build_dir else False,
        'base_dir': str(settings.BASE_DIR),
        'cwd': str(Path.cwd()),
        'possible_paths': [
            str(Path(settings.BASE_DIR).parent / 'frontend' / 'dist'),
            str(Path(settings.BASE_DIR).parent.parent / 'frontend' / 'dist'),
        ],
    }
    
    if react_build_dir:
        assets_dir = react_build_dir / 'assets'
        if assets_dir.exists():
            try:
                asset_files = list(assets_dir.iterdir())[:10]  # First 10 files
                info['sample_assets'] = [f.name for f in asset_files]
            except Exception as e:
                info['assets_error'] = str(e)
    
    return JsonResponse(info)


@require_http_methods(["GET"])
def admin_device_stats(request, device_id):
    """Get detailed statistics for a specific device"""
    if not check_admin_auth(request):
        return JsonResponse({
            'status': 'error',
            'message': 'Neautorizovaný přístup'
        }, status=401)

    try:
        collection = get_mongo_collection()
    except RuntimeError as e:
        return JsonResponse({
            'status': 'error',
            'message': f'Nepodařilo se připojit k databázi: {str(e)}'
        }, status=503)

    try:
        # Check if device exists
        device_count = collection.count_documents({'device_id': device_id})
        if device_count == 0:
            return JsonResponse({
                'status': 'error',
                'message': f'Zařízení "{device_id}" nebylo nalezeno'
            }, status=404)

        # Get all data for this device
        mongo_filter = {'device_id': device_id}
        
        # Aggregate statistics
        pipeline = [
            {'$match': mongo_filter},
            {
                '$group': {
                    '_id': None,
                    'total_data_points': {'$sum': 1},
                    'temp_min': {'$min': '$temperature'},
                    'temp_max': {'$max': '$temperature'},
                    'temp_avg': {'$avg': '$temperature'},
                    'humidity_min': {'$min': '$humidity'},
                    'humidity_max': {'$max': '$humidity'},
                    'humidity_avg': {'$avg': '$humidity'},
                    'co2_min': {'$min': '$co2'},
                    'co2_max': {'$max': '$co2'},
                    'co2_avg': {'$avg': '$co2'},
                    'first_seen': {'$min': '$timestamp'},
                    'last_seen': {'$max': '$timestamp'},
                }
            }
        ]

        agg_result = list(collection.aggregate(pipeline))
        
        if not agg_result:
            return JsonResponse({
                'status': 'error',
                'message': 'Nepodařilo se získat statistiky zařízení'
            }, status=500)

        stats_doc = agg_result[0]
        
        # Get latest reading for current values
        latest_doc = collection.find_one(
            mongo_filter,
            sort=[('timestamp', -1)]
        )

        # Determine status
        status = 'offline'
        if latest_doc:
            latest_ts = latest_doc.get('timestamp')
            if latest_ts and isinstance(latest_ts, datetime):
                cutoff_time = datetime.now(UTC) - timedelta(minutes=5)
                if latest_ts >= cutoff_time:
                    status = 'online'

        stats = {
            'device_id': device_id,
            'status': status,
            'total_data_points': stats_doc.get('total_data_points', 0),
            'first_seen': to_readable_timestamp(stats_doc.get('first_seen')),
            'last_seen': to_readable_timestamp(stats_doc.get('last_seen')),
            'temperature': {
                'current': round_or_none(latest_doc.get('temperature') if latest_doc else None),
                'min': round_or_none(stats_doc.get('temp_min')),
                'max': round_or_none(stats_doc.get('temp_max')),
                'avg': round_or_none(stats_doc.get('temp_avg'))
            },
            'humidity': {
                'current': round_or_none(latest_doc.get('humidity') if latest_doc else None),
                'min': round_or_none(stats_doc.get('humidity_min')),
                'max': round_or_none(stats_doc.get('humidity_max')),
                'avg': round_or_none(stats_doc.get('humidity_avg'))
            },
            'co2': {
                'current': latest_doc.get('co2') if latest_doc else None,
                'min': stats_doc.get('co2_min'),
                'max': stats_doc.get('co2_max'),
                'avg': round_or_none(stats_doc.get('co2_avg'))
            }
        }

        return JsonResponse({
            'status': 'success',
            'stats': stats
        }, status=200)

    except PyMongoError as exc:
        return JsonResponse({
            'status': 'error',
            'message': f'Databázová chyba: {exc}'
        }, status=500)
    except Exception as exc:
        return JsonResponse({
            'status': 'error',
            'message': f'Chyba: {str(exc)}'
        }, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def admin_merge_device(request):
    """Merge a legacy device into a MAC-tracked device"""
    if not check_admin_auth(request):
        return JsonResponse({
            'status': 'error',
            'message': 'Neautorizovaný přístup'
        }, status=401)

    try:
        data = json.loads(request.body) if request.body else {}
        source_device_id = data.get('source_device_id', '').strip()
        target_mac = data.get('target_mac', '').strip()
        
        if not source_device_id:
            return JsonResponse({
                'status': 'error',
                'message': 'source_device_id je povinný'
            }, status=400)
        
        if not target_mac:
            return JsonResponse({
                'status': 'error',
                'message': 'target_mac je povinný'
            }, status=400)
        
        # Normalize MAC address
        try:
            target_mac_normalized = normalize_mac_address(target_mac)
        except ValueError as e:
            return JsonResponse({
                'status': 'error',
                'message': f'Neplatná MAC adresa: {str(e)}'
            }, status=400)
        
        collection = get_mongo_collection()
        
        # Find documents to migrate (legacy data without MAC)
        migrate_filter = {
            'device_id': source_device_id,
            '$or': [
                {'mac_address': {'$exists': False}},
                {'mac_address': None}
            ]
        }
        
        count_to_migrate = collection.count_documents(migrate_filter)
        
        if count_to_migrate == 0:
            return JsonResponse({
                'status': 'error',
                'message': f'Zařízení "{source_device_id}" nebylo nalezeno nebo nemá data k migraci'
            }, status=404)
        
        # Update all matching documents to add the target MAC address
        result = collection.update_many(
            migrate_filter,
            {'$set': {'mac_address': target_mac_normalized}}
        )
        
        return JsonResponse({
            'status': 'success',
            'message': f'Data ze zařízení "{source_device_id}" byla přesunuta pod MAC {target_mac_normalized}',
            'migrated_data_points': result.modified_count
        }, status=200)

    except PyMongoError as exc:
        return JsonResponse({
            'status': 'error',
            'message': f'Databázová chyba: {exc}'
        }, status=500)
    except Exception as exc:
        return JsonResponse({
            'status': 'error',
            'message': f'Chyba: {str(exc)}'
        }, status=500)


@csrf_exempt
@require_http_methods(["DELETE"])
def admin_delete_device(request, device_id):
    """Delete a legacy device (by device_id) and all its data"""
    if not check_admin_auth(request):
        return JsonResponse({
            'status': 'error',
            'message': 'Neautorizovaný přístup'
        }, status=401)

    try:
        collection = get_mongo_collection()
    except RuntimeError as e:
        return JsonResponse({
            'status': 'error',
            'message': f'Nepodařilo se připojit k databázi: {str(e)}'
        }, status=503)

    try:
        # Only delete data WITHOUT mac_address (legacy devices)
        # This prevents accidentally deleting data from MAC-tracked devices
        delete_filter = {
            'device_id': device_id,
            '$or': [
                {'mac_address': {'$exists': False}},
                {'mac_address': None}
            ]
        }
        
        # Count how many documents will be deleted
        count_to_delete = collection.count_documents(delete_filter)
        
        if count_to_delete == 0:
            return JsonResponse({
                'status': 'error',
                'message': f'Zařízení "{device_id}" nebylo nalezeno nebo má přiřazenou MAC adresu (nelze smazat)'
            }, status=404)
        
        # Delete the sensor data
        result = collection.delete_many(delete_filter)
        
        return JsonResponse({
            'status': 'success',
            'message': f'Zařízení "{device_id}" bylo úspěšně odstraněno',
            'deleted_data_points': result.deleted_count
        }, status=200)

    except PyMongoError as exc:
        return JsonResponse({
            'status': 'error',
            'message': f'Databázová chyba: {exc}'
        }, status=500)
    except Exception as exc:
        return JsonResponse({
            'status': 'error',
            'message': f'Chyba: {str(exc)}'
        }, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def ai_chat(request):
    """AI assistant chat endpoint using Gemini API"""
    try:
        data = json.loads(request.body) if request.body else {}
        user_query = data.get('message', '').strip()
        device_id = data.get('device_id', None)
        
        if not user_query:
            return JsonResponse({
                'status': 'error',
                'message': 'Zpráva je povinná'
            }, status=400)
        
        # Import here to avoid circular imports
        from .ai_service import process_ai_query
        
        result = process_ai_query(user_query, device_id)
        
        if result['status'] == 'error':
            return JsonResponse({
                'status': 'error',
                'message': result.get('response', 'An error occurred'),
                'error': result.get('error')
            }, status=500)
        
        return JsonResponse({
            'status': 'success',
            'response': result['response'],
            'dataUsed': result.get('dataUsed', {})
        }, status=200)
    
    except json.JSONDecodeError:
        return JsonResponse({
            'status': 'error',
            'message': 'Neplatný JSON v těle požadavku'
        }, status=400)
    except Exception as e:
        print(f"Error in ai_chat endpoint: {e}")
        return JsonResponse({
            'status': 'error',
            'message': f'Došlo k chybě: {str(e)}'
        }, status=500)


# ==================== MAC Address Whitelist Management ====================

@require_http_methods(["GET"])
def admin_whitelist_status(request):
    """Get the current whitelist enabled status"""
    if not check_admin_auth(request):
        return JsonResponse({
            'status': 'error',
            'message': 'Neautorizovaný přístup'
        }, status=401)
    
    try:
        enabled = is_whitelist_enabled()
        
        # Also get count of whitelisted vs non-whitelisted devices
        registry = get_registry_collection()
        total_devices = registry.count_documents({})
        whitelisted_devices = registry.count_documents({'whitelisted': True})
        non_whitelisted_devices = registry.count_documents({'whitelisted': False})
        # Count devices without explicit whitelisted field (legacy, treated as whitelisted)
        legacy_devices = total_devices - whitelisted_devices - non_whitelisted_devices
        
        return JsonResponse({
            'status': 'success',
            'whitelist_enabled': enabled,
            'device_counts': {
                'total': total_devices,
                'whitelisted': whitelisted_devices + legacy_devices,  # Legacy devices count as whitelisted
                'not_whitelisted': non_whitelisted_devices,
                'legacy_without_field': legacy_devices
            }
        }, status=200)
    except Exception as e:
        return JsonResponse({
            'status': 'error',
            'message': f'Chyba: {str(e)}'
        }, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def admin_whitelist_toggle(request):
    """Enable or disable MAC address whitelisting"""
    if not check_admin_auth(request):
        return JsonResponse({
            'status': 'error',
            'message': 'Neautorizovaný přístup'
        }, status=401)
    
    try:
        data = json.loads(request.body) if request.body else {}
        enabled = data.get('enabled')
        
        if enabled is None:
            return JsonResponse({
                'status': 'error',
                'message': 'Pole "enabled" je povinné (true/false)'
            }, status=400)
        
        if not isinstance(enabled, bool):
            return JsonResponse({
                'status': 'error',
                'message': 'Pole "enabled" musí být boolean (true/false)'
            }, status=400)
        
        settings = get_settings_collection()
        settings.update_one(
            {'key': 'whitelist_enabled'},
            {
                '$set': {
                    'value': enabled,
                    'updated_at': datetime.now(UTC)
                }
            },
            upsert=True
        )
        
        action = 'zapnuto' if enabled else 'vypnuto'
        print(f"✓ MAC address whitelisting {action}")
        
        return JsonResponse({
            'status': 'success',
            'message': f'Filtrování MAC adres bylo {"zapnuto" if enabled else "vypnuto"}',
            'whitelist_enabled': enabled
        }, status=200)
    except json.JSONDecodeError:
        return JsonResponse({
            'status': 'error',
            'message': 'Neplatný JSON v těle požadavku'
        }, status=400)
    except Exception as e:
        return JsonResponse({
            'status': 'error',
            'message': f'Chyba: {str(e)}'
        }, status=500)


@require_http_methods(["GET"])
def admin_whitelist_devices(request):
    """Get all devices with their whitelist status"""
    if not check_admin_auth(request):
        return JsonResponse({
            'status': 'error',
            'message': 'Neautorizovaný přístup'
        }, status=401)
    
    try:
        registry = get_registry_collection()
        entries = list(registry.find({}).sort('display_name', 1))
        
        devices = []
        for entry in entries:
            # Default to True for backward compatibility (legacy devices without the field)
            is_whitelisted = entry.get('whitelisted', True)
            
            devices.append({
                'mac_address': entry.get('mac_address'),
                'display_name': entry.get('display_name', entry.get('mac_address')),
                'device_id': entry.get('legacy_device_id'),
                'whitelisted': is_whitelisted,
                'last_data_received': to_readable_timestamp(entry.get('last_data_received')),
                'created_at': to_readable_timestamp(entry.get('created_at'))
            })
        
        return JsonResponse({
            'status': 'success',
            'whitelist_enabled': is_whitelist_enabled(),
            'devices': devices
        }, status=200)
    except Exception as e:
        return JsonResponse({
            'status': 'error',
            'message': f'Chyba: {str(e)}'
        }, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def admin_whitelist_set(request, mac_address):
    """Set whitelist status for a specific MAC address"""
    if not check_admin_auth(request):
        return JsonResponse({
            'status': 'error',
            'message': 'Neautorizovaný přístup'
        }, status=401)
    
    try:
        data = json.loads(request.body) if request.body else {}
        whitelisted = data.get('whitelisted')
        
        if whitelisted is None:
            return JsonResponse({
                'status': 'error',
                'message': 'Pole "whitelisted" je povinné (true/false)'
            }, status=400)
        
        if not isinstance(whitelisted, bool):
            return JsonResponse({
                'status': 'error',
                'message': 'Pole "whitelisted" musí být boolean (true/false)'
            }, status=400)
        
        try:
            mac_normalized = normalize_mac_address(mac_address)
        except ValueError as e:
            return JsonResponse({
                'status': 'error',
                'message': f'Neplatná MAC adresa: {str(e)}'
            }, status=400)
        
        registry = get_registry_collection()
        result = registry.update_one(
            {'mac_address': mac_normalized},
            {
                '$set': {
                    'whitelisted': whitelisted,
                    'updated_at': datetime.now(UTC)
                }
            }
        )
        
        if result.matched_count == 0:
            return JsonResponse({
                'status': 'error',
                'message': f'Zařízení s MAC adresou {mac_normalized} nebylo nalezeno'
            }, status=404)
        
        action = 'přidáno do' if whitelisted else 'odebráno z'
        print(f"✓ Zařízení {mac_normalized} bylo {action} whitelistu")
        
        return JsonResponse({
            'status': 'success',
            'message': f'Zařízení bylo {"přidáno do" if whitelisted else "odebráno z"} whitelistu',
            'mac_address': mac_normalized,
            'whitelisted': whitelisted
        }, status=200)
    except json.JSONDecodeError:
        return JsonResponse({
            'status': 'error',
            'message': 'Neplatný JSON v těle požadavku'
        }, status=400)
    except Exception as e:
        return JsonResponse({
            'status': 'error',
            'message': f'Chyba: {str(e)}'
        }, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def admin_whitelist_all(request):
    """Whitelist all existing MAC addresses in the registry"""
    if not check_admin_auth(request):
        return JsonResponse({
            'status': 'error',
            'message': 'Neautorizovaný přístup'
        }, status=401)
    
    try:
        registry = get_registry_collection()
        
        # Update all entries to be whitelisted
        result = registry.update_many(
            {},
            {
                '$set': {
                    'whitelisted': True,
                    'updated_at': datetime.now(UTC)
                }
            }
        )
        
        print(f"✓ Všechna zařízení ({result.modified_count}) byla přidána do whitelistu")
        
        return JsonResponse({
            'status': 'success',
            'message': f'Všechna zařízení ({result.modified_count}) byla přidána do whitelistu',
            'updated_count': result.modified_count
        }, status=200)
    except Exception as e:
        return JsonResponse({
            'status': 'error',
            'message': f'Chyba: {str(e)}'
        }, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def admin_whitelist_add_mac(request):
    """Add a new MAC address to the whitelist (create registry entry if needed)"""
    if not check_admin_auth(request):
        return JsonResponse({
            'status': 'error',
            'message': 'Neautorizovaný přístup'
        }, status=401)
    
    try:
        data = json.loads(request.body) if request.body else {}
        mac_address = data.get('mac_address', '').strip()
        display_name = data.get('display_name', '').strip()
        
        if not mac_address:
            return JsonResponse({
                'status': 'error',
                'message': 'MAC adresa je povinná'
            }, status=400)
        
        try:
            mac_normalized = normalize_mac_address(mac_address)
        except ValueError as e:
            return JsonResponse({
                'status': 'error',
                'message': f'Neplatná MAC adresa: {str(e)}'
            }, status=400)
        
        registry = get_registry_collection()
        now = datetime.now(UTC)
        
        # Check if already exists
        existing = registry.find_one({'mac_address': mac_normalized})
        
        if existing:
            # Update existing entry to be whitelisted
            registry.update_one(
                {'mac_address': mac_normalized},
                {
                    '$set': {
                        'whitelisted': True,
                        'updated_at': now
                    }
                }
            )
            return JsonResponse({
                'status': 'success',
                'message': f'Zařízení {mac_normalized} již existuje a bylo přidáno do whitelistu',
                'mac_address': mac_normalized,
                'display_name': existing.get('display_name', mac_normalized),
                'created': False
            }, status=200)
        
        # Create new entry
        entry = {
            'mac_address': mac_normalized,
            'display_name': display_name or mac_normalized,
            'created_at': now,
            'updated_at': now,
            'whitelisted': True
        }
        
        registry.insert_one(entry)
        
        print(f"✓ Nové zařízení {mac_normalized} bylo přidáno do whitelistu")
        
        return JsonResponse({
            'status': 'success',
            'message': f'Nové zařízení {mac_normalized} bylo přidáno do whitelistu',
            'mac_address': mac_normalized,
            'display_name': display_name or mac_normalized,
            'created': True
        }, status=200)
    except json.JSONDecodeError:
        return JsonResponse({
            'status': 'error',
            'message': 'Neplatný JSON v těle požadavku'
        }, status=400)
    except Exception as e:
        return JsonResponse({
            'status': 'error',
            'message': f'Chyba: {str(e)}'
        }, status=500)


# ==================== Annotation System Endpoints ====================

@require_http_methods(["GET"])
def get_room_codes(request):
    """Get list of valid room codes for BakalAPI annotation"""
    try:
        from api.annotation.room_config import get_room_options, VALID_ROOM_CODES
        
        return JsonResponse({
            'status': 'success',
            'room_codes': VALID_ROOM_CODES,
            'room_options': get_room_options(),
            'total': len(VALID_ROOM_CODES)
        }, status=200)
    except Exception as e:
        return JsonResponse({
            'status': 'error',
            'message': f'Error: {str(e)}'
        }, status=500)


@require_http_methods(["GET"])
def annotation_status(request):
    """Get the status of the annotation system and scheduler"""
    try:
        from api.annotation.scheduler import get_scheduler_status
        from api.annotation.annotator import get_annotation_status
        
        scheduler_status = get_scheduler_status()
        annotation_status = get_annotation_status()
        
        return JsonResponse({
            'status': 'success',
            'scheduler': scheduler_status,
            'annotation': annotation_status
        }, status=200)
    except Exception as e:
        return JsonResponse({
            'status': 'error',
            'message': f'Error: {str(e)}'
        }, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def annotation_run(request):
    """Manually trigger annotation for a specific date"""
    if not check_admin_auth(request):
        return JsonResponse({
            'status': 'error',
            'message': 'Neautorizovaný přístup'
        }, status=401)
    
    try:
        from api.annotation.scheduler import trigger_annotation_now
        from datetime import date as dt_date
        
        data = json.loads(request.body) if request.body else {}
        date_str = data.get('date')
        
        target_date = None
        if date_str:
            try:
                target_date = dt_date.fromisoformat(date_str)
            except ValueError:
                return JsonResponse({
                    'status': 'error',
                    'message': f'Invalid date format: {date_str}. Use YYYY-MM-DD'
                }, status=400)
        
        result = trigger_annotation_now(target_date)
        
        return JsonResponse({
            'status': 'success',
            'message': f'Annotation completed for {result.get("date")}',
            'result': {
                'date': result.get('date'),
                'summary': result.get('summary')
            }
        }, status=200)
    except Exception as e:
        return JsonResponse({
            'status': 'error',
            'message': f'Error: {str(e)}'
        }, status=500)