/**
 * Shared chart building utilities for Chart.js
 * Converts API data to Chart.js-compatible format
 */

// Sci-Fi color palette
const scifiColors = {
  safe: '#00f2ea',      // Cyan / Electric Teal
  warning: '#ffc107',   // Amber / Gold  
  danger: '#ff0055',    // Magenta / Hot Pink
  temperature: '#00f2ea', // Cyan
  humidity: '#ffc107',    // Amber
  grid: 'rgba(255, 255, 255, 0.1)',
  text: '#9ca3af',
}

/**
 * Get color based on CO2 value
 */
export const getColorForCO2 = (co2) => {
  if (co2 < 800) return scifiColors.safe
  if (co2 < 1200) return scifiColors.warning
  return scifiColors.danger
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
      borderColor: scifiColors.safe,
      backgroundColor: (context) => {
        const chart = context.chart
        const { ctx, chartArea } = chart
        if (!chartArea) return 'rgba(0, 242, 234, 0.2)'
        const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top)
        gradient.addColorStop(0, 'rgba(0, 242, 234, 0)')
        gradient.addColorStop(1, 'rgba(0, 242, 234, 0.25)')
        return gradient
      },
      fill: true,
      tension: 0.4,
      pointRadius: 0,
      pointHoverRadius: 6,
      pointHoverBackgroundColor: scifiColors.safe,
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
        borderColor: scifiColors.temperature,
        backgroundColor: 'rgba(0, 242, 234, 0.05)',
        fill: false,
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 6,
        pointHoverBackgroundColor: scifiColors.temperature,
        pointHoverBorderColor: '#fff',
        pointHoverBorderWidth: 2,
        yAxisID: 'y',
      },
      {
        label: 'Humidity (%)',
        data: humidityValues,
        borderColor: scifiColors.humidity,
        backgroundColor: 'rgba(255, 193, 7, 0.05)',
        fill: false,
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 6,
        pointHoverBackgroundColor: scifiColors.humidity,
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
        '#10b981', // emerald
        '#f59e0b', // amber
        '#f97316', // orange
        '#ef4444', // red
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
 * Common Chart.js options for dark theme
 */
export const getChartOptions = (type = 'line', options = {}) => {
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
          color: scifiColors.text,
          usePointStyle: true,
          padding: 20,
          font: { size: 12 }
        }
      },
      tooltip: {
        enabled: true,
        backgroundColor: 'rgba(26, 28, 41, 0.95)',
        titleColor: '#fff',
        bodyColor: '#fff',
        borderColor: 'rgba(0, 242, 234, 0.3)',
        borderWidth: 1,
        padding: 12,
        cornerRadius: 8,
        displayColors: true,
      }
    },
    scales: type !== 'doughnut' ? {
      x: {
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
          color: scifiColors.grid,
        },
        ticks: {
          color: scifiColors.text,
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
          color: scifiColors.grid,
          drawBorder: false,
        },
        ticks: {
          color: scifiColors.text,
        },
        border: {
          display: false,
        }
      }
    } : undefined
  }

  // Merge with custom options
  return { ...baseOptions, ...options }
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
          color: scifiColors.temperature,
        },
        grid: {
          color: scifiColors.grid,
          drawBorder: false,
        },
        ticks: {
          color: scifiColors.temperature,
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
          color: scifiColors.humidity,
        },
        grid: {
          drawOnChartArea: false,
        },
        ticks: {
          color: scifiColors.humidity,
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
