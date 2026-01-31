import { useState, useEffect } from 'react'
import { historyAPI } from '../../services/api'
import { getTimeWindowRange } from '../../utils/timeWindow'
import Card from '../ui/Card'
import ProgressBar from '../ui/ProgressBar'
import { theme } from '../../design/theme'

/**
 * AirQualityGauge Component
 * Displays air quality distribution using a modern segmented bar gauge.
 * Replaces the old QualityDistributionBoxes with a cleaner, more informative design.
 */
const AirQualityGauge = ({ deviceId, timeWindow }) => {
    const [qualityData, setQualityData] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    useEffect(() => {
        const loadQualityData = async () => {
            if (!deviceId) return

            try {
                setLoading(true)
                setError(null)
                setQualityData(null)
                const { start, end } = getTimeWindowRange(timeWindow)

                const response = await historyAPI.getSummary(start, end, deviceId)

                if (response?.response?.status >= 400 || response?.status >= 400) {
                    setError('Failed to load data')
                    return
                }

                const summaryData = response?.data || response

                if (summaryData?.status === 'success' && summaryData?.summary?.co2_quality) {
                    const co2Quality = summaryData.summary.co2_quality
                    const good = typeof co2Quality.good === 'number' ? co2Quality.good : 0
                    const moderate = typeof co2Quality.moderate === 'number' ? co2Quality.moderate : 0
                    const high = typeof co2Quality.high === 'number' ? co2Quality.high : 0
                    const critical = typeof co2Quality.critical === 'number' ? co2Quality.critical : 0

                    const total = good + moderate + high + critical

                    if (total > 0) {
                        // Monochrome Palette (Zinc)
                        setQualityData({
                            good: { count: good, percent: (good / total) * 100, label: 'Good', threshold: '< 1000 ppm', color: '#52525b', textColor: '#f4f4f5' },       // Zinc 600
                            moderate: { count: moderate, percent: (moderate / total) * 100, label: 'Moderate', threshold: '1000-1500', color: '#71717a', textColor: '#f4f4f5' }, // Zinc 500
                            high: { count: high, percent: (high / total) * 100, label: 'Poor', threshold: '1500-2000', color: '#a1a1aa', textColor: '#18181b' },        // Zinc 400
                            critical: { count: critical, percent: (critical / total) * 100, label: 'Critical', threshold: '> 2000 ppm', color: '#ffffff', textColor: '#000000' } // White
                        })
                    } else {
                        setQualityData(null)
                    }
                } else {
                    setError('No data to display')
                }
            } catch (err) {
                console.error('Error loading quality distribution:', err)
                setError('Error loading data')
            } finally {
                setLoading(false)
            }
        }

        loadQualityData()
    }, [deviceId, timeWindow])

    if (loading) {
        return (
            <Card className="p-6 bg-zinc-900/50 border border-white/10" elevation={2}>
                <ProgressBar indeterminate />
            </Card>
        )
    }

    if (error || !qualityData) {
        return (
            <Card className="p-6 bg-zinc-900/50 border border-white/10" elevation={2}>
                <p className="text-zinc-500 text-center text-sm">{error || 'No data to display'}</p>
            </Card>
        )
    }

    const segments = [qualityData.good, qualityData.moderate, qualityData.high, qualityData.critical]

    return (
        <Card className="p-6 border border-white/10" elevation={2}>
            <h3 className="text-lg font-semibold text-zinc-100 tracking-tight mb-6">Air Quality Distribution</h3>

            {/* Colored Boxes Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {segments.map((seg, i) => (
                    <div
                        key={i}
                        className="rounded-xl p-4 text-center shadow-lg transition-colors"
                        style={{ backgroundColor: seg.color }}
                    >
                        <div className="text-sm font-medium mb-1" style={{ color: seg.textColor, opacity: 0.9 }}>{seg.label} ({seg.threshold}):</div>
                        <div className="text-2xl font-bold" style={{ color: seg.textColor }}>{seg.percent.toFixed(1)}%</div>
                    </div>
                ))}
            </div>
        </Card>
    )
}

export default AirQualityGauge