import { useState, useEffect } from 'react'
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
import annotationPlugin from 'chartjs-plugin-annotation'
import { historyAPI } from '../services/api'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Chip from '../components/ui/Chip'
import TextField from '../components/ui/TextField'
import Badge from '../components/ui/Badge'
import ProgressBar from '../components/ui/ProgressBar'
import './History.css'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  annotationPlugin
)

const History = () => {
  const [filters, setFilters] = useState({
    start: null,
    end: null,
    bucket: 'day',
    deviceId: ''
  })
  const [selectedPreset, setSelectedPreset] = useState('30d')
  const [summary, setSummary] = useState(null)
  const [series, setSeries] = useState([])
  const [devices, setDevices] = useState(new Set())
  const [co2Chart, setCo2Chart] = useState(null)
  const [climateChart, setClimateChart] = useState(null)
  const [qualityPieChart, setQualityPieChart] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const formatDateForInput = (date) => {
    if (!date) return ''
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
    try {
      // datetime-local format is "YYYY-MM-DDTHH:mm" (no timezone)
      // Create Date object which interprets it as local time
      const date = new Date(value)
      if (Number.isNaN(date.getTime())) {
        console.warn('Invalid date value:', value)
        return null
      }
      // Convert to ISO string (UTC)
      const iso = date.toISOString()
      return iso
    } catch (err) {
      console.error('Date conversion error:', err, value)
      return null
    }
  }

  useEffect(() => {
    const now = new Date()
    const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const initialFilters = {
      start: formatDateForInput(start),
      end: formatDateForInput(now),
      bucket: 'day',
      deviceId: ''
    }
    setFilters(initialFilters)
    setSelectedPreset('30d')
    // Data will load automatically via the other useEffect when filters are set
  }, [])

  const loadHistoryDataWithFilters = async (filterState) => {
    setLoading(true)
    setError('')
    try {
      const startIso = toISOStringOrNull(filterState.start)
      const endIso = toISOStringOrNull(filterState.end)
      const deviceId = filterState.deviceId || null
      const bucket = filterState.bucket || 'day'

      if (!startIso || !endIso) {
        throw new Error('Musíte zadat počáteční i koncové datum')
      }

      console.log('Loading history data with filters:', { startIso, endIso, bucket, deviceId })

      const [summaryResponse, seriesResponse] = await Promise.all([
        historyAPI.getSummary(startIso, endIso, deviceId),
        historyAPI.getSeries(startIso, endIso, bucket, deviceId)
      ])

      console.log('API responses:', { 
        summary: summaryResponse?.data, 
        series: seriesResponse?.data,
        summaryStatus: summaryResponse?.status,
        seriesStatus: seriesResponse?.status
      })

      const summaryData = summaryResponse?.data || summaryResponse
      const seriesData = seriesResponse?.data || seriesResponse

      if (!summaryData || !seriesData) {
        throw new Error('Neplatná odpověď ze serveru')
      }

      if (summaryData.status !== 'success' || seriesData.status !== 'success') {
        const errorMsg = summaryData.error || seriesData.error || 'Nepodařilo se načíst historická data.'
        throw new Error(errorMsg)
      }

      setSummary(summaryData.summary)
      setSeries(seriesData.series || [])

      // Update device list
      const deviceSet = new Set()
      seriesData.series.forEach(item => {
        if (item.device_id) deviceSet.add(item.device_id)
      })
      setDevices(deviceSet)

      // Build charts
      if (seriesData.series.length > 0) {
        buildCo2Chart(seriesData.series)
        buildClimateChart(seriesData.series)
      }

      // Build quality pie chart
      if (summaryData.summary?.co2_quality) {
        buildQualityPieChart(summaryData.summary.co2_quality)
      }
    } catch (error) {
      console.error('Error loading history data:', error)
      const errorMessage = error.response?.data?.error || error.message || 'Nepodařilo se načíst historická data'
      setError(errorMessage)
      setSummary(null)
      setSeries([])
      setCo2Chart(null)
      setClimateChart(null)
      setQualityPieChart(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // Only load if we have both start and end dates
    if (filters.start && filters.end) {
      console.log('useEffect triggered, loading data with filters:', filters)
      loadHistoryDataWithFilters(filters)
    } else {
      console.log('useEffect triggered but missing dates:', { start: filters.start, end: filters.end })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.start, filters.end, filters.bucket, filters.deviceId])

  const resetFilters = () => {
    const now = new Date()
    const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    setFilters({
      start: formatDateForInput(start),
      end: formatDateForInput(now),
      bucket: 'day',
      deviceId: ''
    })
    setSelectedPreset('30d')
  }

  const applyPreset = (preset) => {
    setSelectedPreset(preset)
    
    if (preset === 'custom') {
      // For custom, just set the preset but don't change dates
      // User can manually set dates in the date pickers
      return
    }

    const now = new Date()
    let start = null
    let end = formatDateForInput(now)

    switch (preset) {
      case '24h':
        start = formatDateForInput(new Date(now.getTime() - 24 * 60 * 60 * 1000))
        break
      case '7d':
        start = formatDateForInput(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000))
        break
      case '30d':
        start = formatDateForInput(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000))
        break
      case '90d':
        start = formatDateForInput(new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000))
        break
    }

    setFilters(prev => ({ ...prev, start, end }))
  }

  const loadHistoryData = async () => {
    if (!filters.start || !filters.end) {
      console.log('Cannot load: missing start or end date', { start: filters.start, end: filters.end })
      return
    }
    console.log('loadHistoryData called with filters:', filters)
    await loadHistoryDataWithFilters(filters)
  }

  const buildCo2Chart = (data) => {
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
          pointRadius: 0,
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

    setCo2Chart({
      labels,
      datasets: Object.values(datasetsMap)
    })
  }

  const buildClimateChart = (data) => {
    const labels = data.map(item => item.bucket_start)
    setClimateChart({
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
          pointRadius: 0,
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
          pointRadius: 0,
          pointHoverRadius: 6,
          fill: false
        }
      ]
    })
  }

  const buildQualityPieChart = (co2Quality) => {
    const data = [
      {
        label: '< 1000 ppm',
        value: co2Quality.good || 0,
        color: 'rgba(76, 175, 80, 0.85)'
      },
      {
        label: '1000-1500 ppm',
        value: co2Quality.moderate || 0,
        color: 'rgba(255, 193, 7, 0.75)'
      },
      {
        label: '1500-2000 ppm',
        value: co2Quality.high || 0,
        color: 'rgba(255, 152, 0, 0.75)'
      },
      {
        label: '> 2000 ppm',
        value: co2Quality.critical || 0,
        color: 'rgba(244, 67, 54, 0.85)'
      }
    ].filter(item => item.value > 0)

    if (data.length === 0) {
      setQualityPieChart(null)
      return
    }

    const total = data.reduce((sum, item) => sum + item.value, 0)
    const chartData = data.map(item => item.value)
    const labels = data.map(item => {
      const percent = ((item.value / total) * 100).toFixed(1)
      return `${item.label} (${percent}%)`
    })
    const colors = data.map(item => item.color)

    setQualityPieChart({
      labels,
      datasets: [{
        data: chartData,
        backgroundColor: colors,
        borderColor: colors,
        borderWidth: 2
      }]
    })
  }

  const detectAnomalies = (data) => {
    if (!Array.isArray(data) || data.length === 0) return []
    const filtered = data.filter(item => item.co2?.avg !== null && item.co2?.avg !== undefined)
    const anomalies = []
    const SPIKE_THRESHOLD = 400
    const MIN_SPIKE_VALUE = 1000

    for (let i = 1; i < filtered.length; i++) {
      const current = filtered[i]
      const previous = filtered[i - 1]
      const currentValue = current.co2.avg
      const previousValue = previous.co2.avg
      const change = currentValue - previousValue
      const absChange = Math.abs(change)

      if (absChange >= SPIKE_THRESHOLD && (currentValue >= MIN_SPIKE_VALUE || previousValue >= MIN_SPIKE_VALUE)) {
        const isIncrease = change > 0
        const spikeType = isIncrease ? 'nárůst' : 'pokles'

        anomalies.push({
          timestamp: current.bucket_start,
          device: current.device_id || 'Všechna',
          value: Math.round(currentValue),
          previousValue: Math.round(previousValue),
          change: Math.round(change),
          absChange: Math.round(absChange),
          spikeType
        })
      }
    }

    anomalies.sort((a, b) => b.absChange - a.absChange)
    return anomalies
  }

  const anomalies = detectAnomalies(series)

  const commonChartOptions = {
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

  const co2ChartOptions = {
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
        grid: { color: 'rgba(0, 0, 0, 0.08)' }
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

  const climateChartOptions = {
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
        grid: { color: 'rgba(0, 0, 0, 0.08)' }
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
        grid: { drawOnChartArea: false }
      }
    }
  }

  const presetOptions = [
    { id: '24h', label: '24h' },
    { id: '7d', label: '7d' },
    { id: '30d', label: '30d' },
    { id: '90d', label: '90d' },
    { id: 'custom', label: 'Vlastní' },
  ]

  const bucketOptions = [
    { value: 'raw', label: 'Všechna data', desc: 'Bez agregace' },
    { value: 'hour', label: 'Hodinová', desc: 'Průměr za hodinu' },
    { value: 'day', label: 'Denní', desc: 'Průměr za den' },
  ]

  return (
    <div className="history-page">
      <div className="history-page__container">
        <header className="history-page__header">
          <Card className="history-page__header-card" elevation={2}>
            <div className="history-page__hero">
              <h1 className="history-page__title">Historie měření</h1>
              <p className="history-page__subtitle">
                Vyhodnocujte dlouhodobé trendy CO₂, teploty a vlhkosti. Filtrovatelná časová řada, přehled změn
                a automaticky detekované anomálie vám pomohou rychle najít souvislosti.
              </p>
            </div>
          </Card>

          <Card className="history-page__filters-card" elevation={2}>
            <div className="history-page__filter-section">
              <h3 className="history-page__filter-title">Rychlý výběr období</h3>
              <div className="history-page__presets">
                {presetOptions.map((preset) => (
                  <Chip
                    key={preset.id}
                    variant="filter"
                    selected={selectedPreset === preset.id}
                    onClick={() => applyPreset(preset.id)}
                  >
                    {preset.label}
                  </Chip>
                ))}
              </div>
            </div>

            <div className={`history-page__filter-section ${selectedPreset === 'custom' ? 'history-page__filter-section--active' : ''}`}>
              <h3 className="history-page__filter-title">Vlastní časové období</h3>
              <div className="history-page__date-range">
                <TextField
                  type="datetime-local"
                  label="Od"
                  value={filters.start || ''}
                  onChange={(e) => {
                    setSelectedPreset('custom')
                    setFilters(prev => ({ ...prev, start: e.target.value }))
                  }}
                  fullWidth
                />
                <TextField
                  type="datetime-local"
                  label="Do"
                  value={filters.end || ''}
                  onChange={(e) => {
                    setSelectedPreset('custom')
                    setFilters(prev => ({ ...prev, end: e.target.value }))
                  }}
                  fullWidth
                />
              </div>
            </div>

            <div className="history-page__filter-section">
              <h3 className="history-page__filter-title">Granularita dat</h3>
              <div className="history-page__buckets">
                {bucketOptions.map((bucket) => (
                  <Card
                    key={bucket.value}
                    className={`history-page__bucket-card ${filters.bucket === bucket.value ? 'history-page__bucket-card--active' : ''}`}
                    elevation={filters.bucket === bucket.value ? 2 : 1}
                    onClick={() => setFilters(prev => ({ ...prev, bucket: bucket.value }))}
                  >
                    <div className="history-page__bucket-title">{bucket.label}</div>
                    <div className="history-page__bucket-desc">{bucket.desc}</div>
                  </Card>
                ))}
              </div>
            </div>

            <div className="history-page__filter-section">
              <h3 className="history-page__filter-title">Zařízení</h3>
              <select
                className="history-page__device-select"
                value={filters.deviceId}
                onChange={(e) => setFilters(prev => ({ ...prev, deviceId: e.target.value }))}
              >
                <option value="">Všechna zařízení</option>
                {Array.from(devices).sort().map(deviceId => (
                  <option key={deviceId} value={deviceId}>{deviceId}</option>
                ))}
              </select>
            </div>

            <div className="history-page__actions">
              <Button variant="filled" size="medium" onClick={loadHistoryData} disabled={loading || !filters.start || !filters.end}>
                {loading ? 'Načítám...' : '⟳ Načíst data'}
              </Button>
              <Button
                variant="outlined"
                size="medium"
                onClick={() => {
                  const params = new URLSearchParams()
                  if (filters.deviceId) params.append('device_id', filters.deviceId)
                  const startIso = toISOStringOrNull(filters.start)
                  const endIso = toISOStringOrNull(filters.end)
                  if (startIso) params.append('start', startIso)
                  if (endIso) params.append('end', endIso)
                  window.open(`/history/export?${params.toString()}`, '_blank')
                }}
              >
                📥 Exportovat
              </Button>
              <Button variant="text" size="medium" onClick={resetFilters}>
                Resetovat
              </Button>
            </div>
          </Card>
        </header>

        <main className="history-page__main">
          {error && (
            <Card className="history-page__error-card" elevation={2}>
              <div className="history-page__error">{error}</div>
            </Card>
          )}
          
          {loading && (
            <Card className="history-page__loading-card" elevation={2}>
              <ProgressBar indeterminate />
              <p>Načítám historická data...</p>
            </Card>
          )}

          <Card className="history-page__summary-card" elevation={2}>
            <div className="history-page__summary-grid">
              {summary ? (
                <>
                  <Card className="history-page__summary-item" elevation={1}>
                    <div className="history-page__summary-label">CO₂ (ppm)</div>
                    <div className="history-page__summary-value">{summary.co2?.avg ?? '–'}</div>
                    <div className="history-page__summary-footer">
                      Min {summary.co2?.min ?? '–'} · Max {summary.co2?.max ?? '–'}
                    </div>
                  </Card>
                  <Card className="history-page__summary-item" elevation={1}>
                    <div className="history-page__summary-label">Teplota (°C)</div>
                    <div className="history-page__summary-value">{summary.temperature?.avg ?? '–'}</div>
                    <div className="history-page__summary-footer">
                      Min {summary.temperature?.min ?? '–'} · Max {summary.temperature?.max ?? '–'}
                    </div>
                  </Card>
                  <Card className="history-page__summary-item" elevation={1}>
                    <div className="history-page__summary-label">Vlhkost (%)</div>
                    <div className="history-page__summary-value">{summary.humidity?.avg ?? '–'}</div>
                    <div className="history-page__summary-footer">
                      Min {summary.humidity?.min ?? '–'} · Max {summary.humidity?.max ?? '–'}
                    </div>
                  </Card>
                  <Card className="history-page__summary-item" elevation={1}>
                    <div className="history-page__summary-label">Vzorky</div>
                    <div className="history-page__summary-value">{summary.samples ?? '–'}</div>
                    <div className="history-page__summary-footer">
                      <div>Od: {summary.range?.data_start || '–'}</div>
                      <div>Do: {summary.range?.data_end || '–'}</div>
                    </div>
                  </Card>
                </>
              ) : (
                <div className="history-page__empty">Načítám shrnutí…</div>
              )}
            </div>
          </Card>

          <div className="history-page__charts">
            <Card className="history-page__chart-card" elevation={2}>
              <div className="history-page__chart-header">
                <h2 className="history-page__chart-title">CO₂ trendy</h2>
                <p className="history-page__chart-meta">Počet intervalů: {series.length}</p>
              </div>
              <div className="history-page__chart-container">
                {co2Chart ? (
                  <Line data={co2Chart} options={co2ChartOptions} />
                ) : (
                  <div className="history-page__empty">Žádná data k zobrazení</div>
                )}
              </div>
            </Card>

            <Card className="history-page__chart-card" elevation={2}>
              <div className="history-page__chart-header">
                <h2 className="history-page__chart-title">Teplota a vlhkost</h2>
                <p className="history-page__chart-meta">Počet intervalů: {series.length}</p>
              </div>
              <div className="history-page__chart-container">
                {climateChart ? (
                  <Line data={climateChart} options={climateChartOptions} />
                ) : (
                  <div className="history-page__empty">Žádná data k zobrazení</div>
                )}
              </div>
            </Card>
          </div>

          <Card className="history-page__quality-table-card" elevation={2}>
            <div className="history-page__quality-header">
              <h2 className="history-page__quality-title">Kvalita vzduchu podle hranic CO₂</h2>
              <p className="history-page__quality-description">Rozložení vzorků podle doporučených úrovní CO₂ (ppm).</p>
            </div>
            <table className="history-page__table">
              <thead>
                <tr>
                  <th>Úroveň</th>
                  <th>Vzorků</th>
                  <th>Podíl</th>
                  <th>Popis</th>
                </tr>
              </thead>
              <tbody>
                {summary?.co2_quality ? (
                  <>
                    <tr>
                      <td><Badge variant="standard" color="success">Dobrá kvalita</Badge></td>
                      <td>{summary.co2_quality.good || 0}</td>
                      <td>{summary.co2_quality.good_percent || 0}%</td>
                      <td>&lt; 1000 ppm</td>
                    </tr>
                    <tr>
                      <td><Badge variant="standard" color="warning">Střední kvalita</Badge></td>
                      <td>{summary.co2_quality.moderate || 0}</td>
                      <td>{summary.co2_quality.moderate_percent || 0}%</td>
                      <td>1000 – 1500 ppm</td>
                    </tr>
                    <tr>
                      <td><Badge variant="standard" color="warning">Zhoršená kvalita</Badge></td>
                      <td>{summary.co2_quality.high || 0}</td>
                      <td>{summary.co2_quality.high_percent || 0}%</td>
                      <td>1500 – 2000 ppm</td>
                    </tr>
                    <tr>
                      <td><Badge variant="standard" color="error">Kritická kvalita</Badge></td>
                      <td>{summary.co2_quality.critical || 0}</td>
                      <td>{summary.co2_quality.critical_percent || 0}%</td>
                      <td>&gt; 2000 ppm</td>
                    </tr>
                  </>
                ) : (
                  <tr>
                    <td colSpan="4" className="history-page__empty">Zatím nejsou k dispozici žádná data.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </Card>

          <Card className="history-page__pie-card" elevation={2}>
            <div className="history-page__pie-header">
              <h2 className="history-page__pie-title">Rozložení kvality vzduchu</h2>
              <p className="history-page__pie-description">Přehled všech měření podle úrovní kvality vzduchu v daném období.</p>
            </div>
            <div className="history-page__pie-container">
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
                          font: {
                            family: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
                          },
                          padding: 15
                        }
                      },
                      tooltip: {
                        callbacks: {
                          label: (context) => {
                            const label = context.label || ''
                            const value = context.parsed || 0
                            const total = context.dataset.data.reduce((a, b) => a + b, 0)
                            const percentage = ((value / total) * 100).toFixed(1)
                            return `${label}: ${value} (${percentage}%)`
                          }
                        }
                      }
                    }
                  }}
                />
              ) : (
                <div className="history-page__empty">Žádná data k zobrazení.</div>
              )}
            </div>
          </Card>

          <Card className="history-page__anomalies-card" elevation={2}>
            <div className="history-page__anomalies-header">
              <h2 className="history-page__anomalies-title">Detekované anomálie</h2>
              <p className="history-page__anomalies-description">
                Rychlé změny (spiky) v koncentraci CO₂ větší než 400 ppm mezi po sobě jdoucími intervaly.
              </p>
            </div>
            <div className="history-page__anomalies-grid">
              {anomalies.length > 0 ? (
                anomalies.map((anomaly, idx) => (
                  <Card key={idx} className="history-page__anomaly-card" elevation={1}>
                    <div className="history-page__anomaly-header">
                      <span className="history-page__anomaly-time">{anomaly.timestamp}</span>
                      <Badge
                        variant="standard"
                        color={anomaly.change > 0 ? 'error' : 'info'}
                      >
                        {anomaly.icon} {anomaly.change > 0 ? '+' : ''}{anomaly.change} ppm
                      </Badge>
                    </div>
                    <div className="history-page__anomaly-body">
                      <div className="history-page__anomaly-value">
                        <strong>{anomaly.previousValue} ppm</strong> → <strong>{anomaly.value} ppm</strong>
                      </div>
                      <div className="history-page__anomaly-info">Zařízení: {anomaly.device}</div>
                      <div className="history-page__anomaly-info">Typ: {anomaly.spikeType} o {anomaly.absChange} ppm</div>
                    </div>
                  </Card>
                ))
              ) : (
                <div className="history-page__empty">
                  Žádné anomálie nebyly nalezeny v daném období. (Sledujeme rychlé změny CO₂ koncentrace větší než 400 ppm.)
                </div>
              )}
            </div>
          </Card>
        </main>

        <footer className="history-page__footer">
          <div className="history-page__footer-text">
            Historická analytika Cognitiv • Přináší přehled o kvalitě prostředí v čase.
          </div>
        </footer>
      </div>
    </div>
  )
}

export default History

