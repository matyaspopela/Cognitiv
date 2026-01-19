import { useState, useEffect } from 'react'
import { Bar } from 'react-chartjs-2'
import { getCo2Color } from '../../utils/colors'
import { annotatedAPI } from '../../services/api'
import Card from '../ui/Card'
import ProgressBar from '../ui/ProgressBar'

/**
 * LessonPeriodChart - Shows CO2 levels by lesson period (1-8)
 */
const LessonPeriodChart = ({ deviceId, startDate, endDate }) => {
    const [chartData, setChartData] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    useEffect(() => {
        const loadData = async () => {
            try {
                setLoading(true)
                setError(null)

                const response = await annotatedAPI.getLessons(startDate, endDate, deviceId)

                if (response?.data?.status === 'success' && response.data.by_period) {
                    const periods = response.data.by_period

                    if (periods.length === 0) {
                        setError('No period data available')
                        setChartData(null)
                        return
                    }

                    setChartData({
                        labels: periods.map(p => `Lesson ${p.lesson_number}`),
                        datasets: [{
                            label: 'Average CO₂ (ppm)',
                            data: periods.map(p => p.avg_co2),
                            backgroundColor: periods.map(p => getCo2Color(p.avg_co2, 0.8)),
                            borderColor: 'rgba(255, 255, 255, 0.1)',
                            borderWidth: 1,
                            borderRadius: 4,
                        }]
                    })
                } else {
                    setError('Failed to load period data')
                }
            } catch (err) {
                console.error('Error loading period chart:', err)
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
            }
        },
        scales: {
            x: {
                grid: {
                    display: false,
                },
                ticks: {
                    color: '#a1a1aa',
                }
            },
            y: {
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
            }
        }
    }

    return (
        <Card className="lesson-period-chart">
            <h3 className="text-lg font-semibold text-zinc-100 mb-4">
                CO₂ by Lesson Period
            </h3>
            <div style={{ height: '250px' }}>
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

export default LessonPeriodChart
