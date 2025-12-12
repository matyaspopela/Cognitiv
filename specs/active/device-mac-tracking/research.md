# Research: MAC Address-Based Device Tracking

**Research Date**: 2024-12-19  
**Researcher**: AI Assistant  
**Research Duration**: ~75 minutes  
**Next Phase**: Specification (`/specify device-mac-tracking`)

---

## Executive Summary

This research investigates the implementation of MAC address-based device tracking to replace the current `device_id`-based system. The goal is to prevent duplicate device entries when users rename boards during firmware upload, while maintaining backward compatibility with existing devices.

### Key Findings

1. **Firmware MAC Address Extraction**: ESP8266 `WiFi.macAddress()` returns a String in format "AA:BB:CC:DD:EE:FF" (uppercase, colon-separated). This is available after WiFi initialization and can be included in sensor payloads with minimal overhead (~17 bytes).

2. **Current Device Identification**: System uses `device_id` (configurable string) as primary identifier. All queries, aggregations, and API responses depend on `device_id`, requiring careful migration strategy.

3. **MongoDB Schema Pattern**: Current pattern uses compound index on `(device_id, timestamp)` and lazy collection initialization. New registry collection can follow similar pattern with unique index on `mac_address`.

4. **API Response Structure**: Frontend expects `device_id` field in all device objects. Need to maintain compatibility while adding `mac_address` and `display_name`.

5. **Backward Compatibility**: Critical requirement - existing devices without MAC addresses must continue working. Fallback strategy using `device_id` is essential during transition period.

### Recommended Approach

**MAC Address Registry Pattern**:
- New MongoDB collection `device_registry` with unique index on `mac_address`
- Sensor data stores both `mac_address` (optional) and `device_id` (required for backward compatibility)
- Device lookups use MAC address if present, fallback to `device_id`
- Display name stored in registry, queried and merged into API responses
- Automatic registry creation on first data reception with MAC address

**Migration Strategy**:
- Phase 1: Add MAC support alongside existing `device_id` (non-breaking)
- Phase 2: New firmware versions send MAC address automatically
- Phase 3: Existing devices continue working via `device_id` fallback
- Phase 4: Gradual migration as devices come online with new firmware

---

## 1. Firmware Implementation Research

### Current Payload Structure

**Location**: `src/main.cpp:527-564` (`sendSingleReading` function)

```cpp
StaticJsonDocument<256> doc;
doc["timestamp"] = data.timestamp;
doc["device_id"] = DEVICE_ID;  // From config.h
doc["temperature"] = round(data.temperature * 100) / 100.0;
doc["humidity"] = round(data.humidity * 100) / 100.0;
doc["co2"] = data.co2;
```

**Findings**:
- Payload uses `StaticJsonDocument<256>` (256 bytes capacity)
- Current payload size: ~80-100 bytes (timestamp, device_id, 3 sensor values, JSON overhead)
- Adding MAC address (~17 bytes) leaves ~140 bytes margin - **safe**
- JSON serialization handled by ArduinoJson library
- Payload sent to both production and local debug servers

### ESP8266 MAC Address Access

**Location**: `src/main.cpp:22` (`#include <ESP8266WiFi.h>`)

**ESP8266WiFi.macAddress() Method**:
- **Return Type**: `String`
- **Format**: "AA:BB:CC:DD:EE:FF" (uppercase, colon-separated, 17 characters)
- **Availability**: Available after `WiFi.begin()` is called (WiFi must be initialized)
- **Consistency**: MAC address is hardware-burned and does not change
- **Edge Cases**: 
  - MAC may not be available if WiFi initialization fails
  - Should check `WiFi.status() == WL_CONNECTED` before calling

**Implementation Pattern**:
```cpp
// In setup() or after WiFi connection:
String macAddress = WiFi.macAddress();
// Returns: "AA:BB:CC:DD:EE:FF"

// Add to payload:
doc["mac_address"] = macAddress;
```

**Memory Considerations**:
- String storage: ~20 bytes (17 chars + null terminator + String overhead)
- JSON field: ~15 bytes ("mac_address":"AA:BB:CC:DD:EE:FF")
- Total overhead: ~35 bytes - **within payload capacity**

### WiFi Initialization Timing

**Location**: `src/main.cpp:403-465` (`connectWiFi` function)

**Findings**:
- WiFi initialized in `setup()` before sensor readings begin
- MAC address available immediately after successful WiFi connection
- Can cache MAC address as global variable to avoid repeated calls
- MAC address extraction does not require active WiFi connection (only initialization)

**Recommended Implementation**:
```cpp
String deviceMacAddress = "";  // Global variable

void setup() {
  // ... existing setup ...
  connectWiFi();
  if (WiFi.status() == WL_CONNECTED) {
    deviceMacAddress = WiFi.macAddress();
    Serial.print("Device MAC: ");
    Serial.println(deviceMacAddress);
  }
}

bool sendSingleReading(SensorData data) {
  // ... existing code ...
  if (deviceMacAddress.length() > 0) {
    doc["mac_address"] = deviceMacAddress;
  }
  // ... rest of payload ...
}
```

---

## 2. Backend Database Design Research

### Current MongoDB Patterns

**Collection Initialization** (`server/api/views.py:65-88`):
```python
def init_mongo_client():
    client = MongoClient(MONGO_URI, ...)
    db = client[MONGO_DB_NAME]
    collection = db[MONGO_COLLECTION_NAME]
    collection.create_index([('device_id', ASCENDING), ('timestamp', ASCENDING)])
    return collection
```

**Pattern Analysis**:
- Lazy initialization pattern (initialized on first access)
- Single collection for sensor data
- Compound index on `(device_id, timestamp)` for efficient queries
- Index created at initialization time (safe to call multiple times)

### Current Sensor Data Schema

**Location**: `server/api/views.py:447-455`

```python
document = {
    'timestamp': timestamp_utc,        # datetime with timezone
    'timestamp_str': timestamp_str,    # human-readable string
    'device_id': normalized['device_id'],  # string (current identifier)
    'temperature': temperature,        # float
    'humidity': humidity,              # float
    'co2': co2,                       # int
    'raw_payload': data               # original JSON (for debugging)
}
```

**Index Strategy**:
- Primary index: `(device_id, timestamp)` for time-series queries
- Query patterns: Filter by `device_id`, sort by `timestamp`
- Aggregation patterns: Group by `device_id`, aggregate by time buckets

### Device Registry Collection Design

**Recommended Schema**:
```python
device_registry = {
    '_id': ObjectId,                    # MongoDB default
    'mac_address': str,                 # "AA:BB:CC:DD:EE:FF" (unique index)
    'display_name': str,                # User-friendly name
    'first_seen': datetime,             # First data reception
    'created_at': datetime,             # Registry entry creation
    'updated_at': datetime,             # Last update (name change, etc.)
    'last_data_received': datetime,     # Last sensor data timestamp
    'legacy_device_id': str             # Optional: last known device_id (for migration)
}
```

**Index Strategy**:
```python
# Unique index on mac_address
registry_collection.create_index([('mac_address', ASCENDING)], unique=True)

# Optional: Index on display_name for search
registry_collection.create_index([('display_name', ASCENDING)])

# Optional: Index on last_data_received for offline detection
registry_collection.create_index([('last_data_received', ASCENDING)])
```

**Collection Initialization Pattern**:
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
    return _registry_collection
```

### Sensor Data Schema Evolution

**Enhanced Schema** (backward compatible):
```python
document = {
    'timestamp': timestamp_utc,
    'timestamp_str': timestamp_str,
    'device_id': normalized['device_id'],     # Keep for backward compatibility
    'mac_address': normalized.get('mac_address'),  # New field (optional)
    'temperature': temperature,
    'humidity': humidity,
    'co2': co2,
    'raw_payload': data
}
```

**Index Updates**:
- Keep existing: `(device_id, timestamp)` index
- Add new: `(mac_address, timestamp)` index (sparse, for MAC-based queries)
- Query logic: Use MAC if present, fallback to `device_id`

---

## 3. Backend API Design Research

### Current Device Listing Pattern

**Location**: `server/api/views.py:1419-1500` (`admin_devices`)

**Current Flow**:
1. Get distinct `device_id` values: `collection.distinct('device_id')`
2. For each `device_id`:
   - Count total documents: `count_documents({'device_id': device_id})`
   - Get latest reading: `find_one({'device_id': device_id}, sort=[('timestamp', -1)])`
   - Determine online/offline status (last 24 hours)
   - Build response object with `device_id`, `status`, `total_data_points`, `last_seen`, `current_readings`

**Response Structure**:
```python
{
    'status': 'success',
    'devices': [
        {
            'device_id': 'ESP8266A2',
            'status': 'online',
            'total_data_points': 1234,
            'last_seen': '2024-12-19 14:30:00',
            'current_readings': {
                'temperature': 22.5,
                'humidity': 45.2,
                'co2': 850
            }
        }
    ]
}
```

### Enhanced Device Listing Pattern

**Recommended Flow**:
1. Get all devices with MAC addresses (from registry + latest sensor data)
2. Merge registry data (display_name) with sensor statistics
3. Fallback to `device_id`-based lookup for devices without MAC
4. Return unified response with both MAC and display name

**Enhanced Response Structure**:
```python
{
    'status': 'success',
    'devices': [
        {
            'mac_address': 'AA:BB:CC:DD:EE:FF',      # New
            'display_name': 'Classroom A',            # New (from registry)
            'device_id': 'ESP8266A2',                 # Keep for compatibility
            'status': 'online',
            'total_data_points': 1234,
            'last_seen': '2024-12-19 14:30:00',
            'current_readings': {...}
        }
    ]
}
```

### Data Reception Enhancement

**Location**: `server/api/views.py:411-472` (`receive_data`)

**Current Flow**:
1. Parse JSON payload
2. Normalize sensor data (extracts `device_id`)
3. Validate data
4. Store document with `device_id`

**Enhanced Flow**:
1. Parse JSON payload
2. Normalize sensor data (extracts `device_id` and optional `mac_address`)
3. **New**: If `mac_address` present:
   - Normalize MAC format (uppercase, validate format)
   - Lookup/create registry entry
   - Update registry `last_data_received`
   - Store display_name from registry (for queries)
4. Validate data
5. Store document with both `mac_address` and `device_id`

**Registry Management Function**:
```python
def ensure_registry_entry(mac_address, device_id=None):
    """Ensure device registry entry exists, create if missing"""
    mac_normalized = mac_address.upper().strip()
    
    registry = get_registry_collection()
    entry = registry.find_one({'mac_address': mac_normalized})
    
    if not entry:
        # Create new entry
        now = datetime.now(UTC)
        entry = {
            'mac_address': mac_normalized,
            'display_name': device_id or mac_normalized,  # Default to device_id or MAC
            'first_seen': now,
            'created_at': now,
            'updated_at': now,
            'last_data_received': now,
            'legacy_device_id': device_id
        }
        registry.insert_one(entry)
    else:
        # Update last_data_received
        registry.update_one(
            {'mac_address': mac_normalized},
            {
                '$set': {
                    'last_data_received': datetime.now(UTC),
                    'updated_at': datetime.now(UTC)
                },
                '$setOnInsert': {'legacy_device_id': device_id}  # Only if missing
            },
            upsert=False
        )
    
    return entry
```

### Device Rename Endpoint

**New Endpoint**: `POST /api/admin/devices/{mac_address}/rename`

**Pattern** (following existing admin endpoint structure):
```python
@csrf_exempt
@require_http_methods(["POST"])
def admin_rename_device(request, mac_address):
    """Rename device by MAC address"""
    if not check_admin_auth(request):
        return JsonResponse({'status': 'error', 'message': 'Neautorizovaný přístup'}, status=401)
    
    try:
        data = json.loads(request.body)
        new_name = (data.get('display_name') or '').strip()
        
        if not new_name:
            return JsonResponse({'status': 'error', 'message': 'Název je povinný'}, status=400)
        
        mac_normalized = mac_address.upper().strip()
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
            return JsonResponse({'status': 'error', 'message': 'Zařízení nenalezeno'}, status=404)
        
        return JsonResponse({'status': 'success', 'message': 'Název byl aktualizován'}, status=200)
    except Exception as e:
        return JsonResponse({'status': 'error', 'message': str(e)}, status=500)
```

**URL Pattern** (add to `server/api/urls.py`):
```python
path('admin/devices/<str:mac_address>/rename', views.admin_rename_device, name='admin_rename_device'),
```

### Device Lookup Strategy (Backward Compatibility)

**Recommended Pattern**:
```python
def get_device_identifier(data):
    """Extract device identifier, preferring MAC over device_id"""
    mac = data.get('mac_address')
    if mac:
        return {'mac_address': mac.upper().strip()}
    device_id = data.get('device_id')
    if device_id:
        return {'device_id': device_id}
    raise ValueError("No device identifier found")

def get_device_display_name(identifier):
    """Get display name from registry or fallback to device_id"""
    if 'mac_address' in identifier:
        registry = get_registry_collection()
        entry = registry.find_one({'mac_address': identifier['mac_address']})
        if entry:
            return entry.get('display_name', identifier['mac_address'])
    
    # Fallback to device_id
    return identifier.get('device_id', 'Unknown')
```

---

## 4. Frontend Integration Research

### Current Device Display Pattern

**Location**: `frontend/src/components/admin/BoardCard.jsx:39-216`

**Key Usage Points**:
- `device.device_id` used as:
  - Card key: `key={device.device_id}` (line 91 in AdminPanel)
  - Display name: `<h3>{device?.device_id || 'Unknown'}</h3>` (line 149)
  - Click handler: `onClick={() => onDetailsClick?.(device?.device_id)}` (line 146)
  - API calls: `historyAPI.getSeries(..., device.device_id)` (line 76)

**Current Device Object Structure**:
```javascript
{
  device_id: 'ESP8266A2',
  status: 'online',
  total_data_points: 1234,
  last_seen: '2024-12-19 14:30:00',
  current_readings: { temperature: 22.5, humidity: 45.2, co2: 850 }
}
```

### Enhanced Device Display Pattern

**Recommended Structure**:
```javascript
{
  mac_address: 'AA:BB:CC:DD:EE:FF',      // New
  display_name: 'Classroom A',            // New (preferred for display)
  device_id: 'ESP8266A2',                 // Keep for compatibility/fallback
  status: 'online',
  total_data_points: 1234,
  last_seen: '2024-12-19 14:30:00',
  current_readings: {...}
}
```

**Display Logic**:
```javascript
// In BoardCard component
const displayName = device?.display_name || device?.device_id || 'Unknown'

// Use display_name for display, but keep device_id for API calls during transition
<h3 className="board-card__name">{displayName}</h3>

// For API calls, prefer mac_address but fallback to device_id
const deviceIdentifier = device?.mac_address || device?.device_id
```

### Device Rename UI Pattern

**Location**: `frontend/src/components/admin/BoardCard.jsx` (new functionality)

**Recommended Pattern**:
- Add edit icon/button on device card (hover state)
- Click opens inline edit or modal
- Text input pre-filled with current `display_name`
- Save button calls new rename API endpoint
- Optimistic update in UI (update local state immediately)
- Refresh device list on success

**API Service Addition** (`frontend/src/services/api.js`):
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

### API Parameter Updates

**Current Pattern** (`frontend/src/services/api.js:49-102`):
- All API calls use `device_id` parameter: `params.append('device_id', deviceId)`

**Transition Strategy**:
- Phase 1: Accept both `device_id` and `mac_address` in backend
- Phase 2: Frontend sends `mac_address` when available, `device_id` as fallback
- Phase 3: Backend prioritizes `mac_address` if provided

**Backend Query Enhancement**:
```python
def build_device_filter(device_id=None, mac_address=None):
    """Build MongoDB filter for device queries"""
    if mac_address:
        return {'mac_address': mac_address.upper().strip()}
    elif device_id:
        return {'device_id': device_id}
    return {}
```

---

## 5. Backward Compatibility Strategy

### Data Migration Approach

**Principle**: Zero-downtime migration, no data loss, existing devices continue working

**Phase 1: Additive Changes** (Non-breaking)
- Add `mac_address` field to sensor documents (optional)
- Create `device_registry` collection (new, doesn't affect existing queries)
- New firmware versions send MAC address
- Old firmware continues sending only `device_id`

**Phase 2: Dual Identification**
- Queries support both `device_id` and `mac_address`
- Device listing merges data from both sources
- Registry automatically created when MAC address received

**Phase 3: Gradual Migration**
- As devices come online with new firmware, they're automatically registered
- Historical data queries use `device_id` (backward compatible)
- New queries can use `mac_address` for devices that have it

**Phase 4: Legacy Support**
- Devices without MAC continue working via `device_id` indefinitely
- No forced migration required
- Display name defaults to `device_id` if no registry entry

### Query Compatibility

**Device Listing** (`admin_devices`):
```python
# Get devices with MAC addresses (from registry)
registry_devices = get_registry_collection().find({})
mac_addresses = [d['mac_address'] for d in registry_devices]

# Get devices from sensor data (by MAC or device_id)
devices_by_mac = {}
for mac in mac_addresses:
    latest = collection.find_one({'mac_address': mac}, sort=[('timestamp', -1)])
    if latest:
        devices_by_mac[mac] = latest

# Get legacy devices (by device_id, excluding those with MAC)
all_device_ids = collection.distinct('device_id')
devices_with_mac_ids = set()
for doc in collection.find({'mac_address': {'$exists': True, '$ne': None}}):
    devices_with_mac_ids.add(doc.get('device_id'))

legacy_device_ids = [did for did in all_device_ids if did not in devices_with_mac_ids]

# Merge and build response
```

**Data Queries** (history, stats, etc.):
```python
def build_history_filter(start_dt, end_dt, device_id=None, mac_address=None):
    """Enhanced filter supporting both identifiers"""
    query = {}
    if start_dt or end_dt:
        time_filter = {}
        if start_dt:
            time_filter['$gte'] = start_dt
        if end_dt:
            time_filter['$lte'] = end_dt
        query['timestamp'] = time_filter
    
    # Prefer mac_address, fallback to device_id
    if mac_address:
        query['mac_address'] = mac_address.upper().strip()
    elif device_id:
        query['device_id'] = device_id
    
    return query
```

### MAC Address Normalization

**Requirements**:
- Store in consistent format: uppercase, colon-separated
- Validate format before storage
- Handle variations: "aa:bb:cc:dd:ee:ff", "AA-BB-CC-DD-EE-FF", etc.

**Normalization Function**:
```python
def normalize_mac_address(mac):
    """Normalize MAC address to uppercase colon-separated format"""
    if not mac:
        return None
    
    # Remove any separators and convert to uppercase
    mac_clean = ''.join(c for c in str(mac).upper() if c.isalnum())
    
    # Validate length (should be 12 hex characters)
    if len(mac_clean) != 12:
        raise ValueError(f"Invalid MAC address format: {mac}")
    
    # Reformat with colons
    return ':'.join(mac_clean[i:i+2] for i in range(0, 12, 2))
    # Returns: "AA:BB:CC:DD:EE:FF"
```

---

## 6. Technical Constraints & Opportunities

### MongoDB Constraints

**Collection Limits**:
- No practical limit on collection size
- Unique index on `mac_address` prevents duplicates
- Sparse indexes supported for optional `mac_address` field in sensor_data

**Performance Considerations**:
- Compound index `(mac_address, timestamp)` for time-series queries
- Registry lookup is O(1) with unique index
- Device listing requires aggregation/join operation (acceptable for small device counts)

**Query Optimization**:
- Use projection to limit fields in device listing
- Cache registry entries in memory if device count is small (<100 devices)
- Index `last_data_received` for efficient offline detection

### Firmware Constraints

**Memory**:
- ESP8266 has limited RAM (~80KB total)
- String storage for MAC: ~20 bytes (acceptable)
- JSON payload increase: ~35 bytes (within 256-byte limit)

**WiFi Dependency**:
- MAC address requires WiFi initialization
- If WiFi fails, device falls back to `device_id` only
- This is acceptable - device won't send data anyway if WiFi fails

### API Response Size

**Current**: Device list response ~2-5 KB for 10 devices
**With MAC**: ~3-6 KB (acceptable, minimal increase)

**Optimization Opportunities**:
- Pagination if device count grows large (>100 devices)
- Lazy loading of detailed device info
- Compression for large responses (gzip)

---

## 7. Recommendations

### Preferred Approach

**MAC Address Registry with Backward Compatibility**:

1. **Firmware**:
   - Extract MAC address after WiFi initialization
   - Cache as global variable
   - Include in sensor payload (optional field)
   - Keep `device_id` for backward compatibility

2. **Backend**:
   - Create `device_registry` collection with unique index on `mac_address`
   - Store both `mac_address` and `device_id` in sensor documents
   - Implement registry auto-creation on data reception
   - Add device rename endpoint
   - Update device listing to merge registry data
   - Support dual-identifier queries (MAC preferred, `device_id` fallback)

3. **Frontend**:
   - Display `display_name` from registry, fallback to `device_id`
   - Add rename UI (inline edit or modal)
   - Update API calls to send `mac_address` when available
   - Maintain `device_id` for legacy devices

4. **Migration**:
   - Zero-downtime, additive changes only
   - Existing devices continue working
   - Gradual migration as devices come online
   - No forced migration required

### Alternative Approaches Considered

1. **UUID-Based Registry**:
   - Pros: No WiFi dependency, more standard
   - Cons: Requires firmware changes, can't extract from hardware
   - Verdict: **Rejected** - MAC is better fit (hardware-unique, no changes needed)

2. **Device ID Hash**:
   - Pros: Simple, no new fields
   - Cons: Doesn't solve core problem (ID still changes)
   - Verdict: **Rejected** - Doesn't address requirement

3. **Complete Replacement**:
   - Pros: Cleaner long-term
   - Cons: Breaking change, requires migration script
   - Verdict: **Rejected** - Too risky, backward compatibility preferred

### Implementation Priority

1. **Critical**: MAC extraction in firmware, registry creation, dual-identifier queries
2. **High**: Device rename endpoint, frontend display updates
3. **Medium**: Frontend rename UI, registry management optimizations
4. **Low**: Migration tooling, advanced registry features

---

## 8. Open Questions for Specification Phase

1. **MAC Address Validation**: Should we validate MAC address format strictly (reject invalid), or be lenient and normalize?

2. **Display Name Defaults**: When creating registry entry, default to `device_id` or MAC address format?

3. **Legacy Device Handling**: Should we provide a UI tool to manually associate `device_id` with MAC address for offline devices?

4. **Registry Cleanup**: Should we clean up registry entries for devices that haven't been seen in X days?

5. **Firmware Upload Integration**: Should firmware upload endpoint create registry entry immediately, or wait for first data transmission?

6. **API Versioning**: Should we version the API endpoints (`/api/v1/...`) or maintain backward compatibility in-place?

7. **Device ID Deprecation**: Timeline for eventually deprecating `device_id`? (Future consideration, not immediate)

8. **Multiple MAC Addresses**: What if a device reports multiple MAC addresses (theoretical, but possible with multiple network interfaces)?

---

## 9. Code Examples Summary

### Firmware MAC Extraction
```cpp
String deviceMacAddress = "";

void setup() {
  connectWiFi();
  if (WiFi.status() == WL_CONNECTED) {
    deviceMacAddress = WiFi.macAddress();  // "AA:BB:CC:DD:EE:FF"
  }
}

bool sendSingleReading(SensorData data) {
  StaticJsonDocument<256> doc;
  doc["device_id"] = DEVICE_ID;
  if (deviceMacAddress.length() > 0) {
    doc["mac_address"] = deviceMacAddress;
  }
  // ... rest of payload
}
```

### Backend Registry Management
```python
def ensure_registry_entry(mac_address, device_id=None):
    mac_normalized = normalize_mac_address(mac_address)
    registry = get_registry_collection()
    
    entry = registry.find_one({'mac_address': mac_normalized})
    if not entry:
        entry = {
            'mac_address': mac_normalized,
            'display_name': device_id or mac_normalized,
            'created_at': datetime.now(UTC),
            'updated_at': datetime.now(UTC),
            'last_data_received': datetime.now(UTC)
        }
        registry.insert_one(entry)
    return entry
```

### Backend Device Query
```python
def get_devices_with_registry():
    # Get devices by MAC (from registry)
    # Get legacy devices by device_id
    # Merge and return with display_name
```

### Frontend Display
```javascript
const displayName = device?.display_name || device?.device_id || 'Unknown'
const deviceIdentifier = device?.mac_address || device?.device_id
```

---

**Research Complete** | Ready for Specification Phase




