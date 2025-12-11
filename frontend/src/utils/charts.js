/**
 * Shared chart building utilities for Admin Panel and History views
 * Extracted from History.jsx to enable reuse across components
 */

/**
 * Build CO2 trend chart data
 * @param {Array} data - Series data from historyAPI.getSeries()
 * @returns {Object} Chart.js data object for Line chart
 */
export const buildCo2Chart = (data) => {
  const labels = data.map(item => item.bucket_start)
  const datasetsMap = {}

  data.forEach(item => {
    const key = item.device_id || 'Všechna'
    if (!datasetsMap[key]) {
      datasetsMap[key] = {
        label: `CO₂ • ${key}`,
        data: [],
        fill: false,
        tension: 0.25,
        borderWidth: 2,
        pointRadius: 0, // Clean line, no dots
        pointHoverRadius: 6,
        borderColor: key === 'Všechna' ? 'rgba(103, 126, 221, 0.85)' : undefined
      }
    }
    const co2Value = item.co2?.avg
    datasetsMap[key].data.push(co2Value !== null && co2Value !== undefined ? Number(co2Value) : null)
  })

  const colors = [
    'rgba(103, 126, 221, 0.85)',  // Soft blue
    'rgba(156, 136, 255, 0.85)',  // Soft purple
    'rgba(79, 172, 254, 0.85)',  // Light blue
    'rgba(124, 179, 66, 0.85)',  // Soft green
    'rgba(255, 112, 67, 0.85)',  // Soft coral
    'rgba(171, 71, 188, 0.85)',  // Soft violet
    'rgba(38, 198, 218, 0.85)',  // Soft cyan
    'rgba(255, 167, 38, 0.85)'   // Soft orange (fallback)
  ]

  let index = 0
  Object.values(datasetsMap).forEach(dataset => {
    if (!dataset.borderColor) {
      dataset.borderColor = colors[index % colors.length]
      index += 1
    }
  })

  return {
    labels,
    datasets: Object.values(datasetsMap)
  }
}

/**
 * Build climate (Temperature & Humidity) trend chart data
 * @param {Array} data - Series data from historyAPI.getSeries()
 * @returns {Object} Chart.js data object for dual-axis Line chart
 */
export const buildClimateChart = (data) => {
  const labels = data.map(item => item.bucket_start)
  return {
    labels,
    datasets: [
      {
        label: 'Teplota (°C)',
        data: data.map(item => {
          const val = item.temperature?.avg
          return val !== null && val !== undefined ? Number(val) : null
        }),
        yAxisID: 'y',
        borderColor: 'rgba(255, 112, 67, 0.85)',
        backgroundColor: 'rgba(255, 112, 67, 0.15)',
        tension: 0.25,
        borderWidth: 2,
        pointRadius: 0, // Clean line, no dots
        pointHoverRadius: 6,
        fill: false
      },
      {
        label: 'Vlhkost (%)',
        data: data.map(item => {
          const val = item.humidity?.avg
          return val !== null && val !== undefined ? Number(val) : null
        }),
        yAxisID: 'y1',
        borderColor: 'rgba(38, 198, 218, 0.85)',
        backgroundColor: 'rgba(38, 198, 218, 0.15)',
        tension: 0.25,
        borderWidth: 2,
        pointRadius: 0, // Clean line, no dots
        pointHoverRadius: 6,
        fill: false
      }
    ]
  }
}

/**
 * Build CO2 quality distribution Doughnut chart data
 * CRITICAL: Preserves exact format from History view
 * @param {Object} co2Quality - Quality distribution object from historyAPI.getSummary()
 * @param {number} co2Quality.good - Count of good quality readings
 * @param {number} co2Quality.moderate - Count of moderate quality readings
 * @param {number} co2Quality.high - Count of high quality readings
 * @param {number} co2Quality.critical - Count of critical quality readings
 * @returns {Object|null} Chart.js data object for Doughnut chart, or null if no data
 */
export const buildQualityPieChart = (co2Quality) => {
  if (!co2Quality) {
    return null
  }

  // Ensure we use count values, not percentages
  const good = typeof co2Quality.good === 'number' ? co2Quality.good : 0
  const moderate = typeof co2Quality.moderate === 'number' ? co2Quality.moderate : 0
  const high = typeof co2Quality.high === 'number' ? co2Quality.high : 0
  const critical = typeof co2Quality.critical === 'number' ? co2Quality.critical : 0

  const data = [
    {
      label: '< 1000 ppm',
      value: good,
      color: 'rgba(76, 175, 80, 0.85)'
    },
    {
      label: '1000-1500 ppm',
      value: moderate,
      color: 'rgba(255, 193, 7, 0.75)'
    },
    {
      label: '1500-2000 ppm',
      value: high,
      color: 'rgba(255, 152, 0, 0.75)'
    },
    {
      label: '2000+ ppm',
      value: critical,
      color: 'rgba(244, 67, 54, 0.85)'
    }
  ]

  // Filter out categories with 0 values for pie chart display
  // (pie charts can't show slices with 0 value)
  const nonZeroData = data.filter(item => item.value > 0)

  if (nonZeroData.length === 0) {
    return null
  }

  const total = nonZeroData.reduce((sum, item) => sum + item.value, 0)
  const chartData = nonZeroData.map(item => item.value)
  const labels = nonZeroData.map(item => {
    const percent = ((item.value / total) * 100).toFixed(1)
    return `${item.label} (${percent}%)`
  })
  const colors = nonZeroData.map(item => item.color)

  return {
    labels,
    datasets: [{
      data: chartData,
      backgroundColor: colors,
      borderColor: colors,
      borderWidth: 2
    }]
  }
}

/**
 * Common chart options for Line charts
 * Clean, minimalistic design - no point dots
 */
export const commonChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'top',
      labels: {
        font: {
          family: 'Inter, sans-serif',
          size: 12
        },
        color: 'rgba(33, 33, 33, 0.9)'
      }
    },
    tooltip: {
      backgroundColor: 'rgba(33, 33, 33, 0.9)',
      titleColor: '#fff',
      titleFont: {
        family: 'Inter, sans-serif',
        size: 14,
        weight: '600'
      },
      bodyColor: '#fff',
      bodyFont: {
        family: 'Inter, sans-serif',
        size: 13
      },
      padding: 12,
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.1)',
      boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.2)',
      cornerRadius: 8
    }
  },
  scales: {
    x: {
      ticks: {
        maxRotation: 0,
        color: 'rgba(117, 117, 117, 0.9)',
        font: {
          family: 'Inter, sans-serif',
          size: 12
        }
      },
      grid: { color: 'rgba(0, 0, 0, 0.08)' }
    }
  }
}

/**
 * CO2 chart specific options
 * Includes threshold annotations
 */
export const co2ChartOptions = {
  ...commonChartOptions,
  scales: {
    ...commonChartOptions.scales,
    y: {
      title: {
        display: true,
        text: 'CO₂ (ppm)',
        font: {
          family: 'Inter, sans-serif',
          size: 13,
          weight: '500'
        },
        color: 'rgba(117, 117, 117, 0.9)'
      },
      grid: { color: 'rgba(0, 0, 0, 0.08)' },
      ticks: {
        color: 'rgba(117, 117, 117, 0.9)',
        font: {
          family: 'Inter, sans-serif',
          size: 12
        }
      }
    }
  },
  plugins: {
    ...commonChartOptions.plugins,
    annotation: {
      annotations: {
        moderate: {
          type: 'line',
          yMin: 1000,
          yMax: 1000,
          borderColor: 'rgba(255, 193, 7, 0.6)',
          borderWidth: 2,
          borderDash: [6, 6],
          label: {
            content: '1000 ppm',
            enabled: true,
            position: 'start',
            backgroundColor: 'rgba(33, 33, 33, 0.9)',
            color: '#fff',
            font: {
              family: 'Inter, sans-serif',
              size: 12
            }
          }
        },
        high: {
          type: 'line',
          yMin: 1500,
          yMax: 1500,
          borderColor: 'rgba(255, 152, 0, 0.6)',
          borderWidth: 2,
          borderDash: [6, 6],
          label: {
            content: '1500 ppm',
            enabled: true,
            position: 'start',
            backgroundColor: 'rgba(33, 33, 33, 0.9)',
            color: '#fff',
            font: {
              family: 'Inter, sans-serif',
              size: 12
            }
          }
        }
      }
    }
  }
}

/**
 * Climate chart specific options
 * Dual-axis for Temperature (left) and Humidity (right)
 */
export const climateChartOptions = {
  ...commonChartOptions,
  scales: {
    ...commonChartOptions.scales,
    y: {
      position: 'left',
      title: {
        display: true,
        text: 'Teplota (°C)',
        font: {
          family: 'Inter, sans-serif',
          size: 13,
          weight: '500'
        },
        color: 'rgba(117, 117, 117, 0.9)'
      },
      grid: { color: 'rgba(0, 0, 0, 0.08)' },
      ticks: {
        color: 'rgba(117, 117, 117, 0.9)',
        font: {
          family: 'Inter, sans-serif',
          size: 12
        }
      }
    },
    y1: {
      position: 'right',
      title: {
        display: true,
        text: 'Vlhkost (%)',
        font: {
          family: 'Inter, sans-serif',
          size: 13,
          weight: '500'
        },
        color: 'rgba(117, 117, 117, 0.9)'
      },
      grid: { drawOnChartArea: false },
      ticks: {
        color: 'rgba(117, 117, 117, 0.9)',
        font: {
          family: 'Inter, sans-serif',
          size: 12
        }
      }
    }
  }
}

/**
 * Mini chart options for compact card display
 * Optimized for small spaces (80-100px height)
 */
export const miniChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: false // Hide legend in mini charts
    },
    tooltip: {
      backgroundColor: 'rgba(33, 33, 33, 0.9)',
      titleColor: '#fff',
      bodyColor: '#fff',
      padding: 8,
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.1)',
      cornerRadius: 6
    }
  },
  scales: {
    x: {
      display: false // Hide x-axis in mini charts
    },
    y: {
      display: true,
      grid: { 
        color: 'rgba(0, 0, 0, 0.05)',
        drawBorder: false
      },
      ticks: {
        color: 'rgba(117, 117, 117, 0.7)',
        font: {
          family: 'Inter, sans-serif',
          size: 10
        },
        maxTicksLimit: 4
      }
    }
  }
}

/**
 * Build mini CO2 chart data with green color
 * Used specifically for board cards
 */
export const buildMiniCo2Chart = (data) => {
  const labels = data.map(item => item.bucket_start)
  
  // Extract CO2 values
  const co2Values = data.map(item => {
    const co2Value = item.co2?.avg ?? item.co2
    return co2Value !== null && co2Value !== undefined ? Number(co2Value) : null
  })

  return {
    labels,
    datasets: [{
      label: 'CO₂',
      data: co2Values,
      fill: false,
      tension: 0.25,
      borderWidth: 2,
      pointRadius: 0, // Clean line, no dots
      pointHoverRadius: 6,
      borderColor: 'rgba(76, 175, 80, 0.85)', // Green color
      backgroundColor: 'rgba(76, 175, 80, 0.1)'
    }]
  }
}

