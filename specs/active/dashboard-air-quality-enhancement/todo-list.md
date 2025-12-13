# Implementation Todo List: dashboard-air-quality-enhancement

## Overview
Enhance regular dashboard (not admin panel) with prominent air quality distribution visualization, 1-hour default timeframe, and dynamic CO2 graph coloring with 2000 ppm threshold. All changes are frontend-only.

**Reference**: [Plan](plan.md) | [Feature Brief](feature-brief.md)

---

## Pre-Implementation Setup
- [x] Review feature brief requirements
- [x] Confirm technical plan
- [x] Validate Chart.js version supports segment coloring (4.4.0 ✓)
- [x] Review existing time window utilities
- [x] Review existing chart utilities

---

## Implementation Tasks

### T1: Extend Time Window Utilities for 1h Support
- [x] **T1**: Update `timeWindow.js` utilities to support 1h timeframe
  - **Estimated Time**: 15 minutes
  - **Dependencies**: None
  - **Files to Modify**: `frontend/src/utils/timeWindow.js`
  - **Acceptance Criteria**:
    - `getTimeWindowRange('1h')` returns correct 1-hour range
    - `getBucketSize('1h')` returns 'raw' for granularity
    - `formatTimeLabel()` formats 1h timestamps correctly (HH:mm format)
    - `getHoursForStats('1h')` returns 1
    - Backward compatibility maintained for existing windows (24h, 7d, 30d)
    - All functions handle '1h' case properly

### T2: Add 1h Option to TimeWindowSelector
- [x] **T2**: Add "1 hodina" option to time window selector
  - **Estimated Time**: 10 minutes
  - **Dependencies**: T1
  - **Files to Modify**: `frontend/src/components/dashboard/TimeWindowSelector.jsx`
  - **Acceptance Criteria**:
    - "1 hodina" option appears first in selector
    - Option is clickable and updates timeWindow state
    - Visual styling matches existing options
    - Active state highlighting works correctly
    - Component renders without errors

### T3: Set 1h Default on First Load
- [x] **T3**: Modify Dashboard.jsx to default to '1h' on first load
  - **Estimated Time**: 15 minutes
  - **Dependencies**: T1, T2
  - **Files to Modify**: `frontend/src/pages/Dashboard.jsx`
  - **Acceptance Criteria**:
    - Dashboard defaults to '1h' when no window param in URL (first load)
    - User-selected timeframe persists in URL query params
    - Direct links with window param work correctly
    - Backward compatibility maintained (existing bookmarks work)
    - TimeWindowSelector reflects correct default value

### T4: Implement Dynamic Segment Coloring for CO2 Graph
- [x] **T4**: Add dynamic segment coloring to buildCo2Chart() function
  - **Estimated Time**: 45 minutes
  - **Dependencies**: None
  - **Files to Modify**: `frontend/src/utils/charts.js`
  - **Acceptance Criteria**:
    - Line segments below 2000 ppm display in green (rgba(76, 175, 80, 0.85))
    - Line segments at or above 2000 ppm display in red (rgba(244, 67, 54, 0.85))
    - Transitions between colors are smooth
    - Null/undefined values handled gracefully (gray or transparent)
    - Existing multi-device coloring still works
    - Chart performance remains acceptable
    - Works with Chart.js 4.4.0 segment property

### T5: Reorder DeviceDetailView Components
- [x] **T5**: Move QualityPieChart to first position in DeviceDetailView
  - **Estimated Time**: 5 minutes
  - **Dependencies**: None
  - **Files to Modify**: `frontend/src/components/dashboard/DeviceDetailView.jsx`
  - **Acceptance Criteria**:
    - QualityPieChart appears as first element after header
    - All other components render in correct order
    - No visual regressions
    - Component functionality unchanged
    - Props passed correctly to all components

### T6: Enhance Dashboard Padding and Spacing
- [x] **T6**: Improve visual spacing in dashboard components
  - **Estimated Time**: 20 minutes
  - **Dependencies**: None
  - **Files to Modify**: 
    - `frontend/src/pages/Dashboard.css`
    - `frontend/src/components/dashboard/DeviceDetailView.css`
  - **Acceptance Criteria**:
    - Dashboard page has increased padding (spacing-6 instead of spacing-4)
    - DeviceDetailView has container padding
    - Chart containers have increased spacing between them
    - Header margins increased for better visual hierarchy
    - Responsive design maintained (mobile uses appropriate spacing)
    - No layout breaking on any screen size
    - Consistent spacing throughout dashboard

---

## Post-Implementation
- [ ] Test all changes in regular dashboard (not admin panel)
- [ ] Verify 1h default works on first load
- [ ] Verify quality chart appears first
- [ ] Verify CO2 graph shows dynamic colors correctly
- [ ] Test responsive design on mobile/tablet/desktop
- [ ] Verify no regressions in admin panel
- [ ] Update progress.md with completion status

---

## Testing Checklist

### Functional Tests
- [ ] Dashboard loads with 1h default on first visit
- [ ] Time window selector shows all options including 1h
- [ ] Selecting different timeframes updates all components
- [ ] Quality distribution chart appears first in device detail view
- [ ] CO2 graph displays green for values < 2000 ppm
- [ ] CO2 graph displays red for values ≥ 2000 ppm
- [ ] CO2 graph handles data crossing threshold correctly
- [ ] All components update when timeframe changes

### Visual Tests
- [ ] Dashboard has improved spacing and padding
- [ ] Components don't feel cramped
- [ ] Quality chart is prominently displayed
- [ ] Color transitions in CO2 graph are smooth
- [ ] Layout is responsive on mobile devices
- [ ] No horizontal scrolling on any screen size

### Edge Cases
- [ ] Handles empty data gracefully
- [ ] Handles null/undefined CO2 values
- [ ] Handles all values above threshold (all red)
- [ ] Handles all values below threshold (all green)
- [ ] Handles rapid timeframe changes
- [ ] Backward compatibility with existing URLs

---

**Total Estimated Time**: ~2.5 hours  
**Status**: In Progress  
**Last Updated**: 2024-12-19

