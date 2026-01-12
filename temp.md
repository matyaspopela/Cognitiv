# Temporary Documentation Archive

This file consolidates documentation that was removed from the repository during cleanup.
Review and organize these sections as needed.

---

# SECTION 1: Design Audit & Redesign Proposal
## (Originally: DESIGN_AUDIT_AND_REDESIGN.md)

**Date:** January 2025  
**Scope:** Complete visual redesign for modern, usable, clean interface

### Executive Summary

Overall Assessment: 5/10
- Strengths: Well-structured codebase, functional components, decent component library
- Weaknesses: Inconsistent design language, poor visual hierarchy, lack of modern aesthetics, accessibility issues

### Critical Design Issues Identified

1. **Inconsistent Design Language** - Glassmorphism defined but not used
2. **Poor Visual Hierarchy** - Too many competing elements
3. **Navigation Problems** - Mobile menu uses text characters instead of icons
4. **Color System Misuse** - Most pages use only grays and white
5. **Typography Inconsistencies** - Hierarchy not well established
6. **Spacing Inconsistencies** - Excessive padding in some areas
7. **Interactive Element Issues** - Focus states may not meet WCAG
8. **Responsive Design Flaws** - Arbitrary breakpoints
9. **Bland Visual Aesthetics** - Overwhelmingly white backgrounds
10. **Component-Specific Issues** - Various per-component problems

### Redesign Principles

1. Cohesive Design System
2. Clear Visual Hierarchy
3. Modern Aesthetics
4. Accessibility First
5. Purposeful Color
6. Responsive Excellence
7. Micro-interactions
8. Information Density

### Implementation Priority

Phase 1 (Week 1): Navigation, backgrounds, home page hero, colors
Phase 2 (Week 2): Dashboard layout, device cards, typography, micro-interactions
Phase 3 (Week 3): Spacing, accessibility, performance, cross-browser testing

---

# SECTION 2: Linear-Inspired Redesign Summary
## (Originally: LINEAR_REDESIGN_SUMMARY.md)

**Date:** January 2025  
**Design Inspiration:** Linear.app  
**Status:** Phase 1 Complete

### Completed Components

1. Design Tokens System - Complete overhaul
2. Navigation Bar - Clean, minimal design
3. Home Page - Single focal point hero
4. Dashboard - Enhanced card layouts
5. Components - Cards, Buttons, Text Fields, DashboardBox
6. Login Page - Clean card design

### Key Design Changes

**Color System:**
- Before: Vibrant blues, teals, purples with gradients
- After: Subtle desaturated blues, clean neutrals
- Primary: #5B6FF5 (Linear-style blue)

**Typography:**
- Font Stack: System fonts (-apple-system, Inter, Roboto)
- Sizes: 48px hero, 28px titles, 16px body

**Animations:**
- Faster: 100-200ms (was 250-350ms)
- Easing: easeOut for snappy feel

### Remaining Work

1. Icons - Replace text characters with proper icon library
2. Mobile Navigation Drawer improvements
3. Accessibility Audit
4. Component Polish (Badge, Progress bars, Select, Modal)
5. Dashboard Enhancements (loading skeletons, empty states)
6. Responsive Design verification

---

# SECTION 3: MQTT Testing Guide
## (Originally: README_MQTT_TEST.md)

### Prerequisites

```bash
pip install paho-mqtt
```

### Test Scripts

1. **Publisher Test** - Simulates ESP8266 publishing sensor data
2. **Subscriber Test** - Listens to MQTT topic to verify messages

### Testing Workflow

1. Test Publisher (Verify Connection)
2. Test Subscriber (Verify Reception)
3. Verify in HiveMQ Console
4. Hardware Test

### Troubleshooting

- Connection Failed (code 4): Bad username or password
- Connection Failed (code 3): Server unavailable or network issue
- SSL/TLS Errors: Certificate validation issue
- No Messages Received: Topic mismatch or QoS issue

### Payload Format

```json
{
  "timestamp": 1699012345,
  "device_id": "ESP8266A2",
  "mac_address": "AA:BB:CC:DD:EE:FF",
  "temperature": 22.50,
  "humidity": 45.20,
  "co2": 650,
  "voltage": 3.85
}
```

### Validation Rules

- Required fields: timestamp, device_id, temperature, humidity, co2
- Temperature range: -10°C to 50°C
- Humidity range: 0% to 100%
- CO2 range: 400 to 5000 ppm

---

# SECTION 4: MQTT Server Subscriber
## (Originally: server/README_MQTT_SERVER.md)

### Architecture

```
ESP8266 → MQTT Publish → HiveMQ Broker → Django Subscriber → MongoDB
```

### Setup

1. Install dependencies: `pip install -r requirements.txt`
2. Configure environment variables (MQTT_BROKER_HOST, MQTT_BROKER_PORT, MQTT_USERNAME, MQTT_PASSWORD, MQTT_TOPIC)

### Running the Subscriber

Development: `python manage.py mqtt_subscriber`

Production: Run as background process or systemd service

### How It Works

1. Connection: Subscribes to MQTT broker
2. Message Reception: Receives JSON payloads
3. Processing: Reuses receive_data() view function
4. Logging: Displays status for each message

---

# SECTION 5: Design Tokens Documentation
## (Originally: frontend/src/design/TOKENS.md)

### Colors

**Primary (Subtle Desaturated Blue):**
- Primary-500: #5B6FF5 (Main primary)
- Primary-600: #4F56E8 (Hover)

**Secondary (Neutral Blue-Gray):**
- Secondary-500: #ADB5BD

**Accent (Subtle Teal):**
- Accent-500: #14B8A6

**Surface Colors:**
- surface-default: #FFFFFF
- surface-variant: #FAFBFC
- surface-hover: #F8F9FA

**Text Colors:**
- text-primary: #16181C
- text-secondary: #586169
- text-tertiary: #8B949E

**Status Colors:**
- Success-500: #22C55E
- Error-500: #EF4444
- Warning-500: #F59E0B
- Info-500: #3B82F6

### Typography

**Font Families:** System stack (Inter/Roboto fallback)

**Font Sizes:**
- Display: 48px, 40px, 32px
- Headline: 28px, 24px, 20px
- Title: 18px, 16px, 14px
- Body: 16px, 14px, 13px
- Label: 14px, 13px, 12px

**Font Weights:** 400 (regular), 500 (medium), 600 (semiBold), 700 (bold)

### Spacing (4px base grid)

- spacing-1: 4px
- spacing-2: 8px
- spacing-3: 12px
- spacing-4: 16px
- spacing-5: 20px
- spacing-6: 24px
- spacing-8: 32px
- spacing-10: 40px
- spacing-12: 48px

### Border Radius

- xs: 4px
- sm: 6px
- md: 8px (Most common)
- lg: 12px
- xl: 16px
- 2xl: 20px
- full: 9999px

### Elevation (Subtle shadows - Linear style)

- elevation-0: none
- elevation-1: Minimal shadow
- elevation-2: Light shadow (cards, buttons)
- elevation-3: Medium shadow (hover states)
- elevation-4: Strong shadow (modals)
- elevation-5: Maximum shadow (overlays)

### Animation

**Duration:**
- fast: 100ms
- normal: 200ms
- slow: 300ms
- slower: 400ms

**Easing:**
- easeOut: cubic-bezier(0, 0, 0.2, 1) (Most common)

### Z-Index Scale

- dropdown: 1000
- sticky: 1020
- fixed: 1030
- modal-backdrop: 1040
- modal: 1050
- popover: 1060
- tooltip: 1070

---

*This file was auto-generated during repository cleanup on January 2025.*
*Credentials have been removed from this documentation.*
