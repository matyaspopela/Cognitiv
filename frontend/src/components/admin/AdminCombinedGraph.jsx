import { useState, useMemo } from 'react'
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
    TimeScale,
    Filler
} from 'chart.js'
import 'chartjs-adapter-date-fns'
import { theme } from '../../design/theme'
import Card from '../ui/Card'
import './AdminCombinedGraph.css'

// Register Chart.js components
ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    TimeScale,
    Filler
)

// Stable, resolved color references (no dynamic gradient to avoid canvas lifecycle errors)
const CO2_COLOR_SAFE    = '#16A34A'   // green-600
const CO2_COLOR_WARNING = '#D97706'   // amber-600
const CO2_COLOR_DANGER  = '#DC2626'   // red-600

/**
 * Returns a stable border color for the CO2 line based on the average of the dataset.
 * Using a dynamic canvas gradient here was causing addColorStop('undefined') crashes
 * whenever Chart.js tried to resolve the color before the canvas was fully mounted.
 */
const getCo2Color = (data) => {
    if (!data || data.length === 0) return CO2_COLOR_SAFE
    const validValues = data.filter(v => v != null && !isNaN(v))
    if (validValues.length === 0) return CO2_COLOR_SAFE
    const avg = validValues.reduce((a, b) => a + b, 0) / validValues.length
    if (avg < 1000) return CO2_COLOR_SAFE
    if (avg < 1500) return CO2_COLOR_WARNING
    return CO2_COLOR_DANGER
}

const AdminCombinedGraph = ({ series }) => {
    const [showTemp, setShowTemp] = useState(true)
    const [showHumidity, setShowHumidity] = useState(true)
    const [showVoltage, setShowVoltage] = useState(false)

    const chartData = useMemo(() => {
        if (!series || !Array.isArray(series) || series.length === 0) {
            return null
        }

        const labels = []
        const co2Values = []
        const tempValues = []
        const humidityValues = []
        const voltageValues = []

        series.forEach((item) => {
            if (!item.bucket_start) return
            const timestamp = new Date(item.bucket_start)
            if (isNaN(timestamp.getTime())) return

            labels.push(timestamp)
            co2Values.push(item.co2?.avg ?? item.co2 ?? null)
            tempValues.push(item.temperature?.avg ?? item.temperature ?? null)
            humidityValues.push(item.humidity?.avg ?? item.humidity ?? null)
            voltageValues.push(item.voltage?.avg ?? item.voltage ?? null)
        })

        if (labels.length === 0) return null

        const datasets = [
            {
                label: 'CO₂ (ppm)',
                data: co2Values,
                // Use a stable resolved color — no dynamic canvas gradient (avoids addColorStop crash)
                borderColor: getCo2Color(co2Values),
                backgroundColor: 'rgba(161, 161, 170, 0.05)',
                fill: true,
                tension: 0.4,
                pointRadius: 0,
                pointHoverRadius: 6,
                yAxisID: 'y',
                borderWidth: 2,
            }
        ]

        if (showTemp) {
            datasets.push({
                label: 'Temperature (°C)',
                data: tempValues,
                borderColor: theme.colors.text,     // stone-500
                backgroundColor: 'transparent',
                fill: false,
                tension: 0.4,
                pointRadius: 0,
                pointHoverRadius: 6,
                yAxisID: 'y1',
                borderWidth: 2,
            })
        }

        if (showHumidity) {
            datasets.push({
                label: 'Humidity (%)',
                data: humidityValues,
                borderColor: theme.colors.grid,     // stone-200
                backgroundColor: 'transparent',
                fill: false,
                tension: 0.4,
                pointRadius: 0,
                pointHoverRadius: 6,
                yAxisID: 'y1',
                borderWidth: 2,
                borderDash: [5, 5],
            })
        }

        if (showVoltage) {
            datasets.push({
                label: 'Voltage (V)',
                data: voltageValues,
                borderColor: theme.text.primary,
                backgroundColor: 'transparent',
                fill: false,
                tension: 0.4,
                pointRadius: 0,
                pointHoverRadius: 6,
                yAxisID: 'y2',
                borderWidth: 1,
                borderDash: [2, 2],
            })
        }

        return { labels, datasets }
    }, [series, showTemp, showHumidity, showVoltage])

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
            mode: 'index',
            intersect: false,
        },
        plugins: {
            legend: {
                display: true,
                position: 'top',
                labels: {
                    color: theme.colors.text,
                    usePointStyle: true,
                    padding: 20,
                    font: { size: 12 }
                }
            },
            tooltip: {
                enabled: true,
                backgroundColor: theme.colors.tooltipBg,
                titleColor: theme.text.primary,
                bodyColor: theme.colors.text,
                borderColor: theme.colors.grid,
                borderWidth: 1,
                padding: 12,
                cornerRadius: 8,
            }
        },
        scales: {
            x: {
                type: 'time',
                time: {
                    displayFormats: {
                        hour: 'HH:mm',
                        day: 'MMM d',
                    }
                },
                grid: {
                    display: false,
                },
                ticks: {
                    color: theme.colors.text,
                    maxRotation: 0,
                    autoSkip: true,
                    maxTicksLimit: 8,
                },
                border: {
                    display: false,
                }
            },
            y: {
                type: 'linear',
                display: true,
                position: 'left',
                title: {
                    display: true,
                    text: 'CO₂ (ppm)',
                    color: theme.colors.text,
                },
                grid: {
                    color: theme.colors.grid,
                    drawBorder: false,
                },
                ticks: {
                    color: theme.colors.text,
                },
                border: {
                    display: false,
                }
            },
            y1: {
                type: 'linear',
                display: showTemp || showHumidity,
                position: 'right',
                title: {
                    display: true,
                    text: 'Temp (°C) / Humidity (%)',
                    color: theme.colors.text,
                },
                grid: {
                    drawOnChartArea: false,
                },
                ticks: {
                    color: theme.colors.text,
                },
                border: {
                    display: false,
                }
            },
            y2: {
                type: 'linear',
                display: showVoltage,
                position: 'right',
                title: {
                    display: true,
                    text: 'Voltage (V)',
                    color: theme.text.primary,
                },
                grid: {
                    drawOnChartArea: false,
                },
                ticks: {
                    color: theme.text.primary,
                },
                border: {
                    display: false,
                }
            }
        }
    }

    return (
        <Card className="admin-combined-graph" elevation={2}>
            <div className="admin-combined-graph__header">

                <div className="admin-combined-graph__toggles">
                    <label className="admin-combined-graph__toggle">
                        <input
                            type="checkbox"
                            checked={showTemp}
                            onChange={(e) => setShowTemp(e.target.checked)}
                        />
                        <span>Temperature</span>
                    </label>
                    <label className="admin-combined-graph__toggle">
                        <input
                            type="checkbox"
                            checked={showHumidity}
                            onChange={(e) => setShowHumidity(e.target.checked)}
                        />
                        <span>Humidity</span>
                    </label>
                    <label className="admin-combined-graph__toggle">
                        <input
                            type="checkbox"
                            checked={showVoltage}
                            onChange={(e) => setShowVoltage(e.target.checked)}
                        />
                        <span>Voltage</span>
                    </label>
                </div>
            </div>
            <div className="admin-combined-graph__chart" style={{ height: '400px' }}>
                {chartData ? (
                    <Line data={chartData} options={chartOptions} />
                ) : (
                    <div className="admin-combined-graph__empty">No data to display</div>
                )}
            </div>
        </Card>
    )
}

export default AdminCombinedGraph