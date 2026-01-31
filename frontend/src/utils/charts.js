/**
 * Shared chart building utilities for Chart.js
 * Converts API data to Chart.js-compatible format
 */

import { getCo2Color } from './colors'
import { theme } from '../design/theme'

// Monochrome chart palette
const monochromeColors = {
  good: theme.colors.safe,       
  moderate: theme.colors.warning,
  danger: theme.colors.danger,
  accent: theme.colors.warning,    // Temperature uses "warning" color (Zinc 400) or maybe Safe? Let's use Zinc 400
  grid: theme.colors.grid,
  textSecondary: theme.colors.text,
  textPrimary: theme.text.primary,
}

/**
 * Get color based on CO2 value
 */
export const getColorForCO2 = (co2) => {
  return getCo2Color(co2)
}

/**
 * Get segment color for CO2 chart
 */
export const getCO2SegmentColor = (context) => {
  if (!context || !context.dataset || !context.dataset.data) {
    return monochromeColors.good
  }

  const p0Index = context.p0DataIndex
  const p1Index = context.p1DataIndex
  const data = context.dataset.data

  if (p0Index === undefined || p1Index === undefined ||
    p0Index < 0 || p1Index < 0 ||
    p0Index >= data.length || p1Index >= data.length) {
    return monochromeColors.good
  }

  const v0 = data[p0Index]
  const v1 = data[p1Index]

  if (v0 === null || v0 === undefined || v1 === null || v1 === undefined) {
    return monochromeColors.good
  }

  const maxValue = Math.max(v0, v1)

  return getCo2Color(maxValue)
}

/**
 * Build CO2 chart data for Chart.js
 */
export const buildCo2ChartData = (data, bucket = '10min') => {
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

  return {
    labels,
    datasets: [{
      label: 'CO₂ (ppm)',
      data: values,
      segment: {
        borderColor: (ctx) => getCO2SegmentColor(ctx),
      },
      borderColor: monochromeColors.good,
      borderWidth: 2,
      backgroundColor: (context) => {
        const chart = context.chart
        const { ctx, chartArea } = chart
        if (!chartArea) return 'rgba(212, 212, 216, 0.1)' // Zinc 300 with alpha
        
        const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top)
        gradient.addColorStop(0, 'rgba(212, 212, 216, 0)')
        gradient.addColorStop(1, 'rgba(212, 212, 216, 0.15)')
        return gradient
      },
      fill: true,
      tension: 0.4,
      pointRadius: 0,
      pointHoverRadius: 6,
      pointHoverBackgroundColor: (ctx) => {
        const val = ctx.raw
        return getCo2Color(val)
      },
      pointHoverBorderColor: '#18181b', // Zinc 900
      pointHoverBorderWidth: 2,
    }]
  }
}

/**
 * Build climate (Temperature & Humidity) chart data for Chart.js
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
        borderColor: monochromeColors.accent, // Zinc 400
        backgroundColor: 'transparent',
        fill: false,
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 6,
        pointHoverBackgroundColor: monochromeColors.accent,
        pointHoverBorderColor: '#18181b',
        pointHoverBorderWidth: 2,
        yAxisID: 'y',
      },
      {
        label: 'Humidity (%)',
        data: humidityValues,
        borderColor: monochromeColors.good, // Zinc 300
        backgroundColor: 'transparent',
        fill: false,
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 6,
        pointHoverBackgroundColor: monochromeColors.good,
        pointHoverBorderColor: '#18181b',
        pointHoverBorderWidth: 2,
        yAxisID: 'y1',
        borderDash: [5, 5], // Dashed line for humidity to distinguish
      }
    ]
  }
}

/**
 * Build CO2 quality distribution data for Chart.js Doughnut
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
        theme.colors.safe,     // Zinc 300
        theme.colors.warning,  // Zinc 400
        '#d1d5db',             // Zinc 300 (variant) - Need distinct but monochrome?
        theme.colors.danger,   // White
      ],
      // Wait, let's use the palette properly.
      // Good: Safe (Zinc 300)
      // Moderate: Warning (Zinc 400)
      // High: Zinc 500?
      // Critical: Danger (White)
      // Or:
      // Good: Zinc 800
      // Moderate: Zinc 600
      // High: Zinc 400
      // Critical: Zinc 200/White
      
      // Let's use:
      // Good: #52525b (Zinc 600)
      // Moderate: #71717a (Zinc 500)
      // High: #a1a1aa (Zinc 400)
      // Critical: #ffffff (White)
      backgroundColor: [
        '#52525b',
        '#71717a',
        '#a1a1aa',
        '#ffffff'
      ],
      borderColor: theme.background.center, // Match bg to create gaps
      borderWidth: 2,
    }]
  }
}

/**
 * Build mini CO2 chart data for Chart.js
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
 * Common Chart.js options
 */
export const getChartOptions = (type = 'line', options = {}) => {
  const useTimeScale = options.useRealTimeScale === true

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
      color: monochromeColors.grid,
    },
    ticks: {
      color: monochromeColors.textSecondary,
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
      color: monochromeColors.grid,
    },
    ticks: {
      color: monochromeColors.textSecondary,
      maxRotation: 45,
      autoSkip: true,
      maxTicksLimit: 10,
      callback: function (value, index) {
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
          color: monochromeColors.textSecondary,
          usePointStyle: true,
          padding: 20,
          font: { size: 12 }
        }
      },
      tooltip: {
        enabled: true,
        backgroundColor: theme.colors.tooltipBg,
        titleColor: theme.text.primary,
        bodyColor: theme.text.secondary,
        borderColor: theme.colors.grid,
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
          color: monochromeColors.grid,
          drawBorder: false,
        },
        ticks: {
          color: monochromeColors.textSecondary,
        },
        border: {
          display: false,
        }
      }
    } : undefined
  }

  const { useRealTimeScale: _, ...restOptions } = options
  return { ...baseOptions, ...restOptions }
}

/**
 * Get climate chart options with dual Y axes
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
          color: monochromeColors.accent,
        },
        grid: {
          color: monochromeColors.grid,
          drawBorder: false,
        },
        ticks: {
          color: monochromeColors.accent,
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
          color: monochromeColors.good,
        },
        grid: {
          drawOnChartArea: false,
        },
        ticks: {
          color: monochromeColors.good,
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

export const buildTremorCo2Data = buildCo2ChartData
export const buildTremorClimateData = buildClimateChartData
export const buildTremorQualityData = buildQualityChartData
export const buildTremorMiniCo2Data = buildMiniCo2ChartData