# Specification: Dashboard Overview Statistics

## Feature Overview

Add a general overview/statistics section to the main dashboard page (box grid view) that provides at-a-glance insights across all devices before users drill into individual device details.

## Context

**Problem**: The dashboard box grid view currently only shows individual device cards. Users need an overview section showing aggregate statistics across all devices to get a quick sense of overall system status and health.

**Users**: 
- Facility managers monitoring multiple devices
- Users wanting quick overview before selecting specific devices
- Stakeholders reviewing overall air quality status

**Success**: 
1. Dashboard displays overview statistics section above the device box grid
2. Statistics show aggregated data across all devices
3. Statistics update dynamically based on available device data
4. Overview provides actionable insights at a glance

## Requirements

### R1: Overview Statistics Section
- Display overview statistics in a horizontal card/section above the device box grid
- Only visible when on the main dashboard view (not in device detail view)
- Statistics should include:
  - Total number of devices
  - Number of online devices
  - Number of offline devices
  - Average/current CO2 concentration across all devices
  - Total data points collected across all devices
  - Overall air quality status (based on average CO2)

### R2: Statistics Display Format
- Use Card component with horizontal layout
- Display statistics in a visually organized grid/flex layout
- Each statistic should have:
  - Label (e.g., "Celkem zařízení")
  - Value (e.g., "5")
  - Optional: Small icon or indicator
  - Optional: Color coding for status indicators

### R3: Data Aggregation
- Fetch aggregate statistics using existing API endpoints:
  - `dataAPI.getStatus()` for total data points
  - `dataAPI.getStats()` without device_id for overall stats
  - Device list for online/offline counts
- Calculate averages across all devices when applicable
- Handle cases where no devices or no data available

### R4: Visual Design
- Statistics section should be visually distinct but complementary to device boxes
- Use consistent design tokens from existing components
- Responsive layout (stacks vertically on mobile)
- Loading states while fetching statistics

### R5: Real-time Updates
- Statistics should reflect current device status
- Update when device list changes
- Handle offline devices gracefully in calculations

## Technical Approach

### Component Structure
- Create `DashboardOverview` component for statistics display
- Integrate into `Dashboard.jsx` above the box grid
- Reuse existing Card, Badge components
- Follow existing Dashboard CSS patterns

### Data Fetching
- Fetch overall stats using `dataAPI.getStats(24)` without device_id
- Fetch device list for device counts
- Fetch status using `dataAPI.getStatus()` for total data points
- Parallel API calls for efficiency

### Calculations
- Online/Offline count: Count devices with status 'online' vs 'offline'
- Average CO2: Calculate from stats.co2.avg if available
- Overall air quality: Determine status based on average CO2 thresholds:
  - Good: < 1000 ppm
  - Moderate: 1000-1500 ppm
  - High: 1500-2000 ppm
  - Critical: > 2000 ppm

## Acceptance Criteria

1. Overview statistics section displays above device box grid
2. All statistics show correct aggregated values
3. Statistics update when devices change status
4. Loading states display while fetching
5. Empty states handled gracefully (no devices, no data)
6. Responsive layout works on all screen sizes
7. Design is consistent with existing dashboard style









