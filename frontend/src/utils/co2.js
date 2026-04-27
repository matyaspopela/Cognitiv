/**
 * CO2 levels and thresholds for the Cognitiv system.
 * Bleached Stone Design System - Laboratory Style.
 */

export const CO2_LEVELS = {
  GOOD: 1000,
  FAIR: 1400,
  POOR: 2000
};

/**
 * Returns the status key for a given CO2 ppm value.
 * @param {number} ppm 
 * @returns {'good' | 'fair' | 'poor' | 'critical'}
 */
export const getCO2Status = (ppm) => {
  if (ppm < CO2_LEVELS.GOOD) return 'good';
  if (ppm < CO2_LEVELS.FAIR) return 'fair';
  if (ppm < CO2_LEVELS.POOR) return 'poor';
  return 'critical';
};

/**
 * Returns a human-readable label for the CO2 status.
 * @param {number} ppm 
 * @returns {string}
 */
export const getCO2Label = (ppm) => {
  const status = getCO2Status(ppm);
  switch (status) {
    case 'good': return 'Optimal';
    case 'fair': return 'Moderate';
    case 'poor': return 'High';
    case 'critical': return 'Ventilate';
    default: return 'Unknown';
  }
};

/**
 * Returns the color variable name for the CO2 status.
 * Following the "Bleached Stone" / Laboratory style.
 * @param {number} ppm 
 * @returns {string}
 */
export const getCO2Color = (ppm) => {
  const status = getCO2Status(ppm);
  switch (status) {
    case 'good': return 'var(--co2-good)';
    case 'fair': return 'var(--co2-fair)';
    case 'poor': return 'var(--co2-poor)';
    case 'critical': return 'var(--co2-critical)';
    default: return 'var(--text-muted)';
  }
};

/**
 * Returns a recommendation based on CO2 levels.
 * @param {number} ppm 
 * @returns {string}
 */
export const getCO2Recommendation = (ppm) => {
  const status = getCO2Status(ppm);
  switch (status) {
    case 'good': return 'Air quality is excellent. No action needed.';
    case 'fair': return 'Consider opening a window soon.';
    case 'poor': return 'Open windows immediately for cross-ventilation.';
    case 'critical': return 'High alert. Maximum ventilation required.';
    default: return 'Monitoring air quality...';
  }
};
