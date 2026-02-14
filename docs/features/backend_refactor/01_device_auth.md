# Feature: Device Authentication (API Keys)

**Priority:** High
**Status:** Spec
**Related:** `docs/specs/active/BACKEND_REFACTOR_PLAN_V2.md` Section 1.1

## Problem
Currently, devices authenticate via MAC address whitelisting. This is insecure as MAC addresses can appear in plain text and are easily spoofed.

## Proposed Solution
Implement a strong authentication mechanism using API Keys.

### 1. Database Schema Changes
- Collection: `device_registry`
- Field: `api_key_hash` (String, Indexed)
- Field: `api_key_prefix` (String, first 8 chars for identification)
- Field: `created_at` (Timestamp)

### 2. Middleware Implementation
- File: `server/api/middleware.py`
- Class: `ApiKeyMiddleware`
- Logic:
    1. Check for `X-API-Key` header.
    2. If missing and `ALLOW_LEGACY_AUTH=True`, allow (log warning).
    3. If present, hash and compare with `api_key_hash` in DB.
    4. Reject invalid keys with `401 Unauthorized`.

### 3. Transition Strategy
To avoid breaking existing devices:
1.  **Phase 1 (Dual Mode):** Support both MAC whitelist and API Keys. Log which method was used.
2.  **Phase 2 (Enforcement):** Disable MAC whitelist for write operations.

### Tasks
- [ ] Add `api_key` fields to `device_registry` schema.
- [ ] Create `server/api/middleware.py`.
- [ ] Implement hashing utility (Argon2 or simple SHA256 for speed if low entropy is acceptable for this use case, but standard Django hashing is preferred).
- [ ] Update `receive_data` view to respect middleware attributes.
