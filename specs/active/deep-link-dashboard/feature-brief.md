# deep-link-dashboard Feature Brief

## 🎯 Context (2min)
**Problem**: Current dashboard uses dropdown-based device selection which is clunky and not intuitive. Users want a modern box-based dashboard where they can see all boards at a glance with quick visual indicators (status, mini graphs, current CO2). They also need deep link support via URL query parameters to share or bookmark specific board views, with proper time window selection and accurate time formatting.

**Users**: 
- End users accessing the dashboard to view board data
- Users sharing specific board dashboard links with colleagues
- Facility managers bookmarking favorite board views
- Users who need to quickly see board status and jump to detailed views

**Success**: 
1. Dashboard displays all boards in a grid of clickable boxes showing: board name, online/offline status, mini CO2 graph (last hour), and current CO2 concentration (only for online boards)
2. Clicking a box navigates to a deep link URL with query parameters (e.g., `?device=BOARD_XXXX`)
3. Deep link page shows detailed board view with: numerical values section, CO2 graph, temperature+humidity combined graph, and CO2 quality pie chart
4. Time window selection (24 hours, 7 days, 30 days) works correctly with accurate time formatting
5. All time data is extracted and formatted correctly using proper timezone handling

## 🔍 Quick Research (15min)
### Existing Patterns
- **BoardCard Component** (`frontend/src/components/admin/BoardCard.jsx` lines 40-297) → Perfect box-based UI pattern with board name, status badge, mini CO2 graph (100px height), current CO2 display, offline handling, click handlers | **Reuse**: Component structure, styling patterns, mini graph implementation, status detection logic
- **BoardCard CSS** (`frontend/src/components/admin/BoardCard.css`) → Card styling with hover effects, grid-friendly sizing, responsive design, graph container (100px height), loading states | **Reuse**: CSS classes, responsive breakpoints, card layout patterns
- **Chart Utilities** (`frontend/src/utils/charts.js`) → `buildCo2Chart()`, `buildClimateChart()`, `buildQualityPieChart()`, `buildMiniCo2Chart()`, chart options (`miniChartOptions`, `co2ChartOptions`, `climateChartOptions`) | **Reuse**: All chart building functions, mini chart options for boxes, full chart options for detail page
- **Device Selection** (`frontend/src/components/DeviceSelection.jsx` lines 6-163) → Current dropdown-based selection, device stats fetching, online/offline detection | **Replace**: With box-based grid approach
- **React Router Setup** (`frontend/src/App.jsx` lines 16-40) → BrowserRouter with nested Routes, route structure | **Extend**: Add dashboard route handling query parameters
- **URL Query Parameters** (`frontend/src/services/api.js` lines 50-122) → `URLSearchParams` used for API query parameters | **Reuse**: Pattern for reading URL query params in components
- **useLocation Hook** (`frontend/src/components/layout/Navigation.jsx` line 7) → React Router's `useLocation()` for reading current pathname | **Reuse**: Pattern for reading query parameters using `useLocation().search` and `URLSearchParams`
- **History API** (`frontend/src/services/api.js` lines 78-122) → `historyAPI.getSeries()` accepts `start`, `end`, `bucket`, `deviceId` parameters, returns time-series data with `bucket_start` timestamps | **Reuse**: API endpoints for fetching time-windowed data
- **Stats API** (`frontend/src/services/api.js` lines 59-66) → `dataAPI.getStats()` accepts `hours`, `deviceId` parameters | **Reuse**: For numerical values display
- **Summary API** (`frontend/src/services/api.js` lines 97-112) → `historyAPI.getSummary()` returns CO2 quality distribution for pie chart | **Reuse**: For quality pie chart
- **Time Formatting** (`server/api/views.py` lines 312-374, 581-584) → Backend uses `strftime('%Y-%m-%d %H:%M:%S')` with local timezone conversion, `to_local_datetime()` function converts UTC to `LOCAL_TZ` (default: 'Europe/Prague') | **Reuse**: Understand backend timezone handling, ensure frontend time extraction matches
- **Time Window Calculation** (`frontend/src/components/admin/BoardCard.jsx` lines 65-69) → Frontend calculates time windows using `new Date()` and ISO string formatting: `oneHourAgo = new Date(now.getTime() - (60 * 60 * 1000))`, `startIso = oneHourAgo.toISOString()` | **Reuse**: Pattern for calculating 24h, 7d, 30d windows

### Tech Decision
**Approach**: React Router query parameters + BoardCard component reuse + existing chart utilities + time window utilities
- **Why**: 
  - React Router already integrated, query parameters are standard web pattern for deep linking
  - BoardCard component provides perfect box UI pattern - can be adapted for public dashboard use
  - Chart utilities already exist and handle all required graph types
  - Time formatting handled by backend, frontend needs proper ISO string conversion
  - No backend changes needed - all APIs support device filtering and time windows
- **Avoid**: 
  - Creating new card component from scratch (adapt BoardCard)
  - Using path parameters instead of query parameters (less flexible for optional params)
  - Duplicating chart code (reuse existing utilities)
  - Custom time formatting (use standard Date APIs matching backend expectations)

## ✅ Requirements (10min)

### Core Features

**R1: Dashboard Box Grid**
- Replace dropdown device selection with grid of clickable boxes
- Each box displays: board name, online/offline status badge, mini CO2 graph (last hour, 100px height), current CO2 concentration (only shown if online)
- Grid layout responsive: `repeat(auto-fill, minmax(250px, 1fr))` with gap spacing
- Boxes are clickable and navigate to deep link URL with device query parameter
- Offline boards show status badge but no graph or CO2 value
- **Acceptance**: Dashboard shows grid of board boxes, each displays correct information, clicking navigates to detail view

**R2: Deep Link URL Query Parameters**
- URL format: `?device=BOARD_XXXX` (e.g., `?device=ESP8266A2`)
- Dashboard page reads `device` query parameter using `useLocation()` and `URLSearchParams`
- Automatically loads and displays device-specific data when `device` parameter present
- URL updates when user clicks a box (no page reload, React Router navigation)
- **Acceptance**: Clicking a box updates URL to `?device=BOARD_XXXX`, page shows device detail view, URL can be shared/bookmarked

**R3: Device Detail View Layout**
- When `device` query parameter is present, show device detail view
- Layout structure (top to bottom):
  1. **Numerical Values Section** (thin horizontal bar): CO2 (ppm), Temperature (°C), Humidity (%), Total Readings Count
  2. **CO2 Graph**: Full-width line chart showing CO2 over selected time window
  3. **Temperature + Humidity Graph**: Combined dual-axis line chart (temperature left axis, humidity right axis)
  4. **CO2 Quality Pie Chart**: Doughnut chart showing distribution of air quality categories (< 1000, 1000-1500, 1500-2000, > 2000 ppm)
- All graphs use existing chart utilities from `charts.js`
- **Acceptance**: Detail view shows all sections in correct order with proper data visualization

**R4: Time Window Selection**
- Time window selector component with options: 24 hours, 7 days, 30 days
- Default: 24 hours
- Time window parameter in URL: `?device=BOARD_XXXX&window=24h` (or `7d`, `30d`)
- Changing time window updates URL and refreshes all graphs and data
- Time windows calculated correctly:
  - 24 hours: `new Date(now - 24 * 60 * 60 * 1000)` to `now`
  - 7 days: `new Date(now - 7 * 24 * 60 * 60 * 1000)` to `now`
  - 30 days: `new Date(now - 30 * 24 * 60 * 60 * 1000)` to `now`
- Use ISO string format for API calls: `.toISOString()`
- **Acceptance**: Time window selector works, updates graphs correctly, URL reflects selected window, all time calculations accurate

**R5: Accurate Time Formatting and Extraction**
- All timestamps from API responses are properly parsed
- Backend returns timestamps in format `'YYYY-MM-DD HH:MM:SS'` (local timezone, Europe/Prague default)
- Frontend receives `bucket_start` timestamps from `historyAPI.getSeries()` 
- Chart labels formatted using JavaScript `Date` parsing and `toLocaleString()` or custom formatting
- X-axis time labels show appropriate granularity (hours for 24h, days for 7d/30d)
- Ensure timezone consistency - backend uses `LOCAL_TZ`, frontend should handle dates correctly
- **Acceptance**: All time values display correctly, charts show accurate time labels, no timezone confusion

**R6: Mini Graph for Dashboard Boxes**
- Mini CO2 graph shows last hour of data (1 hour time window)
- Graph height: 100px (same as BoardCard)
- Uses `buildMiniCo2Chart()` and `miniChartOptions` from `charts.js`
- Graph only shown if device is online and data is available
- Loading state shown while fetching graph data
- **Acceptance**: Mini graphs display correctly in boxes, show last hour of CO2 data, handle loading/error states

## 🏗️ Implementation (5min)

### Components

**Frontend (React)**:

- `frontend/src/pages/Dashboard.jsx` (NEW or MODIFY) - Main dashboard page:
  - Read `device` and `window` query parameters using `useLocation()` and `URLSearchParams`
  - State: `selectedDevice`, `timeWindow` (default: '24h')
  - If `device` param present: show device detail view, else show box grid
  - Box grid section: Load devices using `dataAPI.getDevices()`, render grid of `DashboardBox` components
  - Device detail section: Render numerical values, CO2 graph, climate graph, quality pie chart
  - Time window selector component for detail view
  - URL update logic: `navigate()` to update query params when selecting device or changing time window

- `frontend/src/components/dashboard/DashboardBox.jsx` (NEW) - Public dashboard box component:
  - **Reuse**: Adapt `BoardCard` component pattern
  - Props: `device` (device object with `device_id`, `display_name`, `status`, etc.), `onClick`
  - Display: Board name, status badge (online/offline), mini CO2 graph (if online), current CO2 (if online)
  - Fetch last hour data for mini graph using `historyAPI.getSeries()` with 1-hour window
  - Use `buildMiniCo2Chart()` and `miniChartOptions` for graph
  - Click handler: `onClick(device.device_id)` to navigate to detail view
  - CSS: Reuse `BoardCard.css` patterns, adapt for public use (remove admin-specific styling)

- `frontend/src/components/dashboard/DeviceDetailView.jsx` (NEW) - Device detail page component:
  - Props: `deviceId`, `timeWindow` ('24h', '7d', '30d')
  - Numerical values section: Fetch stats using `dataAPI.getStats()` with calculated time window, display CO2, temp, humidity, reading count
  - CO2 graph: Fetch using `historyAPI.getSeries()` with appropriate bucket size ('10min' for 24h, 'hour' for 7d, 'day' for 30d), use `buildCo2Chart()` and `co2ChartOptions`
  - Climate graph: Same data source, use `buildClimateChart()` and `climateChartOptions`
  - Quality pie chart: Fetch using `historyAPI.getSummary()`, use `buildQualityPieChart()`
  - Handle loading and error states

- `frontend/src/components/dashboard/TimeWindowSelector.jsx` (NEW) - Time window selector:
  - Props: `value` ('24h', '7d', '30d'), `onChange(value)`
  - UI: Button group or select dropdown with three options
  - On change: Call `onChange()` with new value, parent updates URL and refreshes data

- `frontend/src/components/dashboard/DashboardBox.css` (NEW) - Dashboard box styles:
  - **Reuse**: Copy from `BoardCard.css`, adapt for public dashboard use
  - Grid-friendly sizing, hover effects, responsive breakpoints

- `frontend/src/components/dashboard/DeviceDetailView.css` (NEW) - Detail view styles:
  - Layout styles for numerical values section, graph containers, pie chart container
  - Responsive layout for mobile/tablet

- `frontend/src/pages/Dashboard.css` (NEW or MODIFY) - Dashboard page styles:
  - Grid layout for box grid: `display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: var(--md3-spacing-4);`
  - Responsive breakpoints

- `frontend/src/App.jsx` (MODIFY) - Add dashboard route:
  ```jsx
  <Route path="/dashboard" element={<Dashboard />} />
  ```
  - Or modify existing route if dashboard already exists

### APIs

**Existing Endpoints Used**:
- `GET /api/devices` - Public device list (returns array of device objects/IDs)
- `GET /api/data?device_id={deviceId}&hours={hours}` - Filtered data (for numerical values)
- `GET /api/stats?device_id={deviceId}&hours={hours}` - Filtered stats (for numerical values)
- `GET /api/history/series?device_id={deviceId}&start={isoStart}&end={isoEnd}&bucket={bucket}` - Time-series data for graphs
- `GET /api/history/summary?device_id={deviceId}&start={isoStart}&end={isoEnd}` - Summary data for pie chart

**No New Endpoints Required**:
- All device filtering and time window support already exists via query parameters

### Data Changes
- No database schema changes
- No API response structure changes
- Device IDs from API used directly in URL query parameters
- Time windows calculated client-side, passed as ISO strings to API

### Routing Structure
```
/dashboard              → Dashboard (box grid view)
/dashboard?device=BOARD_XXXX        → Dashboard (device detail view, default 24h)
/dashboard?device=BOARD_XXXX&window=24h  → Dashboard (device detail, 24h window)
/dashboard?device=BOARD_XXXX&window=7d   → Dashboard (device detail, 7 days window)
/dashboard?device=BOARD_XXXX&window=30d  → Dashboard (device detail, 30 days window)
```

### Time Window Calculations
```javascript
// Helper function for time window calculations
const getTimeWindowRange = (window) => {
  const now = new Date()
  let hoursBack = 24 // default 24h
  if (window === '7d') hoursBack = 7 * 24
  if (window === '30d') hoursBack = 30 * 24
  
  const start = new Date(now.getTime() - (hoursBack * 60 * 60 * 1000))
  return {
    start: start.toISOString(),
    end: now.toISOString()
  }
}

// Bucket size selection based on window
const getBucketSize = (window) => {
  if (window === '24h') return '10min'
  if (window === '7d') return 'hour'
  if (window === '30d') return 'day'
  return '10min' // default
}
```

### Time Formatting Strategy
- Backend returns timestamps in `'YYYY-MM-DD HH:MM:SS'` format (local timezone)
- API `bucket_start` fields from `historyAPI.getSeries()` are ISO strings or formatted strings
- Frontend parsing: Use `new Date(timestampString)` - JavaScript handles ISO strings automatically
- Chart labels: Format using `toLocaleString()` or custom formatter based on window:
  - 24h: Show hours/minutes (e.g., "14:30")
  - 7d: Show day and time (e.g., "Mon 14:30")
  - 30d: Show date (e.g., "Jan 15")

## 📋 Next Actions (2min)
- [ ] Create `Dashboard.jsx` page component with query parameter reading logic (45min)
- [ ] Create `DashboardBox.jsx` component adapting BoardCard pattern (60min)
- [ ] Create `DeviceDetailView.jsx` component with all graphs and numerical values (90min)
- [ ] Create `TimeWindowSelector.jsx` component (30min)
- [ ] Create CSS files for dashboard components (60min)
- [ ] Add dashboard route to `App.jsx` (15min)
- [ ] Implement time window calculation utilities (30min)
- [ ] Implement time formatting utilities for chart labels (45min)
- [ ] Integrate chart utilities from `charts.js` in detail view (30min)
- [ ] Test box grid display and navigation (30min)
- [ ] Test deep link URLs work correctly (30min)
- [ ] Test time window selection updates graphs (30min)
- [ ] Test time formatting accuracy across all windows (30min)
- [ ] Test offline boards display correctly (20min)
- [ ] Test responsive layout on mobile/tablet/desktop (30min)
- [ ] Verify mini graphs load correctly in boxes (30min)

**Start Coding In**: ~8-10 hours total implementation time

---
**Total Planning Time**: ~30min | **Owner**: Development Team | **Date**: 2024-12-19

<!-- Living Document - Update as you code -->

## 🔄 Implementation Tracking

**CRITICAL**: Follow the todo-list systematically. Mark items as complete, document blockers, update progress.

### Progress
- [ ] Track completed items here
- [ ] Update daily

### Blockers
- [ ] Document any blockers

**See**: [.sdd/IMPLEMENTATION_GUIDE.md](mdc:.sdd/IMPLEMENTATION_GUIDE.md) for detailed execution rules.

## 📝 Implementation Notes

### Query Parameter Handling Pattern
```javascript
import { useLocation, useNavigate } from 'react-router-dom'

const Dashboard = () => {
  const location = useLocation()
  const navigate = useNavigate()
  
  // Read query parameters
  const searchParams = new URLSearchParams(location.search)
  const deviceId = searchParams.get('device')
  const timeWindow = searchParams.get('window') || '24h'
  
  // Update URL without page reload
  const handleDeviceSelect = (deviceId) => {
    const params = new URLSearchParams()
    params.set('device', deviceId)
    params.set('window', timeWindow) // preserve existing window
    navigate(`/dashboard?${params.toString()}`)
  }
  
  const handleTimeWindowChange = (newWindow) => {
    const params = new URLSearchParams(location.search)
    params.set('window', newWindow)
    if (deviceId) params.set('device', deviceId) // preserve device
    navigate(`/dashboard?${params.toString()}`)
  }
}
```

### BoardCard Adaptation Strategy
**Option 1**: Create simplified `DashboardBox` component
- Remove admin-specific features (rename button, voltage badge)
- Simplify props (no `onRenameClick`, no `selected` prop)
- Keep core: board name, status, mini graph, CO2 value
- Reuse CSS patterns but create separate file

**Option 2**: Make `BoardCard` configurable with `public` prop
- Add `public` prop to hide admin features
- Conditional rendering based on `public` prop
- Single component for both admin and public use

**Recommendation**: Option 1 (separate component) for cleaner separation of concerns and easier maintenance.

### Time Window to Bucket Size Mapping
- **24 hours**: Use `'10min'` bucket (gives ~144 data points, good detail)
- **7 days**: Use `'hour'` bucket (gives 168 data points, one per hour)
- **30 days**: Use `'day'` bucket (gives 30 data points, one per day)

**Fallback Strategy**: Try preferred bucket, if fails (too many points), fall back to next larger bucket. See `BoardCard.jsx` lines 72-122 for existing fallback pattern.

### Numerical Values Section Design
Thin horizontal bar above graphs showing:
```
CO₂: 850 ppm    |    Temperature: 22.5°C    |    Humidity: 45%    |    Readings: 1,234
```
- Use Card component with horizontal flex layout
- Compact spacing, readable font sizes
- Fetch from `dataAPI.getStats()` - returns `current` or `avg` values
- For reading count, may need to use `historyAPI.getSummary()` or separate endpoint

### CO2 Quality Categories (for Pie Chart)
- **Good**: < 1000 ppm (green)
- **Moderate**: 1000-1500 ppm (yellow)
- **High**: 1500-2000 ppm (orange)
- **Critical**: > 2000 ppm (red)

These thresholds match existing patterns in `views.py` (lines 38-40) and `charts.js` (lines 112-157).

### Graph Data Fetching Strategy
1. Calculate time window range (start/end ISO strings)
2. Determine bucket size based on window
3. Fetch data: `historyAPI.getSeries(start, end, bucket, deviceId)`
4. Handle errors gracefully (try fallback bucket if needed)
5. Transform data using chart utility functions
6. Render charts with appropriate options

### URL State Persistence
- When user selects device, preserve time window if already set
- When user changes time window, preserve device selection
- When user navigates away and back, URL state restores view
- Consider adding browser history support (back/forward buttons work correctly)

### Error Handling
- Invalid device ID in URL → Show error message or redirect to box grid
- Device not found → Show "Device not found" message with link back
- Network error loading data → Show error state with retry option
- No data for time window → Show "No data available" message
- Offline devices → Display gracefully without graphs

### Performance Considerations
- Box grid should load device stats efficiently (parallel API calls)
- Consider caching device list to avoid repeated API calls
- Lazy load detail view graphs (only fetch when device selected)
- Optimize chart rendering for large datasets (sampling if needed)
- Mini graphs in boxes should have loading states to prevent UI blocking

### Testing Checklist
- [ ] Dashboard box grid displays correctly
- [ ] All boxes show correct board name, status, mini graph, CO2
- [ ] Clicking box navigates to detail view with correct URL
- [ ] Deep link URLs work when shared/bookmarked
- [ ] Device detail view shows all sections (values, graphs, pie chart)
- [ ] Time window selector works and updates graphs
- [ ] Time calculations are accurate for all windows
- [ ] Time formatting displays correctly in chart labels
- [ ] Mini graphs show last hour of data correctly
- [ ] Offline boards display correctly (no graphs, status badge)
- [ ] Responsive layout works on mobile/tablet/desktop
- [ ] URL state persists when navigating
- [ ] Error states handled gracefully
- [ ] Loading states shown during data fetching

