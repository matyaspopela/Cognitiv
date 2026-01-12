/**
 * Sci-Fi / Clean Tech Design System Theme
 * Color palette and constants for the redesigned dashboard
 */

export const scifiTheme = {
  // Background Colors
  background: {
    center: '#1a1c29',      // Deep Navy (center of gradient)
    outer: '#0b0c15',       // Darker Navy (outer of gradient)
    gradient: 'radial-gradient(circle at center, #1a1c29 0%, #0b0c15 100%)',
  },

  // CO2 State Colors
  colors: {
    safe: '#00f2ea',        // Cyan / Electric Teal (<800ppm)
    warning: '#ffc107',     // Amber / Gold (800-1200ppm)
    danger: '#ff0055',      // Magenta / Hot Pink (>1200ppm)
  },

  // Text Colors
  text: {
    primary: '#ffffff',     // White
    secondary: '#9ca3af',   // Muted Grey
  },

  // CO2 Thresholds
  thresholds: {
    safe: 800,              // Below this is safe
    warning: 1200,          // Between safe and warning
    // Above warning is danger
  },

  // Helper function to get color for CO2 value
  getColorForCO2: (co2) => {
    if (co2 < scifiTheme.thresholds.safe) {
      return scifiTheme.colors.safe
    } else if (co2 < scifiTheme.thresholds.warning) {
      // Interpolate between safe and warning
      const t = (co2 - scifiTheme.thresholds.safe) / (scifiTheme.thresholds.warning - scifiTheme.thresholds.safe)
      return interpolateColor(scifiTheme.colors.safe, scifiTheme.colors.warning, t)
    } else {
      // Interpolate between warning and danger
      const t = Math.min((co2 - scifiTheme.thresholds.warning) / 400, 1) // Cap at 1600ppm for full danger
      return interpolateColor(scifiTheme.colors.warning, scifiTheme.colors.danger, t)
    }
  },

  // Helper function to get THREE.Color for CO2 value (for React Three Fiber)
  getThreeColorForCO2: (co2) => {
    const hexColor = scifiTheme.getColorForCO2(co2)
    return hexToThreeColor(hexColor)
  },
}

/**
 * Interpolate between two hex colors
 * @param {string} color1 - Hex color string
 * @param {string} color2 - Hex color string
 * @param {number} t - Interpolation factor (0-1)
 * @returns {string} Interpolated hex color
 */
function interpolateColor(color1, color2, t) {
  const c1 = hexToRgb(color1)
  const c2 = hexToRgb(color2)
  
  const r = Math.round(c1.r + (c2.r - c1.r) * t)
  const g = Math.round(c1.g + (c2.g - c1.g) * t)
  const b = Math.round(c1.b + (c2.b - c1.b) * t)
  
  return rgbToHex(r, g, b)
}

/**
 * Convert hex color to RGB
 * @param {string} hex - Hex color string
 * @returns {Object} {r, g, b}
 */
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 0, g: 0, b: 0 }
}

/**
 * Convert RGB to hex
 * @param {number} r - Red (0-255)
 * @param {number} g - Green (0-255)
 * @param {number} b - Blue (0-255)
 * @returns {string} Hex color string
 */
function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(x => {
    const hex = x.toString(16)
    return hex.length === 1 ? '0' + hex : hex
  }).join('')
}

/**
 * Convert hex color to THREE.Color
 * @param {string} hex - Hex color string
 * @returns {THREE.Color} THREE.Color object
 */
function hexToThreeColor(hex) {
  // This will be used in the component where THREE is imported
  // For now, return the hex string - will be converted in component
  return hex
}

export default scifiTheme



