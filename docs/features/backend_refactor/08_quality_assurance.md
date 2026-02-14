# Feature: Quality Assurance (Typing & Testing)

**Priority:** Medium
**Status:** Spec
**Related:** `docs/specs/active/BACKEND_REFACTOR_PLAN_V2.md` Section 3.1 & 3.2

## Problem
The codebase lacks static type safety strings (Python < 3.5 style) and has insufficient unit test coverage, making refactoring risky.

## Proposed Solution
Enforce strict quality standards for new code.

### 1. Type Hinting
- All function signatures **MUST** have type hints.
- Use `typing.Optional`, `typing.List`, `typing.Dict` (or standard collections for Py3.9+).
- Use `mypy` to verify.

### 2. Testing Strategy
- **Unit Tests:** Focus on the new Service Layer.
    - Mock `MongoManager` and `pymongo` return values.
    - Test edge cases (validators, empty DB, connection errors).
- **Integration Tests:** Focus on Views.
    - Use `APIRequestFactory`.
    - Test rate limits and error codes (400, 401, 429).

### Tasks
- [ ] Add `mypy` and `pytest` to `requirements.txt`.
- [ ] Create `server/setup.cfg` or `pyproject.toml` for mypy/pytest config.
- [ ] Write tests for `DataService` logic.
- [ ] Write tests for `AuthService` logic.
- [ ] Run coverage report.
