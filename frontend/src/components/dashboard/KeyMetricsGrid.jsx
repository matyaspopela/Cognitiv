import { useState, useEffect } from 'react'
import { Wind } from 'lucide-react'
import { dataAPI } from '../../services/api'
import { getHoursForStats } from '../../utils/timeWindow'
import CircularGauge from './CircularGauge'

/**
 * KeyMetricsGrid Component
 * Displays key AQI metrics: Current AQI and Average AQI.
 */
const KeyMetricsGrid = ({ deviceId, timeWindow }) => {
    const [stats, setStats] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const loadValues = async () => {
            if (!deviceId) return

            try {
                setLoading(true)
                const hours = getHoursForStats(timeWindow)
                const response = await dataAPI.getStats(hours, deviceId)
                const payload = response?.data

                if (payload?.status === 'success' && payload?.stats) {
                    setStats(payload.stats)
                } else {
                    setStats(null)
                }
            } catch (error) {
                console.error('Error loading key metrics:', error)
                setStats(null)
            } finally {
                setLoading(false)
            }
        }

        loadValues()
    }, [deviceId, timeWindow])

    if (loading) {
        return (
            <div className="w-full h-32 bg-zinc-900/50 backdrop-blur-sm border border-white/10 rounded-2xl animate-pulse" />
        )
    }

    const currentAqi = stats?.aqi?.current?.score ?? stats?.aqi?.score ?? 0
    const avgAqi = stats?.aqi?.avg?.score ?? 0
    const currentStatus = stats?.aqi?.current?.status ?? stats?.aqi?.status ?? 'Unknown'

    // Helper to get color for AQI status/score
    // Note: This logic duplicates CircularGauge.jsx logic slightly, ideally could be shared
    const getStatusColor = (score) => {
        if (score === null || score === undefined) return '#71717a' // Zinc 500
        if (score < 50) return '#ef4444' // Red (Poor)
        if (score < 90) return '#eab308' // Yellow (Fair)
        return '#22c55e' // Green (Good/Excellent)
    }

    const currentColor = getStatusColor(currentAqi)



    return (
        <div className="w-full flex justify-center mb-8">
            <div className="flex flex-row items-center gap-12">

                {/* Hero Metric: Consolidated Gauge (Value + Status + Label) */}
                <div className="transform scale-110">
                    <CircularGauge
                        value={currentAqi}
                        status={currentStatus}
                        label="AQI"
                        size={160}
                    />
                </div>

                {/* Comparative Context: Stats Vertical List */}
                <div className="flex flex-col justify-center gap-4 h-full border-l border-white/5 pl-12 py-2">

                    {/* Average */}
                    <div className="flex flex-col items-center">
                        <CircularGauge
                            value={avgAqi}
                            size={100}
                            label={`Last ${timeWindow}`}
                            status={null} // Only number + label
                        />
                    </div>

                </div>
            </div>
        </div>
    )
}

export default KeyMetricsGrid
