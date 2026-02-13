# Backend Testing Plan: Architecture Refactor

**Objective:** Ensure the refactoring of `views.py` into a layered architecture (DB, Service, View) does not introduce regressions and maintains security standards.

**Strategy:**
1.  **Baseline Testing (Snapshot):** Create "black-box" integration tests for existing critical paths (Ingestion, Retrieval) to capture current behavior before *any* changes.
2.  **Unit Testing (New Layers):** As new layers (`api/db.py`, `api/services/*.py`) are created, strictly TDD them.
3.  **Regression Testing:** Run the Baseline tests against the refactored code.
4.  **Security Testing:** Specific tests for new Auth mechanisms.

---

## Phase 1: Baseline Verification (The Safety Net)
*Goal: Create a suite of tests that verify the system behaves correctly from the "outside" (API level).*

### Tasks (@tagged)
- @T1 [Create] `server/api/tests/test_ingestion_baseline.py`
    - **Goal:** Verify `/api/data` accepts valid payloads and rejects invalid ones.
    - **Method:** Use `RequestFactory` and mock MongoDB to simulate payload ingestion.
- @T2 [Create] `server/api/tests/test_retrieval_baseline.py`
    - **Goal:** Verify `/api/data` (GET) and `/api/history/series` return expected structures.
    - **Method:** Mock MongoDB data and assert JSON response structure matches legacy format.

## Phase 2: Unit Testing New Architecture
*Goal: Ensure individual components function correctly in isolation.*

### Database Layer
- @T3 [Create] `server/api/tests/test_db_layer.py`
    - **Goal:** Verify `server/api/db.py` Singleton pattern and connection handling.
    - **Checks:** `get_mongo_client()` returns same instance, handles configuration loading.

### Service Layer - Device Service
- @T4 [Create] `server/api/tests/test_service_device.py`
    - **Goal:** Test `DeviceService` logic.
    - **Cases:**
        - `ensure_registry_entry` creates new vs updates existing.
        - `is_mac_whitelisted` respects global toggle and individual status.
        - `normalize_mac_address` handles various formats and raises errors.

### Service Layer - Data Service
- @T5 [Create] `server/api/tests/test_service_data.py`
    - **Goal:** Test `DataService` logic.
    - **Cases:**
        - `validate_sensor_data` enforces ranges.
        - `normalize_sensor_data` maps keys correctly.
        - `process_sensor_data` (new method) handles storage correctly.

### Service Layer - Auth Service
- @T6 [Create] `server/api/tests/test_service_auth.py`
    - **Goal:** Test `AuthService`.
    - **Cases:**
        - Validates API Keys (hashed/matched).
        - Admin login credentials check.

## Phase 3: Integration & Security
*Goal: Verify the pieces fit together and security controls work.*

### Integration
- @T7 [Update] `server/api/tests/test_mqtt_integration.py`
    - **Goal:** Verify MQTT worker calls `DataService` directly (not via HTTP).
    - **Method:** Mock `paho.mqtt.client` and verify `on_message` calls `DataService.process_data`.

### Security
- @T8 [Create] `server/api/tests/test_security_controls.py`
    - **Goal:** Verify Rate Limiting and Auth enforcement.
    - **Cases:**
        - 401 Unauthorized when API Key missing.
        - 429 Too Many Requests when rate limit exceeded.

## Verification Checklist
- [ ] All new tests pass.
- [ ] Old tests (if any valid ones exist) pass.
- [ ] No regressions in Baseline tests.
