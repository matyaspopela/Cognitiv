# TypeScript Migration Guide

This document serves as a roadmap for migrating the **Cognitiv** frontend codebase from JavaScript/JSX to TypeScript.

## 1. Preparation & Setup

### Dependencies
First, install TypeScript and the necessary type definitions.

```bash
cd frontend
npm install --save-dev typescript @types/react @types/react-dom @types/node @types/react-router-dom
```

*Note: Libraries like `axios`, `date-fns`, `lucide-react`, `recharts`, and newer versions of `chart.js` typically ship with their own type definitions.*

### Configuration (`tsconfig.json`)
Create a `tsconfig.json` in the `frontend` root:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,

    /* Bundler mode */
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",

    /* Linting */
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

## 2. Project Structure & Migration Map

The following tables detail every file requiring migration, grouped by architectural layer.

### Phase 1: Core Utilities & Services
*Migrate these first to establish base types for data structures.*

| File Path | Description | Strategy |
| :--- | :--- | :--- |
| `src/utils/charts.js` | Chart configuration helpers. | Define interfaces for Chart.js/Recharts config objects. |
| `src/utils/colors.js` | Color palette constants/functions. | Ensure return types are strict strings (hex/rgba). |
| `src/utils/timeWindow.js` | Time window calculation logic. | Type inputs (`Date`) and outputs. |
| `src/services/api.js` | Main backend API client (Axios). | **CRITICAL:** Define `ApiResponse<T>` and interfaces for `Device`, `Reading`, `Room`. |
| `src/services/datalabService.js` | DataLab specific API calls. | Define interfaces for `DataLabQuery`, `ExportConfig`. |
| `src/design/tokens.js` | Design system tokens. | Export typed constants. |
| `src/design/theme.js` | Theme utility functions. | Type theme objects. |

### Phase 2: UI Primitives (Components/UI)
*Leaf-node components with few dependencies.*

| File Path | Description | Strategy |
| :--- | :--- | :--- |
| `src/components/ui/Badge.jsx` | Status badge. | `interface BadgeProps { variant: 'success' | 'warning' ... }` |
| `src/components/ui/Button.jsx` | Generic button. | Extend `ButtonHTMLAttributes`. |
| `src/components/ui/Card.jsx` | Container card. | Prop `children: ReactNode`. |
| `src/components/ui/Chip.jsx` | Filter chip. | `interface ChipProps { label: string; active?: boolean }` |
| `src/components/ui/DataTable.jsx` | Data table. | Generic `interface DataTableProps<T> { data: T[]; columns: ColumnDef<T>[] }`. |
| `src/components/ui/Icon.jsx` | Icon wrapper. | Props for `name` (lucide keys) and `size`. |
| `src/components/ui/LoadingSpinner.jsx` | SVG spinner. | Simple props. |
| `src/components/ui/ProgressBar.jsx` | Progress indicator. | Props `value` (number), `max` (number). |
| `src/components/ui/QuickActionCard.jsx` | Dashboard action card. | Props for icon, title, onClick. |
| `src/components/ui/Select.jsx` | Dropdown. | Generic `SelectProps<T>`. |
| `src/components/ui/SettingsModal.jsx` | Modal dialog. | Props `isOpen`, `onClose`. |
| `src/components/ui/Skeleton.jsx` | Loading placeholder. | Props for width/height. |
| `src/components/ui/Snackbar.jsx` | Toast notification. | Props `message`, `type`. |
| `src/components/ui/TextField.jsx` | Input field. | Extend `InputHTMLAttributes`. |
| `src/components/ui/ThemeToggle.jsx` | Theme switcher. | No props, internal state. |

### Phase 3: Feature Components
*Components that consume UI primitives and Services.*

#### Layout
| File Path | Description | Strategy |
| :--- | :--- | :--- |
| `src/components/layout/AppShell.jsx` | Main app wrapper. | `children: ReactNode`. |
| `src/components/layout/Sidebar.jsx` | Navigation sidebar. | Props `mobileOpen`, `setMobileOpen`. |
| `src/components/layout/NavList.jsx` | Navigation items list. | Define `NavItem` interface. |
| `src/components/layout/TopHeader.jsx` | Header bar. | Props `onMenuClick`. |

#### Dashboard
| File Path | Description | Strategy |
| :--- | :--- | :--- |
| `src/components/dashboard/DashboardBox.jsx` | 3D visualizer container. | Types for Three.js props. |
| `src/components/dashboard/DashboardOverview.jsx` | Main dashboard view. | Type state variables for sensor data. |
| `src/components/dashboard/DeviceDetailView.jsx` | Specific device view. | Props `device: Device`. |
| `src/components/dashboard/KeyMetricsGrid.jsx` | Metric summary grid. | Props `readings: Reading[]`. |
| `src/components/dashboard/ActivityFeed.jsx` | Recent events list. | Define `Activity` interface. |
| `src/components/dashboard/AirQualityGauge.jsx` | Visual gauge. | Props `value`, `min`, `max`. |
| `src/components/dashboard/MetricCard.jsx` | Single metric display. | Props `label`, `value`, `trend`. |
| `src/components/dashboard/MinimalTimeSelector.jsx`| Date picker variant. | Props `value`, `onChange`. |
| `src/components/dashboard/TimeWindowSelector.jsx`| Date range picker. | Props `start`, `end`, `onChange`. |

#### Admin
| File Path | Description | Strategy |
| :--- | :--- | :--- |
| `src/components/admin/BoardAnalysisView.jsx` | Admin analytics. | Type chart data structures. |
| `src/components/admin/BoardCard.jsx` | Board management card. | Props `board: BoardConfig`. |
| `src/components/admin/DeviceActionsMenu.jsx` | Context menu. | Props `device: Device`. |
| `src/components/admin/DeviceCustomizationModal.jsx`| Edit device modal. | Props `device`. |
| `src/components/admin/DeviceDetailsModal.jsx` | View device modal. | Props `device`. |
| `src/components/admin/DeviceRenameModal.jsx` | Rename modal. | Props `device`, `onRename`. |
| `src/components/admin/OfflineInfoTooltip.jsx` | Helper tooltip. | Simple text props. |

#### DataLab (New Feature)
| File Path | Description | Strategy |
| :--- | :--- | :--- |
| `src/components/DataLab/DataLabLayout.jsx` | Main layout. | State for `QueryFilter`. |
| `src/components/DataLab/ModeSwitcher.jsx` | Toggle export/analysis. | Props `mode`, `setMode`. |
| `src/components/DataLab/DataVisualizer/TrendChart.jsx` | Line chart. | Recharts generic types. |
| `src/components/DataLab/DataVisualizer/CorrelationPlot.jsx` | Scatter plot. | Recharts generic types. |
| `src/components/DataLab/ExportWizard/DownloadButton.jsx` | Trigger download. | Props `onDownload`. |
| `src/components/DataLab/ExportWizard/FormatSelector.jsx` | File format picker. | Enum `ExportFormat`. |
| `src/components/DataLab/Presets/PresetList.jsx` | Saved queries. | Define `Preset` interface. |
| `src/components/DataLab/QueryBuilder/DateRangePicker.jsx` | Date inputs. | Props `start`, `end`, `onChange`. |
| `src/components/DataLab/QueryBuilder/MetricToggler.jsx` | Checkboxes. | Props `selectedMetrics`. |
| `src/components/DataLab/QueryBuilder/RoomSelector.jsx` | Multi-select. | Props `selectedRooms`. |

#### Analytics & AI
| File Path | Description | Strategy |
| :--- | :--- | :--- |
| `src/components/analytics/HourlyHeatmap.jsx` | Heatmap chart. | Complex data transformation types. |
| `src/components/analytics/LessonDistributionChart.jsx`| Bar chart. | ChartJS props. |
| `src/components/analytics/LessonPeriodChart.jsx` | Time series. | ChartJS props. |
| `src/components/analytics/StatsSummaryCards.jsx` | Aggregated stats. | Props `stats: AggregatedStats`. |
| `src/components/analytics/TeacherComparisonCard.jsx`| Comparison view. | Props `teachers: Teacher[]`. |
| `src/components/ai/AIAssistant.jsx` | Chat/Help interface. | Types for messages/intents. |

### Phase 4: Context & Hooks
*State management.*

| File Path | Description | Strategy |
| :--- | :--- | :--- |
| `src/context/AuthContext.jsx` | Authentication state. | **CRITICAL:** Define `AuthContextType` (user, login, logout). |
| `src/hooks/useDashboardStats.js` | Dashboard logic. | Return type `UseDashboardStatsResult`. |
| `src/theme/ThemeProvider.jsx` | Theme context. | Define `ThemeContextType`. |

### Phase 5: Pages & Roots
*The glue.*

| File Path | Description | Strategy |
| :--- | :--- | :--- |
| `src/pages/Dashboard.jsx` | Main route. | Convert to `FC`. |
| `src/pages/Login.jsx` | Login route. | Handle form events types. |
| `src/pages/AdminPanel.jsx` | Admin route. | Protected route logic. |
| `src/pages/VentilationGuide.jsx` | Static info page. | Simple `FC`. |
| `src/components/ProtectedRoute.jsx` | Route guard. | Props `children`. |
| `src/components/DeviceSelection.jsx` | Initial setup screen. | Props `onSelect`. |
| `src/App.jsx` | Router definition. | Use `JSX.Element`. |
| `src/main.jsx` | Entry point. | `root.render`. |

### Phase 6: Tests & Configuration
*Dev tools and quality assurance.*

| File Path | Description | Strategy |
| :--- | :--- | :--- |
| `vite.config.js` | Build config. | Rename to `.ts`, type with `UserConfig`. |
| `tailwind.config.js` | CSS framework config. | Rename to `.ts`, type with `Config`. |
| `playwright.config.js` | E2E test config. | Rename to `.ts`, use `PlaywrightTestConfig`. |
| `tests/design-audit.spec.js` | Playwright test. | Typed fixtures and selectors. |
| `tests/monochrome-audit.spec.js` | Playwright test. | Typed fixtures. |
| `tests/page-inspection.spec.js` | Playwright test. | Typed fixtures. |
| `tests/visual-regression.spec.js` | Playwright test. | Typed fixtures. |
| `src/components/DataLab/tests/*.spec.js` | Integration tests. | Type test data. |

## 3. General Guidelines

1.  **Strict Mode:** Aim for `strict: true`. Avoid `any` wherever possible.
2.  **Interfaces vs Types:** Prefer `interface` for React props and public API objects. Use `type` for unions and primitives.
3.  **Prop Drilling:** If prop drilling becomes painful during strict typing, consider moving shared state to Context or strictly typing the drilled props.
4.  **API Types:** Create a dedicated `src/types/` folder to store shared domain entities (`Device`, `SensorData`, `User`).

## 4. Shared Domain Types (Draft)

Create `src/types/models.ts`:

```typescript
export interface Device {
  id: string;
  name: string;
  room?: string;
  is_online: boolean;
  last_seen: string;
  config: DeviceConfig;
}

export interface Reading {
  timestamp: string;
  co2: number;
  temperature: number;
  humidity: number;
  deviceId: string;
}

export interface User {
  id: string;
  username: string;
  role: 'admin' | 'viewer';
}
```
