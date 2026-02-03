# 3. Backend Server

The backend is the brain of Cognitiv, built with **Django 5**. It handles data ingestion, storage, and the REST API.

## 📂 Project Structure
```text
server/
├── manage.py            # Django entry point
├── requirements.txt     # Python dependencies
├── board_manager.py     # Utilities for board config/upload
├── cognitiv/            # Project settings
│   ├── settings.py
│   └── urls.py          # Root URL routing
└── api/                 # Main application app
    ├── models.py        # (Unused - we use PyMongo directly)
    ├── views.py         # API Controllers & Logic
    ├── urls.py          # API Route definitions
    ├── mqtt_service.py  # Background MQTT worker
    └── annotation/      # School timetable integration
```

## 🗄️ Database (MongoDB)

Cognitiv bypasses the Django ORM for sensor data, using `pymongo` for direct performance and flexibility with MongoDB Atlas.

### Collections

1.  **`sensor_data_` (Time-Series)**
    -   Stores raw sub-minute readings.
    -   **Schema:**
        ```json
        {
            "timestamp": ISODate("..."),
            "metadata": { "device_id": "...", "mac_address": "..." },
            "co2": 800,
            "temperature": 22.5,
            "humidity": 45.0
        }
        ```
    -   **Indexes:** `timestamp` (DESC), `metadata.device_id`.

2.  **`device_registry`**
    -   Inventory of known devices.
    -   **Fields:** `mac_address`, `display_name`, `last_data_received`, `whitelisted`.

3.  **`annotated_readings`**
    -   Aggregated hourly data linked to lessons (see below).

4.  **`datalab_presets`**
    -   Stores user-saved filter configurations (rooms, date ranges, metrics).

5.  **`settings`**
    -   Key-value store for system configuration (e.g., `whitelist_enabled: true`).

## 📡 MQTT Ingestion Service
---
## 🎓 Data Annotation Engine
---
## 🧪 DataLab & Export Engine
Located in `server/api/datalab/`.
A powerful subsystem for historical data retrieval and analysis.

1.  **Query Builder:** Dynamically constructs MongoDB aggregation pipelines based on frontend filters.
2.  **Streaming Export:** Uses `StreamingHttpResponse` to handle large datasets without memory exhaustion. Supports **CSV** and **JSONL** formats.
3.  **Presets API:** (Planned) Will allow users to save and manage frequently used complex queries.

## 🛡️ Security & Validation
-   **MAC Whitelist:** If enabled in `settings`, the server rejects data from unknown MAC addresses.
-   **Data Validation:** Incoming JSON is strictly validated for:
    -   Required fields (`timestamp`, `mac_address`, `co2`...).
    -   Value ranges (e.g., Temperature -10 to 50°C).
-   **Authentication:** 
    -   **API:** Session-based (Django Admin) or Token-based (future).
    -   **Devices:** MQTT Credentials + MAC Whitelist.
