# 6. Deployment

Cognitiv is designed for deployment on **Render.com** as a unified Web Service.

## ☁️ Render.com Configuration

The deployment is defined in `render.yaml` at the project root.

### Build Pipeline
Because the repo contains both Python (Backend) and Node.js (Frontend), the build command executes them sequentially:

```bash
# 1. Build Frontend
cd frontend && npm install && npm run build && cd ..

# 2. Install Backend Dependencies
pip install -r server/requirements.txt

# 3. Collect Static Files (Merges React build into Django static)
cd server && python manage.py collectstatic --noinput
```

### Start Command
Uses `gunicorn` to serve the application.
```bash
cd server && gunicorn cognitiv.wsgi:application --bind 0.0.0.0:$PORT
```

## 🔑 Environment Variables

These variables must be set in the Render Dashboard (or `.env` for local dev).

### Core
-   `DEBUG`: `false` (Production) / `true` (Dev).
-   `DJANGO_SECRET_KEY`: A long random string.
-   `LOCAL_TIMEZONE`: e.g., `Europe/Prague`.

### Database (MongoDB Atlas)
-   `MONGO_URI`: Full connection string (e.g., `mongodb+srv://user:pass@cluster...`).
-   `MONGO_DB_NAME`: `cognitiv`.

### MQTT (HiveMQ)
-   `MQTT_BROKER_HOST`: Hostname of the broker.
-   `MQTT_BROKER_PORT`: `8883` (TLS).
-   `MQTT_USERNAME`: Subscriber username.
-   `MQTT_PASSWORD`: Subscriber password.
-   `MQTT_TOPIC`: Topic to subscribe to.

## 🚀 Deployment Steps

1.  Push code to GitHub.
2.  Create a new **Web Service** on Render connected to the repo.
3.  Select the `Python 3` environment.
4.  Copy the Build and Start commands from `render.yaml` (or let Render detect the YAML).
5.  Input all Environment Variables.
6.  Deploy.

## 🔄 Static Files Strategy
Render does not persist local files.
-   **Django Static:** `whitenoise` is used to serve static files (including the React app) directly from the application in production.
-   **React App:** The `index.html` and assets are placed in `server/staticfiles/` during the `collectstatic` phase and served by WhiteNoise.
