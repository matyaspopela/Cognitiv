/**
 * Modern Glassmorphism Design Tokens
 * Blue/Teal/Purple Color Scheme
 */

export const colors = {
  // Primary - Blue
  primary: {
    50: '#E3F2FD',
    100: '#BBDEFB',
    200: '#90CAF9',
    300: '#64B5F6',
    400: '#42A5F5',
    500: '#2196F3', // Main primary
    600: '#1E88E5',
    700: '#1976D2',
    800: '#1565C0',
    900: '#0D47A1',
  },
  
  // Secondary - Teal
  secondary: {
    50: '#E0F2F1',
    100: '#B2DFDB',
    200: '#80CBC4',
    300: '#4DB6AC',
    400: '#26A69A',
    500: '#009688', // Main secondary
    600: '#00897B',
    700: '#00796B',
    800: '#00695C',
    900: '#004D40',
  },
  
  // Accent - Purple
  accent: {
    50: '#F3E5F5',
    100: '#E1BEE7',
    200: '#CE93D8',
    300: '#BA68C8',
    400: '#AB47BC',
    500: '#9C27B0', // Main accent
    600: '#8E24AA',
    700: '#7B1FA2',
    800: '#6A1B9A',
    900: '#4A148C',
  },
  
  // Surface colors with transparency for glassmorphism
  surface: {
    default: 'rgba(255, 255, 255, 0.7)',
    variant: 'rgba(255, 255, 255, 0.5)',
    dim: 'rgba(255, 255, 255, 0.3)',
    dark: 'rgba(0, 0, 0, 0.2)',
  },
  
  // Background
  background: {
    default: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    variant: 'linear-gradient(135deg, #2196F3 0%, #009688 50%, #9C27B0 100%)',
    paper: 'rgba(255, 255, 255, 0.9)',
  },
  
  // Text colors
  text: {
    primary: '#1A1A1A',
    secondary: '#4A4A4A',
    disabled: '#9E9E9E',
    hint: '#757575',
    onDark: '#FFFFFF',
  },
  
  // Status colors
  error: {
    50: '#FFEBEE',
    100: '#FFCDD2',
    500: '#F44336',
    700: '#D32F2F',
  },
  
  success: {
    50: '#E8F5E9',
    100: '#C8E6C9',
    500: '#4CAF50',
    700: '#388E3C',
  },
  
  warning: {
    50: '#FFF3E0',
    100: '#FFE0B2',
    500: '#FF9800',
    700: '#F57C00',
  },
  
  info: {
    50: '#E3F2FD',
    100: '#BBDEFB',
    500: '#2196F3',
    700: '#1976D2',
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
  medium: 'blur(16px)',
  strong: 'blur(24px)',
}

// Typography scale - Geometric
export const typography = {
  fontFamily: {
    primary: "'Space Grotesk', 'Montserrat', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    display: "'Montserrat', 'Space Grotesk', sans-serif",
    mono: "'JetBrains Mono', 'Fira Code', monospace",
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
    border: '1px solid rgba(255, 255, 255, 0.18)',
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
