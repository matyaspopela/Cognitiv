/**
 * Shared chart building utilities for Chart.js
 * Converts API data to Chart.js-compatible format
 */

import { getCo2Color } from './colors'

// Apple-modern color palette - Green to Red scale for danger communication
// Kept for non-gradient fallbacks (like text)
const appleModernColors = {
  good: getCo2Color(600),          // Representative Green
  moderate: getCo2Color(1250),     // Representative Amber
  danger: getCo2Color(1750),       // Representative Orange/Red
  dangerDark: getCo2Color(2200),   // Representative Deep Red
  accent: '#14B8A6',               // Accent Teal (temperature)
  grid: 'rgba(229, 231, 235, 0.5)',
  textSecondary: '#586169',
  textPrimary: '#16181C',
}

/**
 * Get color based on CO2 value - Green to Red gradient
 */
export const getColorForCO2 = (co2) => {
  return getCo2Color(co2)
}

/**
 * Get segment color for CO2 chart - implements smooth gradient
 * This function colors each line segment based on the max value of the segment
 */
export const getCO2SegmentColor = (context) => {
  // Safety checks
  if (!context || !context.dataset || !context.dataset.data) {
    return appleModernColors.good
  }

  const p0Index = context.p0DataIndex
  const p1Index = context.p1DataIndex
  const data = context.dataset.data

  // Check if indices are valid
  if (p0Index === undefined || p1Index === undefined ||
    p0Index < 0 || p1Index < 0 ||
    p0Index >= data.length || p1Index >= data.length) {
    return appleModernColors.good
  }

  const v0 = data[p0Index]
  const v1 = data[p1Index]

  // Check for null/undefined values
  if (v0 === null || v0 === undefined || v1 === null || v1 === undefined) {
    return appleModernColors.good
  }

  // Use the worse (higher) value to determine segment color
  const maxValue = Math.max(v0, v1)

  return getCo2Color(maxValue)
}

/**
 * Build CO2 chart data for Chart.js
 * @param {Array} data - Series data from historyAPI.getSeries()
 * @param {string} bucket - Bucket size ('raw', '10min', 'hour', 'day')
 * @returns {Object} Chart.js-compatible data object
 */
export const buildCo2ChartData = (data, bucket = '10min') => {
  if (!data || !Array.isArray(data) || data.length === 0) {
    return null
  }

  const validData = data.filter(item => item && typeof item === 'object' && item.bucket_start)
  if (validData.length === 0) return null

  const labels = []
  const values = []
  // Colors array not strictly needed for line chart segments, but useful if we switched to bar
  const colors = []

  validData.forEach((item) => {
    const timestamp = new Date(item.bucket_start)
    if (isNaN(timestamp.getTime())) return

    const co2Value = item.co2?.avg ?? item.co2
    if (co2Value === null || co2Value === undefined) return

    labels.push(timestamp)
    values.push(Number(co2Value))
    colors.push(getColorForCO2(co2Value))
  })

  if (values.length === 0) return null

  return {
    labels,
    datasets: [{
      label: 'CO₂ (ppm)',
      data: values,
      // Segment-based coloring: changes color based on CO2 levels
      segment: {
        borderColor: (ctx) => getCO2SegmentColor(ctx),
      },
      borderColor: appleModernColors.good, // Fallback
      borderWidth: 2,
      backgroundColor: (context) => {
        const chart = context.chart
        const { ctx, chartArea } = chart
        if (!chartArea) return 'rgba(16, 185, 129, 0.1)'
        // Gradient fill for area under curve - subtle green
        const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top)
        gradient.addColorStop(0, 'rgba(16, 185, 129, 0)')
        gradient.addColorStop(1, 'rgba(16, 185, 129, 0.15)')
        return gradient
      },
      fill: true,
      tension: 0.4,
      pointRadius: 0,
      pointHoverRadius: 6,
      pointHoverBackgroundColor: (ctx) => {
        // Dynamic hover color
        const val = ctx.raw
        return getCo2Color(val)
      },
      pointHoverBorderColor: '#fff',
      pointHoverBorderWidth: 2,
    }]
  }
}

/**
 * Build climate (Temperature & Humidity) chart data for Chart.js
 * @param {Array} data - Series data from historyAPI.getSeries()
 * @param {string} bucket - Bucket size ('raw', '10min', 'hour', 'day')
 * @returns {Object} Chart.js-compatible data object
 */
export const buildClimateChartData = (data, bucket = '10min') => {
  if (!data || !Array.isArray(data) || data.length === 0) {
    return null
  }

  const validData = data.filter(item => item && typeof item === 'object' && item.bucket_start)
  if (validData.length === 0) return null

  const labels = []
  const tempValues = []
  const humidityValues = []

  validData.forEach((item) => {
    const timestamp = new Date(item.bucket_start)
    if (isNaN(timestamp.getTime())) return

    const temp = item.temperature?.avg ?? item.temperature
    const humidity = item.humidity?.avg ?? item.humidity

    labels.push(timestamp)
    tempValues.push(temp !== null && temp !== undefined ? Number(temp) : null)
    humidityValues.push(humidity !== null && humidity !== undefined ? Number(humidity) : null)
  })

  if (labels.length === 0) return null

  return {
    labels,
    datasets: [
      {
        label: 'Temperature (°C)',
        data: tempValues,
        borderColor: appleModernColors.accent,
        backgroundColor: 'rgba(20, 184, 166, 0.05)',
        fill: false,
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 6,
        pointHoverBackgroundColor: appleModernColors.accent,
        pointHoverBorderColor: '#fff',
        pointHoverBorderWidth: 2,
        yAxisID: 'y',
      },
      {
        label: 'Humidity (%)',
        data: humidityValues,
        borderColor: appleModernColors.moderate,
        backgroundColor: 'rgba(245, 158, 11, 0.05)',
        fill: false,
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 6,
        pointHoverBackgroundColor: appleModernColors.moderate,
        pointHoverBorderColor: '#fff',
        pointHoverBorderWidth: 2,
        yAxisID: 'y1',
      }
    ]
  }
}

/**
 * Build CO2 quality distribution data for Chart.js Doughnut
 * @param {Object} co2Quality - Quality distribution object from historyAPI.getSummary()
 * @returns {Object|null} Chart.js-compatible data object or null if no data
 */
export const buildQualityChartData = (co2Quality) => {
  if (!co2Quality) return null

  const good = typeof co2Quality.good === 'number' ? co2Quality.good : 0
  const moderate = typeof co2Quality.moderate === 'number' ? co2Quality.moderate : 0
  const high = typeof co2Quality.high === 'number' ? co2Quality.high : 0
  const critical = typeof co2Quality.critical === 'number' ? co2Quality.critical : 0

  const total = good + moderate + high + critical
  if (total === 0) return null

  return {
    labels: ['< 1000 ppm', '1000-1500 ppm', '1500-2000 ppm', '2000+ ppm'],
    datasets: [{
      data: [good, moderate, high, critical],
      backgroundColor: [
        getCo2Color(700),     // Representative Good
        getCo2Color(1250),    // Representative Moderate
        getCo2Color(1750),    // Representative High
        getCo2Color(2200),    // Representative Critical
      ],
      borderColor: 'transparent',
      borderWidth: 0,
    }]
  }
}

/**
 * Build mini CO2 chart data for Chart.js (used in cards)
 * @param {Array} data - Series data from historyAPI.getSeries()
 * @returns {Object} Chart.js-compatible data object
 */
export const buildMiniCo2ChartData = (data) => {
  if (!data || !Array.isArray(data) || data.length === 0) {
    return null
  }

  const validData = data.filter(item => item && typeof item === 'object' && item.bucket_start)
  if (validData.length === 0) return null

  const labels = []
  const values = []

  validData.forEach((item) => {
    const timestamp = new Date(item.bucket_start)
    if (isNaN(timestamp.getTime())) return

    const co2Value = item.co2?.avg ?? item.co2
    if (co2Value === null || co2Value === undefined) return

    labels.push(timestamp)
    values.push(Number(co2Value))
  })

  if (values.length === 0) return null

  // Get color based on latest value
  const latestValue = values[values.length - 1]
  const lineColor = getColorForCO2(latestValue)

  return {
    labels,
    datasets: [{
      data: values,
      // Use segment coloring for mini charts with green-to-red gradient
      segment: {
        borderColor: (ctx) => getCO2SegmentColor(ctx),
      },
      borderColor: lineColor,
      backgroundColor: 'transparent',
      fill: false,
      tension: 0.4,
      pointRadius: 0,
      borderWidth: 2,
    }]
  }
}

/**
 * Check if chart data has valid displayable points
 * @param {Object|null} chartData - Chart.js data object or null
 * @returns {boolean} True if there are valid data points to display
 */
export const hasValidChartData = (chartData) => {
  if (!chartData || !chartData.datasets || !Array.isArray(chartData.datasets)) {
    return false
  }

  return chartData.datasets.some((dataset) => {
    if (!dataset.data || !Array.isArray(dataset.data)) return false
    return dataset.data.some((value) => value !== null && value !== undefined && !isNaN(value))
  })
}

/**
 * Common Chart.js options for modern Apple aesthetic
 * @param {string} type - Chart type ('line', 'doughnut', etc.)
 * @param {Object} options - Custom options to merge
 * @param {boolean} options.useRealTimeScale - If true, use time scale; if false, use category scale (evenly spaced)
 */
export const getChartOptions = (type = 'line', options = {}) => {
  const useTimeScale = options.useRealTimeScale === true // Default to false (evenly spaced)

  const xAxisConfig = useTimeScale ? {
    type: 'time',
    time: {
      displayFormats: {
        hour: 'HH:mm',
        day: 'MMM d',
        week: 'MMM d',
      }
    },
    grid: {
      display: false,
      color: appleModernColors.grid,
    },
    ticks: {
      color: appleModernColors.textSecondary,
      maxRotation: 0,
      autoSkip: true,
      maxTicksLimit: 8,
    },
    border: {
      display: false,
    }
  } : {
    type: 'category',
    grid: {
      display: false,
      color: appleModernColors.grid,
    },
    ticks: {
      color: appleModernColors.textSecondary,
      maxRotation: 45,
      autoSkip: true,
      maxTicksLimit: 10,
      callback: function (value, index) {
        // Format category labels as time strings
        const label = this.getLabelForValue(value)
        if (label instanceof Date) {
          return label.toLocaleString('en-GB', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })
        }
        return label
      }
    },
    border: {
      display: false,
    }
  }

  const baseOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      legend: {
        display: options.showLegend !== false,
        position: 'top',
        labels: {
          color: appleModernColors.textSecondary,
          usePointStyle: true,
          padding: 20,
          font: { size: 12 }
        }
      },
      tooltip: {
        enabled: true,
        backgroundColor: 'rgba(255, 255, 255, 0.96)',
        titleColor: appleModernColors.textPrimary,
        bodyColor: appleModernColors.textSecondary,
        borderColor: appleModernColors.grid,
        borderWidth: 1,
        padding: 12,
        cornerRadius: 8,
        displayColors: true,
      }
    },
    scales: type !== 'doughnut' ? {
      x: xAxisConfig,
      y: {
        grid: {
          color: appleModernColors.grid,
          drawBorder: false,
        },
        ticks: {
          color: appleModernColors.textSecondary,
        },
        border: {
          display: false,
        }
      }
    } : undefined
  }

  // Merge with custom options (excluding useRealTimeScale which is internal)
  const { useRealTimeScale: _, ...restOptions } = options
  return { ...baseOptions, ...restOptions }
}

/**
 * Get climate chart options with dual Y axes
 * @param {Object} options - Custom options including useRealTimeScale
 */
export const getClimateChartOptions = (options = {}) => {
  const base = getChartOptions('line', options)
  return {
    ...base,
    scales: {
      ...base.scales,
      y: {
        type: 'linear',
        display: true,
        position: 'left',
        title: {
          display: true,
          text: 'Temperature (°C)',
          color: appleModernColors.accent,
        },
        grid: {
          color: appleModernColors.grid,
          drawBorder: false,
        },
        ticks: {
          color: appleModernColors.accent,
        },
        border: {
          display: false,
        }
      },
      y1: {
        type: 'linear',
        display: true,
        position: 'right',
        title: {
          display: true,
          text: 'Humidity (%)',
          color: appleModernColors.moderate,
        },
        grid: {
          drawOnChartArea: false,
        },
        ticks: {
          color: appleModernColors.moderate,
        },
        border: {
          display: false,
        }
      },
    }
  }
}

/**
 * Get mini chart options (no axes, no legend)
 */
export const getMiniChartOptions = () => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: { enabled: false },
  },
  scales: {
    x: { display: false },
    y: { display: false },
  },
  elements: {
    point: { radius: 0 },
  }
})

// Legacy exports for backward compatibility
export const buildTremorCo2Data = buildCo2ChartData
export const buildTremorClimateData = buildClimateChartData
export const buildTremorQualityData = buildQualityChartData
export const buildTremorMiniCo2Data = buildMiniCo2ChartData
