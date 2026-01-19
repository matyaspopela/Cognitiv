import { useState, useEffect, useRef } from 'react'
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
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import { historyAPI, dataAPI, adminAPI } from '../../services/api'
import {
  buildCo2ChartData,
  buildClimateChartData,
  buildQualityChartData,
  hasValidChartData,
  getChartOptions,
  getClimateChartOptions,
} from '../../utils/charts'

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
import Card from '../ui/Card'
import Button from '../ui/Button'
import Badge from '../ui/Badge'
import ProgressBar from '../ui/ProgressBar'
import { Calendar, Clock, CalendarRange, ChevronLeft, ChevronRight, BarChart2, BookOpen, TrendingUp } from 'lucide-react'
import './BoardAnalysisView.css'

// Import analytics components
import {
  LessonDistributionChart,
  TeacherComparisonCard,
  HourlyHeatmap,
  StatsSummaryCards,
  LessonPeriodChart,
} from '../analytics'

// Fixed times for school day
const START_TIME_HOURS = 7
const START_TIME_MINUTES = 50
const END_TIME_HOURS = 16
const END_TIME_MINUTES = 0


/**
 * Filter series data to only include points within the requested time range
 * @param {Array} series - Array of series data points
 * @param {string} startISO - Start time ISO string
 * @param {string} endISO - End time ISO string
 * @returns {Array} Filtered series data
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

// Helper to create date with fixed time
const createDateWithTime = (date, hours, minutes) => {
  if (!date) return null
  const result = new Date(date)
  result.setHours(hours, minutes, 0, 0)
  return result
}

// Format date for display
const formatDisplayDate = (date) => {
  if (!date) return ''
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  })
}

/**
 * BoardAnalysisView Component
 * Comprehensive analysis section showing trend graphs, summary statistics,
 * and distribution graph (CRITICAL: preserves exact format from History view)
 */
const BoardAnalysisView = ({ deviceId, onClose }) => {
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState(null)
  const [series, setSeries] = useState([])
  const [co2Chart, setCo2Chart] = useState(null)
  const [climateChart, setClimateChart] = useState(null)
  const [qualityPieChart, setQualityPieChart] = useState(null)
  const [error, setError] = useState('')
  const [selectedPreset, setSelectedPreset] = useState('30d')
  const [startDate, setStartDate] = useState(null)
  const [endDate, setEndDate] = useState(null)
  const [deviceName, setDeviceName] = useState(deviceId)
  const [useRealTimeScale, setUseRealTimeScale] = useState(false) // Off by default
  const [activeTab, setActiveTab] = useState('analysis') // 'analysis', 'lessons', 'trends'

  // Fetch device display name
  useEffect(() => {
    const fetchDeviceName = async () => {
      try {
        // Use adminAPI since we're in the admin panel - it has all device info
        const response = await adminAPI.getDevices()
        if (response.data && response.data.status === 'success' && response.data.devices) {
          // Prefer MAC address matching since that's now the primary identifier
          const device = response.data.devices.find(
            (d) => d.mac_address === deviceId ||
              d.device_id === deviceId ||
              d.display_name === deviceId
          )
          if (device && device.display_name) {
            setDeviceName(device.display_name)
          } else if (device && device.device_id) {
            setDeviceName(device.device_id)
          } else if (device && device.mac_address) {
            setDeviceName(device.mac_address)
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

  // Get ISO strings with fixed times for API calls
  const getStartISO = () => {
    if (!startDate) return null
    const date = createDateWithTime(startDate, START_TIME_HOURS, START_TIME_MINUTES)
    return date ? date.toISOString() : null
  }

  const getEndISO = () => {
    if (!endDate) return null
    const date = createDateWithTime(endDate, END_TIME_HOURS, END_TIME_MINUTES)
    return date ? date.toISOString() : null
  }

  const applyPreset = (preset) => {
    setSelectedPreset(preset)

    if (preset === 'custom') {
      // For custom, ensure dates are initialized if they're not set
      if (!startDate || !endDate) {
        const now = new Date()
        setStartDate(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000))
        setEndDate(now)
      }
      return
    }

    const now = new Date()
    let days = 30

    switch (preset) {
      case '1d':
        days = 1
        break
      case '7d':
        days = 7
        break
      case '30d':
        days = 30
        break
      case '90d':
        days = 90
        break
      default:
        days = 30
    }

    setStartDate(new Date(now.getTime() - days * 24 * 60 * 60 * 1000))
    setEndDate(now)
  }

  // Initialize time range on mount (only if not already set)
  useEffect(() => {
    if (!deviceId) return

    // Only initialize if dates are not already set (preserves custom dates)
    if (!startDate || !endDate) {
      const now = new Date()
      setStartDate(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000))
      setEndDate(now)
    }
  }, [deviceId]) // Only depend on deviceId

  useEffect(() => {
    const loadAnalysisData = async () => {
      if (!deviceId) {
        return
      }

      if (!startDate || !endDate) {
        return
      }

      setLoading(true)
      setError('')
      // Clear previous chart data immediately to prevent stale display
      setCo2Chart(null)
      setClimateChart(null)
      setQualityPieChart(null)
      setSummary(null)
      setSeries([])

      try {
        const startIso = getStartISO()
        const endIso = getEndISO()

        if (!startIso || !endIso) {
          setError('Invalid date. Please check that both dates are selected.')
          setLoading(false)
          return
        }

        // Validate date range: start must be before end
        const startDateTime = new Date(startIso)
        const endDateTime = new Date(endIso)
        if (startDateTime >= endDateTime) {
          setError('Start date must be earlier than end date.')
          setLoading(false)
          return
        }


        let summaryData = null
        let seriesData = null

        // Try to load summary and series with error handling
        try {
          const summaryResponse = await historyAPI.getSummary(startIso, endIso, deviceId)
          // Check if response indicates success (not an error status)
          if (summaryResponse?.response?.status >= 400 || summaryResponse?.status >= 400) {
            // HTTP error - skip summary
          } else {
            const data = summaryResponse?.data || summaryResponse
            if (data?.status === 'success' || (data && !data.status)) {
              summaryData = data
            }
          }
        } catch (summaryError) {
          // Continue without summary if it fails
        }

        // Try series with appropriate bucket based on time range
        // Calculate time difference in days
        const daysDiff = (endDateTime.getTime() - startDateTime.getTime()) / (1000 * 60 * 60 * 24)

        // Choose bucket: raw data for <= 30 days, hourly aggregation for > 30 days
        const bucket = daysDiff <= 30 ? 'raw' : 'hour'

        let seriesLoaded = false

        try {
          const seriesResponse = await historyAPI.getSeries(startIso, endIso, bucket, deviceId)
          // Check for HTTP errors
          if (seriesResponse?.response?.status >= 400 || seriesResponse?.status >= 400) {
            const errorMsg = seriesResponse?.data?.error || seriesResponse?.response?.data?.error || 'HTTP error'
            console.error(`Series API error (bucket ${bucket}):`, errorMsg, seriesResponse)
          } else {
            const data = seriesResponse?.data || seriesResponse
            // Check if response indicates an error
            if (data?.status === 'error' || !data) {
              console.error(`Series API returned error (bucket ${bucket}):`, data)
            } else if (data?.status === 'success' && data.series && Array.isArray(data.series)) {
              seriesData = data
              seriesLoaded = true
            }
          }
        } catch (seriesError) {
          // Check for axios error response
          const errorMsg = seriesError?.response?.data?.error || seriesError?.message || 'Unknown error'
          console.error(`Series API exception (bucket ${bucket}):`, errorMsg, seriesError)
        }

        // Fallback: If history API failed, try dataAPI (similar to Dashboard)
        if (!seriesLoaded) {
          try {
            // Calculate hours from the actual time range
            const hoursDiff = Math.ceil((endDateTime.getTime() - startDateTime.getTime()) / (1000 * 60 * 60))
            // Cap at reasonable limit for dataAPI (it's less efficient than history API)
            const hours = Math.max(1, Math.min(hoursDiff, 30 * 24)) // Cap at 30 days, min 1 hour
            const dataResponse = await dataAPI.getData(hours, 1000, deviceId)
            const dataJson = dataResponse?.data

            if (dataJson?.status === 'success' && dataJson.data && Array.isArray(dataJson.data) && dataJson.data.length > 0) {
              // Convert dataAPI format to history series format for charts
              // Filter out invalid items before mapping
              const validDataItems = dataJson.data.filter(item => item && typeof item === 'object')
              const convertedSeries = validDataItems.map(item => ({
                bucket_start: item.timestamp_iso || item.timestamp,
                device_id: item.device_id || deviceId,
                co2: { avg: item.co2 ?? item.co2 ?? null },
                temperature: { avg: item.temperature ?? item.temp_avg ?? null },
                humidity: { avg: item.humidity ?? item.humidity_avg ?? null }
              }))

              // Sample if too many points
              let seriesToUse = convertedSeries
              if (seriesToUse.length > 500) {
                const step = Math.ceil(seriesToUse.length / 500)
                seriesToUse = seriesToUse.filter((_, index) => index % step === 0)
              }

              seriesData = {
                status: 'success',
                series: seriesToUse
              }
              seriesLoaded = true
            }
          } catch (dataAPIError) {
            // If dataAPI also fails, continue without series data
          }
        }

        // Only set error if both summary and series completely failed
        if (!summaryData && !seriesLoaded) {
          setError('Failed to load analysis data. Please try again later.')
        } else {
          // Set whatever data we have
          if (summaryData?.status === 'success') {
            setSummary(summaryData.summary)

            // Build quality distribution chart if available
            if (summaryData.summary?.co2_quality) {
              const pieChartData = buildQualityChartData(summaryData.summary.co2_quality)
              // Only set if there's valid data to display
              if (pieChartData && hasValidChartData(pieChartData)) {
                setQualityPieChart(pieChartData)
              }
            }
          }

          if (seriesData && (seriesData.status === 'success' || seriesData.series) && Array.isArray(seriesData.series) && seriesData.series.length > 0) {
            // Filter series to only include data within the requested time range
            const filteredSeries = filterSeriesInRange(seriesData.series, startIso, endIso)

            if (Array.isArray(filteredSeries) && filteredSeries.length > 0) {
              setSeries(filteredSeries)
              // Build charts with bucket info for gap detection
              try {
                const co2ChartData = buildCo2ChartData(filteredSeries, bucket)
                if (hasValidChartData(co2ChartData)) {
                  setCo2Chart(co2ChartData)
                }
              } catch (co2Error) {
                console.error('Error building CO2 chart data:', co2Error)
              }

              try {
                const climateChartData = buildClimateChartData(filteredSeries, bucket)
                if (hasValidChartData(climateChartData)) {
                  setClimateChart(climateChartData)
                }
              } catch (climateError) {
                console.error('Error building climate chart data:', climateError)
              }
            }
          }
        }
      } catch (error) {
        // Final error handling
        const errorMessage = error?.response?.data?.error || error?.message || 'Failed to load analysis data'
        console.error('Error loading analysis data:', {
          error,
          message: errorMessage,
          response: error?.response,
          deviceId,
          startDate,
          endDate
        })
        setError(errorMessage)
      } finally {
        setLoading(false)
      }
    }

    loadAnalysisData()
  }, [deviceId, startDate, endDate, useRealTimeScale])

  const safeValue = (value) => {
    return value === undefined || value === null || Number.isNaN(value) ? '–' : value
  }

  const handleExportCSV = async () => {
    if (!deviceId) {
      setError('Cannot export: missing device ID')
      return
    }

    try {
      const startIso = getStartISO()
      const endIso = getEndISO()

      if (!startIso || !endIso) {
        setError('Cannot export: invalid date. Please select both dates.')
        return
      }

      // Validate date range
      const startDateTime = new Date(startIso)
      const endDateTime = new Date(endIso)
      if (startDateTime >= endDateTime) {
        setError('Cannot export: start date must be earlier than end date.')
        return
      }

      const response = await historyAPI.exportCSV(startIso, endIso, deviceId)

      // Create blob and download
      const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url

      // Generate filename with device name and date range
      const deviceNameSafe = (deviceName || deviceId).replace(/[^a-z0-9]/gi, '_').toLowerCase()
      const startStr = startDateTime.toISOString().split('T')[0]
      const endStr = endDateTime.toISOString().split('T')[0]
      link.download = `cognitiv_${deviceNameSafe}_${startStr}_to_${endStr}.csv`

      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error exporting CSV:', error)
      setError('Failed to export CSV. Please try again later.')
    }
  }

  const qualityTableData = summary?.co2_quality || {}

  return (
    <div className="board-analysis-view">
      <div className="board-analysis-view__divider"></div>

      <div className="board-analysis-view__header">
        <div>
          <h2 className="board-analysis-view__title">{deviceName || deviceId}</h2>
        </div>
        <div className="board-analysis-view__header-actions">
          <Button
            variant="filled"
            size="medium"
            onClick={handleExportCSV}
            disabled={!startDate || !endDate}
            title="Export data to CSV"
          >
            📥 Export CSV
          </Button>
          <Button variant="outlined" size="medium" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="board-analysis-view__tabs">
        <button
          className={`board-analysis-view__tab ${activeTab === 'analysis' ? 'board-analysis-view__tab--active' : ''}`}
          onClick={() => setActiveTab('analysis')}
        >
          <BarChart2 size={16} />
          <span>Analysis</span>
        </button>
        <button
          className={`board-analysis-view__tab ${activeTab === 'lessons' ? 'board-analysis-view__tab--active' : ''}`}
          onClick={() => setActiveTab('lessons')}
        >
          <BookOpen size={16} />
          <span>Lessons</span>
        </button>
        <button
          className={`board-analysis-view__tab ${activeTab === 'trends' ? 'board-analysis-view__tab--active' : ''}`}
          onClick={() => setActiveTab('trends')}
        >
          <TrendingUp size={16} />
          <span>Trends</span>
        </button>
      </div>

      {/* Time Range Selection */}
      <Card className="board-analysis-view__time-range-card" elevation={1}>
        <div className="board-analysis-view__time-range">
          <div className="board-analysis-view__time-header">
            <div className="board-analysis-view__time-header-content">
              <Clock size={20} className="board-analysis-view__time-icon" />
              <span className="board-analysis-view__time-label">Time Period</span>
            </div>
            {startDate && endDate && (
              <div className="board-analysis-view__time-display">
                <Calendar size={14} />
                <span className="board-analysis-view__time-display-text">
                  {formatDisplayDate(startDate)} - {formatDisplayDate(endDate)}
                </span>
              </div>
            )}
          </div>

          <div className="board-analysis-view__time-presets">
            {[
              { value: '1d', label: '1 Day', icon: Calendar },
              { value: '7d', label: '7 Days', icon: Calendar },
              { value: '30d', label: '30 Days', icon: Calendar },
              { value: '90d', label: '90 Days', icon: Calendar },
              { value: 'custom', label: 'Custom', icon: CalendarRange }
            ].map((preset) => {
              const IconComponent = preset.icon
              return (
                <button
                  key={preset.value}
                  className={`board-analysis-view__time-preset-button ${selectedPreset === preset.value ? 'board-analysis-view__time-preset-button--active' : ''
                    }`}
                  onClick={() => applyPreset(preset.value)}
                  aria-pressed={selectedPreset === preset.value}
                >
                  <IconComponent size={16} className="board-analysis-view__time-preset-icon" />
                  <span className="board-analysis-view__time-preset-label">{preset.label}</span>
                </button>
              )
            })}
          </div>

          {selectedPreset === 'custom' && (
            <div className="board-analysis-view__time-custom">
              <div className="board-analysis-view__time-custom-header">
                <CalendarRange size={18} className="board-analysis-view__time-custom-icon" />
                <span className="board-analysis-view__time-custom-label">Select Date Range</span>
                <span className="board-analysis-view__time-custom-note">
                  (7:50 AM - 4:00 PM)
                </span>
              </div>
              <div className="board-analysis-view__date-picker-row">
                <div className="board-analysis-view__date-picker-group">
                  <label className="board-analysis-view__date-picker-label">Start Date</label>
                  <DatePicker
                    selected={startDate}
                    onChange={(date) => setStartDate(date)}
                    selectsStart
                    startDate={startDate}
                    endDate={endDate}
                    maxDate={endDate || new Date()}
                    dateFormat="dd MMM yyyy"
                    placeholderText="Select start date"
                    className="board-analysis-view__date-picker-input"
                    calendarClassName="board-analysis-view__calendar"
                    popperClassName="board-analysis-view__date-picker-popper"
                    renderCustomHeader={({
                      date,
                      decreaseMonth,
                      increaseMonth,
                      prevMonthButtonDisabled,
                      nextMonthButtonDisabled,
                    }) => (
                      <div className="board-analysis-view__calendar-header">
                        <button
                          onClick={decreaseMonth}
                          disabled={prevMonthButtonDisabled}
                          className="board-analysis-view__calendar-nav"
                          type="button"
                        >
                          <ChevronLeft size={18} />
                        </button>
                        <span className="board-analysis-view__calendar-month">
                          {date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                        </span>
                        <button
                          onClick={increaseMonth}
                          disabled={nextMonthButtonDisabled}
                          className="board-analysis-view__calendar-nav"
                          type="button"
                        >
                          <ChevronRight size={18} />
                        </button>
                      </div>
                    )}
                  />
                </div>

                <div className="board-analysis-view__date-picker-separator">
                  <span>→</span>
                </div>

                <div className="board-analysis-view__date-picker-group">
                  <label className="board-analysis-view__date-picker-label">End Date</label>
                  <DatePicker
                    selected={endDate}
                    onChange={(date) => setEndDate(date)}
                    selectsEnd
                    startDate={startDate}
                    endDate={endDate}
                    minDate={startDate}
                    maxDate={new Date()}
                    dateFormat="dd MMM yyyy"
                    placeholderText="Select end date"
                    className="board-analysis-view__date-picker-input"
                    calendarClassName="board-analysis-view__calendar"
                    popperClassName="board-analysis-view__date-picker-popper"
                    renderCustomHeader={({
                      date,
                      decreaseMonth,
                      increaseMonth,
                      prevMonthButtonDisabled,
                      nextMonthButtonDisabled,
                    }) => (
                      <div className="board-analysis-view__calendar-header">
                        <button
                          onClick={decreaseMonth}
                          disabled={prevMonthButtonDisabled}
                          className="board-analysis-view__calendar-nav"
                          type="button"
                        >
                          <ChevronLeft size={18} />
                        </button>
                        <span className="board-analysis-view__calendar-month">
                          {date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                        </span>
                        <button
                          onClick={increaseMonth}
                          disabled={nextMonthButtonDisabled}
                          className="board-analysis-view__calendar-nav"
                          type="button"
                        >
                          <ChevronRight size={18} />
                        </button>
                      </div>
                    )}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>

      {loading && (
        <Card className="board-analysis-view__loading" elevation={2}>
          <ProgressBar indeterminate />
          <p>Loading analysis data...</p>
        </Card>
      )}

      {error && (
        <Card className="board-analysis-view__error" elevation={2}>
          <div className="board-analysis-view__error-message">{error}</div>
        </Card>
      )}

      {!loading && !error && activeTab === 'analysis' && summary && (
        <>
          {/* Summary Statistics */}
          <Card className="board-analysis-view__summary" elevation={2}>
            <div className="board-analysis-view__summary-grid">
              <Card className="board-analysis-view__summary-item" elevation={1}>
                <div className="board-analysis-view__summary-label">CO₂ (ppm)</div>
                <div className="board-analysis-view__summary-value">{safeValue(summary.co2?.avg)}</div>
                <div className="board-analysis-view__summary-footer">
                  Min {safeValue(summary.co2?.min)} · Max {safeValue(summary.co2?.max)}
                </div>
              </Card>
              <Card className="board-analysis-view__summary-item" elevation={1}>
                <div className="board-analysis-view__summary-label">Temperature (°C)</div>
                <div className="board-analysis-view__summary-value">{safeValue(summary.temperature?.avg)}</div>
                <div className="board-analysis-view__summary-footer">
                  Min {safeValue(summary.temperature?.min)} · Max {safeValue(summary.temperature?.max)}
                </div>
              </Card>
              <Card className="board-analysis-view__summary-item" elevation={1}>
                <div className="board-analysis-view__summary-label">Humidity (%)</div>
                <div className="board-analysis-view__summary-value">{safeValue(summary.humidity?.avg)}</div>
                <div className="board-analysis-view__summary-footer">
                  Min {safeValue(summary.humidity?.min)} · Max {safeValue(summary.humidity?.max)}
                </div>
              </Card>
              <Card className="board-analysis-view__summary-item" elevation={1}>
                <div className="board-analysis-view__summary-label">Samples</div>
                <div className="board-analysis-view__summary-value">{safeValue(summary.samples)}</div>
                <div className="board-analysis-view__summary-footer">
                  From: {summary.range?.data_start || '–'}
                  <br />
                  To: {summary.range?.data_end || '–'}
                </div>
              </Card>
            </div>
          </Card>

          {/* Real time scale toggle */}
          <div className="board-analysis-view__chart-options">
            <label className="board-analysis-view__toggle">
              <input
                type="checkbox"
                checked={useRealTimeScale}
                onChange={(e) => setUseRealTimeScale(e.target.checked)}
              />
              <span className="board-analysis-view__toggle-label">
                Real time spacing
              </span>
              <span className="board-analysis-view__toggle-hint">
                {useRealTimeScale
                  ? '(points are spaced according to actual time)'
                  : '(points are evenly spaced)'}
              </span>
            </label>
          </div>

          {/* Trend Graphs */}
          <div className="board-analysis-view__charts">
            <Card className="board-analysis-view__chart-card" elevation={2}>
              <div className="board-analysis-view__chart-header">
                <h3 className="board-analysis-view__chart-title">CO₂</h3>
              </div>
              <div className="board-analysis-view__chart-container" style={{ height: '400px' }}>
                {co2Chart ? (
                  <Line
                    data={co2Chart}
                    options={getChartOptions('line', {
                      useRealTimeScale,
                      plugins: {
                        tooltip: {
                          callbacks: {
                            label: (context) => `${context.dataset.label}: ${context.parsed.y} ppm`
                          }
                        }
                      }
                    })}
                  />
                ) : (
                  <div className="board-analysis-view__empty">No data to display</div>
                )}
              </div>
            </Card>

            <Card className="board-analysis-view__chart-card" elevation={2}>
              <div className="board-analysis-view__chart-header">
                <h3 className="board-analysis-view__chart-title">Temperature & Humidity</h3>
              </div>
              <div className="board-analysis-view__chart-container" style={{ height: '400px' }}>
                {climateChart ? (
                  <Line data={climateChart} options={getClimateChartOptions({ useRealTimeScale })} />
                ) : (
                  <div className="board-analysis-view__empty">No data to display</div>
                )}
              </div>
            </Card>
          </div>

          {/* Distribution Graph */}
          <Card className="board-analysis-view__distribution-card" elevation={2}>
            <div className="board-analysis-view__distribution-header">
              <h3 className="board-analysis-view__distribution-title">Air Quality Distribution</h3>
            </div>
            <div className="board-analysis-view__distribution-content">
              <div className="board-analysis-view__distribution-chart" style={{ height: '400px' }}>
                {qualityPieChart ? (
                  <Doughnut
                    data={qualityPieChart}
                    options={{
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
                        }
                      }
                    }}
                  />
                ) : (
                  <div className="board-analysis-view__empty">No data to display.</div>
                )}
              </div>
            </div>
          </Card>

          {/* Quality Breakdown Table (matching History view format) */}
          <Card className="board-analysis-view__quality-table-card" elevation={2}>
            <div className="board-analysis-view__quality-header">
              <h3 className="board-analysis-view__quality-title">Air Quality</h3>
            </div>
            <table className="board-analysis-view__table">
              <thead>
                <tr>
                  <th>Level</th>
                  <th>Samples</th>
                  <th>Share</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                {qualityTableData.good !== undefined ? (
                  <>
                    <tr>
                      <td>
                        <Badge variant="standard" color="success">Good Quality</Badge>
                      </td>
                      <td>{qualityTableData.good || 0}</td>
                      <td>{qualityTableData.good_percent || 0}%</td>
                      <td>&lt; 1000 ppm</td>
                    </tr>
                    <tr>
                      <td>
                        <Badge variant="standard" color="warning">Moderate Quality</Badge>
                      </td>
                      <td>{qualityTableData.moderate || 0}</td>
                      <td>{qualityTableData.moderate_percent || 0}%</td>
                      <td>1000 – 1500 ppm</td>
                    </tr>
                    <tr>
                      <td>
                        <Badge variant="standard" color="warning">Poor Quality</Badge>
                      </td>
                      <td>{qualityTableData.high || 0}</td>
                      <td>{qualityTableData.high_percent || 0}%</td>
                      <td>1500 – 2000 ppm</td>
                    </tr>
                    <tr>
                      <td>
                        <Badge variant="standard" color="error">Critical Quality</Badge>
                      </td>
                      <td>{qualityTableData.critical || 0}</td>
                      <td>{qualityTableData.critical_percent || 0}%</td>
                      <td>&gt; 2000 ppm</td>
                    </tr>
                  </>
                ) : (
                  <tr>
                    <td colSpan="4" className="board-analysis-view__empty">
                      No data available yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </Card>
        </>
      )}

      {/* Lessons Tab - Annotated Data Analytics */}
      {!loading && !error && activeTab === 'lessons' && (
        <>
          <StatsSummaryCards
            deviceId={deviceId}
            startDate={getStartISO()}
            endDate={getEndISO()}
          />
          <div className="board-analysis-view__charts" style={{ marginTop: '1.5rem' }}>
            <LessonDistributionChart
              deviceId={deviceId}
              startDate={getStartISO()}
              endDate={getEndISO()}
            />
            <TeacherComparisonCard
              deviceId={deviceId}
              startDate={getStartISO()}
              endDate={getEndISO()}
            />
          </div>
          <div style={{ marginTop: '1.5rem' }}>
            <LessonPeriodChart
              deviceId={deviceId}
              startDate={getStartISO()}
              endDate={getEndISO()}
            />
          </div>
        </>
      )}

      {/* Trends Tab - Heatmap Analysis */}
      {!loading && !error && activeTab === 'trends' && (
        <>
          <HourlyHeatmap
            deviceId={deviceId}
            weeks={Math.ceil(
              ((endDate?.getTime() || Date.now()) - (startDate?.getTime() || Date.now() - 30 * 24 * 60 * 60 * 1000))
              / (7 * 24 * 60 * 60 * 1000)
            ) || 4}
          />
        </>
      )}
    </div>
  )
}

export default BoardAnalysisView

