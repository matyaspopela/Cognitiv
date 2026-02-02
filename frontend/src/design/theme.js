/**
 * DataLab High-Fidelity Dark Mode Theme
 * Updated 2026-02-02 for DataLab Overhaul
 * Replaces monochrome Zinc palette with semantic color system
 */

import { colors } from './tokens'

export const theme = {
  // Background Colors - High-Fidelity Dark Mode
  background: {
    primary: colors.base.background,       // #0B0E14 Deep Charcoal
    secondary: colors.base.surface,        // #151921 Navy-tinted Gray
    glass: colors.base.surfaceGlass,       // rgba(21, 25, 33, 0.6)
  },

  // CO2 State Colors - Semantic Traffic Light System
  colors: {
    safe: colors.semantic.safe.color,           // #10B981 Emerald
    warning: colors.semantic.warning.color,     // #F59E0B Amber
    danger: colors.semantic.critical.color,     // #EF4444 Crimson

    // Additional semantic properties
    safeGlow: colors.semantic.safe.glow,
    warningGlow: colors.semantic.warning.glow,
    dangerGlow: colors.semantic.critical.glow,

    // Graph specific
    grid: 'rgba(61, 70, 83, 0.2)',        // Subtle borders
    text: colors.text.secondary,           // #D1D5DB
    tooltipBg: colors.base.surface,        // #151921

    // Interactive accents
    accent: colors.accent.primary,         // #6366F1 Electric Indigo
    accentHover: colors.accent.hover,      // #7C7FF5 Lightened Indigo
  },

  // Text Colors
  text: {
    primary: colors.text.primary,          // #F9FAFB
    secondary: colors.text.secondary,      // #D1D5DB
    tertiary: colors.text.tertiary,        // #9CA3AF
    disabled: colors.text.disabled,        // #6B7280
  },

  // CO2 Thresholds (ppm)
  thresholds: {
    safe: 800,
    warning: 1200,
    critical: 1500,  // For pulsing animation
  },

  // Helper function to get color for CO2 value
  getColorForCO2: (co2) => {
    if (co2 < theme.thresholds.safe) {
      return colors.semantic.safe.color
    } else if (co2 < theme.thresholds.warning) {
      return colors.semantic.warning.color
    } else {
      return colors.semantic.critical.color
    }
  },

  // Helper function to get style object for CO2 value
  getStyleForCO2: (co2) => {
    if (co2 < theme.thresholds.safe) {
      return {
        color: colors.semantic.safe.color,
        glow: colors.semantic.safe.glow,
        style: 'solid',
        shouldPulse: false,
      }
    } else if (co2 < theme.thresholds.warning) {
      return {
        color: colors.semantic.warning.color,
        glow: colors.semantic.warning.glow,
        style: 'thicker',
        shouldPulse: false,
      }
    } else {
      return {
        color: colors.semantic.critical.color,
        glow: colors.semantic.critical.glow,
        style: 'thicker',
        shouldPulse: co2 >= theme.thresholds.critical,
      }
    }
  },

  // Glassmorphism helper
  getGlassmorphismStyle: (blur = 'medium') => {
    const blurValues = {
      light: 'blur(10px)',
      medium: 'blur(12px)',
      strong: 'blur(16px)',
    }

    return {
      background: colors.base.surfaceGlass,
      backdropFilter: blurValues[blur],
      WebkitBackdropFilter: blurValues[blur],
      border: `1px solid ${colors.borders.subtle}`,
    }
  },
}

export default theme
