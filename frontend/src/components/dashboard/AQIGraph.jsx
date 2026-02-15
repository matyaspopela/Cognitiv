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
    buildAQIChartData, // Use the new builder
    hasValidChartData,
    getChartOptions,
} from '../../utils/charts'
import { getTimeWindowRange, getBucketSize } from '../../utils/timeWindow'
import Card from '../ui/Card'
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

const AQIGraph = ({ deviceId, timeWindow }) => {
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
                        // Use buildAQIChartData instead of buildCo2ChartData
                        const data = buildAQIChartData(filteredSeries, bucket)
                        if (hasValidChartData(data)) {
                            // Highlighting Logic: Find Min/Max points
                            const dataset = data.datasets[0]
                            const values = dataset.data

                            let minVal = Infinity
                            let maxVal = -Infinity
                            let minIdx = -1
                            let maxIdx = -1

                            values.forEach((v, i) => {
                                if (v !== null && v !== undefined) {
                                    if (v < minVal) { minVal = v; minIdx = i }
                                    if (v > maxVal) { maxVal = v; maxIdx = i }
                                }
                            })

                            // Create pointRadius array: 0 for most, 5 for min/max
                            const pointRadii = values.map((_, i) => (i === minIdx || i === maxIdx) ? 5 : 0)
                            const pointHovers = values.map((_, i) => (i === minIdx || i === maxIdx) ? 7 : 4)

                            dataset.pointRadius = pointRadii
                            dataset.pointHoverRadius = pointHovers

                            // Optional: Add specific styling for min/max points if needed
                            // For now, they inherit the segment color or dataset color logic

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
                console.error('Error loading AQI graph:', err)
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
                    label: (context) => `${context.dataset.label}: ${context.parsed.y}`
                }
            },
            legend: {
                display: false // Hide legend to improve data-ink ratio
            }
        },
        scales: {
            y: {
                min: 0,
                max: 100, // Fixed scale for AQI
                grid: {
                    color: 'rgba(255, 255, 255, 0.05)', // Very subtle grid
                },
                ticks: {
                    color: '#71717a', // Zinc 500
                    font: { size: 10 },
                    stepSize: 25 // Clean steps (0, 25, 50, 75, 100)
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
                    color: '#71717a', // Zinc 500
                    font: { size: 10 },
                    maxTicksLimit: 6, // Limit number of ticks significantly
                    maxRotation: 0, // Keep horizontal if possible
                    autoSkip: true,
                    align: 'start'
                },
                border: { display: false }
            }
        },
        maintainAspectRatio: false,
        elements: {
            point: {
                radius: 0, // Hide points by default
                hitRadius: 10,
                hoverRadius: 4
            }
        }
    })

    return (
        <div className="w-full h-full">
            <div className="w-full h-[300px]">
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

export default AQIGraph
