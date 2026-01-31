import { useState, useEffect } from 'react'
import { annotatedAPI } from '../../services/api'
import { getCo2Style, getCo2Color } from '../../utils/colors'

import Card from '../ui/Card'
import ProgressBar from '../ui/ProgressBar'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const HOURS = Array.from({ length: 24 }, (_, i) => i)

// Helper to get start/end dates based on mode
const getDateRange = (mode) => {
    const end = new Date()
    const start = new Date()

    if (mode === 'current_week') {
        // Start of current week (Monday)
        const day = start.getDay()
        const diff = start.getDate() - day + (day === 0 ? -6 : 1) // adjust when day is sunday
        start.setDate(diff)
        start.setHours(0, 0, 0, 0)
    } else if (mode === 'last_week') {
        // Start of last week (Monday)
        const day = end.getDay()
        const diff = end.getDate() - day + (day === 0 ? -6 : 1) - 7
        start.setDate(diff)
        start.setHours(0, 0, 0, 0)

        // End of last week (Sunday)
        end.setDate(diff + 6)
        end.setHours(23, 59, 59, 999)
    } else if (mode === 'last_month') {
        // Last 30 days
        start.setDate(end.getDate() - 30)
    }

    return {
        start: start.toISOString(),
        end: end.toISOString()
    }
}

/**
 * HourlyHeatmap - Shows CO2 levels in hour × weekday grid or daily trend
 */
const HourlyHeatmap = ({ deviceId }) => {
    const [viewMode, setViewMode] = useState('current_week') // 'current_week', 'last_week', 'last_month'
    const [heatmapData, setHeatmapData] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    useEffect(() => {
        const loadData = async () => {
            if (!deviceId) return

            try {
                setLoading(true)
                setError(null)

                const { start, end } = getDateRange(viewMode)
                const apiMode = viewMode === 'last_month' ? 'daily' : 'hourly'

                const response = await annotatedAPI.getHeatmap(deviceId, start, end, apiMode)

                if (response?.data?.status === 'success' && response.data.heatmap) {
                    setHeatmapData(response.data.heatmap)
                } else {
                    setError('Failed to load heatmap data')
                }
            } catch (err) {
                console.error('Error loading heatmap:', err)
                setError('Error loading data')
            } finally {
                setLoading(false)
            }
        }

        loadData()
    }, [deviceId, viewMode])

    // Filter to school hours (7-16) for cleaner display in hourly mode
    const schoolHours = HOURS.filter(h => h >= 7 && h <= 16)

    const renderModeToggle = () => (
        <div className="flex gap-2 text-xs mb-4">
            {[
                { id: 'current_week', label: 'Current Week' },
                { id: 'last_week', label: 'Last Week' },
                { id: 'last_month', label: 'Last Month' }
            ].map(mode => (
                <button
                    key={mode.id}
                    onClick={() => setViewMode(mode.id)}
                    className={`px-3 py-1.5 rounded-full transition-colors ${viewMode === mode.id
                            ? 'bg-zinc-100 text-zinc-900 font-medium'
                            : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                        }`}
                >
                    {mode.label}
                </button>
            ))}
        </div>
    )

    const renderHourlyGrid = () => {
        if (!heatmapData || Object.keys(heatmapData).length === 0) {
            return (
                <div className="flex items-center justify-center h-48 text-zinc-500">
                    <p>No data available for this week</p>
                </div>
            )
        }

        return (
            <div className="overflow-x-auto">
                <table className="w-full border-separate border-spacing-2">
                    <thead>
                        <tr>
                            <th className="p-1 text-xs text-zinc-500 text-left w-12"></th>
                            {schoolHours.map(hour => (
                                <th key={hour} className="p-1 text-xs text-zinc-400 text-center font-normal">
                                    {hour}h
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {WEEKDAYS.slice(0, 5).map((day, dayIndex) => (
                            <tr key={day}>
                                <td className="p-1 text-xs text-zinc-400 font-medium">{day}</td>
                                {schoolHours.map(hour => {
                                    const key = `${dayIndex + 1}_${hour}`
                                    const cellData = heatmapData[key]
                                    const co2 = cellData?.avg_co2
                                    const style = getCo2Style(co2, 0.9)

                                    return (
                                        <td key={hour} className="p-0">
                                            <div
                                                className="w-full aspect-square rounded-md cursor-pointer transition-all duration-200 hover:scale-110 hover:shadow-lg hover:z-10 relative group"
                                                style={style}
                                                title={co2 != null ? `${day} ${hour}:00-${hour + 1}:00 : ${Math.round(co2)} ppm` : 'No data'}
                                            >
                                                {/* Tooltip or simple interaction could go here, but text is removed */}
                                            </div>
                                        </td>
                                    )
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        )
    }

    const renderDailyGrid = () => {
        if (!Array.isArray(heatmapData) || heatmapData.length === 0) {
            return (
                <div className="flex items-center justify-center h-48 text-zinc-500">
                    <p>No data available for this month</p>
                </div>
            )
        }

        return (
            <div className="overflow-x-auto pb-2">
                <div className="flex gap-1 min-w-max">
                    {heatmapData.map((day, i) => {
                        const co2 = day.avg_co2
                        const style = getCo2Style(co2, 0.85)
                        const date = day.date ? new Date(day.date) : null
                        const dateStr = date ? date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : 'Unknown'
                        const dayName = date ? date.toLocaleDateString('en-GB', { weekday: 'short' }) : ''

                        return (
                            <div key={i} className="flex flex-col items-center gap-1 group">
                                <div
                                    className="w-8 h-8 rounded hover:scale-110 transition-transform cursor-default"
                                    style={style}
                                    title={`${dateStr}: ${co2 != null ? Math.round(co2) + ' ppm' : 'No data'}`}
                                ></div>
                                <span className="text-[10px] text-zinc-500 group-hover:text-zinc-300 transform -rotate-45 origin-left translate-y-2 mt-1">
                                    {dateStr}
                                </span>
                            </div>
                        )
                    })}
                </div>
            </div>
        )
    }

    return (
        <Card className="hourly-heatmap">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-zinc-100">
                    CO₂ Concentration Map
                </h3>
                {renderModeToggle()}
            </div>

            <div style={{ minHeight: '250px' }}>
                {loading ? (
                    <div className="flex items-center justify-center h-full py-8">
                        <ProgressBar indeterminate />
                    </div>
                ) : error ? (
                    <div className="flex items-center justify-center h-full text-zinc-500 py-8">
                        <p>{error}</p>
                    </div>
                ) : (
                    <>
                        {viewMode === 'last_month' ? renderDailyGrid() : renderHourlyGrid()}

                        {/* Gradient Legend */}
                        <div className="flex flex-col items-center gap-2 mt-8">
                            <div
                                className="w-64 h-3 rounded-full"
                                style={{
                                    background: `linear-gradient(to right, ${getCo2Color(400)}, ${getCo2Color(1200)}, ${getCo2Color(2000)})`
                                }}
                            />
                            <div className="flex justify-between w-64 text-xs text-zinc-500 font-medium">
                                <span>Good (400)</span>
                                <span>Moderate</span>
                                <span>Poor (2000+)</span>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </Card>
    )
}

export default HourlyHeatmap