/**
 * Cognitiv Chart System
 * Standardized Chart.js configurations for the "Laboratory" aesthetic (Bleached Stone).
 */

import { colors } from '../design/tokens';

export const chartColors = {
  grid: '#F3F2F1',      // stone-100
  text: '#78716C',      // stone-500
  textMuted: '#A8A29E', // stone-400
  background: '#FFFFFF',
  border: '#E7E5E4',    // stone-200
  stone: {
    50: '#F9F8F7',
    100: '#F3F2F1',
    200: '#E7E5E4',
    300: '#D6D3D1',
    400: '#A8A29E',
    500: '#78716C',
    600: '#57534E',
    700: '#44403C',
    800: '#292524',
    900: '#1C1917',
  }
};

/**
 * Thresholds for CO2 levels
 */
export const CO2_THRESHOLDS = {
  SAFE: 800,
  WARNING: 1200,
};

/**
 * Semantic colors for thresholds (Bleached Stone variant)
 */
export const semanticColors = {
  safe: {
    line: '#16A34A',      // green-600
    fill: 'rgba(22, 163, 74, 0.1)',
  },
  warning: {
    line: '#D97706',   // amber-600
    fill: 'rgba(217, 119, 6, 0.1)',
  },
  critical: {
    line: '#DC2626',   // red-600
    fill: 'rgba(220, 38, 38, 0.1)',
  }
};

/**
 * Base configuration for Laboratory line charts
 */
export const baseOptions = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: {
    mode: 'index',
    intersect: false,
  },
  plugins: {
    legend: {
      display: false,
    },
    tooltip: {
      enabled: true,
      backgroundColor: '#FFFFFF',
      titleColor: chartColors.stone[900],
      bodyColor: chartColors.stone[700],
      borderColor: chartColors.stone[200],
      borderWidth: 1,
      padding: 12,
      cornerRadius: 8,
      displayColors: true,
      usePointStyle: true,
      boxPadding: 6,
      bodyFont: {
        family: "'JetBrains Mono', monospace",
        size: 12,
      },
      titleFont: {
        family: "'Inter', sans-serif",
        weight: '600',
        size: 13,
      }
    }
  },
  scales: {
    x: {
      grid: {
        display: false,
      },
      ticks: {
        color: chartColors.text,
        font: {
          family: "'Inter', sans-serif",
          size: 11,
        },
        maxRotation: 0,
        autoSkip: true,
        maxTicksLimit: 8,
      },
      border: {
        display: false,
      }
    },
    y: {
      grid: {
        color: chartColors.grid,
        drawBorder: false,
      },
      ticks: {
        color: chartColors.text,
        font: {
          family: "'JetBrains Mono', monospace",
          size: 11,
        },
        padding: 8,
      },
      border: {
        display: false,
      }
    }
  },
  elements: {
    point: {
      radius: 0,
      hoverRadius: 5,
      hoverBorderWidth: 2,
      hoverBackgroundColor: '#FFFFFF',
    },
    line: {
      tension: 0.3,
      borderWidth: 2,
    }
  }
};

/**
 * Mini-sparkline options (minimalistic)
 */
export const sparklineOptions = {
  ...baseOptions,
  plugins: {
    ...baseOptions.plugins,
    tooltip: { enabled: false },
    legend: { display: false },
  },
  scales: {
    x: { display: false },
    y: { display: false },
  },
  elements: {
    point: { radius: 0 },
    line: {
      tension: 0.3,
      borderWidth: 1.5,
      fill: true,
    }
  }
};

/**
 * Helper to create a threshold-aware gradient for Chart.js
 */
export const createThresholdGradient = (ctx, chartArea, scales) => {
  const { top, bottom } = chartArea;
  const { y } = scales;
  
  const gradient = ctx.createLinearGradient(0, bottom, 0, top);
  
  // Chart.js scales mapping to pixels
  // Note: bottom is larger Y pixel value than top
  
  const safePx = y.getPixelForValue(CO2_THRESHOLDS.SAFE);
  const warningPx = y.getPixelForValue(CO2_THRESHOLDS.WARNING);
  
  // Calculate relative stops (0 to 1)
  // Gradient goes from bottom (0) to top (1)
  const getStop = (px) => {
    const stop = (bottom - px) / (bottom - top);
    return Math.max(0, Math.min(1, stop));
  };
  
  const safeStop = getStop(safePx);
  const warningStop = getStop(warningPx);
  
  // Green zone (up to 800)
  gradient.addColorStop(0, 'rgba(22, 163, 74, 0.15)'); 
  gradient.addColorStop(safeStop, 'rgba(22, 163, 74, 0.15)');
  
  // Amber zone (800 to 1200)
  gradient.addColorStop(safeStop, 'rgba(217, 119, 6, 0.15)');
  gradient.addColorStop(warningStop, 'rgba(217, 119, 6, 0.15)');
  
  // Red zone (above 1200)
  gradient.addColorStop(warningStop, 'rgba(220, 38, 38, 0.15)');
  gradient.addColorStop(1, 'rgba(220, 38, 38, 0.15)');
  
  return gradient;
};

export default {
  chartColors,
  baseOptions,
  sparklineOptions,
  CO2_THRESHOLDS,
  semanticColors,
  createThresholdGradient
};
