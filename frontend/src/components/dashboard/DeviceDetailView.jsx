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
import { getTimeWindowRange, getBucketSize } from '../../utils/timeWindow'
import { theme } from '../../design/theme'
import Card from '../ui/Card'
import MinimalTimeSelector from './MinimalTimeSelector'
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
          color: theme.text.secondary,
          usePointStyle: true,
          padding: 20,
        }
      },
      tooltip: {
        backgroundColor: theme.colors.tooltipBg,
        titleColor: theme.text.primary,
        bodyColor: theme.text.secondary,
        borderColor: theme.colors.grid,
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
        <div className="device-detail-view__header-top">
          <Link to="/dashboard" className="device-detail-view__back-link">
            ← Back
          </Link>
          <div className="device-detail-view__controls">
            <MinimalTimeSelector value={timeWindow} onChange={onTimeWindowChange} />
          </div>
        </div>
        <h2 className="device-detail-view__title">{deviceName || deviceId}</h2>
      </div>

      <div className="device-detail-view__content">
        <KeyMetricsGrid deviceId={deviceId} timeWindow={timeWindow} />

        {/* Primary Trends */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <Co2Graph deviceId={deviceId} timeWindow={timeWindow} />
          <ClimateGraph deviceId={deviceId} timeWindow={timeWindow} />
        </div>



        {/* Secondary Distribution */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <QualityPieChart deviceId={deviceId} timeWindow={timeWindow} />
          {/* Placeholder or move Gauge here if needed, for now keeping PieChart full width or half */}
          <AirQualityGauge deviceId={deviceId} timeWindow={timeWindow} />
        </div>
      </div>
    </div>
  )
}

export default DeviceDetailView