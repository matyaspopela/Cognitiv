import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  TimeScale,
  ArcElement,
} from 'chart.js'
import { Line, Doughnut } from 'react-chartjs-2'
import 'chartjs-adapter-date-fns'
import { dataAPI, historyAPI } from '../../services/api'
import {
  buildCo2ChartData,
  buildClimateChartData,
  buildQualityChartData,
  hasValidChartData,
  getChartOptions,
  getClimateChartOptions,
} from '../../utils/charts'
import { getTimeWindowRange, getBucketSize, getHoursForStats } from '../../utils/timeWindow'
import Card from '../ui/Card'
import TimeWindowSelector from './TimeWindowSelector'
import ProgressBar from '../ui/ProgressBar'
import KeyMetricsGrid from './KeyMetricsGrid'
import AirQualityGauge from './AirQualityGauge'
import './DeviceDetailView.css'

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  TimeScale,
  ArcElement
)

/**
 * Filter series data to only include points within the requested time range
 */
const filterSeriesInRange = (series, startISO, endISO) => {
  if (!series || !Array.isArray(series)) return []

  const startTime = new Date(startISO).getTime()
  const endTime = new Date(endISO).getTime()

  return series.filter(item => {
    if (!item.bucket_start) return false
    const pointTime = new Date(item.bucket_start).getTime()
    return pointTime >= startTime && pointTime <= endTime
  })
}


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
        <div className="numerical-values__item numerical-values__item--co2">
          <span className="numerical-values__label">CO₂:</span>
          <span className="numerical-values__value numerical-values__value--co2">
            {values?.co2 !== null && values?.co2 !== undefined
              ? `${Math.round(values.co2)} ppm`
              : '--'}
          </span>
        </div>
        <div className="numerical-values__divider" />
        <div className="numerical-values__item">
          <span className="numerical-values__label">Temperature:</span>
          <span className="numerical-values__value">
            {values?.temperature !== null && values?.temperature !== undefined
              ? `${values.temperature.toFixed(1)}°C`
              : '--'}
          </span>
        </div>
        <div className="numerical-values__divider" />
        <div className="numerical-values__item">
          <span className="numerical-values__label">Humidity:</span>
          <span className="numerical-values__value">
            {values?.humidity !== null && values?.humidity !== undefined
              ? `${Math.round(values.humidity)}%`
              : '--'}
          </span>
        </div>
        <div className="numerical-values__divider" />
        <div className="numerical-values__item">
          <span className="numerical-values__label">Readings:</span>
          <span className="numerical-values__value">
            {values?.readings !== null && values?.readings !== undefined
              ? values.readings.toLocaleString('en-US')
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
  const chartRef = useRef(null)

  useEffect(() => {
    const loadChartData = async () => {
      if (!deviceId) return

      try {
        setLoading(true)
        setError(null)
        setChartData(null)
        const { start, end } = getTimeWindowRange(timeWindow)
        const bucket = getBucketSize(timeWindow)

        const response = await historyAPI.getSeries(start, end, bucket, deviceId)

        if (response?.response?.status >= 400 || response?.status >= 400) {
          setError('Failed to load data')
          return
        }

        const seriesData = response?.data || response

        if (seriesData?.status === 'success' && Array.isArray(seriesData.series) && seriesData.series.length > 0) {
          const filteredSeries = filterSeriesInRange(seriesData.series, start, end)

          if (filteredSeries.length > 0) {
            const data = buildCo2ChartData(filteredSeries, bucket)
            if (hasValidChartData(data)) {
              setChartData(data)
            } else {
              setError('No data to display')
            }
          } else {
            setError('No data to display')
          }
        } else {
          setError('No data to display')
        }
      } catch (err) {
        console.error('Error loading CO2 graph:', err)
        setError('Error loading data')
      } finally {
        setLoading(false)
      }
    }

    loadChartData()
  }, [deviceId, timeWindow])

  const options = getChartOptions('line', {
    plugins: {
      tooltip: {
        callbacks: {
          label: (context) => `${context.dataset.label}: ${context.parsed.y} ppm`
        }
      }
    }
  })

  return (
    <Card className="chart-container">
      <h3 className="chart-container__title">CO₂ Concentration</h3>
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
          <div className="chart-container__chart" style={{ height: '400px' }}>
            <Line ref={chartRef} data={chartData} options={options} />
          </div>
        ) : (
          <div className="chart-container__empty">
            <p>No data to display</p>
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
  const chartRef = useRef(null)

  useEffect(() => {
    const loadChartData = async () => {
      if (!deviceId) return

      try {
        setLoading(true)
        setError(null)
        setChartData(null)
        const { start, end } = getTimeWindowRange(timeWindow)
        const bucket = getBucketSize(timeWindow)

        const response = await historyAPI.getSeries(start, end, bucket, deviceId)

        if (response?.response?.status >= 400 || response?.status >= 400) {
          setError('Failed to load data')
          return
        }

        const seriesData = response?.data || response

        if (seriesData?.status === 'success' && Array.isArray(seriesData.series) && seriesData.series.length > 0) {
          const filteredSeries = filterSeriesInRange(seriesData.series, start, end)

          if (filteredSeries.length > 0) {
            const data = buildClimateChartData(filteredSeries, bucket)
            if (hasValidChartData(data)) {
              setChartData(data)
            } else {
              setError('No data to display')
            }
          } else {
            setError('No data to display')
          }
        } else {
          setError('No data to display')
        }
      } catch (err) {
        console.error('Error loading climate graph:', err)
        setError('Error loading data')
      } finally {
        setLoading(false)
      }
    }

    loadChartData()
  }, [deviceId, timeWindow])

  const options = getClimateChartOptions()

  return (
    <Card className="chart-container">
      <h3 className="chart-container__title">Temperature and Humidity</h3>
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
          <div className="chart-container__chart" style={{ height: '400px' }}>
            <Line ref={chartRef} data={chartData} options={options} />
          </div>
        ) : (
          <div className="chart-container__empty">
            <p>No data to display</p>
          </div>
        )}
      </div>
    </Card>
  )
}

/**
 * Quality Distribution Boxes Component
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
        setQualityData(null)
        const { start, end } = getTimeWindowRange(timeWindow)

        const response = await historyAPI.getSummary(start, end, deviceId)

        if (response?.response?.status >= 400 || response?.status >= 400) {
          setError('Failed to load data')
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
              good: { count: good, percent: ((good / total) * 100).toFixed(1), label: 'Very Good (< 1000 ppm)', color: '#10B981' },
              moderate: { count: moderate, percent: ((moderate / total) * 100).toFixed(1), label: 'Good (1000-1500 ppm)', color: '#F59E0B' },
              high: { count: high, percent: ((high / total) * 100).toFixed(1), label: 'Poor (1500-2000 ppm)', color: '#EF4444' },
              critical: { count: critical, percent: ((critical / total) * 100).toFixed(1), label: 'Very Poor (2000+ ppm)', color: '#DC2626' }
            })
          } else {
            setQualityData(null)
          }
        } else {
          setError('No data to display')
        }
      } catch (err) {
        console.error('Error loading quality distribution:', err)
        setError('Error loading data')
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
          <p>{error || 'No data to display'}</p>
        </div>
      </Card>
    )
  }

  return (
    <Card className="quality-distribution-boxes" elevation={2}>
      <h3 className="quality-distribution-boxes__title">Air Quality Distribution</h3>
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
        setChartData(null)
        const { start, end } = getTimeWindowRange(timeWindow)

        const response = await historyAPI.getSummary(start, end, deviceId)

        if (response?.response?.status >= 400 || response?.status >= 400) {
          setError('Failed to load data')
          return
        }

        const summaryData = response?.data || response

        if (summaryData?.status === 'success' && summaryData?.summary?.co2_quality) {
          const data = buildQualityChartData(summaryData.summary.co2_quality)
          if (hasValidChartData(data)) {
            setChartData(data)
          } else {
            setError('No data to display')
          }
        } else {
          setError('No data to display')
        }
      } catch (err) {
        console.error('Error loading quality pie chart:', err)
        setError('Error loading data')
      } finally {
        setLoading(false)
      }
    }

    loadChartData()
  }, [deviceId, timeWindow])

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right',
        labels: {
          color: '#586169',
          usePointStyle: true,
          padding: 20,
        }
      },
      tooltip: {
        backgroundColor: 'rgba(255, 255, 255, 0.96)',
        titleColor: '#16181C',
        bodyColor: '#586169',
        borderColor: 'rgba(229, 231, 235, 0.5)',
        borderWidth: 1,
        padding: 12,
        cornerRadius: 8,
        callbacks: {
          label: (context) => {
            const label = context.label || ''
            const value = context.parsed || 0
            const total = context.dataset.data.reduce((a, b) => a + b, 0)
            const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0
            return `${label}: ${percentage}%`
          }
        }
      }
    }
  }

  return (
    <Card className="chart-container chart-container--pie">
      <h3 className="chart-container__title">Air Quality Distribution</h3>
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
          <div className="chart-container__chart chart-container__chart--pie" style={{ height: '400px' }}>
            <Doughnut data={chartData} options={options} />
          </div>
        ) : (
          <div className="chart-container__empty">
            <p>No data to display</p>
          </div>
        )}
      </div>
    </Card>
  )
}

/**
 * DeviceDetailView Component
 */
const DeviceDetailView = ({ deviceId, timeWindow, onTimeWindowChange }) => {
  const [deviceName, setDeviceName] = useState(deviceId)

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
          ← Back to overview
        </Link>
      </div>

      <AirQualityGauge deviceId={deviceId} timeWindow={timeWindow} />

      <TimeWindowSelector value={timeWindow} onChange={onTimeWindowChange} />

      <KeyMetricsGrid deviceId={deviceId} timeWindow={timeWindow} />

      <Co2Graph deviceId={deviceId} timeWindow={timeWindow} />

      <ClimateGraph deviceId={deviceId} timeWindow={timeWindow} />

      <QualityPieChart deviceId={deviceId} timeWindow={timeWindow} />
    </div>
  )
}

export default DeviceDetailView
