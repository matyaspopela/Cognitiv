# Implementation Todo List: device-mac-tracking

## Overview
Implement MAC address-based device tracking to prevent duplicate device entries when renaming boards. This implementation follows a phased approach: backend foundation → backend API → firmware → frontend → testing.

**Reference**: [Plan](plan.md) | [Specification](spec.md) | [Research](research.md)

---

## Pre-Implementation Setup
- [x] Review research findings
- [x] Confirm specification requirements
- [x] Validate technical plan
- [ ] Set up development environment
- [ ] Create feature branch: `device-mac-tracking`

---

## Phase 1: Backend Foundation (2-3 hours)

### T1.1: MAC Address Normalization Function
- [x] **T1.1**: Add `normalize_mac_address()` function to `server/api/views.py`
  - **Estimated Time**: 30 minutes
  - **Dependencies**: None
  - **Files to Modify**: `server/api/views.py`
  - **Acceptance Criteria**:
    - Function normalizes MAC addresses to "AA:BB:CC:DD:EE:FF" format
    - Handles various input formats (lowercase, hyphens, no separators)
    - Validates MAC address format (12 hex characters)
    - Raises ValueError for invalid inputs
    - Tested with edge cases (None, empty, whitespace)

### T1.2: Registry Collection Initialization
- [x] **T1.2**: Add `get_registry_collection()` function to `server/api/views.py`
  - **Estimated Time**: 30 minutes
  - **Dependencies**: T1.1 (MAC normalization)
  - **Existing Pattern**: Follows `get_mongo_collection()` lazy initialization pattern
  - **Files to Modify**: `server/api/views.py`
  - **Acceptance Criteria**:
    - Lazy initialization pattern (global `_registry_collection` variable)
    - Creates `device_registry` collection on first access
    - Creates unique index on `mac_address`
    - Creates performance indexes on `display_name` and `last_data_received`
    - Idempotent (safe to call multiple times)
    - Error handling with clear messages

### T1.3: Registry Entry Management
- [x] **T1.3**: Add `ensure_registry_entry()` function to `server/api/views.py`
  - **Estimated Time**: 45 minutes
  - **Dependencies**: T1.1, T1.2
  - **Files to Modify**: `server/api/views.py`
  - **Acceptance Criteria**:
    - Creates registry entry if MAC address not found
    - Updates `last_data_received` and `updated_at` if entry exists
    - Sets default display_name to `device_id` or MAC address
    - Stores `legacy_device_id` for migration tracking
    - Returns registry entry document or None if invalid MAC
    - Handles duplicate MAC gracefully (unique index prevents)

---

## Phase 2: Backend API Enhancement (3-4 hours)

### T2.1: Enhanced Data Reception
- [x] **T2.1**: Update `receive_data()` function to handle MAC addresses
  - **Estimated Time**: 45 minutes
  - **Dependencies**: T1.1, T1.2, T1.3
  - **Files to Modify**: `server/api/views.py`
  - **Acceptance Criteria**:
    - Extracts `mac_address` from payload if present
    - Normalizes MAC address format
    - Calls `ensure_registry_entry()` when MAC present
    - Stores both `mac_address` and `device_id` in sensor document
    - Continues working if MAC missing (backward compatibility)
    - Updates registry `last_data_received` timestamp
    - Invalid MAC doesn't break data reception (logs warning)

### T2.2: Enhanced Device Listing
- [x] **T2.2**: Update `admin_devices()` function to merge registry data
  - **Estimated Time**: 60 minutes
  - **Dependencies**: T1.2, T2.1
  - **Files to Modify**: `server/api/views.py`
  - **Acceptance Criteria**:
    - Queries devices with MAC addresses from registry
    - Queries legacy devices (by device_id, excluding those with MAC)
    - Merges registry display_name with sensor statistics
    - Returns both `mac_address` and `display_name` in response
    - Includes `device_id` for backward compatibility
    - Both new (MAC-based) and legacy (`device_id`-based) devices appear
    - Response format backward compatible

### T2.3: Device Rename Endpoint
- [x] **T2.3**: Add `admin_rename_device()` endpoint
  - **Estimated Time**: 45 minutes
  - **Dependencies**: T1.1, T1.2
  - **Files to Create**: None
  - **Files to Modify**: `server/api/views.py`, `server/api/urls.py`
  - **Acceptance Criteria**:
    - Endpoint: `POST /api/admin/devices/{mac_address}/rename`
    - Requires admin authentication (`check_admin_auth`)
    - Validates MAC address format (returns 400 if invalid)
    - Validates display_name (non-empty, max 100 chars)
    - Updates registry entry if MAC exists (returns 200)
    - Returns 404 if MAC not found in registry
    - Returns 401 if not authenticated
    - Updates `updated_at` timestamp
    - Returns success response with updated display_name

### T2.4: Public Device Listing Enhancement
- [x] **T2.4**: Update `get_devices()` function to include MAC and display_name
  - **Estimated Time**: 30 minutes
  - **Dependencies**: T2.2
  - **Files to Modify**: `server/api/views.py`
  - **Acceptance Criteria**:
    - Returns `mac_address` and `display_name` in response
    - Maintains `device_id` for backward compatibility
    - Works for both new and legacy devices

### T2.5: URL Route Configuration
- [x] **T2.5**: Add rename endpoint to URL configuration
  - **Estimated Time**: 10 minutes
  - **Dependencies**: T2.3
  - **Files to Modify**: `server/api/urls.py`
  - **Acceptance Criteria**:
    - Route added: `path('admin/devices/<str:mac_address>/rename', ...)`
    - Route placed in admin API section
    - URL pattern matches endpoint specification

---

## Phase 3: Firmware Updates (1-2 hours)

### T3.1: MAC Address Extraction
- [x] **T3.1**: Add global MAC address variable and extraction in `setup()`
  - **Estimated Time**: 30 minutes
  - **Dependencies**: None
  - **Files to Modify**: `src/main.cpp`
  - **Acceptance Criteria**:
    - Global variable `String deviceMacAddress = ""` declared
    - MAC address extracted after WiFi connection in `setup()`
    - MAC address cached (not extracted repeatedly)
    - Serial output shows MAC address for debugging
    - Handles WiFi connection failure gracefully

### T3.2: Payload Integration
- [x] **T3.2**: Include MAC address in sensor payload
  - **Estimated Time**: 20 minutes
  - **Dependencies**: T3.1
  - **Files to Modify**: `src/main.cpp`
  - **Acceptance Criteria**:
    - MAC address added to JSON payload as `mac_address` field
    - Only included if `deviceMacAddress.length() > 0`
    - `device_id` field still present (backward compatibility)
    - Payload size remains within 256-byte limit
    - Works with both production and local debug servers

---

## Phase 4: Frontend Updates (2-3 hours)

### T4.1: Display Name Support
- [x] **T4.1**: Update BoardCard component to show display_name
  - **Estimated Time**: 30 minutes
  - **Dependencies**: T2.2
  - **Files to Modify**: `frontend/src/components/admin/BoardCard.jsx`
  - **Acceptance Criteria**:
    - Device cards display `display_name` from API response
    - Falls back to `device_id` if `display_name` not available
    - Displays "Unknown" if neither available
    - All existing functionality continues working

### T4.2: API Service Enhancement
- [x] **T4.2**: Add rename method to adminAPI
  - **Estimated Time**: 15 minutes
  - **Dependencies**: T2.3
  - **Files to Modify**: `frontend/src/services/api.js`
  - **Acceptance Criteria**:
    - `adminAPI.renameDevice(macAddress, displayName)` method added
    - Uses correct endpoint: `/admin/devices/${macAddress}/rename`
    - Sends `display_name` in request body
    - Returns promise with response

### T4.3: Rename Modal Component
- [x] **T4.3**: Create DeviceRenameModal component
  - **Estimated Time**: 60 minutes
  - **Dependencies**: T4.2
  - **Files to Create**: `frontend/src/components/admin/DeviceRenameModal.jsx`, `frontend/src/components/admin/DeviceRenameModal.css`
  - **Acceptance Criteria**:
    - Modal dialog with input field for display_name
    - Pre-filled with current display_name
    - Validates non-empty input
    - Shows loading state during API call
    - Shows error messages on failure
    - Calls `adminAPI.renameDevice()` on submit
    - Closes on success or cancel
    - Follows existing UI component patterns

### T4.4: Rename UI Integration
- [x] **T4.4**: Integrate rename functionality in AdminPanel
  - **Estimated Time**: 45 minutes
  - **Dependencies**: T4.1, T4.3
  - **Files to Modify**: `frontend/src/pages/AdminPanel.jsx`, `frontend/src/components/admin/BoardCard.jsx`
  - **Acceptance Criteria**:
    - Rename button/icon visible on device cards (devices with MAC only)
    - Clicking opens DeviceRenameModal
    - Modal shows current display_name
    - Success refreshes device list
    - Error handling with user feedback
    - Rename option hidden for legacy devices (no MAC)

---

## Phase 5: Testing & Validation (2-3 hours)

### T5.1: Backend Unit Tests
- [ ] **T5.1**: Test MAC address normalization function
  - **Estimated Time**: 30 minutes
  - **Dependencies**: T1.1
  - **Test Cases**:
    - Valid formats: uppercase, lowercase, hyphens, no separators
    - Invalid formats: wrong length, invalid hex, None, empty
    - Edge cases: whitespace, mixed separators

### T5.2: Backend Integration Tests
- [ ] **T5.2**: Test registry management functions
  - **Estimated Time**: 45 minutes
  - **Dependencies**: T1.2, T1.3
  - **Test Cases**:
    - Registry entry creation
    - Registry entry update (last_data_received)
    - Duplicate MAC handling (unique constraint)
    - Default display_name logic

### T5.3: API Endpoint Tests
- [ ] **T5.3**: Test rename endpoint
  - **Estimated Time**: 30 minutes
  - **Dependencies**: T2.3
  - **Test Cases**:
    - Successful rename (200)
    - Invalid MAC format (400)
    - MAC not found (404)
    - Unauthorized access (401)
    - Empty display_name (400)
    - Long display_name (400)

### T5.4: End-to-End Testing
- [ ] **T5.4**: Test full rename flow
  - **Estimated Time**: 45 minutes
  - **Dependencies**: All previous tasks
  - **Test Cases**:
    - Firmware sends data with MAC
    - Backend creates registry entry
    - Admin renames device via UI
    - Device listing shows new name
    - No duplicate device created
    - Legacy device continues working

### T5.5: Backward Compatibility Validation
- [ ] **T5.5**: Validate backward compatibility
  - **Estimated Time**: 30 minutes
  - **Dependencies**: All tasks
  - **Test Cases**:
    - Device without MAC still works
    - All existing API endpoints work
    - Frontend displays legacy devices correctly
    - Historical data queries work

---

## Phase 6: Documentation & Cleanup (30 minutes)

### T6.1: Code Documentation
- [ ] **T6.1**: Add code comments and docstrings
  - **Estimated Time**: 15 minutes
  - **Dependencies**: All implementation tasks
  - **Files**: All modified files
  - **Acceptance Criteria**:
    - All new functions have docstrings
    - Complex logic has inline comments
    - MAC normalization function well documented

### T6.2: Progress Documentation
- [ ] **T6.2**: Update progress.md with completion status
  - **Estimated Time**: 15 minutes
  - **Dependencies**: All tasks
  - **Files**: `specs/active/device-mac-tracking/progress.md`
  - **Acceptance Criteria**:
    - All completed tasks documented
    - Any deviations from plan noted
    - Final status recorded

---

## Execution Strategy

### Continuous Implementation Rules
1. **Execute todo items in dependency order**
2. **Go for maximum flow - complete as much as possible without interruption**
3. **Group all ambiguous questions for batch resolution at the end**
4. **Reuse existing patterns and components wherever possible**
5. **Update progress continuously - mark checkboxes as you complete**
6. **Document any deviations from plan**

### Pattern Reuse Strategy

**Backend Patterns**:
- Follow `get_mongo_collection()` lazy initialization pattern for registry
- Use existing `check_admin_auth()` for authentication
- Follow existing error handling patterns in API endpoints
- Use existing `JsonResponse` patterns for API responses

**Frontend Patterns**:
- Follow existing modal component patterns (if any)
- Use existing UI component library (Card, Button, TextField, etc.)
- Follow existing API service patterns
- Use existing error handling patterns

**Code Style**:
- Follow existing Python code style (PEP 8)
- Follow existing JavaScript/React code style
- Follow existing C++/Arduino code style

---

## Progress Tracking

### Completed Items
- [x] Todo-list created
- [ ] Implementation started

### Blockers & Issues
- None currently

### Discoveries & Deviations
- To be documented as implementation progresses

---

## Definition of Done
- [ ] All todo items completed
- [ ] Backend functions implemented and tested
- [ ] API endpoints working correctly
- [ ] Firmware updates deployed and tested
- [ ] Frontend updates complete and functional
- [ ] Backward compatibility validated
- [ ] Code documentation updated
- [ ] Progress.md updated with final status

---

**Created:** 2024-12-19  
**Estimated Duration:** 10-15 hours total  
**Implementation Start:** 2024-12-19  
**Target Completion:** 2024-12-20

