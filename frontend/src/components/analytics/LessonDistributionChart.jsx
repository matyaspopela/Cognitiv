import { useState, useEffect } from 'react'
import { Bar } from 'react-chartjs-2'
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
} from 'chart.js'
import { annotatedAPI } from '../../services/api'
import { getCo2Color } from '../../utils/colors'
import Card from '../ui/Card'
import ProgressBar from '../ui/ProgressBar'

// Register Chart.js components
ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend
)

/**
 * LessonDistributionChart - Shows CO2 distribution by subject
 */
const LessonDistributionChart = ({ deviceId, startDate, endDate }) => {
    const [chartData, setChartData] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    useEffect(() => {
        const loadData = async () => {
            try {
                setLoading(true)
                setError(null)

                const response = await annotatedAPI.getSummary(startDate, endDate, deviceId)

                if (response?.data?.status === 'success' && response.data.by_subject) {
                    const subjects = response.data.by_subject

                    if (subjects.length === 0) {
                        setError('No lesson data available')
                        setChartData(null)
                        return
                    }

                    // Sort by reading count and take top 10
                    const topSubjects = subjects.slice(0, 10)

                    setChartData({
                        labels: topSubjects.map(s => s.subject || 'Unknown'),
                        datasets: [{
                            label: 'Average CO₂ (ppm)',
                            data: topSubjects.map(s => s.avg_co2),
                            backgroundColor: topSubjects.map(s => getCo2Color(s.avg_co2, 0.8)),
                            borderColor: 'rgba(255, 255, 255, 0.1)',
                            borderWidth: 1,
                            borderRadius: 4,
                        }]
                    })
                } else {
                    setError('Failed to load subject data')
                }
            } catch (err) {
                console.error('Error loading lesson distribution:', err)
                setError('Error loading data')
            } finally {
                setLoading(false)
            }
        }

        loadData()
    }, [deviceId, startDate, endDate])

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        plugins: {
            legend: {
                display: false,
            },
            tooltip: {
                backgroundColor: 'rgba(24, 24, 27, 0.95)',
                titleColor: '#f4f4f5',
                bodyColor: '#a1a1aa',
                borderColor: 'rgba(255, 255, 255, 0.1)',
                borderWidth: 1,
                padding: 12,
                cornerRadius: 8,
                callbacks: {
                    label: (context) => `${context.parsed.x} ppm`
                }
            }
        },
        scales: {
            x: {
                grid: {
                    color: 'rgba(255, 255, 255, 0.05)',
                },
                ticks: {
                    color: '#71717a',
                },
                title: {
                    display: true,
                    text: 'Average CO₂ (ppm)',
                    color: '#a1a1aa',
                }
            },
            y: {
                grid: {
                    display: false,
                },
                ticks: {
                    color: '#f4f4f5',
                }
            }
        }
    }

    return (
        <Card className="lesson-distribution-chart">
            <h3 className="text-lg font-semibold text-zinc-100 mb-4">
                CO₂ by Subject
            </h3>
            <div style={{ height: '300px' }}>
                {loading ? (
                    <div className="flex items-center justify-center h-full">
                        <ProgressBar indeterminate />
                    </div>
                ) : error ? (
                    <div className="flex items-center justify-center h-full text-zinc-500">
                        <p>{error}</p>
                    </div>
                ) : chartData ? (
                    <Bar data={chartData} options={options} />
                ) : (
                    <div className="flex items-center justify-center h-full text-zinc-500">
                        <p>No data available</p>
                    </div>
                )}
            </div>
        </Card>
    )
}

export default LessonDistributionChart
