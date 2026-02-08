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
            <Card className="p-6" elevation={2}>
                <div className="flex justify-between items-center mb-5">
                    <h3 className="text-lg font-semibold text-zinc-100">Weekly Heatmap</h3>
                </div>
                <div className="flex items-center justify-center h-[200px] text-zinc-500 text-sm">
                    No heatmap data available
                </div>
            </Card>
        )
    }

    const { days, hours, grid } = heatmapData

    return (
        <Card className="p-6" elevation={2}>
            <div className="flex justify-between items-center mb-5">
                <h3 className="text-lg font-semibold text-zinc-100">Weekly CO₂ Heatmap</h3>
                <div className="flex items-center gap-2">
                    <span className="text-xs text-zinc-500">Low</span>
                    <div className="w-[100px] h-3 rounded-sm bg-gradient-to-r from-zinc-600 via-zinc-500 to-white opactiy-80"></div>
                    <span className="text-xs text-zinc-500">High</span>
                </div>
            </div>

            <div className="overflow-x-auto">
                <div className="min-w-[600px]">
                    {/* Hour labels */}
                    <div className="grid grid-cols-[60px_repeat(9,1fr)] gap-1 mb-1">
                        <div className="h-4"></div>
                        {hours.map((hour, i) => (
                            <div key={hour} className="text-[11px] text-zinc-500 text-center">
                                {/* Show label only for start, middle, end to reduce clutter, or show all if space permits */}
                                {hour.toString().padStart(2, '0')}
                            </div>
                        ))}
                    </div>

                    {/* Grid rows */}
                    <div className="flex flex-col gap-1">
                        {days.map((day, dayIndex) => (
                            <div key={day} className="grid grid-cols-[60px_repeat(9,1fr)] gap-1 items-center">
                                <div className="text-xs font-medium text-zinc-400 flex items-center">
                                    {day}
                                </div>
                                {grid[dayIndex].map((co2, hourIndex) => (
                                    <div
                                        key={hourIndex}
                                        className="h-10 w-full rounded-sm cursor-pointer transition-transform duration-100 hover:scale-105 hover:z-10"
                                        style={{
                                            backgroundColor: co2 !== null ? getCo2Color(co2) : '#27272a',
                                            opacity: co2 !== null ? 0.8 : 0.3
                                        }}
                                        title={co2 !== null ? `${day} ${hours[hourIndex]}:00 - ${Math.round(co2)} ppm` : 'No data'}
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
