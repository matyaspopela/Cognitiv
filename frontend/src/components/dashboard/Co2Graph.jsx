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
} from 'chart.js'
import { Line } from 'react-chartjs-2'
import 'chartjs-adapter-date-fns'
import { historyAPI } from '../../services/api'
import {
    buildCo2ChartData,
    hasValidChartData,
    getChartOptions,
} from '../../utils/charts'
import { getTimeWindowRange, getBucketSize } from '../../utils/timeWindow'
import ProgressBar from '../ui/ProgressBar'

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
    TimeScale
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
            },
            legend: {
                display: false
            }
        },
        scales: {
            y: {
                // Auto scale for CO2
                grid: {
                    color: 'rgba(255, 255, 255, 0.05)',
                },
                ticks: {
                    color: '#71717a',
                    font: { size: 10 },
                },
                border: { display: false }
            },
            x: {
                type: 'time',
                time: {
                    unit: 'hour',
                    displayFormats: {
                        hour: 'MMM d HH:mm',
                        day: 'MMM d'
                    },
                    tooltipFormat: 'MMM d, yyyy HH:mm'
                },
                grid: {
                    display: true,
                    color: 'rgba(255, 255, 255, 0.05)'
                },
                ticks: {
                    color: '#71717a',
                    font: { size: 10 },
                    maxTicksLimit: 6,
                    maxRotation: 0,
                    autoSkip: true,
                    align: 'start'
                },
                border: { display: false }
            }
        },
        maintainAspectRatio: false,
        elements: {
            point: {
                radius: 0,
                hitRadius: 10,
                hoverRadius: 4
            }
        }
    })

    // Setting: Toggle average display here
    const SHOW_AVG_CO2 = true

    // Calculate Average from displayed data
    let averageCo2 = null
    if (chartData && chartData.datasets && chartData.datasets[0] && chartData.datasets[0].data) {
        const values = chartData.datasets[0].data.filter(v => v !== null && v !== undefined)
        if (values.length > 0) {
            const sum = values.reduce((a, b) => a + b, 0)
            averageCo2 = Math.round(sum / values.length)
        }
    }

    return (
        <div className="w-full h-full mt-8">
            <div className="flex items-center gap-2 mb-2 px-2">
                <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">CO₂ Levels (Dev Verification)</span>
                {SHOW_AVG_CO2 && averageCo2 !== null && (
                    <span className="text-xs font-bold text-zinc-400 ml-2">
                        Avg: {averageCo2} ppm
                    </span>
                )}
            </div>
            <div className="w-full h-[200px]">
                {loading ? (
                    <div className="flex items-center justify-center h-full">
                        <ProgressBar indeterminate />
                    </div>
                ) : error ? (
                    <div className="flex items-center justify-center h-full text-zinc-500">
                        <p>{error}</p>
                    </div>
                ) : chartData ? (
                    <div className="w-full h-full">
                        <Line ref={chartRef} data={chartData} options={options} />
                    </div>
                ) : (
                    <div className="flex items-center justify-center h-full text-zinc-500">
                        <p>No data to display</p>
                    </div>
                )}
            </div>
        </div>
    )
}

export default Co2Graph
