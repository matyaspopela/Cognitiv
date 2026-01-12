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
import Chip from '../ui/Chip'
import TextField from '../ui/TextField'
import ProgressBar from '../ui/ProgressBar'
import './BoardAnalysisView.css'


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
  const [timeRange, setTimeRange] = useState({
    start: null,
    end: null
  })
  const [deviceName, setDeviceName] = useState(deviceId)
  const [useRealTimeScale, setUseRealTimeScale] = useState(true)

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

  const formatDateForInput = (date) => {
    if (!date) return ''
    if (typeof date === 'string') return date
    const pad = (n) => String(n).padStart(2, '0')
    const year = date.getFullYear()
    const month = pad(date.getMonth() + 1)
    const day = pad(date.getDate())
    const hours = pad(date.getHours())
    const minutes = pad(date.getMinutes())
    return `${year}-${month}-${day}T${hours}:${minutes}`
  }

  const toISOStringOrNull = (value) => {
    if (!value) return null
    if (typeof value !== 'string' && !(value instanceof Date)) {
      console.warn('Invalid date value type:', typeof value, value)
      return null
    }
    try {
      // Handle datetime-local format "YYYY-MM-DDTHH:mm" (no timezone)
      // Create Date object which interprets it as local time
      const date = new Date(value)
      if (isNaN(date.getTime())) {
        console.warn('Invalid date value (NaN):', value)
        return null
      }
      // Validate date is reasonable (not too far in past/future)
      const now = new Date()
      const minDate = new Date(now.getTime() - 10 * 365 * 24 * 60 * 60 * 1000) // 10 years ago
      const maxDate = new Date(now.getTime() + 1 * 365 * 24 * 60 * 60 * 1000) // 1 year in future
      if (date < minDate || date > maxDate) {
        console.warn('Date out of reasonable range:', value, date)
        return null
      }
      return date.toISOString()
    } catch (err) {
      console.error('Date conversion error:', err, value)
      return null
    }
  }

  const applyPreset = (preset) => {
    setSelectedPreset(preset)
    
    if (preset === 'custom') {
      // For custom, ensure dates are initialized if they're not set
      // Use current time range if available, otherwise default to 30 days
      if (!timeRange.start || !timeRange.end) {
        const now = new Date()
        const start = formatDateForInput(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000))
        const end = formatDateForInput(now)
        setTimeRange({ start, end })
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
    
    const start = formatDateForInput(new Date(now.getTime() - days * 24 * 60 * 60 * 1000))
    const end = formatDateForInput(now)
    setTimeRange({ start, end })
  }

  // Initialize time range on mount (only if not already set)
  useEffect(() => {
    if (!deviceId) return
    
    // Only initialize if dates are not already set (preserves custom dates)
    if (!timeRange.start || !timeRange.end) {
      const now = new Date()
      const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) // 30 days ago
      setTimeRange({
        start: formatDateForInput(start),
        end: formatDateForInput(now)
      })
    }
  }, [deviceId]) // Only depend on deviceId, not timeRange to avoid resetting custom dates

  useEffect(() => {
    const loadAnalysisData = async () => {
      if (!deviceId) {
        return
      }
      
      if (!timeRange.start || !timeRange.end) {
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
        const startIso = toISOStringOrNull(timeRange.start)
        const endIso = toISOStringOrNull(timeRange.end)

        if (!startIso || !endIso) {
          setError('Invalid date. Please check that both dates are correctly filled in.')
          setLoading(false)
          return
        }

        // Validate date range: start must be before end
        const startDate = new Date(startIso)
        const endDate = new Date(endIso)
        if (startDate >= endDate) {
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
        // Calculate time difference in days (reuse startDate and endDate from validation above)
        const daysDiff = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
        
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
            // Calculate hours from the actual time range (reuse startDate and endDate from validation above)
            const hoursDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60))
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
          timeRange
        })
        setError(errorMessage)
      } finally {
        setLoading(false)
      }
    }

    loadAnalysisData()
  }, [deviceId, timeRange.start, timeRange.end, useRealTimeScale])

  const safeValue = (value) => {
    return value === undefined || value === null || Number.isNaN(value) ? '–' : value
  }

  const handleExportCSV = async () => {
    if (!deviceId) {
      setError('Cannot export: missing device ID')
      return
    }

    try {
      const startIso = toISOStringOrNull(timeRange.start)
      const endIso = toISOStringOrNull(timeRange.end)

      if (!startIso || !endIso) {
        setError('Cannot export: invalid date. Please check that both dates are correctly filled in.')
        return
      }

      // Validate date range
      const startDate = new Date(startIso)
      const endDate = new Date(endIso)
      if (startDate >= endDate) {
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
      const startStr = startDate.toISOString().split('T')[0]
      const endStr = endDate.toISOString().split('T')[0]
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
            disabled={!timeRange.start || !timeRange.end}
            title="Export data to CSV"
          >
            📥 Export CSV
          </Button>
          <Button variant="outlined" size="medium" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>

      {/* Time Range Selection */}
      <Card className="board-analysis-view__time-range-card" elevation={1}>
        <div className="board-analysis-view__time-range">
          <div className="board-analysis-view__time-presets">
            <span className="board-analysis-view__time-label">Period:</span>
            {['1d', '7d', '30d', '90d', 'custom'].map((preset) => (
              <Chip
                key={preset}
                selected={selectedPreset === preset}
                onClick={() => applyPreset(preset)}
                className="board-analysis-view__time-preset-chip"
              >
                {preset === 'custom' ? 'Custom' : preset}
              </Chip>
            ))}
          </div>
          {selectedPreset === 'custom' && (
            <div className="board-analysis-view__time-custom">
              <TextField
                type="datetime-local"
                label="From"
                value={timeRange.start || ''}
                onChange={(e) => {
                  setTimeRange(prev => ({ ...prev, start: e.target.value }))
                }}
                className="board-analysis-view__time-input"
                fullWidth
              />
              <TextField
                type="datetime-local"
                label="To"
                value={timeRange.end || ''}
                onChange={(e) => {
                  setTimeRange(prev => ({ ...prev, end: e.target.value }))
                }}
                className="board-analysis-view__time-input"
                fullWidth
              />
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

      {!loading && !error && summary && (
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
                  <Line data={climateChart} options={getClimateChartOptions()} />
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
    </div>
  )
}

export default BoardAnalysisView

