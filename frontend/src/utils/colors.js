/**
 * Color utilities for DataLab
 * Updated 2026-02-02 for semantic CO2 visualization
 */

import { theme } from '../design/theme'
import { colors } from '../design/tokens'

/**
 * Get color based on CO2 value using semantic traffic light system.
 * @param {number|null} co2 - CO2 value in ppm
 * @param {number} alpha - Opacity (0-1)
 * @returns {string} Hex or RGBA color string
 */
export const getCo2Color = (co2, alpha = 1) => {
    if (co2 == null) return `rgba(61, 70, 83, ${alpha})` // Neutral gray

    const color = theme.getColorForCO2(co2)

    if (alpha === 1) return color

    // Convert hex to rgba for alpha support
    return hexToRgba(color, alpha)
}

/**
 * Get detailed style object for CO2 value
 * Includes color, glow, line style, and pulse animation flag
 * @param {number|null} co2 - CO2 value in ppm
 * @returns {Object} Style object with color, glow, style, shouldPulse
 */
export const getCo2Style = (co2) => {
    if (co2 == null) {
        return {
            line: 'rgba(61, 70, 83, 0.5)',
            glow: 'rgba(61, 70, 83, 0.1)',
            style: 'solid',
            shouldPulse: false,
        }
    }

    return theme.getStyleForCO2(co2)
}

/**
 * Get text color that contrasts well with the CO2 color background
 * @param {number|null} co2 
 * @returns {string} Hex color string
 */
export const getCo2ContrastingTextColor = (co2) => {
    if (co2 == null) return theme.text.secondary

    // Semantic colors are bright on dark background
    // For badges/backgrounds, use dark text
    return colors.base.background // #0B0E14
}

/**
 * Get background color with opacity for CO2 badges/tags
 * @param {number|null} co2 
 * @param {number} alpha 
 * @returns {string} RGBA color string
 */
export const getCo2BackgroundColor = (co2, alpha = 0.15) => {
    if (co2 == null) return `rgba(61, 70, 83, ${alpha})`

    const color = theme.getColorForCO2(co2)
    return hexToRgba(color, alpha)
}

/**
 * Get glassmorphism CSS properties
 * @param {string} blur - 'light', 'medium', or 'strong'
 * @returns {Object} CSS properties object
 */
export const getGlassmorphismStyle = (blur = 'medium') => {
    return theme.getGlassmorphismStyle(blur)
}

/**
 * Get interactive state styles (hover, focus, active)
 * @param {string} state - 'hover', 'focus', or 'active'
 * @returns {Object} CSS properties object
 */
export const getInteractiveStyle = (state = 'hover') => {
    const styles = {
        hover: {
            backgroundColor: 'color-mix(in srgb, var(--surface) 95%, white 5%)',
            borderTop: `1px solid ${colors.accent.primary}33`, // 20% opacity
            transition: 'all 150ms ease-out',
        },
        focus: {
            outline: `2px solid ${colors.accent.primary}`,
            outlineOffset: '2px',
            borderRadius: '0.375rem',
        },
        active: {
            backgroundColor: colors.accent.primary,
            color: colors.text.primary,
        },
    }

    return styles[state] || styles.hover
}

/**
 * Generate pulsing animation keyframes
 * @param {string} color - Hex color for pulse
 * @returns {string} CSS keyframe animation name
 */
export const getPulseAnimation = (color = colors.semantic.critical.color) => {
    return `
        @keyframes pulse-critical {
            0%, 100% { 
                opacity: 1; 
                box-shadow: 0 0 8px ${hexToRgba(color, 0.4)};
            }
            50% { 
                opacity: 0.7; 
                box-shadow: 0 0 16px ${hexToRgba(color, 0.6)};
            }
        }
    `
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