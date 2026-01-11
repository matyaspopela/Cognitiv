# Design Tokens Documentation

**Cognitiv Design System - Linear/Apple Inspired**

This document provides a complete reference for all design tokens used in the Cognitiv frontend. All tokens follow a Linear.app-inspired aesthetic: minimal, clean, and professional.

## Table of Contents

- [Colors](#colors)
- [Typography](#typography)
- [Spacing](#spacing)
- [Border Radius](#border-radius)
- [Elevation](#elevation)
- [Animation](#animation)
- [Z-Index](#z-index)
- [Usage Guidelines](#usage-guidelines)

---

## Colors

### Primary Colors (Subtle Desaturated Blue)

Linear-style primary color palette. Use for interactive elements, links, and primary actions.

```css
/* CSS Variable Usage */
.element {
  background-color: var(--md3-color-primary-500);
  color: var(--md3-color-primary-700);
}

/* JS Usage */
import { colors } from '../design/tokens'
const primaryColor = colors.primary[500] // '#5B6FF5'
```

**Palette:**
- `--md3-color-primary-50`: `#F0F4FF` (lightest)
- `--md3-color-primary-100`: `#E0E9FF`
- `--md3-color-primary-200`: `#C7D7FE`
- `--md3-color-primary-300`: `#A5B8FC`
- `--md3-color-primary-400`: `#818CF8`
- `--md3-color-primary-500`: `#5B6FF5` ⭐ **Main primary**
- `--md3-color-primary-600`: `#4F56E8`
- `--md3-color-primary-700`: `#4445D1`
- `--md3-color-primary-800`: `#3A3BB0`
- `--md3-color-primary-900`: `#333492` (darkest)

**Usage:**
- Primary actions (buttons, links)
- Interactive elements
- Focus states
- Active states

---

### Secondary Colors (Neutral Blue-Gray)

Neutral palette for backgrounds, borders, and secondary elements.

**Palette:**
- `--md3-color-secondary-50`: `#F8F9FA`
- `--md3-color-secondary-100`: `#F1F3F5`
- `--md3-color-secondary-200`: `#E9ECEF`
- `--md3-color-secondary-300`: `#DEE2E6`
- `--md3-color-secondary-400`: `#CED4DA`
- `--md3-color-secondary-500`: `#ADB5BD` ⭐ **Main secondary**
- `--md3-color-secondary-600`: `#868E96`
- `--md3-color-secondary-700`: `#495057`
- `--md3-color-secondary-800`: `#343A40`
- `--md3-color-secondary-900`: `#212529`

**Usage:**
- Secondary buttons
- Disabled states
- Subtle backgrounds
- Borders (lighter shades)

---

### Accent Colors (Subtle Teal)

Accent color for highlights, notifications, and special emphasis.

**Palette:**
- `--md3-color-accent-50`: `#F0FDFA`
- `--md3-color-accent-500`: `#14B8A6` ⭐ **Main accent**
- `--md3-color-accent-700`: `#0F766E`

**Usage:**
- Highlights
- Special notifications
- Secondary actions
- Decorative elements

---

### Surface Colors

Background colors for surfaces, cards, and elevated elements.

```css
.card {
  background-color: var(--md3-color-surface-default);
}

.card:hover {
  background-color: var(--md3-color-surface-hover);
}
```

**Tokens:**
- `--md3-color-surface-default`: `#FFFFFF` - Default surface (cards, panels)
- `--md3-color-surface-variant`: `#FAFBFC` - Alternative surface
- `--md3-color-surface-dim`: `#F5F6F7` - Dimmed surface
- `--md3-color-surface-dark`: `#E9EAEB` - Darker surface
- `--md3-color-surface-hover`: `#F8F9FA` - Hover state

**Background Tokens:**
- `--md3-color-background-default`: `#FFFFFF` - Main page background
- `--md3-color-background-secondary`: `#FAFBFC` - Secondary background
- `--md3-color-background-tertiary`: `#F5F6F7` - Tertiary background
- `--md3-color-background-paper`: `#FFFFFF` - Paper/card background

---

### Text Colors

Text color palette for different hierarchy levels.

```css
.heading {
  color: var(--md3-color-text-primary);
}

.description {
  color: var(--md3-color-text-secondary);
}
```

**Tokens:**
- `--md3-color-text-primary`: `#16181C` - Main text (headings, body)
- `--md3-color-text-secondary`: `#586169` - Secondary text (descriptions, hints)
- `--md3-color-text-tertiary`: `#8B949E` - Tertiary text (metadata, captions)
- `--md3-color-text-disabled`: `#9CA3AF` - Disabled text
- `--md3-color-text-hint`: `#6B7280` - Placeholder/hint text
- `--md3-color-text-onDark`: `#FFFFFF` - Text on dark backgrounds

**Usage Guidelines:**
- Primary: Headings, important content
- Secondary: Descriptions, supporting text
- Tertiary: Metadata, timestamps, labels
- Disabled: Inactive form fields, disabled buttons

---

### Status Colors

Colors for feedback states: success, warning, error, info.

```css
.success-message {
  color: var(--md3-color-success-700);
  background-color: var(--md3-color-success-50);
}

.error-message {
  color: var(--md3-color-error-700);
  background-color: var(--md3-color-error-50);
}
```

**Success:**
- `--md3-color-success-50`: `#F0FDF4`
- `--md3-color-success-500`: `#22C55E`
- `--md3-color-success-700`: `#15803D`

**Error:**
- `--md3-color-error-50`: `#FEF2F2`
- `--md3-color-error-500`: `#EF4444`
- `--md3-color-error-700`: `#B91C1C`

**Warning:**
- `--md3-color-warning-50`: `#FFFBEB`
- `--md3-color-warning-500`: `#F59E0B`
- `--md3-color-warning-700`: `#B45309`

**Info:**
- `--md3-color-info-50`: `#EFF6FF`
- `--md3-color-info-500`: `#3B82F6`
- `--md3-color-info-700`: `#1D4ED8`

---

### Border Colors

Border colors for subtle separation and focus states.

```css
.card {
  border: 1px solid var(--md3-color-border);
}

.input:focus {
  border-color: var(--md3-color-border-focus);
}
```

**Tokens:**
- `--md3-color-border`: `#E5E7EB` - Default border
- `--md3-color-border-light`: `#F3F4F6` - Light border
- `--md3-color-border-medium`: `#D1D5DB` - Medium border
- `--md3-color-border-dark`: `#9CA3AF` - Dark border
- `--md3-color-border-focus`: `#5B6FF5` - Focus state border (primary)

---

## Typography

### Font Families

System font stack optimized for all platforms.

```css
body {
  font-family: var(--md3-font-family-primary);
}

h1 {
  font-family: var(--md3-font-family-display);
}

code {
  font-family: var(--md3-font-family-mono);
}
```

**Tokens:**
- `--md3-font-family-primary`: System stack (Inter/Roboto fallback)
- `--md3-font-family-display`: Display font (headings)
- `--md3-font-family-mono`: Monospace (code, data)

**Note:** Uses system fonts for best performance and native feel (Linear/Apple style).

---

### Font Sizes

Typography scale following Linear's clean hierarchy.

```css
h1 {
  font-size: var(--md3-font-size-display-small);
  line-height: var(--md3-line-height-tight);
}

p {
  font-size: var(--md3-font-size-body-medium);
  line-height: var(--md3-line-height-normal);
}
```

**Display (Hero/Page Titles):**
- `--md3-font-size-display-large`: `48px`
- `--md3-font-size-display-medium`: `40px`
- `--md3-font-size-display-small`: `32px`

**Headline (Section Titles):**
- `--md3-font-size-headline-large`: `28px`
- `--md3-font-size-headline-medium`: `24px`
- `--md3-font-size-headline-small`: `20px`

**Title (Card/Component Titles):**
- `--md3-font-size-title-large`: `18px`
- `--md3-font-size-title-medium`: `16px`
- `--md3-font-size-title-small`: `14px`

**Body (Content Text):**
- `--md3-font-size-body-large`: `16px`
- `--md3-font-size-body-medium`: `14px` ⭐ **Default**
- `--md3-font-size-body-small`: `13px`

**Label (Buttons, Captions):**
- `--md3-font-size-label-large`: `14px`
- `--md3-font-size-label-medium`: `13px`
- `--md3-font-size-label-small`: `12px`

---

### Font Weights

```css
.heading {
  font-weight: var(--md3-font-weight-bold);
}

.button {
  font-weight: var(--md3-font-weight-semiBold);
}
```

**Tokens:**
- `--md3-font-weight-regular`: `400`
- `--md3-font-weight-medium`: `500`
- `--md3-font-weight-semiBold`: `600`
- `--md3-font-weight-bold`: `700`

---

### Line Heights

```css
.heading {
  line-height: var(--md3-line-height-tight);
}

.body-text {
  line-height: var(--md3-line-height-normal);
}

.long-form {
  line-height: var(--md3-line-height-relaxed);
}
```

**Tokens:**
- `--md3-line-height-tight`: `1.25` - Headings
- `--md3-line-height-normal`: `1.5` - Body text (default)
- `--md3-line-height-relaxed`: `1.75` - Long-form content

---

## Spacing

4px base grid system for consistent spacing.

```css
.card {
  padding: var(--md3-spacing-6);
  margin-bottom: var(--md3-spacing-4);
}

.flex-gap {
  gap: var(--md3-spacing-3);
}
```

**Scale:**
- `--md3-spacing-0`: `0px`
- `--md3-spacing-1`: `4px`
- `--md3-spacing-2`: `8px`
- `--md3-spacing-3`: `12px`
- `--md3-spacing-4`: `16px`
- `--md3-spacing-5`: `20px`
- `--md3-spacing-6`: `24px`
- `--md3-spacing-8`: `32px`
- `--md3-spacing-10`: `40px`
- `--md3-spacing-12`: `48px`
- `--md3-spacing-16`: `64px`
- `--md3-spacing-20`: `80px`
- `--md3-spacing-24`: `96px`

**Usage Guidelines:**
- Use spacing tokens for all margins, padding, gaps
- Follow 4px grid (multiples of 4)
- Maintain consistent spacing hierarchy

---

## Border Radius

Subtle, minimal border radius following Linear style.

```css
.card {
  border-radius: var(--md3-border-radius-md);
}

.button {
  border-radius: var(--md3-border-radius-md);
}

.rounded-full {
  border-radius: var(--md3-border-radius-full);
}
```

**Tokens:**
- `--md3-border-radius-none`: `0px`
- `--md3-border-radius-xs`: `4px`
- `--md3-border-radius-sm`: `6px`
- `--md3-border-radius-md`: `8px` ⭐ **Most common**
- `--md3-border-radius-lg`: `12px`
- `--md3-border-radius-xl`: `16px`
- `--md3-border-radius-2xl`: `20px`
- `--md3-border-radius-full`: `9999px` - Pills, badges

**Usage:**
- Cards, panels: `md` or `lg`
- Buttons: `md`
- Badges, chips: `full`
- Subtle corners: `sm` or `xs`

---

## Elevation

Subtle shadows for depth (Linear style - very minimal).

```css
.card {
  box-shadow: var(--md3-elevation-2);
}

.modal {
  box-shadow: var(--md3-elevation-5);
}
```

**Tokens:**
- `--md3-elevation-0`: `none` - No shadow
- `--md3-elevation-1`: Minimal shadow (subtle elevation)
- `--md3-elevation-2`: Light shadow (cards, buttons)
- `--md3-elevation-3`: Medium shadow (hover states)
- `--md3-elevation-4`: Strong shadow (modals, dropdowns)
- `--md3-elevation-5`: Maximum shadow (overlays)

**Usage Guidelines:**
- Use sparingly (Linear aesthetic is flat)
- Elevation 2 for most cards
- Higher elevations for modals, dropdowns
- Avoid heavy shadows

---

## Animation

Fast, responsive animations following Linear's snappy feel.

```css
.button {
  transition: all var(--md3-animation-fast) var(--md3-easing-easeOut);
}

.fade-in {
  animation: fadeIn var(--md3-animation-normal) var(--md3-easing-easeOut);
}
```

### Duration

- `--md3-animation-fast`: `100ms` - Instant feedback (hover, active)
- `--md3-animation-normal`: `200ms` ⭐ **Standard** - Most transitions
- `--md3-animation-slow`: `300ms` - Smooth transitions
- `--md3-animation-slower`: `400ms` - Deliberate animations

### Easing

- `--md3-easing-ease`: `cubic-bezier(0.4, 0, 0.2, 1)` - Standard
- `--md3-easing-easeOut`: `cubic-bezier(0, 0, 0.2, 1)` ⭐ **Most common** - Linear style
- `--md3-easing-easeIn`: `cubic-bezier(0.4, 0, 1, 1)`
- `--md3-easing-easeInOut`: `cubic-bezier(0.4, 0, 0.2, 1)`
- `--md3-easing-spring`: `cubic-bezier(0.68, -0.55, 0.265, 1.55)` - Bouncy (rare)

**Usage:**
- Hover/active states: `fast` + `easeOut`
- Theme switching: `normal` + `easeOut`
- Page transitions: `slow` + `easeOut`
- Keep animations fast and responsive (Linear philosophy)

---

## Z-Index

Organized z-index scale for layering.

```css
.navigation {
  z-index: var(--md3-z-index-fixed);
}

.modal {
  z-index: var(--md3-z-index-modal);
}
```

**Scale:**
- `--md3-z-index-dropdown`: `1000`
- `--md3-z-index-sticky`: `1020`
- `--md3-z-index-fixed`: `1030` - Navigation, headers
- `--md3-z-index-modal-backdrop`: `1040`
- `--md3-z-index-modal`: `1050` - Modals, dialogs
- `--md3-z-index-popover`: `1060`
- `--md3-z-index-tooltip`: `1070` - Tooltips (top layer)

**Usage:**
- Never use hardcoded z-index values
- Always use tokens
- Maintain clear hierarchy

---

## Usage Guidelines

### CSS Variables (Preferred)

**Always use CSS variables in stylesheets:**

```css
/* ✅ Correct */
.button {
  background-color: var(--md3-color-primary-500);
  padding: var(--md3-spacing-4) var(--md3-spacing-6);
  border-radius: var(--md3-border-radius-md);
  font-size: var(--md3-font-size-body-medium);
}

/* ❌ Incorrect */
.button {
  background-color: #5B6FF5;
  padding: 16px 24px;
  border-radius: 8px;
}
```

### JavaScript/React (When Needed)

Use JS export only when you need programmatic access:

```jsx
// ✅ Correct - when you need JS access
import { colors, spacing } from '../design/tokens'

const dynamicColor = isActive ? colors.primary[500] : colors.secondary[500]
const dynamicPadding = spacing[6]

// ❌ Avoid - prefer CSS variables
// Use inline styles only when absolutely necessary
```

### Theme Compatibility

All tokens are designed to work with dark mode (coming in task-001-2):

```css
/* Tokens automatically switch with [data-theme="dark"] */
.card {
  background-color: var(--md3-color-surface-default);
  color: var(--md3-color-text-primary);
  /* Works in both light and dark themes */
}
```

### Best Practices

1. **Always use tokens** - Never hardcode colors, spacing, or other values
2. **CSS variables first** - Use CSS variables in stylesheets
3. **Consistent spacing** - Follow 4px grid system
4. **Subtle shadows** - Keep elevations minimal (Linear aesthetic)
5. **Fast animations** - Use fast/normal durations, easeOut easing
6. **System fonts** - Let the browser use system fonts for native feel

### Migration from Old Tokens

If migrating from `tokens.js` (glassmorphism):

1. Replace gradient backgrounds with solid surface colors
2. Replace glassmorphism effects with solid backgrounds + subtle borders
3. Update color values to match Linear palette
4. Remove transparency-based backgrounds (use surface tokens)
5. Update border radius (less rounded in Linear style)

---

## Source Files

- **Primary Source:** `frontend/src/design/tokens.css` (CSS variables)
- **JS Export:** `frontend/src/design/tokens.js` (aligned with CSS)
- **Documentation:** This file (`TOKENS.md`)

## References

- [Linear.app](https://linear.app/) - Design inspiration
- [Apple Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/) - System integration

---

**Last Updated:** 2025-01-27  
**Maintained by:** Cognitiv Design System





