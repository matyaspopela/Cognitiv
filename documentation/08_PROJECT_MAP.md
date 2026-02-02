# Detailed Codebase Reference

This document provides a comprehensive, file-by-file breakdown of the **Cognitiv** project. It is intended for developers who need to understand the precise logic and responsibility of each component in the system.

## 1. Project Root

### `platformio.ini`
-   **Purpose:** Configuration for the PlatformIO build system used for the ESP8266 firmware.
-   **Key Settings:**
    -   `board = esp12e`: Target hardware.
    -   `lib_deps`: Lists libraries downloaded automatically (SparkFun SCD4x, Adafruit SSD1306, PubSubClient).
    -   `build_flags`: Injects environment variables (WiFi credentials, MQTT host) into the C++ code at build time.

### `server/` (Backend)
The backend is a Django project structured as a monolith that serves both the API and the React frontend.

#### `server/manage.py`
-   Standard Django CLI entry point. Used for `runserver`, `migrate`, etc.

#### `server/cognitiv/` (Project Config)
-   `settings.py`: Global Django settings.
    -   **Database**: Uses `pymongo` to connect to MongoDB (no standard Django ORM for sensor data).
    -   **CORS**: Configured to allow requests from the frontend during dev.
-   `urls.py`: Main router.
    -   Routes `/api/` to `api.urls`.
    -   Routes everything else to `api.views.serve_react_app` (Support for SPA client-side routing).

#### `server/api/` (Main Application)
This app handles all logic.

-   **`urls.py`**: Defines API endpoints.
    -   `/data`: GET/POST sensor readings.
    -   `/history/*`: Historical data for charts.
    -   `/admin/*`: Device management (rename, delete).
    -   `/datalab/*`: Advanced data analysis endpoints.
    -   `/annotation/*`: Logic for correlating sensor data with school timetables.

-   **`views.py`**: Core controller logic.
    -   `data_endpoint`: Receives POST data from sensors, validates it, and inserts it into MongoDB.
    -   `get_stats`: Calculates aggregate stats (avg CO2, active devices) for the dashboard.
    -   `history_series`: Returns time-series data for charts, supporting downsampling (bucketing).
    -   **MongoDB Connection**: Manages the connection to the database using `pymongo`. It handles `MONGO_URI` parsing and environment variable loading.

-   **`models.py`**: (Not heavily used in this NoSQL setup). Data structures are defined implicitly in `views.py` and serializers.

-   **`services/`**:
    -   `mqtt_service.py`: Handles MQTT connection and message processing (if running as a service).
    -   `ai_service.py`: Interface to Google Gemini for the "AI Assistant" feature.

#### `server/api/datalab/` (Sub-module: DataLab)
A specialized module for the "DataLab" feature (advanced querying).
-   `views.py`:
    -   `preview_query`: Runs an aggregation pipeline on MongoDB to preview results.
    -   `export_data`: Streams data as CSV/JSONL/PDF using `StreamingHttpResponse`.
-   `query_builder.py`: Converts frontend filter objects (JSON) into MongoDB Aggregation Pipelines.
-   `export_engine.py`: Handles the formatting of data into CSV or PDF.

#### `server/api/annotation/` (Sub-module: Annotation)
Handles the "Smart School" features (correlating CO2 with class schedules).
-   `annotator.py`: The core logic.
    -   `annotate_day(date)`: Fetches sensor data and timetable data for a given day.
    -   `group_readings_by_hour`: Buckets data into 1-hour slots.
    -   `compute_bucket_stats`: Calculates min/max/avg for each hour.
    -   **Storage**: Saves processed data into the `annotated_readings` collection.
-   `timetable_fetcher.py`: Connects to the external school system (Bakalari) to get class schedules.
-   `room_manager.py`: Manages the mapping between device MAC addresses and physical room codes (e.g., "Device A -> Room B2").

---

## 2. Frontend (`frontend/src`)
A React application built with Vite.

### Core Architecture
-   **`main.jsx`**: Bootstrapper. Mounts `App`.
-   **`App.jsx`**: Routing configuration.
    -   Uses `react-router-dom`.
    -   Wraps routes in `AppShell` (sidebar/layout).
    -   Protected routes (Admin, DataLab) are wrapped in `ProtectedRoute`.

### `src/services/` (API Layer)
-   **`api.js`**: **The most important file for data**.
    -   `apiClient`: An Axios instance with base URL logic (auto-switches between dev/prod).
    -   `dataAPI`: Methods for `/api/data`, `/api/stats`.
    -   `historyAPI`: Methods for `/api/history/*`.
    -   `adminAPI`: Methods for device management.
-   **`datalabService.js`**: Specific methods for DataLab (preview, export, presets).

### `src/context/`
-   **`AuthContext.jsx`**:
    -   Manages `isAdmin` state.
    -   Persists login via `localStorage` ('cognitiv_admin_auth').
    -   Provides `login()` and `logout()` functions to the app.

### `src/hooks/`
-   **`useDashboardStats.js`**:
    -   Fetches global stats (total devices, avg CO2) on mount.
    -   Combines calls to `getDevices`, `getStats`, and `getStatus`.

### `src/components/`

#### `dashboard/` (Main View Widgets)
-   **`DashboardOverview.jsx`**: Top row of cards (Total Devices, Online status).
-   **`DeviceDetailView.jsx`**: The detailed view when a user clicks a device.
    -   **State**: Tracks `timeWindow` (24h, 7d).
    -   **Charts**: Renders `Co2Graph`, `ClimateGraph`, `QualityPieChart`.
    -   **Logic**: Fetches specific device history via `historyAPI.getSeries`.
-   **`MetricCard.jsx`**: Generic UI for displaying a single stat (e.g., "800 ppm").
-   **`ActivityFeed.jsx`**: Side panel showing recent alerts/events.

#### `DataLab/` (Advanced Analytics UI)
-   **`QueryBuilder/`**: Form inputs for selecting dates, rooms, and metrics.
-   **`DataVisualizer/`**: Renders the results of a DataLab query (likely using Recharts or Chart.js).
-   **`ExportWizard/`**: Step-by-step UI for downloading data.

#### `layout/`
-   **`AppShell.jsx`**: The main container. Renders the `Sidebar` and the main content area.
-   **`Sidebar.jsx`**: Navigation menu.

### `src/pages/`
-   **`Dashboard.jsx`**:
    -   **Logic**: Checks URL params (`?device=...`).
    -   **Render**: If a device is selected, shows `DeviceDetailView`. Otherwise, shows the grid of all devices (`DashboardBoxGrid`).
-   **`AdminPanel.jsx`**:
    -   Table view of all devices.
    -   Allows renaming, deleting, and merging devices.
    -   Requires `isAdmin` context.
-   **`Login.jsx`**: Simple form that calls `auth.login()`.

---

## 3. Firmware (`src/main.cpp`)
The C++ code for the ESP8266 microcontroller.

### Core Logic
-   **`setup()`**:
    1.  **I2C Init**: Scans for sensors (SCD41) and display (SSD1306).
    2.  **WiFi**: Connects using credentials from `config.h` (injected via `platformio.ini`).
    3.  **Time**: Syncs time via NTP (critical for "Quiet Hours").
-   **`loop()`**:
    1.  **Connection Check**: Reconnects WiFi/MQTT if lost.
    2.  **Sensor Read**: Reads SCD41 (CO2, Temp, Hum) every `READING_INTERVAL`.
    3.  **Display**: Updates OLED screen.
    4.  **Publish**: Sends JSON payload to MQTT topic.
    5.  **Quiet Hours**: Checks time. If in quiet hours (e.g., night), enters Deep Sleep to save power and turn off the screen.

### Key Functions
-   `readSensors()`: Reads raw data, converts voltage, validates ranges.
-   `sendSingleReading()`: Serializes data to JSON and publishes to MQTT.
-   `enterQuietHoursSleep()`: Puts the ESP into deep sleep. Requires hardware reset to wake up.

---

## 4. Data Flow Summary
1.  **Sensor** (ESP8266) reads CO2.
2.  **Firmware** sends JSON via MQTT to Broker.
3.  **Server** (Django) receives data (via script or direct POST in this hybrid setup).
4.  **View** (`data_endpoint`) saves to MongoDB `sensor_data_` collection.
5.  **Frontend** (`Dashboard.jsx`) polls `/api/data` or `/api/history`.
6.  **User** sees the updated chart.