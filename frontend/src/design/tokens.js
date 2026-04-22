/**
 * DataLab High-Fidelity Dark Mode Design Tokens
 * Updated 2026-02-02 for DataLab Overhaul
 */

// Base Color Palette - Bleached Stone Light Mode Baseline
export const colors = {
  // Base Backgrounds
  base: {
    background: '#F9F8F7',          // stone-50
    surface: '#FFFFFF',             // white
    surfaceRaised: '#F3F2F1',       // stone-100
  },

  // Borders & Dividers
  borders: {
    subtle: '#E7E5E4',              // stone-200
    strong: '#D6D3D1',              // stone-300
  },

  // Interactive Accent Colors
  accent: {
    primary: '#D97706',             // amber-600
    soft: '#FEF3C7',                // amber-100
  },

  // Semantic CO2 Colors (Traffic Light System)
  semantic: {
    good: {
      color: '#16A34A',
      background: '#DCFCE7',
    },
    fair: {
      color: '#D97706',
      background: '#FEF3C7',
    },
    poor: {
      color: '#EA580C',
      background: '#FFEDD5',
    },
    critical: {
      color: '#DC2626',
      background: '#FEE2E2',
    },
  },

  // Typography
  text: {
    primary: '#1C1917',             // stone-900
    muted: '#78716C',               // stone-500
  },
}

// Glassmorphism elevation system
export const elevation = {
  0: 'none',
  1: '0px 1px 3px 0px rgba(0, 0, 0, 0.05)',
  2: '0px 4px 6px -1px rgba(0, 0, 0, 0.05)',
  3: '0px 10px 15px -3px rgba(0, 0, 0, 0.05)',
  4: '0px 20px 25px -5px rgba(0, 0, 0, 0.05)',
  5: '0px 25px 50px -12px rgba(0, 0, 0, 0.1)',
}

// Glassmorphism backdrop blur
export const glass = {
  light: 'blur(4px)',
  medium: 'blur(8px)',
  strong: 'blur(12px)',
}

// Typography scale - Technical yet Accessible
export const typography = {
  fontFamily: {
    ui: "'Inter', system-ui, -apple-system, sans-serif",
    data: "'JetBrains Mono', monospace",
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
