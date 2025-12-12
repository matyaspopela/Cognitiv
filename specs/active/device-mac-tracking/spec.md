# Specification: MAC Address-Based Device Tracking

**Specification Date**: 2024-12-19  
**Status**: Specified  
**Owner**: Development Team  
**Related Documents**: [Feature Brief](feature-brief.md) | [Research](research.md)

---

## Problem Statement

### The Problem
When users upload firmware to a board and change the device name from "X" to "Y", the system creates duplicate device entries. The original device "X" becomes permanently offline while device "Y" appears as a new, separate device. This occurs because the system tracks devices using `device_id`, which is a user-configurable string that changes with each firmware upload. Users expect renaming a board to update its display name, not create a duplicate offline device.

### Affected Users
- **Administrators** managing multiple IoT sensor boards across locations
- **System operators** configuring and deploying boards during installation
- **Facility managers** organizing boards by location/room names
- **End users** who need to rename boards for better organization

### Business Impact
- **Data Fragmentation**: Sensor data split across duplicate device entries
- **Poor User Experience**: Confusion with "offline" devices that are actually renamed
- **Operational Inefficiency**: Manual cleanup required to identify and remove duplicates
- **Loss of Historical Context**: Historical data appears disconnected when devices are renamed
- **Reduced Trust**: System appears unreliable when duplicates accumulate

### Success Criteria
1. ✅ Zero duplicate devices created when renaming a board
2. ✅ Devices uniquely identified by hardware MAC address (immutable)
3. ✅ Display names can be changed without firmware re-upload
4. ✅ Existing devices continue working without disruption
5. ✅ No orphaned "offline" devices after rename operations

---

## Functional Requirements

### FR-001: Firmware MAC Address Transmission

**Requirement**: Firmware must extract and transmit the device MAC address in all sensor data payloads.

**Details**:
- MAC address extracted using ESP8266 `WiFi.macAddress()` method
- MAC address included as optional `mac_address` field in JSON payload
- Format: "AA:BB:CC:DD:EE:FF" (uppercase, colon-separated, 17 characters)
- Existing `device_id` field must be retained for backward compatibility
- MAC address cached as global variable after WiFi initialization to avoid repeated calls
- MAC address only included if WiFi initialization successful

**Acceptance Criteria**:
- ✅ All sensor payloads from devices with WiFi connection include `mac_address` field
- ✅ MAC address format matches "AA:BB:CC:DD:EE:FF" pattern exactly
- ✅ `device_id` field still present in all payloads
- ✅ Payload size remains within 256-byte limit
- ✅ Devices without WiFi connection work normally (no MAC in payload)

**Technical Constraints**:
- MAC address available only after `WiFi.begin()` is called
- Must check `WiFi.status() == WL_CONNECTED` before extracting MAC
- Payload increase: ~35 bytes (acceptable within 256-byte JSON limit)

---

### FR-002: Device Registry Collection

**Requirement**: A new MongoDB collection `device_registry` must store MAC address to display name mappings.

**Details**:
- Collection name: `device_registry`
- Primary key: `mac_address` (unique index, uppercase format)
- Schema fields:
  - `mac_address` (string, required, unique): Normalized MAC address "AA:BB:CC:DD:EE:FF"
  - `display_name` (string, required): User-friendly device name
  - `created_at` (datetime): Registry entry creation timestamp
  - `updated_at` (datetime): Last modification timestamp
  - `last_data_received` (datetime): Last sensor data reception timestamp
  - `legacy_device_id` (string, optional): Last known device_id for migration tracking

**Acceptance Criteria**:
- ✅ Collection created automatically on first registry operation
- ✅ Unique index on `mac_address` prevents duplicates
- ✅ Registry entries created automatically when new MAC address received
- ✅ Default `display_name` set to `device_id` if available, otherwise MAC address
- ✅ Timestamps tracked in UTC timezone

**Indexes**:
```python
# Primary unique index
create_index([('mac_address', ASCENDING)], unique=True)

# Optional performance indexes
create_index([('display_name', ASCENDING)])  # For search
create_index([('last_data_received', ASCENDING)])  # For offline detection
```

---

### FR-003: MAC Address Normalization and Validation

**Requirement**: MAC addresses must be normalized to consistent format and validated before storage.

**Details**:
- Normalize to uppercase, colon-separated format: "AA:BB:CC:DD:EE:FF"
- Accept input variations: lowercase, hyphen-separated, no separators
- Validate: must contain exactly 12 hexadecimal characters
- Reject invalid formats with clear error message
- Store normalized format in all collections

**Acceptance Criteria**:
- ✅ "aa:bb:cc:dd:ee:ff" → "AA:BB:CC:DD:EE:FF" (normalized)
- ✅ "AA-BB-CC-DD-EE-FF" → "AA:BB:CC:DD:EE:FF" (normalized)
- ✅ "aabbccddeeff" → "AA:BB:CC:DD:EE:FF" (normalized)
- ✅ "XX:YY:ZZ" → Rejected (invalid length)
- ✅ "GG:HH:II:JJ:KK:LL" → Rejected (invalid hex characters)
- ✅ Normalization function handles edge cases (null, empty, whitespace)

**Normalization Function**:
```python
def normalize_mac_address(mac):
    """Normalize MAC address to uppercase colon-separated format"""
    if not mac:
        raise ValueError("MAC address is required")
    
    # Remove separators and convert to uppercase
    mac_clean = ''.join(c for c in str(mac).upper() if c.isalnum())
    
    # Validate length
    if len(mac_clean) != 12:
        raise ValueError(f"Invalid MAC address length: {mac_clean}")
    
    # Validate hex characters
    try:
        int(mac_clean, 16)
    except ValueError:
        raise ValueError(f"Invalid hexadecimal MAC address: {mac_clean}")
    
    # Reformat with colons
    return ':'.join(mac_clean[i:i+2] for i in range(0, 12, 2))
```

---

### FR-004: Sensor Data Dual Identification

**Requirement**: Sensor data documents must store both `mac_address` and `device_id` for backward compatibility.

**Details**:
- Sensor documents include both `mac_address` (optional) and `device_id` (required)
- `mac_address` field added when present in payload
- `device_id` field always present (backward compatibility requirement)
- Data reception updates registry `last_data_received` timestamp when MAC present
- Both identifiers available for query flexibility

**Acceptance Criteria**:
- ✅ Documents with MAC address include both `mac_address` and `device_id` fields
- ✅ Documents without MAC address include only `device_id` (legacy behavior)
- ✅ Registry `last_data_received` updated automatically on data reception
- ✅ Queries can filter by either `mac_address` or `device_id`
- ✅ Existing queries continue working unchanged

**Enhanced Document Schema**:
```python
{
    'timestamp': datetime,
    'timestamp_str': str,
    'device_id': str,              # Required (backward compatibility)
    'mac_address': str,            # Optional (new devices)
    'temperature': float,
    'humidity': float,
    'co2': int,
    'raw_payload': dict
}
```

**Index Strategy**:
- Keep existing: `(device_id, timestamp)` compound index
- Add new: `(mac_address, timestamp)` sparse compound index (for MAC-based queries)

---

### FR-005: Device Lookup with Fallback Strategy

**Requirement**: Device lookups must prefer MAC address but fallback to `device_id` for legacy devices.

**Details**:
- Primary lookup: Use `mac_address` if available
- Fallback lookup: Use `device_id` if MAC address not present
- Device listing merges data from registry and sensor collections
- Display name retrieved from registry, fallback to `device_id`
- Both new and legacy devices appear in device lists

**Acceptance Criteria**:
- ✅ Devices with MAC address identified by MAC (primary)
- ✅ Devices without MAC address identified by `device_id` (fallback)
- ✅ Device listing includes both new (MAC-based) and legacy (`device_id`-based) devices
- ✅ Display names retrieved from registry when available
- ✅ All existing device queries continue working

**Lookup Function**:
```python
def get_device_identifier(data):
    """Extract device identifier, preferring MAC over device_id"""
    mac = data.get('mac_address')
    if mac:
        return {'mac_address': normalize_mac_address(mac)}
    device_id = data.get('device_id')
    if device_id:
        return {'device_id': device_id}
    raise ValueError("No device identifier found")
```

---

### FR-006: Device Rename API Endpoint

**Requirement**: Admin API endpoint must allow renaming devices by MAC address.

**Details**:
- Endpoint: `POST /api/admin/devices/{mac_address}/rename`
- Requires admin authentication
- Request body: `{"display_name": "New Name"}`
- Updates `display_name` in registry collection
- Updates `updated_at` timestamp
- Returns success/error response

**Acceptance Criteria**:
- ✅ Endpoint requires admin authentication (401 if not authenticated)
- ✅ Validates MAC address format (400 if invalid)
- ✅ Validates display_name is non-empty string (400 if invalid)
- ✅ Updates registry entry if MAC exists (200 on success)
- ✅ Returns 404 if MAC address not found in registry
- ✅ Returns 500 on database errors
- ✅ Name change reflects in subsequent device listings

**Request/Response Examples**:
```python
# Request
POST /api/admin/devices/AA:BB:CC:DD:EE:FF/rename
{
    "display_name": "Classroom A"
}

# Success Response (200)
{
    "status": "success",
    "message": "Device renamed successfully",
    "mac_address": "AA:BB:CC:DD:EE:FF",
    "display_name": "Classroom A"
}

# Error Response (404)
{
    "status": "error",
    "message": "Device not found"
}
```

---

### FR-007: Enhanced Device Listing API

**Requirement**: Device listing APIs must return MAC address and display name alongside `device_id`.

**Details**:
- `GET /api/admin/devices` enhanced to include `mac_address` and `display_name`
- `GET /api/devices` (public) enhanced similarly
- Response maintains `device_id` for backward compatibility
- Display name merged from registry when available
- Legacy devices without MAC still included in response

**Acceptance Criteria**:
- ✅ `GET /api/admin/devices` returns `mac_address` and `display_name` fields
- ✅ `GET /api/devices` returns `mac_address` and `display_name` fields
- ✅ Response includes `device_id` for all devices (backward compatibility)
- ✅ Display name from registry used when available, `device_id` as fallback
- ✅ Both MAC-based and `device_id`-based devices appear in list
- ✅ Response format backward compatible (existing clients still work)

**Enhanced Response Structure**:
```python
{
    "status": "success",
    "devices": [
        {
            "mac_address": "AA:BB:CC:DD:EE:FF",      # New
            "display_name": "Classroom A",             # New (from registry)
            "device_id": "ESP8266A2",                  # Kept for compatibility
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

---

### FR-008: Frontend Display Name Support

**Requirement**: Frontend must display registry display names with fallback to `device_id`.

**Details**:
- Device cards show `display_name` when available
- Fallback to `device_id` if `display_name` not set
- MAC address available in device details/settings
- Display name used for user-facing labels
- `device_id` or `mac_address` used for API calls as appropriate

**Acceptance Criteria**:
- ✅ Device cards display `display_name` from registry
- ✅ Falls back to `device_id` if `display_name` missing
- ✅ MAC address visible in device details view
- ✅ API calls use appropriate identifier (`mac_address` preferred, `device_id` fallback)
- ✅ All existing frontend components continue working

**Display Logic**:
```javascript
const displayName = device?.display_name || device?.device_id || 'Unknown'
const deviceIdentifier = device?.mac_address || device?.device_id
```

---

### FR-009: Device Rename UI

**Requirement**: Admin panel must provide UI for renaming devices with MAC addresses.

**Details**:
- Rename option available on device cards (edit icon/button)
- Inline edit or modal dialog for name input
- Input pre-filled with current `display_name`
- Save button calls rename API endpoint
- Optimistic UI update (update state immediately)
- Error handling with user feedback
- Refresh device list on success

**Acceptance Criteria**:
- ✅ Rename option visible on devices with MAC addresses
- ✅ Click opens edit interface (inline or modal)
- ✅ Current name pre-filled in input field
- ✅ Input validates non-empty string
- ✅ Save button calls rename API endpoint
- ✅ UI updates immediately (optimistic update)
- ✅ Error messages displayed on failure
- ✅ Device list refreshes after successful rename
- ✅ Rename option hidden/disabled for devices without MAC (legacy)

---

### FR-010: Backward Compatibility Guarantee

**Requirement**: All existing `device_id`-based functionality must continue working.

**Details**:
- All existing API endpoints accept `device_id` parameter
- Device queries support both `mac_address` and `device_id`
- Legacy devices appear in device lists
- Historical data queries work for both new and legacy devices
- No breaking changes to existing API contracts

**Acceptance Criteria**:
- ✅ `GET /api/data?device_id=X` works for legacy devices
- ✅ `GET /api/stats?device_id=X` works for legacy devices
- ✅ `GET /api/history/*?device_id=X` works for legacy devices
- ✅ Legacy devices appear in device listing endpoints
- ✅ All existing frontend code continues working
- ✅ No data migration required
- ✅ Zero downtime deployment

---

## Non-Functional Requirements

### NFR-001: Performance

**Requirement**: System performance must not degrade with MAC address tracking.

**Metrics**:
- Device listing response time: <500ms for up to 100 devices
- Registry lookup: O(1) via unique index (<10ms)
- Data reception processing: <100ms overhead for registry operations
- Database query performance: No degradation vs. current implementation

**Acceptance Criteria**:
- ✅ Device listing completes in <500ms (95th percentile)
- ✅ Registry lookup completes in <10ms (95th percentile)
- ✅ Data reception processing time increase <100ms vs. baseline
- ✅ No N+1 query problems in device listing
- ✅ Indexes properly utilized (verified via query plans)

---

### NFR-002: Backward Compatibility

**Requirement**: System must maintain full backward compatibility with existing deployments.

**Scope**:
- Existing devices without MAC addresses continue functioning
- All existing API endpoints remain functional
- No breaking changes to request/response formats
- Existing frontend code requires no changes
- Historical data remains accessible

**Acceptance Criteria**:
- ✅ 100% of existing API calls continue working
- ✅ 100% of existing devices remain functional
- ✅ Zero downtime during deployment
- ✅ No data migration scripts required
- ✅ Existing frontend components work without modification

---

### NFR-003: Data Integrity

**Requirement**: Data integrity must be maintained with MAC address tracking.

**Constraints**:
- Unique constraint prevents duplicate MAC addresses
- MAC address validation prevents invalid entries
- Registry operations are atomic (no partial updates)
- Sensor data linked correctly to registry entries
- No data loss during registry operations

**Acceptance Criteria**:
- ✅ Unique index prevents duplicate MAC addresses
- ✅ Invalid MAC addresses rejected before storage
- ✅ Registry updates are atomic (all-or-nothing)
- ✅ Sensor data always linked to valid device identifier
- ✅ No orphaned registry entries (cleanup on device removal if implemented)

---

### NFR-004: Security

**Requirement**: MAC address tracking must not introduce security vulnerabilities.

**Constraints**:
- Rename endpoint requires admin authentication
- MAC address format validation prevents injection attacks
- No sensitive data exposed via MAC addresses
- Input sanitization for display names
- Rate limiting on rename endpoint (if applicable)

**Acceptance Criteria**:
- ✅ Rename endpoint checks admin authentication (401 if unauthorized)
- ✅ MAC address format strictly validated (no code injection possible)
- ✅ Display name sanitized (XSS prevention)
- ✅ No sensitive information in MAC addresses
- ✅ Input length limits enforced (display name: 100 characters max)

---

### NFR-005: Scalability

**Requirement**: System must scale to support thousands of devices.

**Targets**:
- Support up to 10,000 devices (future-proofing)
- Registry collection scales independently
- Index strategy supports efficient queries at scale
- Device listing performance acceptable at scale

**Acceptance Criteria**:
- ✅ System tested with 1,000+ devices (synthetic)
- ✅ Query performance acceptable with 10,000 devices
- ✅ Indexes support efficient lookups at scale
- ✅ Memory usage acceptable with large registry
- ✅ Pagination considered for device listing (if >100 devices)

---

## User Stories

### US-001: Rename Device Without Firmware Re-upload

**As an** administrator  
**I want to** rename a device without uploading firmware again  
**So that** I can organize devices without disrupting their operation

**Priority**: P0 (Must Have)  
**Effort**: Medium (4-6 hours)

**Acceptance Criteria**:
- ✅ Admin can rename device via Admin Panel UI
- ✅ Admin can rename device via API endpoint
- ✅ Name change reflects immediately in device lists
- ✅ No duplicate device created after rename
- ✅ Historical data remains linked to same physical device
- ✅ Rename works for devices with MAC addresses
- ✅ Error message shown if attempting to rename legacy device (no MAC)

**Definition of Done**:
- Backend rename endpoint implemented and tested
- Frontend rename UI implemented and tested
- Integration tests pass
- Documentation updated

---

### US-002: Hardware-Based Device Identification

**As a** system operator  
**I want** devices identified by hardware MAC address  
**So that** the same physical device is always recognized, even if renamed

**Priority**: P0 (Must Have)  
**Effort**: High (8-12 hours)

**Acceptance Criteria**:
- ✅ Devices tracked by unique MAC address
- ✅ Same physical device recognized across firmware uploads
- ✅ MAC address extracted automatically from ESP8266
- ✅ MAC address included in all sensor data payloads
- ✅ Device registry maps MAC to display name
- ✅ Duplicate devices prevented by MAC uniqueness

**Definition of Done**:
- Firmware updated to extract and send MAC address
- Backend registry system implemented
- Data reception updated to use MAC lookup
- Integration tests pass
- Deployed to staging environment

---

### US-003: Legacy Device Support

**As a** facility manager  
**I want** existing devices to continue working  
**So that** I don't need to update all devices immediately

**Priority**: P0 (Must Have)  
**Effort**: Medium (4-6 hours)

**Acceptance Criteria**:
- ✅ Devices without MAC addresses still appear in device lists
- ✅ Historical queries work for legacy devices
- ✅ No data loss during migration
- ✅ Legacy devices can be queried by `device_id`
- ✅ Both new and legacy devices visible in admin panel
- ✅ Gradual migration path (no forced update)

**Definition of Done**:
- Backward compatibility logic implemented
- Fallback queries work for legacy devices
- Integration tests for legacy devices pass
- Documentation updated with migration guide

---

### US-004: Display Custom Device Names

**As an** administrator  
**I want** to see custom device names in the admin panel  
**So that** I can easily identify devices by location or purpose

**Priority**: P1 (Should Have)  
**Effort**: Low (2-3 hours)

**Acceptance Criteria**:
- ✅ Device cards show custom display names
- ✅ Falls back to `device_id` if no display name set
- ✅ MAC address visible in device details
- ✅ Display name searchable/filterable (if search implemented)
- ✅ Name changes reflect immediately in UI

**Definition of Done**:
- Frontend displays `display_name` from registry
- Fallback logic implemented
- UI updated in admin panel
- Visual tests pass

---

### US-005: Automatic Registry Creation

**As a** system  
**I want** registry entries created automatically for new devices  
**So that** devices are immediately available for management

**Priority**: P0 (Must Have)  
**Effort**: Medium (3-4 hours)

**Acceptance Criteria**:
- ✅ Registry entry created on first data reception with MAC
- ✅ Default display name set to `device_id` if available
- ✅ Default display name set to MAC address if no `device_id`
- ✅ Timestamps tracked (created_at, last_data_received)
- ✅ No manual intervention required
- ✅ Error handling for invalid MAC addresses

**Definition of Done**:
- Registry auto-creation logic implemented
- Default name logic implemented
- Error handling tested
- Integration tests pass

---

### US-006: Separation of Hardware ID and Display Name

**As a** developer  
**I want** clear separation between hardware identifier and display name  
**So that** the system architecture is maintainable and extensible

**Priority**: P1 (Should Have)  
**Effort**: Low (1-2 hours)

**Acceptance Criteria**:
- ✅ MAC address used exclusively for device identification
- ✅ Display name separate and user-configurable
- ✅ API responses include both `mac_address` and `display_name`
- ✅ Code comments explain identifier usage
- ✅ Architecture supports future enhancements

**Definition of Done**:
- Code structure separates hardware ID from display name
- API responses include both fields
- Code comments/documentation updated
- Architecture documented

---

## Success Metrics

### Primary Metrics

**Zero Duplicate Devices**
- **Target**: 100% of rename operations do not create duplicates
- **Measurement**: Count rename operations that result in duplicate devices
- **Success**: 0 duplicates in production over 30 days

**Backward Compatibility**
- **Target**: 100% of existing devices continue functioning
- **Measurement**: Count existing devices that fail after deployment
- **Success**: 0 device failures reported in first week after deployment

**MAC Address Coverage**
- **Target**: >90% of devices have MAC addresses within 30 days
- **Measurement**: Percentage of devices with MAC address in registry
- **Success**: >90% coverage within 30 days of deployment

### Secondary Metrics

**Device Rename Success Rate**
- **Target**: >99% success rate for rename operations
- **Measurement**: (Successful renames / Total rename attempts) × 100
- **Success**: >99% over 30 days

**API Response Time**
- **Target**: <500ms for device listing (95th percentile)
- **Measurement**: Response time distribution for `GET /api/admin/devices`
- **Success**: 95th percentile <500ms over 30 days

**Registry Creation Success**
- **Target**: 100% success for valid MAC addresses
- **Measurement**: Count failed registry creations for valid MACs
- **Success**: 0 failures for valid MAC addresses

---

## Edge Cases and Error Scenarios

### Invalid MAC Address Format
**Scenario**: Firmware sends invalid MAC address format  
**Handling**: 
- Validate and reject invalid format
- Log error with device_id for debugging
- Device continues working with `device_id` only
- Error response returned to firmware (optional)

### Duplicate MAC Address
**Scenario**: Two devices report same MAC address (theoretical, but possible)  
**Handling**:
- Unique index prevents duplicate insertion
- Return clear error message on attempt
- Log incident for investigation
- Manual resolution required

### Missing MAC in Payload
**Scenario**: Firmware doesn't include MAC address in payload  
**Handling**:
- Device works normally with `device_id` only
- No error raised
- Device appears in lists as legacy device
- Can be migrated later when MAC available

### WiFi Initialization Failure
**Scenario**: WiFi fails to initialize, MAC address unavailable  
**Handling**:
- Device works with `device_id` only
- No MAC address in payload
- Device functions normally otherwise
- MAC becomes available if WiFi reconnects later

### Registry Entry Missing
**Scenario**: Sensor data received with MAC, but registry entry doesn't exist  
**Handling**:
- Auto-create registry entry on data reception
- Set default display name appropriately
- Update `last_data_received` timestamp
- Log registry creation for audit

### Rename on Non-Existent MAC
**Scenario**: Admin attempts to rename device with MAC not in registry  
**Handling**:
- Return 404 error with clear message
- Suggest checking MAC address format
- Log attempt for debugging

### Empty Display Name
**Scenario**: Admin attempts to set empty display name  
**Handling**:
- Validate input: require non-empty string
- Return 400 error with validation message
- Suggest minimum length (e.g., 1 character)

### Very Long Display Name
**Scenario**: Admin attempts to set extremely long display name  
**Handling**:
- Validate length: maximum 100 characters
- Truncate with warning or reject with error
- Recommend shorter name in error message

### Legacy Device Without MAC
**Scenario**: Device exists with only `device_id`, no MAC address  
**Handling**:
- Device appears in lists using `device_id`
- All queries work with `device_id`
- Display name defaults to `device_id`
- Can be migrated when MAC becomes available

### MAC Format Variations
**Scenario**: Firmware sends MAC in different format (lowercase, hyphens, etc.)  
**Handling**:
- Normalize to standard format before storage
- Accept all valid format variations
- Store in uppercase, colon-separated format

### Concurrent Rename Operations
**Scenario**: Multiple admins rename same device simultaneously  
**Handling**:
- Last write wins (standard MongoDB behavior)
- Consider optimistic locking if conflicts frequent
- Log all rename attempts for audit

---

## Dependencies

### Technical Dependencies
- **MongoDB**: Database infrastructure (existing)
- **ESP8266WiFi Library**: Already included in firmware
- **Django/Python**: Backend framework (existing)
- **React**: Frontend framework (existing)
- **Admin Authentication**: Existing admin auth system

### Data Dependencies
- **Sensor Data Collection**: Existing `sensor_data` collection
- **Device Queries**: Existing query patterns must be preserved

### External Dependencies
- **ESP8266 Hardware**: MAC address availability depends on WiFi chip
- **Network Connectivity**: MAC extraction requires WiFi initialization

---

## Out of Scope

### Complete device_id Removal
- **Rationale**: Requires breaking changes and data migration
- **Future Consideration**: May be addressed in future major version

### Historical Data Migration Tool
- **Rationale**: Not required for functionality
- **Future Consideration**: Optional tool for linking historical data to MAC addresses

### Device Deletion Functionality
- **Rationale**: Separate feature, not related to MAC tracking
- **Future Consideration**: Can be added independently

### Bulk Rename Operations
- **Rationale**: Nice-to-have, not core requirement
- **Future Consideration**: Can be added if frequently requested

### MAC Address Spoofing Detection
- **Rationale**: Security enhancement, not core requirement
- **Future Consideration**: May be needed if spoofing becomes issue

### Device Grouping/Organization
- **Rationale**: Separate feature for device organization
- **Future Consideration**: Can build on MAC tracking foundation

### Firmware Upload Registry Integration
- **Rationale**: Feature brief mentions optional integration
- **Decision**: Deferred - registry auto-creation on first data sufficient

---

## Assumptions

1. **ESP8266 MAC Address Stability**: MAC addresses are hardware-burned and don't change
2. **WiFi Initialization**: MAC address available after WiFi.begin() (standard ESP8266 behavior)
3. **Backward Compatibility Timeline**: Legacy device support maintained indefinitely (no forced migration)
4. **Device Count**: System supports current device count (tens to hundreds), scales to thousands
5. **Admin Access**: Only authenticated admins can rename devices (existing auth system)
6. **MongoDB Availability**: MongoDB connection and indexing work reliably
7. **Network Reliability**: Firmware can successfully send MAC address in payloads

---

## Implementation Notes

### Phase 1: Foundation (Backend)
1. Create device registry collection and indexes
2. Implement MAC address normalization function
3. Update data reception to handle MAC addresses
4. Implement registry auto-creation logic

### Phase 2: API Enhancement (Backend)
1. Add rename endpoint with admin auth
2. Enhance device listing endpoints
3. Implement dual-identifier query support
4. Add backward compatibility logic

### Phase 3: Firmware Update
1. Extract MAC address after WiFi initialization
2. Cache MAC address globally
3. Include in sensor payload
4. Test with real hardware

### Phase 4: Frontend Integration
1. Update device display to show display names
2. Implement rename UI component
3. Update API service for rename endpoint
4. Test user flows

### Phase 5: Testing & Validation
1. Integration tests for all components
2. Backward compatibility testing
3. Performance testing
4. User acceptance testing

---

## References

- **Feature Brief**: [feature-brief.md](feature-brief.md)
- **Research Document**: [research.md](research.md)
- **ESP8266 WiFi Library**: https://arduino-esp8266.readthedocs.io/
- **MongoDB Indexing**: https://docs.mongodb.com/manual/indexes/

---

**Specification Status**: ✅ Complete | **Ready for Planning Phase** (`/plan device-mac-tracking`)




