# Technical Implementation Plan: MAC Address-Based Device Tracking

**Plan Date**: 2024-12-19  
**Status**: Planned  
**Owner**: Development Team  
**Related Documents**: [Feature Brief](feature-brief.md) | [Research](research.md) | [Specification](spec.md)

---

## 📋 Plan Overview

**Feature**: MAC Address-Based Device Tracking  
**Objective**: Prevent duplicate device entries when renaming boards by tracking devices via hardware MAC addresses instead of configurable `device_id`  
**Approach**: Registry pattern with MAC address as primary identifier, display names as user-configurable metadata  
**Deployment**: Zero-downtime, backward-compatible rollout

---

## 🎯 Implementation Objectives

1. ✅ Extract and transmit MAC addresses from ESP8266 firmware
2. ✅ Create device registry collection mapping MAC addresses to display names
3. ✅ Update backend to use MAC addresses for device identification
4. ✅ Provide admin UI for renaming devices without firmware re-upload
5. ✅ Maintain full backward compatibility with existing `device_id`-based system
6. ✅ Achieve zero duplicate devices after rename operations

---

## 🏗️ Architecture Overview

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                         Firmware Layer                       │
│  ┌──────────────┐                                           │
│  │ WiFi Init    │ → Extract MAC → Cache Globally            │
│  └──────┬───────┘                                           │
│         │                                                   │
│         ▼                                                   │
│  ┌──────────────┐                                           │
│  │ Sensor Read  │ → Include MAC in JSON Payload             │
│  └──────┬───────┘                                           │
└─────────┼───────────────────────────────────────────────────┘
          │ HTTP POST
          ▼
┌─────────────────────────────────────────────────────────────┐
│                        Backend API Layer                     │
│  ┌──────────────┐                                           │
│  │ Receive Data │ → Normalize MAC → Validate                │
│  └──────┬───────┘                                           │
│         │                                                   │
│         ▼                                                   │
│  ┌──────────────┐                                           │
│  │ Registry Mgr │ → Ensure Entry Exists → Update Timestamps │
│  └──────┬───────┘                                           │
│         │                                                   │
│         ▼                                                   │
│  ┌──────────────┐                                           │
│  │ Store Data   │ → sensor_data (mac_address + device_id)   │
│  └──────┬───────┘                                           │
└─────────┼───────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────┐
│                       MongoDB Storage                        │
│  ┌──────────────────┐  ┌──────────────────┐                │
│  │ device_registry  │  │  sensor_data     │                │
│  │ - mac_address*   │  │  - mac_address   │                │
│  │ - display_name   │  │  - device_id     │                │
│  │ - timestamps     │  │  - sensor values │                │
│  └──────────────────┘  └──────────────────┘                │
└─────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────┐
│                       Frontend Layer                         │
│  ┌──────────────┐                                           │
│  │ Device List  │ → Display Name from Registry              │
│  └──────┬───────┘                                           │
│         │                                                   │
│         ▼                                                   │
│  ┌──────────────┐                                           │
│  │ Rename UI    │ → POST /admin/devices/{mac}/rename        │
│  └──────────────┘                                           │
└─────────────────────────────────────────────────────────────┘
```

### Design Patterns

**1. Registry Pattern**
- MAC address as immutable hardware identifier
- Display name as mutable user-facing metadata
- Registry decouples hardware identity from presentation

**2. Dual-Identifier Lookup**
- Primary: MAC address (for new devices)
- Fallback: `device_id` (for legacy devices)
- Automatic selection based on data availability

**3. Lazy Collection Initialization**
- Registry collection created on first access
- Follows existing MongoDB pattern in codebase
- Idempotent index creation

**4. Auto-Registration**
- Registry entries created automatically on first data reception
- No manual intervention required
- Default display name set intelligently

### Data Flow

1. **Firmware**: Extract MAC address after WiFi initialization, cache globally
2. **Payload Creation**: Include MAC address in sensor JSON payload (optional field)
3. **Data Reception**: Backend receives payload, normalizes MAC address
4. **Registry Lookup**: Check if registry entry exists for MAC address
5. **Auto-Creation**: Create registry entry if missing (first-time device)
6. **Data Storage**: Store sensor data with both `mac_address` and `device_id`
7. **Registry Update**: Update `last_data_received` timestamp in registry
8. **API Response**: Device listing merges registry data with sensor statistics

---

## 🔧 Technology Stack

### Existing Technologies (No New Dependencies)

**Firmware**:
- ESP8266 Arduino Core (via PlatformIO)
- ESP8266WiFi library (MAC address extraction)
- ArduinoJson v6.21.3 (payload serialization)
- HTTPClient (data transmission)

**Backend**:
- Python 3.x / Django
- pymongo (MongoDB driver)
- Existing MongoDB infrastructure

**Frontend**:
- React
- Existing component library
- Axios for API calls

### Technology Justification

- **No New Dependencies**: All required libraries already available
- **Minimal Changes**: Leverages existing patterns and infrastructure
- **Backward Compatible**: Works alongside existing system without disruption

---

## 📊 Data Model

### device_registry Collection Schema

```python
{
    "_id": ObjectId,                    # MongoDB auto-generated
    "mac_address": str,                 # "AA:BB:CC:DD:EE:FF" (unique, indexed)
    "display_name": str,                # User-friendly name (required)
    "created_at": datetime,             # UTC timestamp
    "updated_at": datetime,             # UTC timestamp (last modification)
    "last_data_received": datetime,     # UTC timestamp (last sensor data)
    "legacy_device_id": str             # Optional: last known device_id
}
```

**Indexes**:
```python
# Primary unique index
create_index([('mac_address', ASCENDING)], unique=True)

# Performance indexes
create_index([('display_name', ASCENDING)])           # For search/filter
create_index([('last_data_received', ASCENDING)])     # For offline detection
```

**Collection Initialization** (following existing pattern):
```python
_registry_collection = None

def get_registry_collection():
    global _registry_collection
    if _registry_collection is None:
        client = MongoClient(MONGO_URI, ...)
        db = client[MONGO_DB_NAME]
        _registry_collection = db['device_registry']
        _registry_collection.create_index(
            [('mac_address', ASCENDING)], 
            unique=True
        )
        # Optional performance indexes
        _registry_collection.create_index([('display_name', ASCENDING)])
        _registry_collection.create_index([('last_data_received', ASCENDING)])
    return _registry_collection
```

### Enhanced sensor_data Collection Schema

**Existing Fields** (unchanged):
- `timestamp`: datetime
- `timestamp_str`: string
- `device_id`: string (required for backward compatibility)
- `temperature`: float
- `humidity`: float
- `co2`: int
- `raw_payload`: dict

**New Field** (optional):
- `mac_address`: string (optional, for new devices)

**Indexes** (enhanced):
```python
# Existing index (keep)
create_index([('device_id', ASCENDING), ('timestamp', ASCENDING)])

# New sparse index (for MAC-based queries)
create_index([('mac_address', ASCENDING), ('timestamp', ASCENDING)])
```

### Data Relationships

```
device_registry (1) ←→ (many) sensor_data
   mac_address              mac_address (foreign key)
   
Legacy devices:
   (no registry entry) ←→ (many) sensor_data
                           device_id only
```

---

## 🔌 API Design

### New Endpoint: Device Rename

**Endpoint**: `POST /api/admin/devices/{mac_address}/rename`

**Authentication**: Required (admin only)

**Request**:
```http
POST /api/admin/devices/AA:BB:CC:DD:EE:FF/rename
Content-Type: application/json

{
    "display_name": "Classroom A"
}
```

**Success Response (200)**:
```json
{
    "status": "success",
    "message": "Device renamed successfully",
    "mac_address": "AA:BB:CC:DD:EE:FF",
    "display_name": "Classroom A"
}
```

**Error Responses**:
- `401 Unauthorized`: Not authenticated as admin
- `400 Bad Request`: Invalid MAC format or empty display_name
- `404 Not Found`: MAC address not in registry
- `500 Internal Server Error`: Database error

**Implementation**:
```python
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
        data = json.loads(request.body)
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
```

### Modified Endpoint: Device Listing

**Endpoint**: `GET /api/admin/devices` (enhanced)

**Response Structure** (enhanced):
```json
{
    "status": "success",
    "devices": [
        {
            "mac_address": "AA:BB:CC:DD:EE:FF",      // New
            "display_name": "Classroom A",             // New
            "device_id": "ESP8266A2",                  // Kept
            "status": "online",
            "total_data_points": 1234,
            "last_seen": "2024-12-19 14:30:00",
            "current_readings": {
                "temperature": 22.5,
                "humidity": 45.2,
                "co2": 850
            }
        }
    ]
}
```

**Implementation Changes**:
1. Query devices with MAC addresses (from registry + sensor data)
2. Query legacy devices (by device_id, exclude those with MAC)
3. Merge registry data (display_name) with sensor statistics
4. Return unified list with both new and legacy devices

### Modified Endpoint: Data Reception

**Endpoint**: `POST /api/data` (enhanced)

**Changes**:
1. Extract `mac_address` from payload (if present)
2. Normalize MAC address format
3. Ensure registry entry exists (create if missing)
4. Store both `mac_address` and `device_id` in sensor document
5. Update registry `last_data_received` timestamp

---

## 🧩 Component Implementation

### 1. Firmware: MAC Address Extraction

**File**: `src/main.cpp`

**Changes**:

1. **Add global MAC address variable**:
```cpp
// Global MAC address cache
String deviceMacAddress = "";

void setup() {
  // ... existing setup code ...
  
  // Connect WiFi
  connectWiFi();
  
  // Extract and cache MAC address after WiFi initialization
  if (WiFi.status() == WL_CONNECTED) {
    deviceMacAddress = WiFi.macAddress();
    Serial.print("Device MAC Address: ");
    Serial.println(deviceMacAddress);
  }
  
  // ... rest of setup ...
}
```

2. **Update sendSingleReading function**:
```cpp
bool sendSingleReading(SensorData data) {
  if (WiFi.status() != WL_CONNECTED) {
    return false;
  }
  
  // Create JSON payload
  StaticJsonDocument<256> doc;
  doc["timestamp"] = data.timestamp;
  doc["device_id"] = DEVICE_ID;  // Keep for backward compatibility
  
  // Add MAC address if available
  if (deviceMacAddress.length() > 0) {
    doc["mac_address"] = deviceMacAddress;
  }
  
  doc["temperature"] = round(data.temperature * 100) / 100.0;
  doc["humidity"] = round(data.humidity * 100) / 100.0;
  doc["co2"] = data.co2;
  
  // ... rest of function unchanged ...
}
```

**Testing**:
- Verify MAC address extracted correctly
- Verify MAC included in payload when WiFi connected
- Verify payload size remains within 256-byte limit
- Verify backward compatibility (device_id still present)

### 2. Backend: MAC Address Normalization

**File**: `server/api/views.py`

**New Function**:
```python
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
```

**Testing**:
- Test various input formats (lowercase, hyphens, no separators)
- Test invalid inputs (wrong length, invalid hex)
- Test edge cases (None, empty string, whitespace)

### 3. Backend: Registry Management

**File**: `server/api/views.py`

**New Functions**:

```python
# Lazy registry collection initialization
_registry_collection = None

def get_registry_collection():
    """Get device registry collection, initializing if necessary"""
    global _registry_collection
    if _registry_collection is None:
        try:
            client = MongoClient(
                MONGO_URI,
                serverSelectionTimeoutMS=5000,
                tlsCAFile=certifi.where(),
                tz_aware=True,
                tzinfo=UTC,
            )
            client.admin.command('ping')
            db = client[MONGO_DB_NAME]
            _registry_collection = db['device_registry']
            
            # Create indexes
            _registry_collection.create_index(
                [('mac_address', ASCENDING)], 
                unique=True
            )
            _registry_collection.create_index([('display_name', ASCENDING)])
            _registry_collection.create_index([('last_data_received', ASCENDING)])
            
            print(f"Device registry collection initialized")
        except Exception as err:
            print(f"✗ Failed to initialize device registry: {err}")
            raise
    return _registry_collection


def ensure_registry_entry(mac_address, device_id=None):
    """
    Ensure device registry entry exists, creating if missing.
    
    Args:
        mac_address: Normalized MAC address
        device_id: Optional device_id for default display name
    
    Returns:
        Registry entry document
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
        registry.update_one(
            {'mac_address': mac_normalized},
            {
                '$set': {
                    'last_data_received': now,
                    'updated_at': now
                },
                '$setOnInsert': {'legacy_device_id': device_id}  # Only if missing
            }
        )
    else:
        # Create new entry
        default_name = device_id or mac_normalized
        entry = {
            'mac_address': mac_normalized,
            'display_name': default_name,
            'created_at': now,
            'updated_at': now,
            'last_data_received': now,
            'legacy_device_id': device_id
        }
        registry.insert_one(entry)
    
    return entry
```

### 4. Backend: Enhanced Data Reception

**File**: `server/api/views.py`

**Modify `receive_data` function**:

```python
def receive_data(request):
    """Příjem dat ze senzoru (enhanced with MAC address support)"""
    try:
        data = json.loads(request.body)
        
        if not data:
            return JsonResponse({'error': 'Nebyla přijata žádná data.'}, status=400)
        
        print(f"\n{'='*50}")
        print(f"Přijata data z {data.get('device_id', 'unknown')}")
        print(f"{'='*50}")
        print(json.dumps(data, indent=2))
        
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
        if 'mac_address' in data:
            try:
                mac_address = normalize_mac_address(data['mac_address'])
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

        document = {
            'timestamp': timestamp_utc,
            'timestamp_str': timestamp_str,
            'device_id': normalized['device_id'],  # Required for backward compatibility
            'temperature': temperature,
            'humidity': humidity,
            'co2': co2,
            'raw_payload': data
        }
        
        # Add MAC address if available
        if mac_address:
            document['mac_address'] = mac_address

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
```

### 5. Backend: Enhanced Device Listing

**File**: `server/api/views.py`

**Modify `admin_devices` function**:

```python
@require_http_methods(["GET"])
def admin_devices(request):
    """Get list of all devices with summary statistics (enhanced with MAC/display_name)"""
    if not check_admin_auth(request):
        return JsonResponse({
            'status': 'error',
            'message': 'Neautorizovaný přístup'
        }, status=401)

    try:
        collection = get_mongo_collection()
        registry = get_registry_collection()
    except RuntimeError as e:
        return JsonResponse({
            'status': 'error',
            'message': f'Nepodařilo se připojit k databázi: {str(e)}'
        }, status=503)

    try:
        now = datetime.now(UTC)
        cutoff_time = now - timedelta(hours=24)  # Consider device online if seen in last 24h
        
        # Get devices with MAC addresses (from registry)
        registry_entries = list(registry.find({}))
        mac_to_display = {entry['mac_address']: entry.get('display_name', entry['mac_address']) 
                          for entry in registry_entries}
        
        devices = []
        processed_macs = set()
        
        # Process devices with MAC addresses
        for entry in registry_entries:
            mac = entry['mac_address']
            processed_macs.add(mac)
            
            # Get sensor data for this MAC
            mac_filter = {'mac_address': mac}
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
                        
                        current_readings = {
                            'temperature': latest_doc.get('temperature'),
                            'humidity': latest_doc.get('humidity'),
                            'co2': latest_doc.get('co2')
                        }
                
                devices.append({
                    'mac_address': mac,
                    'display_name': entry.get('display_name', mac),
                    'device_id': latest_doc.get('device_id') if latest_doc else entry.get('legacy_device_id'),
                    'status': status,
                    'total_data_points': total_count,
                    'last_seen': last_seen,
                    'current_readings': current_readings
                })
        
        # Get legacy devices (by device_id, excluding those with MAC)
        all_device_ids = collection.distinct('device_id')
        devices_with_mac = set()
        for doc in collection.find({'mac_address': {'$exists': True, '$ne': None}}):
            devices_with_mac.add(doc.get('device_id'))
        
        legacy_device_ids = [did for did in all_device_ids if did not in devices_with_mac]
        
        for device_id in legacy_device_ids:
            total_count = collection.count_documents({'device_id': device_id})
            
            latest_doc = collection.find_one(
                {'device_id': device_id},
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
                
                current_readings = {
                    'temperature': latest_doc.get('temperature'),
                    'humidity': latest_doc.get('humidity'),
                    'co2': latest_doc.get('co2')
                }

            devices.append({
                'mac_address': None,  # No MAC for legacy devices
                'display_name': device_id,  # Use device_id as display name
                'device_id': device_id,
                'status': status,
                'total_data_points': total_count,
                'last_seen': last_seen,
                'current_readings': current_readings
            })

        # Sort by display_name or device_id
        devices.sort(key=lambda x: x.get('display_name') or x.get('device_id', ''))

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
```

### 6. Frontend: Display Name Support

**File**: `frontend/src/components/admin/BoardCard.jsx`

**Changes**:
```javascript
// Update display logic
const displayName = device?.display_name || device?.device_id || 'Unknown'

// Update card header
<h3 className="board-card__name">{displayName}</h3>
```

### 7. Frontend: Rename UI Component

**File**: `frontend/src/components/admin/DeviceRenameModal.jsx` (new)

**Implementation**:
```javascript
import { useState } from 'react'
import { adminAPI } from '../../services/api'
import Card from '../ui/Card'
import Button from '../ui/Button'
import TextField from '../ui/TextField'
import './DeviceRenameModal.css'

const DeviceRenameModal = ({ device, onClose, onRenameSuccess }) => {
  const [displayName, setDisplayName] = useState(device?.display_name || device?.device_id || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!displayName.trim()) {
      setError('Název je povinný')
      return
    }

    if (!device?.mac_address) {
      setError('Toto zařízení nemá MAC adresu, nelze přejmenovat')
      return
    }

    setLoading(true)
    setError('')

    try {
      await adminAPI.renameDevice(device.mac_address, displayName.trim())
      onRenameSuccess?.()
      onClose?.()
    } catch (err) {
      setError(err.response?.data?.message || 'Chyba při přejmenování zařízení')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="device-rename-modal-overlay" onClick={onClose}>
      <Card className="device-rename-modal" elevation={3} onClick={(e) => e.stopPropagation()}>
        <h2>Přejmenovat zařízení</h2>
        <form onSubmit={handleSubmit}>
          <TextField
            label="Název zařízení"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
            maxLength={100}
            autoFocus
          />
          {error && <div className="device-rename-modal-error">{error}</div>}
          <div className="device-rename-modal-actions">
            <Button type="button" variant="outlined" onClick={onClose} disabled={loading}>
              Zrušit
            </Button>
            <Button type="submit" variant="filled" disabled={loading}>
              {loading ? 'Ukládám...' : 'Uložit'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}

export default DeviceRenameModal
```

**File**: `frontend/src/services/api.js`

**Add rename method**:
```javascript
export const adminAPI = {
  // ... existing methods ...
  
  renameDevice: async (macAddress, displayName) => {
    return apiClient.post(`/admin/devices/${macAddress}/rename`, {
      display_name: displayName
    })
  }
}
```

**File**: `frontend/src/pages/AdminPanel.jsx`

**Integrate rename UI**:
```javascript
const [showRenameModal, setShowRenameModal] = useState(null)

// Add rename handler
const handleRename = (device) => {
  if (device?.mac_address) {
    setShowRenameModal(device)
  }
}

// Add rename success handler
const handleRenameSuccess = () => {
  loadDevices()  // Refresh device list
  setShowRenameModal(null)
}

// Render modal
{showRenameModal && (
  <DeviceRenameModal
    device={showRenameModal}
    onClose={() => setShowRenameModal(null)}
    onRenameSuccess={handleRenameSuccess}
  />
)}
```

---

## 🔒 Security Considerations

### Authentication
- Rename endpoint requires admin authentication (`check_admin_auth`)
- Uses existing session-based or header-based admin auth
- Returns 401 Unauthorized if not authenticated

### Input Validation
- MAC address format strictly validated (hexadecimal, 12 characters)
- Display name length limited (100 characters max)
- Display name sanitized (prevent XSS)
- No SQL/NoSQL injection possible (pymongo handles escaping)

### Data Privacy
- MAC addresses are hardware identifiers (not sensitive personal data)
- Display names are user-configured (no sensitive data expected)
- No additional data exposure beyond existing device listing

---

## ⚡ Performance Strategy

### Index Optimization
- Unique index on `mac_address` for O(1) lookups
- Compound indexes for time-series queries
- Sparse index on `mac_address` in sensor_data (only for devices with MAC)

### Query Optimization
- Batch registry lookups (avoid N+1 queries)
- Efficient device listing (single aggregation query)
- Cache registry entries if device count small (<100)

### Performance Targets
- Registry lookup: <10ms (95th percentile)
- Device listing: <500ms for 100 devices (95th percentile)
- Data reception overhead: <100ms additional processing

---

## 🔄 Backward Compatibility Strategy

### Dual-Identifier Support
- All queries support both `mac_address` and `device_id`
- MAC address preferred when available
- `device_id` fallback for legacy devices

### API Compatibility
- All existing endpoints continue working
- Response formats enhanced (new fields added, old fields retained)
- No breaking changes to request formats

### Gradual Migration
- New firmware versions automatically send MAC addresses
- Existing devices continue working with `device_id`
- No forced migration required
- Devices migrate automatically when firmware updated

---

## 🧪 Testing Approach

### Unit Tests

**Firmware**:
- MAC address extraction test
- Payload size validation
- Backward compatibility (device_id still present)

**Backend**:
- MAC address normalization function
- Registry entry creation/update
- Lookup functions (MAC preferred, device_id fallback)
- Error handling (invalid MAC, missing device)

### Integration Tests

**API Endpoints**:
- Data reception with MAC address
- Device listing (new and legacy devices)
- Rename endpoint (success and error cases)
- Authentication and authorization

**Database Operations**:
- Registry collection creation
- Unique constraint enforcement
- Index utilization

### End-to-End Tests

**Full Flow**:
1. Firmware sends data with MAC address
2. Backend creates registry entry
3. Admin renames device
4. Device listing shows new name
5. Legacy device continues working

**Backward Compatibility**:
- Legacy device sends data without MAC
- Device listing includes legacy device
- All queries work for legacy device

### Performance Tests
- Device listing with 100+ devices
- Registry lookup performance
- Concurrent data reception

---

## 🚀 Deployment Plan

### Phase 1: Backend Foundation (Day 1)
1. Deploy registry collection initialization
2. Deploy MAC normalization function
3. Deploy registry management functions
4. Deploy enhanced data reception
5. **Validation**: Verify data reception creates registry entries

### Phase 2: API Enhancement (Day 2)
1. Deploy rename endpoint
2. Deploy enhanced device listing
3. **Validation**: Test rename functionality via API

### Phase 3: Firmware Update (Day 3)
1. Deploy firmware with MAC address support
2. Test with real hardware
3. **Validation**: Verify MAC addresses in payloads

### Phase 4: Frontend Integration (Day 4)
1. Deploy frontend display name support
2. Deploy rename UI component
3. **Validation**: Test full rename flow in UI

### Phase 5: Monitoring (Week 1)
1. Monitor registry creation rate
2. Monitor rename operations
3. Monitor backward compatibility (legacy devices)
4. Monitor performance metrics

### Rollback Procedure
1. Revert frontend changes (if needed)
2. Revert API changes (keep registry, disable features)
3. Revert firmware (if critical issues)

---

## 📈 Success Metrics

### Primary Metrics
- **Zero Duplicates**: 100% of rename operations create no duplicates
- **Backward Compatibility**: 100% of existing devices continue functioning
- **MAC Coverage**: >90% of devices have MAC addresses within 30 days

### Secondary Metrics
- **Rename Success Rate**: >99%
- **API Response Time**: <500ms (95th percentile)
- **Registry Creation Success**: 100% for valid MAC addresses

### Monitoring
- Log registry entry creation
- Log rename operations
- Monitor API response times
- Track device counts (MAC vs legacy)

---

## ⚠️ Risks and Mitigation

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| MAC address extraction fails | High | Low | Fallback to device_id, no error raised |
| Duplicate MAC addresses | High | Very Low | Unique index prevents, manual resolution if occurs |
| Performance degradation | Medium | Low | Indexes optimized, performance tests run |
| Backward compatibility broken | High | Low | Extensive testing, gradual rollout |
| Registry corruption | Medium | Very Low | MongoDB transactions (if supported), backups |

---

## 📝 Implementation Checklist

### Backend
- [ ] Add `normalize_mac_address()` function
- [ ] Add `get_registry_collection()` function
- [ ] Add `ensure_registry_entry()` function
- [ ] Update `receive_data()` to handle MAC addresses
- [ ] Update `admin_devices()` to merge registry data
- [ ] Add `admin_rename_device()` endpoint
- [ ] Add URL route for rename endpoint
- [ ] Create indexes on registry collection
- [ ] Add sparse index on sensor_data.mac_address

### Firmware
- [ ] Add global `deviceMacAddress` variable
- [ ] Extract MAC in `setup()` after WiFi connection
- [ ] Include MAC in `sendSingleReading()` payload
- [ ] Test with real hardware

### Frontend
- [ ] Update `BoardCard` to show `display_name`
- [ ] Create `DeviceRenameModal` component
- [ ] Add rename method to `adminAPI`
- [ ] Integrate rename UI in `AdminPanel`
- [ ] Add error handling and loading states

### Testing
- [ ] Unit tests for MAC normalization
- [ ] Unit tests for registry functions
- [ ] Integration tests for API endpoints
- [ ] E2E tests for rename flow
- [ ] Performance tests
- [ ] Backward compatibility tests

### Deployment
- [ ] Deploy backend changes
- [ ] Deploy firmware update
- [ ] Deploy frontend changes
- [ ] Monitor metrics
- [ ] Validate success criteria

---

**Plan Status**: ✅ Complete | **Ready for Implementation** (`/implement device-mac-tracking`)




