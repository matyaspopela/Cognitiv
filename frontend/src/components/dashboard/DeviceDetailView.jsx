import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Line, Doughnut } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js'
import { dataAPI, historyAPI } from '../../services/api'
import { 
  buildCo2Chart, 
  buildClimateChart, 
  buildQualityPieChart,
  co2ChartOptions,
  climateChartOptions
} from '../../utils/charts'
import { getTimeWindowRange, getBucketSize, getHoursForStats, formatTimeLabel } from '../../utils/timeWindow'
import Card from '../ui/Card'
import TimeWindowSelector from './TimeWindowSelector'
import ProgressBar from '../ui/ProgressBar'
import './DeviceDetailView.css'

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
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
const Co2Graph = ({ deviceId, timeWindow }) => {
  const [chartData, setChartData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const loadChartData = async () => {
      if (!deviceId) return

      try {
        setLoading(true)
        setError(null)
        const { start, end } = getTimeWindowRange(timeWindow)
        const bucket = getBucketSize(timeWindow)

        const response = await historyAPI.getSeries(start, end, bucket, deviceId)
        
        if (response?.response?.status >= 400 || response?.status >= 400) {
          setError('Nepodařilo se načíst data')
          setChartData(null)
          return
        }

        const seriesData = response?.data || response

        if (seriesData?.status === 'success' && seriesData.series?.length > 0) {
          const data = buildCo2Chart(seriesData.series)
          
          // Format labels with time formatter (labels are bucket_start timestamps)
          if (data.labels && data.labels.length > 0) {
            data.labels = data.labels.map(label => {
              // label might be ISO string or formatted string, try to parse it
              const date = new Date(label)
              if (!isNaN(date.getTime())) {
                return formatTimeLabel(date, timeWindow)
              }
              return label
            })
          }

          setChartData(data)
        } else {
          setError('Žádná data k zobrazení')
          setChartData(null)
        }
      } catch (err) {
        console.error('Error loading CO2 graph:', err)
        setError('Chyba při načítání dat')
        setChartData(null)
      } finally {
        setLoading(false)
      }
    }

    loadChartData()
  }, [deviceId, timeWindow])

  // Use chart options (labels already formatted)
  const options = co2ChartOptions

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
const ClimateGraph = ({ deviceId, timeWindow }) => {
  const [chartData, setChartData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const loadChartData = async () => {
      if (!deviceId) return

      try {
        setLoading(true)
        setError(null)
        const { start, end } = getTimeWindowRange(timeWindow)
        const bucket = getBucketSize(timeWindow)

        const response = await historyAPI.getSeries(start, end, bucket, deviceId)
        
        if (response?.response?.status >= 400 || response?.status >= 400) {
          setError('Nepodařilo se načíst data')
          setChartData(null)
          return
        }

        const seriesData = response?.data || response

        if (seriesData?.status === 'success' && seriesData.series?.length > 0) {
          const data = buildClimateChart(seriesData.series)
          
          // Format labels with time formatter (labels are bucket_start timestamps)
          if (data.labels && data.labels.length > 0) {
            data.labels = data.labels.map(label => {
              // label might be ISO string or formatted string, try to parse it
              const date = new Date(label)
              if (!isNaN(date.getTime())) {
                return formatTimeLabel(date, timeWindow)
              }
              return label
            })
          }

          setChartData(data)
        } else {
          setError('Žádná data k zobrazení')
          setChartData(null)
        }
      } catch (err) {
        console.error('Error loading climate graph:', err)
        setError('Chyba při načítání dat')
        setChartData(null)
      } finally {
        setLoading(false)
      }
    }

    loadChartData()
  }, [deviceId, timeWindow])

  // Use chart options (labels already formatted)
  const options = climateChartOptions

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
        const { start, end } = getTimeWindowRange(timeWindow)

        const response = await historyAPI.getSummary(start, end, deviceId)
        
        if (response?.response?.status >= 400 || response?.status >= 400) {
          setError('Nepodařilo se načíst data')
          setQualityData(null)
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
              good: { count: good, percent: ((good / total) * 100).toFixed(1), label: 'Dobrá', color: 'rgba(76, 175, 80, 0.85)' },
              moderate: { count: moderate, percent: ((moderate / total) * 100).toFixed(1), label: 'Střední', color: 'rgba(255, 193, 7, 0.75)' },
              high: { count: high, percent: ((high / total) * 100).toFixed(1), label: 'Špatná', color: 'rgba(255, 152, 0, 0.75)' },
              critical: { count: critical, percent: ((critical / total) * 100).toFixed(1), label: 'Velmi špatná', color: 'rgba(244, 67, 54, 0.85)' }
            })
          } else {
            setQualityData(null)
          }
        } else {
          setError('Žádná data k zobrazení')
          setQualityData(null)
        }
      } catch (err) {
        console.error('Error loading quality distribution:', err)
        setError('Chyba při načítání dat')
        setQualityData(null)
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
        const { start, end } = getTimeWindowRange(timeWindow)

        const response = await historyAPI.getSummary(start, end, deviceId)
        
        if (response?.response?.status >= 400 || response?.status >= 400) {
          setError('Nepodařilo se načíst data')
          setChartData(null)
          return
        }

        const summaryData = response?.data || response

        if (summaryData?.status === 'success' && summaryData?.summary?.co2_quality) {
          const data = buildQualityPieChart(summaryData.summary.co2_quality)
          setChartData(data)
        } else {
          setError('Žádná data k zobrazení')
          setChartData(null)
        }
      } catch (err) {
        console.error('Error loading quality pie chart:', err)
        setError('Chyba při načítání dat')
        setChartData(null)
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

      <NumericalValues deviceId={deviceId} timeWindow={timeWindow} />

      <Co2Graph deviceId={deviceId} timeWindow={timeWindow} />

      <ClimateGraph deviceId={deviceId} timeWindow={timeWindow} />

      {/* Quality pie chart at bottom (where it was before) */}
      <QualityPieChart deviceId={deviceId} timeWindow={timeWindow} />
    </div>
  )
}

export default DeviceDetailView

