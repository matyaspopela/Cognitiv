# DataLab Finalization Plan

## Current State Analysis

### 1. Backend Implementation (`server/api/datalab/`, `server/api/views.py`)
*   **Export Engine (`export_stream`)**:
    *   ✅ Supports CSV export.
    *   ❌ JSONL export is stubbed/incomplete ("not implemented in this minimal pass").
    *   ❌ PDF export is completely missing.
    *   ❌ Manifest generation (metadata header/file) is missing.
    *   ❌ Delta CO2 calculation is missing.
*   **Query Builder**:
    *   ✅ Basic filtering (date range, rooms) implemented.
*   **Weather Service**:
    *   ✅ Implemented and integrated into `export_stream`.
*   **API Views**:
    *   ✅ `GET /api/datalab/export`: Wired to `ExportEngine`.
    *   ✅ `POST /api/datalab/preview`: Implemented with `QueryBuilder` and count estimation.
    *   ❌ Presets API (`GET/POST /api/datalab/presets`) is completely missing.
    *   ❌ Filter options endpoint (to populate UI dropdowns) is missing.

### 2. Frontend Implementation (`frontend/src/components/DataLab/`)
*   **Components**:
    *   ✅ `DataLabLayout`, `QueryBuilder`, `ExportWizard`, `Presets` exist structurally.
*   **Service Layer (`datalabService.js`)**:
    *   ❌ **CRITICAL:** All methods (`previewQuery`, `downloadExport`, `getPresets`, `savePreset`) are **MOCKED** with `setTimeout` and hardcoded data.
*   **Routing**:
    *   ✅ `/datalab` route exists in `App.jsx`.

---

## Todo List & Implementation Plan

### Phase 1: Backend Completion

#### 1.1. Enhance Export Engine
*   **File:** `server/api/datalab/export_engine.py`
*   **Task:** Implement JSONL export format.
*   **Task:** Implement PDF export using `ReportLab` or `WeasyPrint` (add dependency to `requirements.txt`).
    *   *Note:* Ensure PDF generation is memory efficient for large datasets.
*   **Task:** Add Manifest generation.
    *   CSV: Add header comments `# Metadata: ...`
    *   JSONL: First line is metadata object.
*   **Task:** Implement Delta CO2 calculation (window function logic in generator).

#### 1.2. Implement Presets API
*   **File:** `server/api/views.py` (or new `datalab_views.py` if refactoring)
*   **Task:** Create `GET /api/datalab/presets` to list saved filters.
*   **Task:** Create `POST /api/datalab/presets` to save current configuration.
*   **Task:** Create `DELETE /api/datalab/presets/<id>` to remove presets.
*   **Database:** Ensure `datalab_presets` collection is used.

#### 1.3. API Testing
*   **Task:** Verify `export_stream` works with real data and `WeatherService`.
*   **Task:** Ensure large exports don't timeout (verify streaming response).

### Phase 2: Frontend Integration

#### 2.1. Update `datalabService.js`
*   **File:** `frontend/src/services/datalabService.js`
*   **Task:** Remove mocks. Connect to real endpoints:
    *   `previewQuery` -> `POST /api/datalab/preview`
    *   `downloadExport` -> `GET /api/datalab/export` (handle blob/download)
    *   `getPresets` -> `GET /api/datalab/presets`
    *   `savePreset` -> `POST /api/datalab/presets`

#### 2.2. Component Wiring
*   **File:** `frontend/src/components/DataLab/Presets/PresetList.jsx`
    *   **Task:** Connect to real `datalabService.getPresets`.
*   **File:** `frontend/src/components/DataLab/ExportWizard/ExportWizard.jsx`
    *   **Task:** ensure format selection passes correct param to API.
*   **File:** `frontend/src/components/DataLab/QueryBuilder/QueryBuilder.jsx`
    *   **Task:** Populate room options from `api.getRooms()` or similar, not hardcoded list.

### Phase 3: Final Polish
*   **Task:** Add "Download" button loading state handling.
*   **Task:** Error handling for failed exports or empty results.
*   **Task:** Verify "Include Weather" toggle actually affects the backend request.

## Dependencies to Add
*   **Backend:** `reportlab` or `weasyprint` (for PDF).
*   **Frontend:** None anticipated.
