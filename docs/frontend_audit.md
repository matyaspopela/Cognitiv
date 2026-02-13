# Frontend Audit Report
**Date:** 2026-02-13
**Auditor:** Gemini CLI

## 🚨 Critical Vulnerabilities

### 1. Insecure Client-Side Authentication State
*   **File:** `frontend/src/context/AuthContext.jsx` (L23), `frontend/src/pages/Login.jsx` (L18)
*   **Issue:** The application relies on `localStorage` (`cognitiv_admin_auth`) to persist the `isAdmin` boolean. Frontend routing guards (`ProtectedRoute`, `Login` redirect) trust this value implicitly.
*   **Risk:** An attacker can manually set this key in the browser console to bypass UI guards and access Admin routes. While the backend *should* reject API calls (assuming proper cookie/session validation), the UI exposure is a security weakness.
*   **Fix:**
    *   Do not store `isAdmin` status in `localStorage` as a source of truth.
    *   Verify session validity with a backend endpoint (`/api/auth/me` or similar) on app load.

### 2. Potential Stagnant/Dead Code (`DataLabV2`)
*   **Location:** `frontend/src/components/DataLabV2/`
*   **Issue:** This directory contains a full dashboard implementation (`Dashboard`, `Sidebar`, `Widgets`) but is **not imported** by `App.jsx` or `DataLabLayout.jsx`.
*   **Risk:** Dead code increases maintenance burden, confuses developers, and may contain unpatched vulnerabilities.
*   **Fix:** Verify if this is an abandoned experiment or a work-in-progress. If abandoned, delete it. If WIP, hide behind a feature flag but ensure it compiles.

## ⚠️ High-Priority Improvements

### 1. "Unity Problem" — CSS Strategy Fragmentation
*   **Files:** `frontend/src/components/ui/*.css` vs `frontend/src/pages/AdminDevicePage.jsx`
*   **Issue:** The codebase suffers from a split personality in styling:
    *   **Old/Custom System:** Uses BEM methodology (`.md3-button`, `.login-page__card`) and custom CSS variables (`--md3-color-primary-500`) defined in `frontend/src/design/tokens.css`.
    *   **New/Tailwind System:** Uses utility classes (`flex`, `gap-6`, `bg-zinc-900`) directly in JSX.
*   **Impact:**
    *   **Inconsistency:** `tokens.css` defines colors that might slightly differ from Tailwind's `zinc` palette, leading to visual mismatch.
    *   **Maintenance:** Developers must check two places (Tailwind config and `tokens.css`) to change theme values.
    *   **Bundle Size:** Shipping both a heavy CSS variable system and Tailwind utilities increases CSS size.

### 2. Orphaned Files
*   **File:** `frontend/src/pages/Home.css`
*   **Issue:** This file defines styles for `.home-page` but no `Home.jsx` is used in the application (routes point to `Dashboard`).
*   **Fix:** Delete `Home.css` if confirmed unused.

## 💡 Refactoring Suggestions

### 1. Migrate UI Components to Tailwind
*   **Target:** `frontend/src/components/ui/` (`Button`, `Card`, `TextField`)
*   **Plan:** Refactor these components to use Tailwind utility classes instead of importing separate CSS files.
*   **Benefit:** Removes dependency on `tokens.css`, standardizes the codebase on Tailwind, and enables easier theming support.

### 2. Consolidate Layouts
*   **Target:** `Dashboard.jsx`, `AdminPanel.jsx`
*   **Plan:** Extract common shell/layout elements into reusable components to reduce code duplication and ensure consistent spacing/navigation across the app.

## ✅ Policy Compliance

| Category | Status | Notes |
| :--- | :--- | :--- |
| **Governance** | **PASS** | No hardcoded secrets found. Environment variables used correctly. |
| **Constraints** | **PASS** | `package-lock.json` is respected. Tech stack (React+Vite) matches architecture. |
| **Standards** | **FAIL** | Violates "Unity" principle (mixed CSS strategies). `Home.css` is technical debt. |

## 🏁 Final Verdict
**REQUEST CHANGES**

The frontend requires a cleanup pass to resolve the CSS fragmentation and remove dead code (`DataLabV2`, `Home.css`) before further feature development. The client-side auth state mechanism needs hardening.
