import { useMemo } from 'react'
import { Bar } from 'react-chartjs-2'
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend
} from 'chart.js'
import { getCo2Color } from '../../utils/colors'
import Card from '../ui/Card'

// Register Chart.js components
ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend
)

const LessonDistributionChart = ({ lessons, summary, grouping = 'period' }) => {
    const chartData = useMemo(() => {
        let labels = []
        let values = []
        let rawData = []

        if (grouping === 'period') {
            const periodData = lessons?.by_period || []
            if (periodData.length === 0) return null

            // Sort by lesson number
            const sorted = [...periodData].sort((a, b) => (a.lesson_number || 0) - (b.lesson_number || 0))
            labels = sorted.map(p => `Lesson ${p.lesson_number}`)
            values = sorted.map(p => p.avg_co2 || 0)
            rawData = sorted
        } else if (grouping === 'subject') {
            const subjectData = summary?.by_subject || []
            if (subjectData.length === 0) return null

            // Sort by CO2 descending
            const sorted = [...subjectData].sort((a, b) => (b.avg_co2 || 0) - (a.avg_co2 || 0))
            labels = sorted.map(s => s.subject || 'Unknown')
            values = sorted.map(s => s.avg_co2 || 0)
            rawData = sorted
        } else if (grouping === 'teacher') {
            const teacherData = lessons?.by_teacher || []
            if (teacherData.length === 0) return null

            // Sort by CO2 descending
            const sorted = [...teacherData].sort((a, b) => (b.avg_co2 || 0) - (a.avg_co2 || 0))
            labels = sorted.map(t => t.teacher || 'Unknown')
            values = sorted.map(t => t.avg_co2 || 0)
            rawData = sorted
        }

        if (labels.length === 0) return null

        // Color bars based on CO2 levels
        const backgroundColors = values.map(co2 => getCo2Color(co2))

        return {
            labels,
            datasets: [{
                label: 'Avg CO₂ (ppm)',
                data: values,
                backgroundColor: backgroundColors,
                borderColor: backgroundColors,
                borderWidth: 1,
                // Store metadata for tooltips
                rawData: rawData
            }]
        }
    }, [lessons, summary, grouping])

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: false
            },
            tooltip: {
                enabled: true,
                backgroundColor: '#18181b',
                titleColor: '#f4f4f5',
                bodyColor: '#a1a1aa',
                borderColor: '#27272a',
                borderWidth: 1,
                padding: 12,
                cornerRadius: 8,
                callbacks: {
                    title: (context) => context[0].label,
                    label: (context) => {
                        const index = context.dataIndex
                        const item = context.dataset.rawData[index]

                        const lines = [`Avg CO₂: ${Math.round(item.avg_co2 || 0)} ppm`]

                        if (item.max_co2) lines.push(`Max CO₂: ${Math.round(item.max_co2)} ppm`)
                        if (item.reading_count) lines.push(`Readings: ${item.reading_count}`)
                        if (item.lesson_count) lines.push(`Lessons: ${item.lesson_count}`)

                        return lines
                    }
                }
            }
        },
        scales: {
            x: {
                grid: { display: false },
                ticks: { color: '#71717a' },
                border: { display: false }
            },
            y: {
                title: {
                    display: true,
                    text: 'Avg CO₂ (ppm)',
                    color: '#a1a1aa',
                },
                grid: {
                    color: '#27272a',
                    drawBorder: false,
                },
                ticks: { color: '#a1a1aa' },
                border: { display: false }
            }
        }
    }

    const titleMap = {
        'period': 'CO₂ Levels by Period',
        'subject': 'CO₂ Levels by Subject',
        'teacher': 'CO₂ Levels by Teacher'
    }

    return (
        <Card className="min-h-[400px] p-6 flex flex-col" elevation={2}>
            <div className="mb-6">
                <h3 className="text-lg font-semibold text-zinc-100">{titleMap[grouping]}</h3>
            </div>
            <div className="flex-1 w-full relative min-h-[300px]">
                {chartData ? (
                    <Bar data={chartData} options={chartOptions} />
                ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-zinc-500 text-sm">
                        No data available for this grouping
                    </div>
                )}
            </div>
        </Card>
    )
}

export default LessonDistributionChart
