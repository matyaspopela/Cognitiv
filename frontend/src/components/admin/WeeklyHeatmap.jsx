import { useMemo } from 'react'
import { getCo2Color } from '../../utils/colors'
import Card from '../ui/Card'

const WeeklyHeatmap = ({ heatmap }) => {
    const heatmapData = useMemo(() => {
        if (!heatmap) return null

        // Weekdays only — weekend ingestion is intentionally skipped server-side
        const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
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
            <div className="flex justify-between items-center mb-3">
                <span className="text-[11px] font-bold uppercase tracking-widest text-stone-500">CO₂ Heatmap</span>
            </div>

            <div>
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
                                    className="h-9 w-full rounded-sm cursor-default flex items-center justify-center text-[10px] font-medium tabular-nums text-stone-800/70"
                                    style={{
                                        backgroundColor: co2 !== null ? getCo2Color(co2) : '#f5f5f4',
                                        opacity: co2 !== null ? 0.9 : 1
                                    }}
                                    title={co2 !== null ? `${day} ${hours[hourIndex]}:00 — ${Math.round(co2)} ppm` : 'No data'}
                                >
                                    {co2 !== null ? Math.round(co2) : ''}
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            </div>
        </Card>
    )
}

export default WeeklyHeatmap
