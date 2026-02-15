# Feature: Rate Limiting

**Priority:** High
**Status:** Spec
**Related:** `docs/specs/active/BACKEND_REFACTOR_PLAN_V2.md` Section 1.3

## Problem
Public endpoints, especially `/api/data`, are exposed without rate limiting. This makes the system vulnerable to denial-of-service (DoS) attacks or spamming from malfunctioning devices.

## Proposed Solution
Implement `@ratelimit` decorators using `django-ratelimit`.

### 1. Configuration
- Install `django-ratelimit`.
- Configure cache backend (Redis is preferred, but LocMem is fine for single-instance).

### 2. Policies
| Endpoint | Method | Rate | Key | Action |
| :--- | :--- | :--- | :--- | :--- |
| `/api/data` | POST | 60/m | IP / API Key | 429 Too Many Requests |
| `/admin/login` | POST | 5/m | IP | 429 |
| `/dashboard` | GET | 100/m | IP | 429 |

### 3. Implementation
- Decorate views in `server/api/views.py`.
- handle `Ratelimited` exception globally or via custom view handler to return JSON `{"error": "Too Many Requests"}`.

### Tasks
- [ ] Add `django-ratelimit` to `requirements.txt`.
- [ ] Apply decorators to public views.
- [ ] Test rate limiting with a script (rapid fire requests).
