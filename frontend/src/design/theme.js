/**
 * Cognitiv Bleached Stone Theme
 * Updated 2026-04-21 for Laboratory Refactor
 * Minimalist, high-density light mode theme.
 */

import { colors } from './tokens'

export const theme = {
  // Background Colors - Bleached Stone Baseline
  background: {
    primary: colors.base.background,       // #F9F8F7 stone-50
    secondary: colors.base.surface,        // #FFFFFF white
    raised: colors.base.surfaceRaised,      // #F3F2F1 stone-100
  },

  // CO2 State Colors - Semantic Laboratory System
  colors: {
    good: colors.semantic.good.color,           // #16A34A green-600
    fair: colors.semantic.fair.color,           // #D97706 amber-600
    poor: colors.semantic.poor.color,           // #EA580C orange-600
    critical: colors.semantic.critical.color,   // #DC2626 red-600

    // Additional semantic backgrounds
    goodBg: colors.semantic.good.background,
    fairBg: colors.semantic.fair.background,
    poorBg: colors.semantic.poor.background,
    criticalBg: colors.semantic.critical.background,

    // Graph specific
    grid: colors.borders.subtle,           // #E7E5E4 stone-200
    text: colors.text.muted,               // #78716C stone-500
    tooltipBg: '#FFFFFF',

    // Interactive accents
    accent: colors.accent.primary,         // #D97706 amber-600
    accentSoft: colors.accent.soft,        // #FEF3C7 amber-100
  },

  // Text Colors
  text: {
    primary: colors.text.primary,          // #1C1917 stone-900
    muted: colors.text.muted,              // #78716C stone-500
  },

  // CO2 Thresholds (ppm) - Single Source of Truth
  thresholds: {
    good: 800,
    fair: 1200,
    poor: 1800,
  },

  // Helper function to get color for CO2 value
  getColorForCO2: (co2) => {
    if (co2 < 800) {
      return colors.semantic.good.color
    } else if (co2 < 1200) {
      return colors.semantic.fair.color
    } else if (co2 < 1800) {
      return colors.semantic.poor.color
    } else {
      return colors.semantic.critical.color
    }
  },

  // Helper function to get style object for CO2 value
  getStyleForCO2: (co2) => {
    if (co2 < 800) {
      return {
        color: colors.semantic.good.color,
        background: colors.semantic.good.background,
        status: 'good'
      }
    } else if (co2 < 1200) {
      return {
        color: colors.semantic.fair.color,
        background: colors.semantic.fair.background,
        status: 'fair'
      }
    } else if (co2 < 1800) {
      return {
        color: colors.semantic.poor.color,
        background: colors.semantic.poor.background,
        status: 'poor'
      }
    } else {
      return {
        color: colors.semantic.critical.color,
        background: colors.semantic.critical.background,
        status: 'critical'
      }
    }
  },
}

export default theme
