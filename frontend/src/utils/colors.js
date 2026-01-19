/**
 * Shared color utilities for the application.
 * Defines the unified Green-Red gradient palette for CO2 visualization.
 */

// Core gradient configuration
const CO2_MIN = 400
const CO2_MAX = 2000
const HUE_START = 140 // Deep Green
const HUE_END = 0     // Red

/**
 * Get color based on CO2 value using Green-Red gradient interpolation.
 * @param {number|null} co2 - CO2 value in ppm
 * @param {number} alpha - Opacity (0-1)
 * @returns {string} HSLA color string
 */
export const getCo2Color = (co2, alpha = 1) => {
    if (co2 == null) return `rgba(39, 39, 42, ${alpha})` // zinc-800

    // Clamp CO2 between min and max
    const normalized = Math.max(0, Math.min(1, (co2 - CO2_MIN) / (CO2_MAX - CO2_MIN)))

    // Interpolate Hue
    const hue = HUE_START * (1 - normalized)

    // Saturation 70%, Lightness 45% (matches the dark theme nicely)
    return `hsla(${hue}, 70%, 45%, ${alpha})`
}

/**
 * Get text color that contrasts well with the CO2 color background
 * @param {number|null} co2 
 * @returns {string} Hex color string
 */
export const getCo2ContrastingTextColor = (co2) => {
    if (co2 == null) return '#a1a1aa'

    // Once we get into the red zone, white looks weird if the red is too bright?
    // Actually, with L=45%, white text is always good.
    // But let's check normalized value.
    const normalized = Math.max(0, Math.min(1, (co2 - CO2_MIN) / (CO2_MAX - CO2_MIN)))

    // For very light colors (yellows/greens at high lightness), we might want dark text?
    // But we fixed lightness at 45%, so white is safe.
    return '#ffffff'
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
        // Helper specifically for text-only usage (using the color as text color)
        textColor: `hsla(${HUE_START * (1 - Math.max(0, Math.min(1, (co2 - CO2_MIN) / (CO2_MAX - CO2_MIN))))}, 70%, 55%, 1)`
    }
}
