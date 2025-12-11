# Implementation Todo List: board-specific-urls

## Overview
Implement board-specific URLs (`/BOARD_XXXX`) and box-based board selection on home page. Each board gets its own URL for direct access and QR code support. Home page displays boards in a grid layout similar to AdminPanel. Dashboard automatically filters when accessed via board-specific URL.

## Pre-Implementation Setup
- [x] Review feature brief and requirements
- [x] Confirm specification requirements (R1-R6)
- [x] Validate technical plan and patterns
- [x] Understand existing routing structure
- [x] Review BoardCard component for reuse

## Todo Items

### Phase 1: Routing Foundation

- [x] **T1.1**: Add `/BOARD_:boardId` route to App.jsx (15min)
  - **Dependencies**: None
  - **Existing Pattern**: `App.jsx` lines 25-36 (existing routes)
  - **Files to Modify**: `frontend/src/App.jsx`
  - **Acceptance**: Route added before catch-all route, renders Dashboard component
  - **Notes**: Place route before `/dashboard` to ensure proper matching
  - **Status**: COMPLETE

- [x] **T1.2**: Import useParams hook in Dashboard.jsx (5min)
  - **Dependencies**: T1.1
  - **Existing Pattern**: React Router hooks usage
  - **Files to Modify**: `frontend/src/pages/Dashboard.jsx`
  - **Acceptance**: `useParams` imported from `react-router-dom`
  - **Status**: COMPLETE

### Phase 2: Dashboard URL Integration

- [x] **T2.1**: Extract boardId from URL params in Dashboard (10min)
  - **Dependencies**: T1.2
  - **Existing Pattern**: React Router parameter extraction
  - **Files to Modify**: `frontend/src/pages/Dashboard.jsx`
  - **Acceptance**: `const { boardId } = useParams()` extracts board ID from URL
  - **Status**: COMPLETE

- [x] **T2.2**: Auto-set selectedDevice from URL when boardId present (15min)
  - **Dependencies**: T2.1
  - **Existing Pattern**: `Dashboard.jsx` line 40 (selectedDevice state)
  - **Files to Modify**: `frontend/src/pages/Dashboard.jsx`
  - **Acceptance**: useEffect sets selectedDevice to boardId when URL contains boardId
  - **Status**: COMPLETE

- [x] **T2.3**: Add board context display in Dashboard header (20min)
  - **Dependencies**: T2.1
  - **Existing Pattern**: `Dashboard.jsx` lines 391-409 (header structure)
  - **Files to Modify**: `frontend/src/pages/Dashboard.jsx`
  - **Acceptance**: Header shows "Dashboard - BOARD_XXXX" when viewing specific board
  - **Status**: COMPLETE

- [x] **T2.4**: Add "View All Boards" link in Dashboard header (15min)
  - **Dependencies**: T2.3
  - **Existing Pattern**: React Router Link component
  - **Files to Modify**: `frontend/src/pages/Dashboard.jsx`
  - **Acceptance**: Link appears when boardId present, navigates to `/dashboard` or `/`
  - **Status**: COMPLETE

- [ ] **T2.5**: Handle invalid board IDs gracefully (15min)
  - **Dependencies**: T2.1, T2.2
  - **Existing Pattern**: Error handling patterns
  - **Files to Modify**: `frontend/src/pages/Dashboard.jsx`
  - **Acceptance**: Invalid board IDs show error message or redirect to home

### Phase 3: Home Page Board Selection

- [x] **T3.1**: Add device list state and loading in Home.jsx (10min)
  - **Dependencies**: None
  - **Existing Pattern**: `Home.jsx` lines 10-18 (state management)
  - **Files to Modify**: `frontend/src/pages/Home.jsx`
  - **Acceptance**: State for devices array and loading status added
  - **Status**: COMPLETE

- [x] **T3.2**: Load device list from API in Home.jsx (20min)
  - **Dependencies**: T3.1
  - **Existing Pattern**: `Dashboard.jsx` lines 65-83 (fetchDevices function)
  - **Files to Modify**: `frontend/src/pages/Home.jsx`
  - **API**: `dataAPI.getDevices()` - returns array of device IDs
  - **Acceptance**: Devices loaded on component mount, stored in state
  - **Status**: COMPLETE

- [x] **T3.3**: Create board selection grid section in Home.jsx (30min)
  - **Dependencies**: T3.2
  - **Existing Pattern**: `AdminPanel.jsx` lines 103-119 (devices grid)
  - **Files to Modify**: `frontend/src/pages/Home.jsx`
  - **Acceptance**: Grid section added, displays devices in grid layout
  - **Status**: COMPLETE

- [x] **T3.4**: Integrate BoardCard component with public props (30min)
  - **Dependencies**: T3.3, T4.1
  - **Existing Pattern**: `AdminPanel.jsx` lines 110-117 (BoardCard usage)
  - **Files to Modify**: `frontend/src/pages/Home.jsx`
  - **Acceptance**: BoardCard components render in grid, link to board URLs
  - **Status**: COMPLETE

### Phase 4: Component Adaptation

- [x] **T4.1**: Add public prop to BoardCard component (20min)
  - **Dependencies**: None
  - **Existing Pattern**: `BoardCard.jsx` component structure
  - **Files to Modify**: `frontend/src/components/admin/BoardCard.jsx`
  - **Acceptance**: `public` prop added, defaults to false
  - **Status**: COMPLETE

- [x] **T4.2**: Update BoardCard to support Link navigation (15min)
  - **Dependencies**: T4.1
  - **Existing Pattern**: React Router Link component
  - **Files to Modify**: `frontend/src/components/admin/BoardCard.jsx`
  - **Acceptance**: BoardCard accepts `to` prop for Link navigation when public
  - **Status**: COMPLETE

- [x] **T4.3**: Hide admin features in BoardCard when public (20min)
  - **Dependencies**: T4.1
  - **Existing Pattern**: `BoardCard.jsx` lines 173-186 (rename button)
  - **Files to Modify**: `frontend/src/components/admin/BoardCard.jsx`
  - **Acceptance**: Rename button and admin-only features hidden when public=true
  - **Status**: COMPLETE

- [x] **T4.4**: Update BoardCard onClick to support Link navigation (15min)
  - **Dependencies**: T4.2
  - **Existing Pattern**: `BoardCard.jsx` line 168 (onClick handler)
  - **Files to Modify**: `frontend/src/components/admin/BoardCard.jsx`
  - **Acceptance**: Card navigates via Link when `to` prop provided, onClick when not
  - **Status**: COMPLETE

### Phase 5: Styling & Polish

- [x] **T5.1**: Add board selection grid CSS to Home.css (30min)
  - **Dependencies**: T3.3
  - **Existing Pattern**: `AdminPanel.css` lines 102-106 (grid layout)
  - **Files to Modify**: `frontend/src/pages/Home.css`
  - **Acceptance**: Grid layout matches AdminPanel pattern, responsive design
  - **Status**: COMPLETE

- [x] **T5.2**: Ensure responsive layout for board selection (20min)
  - **Dependencies**: T5.1
  - **Existing Pattern**: `AdminPanel.css` lines 262-292 (responsive breakpoints)
  - **Files to Modify**: `frontend/src/pages/Home.css`
  - **Acceptance**: Grid adapts to mobile (1 col), tablet (2-3 col), desktop (4+ col)
  - **Status**: COMPLETE

- [x] **T5.3**: Style board selection section header (15min)
  - **Dependencies**: T3.3
  - **Existing Pattern**: `Home.css` section headers
  - **Files to Modify**: `frontend/src/pages/Home.css`
  - **Acceptance**: Section header styled consistently with Home page design
  - **Status**: COMPLETE

### Phase 6: Testing & Validation

- [ ] **T6.1**: Test board-specific URLs route correctly (20min)
  - **Test Type**: Manual navigation
  - **Acceptance**: `/BOARD_XXXX` URLs load dashboard filtered to that board
  - **Test Cases**: Valid board IDs, invalid board IDs, case sensitivity

- [ ] **T6.2**: Test board selection grid navigation (15min)
  - **Test Type**: Manual interaction
  - **Acceptance**: Clicking board cards navigates to correct board URLs
  - **Test Cases**: All boards in grid, offline boards, empty state

- [ ] **T6.3**: Test Dashboard auto-filtering from URL (15min)
  - **Test Type**: Manual verification
  - **Acceptance**: Dashboard shows only selected board's data when accessed via URL
  - **Test Cases**: Charts, stats, all data filtered correctly

- [ ] **T6.4**: Test board context display in Dashboard (10min)
  - **Test Type**: Manual verification
  - **Acceptance**: Header shows board name, "View All Boards" link works
  - **Test Cases**: Board name display, link navigation

- [ ] **T6.5**: Test invalid board ID handling (15min)
  - **Test Type**: Manual testing
  - **Acceptance**: Invalid board IDs show error or redirect gracefully
  - **Test Cases**: Non-existent board, malformed board ID

- [ ] **T6.6**: Test responsive layout on mobile/tablet/desktop (20min)
  - **Test Type**: Manual responsive testing
  - **Acceptance**: Board selection grid works on all screen sizes
  - **Test Cases**: Mobile (<640px), tablet (640-1024px), desktop (>1024px)

- [ ] **T6.7**: Test offline boards display correctly (15min)
  - **Test Type**: Manual verification
  - **Acceptance**: Offline boards show in grid with offline status
  - **Test Cases**: Offline board cards, status badges, no graph data

- [ ] **T6.8**: Verify no console errors or warnings (10min)
  - **Test Type**: Browser console inspection
  - **Acceptance**: No errors or warnings in console
  - **Test Cases**: All navigation paths, error states

## Pattern Reuse Strategy

### Components to Reuse
- **BoardCard** (`frontend/src/components/admin/BoardCard.jsx`)
  - **Modifications needed**: Add `public` prop, support Link navigation, hide admin features
  - **Usage**: Use in Home page board selection grid with public=true

- **AdminPanel Grid Layout** (`frontend/src/pages/AdminPanel.jsx` lines 103-119)
  - **Modifications needed**: Adapt CSS classes for Home page context
  - **Usage**: Reuse grid layout pattern in Home.css

### Code Patterns to Follow
- **React Router Dynamic Routes**: Follow existing route structure in App.jsx
- **URL Parameter Extraction**: Use useParams hook pattern
- **Device Filtering**: Follow Dashboard.jsx device filtering pattern
- **State Management**: Follow existing useState/useEffect patterns

## Execution Strategy

### Continuous Implementation Rules
1. **Execute todo items in dependency order**
2. **Go for maximum flow - complete as much as possible without interruption**  
3. **Group all ambiguous questions for batch resolution at the end**
4. **Reuse existing patterns and components wherever possible**
5. **Update progress continuously**
6. **Document any deviations from plan**

### Checkpoint Schedule
- **Phase 1-2 Complete**: Routing and Dashboard integration working
  - **Expected Completion**: ~1.5 hours
  - **Deliverables**: Board-specific URLs functional, Dashboard auto-filters
  - **Review Criteria**: URLs route correctly, filtering works

- **Phase 3-4 Complete**: Home page board selection functional
  - **Expected Completion**: ~3 hours
  - **Deliverables**: Board selection grid on home page
  - **Review Criteria**: Grid displays, cards link correctly

- **Phase 5-6 Complete**: Styling and testing complete
  - **Expected Completion**: ~4-6 hours total
  - **Deliverables**: Fully functional feature, tested and polished
  - **Review Criteria**: All requirements met, no errors

## Questions for Batch Resolution
- None identified at this time - proceed with implementation

## Progress Tracking

### Completed Items
- [ ] Update this section as items are completed
- [ ] Note any deviations or discoveries
- [ ] Record actual time vs estimates

### Blockers & Issues
- [ ] Document any blockers encountered
- [ ] Include resolution steps taken
- [ ] Note impact on timeline

### Discoveries & Deviations
- [ ] Document any plan changes needed
- [ ] Record new patterns or approaches discovered
- [ ] Note improvements to existing code

## Definition of Done
- [ ] All todo items completed
- [ ] Board-specific URLs route correctly
- [ ] Home page displays board selection grid
- [ ] Dashboard auto-filters from URL
- [ ] Board context displays in header
- [ ] All manual testing passes
- [ ] No console errors or warnings
- [ ] Responsive layout works on all devices
- [ ] Code follows existing patterns
- [ ] Feature ready for deployment

---
**Created:** 2024-12-19  
**Estimated Duration:** 4-6 hours  
**Implementation Start:** 2024-12-19  
**Target Completion:** 2024-12-19

