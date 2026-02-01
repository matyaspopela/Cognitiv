# 4. Frontend Dashboard

The user interface is a Single Page Application (SPA) built with **React**. It focuses on clarity, performance, and a strict design system.

## 🎨 Design System: Monochrome Zinc

Cognitiv employs a strict "No-Color" policy for the UI framework to maintain a professional, clean aesthetic.

-   **Palette:** Zinc / Slate (Tailwind Grays).
-   **Accents:** None (No blue/purple buttons).
-   **Semantic Colors:** Red/Yellow/Green are **strictly reserved** for data visualization (gauges, charts) to indicate air quality status. They are NOT used for UI elements like buttons or alerts unless critical.
-   **Typography:** Inter (Sans-serif) and JetBrains Mono (Code/Data).
-   **Tokens:** Defined in `frontend/src/design/tokens.css`.

## 🏗️ Project Structure
```text
frontend/
├── src/
│   ├── components/         # Reusable UI widgets
│   │   ├── dashboard/      # Dashboard-specific widgets (Gauges, Cards)
│   │   ├── admin/          # Admin panel components
│   │   └── ui/             # Core atoms (Buttons, Inputs)
│   ├── pages/              # Main Route Views
│   │   ├── Dashboard.jsx   # Real-time view
│   │   ├── AdminPanel.jsx  # Management view
│   │   └── Login.jsx       # Auth view
│   ├── context/
│   │   └── AuthContext.jsx # User session state
│   ├── services/
│   │   └── api.js          # Axios wrapper for Backend API
│   └── utils/              # Helpers (Chart config, Date formatting)
```

## 🧩 Key Components

### 1. Dashboard (`pages/Dashboard.jsx`)
The main landing page.
-   **Device Selection:** Dropdown to switch between classrooms.
-   **Current Status:** Large "Traffic Light" gauge showing current CO2.
-   **History Charts:** Interactive `recharts` line graphs showing 24h trends.
-   **Stats Cards:** Min/Max/Avg summaries.

### 2. Admin Panel (`pages/AdminPanel.jsx`)
Restricted area for system management.
-   **Device Manager:** Rename devices, view MAC addresses, toggle Whitelist status.
-   **Board Analysis:** Specialized views for "Annotated Data" (Heatmaps, Lesson breakdown).
-   **Annotation Control:** Trigger manual annotation runs.

### 3. Ventilation Guide
A dedicated view that interprets current CO2 levels into actionable advice (e.g., "Open windows for 5 minutes").

## 🛠️ Technology Stack
-   **Build Tool:** Vite (Fast HMR and building).
-   **Styling:** Tailwind CSS + CSS Modules.
-   **Routing:** `react-router-dom` v6.
-   **Charts:** 
    -   `recharts` (Main time-series).
    -   `react-chartjs-2` (Specific statistical plots).
-   **Icons:** `lucide-react`.

## 📦 Build Process
The frontend is built as static assets served by the Django backend.
1.  `npm run build` transpiles React to `frontend/dist`.
2.  `Django` collects these into its static files directory.
3.  The root URL `/` serves `index.html`.
