/**
 * DataLab High-Fidelity Dark Mode Design Tokens
 * Updated 2026-02-02 for DataLab Overhaul
 */

// Base Color Palette - High-Fidelity Dark Mode
export const colors = {
  // Base Backgrounds
  base: {
    background: '#0B0E14',          // Deep Charcoal (replaces Zinc 950)
    surface: '#151921',             // Navy-tinted Gray (replaces Zinc 900)
    surfaceGlass: 'rgba(21, 25, 33, 0.6)',  // For glassmorphism
  },

  // Borders & Dividers
  borders: {
    subtle: 'rgba(61, 70, 83, 0.2)',   // Cyan-tinted Slate
    medium: 'rgba(61, 70, 83, 0.4)',
    strong: 'rgba(61, 70, 83, 0.6)',
  },

  // Interactive Accent Colors
  accent: {
    primary: '#6366F1',        // Electric Indigo
    secondary: '#06B6D4',      // Vivid Cyan
    hover: '#7C7FF5',          // Lightened Indigo
    focus: 'rgba(99, 102, 241, 0.4)',  // Indigo with opacity for rings
  },

  // Semantic CO2 Colors (Traffic Light System)
  semantic: {
    safe: {
      color: '#10B981',        // Emerald (< 800 ppm)
      glow: 'rgba(16, 185, 129, 0.3)',
      background: 'rgba(16, 185, 129, 0.1)',
    },
    warning: {
      color: '#F59E0B',        // Amber (800-1200 ppm)
      glow: 'rgba(245, 158, 11, 0.3)',
      background: 'rgba(245, 158, 11, 0.1)',
    },
    critical: {
      color: '#EF4444',        // Crimson (> 1200 ppm)
      glow: 'rgba(239, 68, 68, 0.4)',
      background: 'rgba(239, 68, 68, 0.1)',
    },
  },

  // Typography
  text: {
    primary: '#F9FAFB',        // Near white
    secondary: '#D1D5DB',      // Light gray
    tertiary: '#9CA3AF',       // Medium gray
    disabled: '#6B7280',       // Dark gray
  },

  // Status colors (for general UI, not CO2-specific)
  status: {
    error: {
      color: '#EF4444',
      background: 'rgba(239, 68, 68, 0.1)',
    },
    success: {
      color: '#10B981',
      background: 'rgba(16, 185, 129, 0.1)',
    },
    warning: {
      color: '#F59E0B',
      background: 'rgba(245, 158, 11, 0.1)',
    },
    info: {
      color: '#06B6D4',
      background: 'rgba(6, 182, 212, 0.1)',
    },
  },
}

// Glassmorphism elevation system
export const elevation = {
  0: 'none',
  1: '0px 4px 6px -1px rgba(0, 0, 0, 0.1), 0px 2px 4px -1px rgba(0, 0, 0, 0.06)',
  2: '0px 10px 15px -3px rgba(0, 0, 0, 0.1), 0px 4px 6px -2px rgba(0, 0, 0, 0.05)',
  3: '0px 20px 25px -5px rgba(0, 0, 0, 0.1), 0px 10px 10px -5px rgba(0, 0, 0, 0.04)',
  4: '0px 25px 50px -12px rgba(0, 0, 0, 0.25)',
  5: '0px 30px 60px -12px rgba(0, 0, 0, 0.3)',
}

// Glassmorphism backdrop blur
export const glass = {
  light: 'blur(10px)',
  medium: 'blur(12px)',
  strong: 'blur(16px)',
}

// Typography scale - Technical yet Accessible
export const typography = {
  fontFamily: {
    ui: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    data: "'JetBrains Mono', 'Courier New', monospace",
    display: "'Inter', sans-serif",
  },

  fontSize: {
    display: {
      large: '57px',
      medium: '45px',
      small: '36px',
    },
    headline: {
      large: '32px',
      medium: '28px',
      small: '24px',
    },
    title: {
      large: '22px',
      medium: '16px',
      small: '14px',
    },
    body: {
      large: '16px',
      medium: '14px',
      small: '12px',
    },
    label: {
      large: '14px',
      medium: '12px',
      small: '11px',
    },
  },

  fontWeight: {
    regular: 400,
    medium: 500,
    semiBold: 600,
    bold: 700,
  },

  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.75,
  },
}

// Spacing scale (balanced)
export const spacing = {
  0: '0px',
  1: '4px',
  2: '8px',
  3: '12px',
  4: '16px',
  5: '20px',
  6: '24px',
  8: '32px',
  10: '40px',
  12: '48px',
  16: '64px',
  20: '80px',
  24: '96px',
}

// Border radius (rounded)
export const borderRadius = {
  none: '0px',
  xs: '6px',
  sm: '10px',
  md: '16px',
  lg: '20px',
  xl: '24px',
  '2xl': '32px',
  full: '9999px',
}

// Animation timing
export const animation = {
  duration: {
    fast: '150ms',
    normal: '250ms',
    slow: '350ms',
    slower: '500ms',
  },

  easing: {
    ease: 'cubic-bezier(0.4, 0, 0.2, 1)',
    easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
    easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
    easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
  },
}

// Breakpoints
export const breakpoints = {
  xs: '0px',
  sm: '600px',
  md: '960px',
  lg: '1280px',
  xl: '1920px',
}

// Component-specific tokens
export const components = {
  button: {
    height: {
      small: '36px',
      medium: '44px',
      large: '52px',
    },
    borderRadius: borderRadius.md,
  },

  card: {
    borderRadius: borderRadius.lg,
    padding: spacing[6],
    backdropBlur: glass.medium,
    border: '1px solid rgba(61, 70, 83, 0.2)',
  },

  sidebar: {
    background: colors.base.surfaceGlass,
    backdropBlur: glass.medium,
    border: `1px solid ${colors.borders.subtle}`,
    borderRadius: borderRadius.xl,
  },

  textField: {
    height: '56px',
    borderRadius: borderRadius.md,
  },

  chip: {
    height: '36px',
    borderRadius: borderRadius.full,
  },
}

export default {
  colors,
  elevation,
  glass,
  typography,
  spacing,
  borderRadius,
  animation,
  breakpoints,
  components,
}
