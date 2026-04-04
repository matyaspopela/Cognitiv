# Cognitiv — Claude Context

IoT air quality monitoring system for classrooms. ESP8266 sensors publish CO₂/temp/humidity
via MQTT → Django backend → React dashboard.

## Stack

| Layer    | Tech |
|----------|------|
| Firmware | ESP8266 (PlatformIO + Arduino) — **being remade, ignore implementation details** |
| Backend  | Django 5 + MongoDB (PyMongo) + APScheduler + paho-mqtt |
| Frontend | React 18 + Vite + Tailwind + React Router 6 |
| Broker   | HiveMQ Cloud (TLS MQTT) |
| Deploy   | Render.com (`render.yaml`) |

## Directory Structure

```
Cognitiv/
├── src/                    # Firmware (C++) — to be remade
├── include/                # Firmware headers — to be remade
├── server/                 # Django backend
│   ├── api/
│   │   ├── views.py        # All API endpoints (~3500 lines)
│   │   ├── db.py           # MongoDB connection
│   │   ├── common.py       # Shared utilities
│   │   ├── mqtt_service.py # MQTT subscriber handler
│   │   ├── services/       # Business logic (data.py, device.py, auth.py)
│   │   ├── analytics/      # Mold risk, trend analysis
│   │   ├── annotation/     # Data enrichment (lessons, room context)
│   │   ├── datalab/        # Advanced query/export engine
│   │   └── management/     # Django CLI commands
│   ├── board_manager.py    # PlatformIO firmware upload utility
│   └── cognitiv/           # Django settings + WSGI
├── frontend/
│   ├── src/
│   │   ├── pages/          # Route-level components
│   │   ├── components/     # UI components
│   │   │   ├── DataLabV2/  # CANONICAL DataLab (V1 in DataLab/ is legacy)
│   │   │   └── ...
│   │   ├── services/api.js # Axios API client
│   │   ├── hooks/          # Data-fetching hooks
│   │   └── context/        # AuthContext, ThemeContext
│   └── package.json
├── platformio.ini          # Firmware build config (PlatformIO)
├── .env                    # Local secrets (gitignored)
└── .env.example            # Template for .env
```

## Backend Conventions

- **No Django ORM** — raw PyMongo throughout. All DB calls go via `api/db.py`.
- **Service layer pattern** — business logic lives in `api/services/`, not in views.
- **Auth** — custom API key middleware (`api/middleware/api_key.py`). Admin endpoints use `@api_login_required`.
- **Validation** — Pydantic v2 schemas in `api/schemas.py`.
- **Logging** — use `logging.getLogger(__name__)`, never `print()`.
- **MongoDB collections** — sensor data stored as timeseries. Device registry in `device_registry`.
- **Weekend data** — ingestion silently skips Saturday/Sunday readings (intentional).

## Frontend Conventions

- **Router** — React Router 6 in `App.jsx`. All routes are defined there.
- **DataLabV2** is the canonical DataLab implementation. `DataLab/` is legacy — pending deletion once V2 has a layout entry point.
- **Styling** — Tailwind utility classes. Theme tokens in `src/theme/`.
- **Charts** — Recharts for most charts, Chart.js for some legacy components.
- **API calls** — use `src/services/api.js` (Axios). Don't add raw fetch/axios calls in components.

## Dev Commands

```bash
# Backend
cd server
python manage.py runserver              # Django dev server (port 8000)
python manage.py mqtt_subscriber        # Start MQTT listener

# Frontend
cd frontend
npm run dev                             # Vite dev server (port 5173)
npm run build                           # Production build

# Firmware
cd Cognitiv/                            # project root
pio run                                 # Build firmware
pio run -t upload                       # Flash to device
```

## Required Environment Variables

See `.env.example`. Key vars: `DJANGO_SECRET_KEY`, `MONGO_URI`, `MQTT_BROKER`,
`MQTT_USER_PUB`, `MQTT_PASS_PUB`, `MQTT_USER_SUB`, `MQTT_PASS_SUB`.
Firmware credentials injected at build time via `platformio.ini` from `.env`.
