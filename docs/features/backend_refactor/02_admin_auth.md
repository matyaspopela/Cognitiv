# Feature: Admin Authentication (Django Native)

**Priority:** High
**Status:** Spec
**Related:** `docs/specs/active/BACKEND_REFACTOR_PLAN_V2.md` Section 1.2

## Problem
The current `admin_login` view uses a custom, less secure implementation that bypasses Django's robust built-in authentication system. It likely relies on simple session cookies or raw environment variable checks for every request.

## Proposed Solution
Migrate to standard `django.contrib.auth`.

### 1. Configuration
- Enable `django.contrib.auth` and `django.contrib.contenttypes` in `INSTALLED_APPS`.
- Configure `MIDDLEWARE` to include `AuthenticationMiddleware` and `SessionMiddleware`.

### 2. Superuser Management
- Create a strict management command or script `init_admin.py` that runs on container startup.
- Read `ADMIN_USER` and `ADMIN_PASSWORD` from env to create/update the superuser.

### 3. View Protection
- Remove custom `admin_login` logic.
- Use standard Django `login` view or DRF Token auth if moving to a pure API (Standard Django Session auth is fine for this Admin Panel).
- Decorate all `admin_*` views with `@login_required`.

### Tasks
- [ ] Update `settings.py` `INSTALLED_APPS` and `MIDDLEWARE`.
- [ ] Run Django migrations (`auth`).
- [ ] Create `scripts/init_admin.py`.
- [ ] Refactor `api/urls.py` to use standard auth views.
- [ ] Secure all admin views in `api/services/auth_service.py` (or views).
