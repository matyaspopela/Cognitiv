import { useMemo } from 'react'
import { getCo2Color } from '../../utils/colors'
import Card from '../ui/Card'

const WeeklyHeatmap = ({ heatmap }) => {
    const heatmapData = useMemo(() => {
        if (!heatmap) return null

        // Create a 7x9 grid (days x hours: 08:00 to 16:00)
        const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
        // Hours 8 to 16 (inclusive)
        const hours = Array.from({ length: 9 }, (_, i) => i + 8)

        // Initialize grid with null values
        const grid = days.map(() => hours.map(() => null))

        // Fill grid from dictionary data
        // API format: "isoDay_hour": { avg_co2: 123, ... }
        // isoDay: 1=Mon, 7=Sun
        days.forEach((_, dayIndex) => {
            const isoDay = dayIndex + 1
            hours.forEach((hour, hourIndex) => {
                const key = `${isoDay}_${hour}`
                const cell = heatmap[key]
                if (cell && cell.avg_co2 !== undefined) {
                    grid[dayIndex][hourIndex] = cell.avg_co2
                }
            })
        })

        return { days, hours, grid }
    }, [heatmap])

    if (!heatmapData) {
        return (
            <Card className="p-6" elevation={1}>
                <div className="flex items-center justify-center h-[200px] text-stone-400 text-sm">
                    No heatmap data available
                </div>
            </Card>
        )
    }

    const { days, hours, grid } = heatmapData

    return (
        <Card className="p-6" elevation={1}>
            <div className="flex justify-between items-center mb-5">
                <span className="text-[11px] font-bold uppercase tracking-widest text-stone-500">CO₂ Heatmap</span>
                <div className="flex items-center gap-2">
                    <span className="text-[10px] text-stone-400 uppercase tracking-wider">Low</span>
                    <div className="w-[80px] h-2 rounded-sm" style={{ background: 'linear-gradient(to right, #16a34a, #d97706, #dc2626)' }} />
                    <span className="text-[10px] text-stone-400 uppercase tracking-wider">High</span>
                </div>
            </div>

            <div className="overflow-x-auto">
                <div className="min-w-[600px]">
                    {/* Hour labels */}
                    <div className="grid grid-cols-[48px_repeat(9,1fr)] gap-1 mb-1">
                        <div className="h-4" />
                        {hours.map((hour) => (
                            <div key={hour} className="text-[10px] text-stone-400 text-center font-medium">
                                {hour.toString().padStart(2, '0')}
                            </div>
                        ))}
                    </div>

                    {/* Grid rows */}
                    <div className="flex flex-col gap-1">
                        {days.map((day, dayIndex) => (
                            <div key={day} className="grid grid-cols-[48px_repeat(9,1fr)] gap-1 items-center">
                                <div className="text-[11px] font-medium text-stone-500">
                                    {day}
                                </div>
                                {grid[dayIndex].map((co2, hourIndex) => (
                                    <div
                                        key={hourIndex}
                                        className="h-9 w-full rounded-sm cursor-default transition-transform duration-100 hover:scale-105 hover:z-10"
                                        style={{
                                            backgroundColor: co2 !== null ? getCo2Color(co2) : '#f5f5f4',
                                            opacity: co2 !== null ? 0.85 : 1
                                        }}
                                        title={co2 !== null ? `${day} ${hours[hourIndex]}:00 — ${Math.round(co2)} ppm` : 'No data'}
                                    />
                                ))}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </Card>
    )
}

export default WeeklyHeatmap
