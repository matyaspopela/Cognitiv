# Data Annotation & DataLab Upgrade

This document outlines the requirements and implementation plan for upgrading the **Cognitiv** system. The goal is two-fold:
1.  **Enrich Data:** Enhance the `annotated_readings` collection with deep contextual metadata.
2.  **Expose Data:** Create "DataLab," a new advanced frontend section for batch analysis, smart filtering, and diverse export formats (CSV/JSON/PDF).

---

## 1. Objectives

### Core Goals
*   **Enrichment:** Add physical room parameters, calculated occupancy, and external weather conditions to every data point.
*   **DataLab:** A dedicated UI workflow for querying, visualizing, and exporting this enriched data.
*   **Automation:** Enable automated PDF status reports for school administration.

### New Data Points (Metadata)
1.  **Fixed (Room Config):** `volume_m3`, `window_area_m2`, `floor_area_m2`.
2.  **Dynamic (Calculated & Hardcoded):** `occupancy_estimate` and `age_group`. These are derived from the **timetable** (class/group name) and **room configuration** during the primary annotation run and hardcoded into the document.
3.  **External (Weather):** `outside_temp`, `outside_humidity`, `outside_pressure`. These are fetched asynchronously into a separate collection and merged during export.
4.  **On-the-fly Metrics:** `delta_co2` (change since last reading). Calculated during export to ensure mathematical correctness and reduce storage overhead.

---

## 2. Architecture & Files

### Backend (Enrichment)
| File Path | Role |
| :--- | :--- |
| `server/api/annotation/room_config.py` | Store room metadata (`RoomMetadata` struct) and class-to-occupancy/age mappings. |
| `server/api/annotation/weather_service.py` | **(New)** Asynchronous service (cron) to fetch and store weather data in a dedicated collection. |
| `server/api/annotation/annotator.py` | Integrate room config and occupancy logic (derived from timetable) into the annotation loop. **Denormalize** room/occupancy context into buckets. |
| `server/api/data_lab/` | **(New)** Django app or module for advanced query building and export generation. |
| `server/api/data_lab/views.py` | API endpoints for DataLab (filtering, presets, export). |
| `server/api/data_lab/exporters.py` | Logic for **Streaming** CSV/JSON (ML-ready) and PDF (Report) generation. |

### Frontend (DataLab)
| Component | Role |
| :--- | :--- |
| `frontend/src/pages/DataLab.jsx` | **(New)** Main entry point for the DataLab section. |
| `frontend/src/components/datalab/` | **(New)** Directory for DataLab components. |
| `.../QueryBuilder.jsx` | UI for "Smart Filtering". Includes **Live Row Count** preview. |
| `.../ExportWizard.jsx` | Steps for selecting format (CSV/JSON/PDF), **Column Selector**, downsampling, and metadata. Includes **Data Preview Table**. |
| `.../DataVisualizer.jsx` | **(New)** Standalone "Analysis Mode" for on-demand charting and trend discovery. |
| `.../PresetManager.jsx` | Save/Load user filter configurations. |

---

## 3. Implementation Plan

### Phase 1: Backend - Data Enrichment
1.  **Configuration:** Refactor `room_config.py` to support `RoomMetadata` (volume, window area) and `ClassMetadata` (occupancy, age).
2.  **Weather:** Implement `weather_service.py` to fetch historical weather asynchronously via cron job, storing it in a dedicated `weather_history` collection.
3.  **Enrichment:** Update `annotator.py` to perform metadata lookups for room and occupancy/age **during** the primary daily annotation run.
    *   **Hardcode context:** Room parameters, occupancy, and age groups are derived from the room config and the current lesson in the timetable.
    *   **Denormalize** room and occupancy metadata directly into reading buckets to avoid expensive joins.
    *   **Merge on Export:** Weather data and `delta_co2` calculations are performed during the export generation (Phase 2) to ensure reliability and data integrity.
    *   *Constraint:* Fixed contextual data (room/occupancy) must be hardcoded at the time of bucket creation.
4.  **Env:** Add `SCHOOL_LAT`, `SCHOOL_LON` to `.env`.

### Phase 2: Backend - DataLab API
1.  **Query Engine:** Create `server/api/data_lab/query.py`.
    *   **Indexing:** Apply the **ESR Rule** (Equality, Sort, Range). Limit "searchable" fields to prevent index explosion.
2.  **Export Logic:**
    *   **Streaming:** Implement Python generators to stream CSV/JSONL rows directly to HTTP response, bypassing RAM limits.
    *   **Manifest (Reproducibility):** For every export, include a "Manifest" (commented header in CSV or `metadata.json` for JSONL) listing all query parameters (rooms, time range, aggregation, filters) to ensure reproducibility.
    *   **Logic:** Support custom field selection, downsampling (mean/max/std dev), and strict gap handling.
3.  **Presets:** Create a MongoDB collection `datalab_presets` to store user filter configs.

### Phase 3: Frontend - DataLab UI
1.  **Navigation:** Add "DataLab" to the Sidebar. Implement a "Mode Toggle" (Analysis vs. Export).
2.  **Wizard Interface (Export Mode):**
    *   **Step 1: Scope & Filter:** Visual Query Builder. **Critical:** Display "Result: ~X rows" live estimate.
    *   **Step 2: Schema:** Column Selector (Checkboxes) to exclude noise.
    *   **Step 3: Output:** **Preview Window** (5-row sample) and final **Export Trigger**.
3.  **Analysis Mode:**
    *   Integrate `DataVisualizer.jsx` for rapid charting of the filtered dataset.
    *   On-demand trend analysis and threshold highlighting.
4.  **Event Logging:** Add UI for "Contextual Events" (e.g., "Windows opened") to be included as optional export columns.

---

## 4. Key Features & Constraints

### Smart Filtering & Presets
*   **Performance:** MongoDB indexes must support common query patterns (Time + Room). Complex ad-hoc queries should be rate-limited or warned.
*   **Visual Builder:** Allow logic gates (AND/OR) for filtering.

### Export Formats
*   **ML-Ready (Streaming CSV/JSONL):**
    *   **Streaming:** Mandatory for large datasets.
    *   **Reproducibility:** Include a Manifest (header or sidecar file) with Query Params: `rooms`, `aggregation`, `filters`, `start_date`, etc.
    *   **Schema:** Precise timestamps, selected metadata, on-the-fly `delta_co2` (via window functions).
    *   **Aggregation:** Mean, Max, Standard Deviation (for noise detection).
    *   **Gap Handling:** Strictly `NULL`/Empty.
*   **Reports (PDF):**
    *   Automated "Principal Report": High-level summary, identifying "Problem Rooms", visual room map.

### Visualization (Analysis Mode)
*   **Decoupling:** Standalone mode, separate from the Export retrieval flow.
*   **Minimalism:** On-demand generation.
*   **Colors:** Sparse use for differentiation.

### Risks & Mitigations
*   **Memory Overhead:** Mitigated by **Streaming Exports**.
*   **API Rate Limits:** Mitigated by asynchronous cron fetching and local caching in a dedicated collection.
*   **Query Performance:** Mitigated by strict Indexing Strategy (ESR) and limiting searchable fields.