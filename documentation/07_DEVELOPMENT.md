# 7. Development Guide

How to set up Cognitiv on your local machine for development.

## 📋 Prerequisites
-   **Python 3.11+**
-   **Node.js 18+**
-   **MongoDB** (Local instance or Atlas connection)
-   **VS Code** (Recommended) with PlatformIO extension (for firmware)

## 🔧 Backend Setup

1.  **Navigate to server:**
    ```bash
    cd server
    ```
2.  **Create Virtual Environment:**
    ```bash
    python -m venv venv
    source venv/bin/activate  # Windows: venv\Scripts\activate
    ```
3.  **Install Dependencies:**
    ```bash
    pip install -r requirements.txt
    ```
4.  **Configure Environment:**
    Create a `.env` file in the project root (parent of `server/`):
    ```env
    DEBUG=true
    MONGO_URI=mongodb://localhost:27017/
    MONGO_DB_NAME=cognitiv_dev
    MQTT_BROKER_HOST=... (optional for local dev)
    ```
5.  **Run Server:**
    ```bash
    python manage.py runserver
    ```
    API will be at `http://localhost:8000/api`.

## ⚛️ Frontend Setup

1.  **Navigate to frontend:**
    ```bash
    cd frontend
    ```
2.  **Install Dependencies:**
    ```bash
    npm install
    ```
3.  **Run Dev Server:**
    ```bash
    npm run dev
    ```
    Dashboard will be at `http://localhost:5173`.
    *Note: The frontend dev server proxies API requests to `localhost:8000` defined in `vite.config.js`.*

## 💾 Firmware Development

1.  Open the project root in VS Code.
2.  Click the **PlatformIO** alien icon in the sidebar.
3.  **Build:** Click the Checkmark icon.
4.  **Upload:** Connect ESP8266 via USB and click the Arrow icon.
    *Ensure you have set the `sysenv` variables (WIFI_SSID, etc.) in your shell before building.*

## 🧪 Testing

-   **Backend Tests:** `cd server && python manage.py test`
-   **Frontend Tests:** `cd frontend && npx playwright test`

## 🤝 Contribution Guidelines
-   **Branching:** Use `feature/feature-name` or `fix/bug-name`.
-   **Style:**
    -   Python: PEP8.
    -   React: Functional components, Hooks, ESLint standard.
-   **Commits:** Clear, descriptive messages.
