# board-specific-urls Feature Brief

## 🎯 Context (2min)
**Problem**: The current device filtering functionality uses a dropdown selection menu in the SettingsModal, which is clunky and hard to navigate. Users find it difficult to orient themselves when selecting boards. Additionally, there's no way to directly link to a specific board's dashboard, which prevents using QR codes on device boxes that would lead users directly to their device's dashboard.

**Users**: 
- End users accessing boards via QR codes printed on device boxes
- Users visiting the base URL who need to select a board
- Facility managers who want to bookmark specific board dashboards
- School administrators sharing board links with teachers

**Success**: 
1. Each board has its own unique URL (e.g., `https://cognitiv.onrender.com/BOARD_XXXX`)
2. Users visiting the base URL see an intuitive box-based board selection (similar to admin panel)
3. QR codes on device boxes link directly to that board's dashboard
4. Board-specific URLs automatically filter the dashboard to show only that board's data
5. Users can easily navigate between boards and share board-specific links

## 🔍 Quick Research (15min)
### Existing Patterns
- **AdminPanel BoardCard Grid** (`frontend/src/pages/AdminPanel.jsx` lines 103-119, `frontend/src/components/admin/BoardCard.jsx`) → Grid layout with `admin-page__devices-grid` using `repeat(auto-fill, minmax(250px, 1fr))`, BoardCard component with status badges, mini graphs, click handlers | Reuse: Grid layout pattern, BoardCard component structure, card styling
- **React Router Setup** (`frontend/src/App.jsx` lines 16-40) → BrowserRouter with nested Routes, catch-all route pattern `re_path(r'^(?!api/).*$')` in Django, route structure for `/`, `/dashboard`, `/admin` | Reuse: Route definition pattern, nested routing structure
- **Dashboard Device Filtering** (`frontend/src/pages/Dashboard.jsx` lines 40, 380-382, 696-702) → `selectedDevice` state, `SettingsModal` with device selection dropdown, device filtering via `deviceId` parameter in API calls | Reuse: Device filtering logic, API parameter passing
- **Public Device List API** (`frontend/src/services/api.js` lines 72-74, `frontend/src/pages/Dashboard.jsx` lines 65-83) → `dataAPI.getDevices()` returns array of device IDs, used for device selection dropdown | Reuse: API endpoint, data structure
- **BoardCard Component** (`frontend/src/components/admin/BoardCard.jsx`) → Compact card with device name, status badge, mini CO2 graph, current readings, offline handling, click handlers | Reuse: Component structure, styling patterns, status display
- **BoardCard CSS** (`frontend/src/components/admin/BoardCard.css`) → Card styling with hover effects, grid-friendly sizing, responsive design | Reuse: CSS classes, responsive breakpoints

### Tech Decision
**Approach**: React Router dynamic routes + BoardCard component reuse + URL parameter extraction
- **Why**: 
  - React Router already integrated and supports dynamic route parameters
  - BoardCard component exists and provides perfect box-based UI pattern
  - No backend changes needed - device filtering already supported via API parameters
  - Django catch-all route already handles all non-API routes, so new routes work automatically
  - Enables direct linking and QR code use case immediately
- **Avoid**: 
  - Creating new card component (reuse BoardCard pattern)
  - Backend route changes (frontend routing sufficient)
  - Query parameters instead of path parameters (less clean URLs)
  - Separate board selection page (integrate into Home page)

## ✅ Requirements (10min)

### Core Features

**R1: Board-Specific URL Routing**
- Add React Router route pattern `/BOARD_:boardId` that renders Dashboard component
- Route should match patterns like `/BOARD_ESP8266A2`, `/BOARD_XXXX`, etc.
- Extract `boardId` from URL parameters using React Router's `useParams()`
- Route should work alongside existing routes (`/`, `/dashboard`, `/admin`)
- **Acceptance**: Visiting `/BOARD_ESP8266A2` shows dashboard filtered to that board

**R2: Home Page Board Selection Grid**
- Replace or enhance Home page (`/`) to show box-based board selection
- Display boards in responsive grid layout (similar to AdminPanel's `admin-page__devices-grid`)
- Use BoardCard component or create public variant (`BoardSelectionCard`)
- Grid should show all available boards from public device list API
- Cards should be clickable and link to board-specific URLs
- **Acceptance**: Home page displays grid of board cards, clicking a card navigates to `/BOARD_XXXX`

**R3: Board Card Display on Home Page**
- Each board card shows: board name/ID, status (online/offline), current CO2 value (if available)
- Cards use same visual style as AdminPanel BoardCard (box-based, hover effects)
- Cards link to board-specific dashboard URLs
- Handle offline boards gracefully (show offline status, no graph data)
- **Acceptance**: Board cards display correctly with status and link to board dashboards

**R4: Dashboard URL-Based Filtering**
- Dashboard component reads `boardId` from URL parameters when on `/BOARD_:boardId` route
- Automatically set `selectedDevice` state to the board ID from URL
- Filter all data requests (charts, stats) to the specified board
- Display board name/context in dashboard header when viewing specific board
- **Acceptance**: Dashboard on `/BOARD_XXXX` automatically shows only that board's data

**R5: Board Context Display**
- Dashboard header shows which board is being viewed when accessed via board-specific URL
- Display board name/ID prominently in header
- Option to clear filter and view all boards (link back to `/dashboard`)
- **Acceptance**: Dashboard clearly indicates which board is selected when accessed via board URL

**R6: QR Code Support**
- Board-specific URLs are stable and can be printed on QR codes
- URLs work without authentication (public access)
- URLs are shareable and bookmarkable
- **Acceptance**: QR code linking to `/BOARD_XXXX` opens that board's dashboard correctly

## 🏗️ Implementation (5min)

### Components

**Frontend (React)**:
- `frontend/src/App.jsx` - Add new route:
  ```jsx
  <Route path="/BOARD_:boardId" element={<Dashboard />} />
  ```
  - Place before catch-all route to ensure proper matching
  - Extract boardId parameter in Dashboard component

- `frontend/src/pages/Home.jsx` - Refactor to show board selection:
  - Add state for devices list: `const [devices, setDevices] = useState([])`
  - Load devices on mount: `dataAPI.getDevices()`
  - Replace or add board selection grid section
  - Use BoardCard component or create `BoardSelectionCard` variant
  - Cards link to `/BOARD_${deviceId}` using React Router `Link` or `useNavigate`

- `frontend/src/pages/Dashboard.jsx` - Handle URL-based board filtering:
  - Import `useParams` from `react-router-dom`
  - Extract boardId: `const { boardId } = useParams()`
  - Set `selectedDevice` from URL: `useEffect(() => { if (boardId) setSelectedDevice(boardId) }, [boardId])`
  - Display board context in header when `boardId` is present
  - Add "View All Boards" link when viewing specific board

- `frontend/src/components/public/BoardSelectionCard.jsx` (NEW) - Public board card:
  - Similar to `BoardCard` but simplified for public use
  - Props: `deviceId`, `status`, `currentCo2` (optional), `onClick` or `to` (Link)
  - Shows board name, status badge, current CO2 if available
  - Links to `/BOARD_${deviceId}` route
  - Or: Reuse `BoardCard` with public-friendly props

- `frontend/src/pages/Home.css` - Add board selection grid styles:
  - Grid layout: `display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: var(--md3-spacing-4);`
  - Reuse AdminPanel grid pattern

### APIs

**Existing Endpoints Used**:
- `GET /api/devices` - Public device list (returns array of device IDs)
- `GET /api/data?device_id={boardId}` - Filtered data (existing)
- `GET /api/stats?device_id={boardId}` - Filtered stats (existing)
- `GET /api/history/series?device_id={boardId}` - Filtered history (existing)

**No New Endpoints Required**:
- All device filtering already supported via `device_id` query parameter
- Public device list endpoint already exists

### Data Changes
- No database schema changes
- No API response structure changes
- Device IDs from public API used directly in URLs
- URL format: `/BOARD_{device_id}` where `device_id` matches API device IDs

### Routing Structure
```
/                    → Home (board selection grid)
/dashboard           → Dashboard (all boards, or last selected)
/BOARD_XXXX          → Dashboard (filtered to BOARD_XXXX)
/BOARD_ESP8266A2     → Dashboard (filtered to ESP8266A2)
/admin               → AdminPanel (existing)
```

## 📋 Next Actions (2min)
- [ ] Add React Router route for `/BOARD_:boardId` pattern in `App.jsx` (15min)
- [ ] Update `Dashboard.jsx` to extract `boardId` from URL params and auto-filter (30min)
- [ ] Add board context display in Dashboard header when viewing specific board (20min)
- [ ] Refactor `Home.jsx` to load and display board list from API (30min)
- [ ] Create board selection grid on Home page using BoardCard pattern (45min)
- [ ] Create `BoardSelectionCard` component or adapt `BoardCard` for public use (45min)
- [ ] Add CSS styling for board selection grid on Home page (30min)
- [ ] Test board-specific URLs work correctly (20min)
- [ ] Test board selection grid navigation (15min)
- [ ] Test QR code links to board dashboards (15min)
- [ ] Verify offline boards display correctly in selection grid (15min)
- [ ] Test responsive layout on mobile/tablet (20min)

**Start Coding In**: ~4-6 hours total implementation time

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

### Route Matching Priority
React Router matches routes in order, so the board-specific route must come before the catch-all:
```jsx
<Route path="/BOARD_:boardId" element={<Dashboard />} />
<Route path="/dashboard" element={<Dashboard />} />
<Route path="*" element={<Navigate to="/" replace />} />
```

### Board ID Validation
- Board IDs come from `dataAPI.getDevices()` response
- Should validate board ID exists before rendering dashboard
- Handle invalid board IDs gracefully (404 or redirect to home)

### BoardCard Component Reuse Strategy
**Option 1**: Create public variant `BoardSelectionCard`
- Simplified version without admin features (rename button, etc.)
- Public-friendly styling
- Links to board URLs

**Option 2**: Reuse existing `BoardCard` with conditional props
- Add `public` prop to hide admin features
- Use `onClick` or `Link` component for navigation
- Simpler maintenance (single component)

**Recommendation**: Option 2 (reuse with props) for consistency and less code duplication.

### URL Format Considerations
- Board IDs may contain special characters - ensure URL encoding
- Board IDs are case-sensitive - maintain exact casing from API
- Consider URL validation to prevent invalid board IDs

### Home Page Layout
Current Home page has hero section, CO2 status, mission section. Options:
1. **Replace entirely** with board selection grid
2. **Add board selection** as new section above/below existing content
3. **Make board selection** the primary content, keep other sections below

**Recommendation**: Option 2 or 3 - keep existing content but make board selection prominent.

### Dashboard Board Context Display
When viewing specific board via URL:
- Show board name/ID in header: "Dashboard - BOARD_XXXX"
- Add breadcrumb or back link: "← View All Boards" or "← Back to Board Selection"
- Optionally disable device filter in SettingsModal (or show as read-only)

### QR Code Implementation
- QR codes should link to full URL: `https://cognitiv.onrender.com/BOARD_XXXX`
- Ensure URLs work without authentication
- Test QR codes on actual device boxes
- Consider adding QR code generation tool in admin panel for easy printing

### Error Handling
- Invalid board ID in URL → Show error message or redirect to home
- Board not found in device list → Show "Board not found" message
- Network error loading devices → Show error state with retry option
- Offline boards → Display gracefully with offline status

### Performance Considerations
- Board selection grid should load devices efficiently
- Consider caching device list to avoid repeated API calls
- Lazy load board cards if many devices exist
- Optimize BoardCard rendering for large device lists

### Testing Checklist
- [ ] Board-specific URLs route correctly
- [ ] Dashboard filters to correct board when accessed via URL
- [ ] Home page displays board selection grid
- [ ] Board cards link to correct board URLs
- [ ] Board context displays in dashboard header
- [ ] QR codes work correctly (test with actual QR code scanner)
- [ ] Invalid board IDs handled gracefully
- [ ] Offline boards display correctly in selection grid
- [ ] Responsive layout works on mobile/tablet/desktop
- [ ] Navigation between boards works smoothly
- [ ] "View All Boards" link works correctly
- [ ] Board selection persists when navigating back from dashboard


