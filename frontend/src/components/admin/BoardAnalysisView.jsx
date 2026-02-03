import { useState, useEffect } from 'react'
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
import { getTimeWindowRange, getBucketSize } from '../../utils/timeWindow'

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
import { BarChart2, BookOpen, TrendingUp, ChevronLeft, ChevronRight, Calendar } from 'lucide-react'
import './BoardAnalysisView.css'
import MinimalTimeSelector from '../dashboard/MinimalTimeSelector'

// Import analytics components
import {
  LessonDistributionChart,
  TeacherComparisonCard,
  HourlyHeatmap,
  StatsSummaryCards,
  LessonPeriodChart,
} from '../analytics'

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

const safeValue = (value) => {
  return value === undefined || value === null || Number.isNaN(value) ? '–' : value
}

// Helper for Lesson Dates (Week aligned)
const getLessonDateRange = (mode) => {
  const end = new Date()
  const start = new Date()

  if (mode === 'current_week') {
    const day = start.getDay()
    const diff = start.getDate() - day + (day === 0 ? -6 : 1)
    start.setDate(diff)
    start.setHours(0, 0, 0, 0)
  } else if (mode === 'last_week') {
    const day = end.getDay()
    const diff = end.getDate() - day + (day === 0 ? -6 : 1) - 7
    start.setDate(diff)
    start.setHours(0, 0, 0, 0)
    end.setDate(diff + 6)
    end.setHours(23, 59, 59, 999)
  } else if (mode === 'last_month') {
    start.setDate(end.getDate() - 30)
  }

  return {
    start: start.toISOString(),
    end: end.toISOString()
  }
}

/**
 * BoardAnalysisView Component
 */
const BoardAnalysisView = ({ deviceId, onClose }) => {
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState(null)
  const [series, setSeries] = useState([])
  const [co2Chart, setCo2Chart] = useState(null)
  const [climateChart, setClimateChart] = useState(null)
  const [qualityPieChart, setQualityPieChart] = useState(null)
  const [error, setError] = useState('')
  const [deviceName, setDeviceName] = useState(deviceId)
  const [useRealTimeScale, setUseRealTimeScale] = useState(false)
  const [activeTab, setActiveTab] = useState('analysis') // 'analysis', 'lessons', 'trends'

  // Separate time states
  const [analysisPreset, setAnalysisPreset] = useState('24h')
  const [analysisStartDate, setAnalysisStartDate] = useState(null)
  const [analysisEndDate, setAnalysisEndDate] = useState(null)

  const [lessonsPreset, setLessonsPreset] = useState('current_week')

  // Derived dates for Lessons tab
  const [lessonDates, setLessonDates] = useState(getLessonDateRange('current_week'))

  useEffect(() => {
    setLessonDates(getLessonDateRange(lessonsPreset))
  }, [lessonsPreset])

  // Initialize custom dates if needed
  useEffect(() => {
    if (analysisPreset === 'custom' && (!analysisStartDate || !analysisEndDate)) {
      const now = new Date()
      setAnalysisStartDate(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000))
      setAnalysisEndDate(now)
    }
  }, [analysisPreset])


  // Fetch device display name
  useEffect(() => {
    const fetchDeviceName = async () => {
      try {
        const response = await adminAPI.getDevices()
        if (response.data && response.data.status === 'success' && response.data.devices) {
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
        console.error('Error fetching device name:', error)
      }
    }

    if (deviceId) {
      fetchDeviceName()
    }
  }, [deviceId])

  // Load Analysis Data (Only when Analysis tab is active)
  useEffect(() => {
    const loadAnalysisData = async () => {
      if (!deviceId || activeTab !== 'analysis') return

      // Pre-check for custom mode to avoid stuck loading state
      if (analysisPreset === 'custom' && (!analysisStartDate || !analysisEndDate)) {
        return
      }

      setLoading(true)
      setError('')
      setCo2Chart(null)
      setClimateChart(null)
      setQualityPieChart(null)
      setSummary(null)
      setSeries([])

      try {
        let startIso, endIso
        let bucket = '10min' // Default

        if (analysisPreset === 'custom') {
          startIso = analysisStartDate.toISOString()
          endIso = analysisEndDate.toISOString()

          // Determine bucket dynamically for custom range
          const diffHours = Math.abs(analysisEndDate - analysisStartDate) / 36e5;
          const diffDays = diffHours / 24;

          // Override to match old logic: raw for anything <= 30 days
          if (diffDays <= 30) bucket = 'raw'
          else bucket = 'hour' // or day, but hour is safer for transition

        } else {
          const range = getTimeWindowRange(analysisPreset)
          startIso = range.start
          endIso = range.end

          // Override bucket selection to match previous behavior: raw for shorter durations
          if (analysisPreset === '24h' || analysisPreset === '7d' || analysisPreset === '1d') {
            bucket = 'raw'
          } else if (analysisPreset === '30d') {
            bucket = 'raw' // Even 30d was 'raw' in old logic (<= 30)
          } else {
            bucket = getBucketSize(analysisPreset)
          }
        }

        let summaryData = null
        let seriesData = null
        let lastError = null

        // Try to load summary
        try {
          const summaryResponse = await historyAPI.getSummary(startIso, endIso, deviceId)
          // Fix: Check top-level status. 'response' property only exists on error objects from api.js catch block.
          if (summaryResponse?.status < 400) {
            const data = summaryResponse?.data || summaryResponse
            if (data?.status === 'success' || (data && !data.status)) {
              summaryData = data
            } else if (data?.error) {
              lastError = data.error
            }
          } else {
            // Extract error from response if available
            const respData = summaryResponse?.data || summaryResponse?.response?.data
            if (respData?.error) lastError = respData.error
          }
        } catch (summaryError) {
          lastError = summaryError.message
        }

        // Try series
        let seriesLoaded = false
        try {
          const seriesResponse = await historyAPI.getSeries(startIso, endIso, bucket, deviceId)
          if (seriesResponse?.status < 400) {
            const data = seriesResponse?.data || seriesResponse
            if (data?.status === 'success' && data.series && Array.isArray(data.series)) {
              seriesData = data
              seriesLoaded = true
            } else if (data?.error) {
              lastError = data.error
            }
          } else {
            const respData = seriesResponse?.data || seriesResponse?.response?.data
            if (respData?.error) lastError = respData.error
          }
        } catch (seriesError) {
          console.error(`Series API exception`, seriesError)
          if (!lastError) lastError = seriesError.message
        }

        if (!summaryData && !seriesLoaded) {
          setError(lastError || 'Failed to load analysis data.')
        } else {
          if (summaryData?.status === 'success') {
            setSummary(summaryData.summary)
            if (summaryData.summary?.co2_quality) {
              const pieChartData = buildQualityChartData(summaryData.summary.co2_quality)
              if (pieChartData && hasValidChartData(pieChartData)) {
                setQualityPieChart(pieChartData)
              }
            }
          }

          if (seriesData && seriesLoaded) {
            const filteredSeries = filterSeriesInRange(seriesData.series, startIso, endIso)
            if (Array.isArray(filteredSeries) && filteredSeries.length > 0) {
              setSeries(filteredSeries)
              setCo2Chart(buildCo2ChartData(filteredSeries, bucket))
              setClimateChart(buildClimateChartData(filteredSeries, bucket))
            }
          }
        }
      } catch (error) {
        console.error('Error loading analysis data:', error)
        setError(error.message || 'Failed to load analysis data')
      } finally {
        setLoading(false)
      }
    }

    loadAnalysisData()
  }, [deviceId, analysisPreset, activeTab, useRealTimeScale, analysisStartDate, analysisEndDate])



  const qualityTableData = summary?.co2_quality || {}

  return (
    <div className="board-analysis-view">
      <div className="board-analysis-view__divider"></div>

      <div className="board-analysis-view__header">
        <div>
          <h2 className="board-analysis-view__title">{deviceName || deviceId}</h2>
        </div>
        <div className="board-analysis-view__header-actions">

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
          <span>Data</span>
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

      {/* Analysis Tab */}
      {activeTab === 'analysis' && (
        <div className="board-analysis-view__tab-content">
          <div className="flex flex-col gap-4 mb-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-zinc-100">Data Analysis</h3>
              <MinimalTimeSelector
                value={analysisPreset}
                onChange={setAnalysisPreset}
                options={[
                  { value: '24h', label: '24 Hours' },
                  { value: '7d', label: '7 Days' },
                  { value: '30d', label: '30 Days' },
                  { value: '90d', label: '90 Days' },
                  { value: 'custom', label: 'Custom' }
                ]}
              />
            </div>

            {/* Custom Date Picker Area */}
            {analysisPreset === 'custom' && (
              <div className="flex items-center gap-4 p-3 bg-zinc-900/50 rounded-lg border border-white/10 animate-in fade-in slide-in-from-top-2">
                <Calendar size={16} className="text-zinc-400" />
                <div className="flex items-center gap-2">
                  <DatePicker
                    selected={analysisStartDate}
                    onChange={(date) => setAnalysisStartDate(date)}
                    selectsStart
                    startDate={analysisStartDate}
                    endDate={analysisEndDate}
                    maxDate={new Date()}
                    dateFormat="dd MMM yyyy"
                    className="bg-transparent text-zinc-200 text-sm focus:outline-none w-28 cursor-pointer hover:text-white"
                    placeholderText="Start Date"
                  />
                  <span className="text-zinc-600">→</span>
                  <DatePicker
                    selected={analysisEndDate}
                    onChange={(date) => setAnalysisEndDate(date)}
                    selectsEnd
                    startDate={analysisStartDate}
                    endDate={analysisEndDate}
                    minDate={analysisStartDate}
                    maxDate={new Date()}
                    dateFormat="dd MMM yyyy"
                    className="bg-transparent text-zinc-200 text-sm focus:outline-none w-28 cursor-pointer hover:text-white"
                    placeholderText="End Date"
                  />
                </div>
              </div>
            )}
          </div>

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

          {!loading && !error && (
            <>
              {/* Summary Statistics */}
              {summary && (
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
              )}

              {/* Trend Graphs */}
              <div className="board-analysis-view__charts">
                <Card className="board-analysis-view__chart-card" elevation={2}>
                  <div className="board-analysis-view__chart-header">
                    <h3 className="board-analysis-view__chart-title">CO₂</h3>
                    <label className="board-analysis-view__toggle">
                      <input
                        type="checkbox"
                        checked={useRealTimeScale}
                        onChange={(e) => setUseRealTimeScale(e.target.checked)}
                      />
                      <span className="board-analysis-view__toggle-label" style={{ fontSize: '0.8rem' }}>Real Time</span>
                    </label>
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

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginTop: '1.5rem' }}>
                {/* Distribution Graph */}
                <Card className="board-analysis-view__distribution-card" elevation={2} style={{ margin: 0 }}>
                  <div className="board-analysis-view__distribution-header">
                    <h3 className="board-analysis-view__distribution-title">Distribution</h3>
                  </div>
                  <div className="board-analysis-view__distribution-content">
                    <div className="board-analysis-view__distribution-chart" style={{ height: '300px' }}>
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
                                  padding: 10,
                                  boxWidth: 8
                                }
                              }
                            }
                          }}
                        />
                      ) : (
                        <div className="board-analysis-view__empty">No data.</div>
                      )}
                    </div>
                  </div>
                </Card>

                {/* Quality Breakdown Table */}
                <Card className="board-analysis-view__quality-table-card" elevation={2} style={{ margin: 0 }}>
                  <div className="board-analysis-view__quality-header">
                    <h3 className="board-analysis-view__quality-title">Breakdown</h3>
                  </div>
                  <table className="board-analysis-view__table">
                    <thead>
                      <tr>
                        <th>Level</th>
                        <th>%</th>
                        <th>Range</th>
                      </tr>
                    </thead>
                    <tbody>
                      {qualityTableData.good !== undefined ? (
                        <>
                          <tr>
                            <td><Badge variant="standard" color="success">Good</Badge></td>
                            <td>{qualityTableData.good_percent || 0}%</td>
                            <td>&lt; 1000</td>
                          </tr>
                          <tr>
                            <td><Badge variant="standard" color="warning">Mod</Badge></td>
                            <td>{qualityTableData.moderate_percent || 0}%</td>
                            <td>1000–1500</td>
                          </tr>
                          <tr>
                            <td><Badge variant="standard" color="warning">Poor</Badge></td>
                            <td>{qualityTableData.high_percent || 0}%</td>
                            <td>1500–2000</td>
                          </tr>
                          <tr>
                            <td><Badge variant="standard" color="error">Crit</Badge></td>
                            <td>{qualityTableData.critical_percent || 0}%</td>
                            <td>&gt; 2000</td>
                          </tr>
                        </>
                      ) : (
                        <tr><td colSpan="3">No data</td></tr>
                      )}
                    </tbody>
                  </table>
                </Card>
              </div>
            </>
          )}
        </div>
      )}

      {/* Lessons Tab */}
      {activeTab === 'lessons' && (
        <div className="board-analysis-view__tab-content">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-zinc-100">Lesson Analytics</h3>
            <MinimalTimeSelector
              value={lessonsPreset}
              onChange={setLessonsPreset}
              options={[
                { value: 'current_week', label: 'Current Week' },
                { value: 'last_week', label: 'Last Week' },
                { value: 'last_month', label: 'Last Month' }
              ]}
            />
          </div>

          <StatsSummaryCards
            deviceId={deviceId}
            startDate={lessonDates.start}
            endDate={lessonDates.end}
          />
          <div className="board-analysis-view__charts" style={{ marginTop: '1.5rem' }}>
            <LessonDistributionChart
              deviceId={deviceId}
              startDate={lessonDates.start}
              endDate={lessonDates.end}
            />
            <TeacherComparisonCard
              deviceId={deviceId}
              startDate={lessonDates.start}
              endDate={lessonDates.end}
            />
          </div>
          <div style={{ marginTop: '1.5rem' }}>
            <LessonPeriodChart
              deviceId={deviceId}
              startDate={lessonDates.start}
              endDate={lessonDates.end}
            />
          </div>
        </div>
      )}

      {/* Trends Tab */}
      {activeTab === 'trends' && (
        <div className="board-analysis-view__tab-content">
          <HourlyHeatmap
            deviceId={deviceId}
          />
        </div>
      )}
    </div>
  )
}

export default BoardAnalysisView