# device-mac-tracking Feature Brief

## 🎯 Context (2min)
**Problem**: When users upload firmware to a board and change the name from X to Y, the system keeps both boards - board X becomes permanently offline while board Y appears as a new device. This happens because boards are tracked by `device_id` (which is configurable and changes with each upload), not by a hardware-unique identifier. Users expect renaming a board to update its name, not create a duplicate offline device.

**Users**: 
- Administrators managing multiple IoT sensor boards
- System operators configuring and renaming boards during deployment
- Facility managers organizing boards by location/room name
- Users who need to rename boards without creating duplicate entries

**Success**: 
1. When a user changes board name from X to Y, board X's name is updated to Y (no duplicate created)
2. Boards are uniquely identified by MAC address (hardware-unique, immutable)
3. Board display names can be changed without firmware re-upload
4. Existing boards continue working during migration
5. No orphaned "offline" devices when renaming

## 🔍 Quick Research (15min)
### Existing Patterns
- **Firmware Data Payload** (`src/main.cpp` lines 533-538) → JSON structure with `device_id`, `timestamp`, `temperature`, `humidity`, `co2` | Reuse: Payload structure, JSON serialization pattern
- **ESP8266 WiFi Library** (`src/main.cpp` line 22) → `#include <ESP8266WiFi.h>` already imported | Reuse: WiFi.macAddress() method available for MAC extraction
- **Data Reception** (`server/api/views.py` lines 411-472) → `receive_data()` normalizes and stores sensor data with `device_id` key | Reuse: Data normalization flow, MongoDB storage pattern
- **Device Listing** (`server/api/views.py` lines 1419-1500) → `admin_devices()` gets unique device_ids using `distinct('device_id')` | Reuse: Device aggregation pattern, status determination logic
- **Firmware Upload** (`server/api/views.py` lines 1225-1306) → `connect_upload()` writes `DEVICE_ID` to config.h and uploads firmware | Reuse: Config update mechanism, upload flow
- **MongoDB Schema** (`server/api/views.py` line 447-455) → Documents store `device_id`, `timestamp`, sensor readings | Reuse: Document structure, indexing pattern (device_id + timestamp)
- **Board Name Input** (`frontend/src/pages/Connect.jsx` lines 12, 44-48) → User enters `boardName` which becomes `device_id` | Reuse: Form input pattern, API call structure

### Tech Decision
**Approach**: MAC address-based device registry with display name mapping
- **Why**: 
  - MAC address is hardware-unique and immutable (perfect for device identity)
  - Separates hardware identity from user-facing display names
  - ESP8266WiFi.macAddress() readily available in firmware
  - Allows name changes without firmware re-upload
  - Prevents duplicate devices when renaming
  - Standard IoT pattern (hardware ID + human-readable name)
- **Avoid**: 
  - Using device_id as unique identifier (current problem - configurable, changes)
  - Requiring firmware re-upload for name changes (poor UX)
  - Complex migration requiring data migration (backward compatibility approach better)
  - Removing device_id from payload entirely (keep for backward compatibility during transition)

## ✅ Requirements (10min)

### R1: Firmware MAC Address Transmission
- **Story**: As a system, I need firmware to include MAC address in every sensor data payload
- **Acceptance**: 
  - MAC address extracted using `WiFi.macAddress()` in ESP8266
  - MAC address added to JSON payload as `mac_address` field (format: "AA:BB:CC:DD:EE:FF")
  - Existing `device_id` field retained for backward compatibility
  - MAC address sent in all sensor readings automatically

### R2: Device Registry System
- **Story**: As a backend, I need a device registry that maps MAC addresses to display names
- **Acceptance**: 
  - New MongoDB collection `device_registry` with schema: `{mac_address: string (unique), display_name: string, created_at: datetime, updated_at: datetime}`
  - MAC address is primary/unique identifier
  - Display name is user-configurable, defaults to MAC address if not set
  - Registry automatically created when new MAC address seen in data

### R3: MAC-Based Device Identification
- **Story**: As a backend, I need to identify devices by MAC address instead of device_id
- **Acceptance**: 
  - Data reception checks device registry by MAC address
  - Sensor data documents store both `mac_address` and `device_id` (for migration/compatibility)
  - Device queries use MAC address for grouping/aggregation
  - Display name retrieved from registry for API responses

### R4: Device Renaming Without Re-upload
- **Story**: As an admin, I need to rename a board without uploading firmware again
- **Acceptance**: 
  - Admin API endpoint: `POST /api/admin/devices/{mac_address}/rename` updates display_name
  - Frontend shows current display name and allows editing
  - Name change reflects immediately in device lists
  - No duplicate devices created when renaming

### R5: Backward Compatibility During Transition
- **Story**: As a system, I need existing devices (identified by device_id) to continue working
- **Acceptance**: 
  - Devices without MAC address fall back to device_id lookup
  - Legacy device_id-based queries still function
  - Migration script can optionally map existing device_ids to MAC addresses when devices come online
  - Both old and new devices appear in device lists

### R6: Firmware Upload Enhancement
- **Story**: As a user, I want board name from upload to set the initial display name in registry
- **Acceptance**: 
  - Firmware upload can optionally create/update registry entry with display_name
  - MAC address from firmware (if available) or device_id used as fallback
  - First data transmission from uploaded board creates registry entry automatically if missing

## 🏗️ Implementation (5min)
**Components**: 
1. **Firmware** (`src/main.cpp`): Add MAC address extraction and payload field
2. **Backend Device Registry** (`server/api/views.py`): New functions for registry management
3. **Backend Data Reception** (`server/api/views.py`): Update `receive_data()` to use MAC lookup
4. **Backend Admin API** (`server/api/views.py`): New endpoint for device renaming
5. **Frontend Device Management** (`frontend/src/pages/AdminPanel.jsx`): Rename functionality in UI
6. **Migration Support**: Backward compatibility logic for existing devices

**APIs**: 
- Existing: `POST /api/data` (enhanced to handle MAC address)
- New: `POST /api/admin/devices/{mac_address}/rename` (update display name)
- Modified: `GET /api/admin/devices` (returns MAC address + display name mapping)
- Modified: `GET /api/devices` (includes MAC addresses)

**Data**: 
- New collection: `device_registry` (mac_address, display_name, timestamps)
- Modified: `sensor_data` collection adds optional `mac_address` field
- Index: `device_registry.mac_address` (unique index)
- Migration: Existing `device_id` values remain functional during transition

## 📋 Next Actions (2min)
- [ ] Update firmware to extract and send MAC address in `sendSingleReading()` (15min)
- [ ] Create device registry management functions in backend (30min)
- [ ] Update `receive_data()` to use MAC address for device lookup (20min)
- [ ] Add admin API endpoint for device renaming (25min)
- [ ] Update frontend AdminPanel to show MAC addresses and enable renaming (45min)
- [ ] Test with existing device (backward compatibility) (20min)
- [ ] Test renaming flow (prevents duplicates) (15min)

**Start Coding In**: ~2.5 hours | Ready after brief review

---
**Total Planning Time**: ~30min | **Owner**: Development Team | **Date**: 2024-12-19

<!-- Living Document - Update as you code -->

## 🔄 Implementation Tracking

**CRITICAL**: Follow the todo-list systematically. Mark items as complete, document blockers, update progress.

### Progress
- [ ] Track completed items here
- [ ] Update daily

### Blockers
- [ ] Document any blockers

**See**: [.sdd/IMPLEMENTATION_GUIDE.md](mdc:.sdd/IMPLEMENTATION_GUIDE.md) for detailed execution rules.

## 📝 Notes & Discoveries

### MAC Address Format
ESP8266 `WiFi.macAddress()` returns MAC address as String in format "AA:BB:CC:DD:EE:FF". This format is consistent and suitable for storage as unique identifier.

### Migration Strategy
- Phase 1: Add MAC address support alongside existing device_id (backward compatible)
- Phase 2: New devices automatically use MAC-based identification
- Phase 3: Existing devices continue working with device_id fallback
- Phase 4: Optional migration script can map device_id → MAC when devices come online
- Phase 5: Eventually deprecate device_id (future work, not in scope)

### Edge Cases to Consider
- Multiple firmware uploads with same MAC but different device_id → Should update display name, not create duplicate
- Device offline for extended period → Registry entry persists, device shows as offline correctly
- MAC address format normalization → Store in consistent format (uppercase, colon-separated)
- Duplicate MAC addresses (theoretical) → Unique index will prevent this, but should handle gracefully









