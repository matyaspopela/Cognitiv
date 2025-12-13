# Technical Implementation Plan: Dashboard Air Quality Enhancement

**Plan Date**: 2024-12-19  
**Status**: Planned  
**Owner**: Development Team  
**Related Documents**: [Feature Brief](feature-brief.md)

---

## 📋 Plan Overview

**Feature**: Dashboard Air Quality Enhancement  
**Objective**: Enhance regular dashboard (not admin panel) with prominent air quality distribution visualization, 1-hour default timeframe, and dynamic CO2 graph coloring with 2000 ppm threshold  
**Approach**: Frontend-only modifications to existing components, leveraging Chart.js segment coloring and extending time window utilities  
**Deployment**: Frontend-only changes, no backend modifications required

---

## 🎯 Implementation Objectives

1. ✅ Reorder DeviceDetailView to show air quality distribution as first element
2. ✅ Add "1h" option to TimeWindowSelector component
3. ✅ Set 1-hour as default timeframe on first dashboard load only
4. ✅ Implement dynamic segment coloring for CO2 graph (green < 2000 ppm, red ≥ 2000 ppm)
5. ✅ Enhance dashboard padding and spacing for better visual appeal
6. ✅ Ensure all changes apply only to regular dashboard, not admin panel

---

## 🏗️ Architecture Overview

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Dashboard Page                             │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐     │
│  │  DeviceDetailView Component (REORDERED)            │     │
│  │                                                      │     │
│  │  1. QualityPieChart (FIRST - Prominent Display)     │     │
│  │  2. TimeWindowSelector (with 1h option)            │     │
│  │  3. NumericalValues                                 │     │
│  │  4. Co2Graph (with dynamic segment coloring)        │     │
│  │  5. ClimateGraph                                    │     │
│  └─────────────────────────────────────────────────────┘     │
│          │                                                     │
│          ▼                                                     │
│  ┌─────────────────────────────────────────────────────┐     │
│  │  Chart Utilities (charts.js)                         │     │
│  │  - buildCo2Chart() [MODIFIED: segment coloring]      │     │
│  │  - buildQualityPieChart() [REUSED]                  │     │
│  └─────────────────────────────────────────────────────┘     │
│          │                                                     │
│          ▼                                                     │
│  ┌─────────────────────────────────────────────────────┐     │
│  │  Time Window Utilities (timeWindow.js)               │     │
│  │  - getTimeWindowRange() [EXTENDED: 1h support]       │     │
│  │  - getBucketSize() [EXTENDED: 1h support]           │     │
│  │  - formatTimeLabel() [EXTENDED: 1h support]         │     │
│  │  - getHoursForStats() [EXTENDED: 1h support]        │     │
│  └─────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

### Design Patterns

**1. Component Reordering Pattern**
- Move QualityPieChart to top of DeviceDetailView render order
- Maintain existing component structure, only change display order
- No prop changes needed, components already receive correct props

**2. Chart.js Segment Coloring Pattern**
- Use Chart.js 4.4.0 segment property for dynamic line coloring
- Apply color function based on data point value threshold
- Maintain existing chart structure, add segment configuration

**3. First Load Detection Pattern**
- Check URL query parameter for `window` value
- If absent, default to "1h" (first load)
- Once user selects timeframe, preserve in URL query params
- No persistence needed (only first load default)

**4. Progressive Enhancement Pattern**
- Add 1h option without breaking existing 24h/7d/30d functionality
- Extend utilities with backward compatibility
- Maintain existing API contracts

---

## 📦 Component Breakdown

### Task 1: Extend Time Window Utilities for 1h Support

**File**: `frontend/src/utils/timeWindow.js` (MODIFY)  
**Complexity**: Low  
**Time**: 15 minutes  
**Dependencies**: None

**Implementation Details**:

**1. Update `getTimeWindowRange()` function**:
```javascript
export const getTimeWindowRange = (window) => {
  const now = new Date()
  let hoursBack = 24 // default 24h
  
  if (window === '1h') {
    hoursBack = 1
  } else if (window === '7d') {
    hoursBack = 7 * 24
  } else if (window === '30d') {
    hoursBack = 30 * 24
  }
  
  const start = new Date(now.getTime() - (hoursBack * 60 * 60 * 1000))
  
  return {
    start: start.toISOString(),
    end: now.toISOString()
  }
}
```

**2. Update `getBucketSize()` function**:
```javascript
export const getBucketSize = (window) => {
  if (window === '1h') {
    return 'raw' // Use raw data for 1 hour (most granular)
  } else if (window === '24h') {
    return '10min'
  } else if (window === '7d') {
    return 'hour'
  } else if (window === '30d') {
    return 'day'
  }
  return '10min' // default fallback
}
```

**3. Update `formatTimeLabel()` function**:
```javascript
export const formatTimeLabel = (timestamp, window) => {
  const date = new Date(timestamp)
  
  if (isNaN(date.getTime())) {
    return ''
  }
  
  if (window === '1h') {
    // Show minutes for 1h window
    return date.toLocaleTimeString('cs-CZ', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false
    })
  } else if (window === '24h') {
    return date.toLocaleTimeString('cs-CZ', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false
    })
  } else if (window === '7d') {
    return date.toLocaleDateString('cs-CZ', { 
      weekday: 'short', 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false
    })
  } else {
    return date.toLocaleDateString('cs-CZ', { 
      month: 'short', 
      day: 'numeric'
    })
  }
}
```

**4. Update `getHoursForStats()` function**:
```javascript
export const getHoursForStats = (window) => {
  if (window === '1h') {
    return 1
  } else if (window === '24h') {
    return 24
  } else if (window === '7d') {
    return 168 // 7 * 24
  } else if (window === '30d') {
    return 720 // 30 * 24
  }
  return 24 // default
}
```

**Acceptance Criteria**:
- [ ] All four utility functions support '1h' window
- [ ] Backward compatibility maintained for existing windows
- [ ] 1h window uses appropriate bucket size ('raw' for granularity)
- [ ] Time labels format correctly for 1h window

---

### Task 2: Add 1h Option to TimeWindowSelector

**File**: `frontend/src/components/dashboard/TimeWindowSelector.jsx` (MODIFY)  
**Complexity**: Low  
**Time**: 10 minutes  
**Dependencies**: Task 1

**Implementation Details**:

**Update options array**:
```javascript
const TimeWindowSelector = ({ value, onChange }) => {
  const options = [
    { value: '1h', label: '1 hodina' },
    { value: '24h', label: '24 hodin' },
    { value: '7d', label: '7 dní' },
    { value: '30d', label: '30 dní' }
  ]
  
  // ... rest of component unchanged
}
```

**Acceptance Criteria**:
- [ ] "1 hodina" option appears first in selector
- [ ] Option is clickable and updates timeWindow state
- [ ] Visual styling matches existing options
- [ ] Active state highlighting works correctly

---

### Task 3: Set 1h Default on First Load

**File**: `frontend/src/pages/Dashboard.jsx` (MODIFY)  
**Complexity**: Low  
**Time**: 15 minutes  
**Dependencies**: Tasks 1, 2

**Implementation Details**:

**Update timeWindow initialization**:
```javascript
const Dashboard = () => {
  const location = useLocation()
  const navigate = useNavigate()

  // Read query parameters
  const searchParams = new URLSearchParams(location.search)
  const deviceId = searchParams.get('device')
  
  // Default to '1h' if no window param exists (first load)
  // Otherwise use the provided window or fallback to '24h' for backward compatibility
  const timeWindow = searchParams.get('window') || '1h'
  
  // ... rest of component
}
```

**Note**: The URL query parameter approach ensures:
- First load: No `window` param → defaults to '1h'
- User selects timeframe: `window` param set → uses that value
- Direct link with window param: Uses provided value
- Backward compatibility: Existing bookmarks with '24h' still work

**Acceptance Criteria**:
- [ ] Dashboard defaults to '1h' when no window param in URL
- [ ] User-selected timeframe persists in URL
- [ ] Direct links with window param work correctly
- [ ] Backward compatibility maintained

---

### Task 4: Implement Dynamic Segment Coloring for CO2 Graph

**File**: `frontend/src/utils/charts.js` (MODIFY)  
**Complexity**: Medium  
**Time**: 45 minutes  
**Dependencies**: None

**Implementation Details**:

**Modify `buildCo2Chart()` function**:

Chart.js 4.4.0 supports segment-based coloring using the `segment` property. However, for line charts, we need to use a different approach - creating separate datasets for segments or using the `borderColor` as a function.

**Approach 1: Segment Property (Preferred if supported)**:
```javascript
export const buildCo2Chart = (data) => {
  const labels = data.map(item => item.bucket_start)
  const datasetsMap = {}

  data.forEach(item => {
    const key = item.device_id || 'Všechna'
    if (!datasetsMap[key]) {
      datasetsMap[key] = {
        label: `CO₂ • ${key}`,
        data: [],
        fill: false,
        tension: 0.25,
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 6,
        // Dynamic segment coloring based on 2000 ppm threshold
        segment: {
          borderColor: (ctx) => {
            const value = ctx.p1.parsed.y
            if (value === null || value === undefined) {
              return 'rgba(128, 128, 128, 0.5)' // Gray for null values
            }
            return value < 2000 
              ? 'rgba(76, 175, 80, 0.85)'   // Green for < 2000 ppm
              : 'rgba(244, 67, 54, 0.85)'   // Red for >= 2000 ppm
          }
        },
        borderColor: key === 'Všechna' ? 'rgba(103, 126, 221, 0.85)' : undefined
      }
    }
    const co2Value = item.co2?.avg
    datasetsMap[key].data.push(co2Value !== null && co2Value !== undefined ? Number(co2Value) : null)
  })

  // ... rest of function (color assignment for multi-device)
}
```

**Approach 2: Multiple Datasets (Fallback if segment not supported)**:
If Chart.js segment property doesn't work as expected, split data into two datasets (below/above threshold) and merge them visually.

**Testing Strategy**:
- Test with data points below 2000 ppm (should be green)
- Test with data points above 2000 ppm (should be red)
- Test with data crossing threshold (should show both colors)
- Test with null/undefined values (should handle gracefully)

**Acceptance Criteria**:
- [ ] Line segments below 2000 ppm display in green
- [ ] Line segments at or above 2000 ppm display in red
- [ ] Transitions between colors are smooth
- [ ] Null/undefined values handled gracefully
- [ ] Existing multi-device coloring still works
- [ ] Chart performance remains acceptable

---

### Task 5: Reorder DeviceDetailView Components

**File**: `frontend/src/components/dashboard/DeviceDetailView.jsx` (MODIFY)  
**Complexity**: Low  
**Time**: 5 minutes  
**Dependencies**: None

**Implementation Details**:

**Reorder component render order**:
```javascript
const DeviceDetailView = ({ deviceId, timeWindow, onTimeWindowChange }) => {
  // ... existing code ...

  return (
    <div className="device-detail-view">
      <div className="device-detail-view__header">
        <h2 className="device-detail-view__title">{deviceName || deviceId}</h2>
        <Link to="/dashboard" className="device-detail-view__back-link">
          ← Zpět na přehled
        </Link>
      </div>

      {/* Quality distribution FIRST - most prominent */}
      <QualityPieChart deviceId={deviceId} timeWindow={timeWindow} />

      <TimeWindowSelector value={timeWindow} onChange={onTimeWindowChange} />

      <NumericalValues deviceId={deviceId} timeWindow={timeWindow} />

      <Co2Graph deviceId={deviceId} timeWindow={timeWindow} />

      <ClimateGraph deviceId={deviceId} timeWindow={timeWindow} />
    </div>
  )
}
```

**Acceptance Criteria**:
- [ ] QualityPieChart appears as first element after header
- [ ] All other components render in correct order
- [ ] No visual regressions
- [ ] Component functionality unchanged

---

### Task 6: Enhance Dashboard Padding and Spacing

**File**: `frontend/src/pages/Dashboard.css` (MODIFY)  
**File**: `frontend/src/components/dashboard/DeviceDetailView.css` (MODIFY)  
**Complexity**: Low  
**Time**: 20 minutes  
**Dependencies**: None

**Implementation Details**:

**1. Update Dashboard.css**:
```css
.dashboard-page {
  min-height: 100vh;
  padding: var(--md3-spacing-6); /* Increased from var(--md3-spacing-4) */
}

.dashboard-page__header {
  margin-bottom: var(--md3-spacing-6); /* Increased from var(--md3-spacing-4) */
}

.dashboard-box-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: var(--md3-spacing-6); /* Increased from var(--md3-spacing-4) */
}
```

**2. Update DeviceDetailView.css**:
```css
.device-detail-view {
  max-width: 1400px;
  margin: 0 auto;
  padding: var(--md3-spacing-4); /* Add container padding */
}

.device-detail-view__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--md3-spacing-6); /* Increased from var(--md3-spacing-4) */
  flex-wrap: wrap;
  gap: var(--md3-spacing-2);
}

/* Add spacing between chart containers */
.chart-container {
  margin-bottom: var(--md3-spacing-6); /* Increased from var(--md3-spacing-4) */
}

.numerical-values {
  margin-bottom: var(--md3-spacing-6); /* Increased from var(--md3-spacing-4) */
}
```

**Responsive Considerations**:
- Maintain responsive padding on mobile (use smaller spacing tokens)
- Ensure padding doesn't cause horizontal scrolling
- Test on various screen sizes

**Acceptance Criteria**:
- [ ] Dashboard has more visual breathing room
- [ ] Components don't feel cramped
- [ ] Responsive design maintained
- [ ] No layout breaking on mobile
- [ ] Consistent spacing throughout

---

## 🗂️ Data Model

### No Backend Changes Required

All data structures remain unchanged:

**Quality Distribution Data** (`historyAPI.getSummary()`):
```javascript
{
  status: 'success',
  summary: {
    co2_quality: {
      good: 10,        // Count of readings < 1000 ppm
      moderate: 20,   // Count of readings 1000-1500 ppm
      high: 50,        // Count of readings 1500-2000 ppm
      critical: 20     // Count of readings >= 2000 ppm
    }
  }
}
```

**CO2 Series Data** (`historyAPI.getSeries()`):
```javascript
{
  status: 'success',
  series: [
    {
      bucket_start: '2024-12-19T10:00:00Z',
      co2: { avg: 850 },  // CO2 value in ppm
      temperature: { avg: 22.5 },
      humidity: { avg: 45 }
    },
    // ... more data points
  ]
}
```

---

## 🎨 UI/UX Design

### Component Order (DeviceDetailView)

**Before**:
1. Header
2. TimeWindowSelector
3. NumericalValues
4. Co2Graph
5. ClimateGraph
6. QualityPieChart (last)

**After**:
1. Header
2. **QualityPieChart (FIRST - prominent)**
3. TimeWindowSelector
4. NumericalValues
5. Co2Graph (with dynamic coloring)
6. ClimateGraph

### Visual Enhancements

**1. Quality Distribution Chart**:
- Positioned at top for immediate visibility
- Existing color scheme maintained:
  - Good: Green (< 1000 ppm)
  - Medium: Yellow (1000-1500 ppm)
  - Bad: Orange (1500-2000 ppm)
  - Very Bad: Red (≥ 2000 ppm)
- Percentage labels shown in legend

**2. CO2 Graph Dynamic Coloring**:
- Green line segments for values < 2000 ppm
- Red line segments for values ≥ 2000 ppm
- Smooth color transitions at threshold
- Threshold line annotation at 2000 ppm (if needed)

**3. Enhanced Spacing**:
- Increased padding from `--md3-spacing-4` to `--md3-spacing-6` on main containers
- More breathing room between chart sections
- Better visual hierarchy

---

## 🔄 Data Flow

### Time Window Selection Flow

```
1. User loads dashboard (first time)
   ↓
2. No 'window' query param in URL
   ↓
3. Dashboard defaults to '1h'
   ↓
4. URL updated: /dashboard?window=1h
   ↓
5. All components use 1h timeframe
   ↓
6. User selects different timeframe (e.g., '24h')
   ↓
7. URL updated: /dashboard?window=24h
   ↓
8. All components refresh with new timeframe
```

### CO2 Graph Rendering Flow

```
1. Co2Graph component receives timeWindow prop
   ↓
2. Calls historyAPI.getSeries() with timeWindow range
   ↓
3. Receives series data with CO2 values
   ↓
4. buildCo2Chart() processes data
   ↓
5. For each data point:
   - Extract CO2 value
   - Determine color: green (< 2000) or red (≥ 2000)
   - Apply segment coloring
   ↓
6. Chart.js renders line with dynamic colors
```

---

## ⏱️ Time Estimates

| Task | Time | Dependencies |
|------|------|--------------|
| Task 1: Extend Time Window Utilities | 15min | None |
| Task 2: Add 1h Option to Selector | 10min | Task 1 |
| Task 3: Set 1h Default on First Load | 15min | Tasks 1, 2 |
| Task 4: Dynamic Segment Coloring | 45min | None |
| Task 5: Reorder Components | 5min | None |
| Task 6: Enhance Padding | 20min | None |
| Testing & Refinement | 30min | All tasks |
| **TOTAL** | **~2.5 hours** | |

---

## 🧪 Testing Strategy

### Unit Tests

**Time Window Utilities**:
- Test `getTimeWindowRange('1h')` returns correct 1-hour range
- Test `getBucketSize('1h')` returns 'raw'
- Test `formatTimeLabel()` formats 1h timestamps correctly
- Test `getHoursForStats('1h')` returns 1

**Chart Utilities**:
- Test `buildCo2Chart()` with data below 2000 ppm (green segments)
- Test `buildCo2Chart()` with data above 2000 ppm (red segments)
- Test `buildCo2Chart()` with data crossing threshold
- Test null/undefined value handling

### Integration Tests

**Component Integration**:
- Test TimeWindowSelector shows 1h option
- Test Dashboard defaults to 1h on first load
- Test DeviceDetailView shows QualityPieChart first
- Test CO2 graph displays dynamic colors correctly

### E2E Tests

**User Flows**:
1. Load dashboard → Verify 1h default
2. Select device → Verify quality chart appears first
3. View CO2 graph → Verify green/red coloring
4. Change timeframe → Verify all components update
5. Navigate back → Verify timeframe persists

### Visual Regression Tests

- Screenshot comparison for component reordering
- Verify padding enhancements don't break layout
- Check responsive design on mobile/tablet/desktop

---

## ✅ Success Criteria

1. ✅ Air quality distribution chart appears as first element in device detail view
2. ✅ "1 hodina" option available in time window selector
3. ✅ Dashboard defaults to 1h timeframe on first load
4. ✅ CO2 graph line changes color dynamically (green < 2000 ppm, red ≥ 2000 ppm)
5. ✅ Dashboard has enhanced padding and spacing
6. ✅ All changes apply only to regular dashboard (not admin panel)
7. ✅ No visual regressions or broken functionality
8. ✅ Responsive design maintained on all screen sizes

---

## 📝 Implementation Notes

### Chart.js Segment Coloring

**Version**: Chart.js 4.4.0 supports segment-based coloring via the `segment` property in dataset configuration.

**Implementation**:
```javascript
segment: {
  borderColor: (ctx) => {
    const value = ctx.p1.parsed.y
    return value < 2000 
      ? 'rgba(76, 175, 80, 0.85)'   // Green
      : 'rgba(244, 67, 54, 0.85)'   // Red
  }
}
```

**Fallback Approach** (if segment doesn't work):
- Split data into two datasets (below/above threshold)
- Use different borderColor for each dataset
- Merge visually in chart

### First Load Detection

**Approach**: URL query parameter
- Check `location.search` for `window` parameter
- If absent → first load → default to '1h'
- If present → use provided value
- No localStorage/sessionStorage needed (URL is source of truth)

### Performance Considerations

**1. Chart Rendering**:
- Segment coloring may have slight performance impact
- Monitor with large datasets (> 1000 points)
- Consider data sampling for very large time windows

**2. API Calls**:
- 1h window uses 'raw' bucket size (most granular)
- May return more data points than '10min' bucket
- Monitor API response times
- Consider client-side data sampling if needed

### Error Handling

**1. Missing Data**:
- Handle null/undefined CO2 values gracefully
- Show gray or transparent segments for missing data
- Display appropriate error messages

**2. API Failures**:
- Maintain existing error handling patterns
- Show loading states during data fetch
- Display user-friendly error messages

### Edge Cases

**1. No Data Points**:
- Handle empty series gracefully
- Show "No data" message
- Don't break chart rendering

**2. All Values Above/Below Threshold**:
- Chart should display correctly (all red or all green)
- No visual artifacts

**3. Rapid Timeframe Changes**:
- Cancel in-flight API requests if timeframe changes
- Prevent race conditions in state updates

### Accessibility

**1. Color Coding**:
- Ensure sufficient color contrast
- Don't rely solely on color (use labels/annotations)
- Consider colorblind users

**2. Chart Accessibility**:
- Maintain Chart.js accessibility features
- Ensure screen reader compatibility
- Add ARIA labels where needed

---

## 🔗 Dependencies

### External Dependencies
- **Chart.js 4.4.0**: Already installed, supports segment coloring
- **react-chartjs-2 5.2.0**: Already installed, React wrapper for Chart.js
- **chartjs-plugin-annotation 3.0.1**: Already installed, for threshold lines

### Internal Dependencies
- `historyAPI.getSummary()` - Provides quality distribution data
- `historyAPI.getSeries()` - Provides CO2 series data
- Existing chart utilities (`charts.js`)
- Existing time window utilities (`timeWindow.js`)

### No New Dependencies Required

---

## 🚀 Deployment Considerations

### Frontend-Only Changes
- No backend deployment needed
- No database migrations
- No API contract changes
- Can be deployed independently

### Rollout Strategy
1. Deploy to staging environment
2. Test all functionality
3. Verify no regressions in admin panel
4. Deploy to production
5. Monitor for issues

### Rollback Plan
- All changes are in separate files/components
- Can revert individual changes if needed
- No data migration required

---

**Total Estimated Time**: ~2.5 hours  
**Start Date**: TBD  
**Target Completion**: TBD

