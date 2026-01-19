import { useState, useEffect } from 'react'
import { annotatedAPI } from '../../services/api'
import { getCo2Style, getCo2Color } from '../../utils/colors'

import Card from '../ui/Card'
import ProgressBar from '../ui/ProgressBar'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const HOURS = Array.from({ length: 24 }, (_, i) => i)

/**
 * HourlyHeatmap - Shows CO2 levels in hour × weekday grid
 */
const HourlyHeatmap = ({ deviceId, weeks = 4 }) => {
    const [heatmapData, setHeatmapData] = useState({})
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [maxCo2, setMaxCo2] = useState(2000)

    useEffect(() => {
        const loadData = async () => {
            try {
                setLoading(true)
                setError(null)

                const response = await annotatedAPI.getHeatmap(deviceId, weeks)

                if (response?.data?.status === 'success' && response.data.heatmap) {
                    setHeatmapData(response.data.heatmap)

                    // Find max CO2 for color scaling
                    const values = Object.values(response.data.heatmap)
                        .map(v => v.avg_co2)
                        .filter(v => v != null)
                    if (values.length > 0) {
                        setMaxCo2(Math.max(...values, 1500))
                    }
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
    }, [deviceId, weeks])



    // Filter to school hours (7-16) for cleaner display
    const schoolHours = HOURS.filter(h => h >= 7 && h <= 16)

    return (
        <Card className="hourly-heatmap">
            <h3 className="text-lg font-semibold text-zinc-100 mb-4">
                CO₂ Heatmap (Hour × Day)
            </h3>
            <div style={{ minHeight: '250px' }}>
                {loading ? (
                    <div className="flex items-center justify-center h-full py-8">
                        <ProgressBar indeterminate />
                    </div>
                ) : error ? (
                    <div className="flex items-center justify-center h-full text-zinc-500 py-8">
                        <p>{error}</p>
                    </div>
                ) : Object.keys(heatmapData).length === 0 ? (
                    <div className="flex items-center justify-center h-full text-zinc-500 py-8">
                        <p>No heatmap data available</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                            <thead>
                                <tr>
                                    <th className="p-1 text-xs text-zinc-500 text-left w-12"></th>
                                    {schoolHours.map(hour => (
                                        <th key={hour} className="p-1 text-xs text-zinc-400 text-center">
                                            {hour}-{hour + 1}
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
                                            const style = getCo2Style(co2, 0.85)

                                            return (
                                                <td
                                                    key={hour}
                                                    className={`p-0.5`}
                                                >
                                                    <div
                                                        className={`w-full h-6 rounded flex items-center justify-center cursor-default transition-transform hover:scale-110`}
                                                        style={style}
                                                        title={co2 != null ? `${day} ${hour}:00-${hour + 1}:00 : ${Math.round(co2)} ppm` : 'No data'}
                                                    >
                                                        {co2 != null && (
                                                            <span className="text-[10px] font-medium" style={{ color: style.color }}>
                                                                {Math.round(co2)}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                            )
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {/* Gradient Legend */}
                        <div className="flex flex-col items-center gap-2 mt-6">
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
                    </div>
                )}
            </div>
        </Card>
    )
}

export default HourlyHeatmap
