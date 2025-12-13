# dashboard-air-quality-enhancement Feature Brief

## 🎯 Context (2min)
**Problem**: The regular dashboard (not admin panel) lacks a prominent, color-differentiated air quality distribution visualization. Users currently see device details first, but air quality status should be the primary focus. Additionally, the default timeframe is 24 hours when 1 hour would be more relevant for current air quality assessment. The CO2 graph also needs visual indication of the 2000 ppm safety threshold with dynamic color coding.

**Users**: Regular dashboard users monitoring air quality in real-time  
**Success**: Users immediately see color-coded air quality distribution as the first element, can assess current conditions with 1h default timeframe, and graphs clearly show when CO2 exceeds 2000 ppm with red coloring

## 🔍 Quick Research (15min)
### Existing Patterns
- **Quality Pie Chart** → `DeviceDetailView.jsx` uses `buildQualityPieChart()` from `charts.js` | Reuse: Yes, extend for prominent display
- **Chart.js Line Charts** → CO2 graphs use Chart.js with `buildCo2Chart()` | Reuse: Yes, add segment coloring
- **Time Window Selector** → `TimeWindowSelector.jsx` has 24h/7d/30d options | Reuse: Yes, add 1h option
- **Time Window Utilities** → `timeWindow.js` handles range calculations | Reuse: Yes, extend for 1h support
- **Dashboard Layout** → `Dashboard.jsx` manages device selection and detail view | Reuse: Yes, reorder components
- **CSS Spacing** → Uses Material Design 3 spacing tokens (`--md3-spacing-*`) | Reuse: Yes, enhance padding

### Tech Decision
**Approach**: 
1. Reorder `DeviceDetailView` to show air quality distribution first
2. Extend Chart.js CO2 chart with segment-based coloring (green < 2000 ppm, red ≥ 2000 ppm)
3. Add "1h" option to `TimeWindowSelector` and set as default on first load
4. Enhance dashboard padding using existing spacing tokens

**Why**: 
- Reuses existing quality chart infrastructure
- Chart.js supports segment coloring via dataset segment configuration
- Minimal changes to existing components
- Maintains consistency with current design system

**Avoid**: 
- Creating new chart library dependencies
- Modifying backend APIs (data already available)
- Changing admin panel (scope is regular dashboard only)

## ✅ Requirements (10min)
- **Air Quality Distribution First**: Color-differentiated distribution section (Good/Medium/Bad/Very Bad with percentages) must be the first element users see in device detail view, replacing current layout order
- **1 Hour Default**: Default timeframe should be 1 hour when dashboard first loads (only on initial load, not persisted)
- **1 Hour Option**: Add "1 hodina" option to time window selector alongside existing 24h/7d/30d
- **2000 ppm Threshold**: CO2 graph line color changes dynamically - green for values below 2000 ppm, red for values at or above 2000 ppm
- **Enhanced Padding**: Add more visual padding/spacing to dashboard components for better visual appeal
- **Regular Dashboard Only**: All changes apply only to regular dashboard (`Dashboard.jsx`, `DeviceDetailView.jsx`), not admin panel

## 🏗️ Implementation (5min)
**Components**: 
- `frontend/src/components/dashboard/DeviceDetailView.jsx` - Reorder to show quality chart first
- `frontend/src/components/dashboard/TimeWindowSelector.jsx` - Add 1h option
- `frontend/src/pages/Dashboard.jsx` - Set 1h as default on first load
- `frontend/src/utils/charts.js` - Add segment coloring logic for CO2 chart
- `frontend/src/utils/timeWindow.js` - Add 1h support to utilities
- `frontend/src/pages/Dashboard.css` - Enhance padding
- `frontend/src/components/dashboard/DeviceDetailView.css` - Enhance spacing

**APIs**: 
- Existing `historyAPI.getSummary()` - Already provides quality distribution data
- Existing `historyAPI.getSeries()` - Already provides CO2 series data

**Data**: 
- No backend changes needed
- Quality distribution data structure: `{good, moderate, high, critical}` counts
- CO2 series data: `[{co2: {avg: number}, bucket_start: string}, ...]`

## 📋 Next Actions (2min)
- [ ] Add "1h" option to `TimeWindowSelector.jsx` (15min)
- [ ] Update `timeWindow.js` utilities to support 1h timeframe (10min)
- [ ] Modify `Dashboard.jsx` to default to "1h" on first load only (10min)
- [ ] Reorder `DeviceDetailView.jsx` to show quality distribution first (5min)
- [ ] Implement dynamic segment coloring in `buildCo2Chart()` for 2000 ppm threshold (30min)
- [ ] Enhance padding in `Dashboard.css` and `DeviceDetailView.css` (15min)
- [ ] Test all changes in regular dashboard (not admin panel) (20min)

**Start Coding In**: ~30min

---
**Total Planning Time**: ~30min | **Owner**: Development Team | 2024-12-19

<!-- Living Document - Update as you code -->

## 🔄 Implementation Tracking

**CRITICAL**: Follow the todo-list systematically. Mark items as complete, document blockers, update progress.

### Progress
- [ ] Track completed items here
- [ ] Update daily

### Blockers
- [ ] Document any blockers

**See**: [.sdd/IMPLEMENTATION_GUIDE.md](mdc:.sdd/IMPLEMENTATION_GUIDE.md) for detailed execution rules.

## 📝 Technical Notes

### Chart.js Segment Coloring
Chart.js supports segment-based coloring using the `segment` property in dataset configuration. For dynamic coloring based on value thresholds:
```javascript
segment: {
  borderColor: (ctx) => {
    const value = ctx.p1.parsed.y
    return value < 2000 ? 'rgba(76, 175, 80, 0.85)' : 'rgba(244, 67, 54, 0.85)'
  }
}
```

### Quality Distribution Categories
Based on existing `buildQualityPieChart()`:
- **Good**: < 1000 ppm (green)
- **Medium**: 1000-1500 ppm (yellow)
- **Bad**: 1500-2000 ppm (orange)
- **Very Bad**: 2000+ ppm (red)

### First Load Detection
Use URL query parameter or sessionStorage to detect first load:
- Check if `window` query param exists
- If not present, default to "1h"
- Once user selects a timeframe, use that selection

