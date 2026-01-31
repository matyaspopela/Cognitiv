/**
 * Shared color utilities for the application.
 * Defines the unified Monochrome palette for CO2 visualization.
 */

import { theme } from '../design/theme'

/**
 * Get color based on CO2 value using Monochrome thresholds.
 * @param {number|null} co2 - CO2 value in ppm
 * @param {number} alpha - Opacity (0-1)
 * @returns {string} Hex or RGBA color string
 */
export const getCo2Color = (co2, alpha = 1) => {
    if (co2 == null) return `rgba(39, 39, 42, ${alpha})` // zinc-800

    const color = theme.getColorForCO2(co2)
    
    if (alpha === 1) return color

    // Convert hex to rgba for alpha support
    return hexToRgba(color, alpha)
}

/**
 * Get text color that contrasts well with the CO2 color background
 * @param {number|null} co2 
 * @returns {string} Hex color string
 */
export const getCo2ContrastingTextColor = (co2) => {
    if (co2 == null) return theme.text.secondary

    const color = theme.getColorForCO2(co2)
    
    // For white/light backgrounds (danger/safe), we need dark text? 
    // Wait, theme colors are: Safe (Zinc 300 #d4d4d8), Warning (Zinc 400 #a1a1aa), Danger (White #ffffff).
    // The background of the app is Dark (Zinc 900/950).
    // These colors are meant to be FOREGROUND colors (charts, text).
    // If used as BACKGROUND for a badge, they are light.
    // So text on top of them should be dark.
    
    return '#18181b' // Zinc 900
}

/**
 * Get an object containing background and text styles.
 * @param {number|null} co2 
 * @param {number} alpha 
 * @returns {Object} Style object
 */
export const getCo2Style = (co2, alpha = 0.85) => {
    const bg = getCo2Color(co2, alpha)
    return {
        backgroundColor: bg,
        color: getCo2ContrastingTextColor(co2),
        textColor: getCo2Color(co2, 1) // For when color is used as text
    }
}

// Helper to convert hex to rgba
function hexToRgba(hex, alpha) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return hex
    
    const r = parseInt(result[1], 16);
    const g = parseInt(result[2], 16);
    const b = parseInt(result[3], 16);

    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}