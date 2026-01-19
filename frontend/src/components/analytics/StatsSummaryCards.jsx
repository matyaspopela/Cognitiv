import { useState, useEffect } from 'react'
import { annotatedAPI } from '../../services/api'
import { getCo2Style } from '../../utils/colors'
import Card from '../ui/Card'
import ProgressBar from '../ui/ProgressBar'

/**
 * StatsSummaryCards - Key metrics summary for annotated data
 */
const StatsSummaryCards = ({ deviceId, startDate, endDate }) => {
    const [stats, setStats] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    useEffect(() => {
        const loadData = async () => {
            try {
                setLoading(true)
                setError(null)

                const response = await annotatedAPI.getSummary(startDate, endDate, deviceId)

                if (response?.data?.status === 'success' && response.data.summary) {
                    setStats(response.data.summary)
                } else {
                    setError('Failed to load statistics')
                }
            } catch (err) {
                console.error('Error loading stats:', err)
                setError('Error loading data')
            } finally {
                setLoading(false)
            }
        }

        loadData()
    }, [deviceId, startDate, endDate])

    const getCo2Quality = (co2) => {
        if (co2 == null) return { label: '--', color: '#71717a' }
        let label = 'Critical'
        if (co2 < 1000) label = 'Good'
        else if (co2 < 1500) label = 'Moderate'
        else if (co2 < 2000) label = 'Poor'

        return { label, color: getCo2Style(co2).textColor }
    }

    const calculatePoorAirPercent = (quality) => {
        if (!quality) return null
        const total = (quality.good || 0) + (quality.moderate || 0) +
            (quality.high || 0) + (quality.critical || 0)
        if (total === 0) return null
        const poorCount = (quality.high || 0) + (quality.critical || 0)
        return Math.round((poorCount / total) * 100)
    }

    if (loading) {
        return (
            <Card className="stats-summary-cards p-4">
                <ProgressBar indeterminate />
            </Card>
        )
    }

    if (error || !stats) {
        return (
            <Card className="stats-summary-cards p-4">
                <p className="text-zinc-500 text-center">{error || 'No data available'}</p>
            </Card>
        )
    }

    const qualityInfo = getCo2Quality(stats.avg_co2)
    const poorAirPercent = calculatePoorAirPercent(stats.co2_quality)

    return (
        <div className="stats-summary-cards grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Average CO2 */}
            <Card className="p-4">
                <p className="text-xs text-zinc-500 uppercase tracking-wide mb-1">Avg CO₂</p>
                <p className="text-2xl font-bold text-zinc-100">
                    {stats.avg_co2 != null ? `${Math.round(stats.avg_co2)} ppm` : '--'}
                </p>
                <p className="text-xs mt-1" style={{ color: qualityInfo.color }}>
                    {qualityInfo.label}
                </p>
            </Card>

            {/* Total Lessons */}
            <Card className="p-4">
                <p className="text-xs text-zinc-500 uppercase tracking-wide mb-1">Total Lessons</p>
                <p className="text-2xl font-bold text-zinc-100">
                    {stats.total_lessons != null ? stats.total_lessons.toLocaleString() : '--'}
                </p>
                <p className="text-xs text-zinc-500 mt-1">
                    {stats.total_readings ? `${stats.total_readings.toLocaleString()} readings` : ''}
                </p>
            </Card>

            {/* Poor Air Time */}
            <Card className="p-4">
                <p className="text-xs text-zinc-500 uppercase tracking-wide mb-1">Poor Air Time</p>
                <p className={`text-2xl font-bold ${poorAirPercent > 20 ? 'text-red-400' : 'text-zinc-100'}`}>
                    {poorAirPercent != null ? `${poorAirPercent}%` : '--'}
                </p>
                <p className="text-xs text-zinc-500 mt-1">
                    CO₂ &gt;1500 ppm
                </p>
            </Card>

            {/* Temperature/Humidity */}
            <Card className="p-4">
                <p className="text-xs text-zinc-500 uppercase tracking-wide mb-1">Climate</p>
                <p className="text-2xl font-bold text-zinc-100">
                    {stats.avg_temp != null ? `${stats.avg_temp}°C` : '--'}
                </p>
                <p className="text-xs text-zinc-500 mt-1">
                    {stats.avg_humidity != null ? `${stats.avg_humidity}% humidity` : ''}
                </p>
            </Card>
        </div>
    )
}

export default StatsSummaryCards
