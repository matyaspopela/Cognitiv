# Backend Audit Report: Cognitiv IoT Platform

**Date:** 2026-02-13
**Target:** `server/` directory
**Scope:** Architecture, Security, Database, Performance, Code Quality

---

## 🚨 Critical Vulnerabilities

### 1. Lack of Device Authentication
*   **File:** `server/api/views.py` (lines ~1380, `receive_data`)
*   **Finding:** The `/api/data` endpoint is `@csrf_exempt` and relies solely on a MAC address whitelist (`is_mac_whitelisted`).
*   **Risk:** MAC addresses can be spoofed. Without a shared secret (API Key) or client-side certificate (mTLS), an attacker can inject false sensor data if they guess a whitelisted MAC.
*   **Recommendation:** Implement API Key authentication for devices. Each device should send an `X-API-Key` header or include a signature in the payload.

### 2. Admin Authentication Mechanism
*   **File:** `server/api/views.py` (lines ~2090, `admin_login`)
*   **Finding:** Admin credentials are single static values (`ADMIN_USERNAME`, `ADMIN_PASSWORD`) loaded from environment variables.
*   **Risk:** 
    *   No rate limiting on the login endpoint (Brute-force risk).
    *   Compromise of the environment variables grants full admin access.
    *   No multi-user support or audit logging of *who* performed an action.
*   **Recommendation:** Migrate to Django's built-in User authentication system or implement rate-limiting and support multiple admin accounts.

### 3. Missing Rate Limiting
*   **File:** `server/api/views.py`
*   **Finding:** Public endpoints (`get_data`, `get_stats`) and ingestion endpoints lack rate limiting.
*   **Risk:** DoS attacks or resource exhaustion by flooding the server with requests.
*   **Recommendation:** Implement `django-ratelimit` or similar middleware.

---

## ⚠️ High-Priority Improvements

### 1. Monolithic Views & Architecture
*   **File:** `server/api/views.py` (3400+ lines)
*   **Finding:** This file contains database connection logic, schema validation, complex business logic, and view handling.
*   **Impact:** Hard to maintain, test, and reason about.
*   **Recommendation:** Refactor into:
    *   `server/api/db.py`: Database connection and collection management.
    *   `server/api/services/`: Business logic (e.g., `DeviceService`, `DataService`).
    *   `server/api/serializers.py`: Data validation and normalization.
    *   `server/api/views.py`: Thin layer handling HTTP request/response.

### 2. Manual MongoDB Aggregation Construction
*   **File:** `server/api/views.py` (e.g., `history_series`, `history_summary`)
*   **Finding:** Complex aggregation pipelines are constructed manually within views using string manipulation and conditional logic.
*   **Impact:** Prone to logical errors and hard to debug.
*   **Recommendation:** Encapsulate query building in a `Repository` pattern or use a query builder utility (partially started in `datalab/query_builder.py` but not used everywhere).

### 3. MQTT Implementation
*   **File:** `server/api/mqtt_service.py`
*   **Finding:** The MQTT worker creates a mock HTTP request (`RequestFactory`) to call `receive_data` view for every message.
*   **Impact:** Unnecessary overhead (creating request objects, double JSON parsing). Bypasses standard middleware stack (except for what's manually invoked).
*   **Recommendation:** Extract the data processing logic from `receive_data` into a shared service function (e.g., `process_sensor_data(payload)`) that can be called by both the HTTP view and the MQTT worker.

### 4. Legacy Schema Support
*   **File:** `server/api/views.py`
*   **Finding:** Extensive checks for `device_id` vs `metadata.device_id` and `mac_address`.
*   **Impact:** Code clutter and potential for subtle bugs where one path is updated but the other isn't.
*   **Recommendation:** Create a migration script to normalize all historical data to the new schema (Timeseries with `metadata`) and remove the backward compatibility logic.

---

## 💡 Refactoring Suggestions

### 1. Database Connection Management
*   **Current:** `init_mongo_client` and `get_mongo_collection` with global lazy variables in `views.py`.
*   **Suggested:** Move to a Singleton pattern in `server/api/db.py`.

### 2. Static File Serving
*   **Current:** Manual logic to find and serve React build assets in `serve_react_asset`.
*   **Suggested:** Rely fully on `WhiteNoise` (configured in `settings.py` but seemingly bypassed or augmented by manual views). Ensure the frontend build process places files where WhiteNoise expects them.

### 3. Configuration Management
*   **Current:** `settings.py` has complex logic for loading `.env` files vs Render env vars.
*   **Suggested:** Simplify. Use `python-dotenv` to load `.env` into `os.environ` *before* `settings.py` runs (e.g., in `manage.py` and `wsgi.py`), so `settings.py` only reads `os.getenv`.

---

## ✅ Policy Compliance

| Policy | Status | Notes |
| :--- | :--- | :--- |
| **Governance** | **PASS** | No hardcoded secrets found (uses `os.getenv`). Permissions checks exist for admin actions. |
| **Constraints** | **PASS** | Uses MongoDB and Python 3.11+ as required. |
| **Standards** | **FAIL** | Code style violates "Separation of Concerns" (Monolithic `views.py`). Logic is complex and nested. |

---

## Final Verdict
**REQUEST CHANGES**

The backend is functional but suffers from significant technical debt in `views.py`. Security is "soft" (reliance on MAC whitelist) and architecture is monolithic. Refactoring `views.py` is critical before adding new features.
