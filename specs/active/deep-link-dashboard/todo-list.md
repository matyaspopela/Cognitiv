# Implementation Todo List: deep-link-dashboard

## Overview
Implement deep link dashboard with box-based device selection, replacing dropdown selection with modern grid layout. Enable deep linking via URL query parameters and provide detailed device views with time window selection.

**Reference**: [Plan](plan.md) | [Feature Brief](feature-brief.md)

---

## Pre-Implementation Setup
- [x] Review feature brief requirements
- [x] Confirm technical plan
- [x] Validate existing patterns (BoardCard, charts.js, API structure)
- [ ] Set up development environment
- [ ] Review BoardCard component for adaptation patterns

---

## Phase 1: Core Infrastructure (Foundation)

### T1.1: Time Window Utilities
- [x] **T1.1**: Create `timeWindow.js` utility file
  - **Estimated Time**: 30 minutes
  - **Dependencies**: None
  - **Files to Create**: `frontend/src/utils/timeWindow.js`
  - **Acceptance Criteria**:
    - `getTimeWindowRange(window)` returns correct ISO strings for 24h, 7d, 30d
    - `getBucketSize(window)` returns correct bucket ('10min', 'hour', 'day')
    - `formatTimeLabel(timestamp, window)` formats timestamps correctly for each window
    - All functions handle edge cases (invalid input, timezone)
    - Functions are exported and documented

### T1.2: Dashboard Route Setup
- [x] **T1.2**: Add dashboard route to App.jsx
  - **Estimated Time**: 15 minutes
  - **Dependencies**: T1.3 (Dashboard component must exist)
  - **Files to Modify**: `frontend/src/App.jsx`
  - **Acceptance Criteria**:
    - `/dashboard` route exists and renders Dashboard component
    - Route works with query parameters (`?device=XXX&window=24h`)
    - Navigation to `/dashboard` works correctly
    - Route placed before catch-all route

### T1.3: Dashboard Page Shell
- [x] **T1.3**: Create Dashboard page component with query parameter handling
  - **Estimated Time**: 45 minutes
  - **Dependencies**: T1.1 (time window utilities)
  - **Files to Create**: `frontend/src/pages/Dashboard.jsx`, `frontend/src/pages/Dashboard.css`
  - **Acceptance Criteria**:
    - Component reads `device` and `window` query parameters correctly
    - URL updates when selecting device or changing time window
    - Conditional rendering works (box grid vs detail view)
    - State management for devices list
    - URL update handlers (`handleDeviceSelect`, `handleTimeWindowChange`)
    - Basic page layout structure

---

## Phase 2: Dashboard Box Grid

### T2.1: DashboardBox Component
- [x] **T2.1**: Create DashboardBox component
  - **Estimated Time**: 60 minutes
  - **Dependencies**: T1.1 (time utilities), T1.3 (Dashboard shell)
  - **Files to Create**: `frontend/src/components/dashboard/DashboardBox.jsx`
  - **Acceptance Criteria**:
    - Component displays board name correctly
    - Status badge shows online/offline correctly
    - Mini graph loads and displays last hour of CO2 data
    - Current CO2 value displays (if online)
    - Offline boards show no graph/CO2, only status badge
    - Click handler triggers navigation to detail view
    - Loading states work correctly
    - Uses `historyAPI.getSeries()` with 1-hour window
    - Uses `buildMiniCo2Chart()` and `miniChartOptions`

### T2.2: DashboardBox Styling
- [x] **T2.2**: Create DashboardBox CSS file
  - **Estimated Time**: 30 minutes
  - **Dependencies**: T2.1
  - **Files to Create**: `frontend/src/components/dashboard/DashboardBox.css`
  - **Acceptance Criteria**:
    - Boxes fit grid layout correctly
    - Graph container is 100px height (matching BoardCard)
    - Hover effects work smoothly
    - Responsive on mobile/tablet/desktop
    - Visual consistency with design system tokens
    - Status badge positioning correct
    - Removed admin-specific styles (no rename button, etc.)

### T2.3: Dashboard Box Grid Layout
- [x] **T2.3**: Implement box grid in Dashboard page
  - **Estimated Time**: 30 minutes
  - **Dependencies**: T2.1, T2.2
  - **Files to Modify**: `frontend/src/pages/Dashboard.jsx`, `frontend/src/pages/Dashboard.css`
  - **Acceptance Criteria**:
    - Devices load using `dataAPI.getDevices()`
    - Grid layout: `repeat(auto-fill, minmax(250px, 1fr))`
    - Boxes render correctly in grid
    - Clicking box navigates to detail view with correct URL
    - Empty state handled (no devices message)
    - Loading state displayed while fetching devices
    - Grid is responsive on all screen sizes

---

## Phase 3: Time Window Selector

### T3.1: TimeWindowSelector Component
- [x] **T3.1**: Create TimeWindowSelector component
  - **Estimated Time**: 30 minutes
  - **Dependencies**: None
  - **Files to Create**: `frontend/src/components/dashboard/TimeWindowSelector.jsx`, `frontend/src/components/dashboard/TimeWindowSelector.css`
  - **Acceptance Criteria**:
    - Three options display correctly (24h, 7d, 30d)
    - Active option is highlighted
    - `onChange` callback fires on selection
    - Styling matches design system (Button component or custom)
    - Accessible (keyboard navigation, ARIA labels)
    - Component is reusable and props-based

---

## Phase 4: Device Detail View

### T4.1: Numerical Values Section
- [x] **T4.1**: Create numerical values section in DeviceDetailView
  - **Estimated Time**: 45 minutes
  - **Dependencies**: T1.1, T3.1
  - **Files to Modify**: `frontend/src/components/dashboard/DeviceDetailView.jsx`
  - **Acceptance Criteria**:
    - All four values display correctly (CO2, Temperature, Humidity, Reading Count)
    - Data updates when time window changes
    - Loading state shown during fetch
    - Error state handled gracefully
    - Thin horizontal bar layout (Card component)
    - Uses `dataAPI.getStats()` with calculated time window
    - Values formatted correctly (ppm, °C, %, count)

### T4.2: CO2 Graph in Detail View
- [x] **T4.2**: Implement CO2 graph in DeviceDetailView
  - **Estimated Time**: 30 minutes
  - **Dependencies**: T1.1, T4.1
  - **Files to Modify**: `frontend/src/components/dashboard/DeviceDetailView.jsx`
  - **Acceptance Criteria**:
    - Graph displays CO2 data correctly
    - Data updates when time window changes
    - Correct bucket size used for each window (from `getBucketSize()`)
    - Loading/error states handled
    - Chart labels formatted correctly
    - Uses `buildCo2Chart()` and `co2ChartOptions`
    - Full-width chart container with proper height

### T4.3: Climate Graph (Temperature + Humidity)
- [x] **T4.3**: Implement climate graph in DeviceDetailView
  - **Estimated Time**: 30 minutes
  - **Dependencies**: T4.2 (can reuse same data source)
  - **Files to Modify**: `frontend/src/components/dashboard/DeviceDetailView.jsx`
  - **Acceptance Criteria**:
    - Combined graph displays correctly
    - Temperature on left axis, humidity on right axis
    - Data updates with time window
    - Chart labels formatted correctly
    - Uses `buildClimateChart()` and `climateChartOptions`
    - Dual-axis configuration working properly

### T4.4: CO2 Quality Pie Chart
- [x] **T4.4**: Implement quality pie chart in DeviceDetailView
  - **Estimated Time**: 30 minutes
  - **Dependencies**: T4.3
  - **Files to Modify**: `frontend/src/components/dashboard/DeviceDetailView.jsx`
  - **Acceptance Criteria**:
    - Pie chart displays quality distribution
    - All categories shown with correct colors (Good, Moderate, High, Critical)
    - Data updates with time window
    - Percentage labels display correctly
    - Handles empty data gracefully (shows message)
    - Uses `buildQualityPieChart()` utility
    - Uses `historyAPI.getSummary()` for data

### T4.5: DeviceDetailView Integration
- [x] **T4.5**: Complete DeviceDetailView component integration
  - **Estimated Time**: 45 minutes
  - **Dependencies**: T4.1-4.4, T3.1
  - **Files to Create**: `frontend/src/components/dashboard/DeviceDetailView.jsx` (complete)
  - **Acceptance Criteria**:
    - All sections render in correct order (Values → Selector → CO2 → Climate → Pie)
    - Time window selector updates all graphs simultaneously
    - Back navigation link works (returns to box grid)
    - Loading states coordinated across all sections
    - Error states handled (device not found, network errors)
    - Component props: `deviceId`, `timeWindow`, `onTimeWindowChange`
    - Header shows device name/ID

### T4.6: DeviceDetailView Styling
- [x] **T4.6**: Create DeviceDetailView CSS file
  - **Estimated Time**: 45 minutes
  - **Dependencies**: T4.5
  - **Files to Create**: `frontend/src/components/dashboard/DeviceDetailView.css`
  - **Acceptance Criteria**:
    - Layout is visually consistent
    - Graphs have appropriate heights (consistent container sizes)
    - Responsive on all screen sizes (mobile/tablet/desktop)
    - Spacing follows design tokens
    - Numerical values section styled as thin horizontal bar
    - Chart containers properly spaced
    - Header and back link styled correctly

---

## Phase 5: Time Formatting & Accuracy

### T5.1: Chart Label Time Formatting
- [x] **T5.1**: Implement time formatting for chart labels
  - **Estimated Time**: 45 minutes
  - **Dependencies**: T1.1, T4.2, T4.3
  - **Files to Modify**: `frontend/src/utils/timeWindow.js`, `frontend/src/components/dashboard/DeviceDetailView.jsx`
  - **Acceptance Criteria**:
    - 24h charts show hours/minutes (e.g., "14:30")
    - 7d charts show day and time (e.g., "Mon 14:30")
    - 30d charts show dates (e.g., "Jan 15")
    - Timezone matches backend (Europe/Prague default)
    - No timezone confusion or offset issues
    - Chart options updated to use custom time formatter
    - X-axis ticks formatted correctly based on window

---

## Phase 6: Integration & Testing

### T6.1: Dashboard Page Integration
- [x] **T6.1**: Complete Dashboard page integration
  - **Estimated Time**: 30 minutes
  - **Dependencies**: All previous tasks
  - **Files to Modify**: `frontend/src/pages/Dashboard.jsx`
  - **Acceptance Criteria**:
    - All components work together seamlessly
    - URL updates reflect state changes correctly
    - Navigation flows work (box grid ↔ detail view)
    - Error states handled gracefully throughout
    - Loading states coordinated properly
    - URL state persists on navigation (back/forward buttons work)

### T6.2: Dashboard Page Styling
- [x] **T6.2**: Complete Dashboard page CSS
  - **Estimated Time**: 30 minutes
  - **Dependencies**: T6.1
  - **Files to Modify**: `frontend/src/pages/Dashboard.css`
  - **Acceptance Criteria**:
    - Page layout is clean and organized
    - Responsive on all devices (mobile/tablet/desktop)
    - Matches design system tokens
    - Grid layout spacing correct
    - Page header/navigation consistent with rest of app

### T6.3: End-to-End Testing
- [ ] **T6.3**: Comprehensive testing of all features
  - **Estimated Time**: 90 minutes
  - **Dependencies**: All previous tasks
  - **Files**: All created/modified files
  - **Test Cases**:
    - [ ] Dashboard box grid displays correctly with all devices
    - [ ] Clicking box navigates to detail view with correct URL
    - [ ] Deep link URLs work when shared/bookmarked
    - [ ] Time window selector updates all graphs correctly
    - [ ] Time calculations accurate for all windows (24h, 7d, 30d)
    - [ ] Time formatting displays correctly in all chart labels
    - [ ] Mini graphs in boxes show last hour of data correctly
    - [ ] Offline boards display correctly (no graphs, status badge)
    - [ ] Error states handled gracefully (network errors, no data)
    - [ ] Responsive layout works on mobile/tablet/desktop
    - [ ] URL state persists on navigation (back/forward buttons)
    - [ ] Loading states appear correctly during data fetching
    - [ ] All charts render without console errors
    - [ ] Performance is acceptable (no noticeable lag)
  - **Acceptance Criteria**:
    - All test cases pass
    - No console errors or warnings
    - Cross-browser compatibility verified (Chrome, Firefox, Safari)
    - Performance metrics acceptable (initial load < 2s, navigation < 500ms)

---

## Post-Implementation

- [ ] Update progress.md with completion status
- [ ] Document any deviations from plan
- [ ] Note any learnings or improvements for future
- [ ] Code review checklist completed
- [ ] Ready for deployment/testing

---

**Total Estimated Time**: ~11 hours  
**Status**: In Progress  
**Last Updated**: 2024-12-19

