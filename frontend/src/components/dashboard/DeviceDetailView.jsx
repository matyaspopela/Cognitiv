import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Line, Doughnut } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  TimeScale,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js'
import 'chartjs-adapter-date-fns'
import { dataAPI, historyAPI } from '../../services/api'
import { 
  buildCo2Chart, 
  buildClimateChart, 
  buildQualityPieChart,
  getCo2ChartOptions,
  getClimateChartOptions,
  co2FillGradientPlugin
} from '../../utils/charts'
import { getTimeWindowRange, getBucketSize, getHoursForStats } from '../../utils/timeWindow'
import Card from '../ui/Card'
import TimeWindowSelector from './TimeWindowSelector'
import ProgressBar from '../ui/ProgressBar'
import './DeviceDetailView.css'

/**
 * Check if chart data has actual displayable data points
 * @param {Object} chartData - Chart.js data object
 * @returns {boolean} True if there are valid data points to display
 */
const hasValidChartData = (chartData) => {
  if (!chartData || !chartData.datasets || !Array.isArray(chartData.datasets)) {
    return false
  }
  
  // Check if any dataset has at least one valid data point
  return chartData.datasets.some(dataset => {
    if (!dataset.data || !Array.isArray(dataset.data)) {
      return false
    }
    
    return dataset.data.some(point => {
      // Handle both {x, y} format and simple value format
      if (point === null || point === undefined) return false
      if (typeof point === 'object') {
        return point.y !== null && point.y !== undefined && !isNaN(point.y)
      }
      return !isNaN(point)
    })
  })
}

/**
 * Filter series data to only include points within the requested time range
 * This prevents stale/cached data from other time ranges being displayed
 * @param {Array} series - Array of series data points
 * @param {string} startISO - Start time ISO string
 * @param {string} endISO - End time ISO string
 * @returns {Array} Filtered series data
 */
const filterSeriesInRange = (series, startISO, endISO) => {
  if (!series || !Array.isArray(series)) return []
  
  const startTime = new Date(startISO).getTime()
  const endTime = new Date(endISO).getTime()
  
  // Filter out any points outside the requested range
  return series.filter(item => {
    if (!item.bucket_start) return false
    const pointTime = new Date(item.bucket_start).getTime()
    // Point must be within range (with small buffer for edge cases)
    return pointTime >= startTime && pointTime <= endTime
  })
}

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  TimeScale,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  co2FillGradientPlugin
)

/**
 * Numerical Values Section Component
 */
const NumericalValues = ({ deviceId, timeWindow }) => {
  const [values, setValues] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadValues = async () => {
      if (!deviceId) return

      try {
        setLoading(true)
        const hours = getHoursForStats(timeWindow)
        const response = await dataAPI.getStats(hours, deviceId)
        const payload = response?.data

        if (payload?.status === 'success' && payload?.stats) {
          const stats = payload.stats
          setValues({
            co2: stats.co2?.current ?? stats.co2?.avg ?? null,
            temperature: stats.temperature?.current ?? stats.temperature?.avg ?? null,
            humidity: stats.humidity?.current ?? stats.humidity?.avg ?? null,
            readings: stats.data_points ?? null
          })
        } else {
          setValues(null)
        }
      } catch (error) {
        console.error('Error loading numerical values:', error)
        setValues(null)
      } finally {
        setLoading(false)
      }
    }

    loadValues()
  }, [deviceId, timeWindow])

  if (loading) {
    return (
      <Card className="numerical-values">
        <div className="numerical-values__content">
          <ProgressBar indeterminate />
        </div>
      </Card>
    )
  }

  return (
    <Card className="numerical-values">
      <div className="numerical-values__content">
        <div className="numerical-values__item">
          <span className="numerical-values__label">CO₂:</span>
          <span className="numerical-values__value">
            {values?.co2 !== null && values?.co2 !== undefined
              ? `${Math.round(values.co2)} ppm`
              : '--'}
          </span>
        </div>
        <div className="numerical-values__divider" />
        <div className="numerical-values__item">
          <span className="numerical-values__label">Teplota:</span>
          <span className="numerical-values__value">
            {values?.temperature !== null && values?.temperature !== undefined
              ? `${values.temperature.toFixed(1)}°C`
              : '--'}
          </span>
        </div>
        <div className="numerical-values__divider" />
        <div className="numerical-values__item">
          <span className="numerical-values__label">Vlhkost:</span>
          <span className="numerical-values__value">
            {values?.humidity !== null && values?.humidity !== undefined
              ? `${Math.round(values.humidity)}%`
              : '--'}
          </span>
        </div>
        <div className="numerical-values__divider" />
        <div className="numerical-values__item">
          <span className="numerical-values__label">Počet měření:</span>
          <span className="numerical-values__value">
            {values?.readings !== null && values?.readings !== undefined
              ? values.readings.toLocaleString('cs-CZ')
              : '--'}
          </span>
        </div>
      </div>
    </Card>
  )
}

/**
 * CO2 Graph Component
 */
const Co2Graph = ({ deviceId, timeWindow, useRealTimeScale = true }) => {
  const [chartData, setChartData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const loadChartData = async () => {
      if (!deviceId) return

      try {
        setLoading(true)
        setError(null)
        setChartData(null) // Clear previous chart data immediately
        const { start, end } = getTimeWindowRange(timeWindow)
        const bucket = getBucketSize(timeWindow)

        const response = await historyAPI.getSeries(start, end, bucket, deviceId)
        
        if (response?.response?.status >= 400 || response?.status >= 400) {
          setError('Nepodařilo se načíst data')
          return
        }

        const seriesData = response?.data || response

        if (seriesData?.status === 'success' && seriesData.series?.length > 0) {
          // Filter series to only include data within the requested time range
          const filteredSeries = filterSeriesInRange(seriesData.series, start, end)
          
          if (filteredSeries.length > 0) {
            const data = buildCo2Chart(filteredSeries, bucket, useRealTimeScale)
            // Validate that chart data has actual displayable points
            if (hasValidChartData(data)) {
              setChartData(data)
            } else {
              setError('Žádná data k zobrazení')
            }
          } else {
            setError('Žádná data k zobrazení')
          }
        } else {
          setError('Žádná data k zobrazení')
        }
      } catch (err) {
        console.error('Error loading CO2 graph:', err)
        setError('Chyba při načítání dat')
      } finally {
        setLoading(false)
      }
    }

    loadChartData()
  }, [deviceId, timeWindow, useRealTimeScale])

  // Get chart options based on scale mode
  const options = getCo2ChartOptions(useRealTimeScale)

  return (
    <Card className="chart-container">
      <h3 className="chart-container__title">CO₂ Koncentrace</h3>
      <div className="chart-container__content">
        {loading ? (
          <div className="chart-container__loading">
            <ProgressBar indeterminate />
          </div>
        ) : error ? (
          <div className="chart-container__error">
            <p>{error}</p>
          </div>
        ) : chartData ? (
          <div className="chart-container__chart">
            <Line data={chartData} options={options} />
          </div>
        ) : (
          <div className="chart-container__empty">
            <p>Žádná data k zobrazení</p>
          </div>
        )}
      </div>
    </Card>
  )
}

/**
 * Climate Graph Component (Temperature + Humidity)
 */
const ClimateGraph = ({ deviceId, timeWindow, useRealTimeScale = true }) => {
  const [chartData, setChartData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const loadChartData = async () => {
      if (!deviceId) return

      try {
        setLoading(true)
        setError(null)
        setChartData(null) // Clear previous chart data immediately
        const { start, end } = getTimeWindowRange(timeWindow)
        const bucket = getBucketSize(timeWindow)

        const response = await historyAPI.getSeries(start, end, bucket, deviceId)
        
        if (response?.response?.status >= 400 || response?.status >= 400) {
          setError('Nepodařilo se načíst data')
          return
        }

        const seriesData = response?.data || response

        if (seriesData?.status === 'success' && seriesData.series?.length > 0) {
          // Filter series to only include data within the requested time range
          const filteredSeries = filterSeriesInRange(seriesData.series, start, end)
          
          if (filteredSeries.length > 0) {
            const data = buildClimateChart(filteredSeries, bucket, useRealTimeScale)
            // Validate that chart data has actual displayable points
            if (hasValidChartData(data)) {
              setChartData(data)
            } else {
              setError('Žádná data k zobrazení')
            }
          } else {
            setError('Žádná data k zobrazení')
          }
        } else {
          setError('Žádná data k zobrazení')
        }
      } catch (err) {
        console.error('Error loading climate graph:', err)
        setError('Chyba při načítání dat')
      } finally {
        setLoading(false)
      }
    }

    loadChartData()
  }, [deviceId, timeWindow, useRealTimeScale])

  // Get chart options based on scale mode
  const options = getClimateChartOptions(useRealTimeScale)

  return (
    <Card className="chart-container">
      <h3 className="chart-container__title">Teplota a Vlhkost</h3>
      <div className="chart-container__content">
        {loading ? (
          <div className="chart-container__loading">
            <ProgressBar indeterminate />
          </div>
        ) : error ? (
          <div className="chart-container__error">
            <p>{error}</p>
          </div>
        ) : chartData ? (
          <div className="chart-container__chart">
            <Line data={chartData} options={options} />
          </div>
        ) : (
          <div className="chart-container__empty">
            <p>Žádná data k zobrazení</p>
          </div>
        )}
      </div>
    </Card>
  )
}

/**
 * Quality Distribution Boxes Component
 * Shows color-differentiated boxes with percentages
 */
const QualityDistributionBoxes = ({ deviceId, timeWindow }) => {
  const [qualityData, setQualityData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const loadQualityData = async () => {
      if (!deviceId) return

      try {
        setLoading(true)
        setError(null)
        setQualityData(null) // Clear previous data immediately
        const { start, end } = getTimeWindowRange(timeWindow)

        const response = await historyAPI.getSummary(start, end, deviceId)
        
        if (response?.response?.status >= 400 || response?.status >= 400) {
          setError('Nepodařilo se načíst data')
          return
        }

        const summaryData = response?.data || response

        if (summaryData?.status === 'success' && summaryData?.summary?.co2_quality) {
          const co2Quality = summaryData.summary.co2_quality
          const good = typeof co2Quality.good === 'number' ? co2Quality.good : 0
          const moderate = typeof co2Quality.moderate === 'number' ? co2Quality.moderate : 0
          const high = typeof co2Quality.high === 'number' ? co2Quality.high : 0
          const critical = typeof co2Quality.critical === 'number' ? co2Quality.critical : 0
          
          const total = good + moderate + high + critical
          
          if (total > 0) {
            setQualityData({
              good: { count: good, percent: ((good / total) * 100).toFixed(1), label: 'Velmi dobrá', color: 'rgba(46, 125, 50, 0.9)' },
              moderate: { count: moderate, percent: ((moderate / total) * 100).toFixed(1), label: 'Dobrá', color: 'rgba(102, 187, 106, 0.85)' },
              high: { count: high, percent: ((high / total) * 100).toFixed(1), label: 'Špatná', color: 'rgba(255, 152, 0, 0.85)' },
              critical: { count: critical, percent: ((critical / total) * 100).toFixed(1), label: 'Velmi špatná', color: 'rgba(244, 67, 54, 0.9)' }
            })
          } else {
            setQualityData(null)
          }
        } else {
          setError('Žádná data k zobrazení')
        }
      } catch (err) {
        console.error('Error loading quality distribution:', err)
        setError('Chyba při načítání dat')
      } finally {
        setLoading(false)
      }
    }

    loadQualityData()
  }, [deviceId, timeWindow])

  if (loading) {
    return (
      <Card className="quality-distribution-boxes">
        <div className="quality-distribution-boxes__loading">
          <ProgressBar indeterminate />
        </div>
      </Card>
    )
  }

  if (error || !qualityData) {
    return (
      <Card className="quality-distribution-boxes">
        <div className="quality-distribution-boxes__error">
          <p>{error || 'Žádná data k zobrazení'}</p>
        </div>
      </Card>
    )
  }

  return (
    <Card className="quality-distribution-boxes" elevation={2}>
      <h3 className="quality-distribution-boxes__title">Rozložení kvality vzduchu</h3>
      <div className="quality-distribution-boxes__content">
        <div 
          className="quality-distribution-boxes__box"
          style={{ backgroundColor: qualityData.good.color }}
        >
          <span className="quality-distribution-boxes__label">{qualityData.good.label}:</span>
          <span className="quality-distribution-boxes__value">{qualityData.good.percent}%</span>
        </div>
        <div 
          className="quality-distribution-boxes__box"
          style={{ backgroundColor: qualityData.moderate.color }}
        >
          <span className="quality-distribution-boxes__label">{qualityData.moderate.label}:</span>
          <span className="quality-distribution-boxes__value">{qualityData.moderate.percent}%</span>
        </div>
        <div 
          className="quality-distribution-boxes__box"
          style={{ backgroundColor: qualityData.high.color }}
        >
          <span className="quality-distribution-boxes__label">{qualityData.high.label}:</span>
          <span className="quality-distribution-boxes__value">{qualityData.high.percent}%</span>
        </div>
        <div 
          className="quality-distribution-boxes__box"
          style={{ backgroundColor: qualityData.critical.color }}
        >
          <span className="quality-distribution-boxes__label">{qualityData.critical.label}:</span>
          <span className="quality-distribution-boxes__value">{qualityData.critical.percent}%</span>
        </div>
      </div>
    </Card>
  )
}

/**
 * Quality Pie Chart Component
 */
const QualityPieChart = ({ deviceId, timeWindow }) => {
  const [chartData, setChartData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const loadChartData = async () => {
      if (!deviceId) return

      try {
        setLoading(true)
        setError(null)
        setChartData(null) // Clear previous chart data immediately
        const { start, end } = getTimeWindowRange(timeWindow)

        const response = await historyAPI.getSummary(start, end, deviceId)
        
        if (response?.response?.status >= 400 || response?.status >= 400) {
          setError('Nepodařilo se načíst data')
          return
        }

        const summaryData = response?.data || response

        if (summaryData?.status === 'success' && summaryData?.summary?.co2_quality) {
          const data = buildQualityPieChart(summaryData.summary.co2_quality)
          // buildQualityPieChart returns null if no valid data
          if (data && hasValidChartData(data)) {
            setChartData(data)
          } else {
            setError('Žádná data k zobrazení')
          }
        } else {
          setError('Žádná data k zobrazení')
        }
      } catch (err) {
        console.error('Error loading quality pie chart:', err)
        setError('Chyba při načítání dat')
      } finally {
        setLoading(false)
      }
    }

    loadChartData()
  }, [deviceId, timeWindow])

  const pieChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right',
        labels: {
          font: {
            family: 'Inter, sans-serif',
            size: 12
          },
          color: 'rgba(33, 33, 33, 0.9)',
          padding: 12
        }
      },
      tooltip: {
        backgroundColor: 'rgba(33, 33, 33, 0.9)',
        titleColor: '#fff',
        bodyColor: '#fff',
        padding: 12,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        cornerRadius: 8
      }
    }
  }

  return (
    <Card className="chart-container chart-container--pie">
      <h3 className="chart-container__title">Rozložení kvality vzduchu</h3>
      <div className="chart-container__content">
        {loading ? (
          <div className="chart-container__loading">
            <ProgressBar indeterminate />
          </div>
        ) : error ? (
          <div className="chart-container__error">
            <p>{error}</p>
          </div>
        ) : chartData ? (
          <div className="chart-container__chart chart-container__chart--pie">
            <Doughnut data={chartData} options={pieChartOptions} />
          </div>
        ) : (
          <div className="chart-container__empty">
            <p>Žádná data k zobrazení</p>
          </div>
        )}
      </div>
    </Card>
  )
}

/**
 * DeviceDetailView Component
 * Complete device detail view with all graphs and numerical values
 */
const DeviceDetailView = ({ deviceId, timeWindow, onTimeWindowChange }) => {
  const [deviceName, setDeviceName] = useState(deviceId)
  const [useRealTimeScale, setUseRealTimeScale] = useState(true)

  // Fetch device display name
  useEffect(() => {
    const fetchDeviceName = async () => {
      try {
        const response = await dataAPI.getDevices()
        if (response.data && response.data.devices) {
          const device = response.data.devices.find(
            (d) => d.device_id === deviceId || 
                   d.mac_address === deviceId || 
                   d.display_name === deviceId
          )
          if (device && device.display_name) {
            setDeviceName(device.display_name)
          } else if (device && device.device_id) {
            setDeviceName(device.device_id)
          }
        }
      } catch (error) {
        // Keep original deviceId if fetch fails
        console.error('Error fetching device name:', error)
      }
    }

    if (deviceId) {
      fetchDeviceName()
    }
  }, [deviceId])

  return (
    <div className="device-detail-view">
      <div className="device-detail-view__header">
        <h2 className="device-detail-view__title">{deviceName || deviceId}</h2>
        <Link to="/dashboard" className="device-detail-view__back-link">
          ← Zpět na přehled
        </Link>
      </div>

      {/* Quality distribution boxes at top */}
      <QualityDistributionBoxes deviceId={deviceId} timeWindow={timeWindow} />

      <TimeWindowSelector value={timeWindow} onChange={onTimeWindowChange} />

      {/* Real time scale toggle */}
      <div className="device-detail-view__chart-options">
        <label className="device-detail-view__toggle">
          <input
            type="checkbox"
            checked={useRealTimeScale}
            onChange={(e) => setUseRealTimeScale(e.target.checked)}
          />
          <span className="device-detail-view__toggle-label">
            Reálné časové vzdálenosti
          </span>
          <span className="device-detail-view__toggle-hint">
            {useRealTimeScale 
              ? '(body jsou rozmístěny podle skutečného času)' 
              : '(body jsou rozmístěny rovnoměrně)'}
          </span>
        </label>
      </div>

      <NumericalValues deviceId={deviceId} timeWindow={timeWindow} />

      <Co2Graph deviceId={deviceId} timeWindow={timeWindow} useRealTimeScale={useRealTimeScale} />

      <ClimateGraph deviceId={deviceId} timeWindow={timeWindow} useRealTimeScale={useRealTimeScale} />

      {/* Quality pie chart at bottom (where it was before) */}
      <QualityPieChart deviceId={deviceId} timeWindow={timeWindow} />
    </div>
  )
}

export default DeviceDetailView

