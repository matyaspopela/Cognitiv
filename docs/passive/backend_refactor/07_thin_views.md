# Feature: Thin Views Refactor

**Priority:** Medium
**Status:** Spec
**Related:** `docs/specs/active/BACKEND_REFACTOR_PLAN_V2.md` Section 2.3

## Problem
`views.py` is a 3000-line monolith. Detailed logic for specific endpoints makes readability and maintenance a nightmare.

## Proposed Solution
Refactor `views.py` to be a "Thin Controller" layer. It should only coordinate:
1.  **Input Parsing:** Deserialize JSON/Query params (using Pydantic).
2.  **Service Invocation:** Call the appropriate Service method.
3.  **Response Formatting:** Serialize the result to JSON.

### Structure
- Keep `views.py` if it manages to stay under ~500 lines, OR:
- Split into `server/api/views/`:
    - `ingestion.py` (`receive_data`)
    - `dashboard.py` (`get_stats`, `history`)
    - `admin.py` (`admin_*`)

### Async Consideration
- Where possible, mark views as `async def`.
- **Constraint:** `pymongo` is synchronous. To benefit from async views, we must either:
    - Use `asgiref.sync_to_async` for DB calls (overhead).
    - Migrate to `motor` (huge refactor).
    - **Decision:** Keep synchronous for now to ensure stability with `pymongo`, but structure code cleanly.

### Tasks
- [ ] Refactor `receive_data` to use `DataService`.
- [ ] Refactor `get_stats` to use `DataService`.
- [ ] Refactor Admin views to use `DeviceService`.
- [ ] Delete legacy logic from `views.py`.
