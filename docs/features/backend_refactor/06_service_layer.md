# Feature: Service Layer Extraction

**Priority:** Medium
**Status:** Spec
**Related:** `docs/specs/active/BACKEND_REFACTOR_PLAN_V2.md` Section 2.2

## Problem
`views.py` contains business logic, database queries, and HTTP response handling mixed together. This makes it impossible to unit test logic without mocking the entire Django request lifecycle.

## Proposed Solution
Extract business logic into a dedicated Service Layer.

### 1. `DeviceService`
- **Location:** `server/api/services/device.py`
- **Methods:**
    - `register_device(mac, metadata)`
    - `get_device(mac)`
    - `update_status(mac, online=True)`
    - `is_whitelisted(mac)`

### 2. `DataService`
- **Location:** `server/api/services/data.py`
- **Methods:**
    - `ingest_data(sensor_data: SensorDataSchema)` -> Logic for saving to DB.
    - `get_history(mac, start, end)` -> Logic for querying time series.
    - `get_latest(mac)`

### 3. `AuthService`
- **Location:** `server/api/services/auth.py`
- **Methods:**
    - `verify_api_key(key)`
    - `create_api_key(device_id)`

### Tasks
- [ ] Create `server/api/services/` package (`__init__.py`).
- [ ] Implement `DeviceService`.
- [ ] Implement `DataService`.
- [ ] Implement `AuthService`.
- [ ] Add type hints to all service methods.
