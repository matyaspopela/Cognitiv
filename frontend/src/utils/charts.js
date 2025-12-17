/**
 * Shared chart building utilities for Admin Panel and History views
 * Extracted from History.jsx to enable reuse across components
 */

/**
 * Gap detection threshold multiplier
 * If time between points exceeds (expectedBucket * GAP_THRESHOLD_MULTIPLIER), 
 * the line segment will be rendered as dotted
 */
const GAP_THRESHOLD_MULTIPLIER = 2.5

/**
 * Get expected bucket size in milliseconds based on bucket type
 * @param {string} bucket - Bucket type: 'raw', '10min', 'hour', 'day'
 * @returns {number} Expected bucket size in milliseconds
 */
export const getBucketSizeMs = (bucket) => {
  switch (bucket) {
    case 'raw':
      return 5 * 60 * 1000 // 5 minutes - assume raw data comes every ~5 min
    case '10min':
      return 10 * 60 * 1000 // 10 minutes
    case 'hour':
      return 60 * 60 * 1000 // 1 hour
    case 'day':
      return 24 * 60 * 60 * 1000 // 1 day
    default:
      return 10 * 60 * 1000 // default 10 minutes
  }
}

/**
 * Create segment styling callback for gap detection
 * Returns dotted line style when there's a large time gap between points
 * @param {Array<number>} timestamps - Array of timestamps in milliseconds
 * @param {number} gapThresholdMs - Threshold in ms to consider as gap
 * @returns {Function|undefined} Segment callback function for Chart.js, or undefined if invalid
 */
export const createGapSegmentStyle = (timestamps, gapThresholdMs) => {
  // Pre-validate timestamps array - need at least 2 points to have segments
  if (!Array.isArray(timestamps) || timestamps.length < 2) {
    return undefined
  }
  
  // Pre-validate threshold
  if (typeof gapThresholdMs !== 'number' || isNaN(gapThresholdMs) || gapThresholdMs <= 0) {
    return undefined
  }
  
  // Filter out invalid timestamps (NaN values)
  const validTimestamps = timestamps.filter(t => typeof t === 'number' && !isNaN(t))
  if (validTimestamps.length < 2) {
    return undefined
  }

  return (ctx) => {
    try {
      // Chart.js 4.x uses p0DataIndex/p1DataIndex on segment context
      let p0Index = ctx.p0DataIndex
      let p1Index = ctx.p1DataIndex
      
      // Validate indices
      if (typeof p0Index !== 'number' || typeof p1Index !== 'number') return undefined
      if (p0Index < 0 || p0Index >= timestamps.length) return undefined
      if (p1Index < 0 || p1Index >= timestamps.length) return undefined
      
      const t0 = timestamps[p0Index]
      const t1 = timestamps[p1Index]
      
      // Check for valid timestamp values (must be numbers and not NaN)
      if (typeof t0 !== 'number' || typeof t1 !== 'number') return undefined
      if (isNaN(t0) || isNaN(t1)) return undefined
      
      const timeDiff = Math.abs(t1 - t0)
      
      if (timeDiff > gapThresholdMs) {
        return [6, 6] // Dotted line for gaps
      }
      return undefined // Solid line for normal segments
    } catch (e) {
      // If anything goes wrong, just use solid line
      return undefined
    }
  }
}

/**
 * Creates a CO2 threshold gradient for chart fill
 * Green below 2000 ppm, red above 2000 ppm
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Object} chartArea - Chart area bounds
 * @param {Object} yScale - Y-axis scale
 * @returns {CanvasGradient} Gradient object
 */
export const createCo2ThresholdGradient = (ctx, chartArea, yScale) => {
  if (!ctx || !chartArea || !yScale) return 'rgba(128, 128, 128, 0.2)'
  
  const threshold = 1500
  const thresholdPixel = yScale.getPixelForValue(threshold)
  const topPixel = chartArea.top
  const bottomPixel = chartArea.bottom
  const chartHeight = bottomPixel - topPixel
  
  if (chartHeight <= 0) return 'rgba(128, 128, 128, 0.2)'
  
  const gradient = ctx.createLinearGradient(0, topPixel, 0, bottomPixel)
  
  // Calculate threshold position (0 = top, 1 = bottom)
  const thresholdPosition = (thresholdPixel - topPixel) / chartHeight
  const clampedPosition = Math.max(0.01, Math.min(0.99, thresholdPosition))
  
  // Red zone: top (high CO2) to threshold
  gradient.addColorStop(0, 'rgba(244, 67, 54, 0.25)')
  gradient.addColorStop(clampedPosition, 'rgba(244, 67, 54, 0.25)')
  
  // Green zone: threshold to bottom (low CO2)
  gradient.addColorStop(clampedPosition, 'rgba(76, 175, 80, 0.25)')
  gradient.addColorStop(1, 'rgba(76, 175, 80, 0.25)')
  
  return gradient
}

/**
 * Chart.js plugin for CO2 threshold-based gradient fill
 * Creates a gradient that is green below 2000 ppm and red above
 */
export const co2FillGradientPlugin = {
  id: 'co2FillGradient',
  beforeDatasetsDraw(chart) {
    const { ctx, chartArea, scales } = chart
    if (!chartArea || !scales.y) return
    
    const gradient = createCo2ThresholdGradient(ctx, chartArea, scales.y)
    
    // Apply gradient to datasets marked for CO2 threshold coloring
    chart.data.datasets.forEach((dataset, index) => {
      if (dataset._co2ThresholdFill) {
        const meta = chart.getDatasetMeta(index)
        if (meta && meta.dataset) {
          meta.dataset.options.backgroundColor = gradient
        }
      }
    })
  }
}

/**
 * Build CO2 trend chart data
 * @param {Array} data - Series data from historyAPI.getSeries()
 * @param {string} bucket - Bucket size for gap detection ('raw', '10min', 'hour', 'day')
 * @param {boolean} useTimeScale - If true, use time scale with real spacing; if false, use category scale
 * @returns {Object} Chart.js data object for Line chart with optional time scale and gap detection
 */
export const buildCo2Chart = (data, bucket = '10min', useTimeScale = true) => {
  // Store timestamps in milliseconds for time scale and gap detection
  const timestamps = data.map(item => new Date(item.bucket_start).getTime())
  const labels = data.map(item => item.bucket_start)
  const gapThresholdMs = getBucketSizeMs(bucket) * GAP_THRESHOLD_MULTIPLIER
  
  const datasetsMap = {}
  const timestampsMap = {}

  data.forEach((item, index) => {
    const key = item.device_id || 'Všechna'
    if (!datasetsMap[key]) {
      datasetsMap[key] = {
        label: `CO₂ • ${key}`,
        data: [],
        fill: true, // Enable fill for background color
        tension: 0.25,
        borderWidth: 2,
        pointRadius: 0, // Clean line, no dots
        pointHoverRadius: 6,
        // Constant line color
        borderColor: key === 'Všechna' ? 'rgba(103, 126, 221, 0.85)' : 'rgba(76, 175, 80, 0.85)',
        // Fallback background color (will be replaced by gradient from plugin)
        backgroundColor: 'rgba(76, 175, 80, 0.2)',
        // Marker for plugin to apply CO2 threshold gradient
        _co2ThresholdFill: true
      }
      timestampsMap[key] = []
    }
    const co2Value = item.co2?.avg
    const timestamp = timestamps[index]
    
    if (useTimeScale) {
      // Use {x, y} format for time scale - x is timestamp, y is value
      if (co2Value !== null && co2Value !== undefined && !isNaN(timestamp)) {
        datasetsMap[key].data.push({ x: timestamp, y: Number(co2Value) })
      } else if (!isNaN(timestamp)) {
        datasetsMap[key].data.push({ x: timestamp, y: null })
      }
    } else {
      // Use simple values for category scale
      datasetsMap[key].data.push(co2Value !== null && co2Value !== undefined ? Number(co2Value) : null)
    }
    timestampsMap[key].push(timestamp)
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
  Object.entries(datasetsMap).forEach(([key, dataset]) => {
    if (!dataset.borderColor) {
      dataset.borderColor = colors[index % colors.length]
      index += 1
    }
    // Add segment styling for gap detection (dotted lines for large gaps)
    try {
      const datasetTimestamps = timestampsMap[key]
      const segmentCallback = createGapSegmentStyle(datasetTimestamps, gapThresholdMs)
      if (segmentCallback) {
        dataset.segment = { borderDash: segmentCallback }
      }
    } catch (e) {
      // If segment styling fails, just skip it - chart will work without gap detection
      console.warn('Gap segment styling failed:', e)
    }
  })

  return {
    // Include labels only for category scale
    ...(useTimeScale ? {} : { labels }),
    datasets: Object.values(datasetsMap),
    // Store timestamps for reference if needed
    _timestamps: timestamps,
    _gapThresholdMs: gapThresholdMs
  }
}

/**
 * Build climate (Temperature & Humidity) trend chart data
 * @param {Array} data - Series data from historyAPI.getSeries()
 * @param {string} bucket - Bucket size for gap detection ('raw', '10min', 'hour', 'day')
 * @param {boolean} useTimeScale - If true, use time scale with real spacing; if false, use category scale
 * @returns {Object} Chart.js data object for dual-axis Line chart with optional time scale and gap detection
 */
export const buildClimateChart = (data, bucket = '10min', useTimeScale = true) => {
  // Store timestamps in milliseconds for time scale and gap detection
  const timestamps = data.map(item => new Date(item.bucket_start).getTime())
  const labels = data.map(item => item.bucket_start)
  const gapThresholdMs = getBucketSizeMs(bucket) * GAP_THRESHOLD_MULTIPLIER
  
  // Create segment styling callback - returns undefined if invalid
  const segmentCallback = createGapSegmentStyle(timestamps, gapThresholdMs)
  const segmentConfig = segmentCallback ? { segment: { borderDash: segmentCallback } } : {}

  let temperatureData, humidityData

  if (useTimeScale) {
    // Build data arrays with {x, y} format for time scale
    temperatureData = data.map((item, index) => {
      const val = item.temperature?.avg
      const timestamp = timestamps[index]
      if (isNaN(timestamp)) return null
      return { x: timestamp, y: val !== null && val !== undefined ? Number(val) : null }
    }).filter(p => p !== null)

    humidityData = data.map((item, index) => {
      const val = item.humidity?.avg
      const timestamp = timestamps[index]
      if (isNaN(timestamp)) return null
      return { x: timestamp, y: val !== null && val !== undefined ? Number(val) : null }
    }).filter(p => p !== null)
  } else {
    // Build simple value arrays for category scale
    temperatureData = data.map(item => {
      const val = item.temperature?.avg
      return val !== null && val !== undefined ? Number(val) : null
    })

    humidityData = data.map(item => {
      const val = item.humidity?.avg
      return val !== null && val !== undefined ? Number(val) : null
    })
  }

  return {
    // Include labels only for category scale
    ...(useTimeScale ? {} : { labels }),
    datasets: [
      {
        label: 'Teplota (°C)',
        data: temperatureData,
        yAxisID: 'y',
        borderColor: 'rgba(255, 112, 67, 0.85)',
        backgroundColor: 'rgba(255, 112, 67, 0.15)',
        tension: 0.25,
        borderWidth: 2,
        pointRadius: 0, // Clean line, no dots
        pointHoverRadius: 6,
        fill: false,
        ...segmentConfig
      },
      {
        label: 'Vlhkost (%)',
        data: humidityData,
        yAxisID: 'y1',
        borderColor: 'rgba(38, 198, 218, 0.85)',
        backgroundColor: 'rgba(38, 198, 218, 0.15)',
        tension: 0.25,
        borderWidth: 2,
        pointRadius: 0, // Clean line, no dots
        pointHoverRadius: 6,
        fill: false,
        ...segmentConfig
      }
    ],
    // Store timestamps for reference if needed
    _timestamps: timestamps,
    _gapThresholdMs: gapThresholdMs
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
      color: 'rgba(46, 125, 50, 0.9)'
    },
    {
      label: '1000-1500 ppm',
      value: moderate,
      color: 'rgba(102, 187, 106, 0.85)'
    },
    {
      label: '1500-2000 ppm',
      value: high,
      color: 'rgba(255, 152, 0, 0.85)'
    },
    {
      label: '2000+ ppm',
      value: critical,
      color: 'rgba(244, 67, 54, 0.9)'
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
 * Base chart options shared between time and category scale modes
 */
const baseChartOptions = {
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
  }
}

/**
 * X-axis config for time scale (real time spacing)
 */
const timeScaleXAxis = {
  type: 'time',
  time: {
    displayFormats: {
      minute: 'HH:mm',
      hour: 'HH:mm',
      day: 'd. MMM',
      week: 'd. MMM',
      month: 'MMM yyyy'
    },
    tooltipFormat: 'd. MMM yyyy HH:mm'
  },
  ticks: {
    maxRotation: 0,
    color: 'rgba(117, 117, 117, 0.9)',
    font: {
      family: 'Inter, sans-serif',
      size: 12
    },
    maxTicksLimit: 8
  },
  grid: { color: 'rgba(0, 0, 0, 0.08)' }
}

/**
 * X-axis config for category scale (even spacing)
 */
const categoryScaleXAxis = {
  type: 'category',
  ticks: {
    maxRotation: 45,
    color: 'rgba(117, 117, 117, 0.9)',
    font: {
      family: 'Inter, sans-serif',
      size: 11
    },
    maxTicksLimit: 10,
    callback: function(value, index, values) {
      // Format the label for display
      const label = this.getLabelForValue(value)
      if (!label) return ''
      const date = new Date(label)
      if (isNaN(date.getTime())) return label
      return date.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })
    }
  },
  grid: { color: 'rgba(0, 0, 0, 0.08)' }
}

/**
 * Common chart options for Line charts
 * Clean, minimalistic design - no point dots
 * Uses time scale for x-axis to show real time spacing between data points
 */
export const commonChartOptions = {
  ...baseChartOptions,
  scales: {
    x: timeScaleXAxis
  }
}

/**
 * Get chart options based on scale type
 * @param {boolean} useTimeScale - If true, use time scale; if false, use category scale
 * @returns {Object} Chart options object
 */
export const getCommonChartOptions = (useTimeScale = true) => ({
  ...baseChartOptions,
  scales: {
    x: useTimeScale ? timeScaleXAxis : categoryScaleXAxis
  }
})

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
 * Get CO2 chart options based on scale type
 * @param {boolean} useTimeScale - If true, use time scale; if false, use category scale
 * @returns {Object} CO2 chart options object
 */
export const getCo2ChartOptions = (useTimeScale = true) => {
  const baseOptions = getCommonChartOptions(useTimeScale)
  return {
    ...baseOptions,
    scales: {
      ...baseOptions.scales,
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
      ...baseOptions.plugins,
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
}

/**
 * Get climate chart options based on scale type
 * @param {boolean} useTimeScale - If true, use time scale; if false, use category scale
 * @returns {Object} Climate chart options object
 */
export const getClimateChartOptions = (useTimeScale = true) => {
  const baseOptions = getCommonChartOptions(useTimeScale)
  return {
    ...baseOptions,
    scales: {
      ...baseOptions.scales,
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
}

/**
 * Mini chart options for compact card display
 * Optimized for small spaces (80-100px height)
 * Uses time scale for proper spacing between data points
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
      type: 'time',
      display: false // Hide x-axis in mini charts but use time for spacing
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
 * @param {Array} data - Series data from historyAPI.getSeries()
 * @param {string} bucket - Bucket size for gap detection ('raw', '10min', 'hour', 'day')
 */
export const buildMiniCo2Chart = (data, bucket = '10min') => {
  // Store timestamps in milliseconds for time scale and gap detection
  const timestamps = data.map(item => new Date(item.bucket_start).getTime())
  const gapThresholdMs = getBucketSizeMs(bucket) * GAP_THRESHOLD_MULTIPLIER
  
  // Build data with {x, y} format for time scale
  const co2Data = data.map((item, index) => {
    const co2Value = item.co2?.avg ?? item.co2
    const timestamp = timestamps[index]
    if (isNaN(timestamp)) return null
    return { 
      x: timestamp, 
      y: co2Value !== null && co2Value !== undefined ? Number(co2Value) : null 
    }
  }).filter(p => p !== null)

  // Create segment styling callback - returns undefined if invalid
  const segmentCallback = createGapSegmentStyle(timestamps, gapThresholdMs)
  const segmentConfig = segmentCallback ? { segment: { borderDash: segmentCallback } } : {}

  return {
    datasets: [{
      label: 'CO₂',
      data: co2Data,
      fill: false,
      tension: 0.25,
      borderWidth: 2,
      pointRadius: 0, // Clean line, no dots
      pointHoverRadius: 6,
      borderColor: 'rgba(76, 175, 80, 0.85)', // Green color
      backgroundColor: 'rgba(76, 175, 80, 0.1)',
      ...segmentConfig
    }],
    _timestamps: timestamps,
    _gapThresholdMs: gapThresholdMs
  }
}

