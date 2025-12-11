# Technical Implementation Plan: Deep Link Dashboard

**Plan Date**: 2024-12-19  
**Status**: Planned  
**Owner**: Development Team  
**Related Documents**: [Feature Brief](feature-brief.md)

---

## 📋 Plan Overview

**Feature**: Deep Link Dashboard with Box-Based Device Selection  
**Objective**: Replace dropdown device selection with modern box-based dashboard grid, enable deep linking via URL query parameters, and provide detailed device views with time window selection  
**Approach**: Component-based architecture reusing existing BoardCard patterns and chart utilities  
**Deployment**: Frontend-only changes, no backend modifications required

---

## 🎯 Implementation Objectives

1. ✅ Create box-based dashboard grid replacing dropdown selection
2. ✅ Implement deep link navigation via URL query parameters
3. ✅ Build device detail view with graphs and numerical values
4. ✅ Add time window selection (24h, 7d, 30d) with accurate time formatting
5. ✅ Ensure proper timezone handling and time display
6. ✅ Maintain responsive design across all screen sizes

---

## 🏗️ Architecture Overview

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                      Dashboard Page                           │
│  ┌─────────────────────────────────────────────────────┐     │
│  │  Query Parameter Handler                            │     │
│  │  - Reads ?device=XXX&window=24h                    │     │
│  │  - Updates URL on navigation                       │     │
│  └────────────┬────────────────────────────────────────┘     │
│               │                                               │
│               ▼                                               │
│  ┌─────────────────────┐  ┌──────────────────────────┐      │
│  │  Box Grid View      │  │  Device Detail View      │      │
│  │  (if no device)     │  │  (if device param)       │      │
│  │                     │  │                          │      │
│  │  ┌─────┐ ┌─────┐   │  │  ┌────────────────────┐  │      │
│  │  │Box  │ │Box  │   │  │  │ Numerical Values   │  │      │
│  │  └──┬──┘ └──┬──┘   │  │  └────────────────────┘  │      │
│  │     │       │      │  │  ┌────────────────────┐  │      │
│  │     └───┬───┘      │  │  │ Time Window Select │  │      │
│  │         │          │  │  └────────────────────┘  │      │
│  │         ▼          │  │  ┌────────────────────┐  │      │
│  │    DashboardBox[]  │  │  │ CO2 Graph          │  │      │
│  └─────────────────────┘  │  └────────────────────┘  │      │
│                           │  ┌────────────────────┐  │      │
│                           │  │ Climate Graph      │  │      │
│                           │  └────────────────────┘  │      │
│                           │  ┌────────────────────┐  │      │
│                           │  │ Quality Pie Chart  │  │      │
│                           │  └────────────────────┘  │      │
│                           └──────────────────────────┘      │
└─────────────────────────────────────────────────────────────┘
          │                           │
          │                           │
          ▼                           ▼
┌──────────────────┐        ┌──────────────────┐
│  DashboardBox    │        │  Chart Utilities │
│  Component       │        │  (charts.js)     │
│  - Mini graph    │        │  - buildCo2Chart │
│  - Status badge  │        │  - buildClimate  │
│  - CO2 value     │        │  - buildQuality  │
└──────────────────┘        └──────────────────┘
          │                           │
          ▼                           ▼
┌──────────────────────────────────────────┐
│          API Services (api.js)           │
│  - dataAPI.getDevices()                  │
│  - dataAPI.getStats()                    │
│  - historyAPI.getSeries()                │
│  - historyAPI.getSummary()               │
└──────────────────────────────────────────┘
```

### Design Patterns

**1. Container/Presentational Pattern**
- Dashboard page as container (state management, URL handling)
- DashboardBox and DeviceDetailView as presentational components
- Clear separation of concerns

**2. URL State Management**
- Query parameters as single source of truth
- React Router navigation for URL updates
- State derived from URL on mount/change

**3. Component Composition**
- Reuse existing chart utilities
- Adapt BoardCard patterns for public use
- Time window utilities as shared functions

---

## 📦 Component Breakdown

### Phase 1: Core Infrastructure (Foundation)

#### Task 1.1: Time Window Utilities
**File**: `frontend/src/utils/timeWindow.js` (NEW)  
**Complexity**: Low  
**Time**: 30 minutes  
**Dependencies**: None

**Implementation**:
```javascript
/**
 * Calculate time range for given window
 * @param {string} window - '24h', '7d', or '30d'
 * @returns {Object} {start: ISOString, end: ISOString}
 */
export const getTimeWindowRange = (window) => {
  const now = new Date()
  let hoursBack = 24
  if (window === '7d') hoursBack = 7 * 24
  if (window === '30d') hoursBack = 30 * 24
  
  const start = new Date(now.getTime() - (hoursBack * 60 * 60 * 1000))
  return {
    start: start.toISOString(),
    end: now.toISOString()
  }
}

/**
 * Get bucket size for API calls based on time window
 * @param {string} window - '24h', '7d', or '30d'
 * @returns {string} bucket size ('10min', 'hour', or 'day')
 */
export const getBucketSize = (window) => {
  if (window === '24h') return '10min'
  if (window === '7d') return 'hour'
  if (window === '30d') return 'day'
  return '10min'
}

/**
 * Format timestamp for chart labels based on time window
 * @param {string} timestamp - ISO string or date string
 * @param {string} window - '24h', '7d', or '30d'
 * @returns {string} Formatted time string
 */
export const formatTimeLabel = (timestamp, window) => {
  const date = new Date(timestamp)
  if (window === '24h') {
    return date.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })
  } else if (window === '7d') {
    return date.toLocaleDateString('cs-CZ', { weekday: 'short', hour: '2-digit', minute: '2-digit' })
  } else { // 30d
    return date.toLocaleDateString('cs-CZ', { month: 'short', day: 'numeric' })
  }
}
```

**Acceptance Criteria**:
- [ ] `getTimeWindowRange()` returns correct ISO strings for all windows
- [ ] `getBucketSize()` returns correct bucket for each window
- [ ] `formatTimeLabel()` formats timestamps correctly for each window
- [ ] All functions handle edge cases (invalid input, timezone)

---

#### Task 1.2: Dashboard Route Setup
**File**: `frontend/src/App.jsx` (MODIFY)  
**Complexity**: Low  
**Time**: 15 minutes  
**Dependencies**: Task 1.3 (Dashboard component)

**Implementation**:
- Add import: `import Dashboard from './pages/Dashboard'`
- Add route: `<Route path="/dashboard" element={<Dashboard />} />`
- Place route before catch-all route

**Acceptance Criteria**:
- [ ] `/dashboard` route exists and renders Dashboard component
- [ ] Route works with query parameters
- [ ] Navigation to `/dashboard` works correctly

---

#### Task 1.3: Dashboard Page Shell
**File**: `frontend/src/pages/Dashboard.jsx` (NEW)  
**Complexity**: Medium  
**Time**: 45 minutes  
**Dependencies**: Task 1.1

**Implementation**:
- Set up component with query parameter reading
- Basic state management
- Conditional rendering: box grid vs detail view
- URL update handlers

**Structure**:
```javascript
import { useLocation, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
// ... imports

const Dashboard = () => {
  const location = useLocation()
  const navigate = useNavigate()
  
  // Read query parameters
  const searchParams = new URLSearchParams(location.search)
  const deviceId = searchParams.get('device')
  const timeWindow = searchParams.get('window') || '24h'
  
  // State
  const [devices, setDevices] = useState([])
  const [loading, setLoading] = useState(true)
  
  // URL update handlers
  const handleDeviceSelect = (deviceId) => { /* ... */ }
  const handleTimeWindowChange = (window) => { /* ... */ }
  
  // Render
  return (
    <div className="dashboard-page">
      {deviceId ? (
        <DeviceDetailView deviceId={deviceId} timeWindow={timeWindow} />
      ) : (
        <DashboardBoxGrid devices={devices} onDeviceSelect={handleDeviceSelect} />
      )}
    </div>
  )
}
```

**Acceptance Criteria**:
- [ ] Component reads query parameters correctly
- [ ] URL updates when selecting device or changing window
- [ ] Conditional rendering works (box grid vs detail view)
- [ ] Navigation preserves state correctly

---

### Phase 2: Dashboard Box Grid

#### Task 2.1: DashboardBox Component
**File**: `frontend/src/components/dashboard/DashboardBox.jsx` (NEW)  
**Complexity**: Medium  
**Time**: 60 minutes  
**Dependencies**: Task 1.1

**Implementation**:
- Adapt BoardCard pattern (simplified, no admin features)
- Props: `device`, `onClick`
- Fetch last hour data for mini graph
- Display: board name, status badge, mini graph (if online), CO2 value (if online)

**Key Features**:
- Use `historyAPI.getSeries()` with 1-hour window
- Use `buildMiniCo2Chart()` and `miniChartOptions`
- Loading states for graph
- Offline detection (same logic as BoardCard)
- Click handler triggers navigation

**Acceptance Criteria**:
- [ ] Box displays board name correctly
- [ ] Status badge shows online/offline correctly
- [ ] Mini graph loads and displays last hour of CO2 data
- [ ] Current CO2 value displays (if online)
- [ ] Offline boards show no graph/CO2
- [ ] Click handler triggers navigation
- [ ] Loading states work correctly

---

#### Task 2.2: DashboardBox Styling
**File**: `frontend/src/components/dashboard/DashboardBox.css` (NEW)  
**Complexity**: Low  
**Time**: 30 minutes  
**Dependencies**: Task 2.1

**Implementation**:
- Copy and adapt from `BoardCard.css`
- Remove admin-specific styles
- Ensure grid-friendly sizing
- Responsive breakpoints

**Key Styles**:
- Card base styles
- Graph container (100px height)
- Status badge positioning
- Hover effects
- Responsive mobile styles

**Acceptance Criteria**:
- [ ] Boxes fit grid layout correctly
- [ ] Graph container is 100px height
- [ ] Hover effects work
- [ ] Responsive on mobile/tablet
- [ ] Visual consistency with design system

---

#### Task 2.3: Dashboard Box Grid Layout
**File**: `frontend/src/pages/Dashboard.jsx` (MODIFY), `Dashboard.css` (NEW)  
**Complexity**: Low  
**Time**: 30 minutes  
**Dependencies**: Task 2.1, Task 2.2

**Implementation**:
- Load devices using `dataAPI.getDevices()`
- Render grid of DashboardBox components
- Grid layout CSS: `grid-template-columns: repeat(auto-fill, minmax(250px, 1fr))`

**Structure**:
```javascript
const DashboardBoxGrid = ({ devices, onDeviceSelect }) => {
  return (
    <div className="dashboard-box-grid">
      {devices.map(device => (
        <DashboardBox
          key={device.device_id || device}
          device={device}
          onClick={onDeviceSelect}
        />
      ))}
    </div>
  )
}
```

**CSS**:
```css
.dashboard-box-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: var(--md3-spacing-4);
  padding: var(--md3-spacing-4);
}
```

**Acceptance Criteria**:
- [ ] Devices load and display in grid
- [ ] Grid layout is responsive
- [ ] Boxes are clickable and navigate correctly
- [ ] Empty state handled (no devices)
- [ ] Loading state displayed while fetching

---

### Phase 3: Time Window Selector

#### Task 3.1: TimeWindowSelector Component
**File**: `frontend/src/components/dashboard/TimeWindowSelector.jsx` (NEW)  
**Complexity**: Low  
**Time**: 30 minutes  
**Dependencies**: None

**Implementation**:
- Button group or select dropdown
- Options: 24h, 7d, 30d
- Active state styling
- onChange callback

**Structure**:
```javascript
const TimeWindowSelector = ({ value, onChange }) => {
  const options = [
    { value: '24h', label: '24 hodin' },
    { value: '7d', label: '7 dní' },
    { value: '30d', label: '30 dní' }
  ]
  
  return (
    <div className="time-window-selector">
      {options.map(opt => (
        <button
          key={opt.value}
          className={value === opt.value ? 'active' : ''}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
```

**Acceptance Criteria**:
- [ ] Three options display correctly
- [ ] Active option is highlighted
- [ ] onChange callback fires on selection
- [ ] Styling matches design system
- [ ] Accessible (keyboard navigation, ARIA labels)

---

### Phase 4: Device Detail View

#### Task 4.1: Numerical Values Section
**File**: `frontend/src/components/dashboard/DeviceDetailView.jsx` (NEW - partial)  
**Complexity**: Medium  
**Time**: 45 minutes  
**Dependencies**: Task 1.1, Task 3.1

**Implementation**:
- Fetch stats using `dataAPI.getStats()` with calculated time window
- Display: CO2 (ppm), Temperature (°C), Humidity (%), Reading Count
- Thin horizontal bar layout
- Card component wrapper

**Structure**:
```javascript
const NumericalValues = ({ deviceId, timeWindow }) => {
  const [values, setValues] = useState(null)
  const { start, end } = getTimeWindowRange(timeWindow)
  const hours = timeWindow === '24h' ? 24 : timeWindow === '7d' ? 168 : 720
  
  useEffect(() => {
    // Fetch stats
    dataAPI.getStats(hours, deviceId).then(/* ... */)
  }, [deviceId, timeWindow])
  
  return (
    <Card className="numerical-values">
      <div className="numerical-values__content">
        <div className="numerical-values__item">
          <span className="label">CO₂:</span>
          <span className="value">{values?.co2?.current || values?.co2?.avg || '--'} ppm</span>
        </div>
        {/* ... more items */}
      </div>
    </Card>
  )
}
```

**Acceptance Criteria**:
- [ ] All four values display correctly
- [ ] Data updates when time window changes
- [ ] Loading state shown during fetch
- [ ] Error state handled gracefully
- [ ] Layout is responsive

---

#### Task 4.2: CO2 Graph in Detail View
**File**: `frontend/src/components/dashboard/DeviceDetailView.jsx` (MODIFY)  
**Complexity**: Medium  
**Time**: 30 minutes  
**Dependencies**: Task 1.1, Task 4.1

**Implementation**:
- Fetch using `historyAPI.getSeries()` with calculated time range and bucket
- Use `buildCo2Chart()` and `co2ChartOptions`
- Full-width chart container
- Handle loading/error states

**Structure**:
```javascript
const Co2Graph = ({ deviceId, timeWindow }) => {
  const [chartData, setChartData] = useState(null)
  const { start, end } = getTimeWindowRange(timeWindow)
  const bucket = getBucketSize(timeWindow)
  
  useEffect(() => {
    historyAPI.getSeries(start, end, bucket, deviceId)
      .then(response => {
        if (response.data?.status === 'success') {
          const data = buildCo2Chart(response.data.series)
          setChartData(data)
        }
      })
  }, [deviceId, timeWindow])
  
  return (
    <Card className="co2-graph-container">
      <h3>CO₂ Koncentrace</h3>
      {chartData ? (
        <Line data={chartData} options={co2ChartOptions} />
      ) : (
        <LoadingState />
      )}
    </Card>
  )
}
```

**Acceptance Criteria**:
- [ ] Graph displays CO2 data correctly
- [ ] Data updates when time window changes
- [ ] Correct bucket size used for each window
- [ ] Loading/error states handled
- [ ] Chart labels formatted correctly

---

#### Task 4.3: Climate Graph (Temperature + Humidity)
**File**: `frontend/src/components/dashboard/DeviceDetailView.jsx` (MODIFY)  
**Complexity**: Medium  
**Time**: 30 minutes  
**Dependencies**: Task 4.2

**Implementation**:
- Use same data source as CO2 graph (fetch once, reuse)
- Use `buildClimateChart()` and `climateChartOptions`
- Dual-axis line chart
- Full-width container

**Acceptance Criteria**:
- [ ] Combined graph displays correctly
- [ ] Temperature on left axis, humidity on right axis
- [ ] Data updates with time window
- [ ] Chart labels formatted correctly

---

#### Task 4.4: CO2 Quality Pie Chart
**File**: `frontend/src/components/dashboard/DeviceDetailView.jsx` (MODIFY)  
**Complexity**: Medium  
**Time**: 30 minutes  
**Dependencies**: Task 4.3

**Implementation**:
- Fetch using `historyAPI.getSummary()` with calculated time range
- Use `buildQualityPieChart()` utility
- Doughnut chart format
- Categories: Good, Moderate, High, Critical

**Structure**:
```javascript
const QualityPieChart = ({ deviceId, timeWindow }) => {
  const [pieData, setPieData] = useState(null)
  const { start, end } = getTimeWindowRange(timeWindow)
  
  useEffect(() => {
    historyAPI.getSummary(start, end, deviceId)
      .then(response => {
        if (response.data?.status === 'success') {
          const data = buildQualityPieChart(response.data.summary?.co2_quality)
          setPieData(data)
        }
      })
  }, [deviceId, timeWindow])
  
  return (
    <Card className="quality-pie-container">
      <h3>Rozložení kvality vzduchu</h3>
      {pieData ? (
        <Doughnut data={pieData} options={/* ... */} />
      ) : (
        <LoadingState />
      )}
    </Card>
  )
}
```

**Acceptance Criteria**:
- [ ] Pie chart displays quality distribution
- [ ] All categories shown with correct colors
- [ ] Data updates with time window
- [ ] Percentage labels display correctly
- [ ] Handles empty data gracefully

---

#### Task 4.5: DeviceDetailView Integration
**File**: `frontend/src/components/dashboard/DeviceDetailView.jsx` (COMPLETE)  
**Complexity**: Medium  
**Time**: 45 minutes  
**Dependencies**: Tasks 4.1-4.4

**Implementation**:
- Combine all sections into complete component
- Add TimeWindowSelector at top
- Layout: Values → Selector → CO2 Graph → Climate Graph → Pie Chart
- Error boundaries and loading states
- Back button/link to return to grid

**Structure**:
```javascript
const DeviceDetailView = ({ deviceId, timeWindow, onTimeWindowChange }) => {
  return (
    <div className="device-detail-view">
      <div className="device-detail-view__header">
        <h2>{deviceId}</h2>
        <Link to="/dashboard">← Zpět na přehled</Link>
      </div>
      
      <TimeWindowSelector value={timeWindow} onChange={onTimeWindowChange} />
      
      <NumericalValues deviceId={deviceId} timeWindow={timeWindow} />
      <Co2Graph deviceId={deviceId} timeWindow={timeWindow} />
      <ClimateGraph deviceId={deviceId} timeWindow={timeWindow} />
      <QualityPieChart deviceId={deviceId} timeWindow={timeWindow} />
    </div>
  )
}
```

**Acceptance Criteria**:
- [ ] All sections render in correct order
- [ ] Time window selector updates all graphs
- [ ] Back navigation works
- [ ] Loading states coordinated
- [ ] Error states handled

---

#### Task 4.6: DeviceDetailView Styling
**File**: `frontend/src/components/dashboard/DeviceDetailView.css` (NEW)  
**Complexity**: Low  
**Time**: 45 minutes  
**Dependencies**: Task 4.5

**Implementation**:
- Layout styles for all sections
- Spacing and typography
- Graph container heights
- Responsive breakpoints

**Key Styles**:
- Header section
- Numerical values bar
- Graph containers (consistent heights)
- Pie chart container
- Mobile/tablet responsive

**Acceptance Criteria**:
- [ ] Layout is visually consistent
- [ ] Graphs have appropriate heights
- [ ] Responsive on all screen sizes
- [ ] Spacing follows design tokens

---

### Phase 5: Time Formatting & Accuracy

#### Task 5.1: Chart Label Time Formatting
**File**: `frontend/src/utils/timeWindow.js` (MODIFY)  
**Complexity**: Medium  
**Time**: 45 minutes  
**Dependencies**: Task 1.1

**Implementation**:
- Extend `formatTimeLabel()` function
- Update chart options to use custom formatter
- Ensure timezone consistency
- Test with different time windows

**Integration**:
- Update `co2ChartOptions` and `climateChartOptions` to use formatter
- Pass time window to chart options
- Format X-axis ticks based on window

**Acceptance Criteria**:
- [ ] 24h charts show hours/minutes
- [ ] 7d charts show day and time
- [ ] 30d charts show dates
- [ ] Timezone matches backend (Europe/Prague)
- [ ] No timezone confusion or offset issues

---

### Phase 6: Integration & Testing

#### Task 6.1: Dashboard Page Integration
**File**: `frontend/src/pages/Dashboard.jsx` (COMPLETE)  
**Complexity**: Medium  
**Time**: 30 minutes  
**Dependencies**: All previous tasks

**Implementation**:
- Complete component integration
- Error handling
- Loading states coordination
- URL state synchronization

**Acceptance Criteria**:
- [ ] All components work together
- [ ] URL updates reflect state changes
- [ ] Navigation flows correctly
- [ ] Error states handled gracefully

---

#### Task 6.2: Dashboard Page Styling
**File**: `frontend/src/pages/Dashboard.css` (COMPLETE)  
**Complexity**: Low  
**Time**: 30 minutes  
**Dependencies**: Task 6.1

**Implementation**:
- Page-level styles
- Container layouts
- Responsive breakpoints
- Consistent spacing

**Acceptance Criteria**:
- [ ] Page layout is clean and organized
- [ ] Responsive on all devices
- [ ] Matches design system

---

#### Task 6.3: End-to-End Testing
**Files**: Multiple  
**Complexity**: Medium  
**Time**: 90 minutes  
**Dependencies**: All previous tasks

**Test Cases**:
1. Box grid displays correctly with all devices
2. Clicking box navigates to detail view with correct URL
3. Deep link URLs work when shared/bookmarked
4. Time window selector updates all graphs
5. Time calculations accurate for all windows
6. Time formatting displays correctly
7. Mini graphs in boxes show last hour correctly
8. Offline boards display correctly
9. Error states handled gracefully
10. Responsive layout works on mobile/tablet/desktop
11. URL state persists on navigation
12. Loading states appear correctly

**Acceptance Criteria**:
- [ ] All test cases pass
- [ ] No console errors
- [ ] Performance is acceptable
- [ ] Cross-browser compatibility verified

---

## 📊 Task Dependencies

```
Task 1.1 (Time Utils)
    │
    ├─→ Task 1.3 (Dashboard Shell)
    │       │
    │       ├─→ Task 2.1 (DashboardBox)
    │       │       │
    │       │       └─→ Task 2.2 (DashboardBox CSS)
    │       │
    │       └─→ Task 2.3 (Box Grid)
    │
    ├─→ Task 4.1 (Numerical Values)
    │       │
    │       ├─→ Task 4.2 (CO2 Graph)
    │       │       │
    │       │       └─→ Task 4.3 (Climate Graph)
    │       │               │
    │       │               └─→ Task 4.4 (Pie Chart)
    │       │                       │
    │       │                       └─→ Task 4.5 (Detail View Integration)
    │       │                               │
    │       │                               └─→ Task 4.6 (Detail View CSS)
    │       │
    │       └─→ Task 5.1 (Time Formatting)
    │
    └─→ Task 3.1 (Time Window Selector)
            │
            └─→ Task 4.5 (Detail View Integration)

Task 1.2 (Route Setup)
    │
    └─→ Task 6.1 (Integration)
            │
            └─→ Task 6.2 (Dashboard CSS)
                    │
                    └─→ Task 6.3 (E2E Testing)
```

---

## ⏱️ Time Estimates

| Phase | Task | Time | Cumulative |
|-------|------|------|------------|
| **Phase 1: Infrastructure** |
| | 1.1 Time Window Utilities | 30min | 30min |
| | 1.2 Dashboard Route Setup | 15min | 45min |
| | 1.3 Dashboard Page Shell | 45min | 90min |
| **Phase 2: Box Grid** |
| | 2.1 DashboardBox Component | 60min | 150min |
| | 2.2 DashboardBox Styling | 30min | 180min |
| | 2.3 Box Grid Layout | 30min | 210min |
| **Phase 3: Time Selector** |
| | 3.1 TimeWindowSelector | 30min | 240min |
| **Phase 4: Detail View** |
| | 4.1 Numerical Values | 45min | 285min |
| | 4.2 CO2 Graph | 30min | 315min |
| | 4.3 Climate Graph | 30min | 345min |
| | 4.4 Pie Chart | 30min | 375min |
| | 4.5 Detail View Integration | 45min | 420min |
| | 4.6 Detail View CSS | 45min | 465min |
| **Phase 5: Time Formatting** |
| | 5.1 Chart Label Formatting | 45min | 510min |
| **Phase 6: Integration** |
| | 6.1 Dashboard Integration | 30min | 540min |
| | 6.2 Dashboard CSS | 30min | 570min |
| | 6.3 E2E Testing | 90min | 660min |
| **TOTAL** | | | **~11 hours** |

---

## 🔄 Implementation Phases

### Phase 1: Foundation (1.5 hours)
**Goal**: Set up core infrastructure  
**Tasks**: 1.1, 1.2, 1.3  
**Deliverable**: Working dashboard route with query parameter handling

### Phase 2: Box Grid (2 hours)
**Goal**: Create box-based device selection  
**Tasks**: 2.1, 2.2, 2.3  
**Deliverable**: Functional dashboard box grid with mini graphs

### Phase 3: Time Selector (0.5 hours)
**Goal**: Add time window selection  
**Tasks**: 3.1  
**Deliverable**: Working time window selector component

### Phase 4: Detail View (3.5 hours)
**Goal**: Build complete device detail view  
**Tasks**: 4.1-4.6  
**Deliverable**: Full-featured device detail page with all graphs

### Phase 5: Time Formatting (0.75 hours)
**Goal**: Ensure accurate time display  
**Tasks**: 5.1  
**Deliverable**: Properly formatted time labels in all charts

### Phase 6: Integration & Testing (2.5 hours)
**Goal**: Complete integration and verify everything works  
**Tasks**: 6.1, 6.2, 6.3  
**Deliverable**: Fully tested, production-ready feature

---

## 🧪 Testing Strategy

### Unit Tests
- Time window calculation utilities
- Time formatting functions
- Component props handling

### Integration Tests
- Query parameter reading/writing
- API data fetching and transformation
- Chart data building

### E2E Tests
- User flow: Box selection → Detail view
- Time window changes update graphs
- URL deep linking works
- Responsive layout

---

## 📝 Implementation Notes

### Key Technical Decisions

1. **Separate DashboardBox Component**: Creating new component instead of reusing BoardCard directly ensures cleaner separation and easier maintenance

2. **Query Parameters vs Path Parameters**: Using query parameters (`?device=XXX`) provides more flexibility for optional parameters like time window

3. **Time Window State in URL**: URL as single source of truth ensures shareable links and proper browser history

4. **Chart Utilities Reuse**: Leveraging existing chart utilities reduces code duplication and maintains consistency

5. **Bucket Size Selection**: Automatic bucket sizing based on time window optimizes API calls and chart rendering

### Potential Challenges

1. **Timezone Handling**: Ensure frontend time parsing matches backend timezone (Europe/Prague)
   - **Solution**: Use JavaScript Date API which handles ISO strings correctly, verify with backend

2. **Performance with Many Devices**: Loading mini graphs for all devices might be slow
   - **Solution**: Parallel API calls, loading states, consider lazy loading or pagination

3. **Large Datasets for 30-Day Window**: 30 days of data might be too much
   - **Solution**: Use 'day' bucket for 30d window, backend handles aggregation

4. **Chart Re-rendering**: Charts might re-render unnecessarily
   - **Solution**: Use React.memo for chart components, optimize data fetching with useEffect dependencies

### Performance Optimizations

- Lazy load detail view data (only fetch when device selected)
- Cache device list to avoid repeated API calls
- Debounce time window changes if needed
- Use React.memo for expensive chart components
- Optimize chart rendering for large datasets

---

## ✅ Success Criteria

1. ✅ Box grid displays all devices with correct information
2. ✅ Deep link URLs work and are shareable
3. ✅ Device detail view shows all required sections
4. ✅ Time window selection updates all data correctly
5. ✅ Time formatting is accurate and consistent
6. ✅ Responsive design works on all screen sizes
7. ✅ Error states handled gracefully
8. ✅ Performance is acceptable (no noticeable lag)

---

**Total Estimated Time**: ~11 hours  
**Start Date**: TBD  
**Target Completion**: TBD

