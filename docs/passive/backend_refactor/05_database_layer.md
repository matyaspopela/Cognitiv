# Feature: Database Layer Refactor

**Priority:** Medium
**Status:** Spec
**Related:** `docs/specs/active/BACKEND_REFACTOR_PLAN_V2.md` Section 2.1

## Problem
Currently, MongoDB connections are initialized lazily within views or global scope without proper connection pooling management. This leads to code duplication (`init_mongo_client` called in multiple places) and potential resource exhaustion. Indexes are not managed in code.

## Proposed Solution
Implement a thread-safe Singleton `MongoManager` to centralize DB logic.

### 1. The `MongoManager` Class
- File: `server/api/db.py`
- Pattern: Singleton
- Responsibilities:
    - Initialize `pymongo.MongoClient` once.
    - Handle `fork` safety (if deploying with gunicorn preload).
    - Provide accessors: `get_db()`, `get_collection(name)`.
    - Apply indexes on startup.

### 2. Connection Pooling
- Explicitly set `maxPoolSize` (e.g., 50) and `minPoolSize` (e.g., 10) based on env vars.
- Configure `serverSelectionTimeoutMS` to fail fast if DB is down.

### 3. Index Management
Define indexes in code and apply them during initialization:
- `data`: `[('mac_address', 1), ('timestamp', -1)]`
- `device_registry`: `[('mac_address', 1)]` (Unique)
- `api_keys`: `[('key_hash', 1)]`

### Tasks
- [ ] Create `server/api/db.py`.
- [ ] Implement `MongoManager`.
- [ ] Add `ensure_indexes` method.
- [ ] Replace direct `pymongo` calls in views with `MongoManager.get_instance().get_collection(...)`.
