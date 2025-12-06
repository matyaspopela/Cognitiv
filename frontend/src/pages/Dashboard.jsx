import { useState, useEffect, useRef } from 'react'
import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js'
import annotationPlugin from 'chartjs-plugin-annotation'
import { dataAPI } from '../services/api'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Chip from '../components/ui/Chip'
import Badge from '../components/ui/Badge'
import Snackbar from '../components/ui/Snackbar'
import ProgressBar from '../components/ui/ProgressBar'
import './Dashboard.css'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  annotationPlugin
)

const Dashboard = () => {
  const [timeRange, setTimeRange] = useState('24')
  const [data, setData] = useState([])
  const [stats, setStats] = useState({})
  const [serverStatus, setServerStatus] = useState(true)
  const [lastUpdate, setLastUpdate] = useState('Poslední aktualizace: nikdy')
  const [error, setError] = useState('')
  const [hasLoadedData, setHasLoadedData] = useState(false)
  const autoRefreshIntervalRef = useRef(null)

  useEffect(() => {
    fetchData()
    autoRefreshIntervalRef.current = setInterval(fetchData, 30000)
    return () => {
      if (autoRefreshIntervalRef.current) {
        clearInterval(autoRefreshIntervalRef.current)
      }
    }
  }, [timeRange])

  const fetchData = async () => {
    try {
      const hours = parseInt(timeRange)
      const [dataResponse, statsResponse] = await Promise.all([
        dataAPI.getData(hours),
        dataAPI.getStats(hours)
      ])

      const dataJson = dataResponse.data
      const statsJson = statsResponse.data

      if (dataJson.status !== 'success' || statsJson.status !== 'success') {
        throw new Error('Failed to load data')
      }

      setData(dataJson.data || [])
      setStats(statsJson.stats || {})
      setServerStatus(true)
      setError('')

      if (dataJson.data && dataJson.data.length > 0) {
        const lastData = dataJson.data[dataJson.data.length - 1]
        const date = lastData.timestamp_iso
          ? new Date(lastData.timestamp_iso)
          : new Date(lastData.timestamp)
        setLastUpdate(
          `Poslední aktualizace: ${date.toLocaleString('cs-CZ', {
            dateStyle: 'medium',
            timeStyle: 'medium'
          })}`
        )
      }

      setHasLoadedData(true)
    } catch (error) {
      console.error('Chyba při načítání dat:', error)
      setServerStatus(false)
      setError(`Nepodařilo se spojit se serverem: ${error.message || 'Zkontrolujte, zda server běží.'}`)
      setData([])
      setStats({})
      setHasLoadedData(true)
    }
  }

  const refreshData = () => {
    fetchData()
  }

  const safeValue = (value) => {
    return value === undefined || value === null || Number.isNaN(value) ? '--' : value
  }

  const temperatureStats = stats.temperature || {}
  const humidityStats = stats.humidity || {}
  const co2Stats = stats.co2 || {}

  // Prepare chart data
  let sampledData = data
  if (data.length > 200) {
    const step = Math.ceil(data.length / 200)
    sampledData = data.filter((_, index) => index % step === 0)
  }

  const timeFormatter = new Intl.DateTimeFormat('cs-CZ', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })

  const parseTimestamp = (point) => {
    if (!point) return null
    if (point.timestamp_iso) {
      const isoDate = new Date(point.timestamp_iso)
      if (!Number.isNaN(isoDate.getTime())) return isoDate
    }
    if (point.timestamp) {
      const normalized = point.timestamp.replace(' ', 'T')
      const fallbackDate = new Date(normalized)
      if (!Number.isNaN(fallbackDate.getTime())) return fallbackDate
    }
    return null
  }

  const labels = sampledData.map((point) => {
    const date = parseTimestamp(point)
    if (!date) return point.timestamp || ''
    return timeFormatter.format(date)
  })

  const tempChartData = {
    labels,
    datasets: [
      {
        label: 'Teplota (°C)',
        data: sampledData.map((point) => point.temp_avg ?? point.temperature),
        borderColor: '#FF9800',
        backgroundColor: 'rgba(255, 152, 0, 0.12)',
        borderWidth: 3,
        fill: true,
        tension: 0.35
      }
    ]
  }

  const humidityChartData = {
    labels,
    datasets: [
      {
        label: 'Vlhkost (%)',
        data: sampledData.map((point) => point.humidity_avg ?? point.humidity),
        borderColor: '#FFB74D',
        backgroundColor: 'rgba(255, 183, 77, 0.12)',
        borderWidth: 3,
        fill: true,
        tension: 0.35
      }
    ]
  }

  const co2ChartData = {
    labels,
    datasets: [
      {
        label: 'CO₂ (ppm)',
        data: sampledData.map((point) => point.co2),
        borderColor: '#FFC107',
        backgroundColor: 'rgba(255, 193, 7, 0.12)',
        borderWidth: 3,
        fill: true,
        tension: 0.35
      }
    ]
  }

  const commonChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
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
        displayColors: false,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.2)',
        cornerRadius: 8
      }
    },
    scales: {
      x: {
        grid: {
          color: 'rgba(0, 0, 0, 0.08)'
        },
        ticks: {
          color: 'rgba(117, 117, 117, 0.9)',
          font: {
            family: 'Inter, sans-serif',
            size: 12
          },
          maxRotation: 0,
          autoSkipPadding: 16
        }
      },
      y: {
        grid: {
          color: 'rgba(0, 0, 0, 0.08)'
        },
        ticks: {
          color: 'rgba(117, 117, 117, 0.9)',
          font: {
            family: 'Inter, sans-serif',
            size: 12
          }
        },
        title: {
          font: {
            family: 'Inter, sans-serif',
            size: 13,
            weight: '500'
          },
          color: 'rgba(117, 117, 117, 0.9)'
        }
      }
    }
  }

  const co2CurrentRaw = co2Stats.current
  let co2Class = 'co2'
  if (typeof co2CurrentRaw === 'number') {
    if (co2CurrentRaw >= 2000) co2Class = 'co2 danger'
    else if (co2CurrentRaw >= 1500) co2Class = 'co2 warning'
    else if (co2CurrentRaw >= 1000) co2Class = 'co2 caution'
  }

  const quality = stats.co2_quality || {
    good_percent: 0,
    moderate_percent: 0,
    high_percent: 0,
    critical_percent: 0
  }

  const timeRangeOptions = [
    { value: '1', label: '1h' },
    { value: '6', label: '6h' },
    { value: '24', label: '24h' },
    { value: '168', label: '7d' },
    { value: '720', label: '30d' },
  ]

  const [showSnackbar, setShowSnackbar] = useState(false)

  useEffect(() => {
    if (error) {
      setShowSnackbar(true)
    }
  }, [error])

  return (
    <div className={`dashboard-page ${hasLoadedData ? 'loaded' : 'loading'}`}>
      <div className="dashboard-page__container">
        <header className="dashboard-page__header">
          <Card className="dashboard-page__header-card" elevation={2}>
            <div className="dashboard-page__header-content">
              <div className="dashboard-page__header-text">
                <h1 className="dashboard-page__title">Dashboard pro monitorování prostředí</h1>
                <p className="dashboard-page__subtitle">
                  Podrobný pohled na komfort a kvalitu vzduchu z vašich senzorů Cognitiv.
                </p>
              </div>
              <div className="dashboard-page__status-group">
                <Badge
                  variant="standard"
                  color={serverStatus ? 'success' : 'error'}
                  className="dashboard-page__status-badge"
                >
                  {serverStatus ? 'Server online' : 'Server offline'}
                </Badge>
                <div className="dashboard-page__last-update">{lastUpdate}</div>
              </div>
            </div>
            <div className="dashboard-page__controls">
              <div className="dashboard-page__time-range">
                <span className="dashboard-page__control-label">Časové období:</span>
                <div className="dashboard-page__chips">
                  {timeRangeOptions.map((option) => (
                    <Chip
                      key={option.value}
                      variant="filter"
                      selected={timeRange === option.value}
                      onClick={() => setTimeRange(option.value)}
                    >
                      {option.label}
                    </Chip>
                  ))}
                </div>
              </div>
              <Button
                variant="filled"
                size="medium"
                onClick={refreshData}
                disabled={!hasLoadedData}
              >
                ⟳ Aktualizovat
              </Button>
            </div>
          </Card>
        </header>

        <main className="dashboard-page__content">
          {!hasLoadedData && (
            <Card className="dashboard-page__loading" elevation={2}>
              <ProgressBar indeterminate />
              <p>Načítám data...</p>
            </Card>
          )}

          {hasLoadedData && (
            <>

              <section className="dashboard-page__metrics">
                <Card className="dashboard-page__metric-card" elevation={2}>
                  <div className="dashboard-page__metric-header">
                    <span className="dashboard-page__metric-label">Teplota</span>
                  </div>
                  <div className="dashboard-page__metric-value dashboard-page__metric-value--temp">
                    {safeValue(temperatureStats.current)}
                    <span className="dashboard-page__metric-unit">°C</span>
                  </div>
                  <div className="dashboard-page__metric-breakdown">
                    <span>Min <strong>{safeValue(temperatureStats.min)}</strong></span>
                    <span>Max <strong>{safeValue(temperatureStats.max)}</strong></span>
                    <span>Průměr <strong>{safeValue(temperatureStats.avg)}</strong></span>
                  </div>
                </Card>

                <Card className="dashboard-page__metric-card" elevation={2}>
                  <div className="dashboard-page__metric-header">
                    <span className="dashboard-page__metric-label">Vlhkost</span>
                  </div>
                  <div className="dashboard-page__metric-value dashboard-page__metric-value--humidity">
                    {safeValue(humidityStats.current)}
                    <span className="dashboard-page__metric-unit">%</span>
                  </div>
                  <div className="dashboard-page__metric-breakdown">
                    <span>Min <strong>{safeValue(humidityStats.min)}</strong></span>
                    <span>Max <strong>{safeValue(humidityStats.max)}</strong></span>
                    <span>Průměr <strong>{safeValue(humidityStats.avg)}</strong></span>
                  </div>
                </Card>

                <Card className="dashboard-page__metric-card" elevation={2}>
                  <div className="dashboard-page__metric-header">
                    <span className="dashboard-page__metric-label">CO₂</span>
                  </div>
                  <div className={`dashboard-page__metric-value dashboard-page__metric-value--${co2Class}`}>
                    {safeValue(co2Stats.current)}
                    <span className="dashboard-page__metric-unit">ppm</span>
                  </div>
                  <div className="dashboard-page__metric-breakdown">
                    <span>Min <strong>{safeValue(co2Stats.min)}</strong></span>
                    <span>Max <strong>{safeValue(co2Stats.max)}</strong></span>
                    <span>Průměr <strong>{safeValue(co2Stats.avg)}</strong></span>
                  </div>
                </Card>

                <Card className="dashboard-page__metric-card" elevation={2}>
                  <div className="dashboard-page__metric-header">
                    <span className="dashboard-page__metric-label">Datové pokrytí</span>
                  </div>
                  <div className="dashboard-page__metric-value dashboard-page__metric-value--data">
                    {safeValue(stats.data_points)}
                  </div>
                  <div className="dashboard-page__metric-breakdown">
                    <span>Záznamů v okně</span>
                  </div>
                </Card>
              </section>

              <Card className="dashboard-page__quality-card" elevation={2}>
                <div className="dashboard-page__quality-header">
                  <h2 className="dashboard-page__quality-title">Rozložení kvality vzduchu</h2>
                  <p className="dashboard-page__quality-description">
                    Podíl měření v jednotlivých pásmech CO₂ pro zvolené období.
                  </p>
                </div>
                <div className="dashboard-page__quality-bars">
                  <div className="dashboard-page__quality-bar dashboard-page__quality-bar--good">
                    <div className="dashboard-page__quality-bar-header">
                      <span>Dobrá</span>
                      <strong>{quality.good_percent ?? 0}%</strong>
                    </div>
                    <ProgressBar value={quality.good_percent ?? 0} max={100} color="success" />
                    <small>&lt; 1000 ppm</small>
                  </div>
                  <div className="dashboard-page__quality-bar dashboard-page__quality-bar--moderate">
                    <div className="dashboard-page__quality-bar-header">
                      <span>Střední</span>
                      <strong>{quality.moderate_percent ?? 0}%</strong>
                    </div>
                    <ProgressBar value={quality.moderate_percent ?? 0} max={100} color="warning" />
                    <small>1000 – 1499 ppm</small>
                  </div>
                  <div className="dashboard-page__quality-bar dashboard-page__quality-bar--high">
                    <div className="dashboard-page__quality-bar-header">
                      <span>Špatná</span>
                      <strong>{quality.high_percent ?? 0}%</strong>
                    </div>
                    <ProgressBar value={quality.high_percent ?? 0} max={100} color="warning" />
                    <small>1500 – 1999 ppm</small>
                  </div>
                  <div className="dashboard-page__quality-bar dashboard-page__quality-bar--critical">
                    <div className="dashboard-page__quality-bar-header">
                      <span>Kritická</span>
                      <strong>{quality.critical_percent ?? 0}%</strong>
                    </div>
                    <ProgressBar value={quality.critical_percent ?? 0} max={100} color="error" />
                    <small>&ge; 2000 ppm</small>
                  </div>
                </div>
              </Card>

              <section className="dashboard-page__charts">
                <Card className="dashboard-page__charts-header" elevation={1}>
                  <h2 className="dashboard-page__charts-title">Grafy z časového úseku</h2>
                  <p className="dashboard-page__charts-description">
                    Přehledné porovnání hodnot teploty, vlhkosti a koncentrace CO₂ v čase.
                  </p>
                </Card>
                <div className="dashboard-page__chart-stack">
                  <Card className="dashboard-page__chart-card" elevation={2}>
                    <div className="dashboard-page__chart-header">
                      <h3 className="dashboard-page__chart-title">Teplota v čase</h3>
                      <p className="dashboard-page__chart-description">
                        Sledujte změny mikroklimatu a rychle odhalte epizody vytápění či ochlazení.
                      </p>
                    </div>
                    <div className="dashboard-page__chart-canvas">
                      <Line
                        data={tempChartData}
                        options={{
                          ...commonChartOptions,
                          scales: {
                            ...commonChartOptions.scales,
                            y: {
                              ...commonChartOptions.scales.y,
                              title: { display: true, text: '°C' }
                            }
                          }
                        }}
                      />
                    </div>
                  </Card>

                  <Card className="dashboard-page__chart-card" elevation={2}>
                    <div className="dashboard-page__chart-header">
                      <h3 className="dashboard-page__chart-title">Vlhkost v čase</h3>
                      <p className="dashboard-page__chart-description">
                        Kontrolujte, že se vlhkost drží ve zdravém pásmu pro pohodlí i techniku.
                      </p>
                    </div>
                    <div className="dashboard-page__chart-canvas">
                      <Line
                        data={humidityChartData}
                        options={{
                          ...commonChartOptions,
                          scales: {
                            ...commonChartOptions.scales,
                            y: {
                              ...commonChartOptions.scales.y,
                              title: { display: true, text: '%' },
                              suggestedMin: 0,
                              suggestedMax: 100
                            }
                          }
                        }}
                      />
                    </div>
                  </Card>

                  <Card className="dashboard-page__chart-card" elevation={2}>
                    <div className="dashboard-page__chart-header">
                      <h3 className="dashboard-page__chart-title">CO₂ v čase</h3>
                      <p className="dashboard-page__chart-description">
                        Odhalte nedostatečné větrání pomocí prahů pro jednotlivá pásma kvality vzduchu.
                      </p>
                    </div>
                    <div className="dashboard-page__chart-canvas">
                      <Line
                        data={co2ChartData}
                        options={{
                          ...commonChartOptions,
                          scales: {
                            ...commonChartOptions.scales,
                            y: {
                              ...commonChartOptions.scales.y,
                              title: { display: true, text: 'ppm' }
                            }
                          },
                          plugins: {
                            ...commonChartOptions.plugins,
                            annotation: {
                              annotations: {
                                good: {
                                  type: 'line',
                                  yMin: 1000,
                                  yMax: 1000,
                                  borderColor: '#FFC107',
                                  borderWidth: 2,
                                  borderDash: [6, 6],
                                  label: {
                                    enabled: true,
                                    content: 'Prahová hodnota 1000 ppm',
                                    backgroundColor: 'rgba(33, 33, 33, 0.9)',
                                    color: '#fff',
                                    position: 'start'
                                  }
                                },
                                high: {
                                  type: 'line',
                                  yMin: 1500,
                                  yMax: 1500,
                                  borderColor: '#FF9800',
                                  borderWidth: 2,
                                  borderDash: [6, 6],
                                  label: {
                                    enabled: true,
                                    content: 'Prahová hodnota 1500 ppm',
                                    backgroundColor: 'rgba(33, 33, 33, 0.9)',
                                    color: '#fff',
                                    position: 'start'
                                  }
                                },
                                critical: {
                                  type: 'line',
                                  yMin: 2000,
                                  yMax: 2000,
                                  borderColor: '#F44336',
                                  borderWidth: 2,
                                  borderDash: [6, 6],
                                  label: {
                                    enabled: true,
                                    content: 'Prahová hodnota 2000 ppm',
                                    backgroundColor: 'rgba(33, 33, 33, 0.9)',
                                    color: '#fff',
                                    position: 'start'
                                  }
                                }
                              }
                            }
                          }
                        }}
                      />
                    </div>
                  </Card>
                </div>
              </section>
            </>
          )}
        </main>

        <footer className="dashboard-page__footer">
          <div className="dashboard-page__footer-text">
            Navrženo pro klidné a přehledné sledování. <a href="/">Zpět na domov</a>
          </div>
        </footer>
      </div>

      <Snackbar
        message={error}
        open={showSnackbar}
        onClose={() => setShowSnackbar(false)}
        variant="error"
        duration={5000}
      />
    </div>
  )
}

export default Dashboard

