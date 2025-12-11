# admin-panel-restructure Feature Brief

## 🎯 Context (2min)
**Problem**: Data analysis capabilities are currently split between Dashboard and History tabs, creating a fragmented experience for administrators. The Admin Panel currently only shows basic device statistics without analytical capabilities. Administrators need a unified interface where they can select boards (classrooms) and immediately access comprehensive data analysis including trends, distributions, and historical insights - all within the Admin Panel context.

**Users**: 
- School administrators managing multiple classroom sensors
- Facility managers monitoring office environments across locations
- System administrators overseeing IoT device deployments
- Users who need centralized board management with embedded analytics

**Success**: Administrators can:
1. View all boards in a compact, card-based layout with visual summaries
2. Quickly identify board status (online/offline) and recent CO2 trends at a glance
3. Access detailed analysis (trend graphs, distribution data, numerical statistics) by clicking "Details" on any board card
4. See the same comprehensive distribution graph data that exists in the History view
5. Work entirely within the Admin Panel without switching between tabs

## 🔍 Quick Research (15min)
### Existing Patterns
- **Admin Panel Device Cards** (`frontend/src/pages/AdminPanel.jsx` lines 94-136) → Grid layout with device cards, click handlers, status badges, current readings display | Reuse: Card structure, device data mapping, status badge pattern
- **History Distribution Graph** (`frontend/src/pages/History.jsx` lines 768-808) → Doughnut chart using Chart.js for CO2 quality distribution with `co2_quality` data structure | Reuse: Doughnut chart component, quality data mapping, chart options
- **History Quality Table** (`frontend/src/pages/History.jsx` lines 717-766) → Table showing good/moderate/high/critical counts and percentages | Reuse: Data structure preservation, badge colors for quality levels
- **Dashboard Chart.js Integration** (`frontend/src/pages/Dashboard.jsx` lines 233-342) → Line charts with Chart.js, common options pattern, responsive design | Reuse: Chart configuration, responsive chart containers, tooltip styling
- **History Trend Charts** (`frontend/src/pages/History.jsx` lines 238-322) → Multi-dataset Line charts for CO2 and climate data, time-series formatting | Reuse: Chart building functions, time label formatting, multi-device handling
- **API Service Pattern** (`frontend/src/services/api.js` lines 63-90) → `historyAPI.getSeries()` and `historyAPI.getSummary()` for time-series and aggregate data | Reuse: API calling patterns, parameter handling
- **Card Component** (`frontend/src/components/ui/Card.jsx`) → Elevation variants, click handlers, className composition | Reuse: Card base component with elevation and interaction states
- **Badge Component** (`frontend/src/components/ui/Badge.jsx`) → Color variants (success/error), standard variant | Reuse: Status badge display pattern
- **Chart.js Registration** (`frontend/src/pages/History.jsx` lines 27-38) → Chart.js plugins registration including ArcElement for Doughnut charts | Reuse: Plugin registration pattern

### Tech Decision
**Approach**: Component refactoring with Chart.js reuse and inline tooltip implementation
- **Why**: 
  - Chart.js already integrated and working (Line, Doughnut charts)
  - Existing API endpoints provide all needed data
  - React component patterns established
  - No new dependencies required
  - Preserves existing distribution graph functionality
- **Avoid**: 
  - Introducing new charting libraries (unnecessary complexity)
  - Creating separate API endpoints (existing ones sufficient)
  - Removing History view functionality (should coexist, not replace)
  - Over-complicating hover tooltips (CSS-based solution sufficient)

## ✅ Requirements (10min)

### Core Features

**R1: Compact Board Card Layout**
- Display boards in a responsive grid with smaller card sizes than current implementation
- Each card shows: board name (device_id), status badge, visual summary section
- Cards maintain hover states and visual feedback
- Grid adapts to screen size (responsive: 1 column mobile, 2-3 tablet, 4+ desktop)
- **Acceptance**: Card grid displays with cards ~30% smaller than current device cards, maintains responsive layout

**R2: Visual Summary on Cards**
- Miniature CO2 concentration graph showing last 1 hour of data
- Graph displays as compact Line chart (height ~80-100px)
- Current CO2 value displayed numerically below or beside graph
- Graph updates when card data refreshes
- **Acceptance**: Each card shows a small CO2 trend graph for last hour with current value prominently displayed

**R3: Offline Info Icon with Hover**
- Information icon (ℹ️) appears on cards when device status is "Offline"
- Icon is clickable/hoverable
- Hover displays tooltip/popup box showing:
  - Last Seen Online: Formatted timestamp
  - Total Data Points Collected: Number with formatting
- Tooltip positioned near icon, doesn't obstruct card content
- **Acceptance**: Offline devices show info icon; hovering reveals last seen time and total data points

**R4: Status Badge Display**
- Status badge on each card showing "Online" (green/success) or "Offline" (red/error)
- Badge uses existing Badge component with color variants
- Badge positioned consistently (top-right or header area)
- **Acceptance**: Each card clearly displays device online/offline status with color-coded badge

**R5: Details Button Interaction**
- Each board card includes a "Details" button or link (preferred: button for better UX)
- Button positioned at bottom or action area of card
- Clicking "Details" expands/reveals History/Analysis section below card grid
- Section shows detailed analysis for selected board
- **Acceptance**: Clicking "Details" on a card reveals analysis section with that board's data

**R6: History/Analysis Section (CRITICAL: Preserve Distribution Graph)**
- Section appears at bottom of page when Details is clicked
- Includes comprehensive analysis views:
  - **Trend Graphs**: CO2 over time, Temperature & Humidity trends (similar to History view)
  - **Key Numerical Data**: Summary statistics (avg, min, max for CO2, temp, humidity)
  - **Distribution Graph**: CO2 quality distribution using Doughnut chart
    - **MUST preserve exact values from History view**: 
      - Uses `co2_quality` data structure: `{ good, moderate, high, critical, good_percent, moderate_percent, high_percent, critical_percent }`
      - Displays same quality categories: < 1000 ppm (good), 1000-1499 ppm (moderate), 1500-1999 ppm (high), ≥ 2000 ppm (critical)
      - Shows same visual representation (Doughnut chart with color coding)
      - May also include quality table like History view (lines 717-766)
- Section separated by visual divider (1px grey line as specified)
- Section is collapsible/dismissible to return to card view
- **Acceptance**: Analysis section shows all required graphs and data; Distribution graph matches History view exactly in data structure and visual representation

**R7: Card Size Reduction**
- Cards must be smaller than current `admin-page__device-card` implementation
- Current cards: ~300px min-width in grid, padding: 24px (var(--md3-spacing-6))
- Target: Reduce padding, adjust grid min-width to ~250px, compact content spacing
- Maintain readability and visual hierarchy
- **Acceptance**: Cards are visibly more compact while remaining functional and readable

## 🏗️ Implementation (5min)

### Components

**Frontend (React)**:
- `frontend/src/pages/AdminPanel.jsx` - Main refactoring:
  - Extract `BoardCard` component for individual board cards
  - Add `BoardAnalysisView` component for details section
  - Update state management for selected board and analysis data
  - Integrate chart rendering for mini-graphs and full analysis
- `frontend/src/components/admin/BoardCard.jsx` (NEW) - Compact board card:
  - Props: device data, onClick handler, selected state
  - Mini CO2 graph (last 1 hour), current value display
  - Status badge, offline info icon with hover tooltip
  - Details button
- `frontend/src/components/admin/BoardAnalysisView.jsx` (NEW) - Analysis section:
  - Props: deviceId, onClose handler
  - Trend graphs (CO2, Temperature & Humidity)
  - Summary statistics cards
  - Distribution graph (Doughnut chart - reuse from History.jsx)
  - Quality breakdown table
- `frontend/src/components/admin/OfflineInfoTooltip.jsx` (NEW) - Hover tooltip:
  - Simple CSS-based tooltip or React component
  - Displays last seen timestamp and total data points
- `frontend/src/pages/AdminPanel.css` - Styling updates:
  - Compact card styles, mini-graph container, tooltip positioning
  - Analysis section layout, responsive adjustments

**Chart Integration**:
- Reuse Chart.js setup from History.jsx (Line, Doughnut charts)
- Extract chart building functions for reuse:
  - `buildCo2Chart()` for trend visualization
  - `buildClimateChart()` for temperature/humidity
  - `buildQualityPieChart()` for distribution (CRITICAL: preserve exactly)
- Mini-graph configuration for compact display on cards

**API Usage**:
- `adminAPI.getDevices()` - Board list (existing)
- `historyAPI.getSeries(start, end, bucket, deviceId)` - Trend data:
  - Mini-graph: last 1 hour, bucket='10min' or 'raw'
  - Full analysis: configurable time range (default 30 days), bucket='day'
- `historyAPI.getSummary(start, end, deviceId)` - Distribution data:
  - Provides `co2_quality` object with counts and percentages
  - Same endpoint used by History view (ensures data consistency)

### APIs

**Existing Endpoints Used**:
- `GET /api/admin/devices` - List all boards/devices (existing)
- `GET /api/history/series?start={iso}&end={iso}&bucket={bucket}&device_id={deviceId}` - Time-series data for charts
- `GET /api/history/summary?start={iso}&end={iso}&device_id={deviceId}` - Aggregate statistics including `co2_quality` distribution

**No New Endpoints Required**:
- All data available through existing history API
- May need optimization for mini-graph (last 1 hour data) but same endpoint

### Data Changes
- No database schema changes
- No API response structure changes
- Data structure preservation: `co2_quality` object must maintain format:
  ```javascript
  {
    good: number,
    moderate: number,
    high: number,
    critical: number,
    good_percent: number,
    moderate_percent: number,
    high_percent: number,
    critical_percent: number
  }
  ```

## 📋 Next Actions (2min)
- [ ] Extract chart building functions from History.jsx into shared utilities (30min)
- [ ] Create `BoardCard.jsx` component with mini CO2 graph and status display (45min)
- [ ] Implement offline info tooltip component with hover state (30min)
- [ ] Create `BoardAnalysisView.jsx` component with trend graphs (60min)
- [ ] Integrate distribution graph (Doughnut chart) preserving History view data structure (45min)
- [ ] Add quality breakdown table matching History view format (30min)
- [ ] Refactor `AdminPanel.jsx` to use new card components and state management (60min)
- [ ] Update `AdminPanel.css` for compact card styling and responsive layout (45min)
- [ ] Test distribution graph data matches History view exactly (20min)
- [ ] Test Details button interaction and section reveal/hide (20min)
- [ ] Verify mini-graphs load correctly for all devices (20min)
- [ ] Test offline info tooltip on offline devices (15min)

**Start Coding In**: ~6-7 hours total implementation time

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

### Distribution Graph Preservation (CRITICAL)
The distribution graph from History view MUST be preserved exactly:
- **Source Code Reference**: `frontend/src/pages/History.jsx` lines 324-370 (buildQualityPieChart function), lines 768-808 (Doughnut chart rendering)
- **Data Structure**: Uses `summary.co2_quality` object from `historyAPI.getSummary()`
- **Quality Categories**:
  - Good: < 1000 ppm (rgba(76, 175, 80, 0.85) - green)
  - Moderate: 1000-1500 ppm (rgba(255, 193, 7, 0.75) - yellow)
  - High: 1500-2000 ppm (rgba(255, 152, 0, 0.75) - orange)
  - Critical: > 2000 ppm (rgba(244, 67, 54, 0.85) - red)
- **Chart Type**: Doughnut chart with Chart.js ArcElement
- **Visual**: Pie chart with legend, percentage labels in tooltip
- **Table View**: Also includes quality breakdown table (History.jsx lines 717-766) showing counts and percentages

### Mini-Graph Implementation
- **Data Source**: `historyAPI.getSeries()` with:
  - `start`: 1 hour ago (ISO string)
  - `end`: now (ISO string)
  - `bucket`: '10min' or 'raw' depending on data density
  - `device_id`: specific board device ID
- **Chart Size**: Compact, height ~80-100px, responsive width
- **Data Display**: Line chart showing CO2 concentration over last hour
- **Performance**: Consider data sampling if > 200 points (similar to Dashboard.jsx line 202-205)

### Card Size Reduction Strategy
Current card styles (`AdminPanel.css`):
- Grid: `minmax(300px, 1fr)` (line 104)
- Card padding: `var(--md3-spacing-6)` = 24px (line 109)
- Device body gap: `var(--md3-spacing-3)` = 12px (line 147)

Target adjustments:
- Grid: `minmax(250px, 1fr)` for more cards per row
- Card padding: `var(--md3-spacing-4)` = 16px
- Compact content spacing: reduce gaps to `var(--md3-spacing-2)` = 8px where appropriate
- Mini-graph container: fixed height, prevent card expansion

### Tooltip Implementation Options
**Option 1**: CSS-only tooltip (simpler)
- Use `::before` and `::after` pseudo-elements
- CSS `:hover` state
- Positioned absolutely relative to icon

**Option 2**: React component with state (more flexible)
- `useState` for hover state
- Conditional rendering of tooltip
- Better for complex content or interactions

Recommendation: Start with CSS-only, upgrade to React component if needed for positioning/complexity.

### Component Extraction Strategy
1. **Phase 1**: Extract chart utilities to `frontend/src/utils/charts.js`
   - `buildCo2Chart(data)` - CO2 trend line chart
   - `buildClimateChart(data)` - Temp/Humidity dual-axis chart
   - `buildQualityPieChart(co2Quality)` - Distribution Doughnut chart
   - Common chart options configuration

2. **Phase 2**: Create `BoardCard` component
   - Props interface design
   - Mini-graph integration
   - Tooltip integration

3. **Phase 3**: Create `BoardAnalysisView` component
   - Full analysis section
   - Reuse extracted chart utilities
   - Distribution graph integration

4. **Phase 4**: Refactor `AdminPanel.jsx`
   - Replace inline card rendering with `BoardCard`
   - Add Details button state management
   - Integrate `BoardAnalysisView`

### State Management
AdminPanel state additions:
```javascript
const [selectedBoard, setSelectedBoard] = useState(null)
const [analysisData, setAnalysisData] = useState(null)
const [loadingAnalysis, setLoadingAnalysis] = useState(false)
```

Flow:
1. User clicks "Details" on card → `setSelectedBoard(deviceId)`
2. Load analysis data: `historyAPI.getSeries()` + `historyAPI.getSummary()`
3. Set analysis data → render `BoardAnalysisView`
4. User clicks close/back → `setSelectedBoard(null)` → hide analysis section

### Responsive Design Considerations
- **Mobile (< 640px)**: Single column card grid, full-width analysis section, stacked mini-graph
- **Tablet (640-1024px)**: 2-column card grid, side-by-side analysis graphs
- **Desktop (> 1024px)**: 3-4 column card grid, multi-column analysis layout
- Use CSS Grid with `auto-fit` and responsive `minmax()` values
- Analysis section should stack on mobile, grid on larger screens

### Testing Checklist
- [ ] Distribution graph shows same values as History view for same device/time range
- [ ] Quality percentages match between Admin Panel and History view
- [ ] Mini-graphs load and display correctly for online devices
- [ ] Mini-graphs handle offline/missing data gracefully
- [ ] Offline info tooltip appears only for offline devices
- [ ] Tooltip displays correct last seen timestamp and data point count
- [ ] Details button reveals analysis section
- [ ] Analysis section can be dismissed/closed
- [ ] Cards are noticeably more compact than current implementation
- [ ] Responsive layout works on mobile, tablet, desktop
- [ ] Chart tooltips work correctly in both mini and full-size charts
- [ ] Performance acceptable with 10+ boards (lazy load mini-graphs?)


