/**
 * Monochrome Design System Theme
 * Color palette and constants for the redesigned dashboard (Zinc/Slate)
 */

export const theme = {
  // Background Colors - Flat Zinc
  background: {
    center: '#18181b',      // Zinc 900
    outer: '#09090b',       // Zinc 950
    gradient: 'linear-gradient(to bottom, #18181b, #09090b)',
  },

  // CO2 State Colors - High Contrast Monochrome
  // Using shades of Zinc for "Safe", "Warning", "Danger" relative to severity
  colors: {
    safe: '#d4d4d8',        // Zinc 300 (Light Gray) - Normal
    warning: '#a1a1aa',     // Zinc 400 (Medium Gray) - Attention
    danger: '#ffffff',      // White (High Contrast) - Critical
    
    // Graph specific
    grid: '#27272a',        // Zinc 800
    text: '#a1a1aa',        // Zinc 400
    tooltipBg: '#18181b',   // Zinc 900
  },

  // Text Colors
  text: {
    primary: '#f4f4f5',     // Zinc 100
    secondary: '#a1a1aa',   // Zinc 400
  },

  // CO2 Thresholds
  thresholds: {
    safe: 800,
    warning: 1200,
  },

  // Helper function to get color for CO2 value
  getColorForCO2: (co2) => {
    if (co2 < theme.thresholds.safe) {
      return theme.colors.safe
    } else if (co2 < theme.thresholds.warning) {
      return theme.colors.warning
    } else {
      return theme.colors.danger
    }
  },

  // Helper function to get THREE.Color for CO2 value
  getThreeColorForCO2: (co2) => {
    const hexColor = theme.getColorForCO2(co2)
    return hexColor
  },
}

export default theme
