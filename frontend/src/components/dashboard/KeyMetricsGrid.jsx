import { useState, useEffect } from 'react'
import { Wind, Thermometer, Droplets, BarChart3 } from 'lucide-react'
import { dataAPI } from '../../services/api'
import { getHoursForStats } from '../../utils/timeWindow'
import { getCo2Color } from '../../utils/colors'
import MetricCard from './MetricCard'
import ProgressBar from '../ui/ProgressBar'

/**
 * KeyMetricsGrid Component
 * Displays key sensor metrics in a grid of MetricCards.
 * Replaces the old NumericalValues component with a more reusable and styled approach.
 */
const KeyMetricsGrid = ({ deviceId, timeWindow }) => {
    const [values, setValues] = useState(null)
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
                    const stats = payload.stats
                    setValues({
                        co2: stats.co2?.current ?? stats.co2?.avg ?? null,
                        temperature: stats.temperature?.current ?? stats.temperature?.avg ?? null,
                        humidity: stats.humidity?.current ?? stats.humidity?.avg ?? null,
                        readings: stats.data_points ?? null
                    })
                } else {
                    setValues(null)
                }
            } catch (error) {
                console.error('Error loading key metrics:', error)
                setValues(null)
            } finally {
                setLoading(false)
            }
        }

        loadValues()
    }, [deviceId, timeWindow])

    if (loading) {
        return (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => (
                    <div key={i} className="bg-zinc-900/50 border border-white/10 rounded-lg p-4">
                        <ProgressBar indeterminate />
                    </div>
                ))}
            </div>
        )
    }

    const co2Value = values?.co2
    const co2Color = co2Value != null ? getCo2Color(co2Value) : null

    // Helper for secondary metrics
    const MetricItem = ({ label, value, icon: Icon, colorClass = "text-zinc-400" }) => (
        <div className="flex flex-col items-start justify-center h-full px-6 border-l border-white/5 first:border-l-0">
            <div className="flex items-center gap-2 mb-1">
                <Icon size={14} strokeWidth={2} className={colorClass} />
                <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">{label}</span>
            </div>
            <span className="text-xl font-semibold text-zinc-200 tracking-tight">{value}</span>
        </div>
    )

    return (
        <div className="w-full bg-zinc-900/50 backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden flex flex-col md:flex-row h-auto md:h-32 mb-6">

            {/* Hero Section: CO2 (40% width) */}
            <div className="flex-1 md:flex-[0.4] p-6 flex flex-col justify-center bg-zinc-900/80 md:border-r border-white/10">
                <div className="flex items-center gap-2 mb-2">
                    <Wind size={18} strokeWidth={2} className="text-zinc-400" />
                    <span className="text-xs font-medium uppercase tracking-wider text-zinc-400">Current CO₂</span>
                </div>

                <div className="flex items-baseline gap-3 mt-1">
                    <span
                        className="text-5xl font-bold tracking-tight"
                        style={{ color: co2Color || '#e4e4e7' }}
                    >
                        {co2Value != null ? Math.round(co2Value) : '--'}
                    </span>
                    <span className="text-lg text-zinc-500 font-medium">ppm</span>
                </div>

                {co2Color && (
                    <div className="flex items-center gap-2 mt-3">
                        <div className="h-2 w-2 rounded-full" style={{ backgroundColor: co2Color }} />
                        <span className="text-sm font-medium" style={{ color: co2Color }}>
                            {co2Value < 1000 ? 'Good Air Quality' : co2Value < 1500 ? 'Moderate' : 'High CO₂ Levels'}
                        </span>
                    </div>
                )}
            </div>

            {/* Secondary Metrics (60% width, divided equally) */}
            <div className="flex-1 md:flex-[0.6] grid grid-cols-3">
                <MetricItem
                    label="Temperature"
                    value={values?.temperature != null ? `${values.temperature.toFixed(1)}°C` : '--'}
                    icon={Thermometer}
                />
                <MetricItem
                    label="Humidity"
                    value={values?.humidity != null ? `${Math.round(values.humidity)}%` : '--'}
                    icon={Droplets}
                />
                <MetricItem
                    label="Readings"
                    value={values?.readings != null ? values.readings.toLocaleString('en-US') : '--'}
                    icon={BarChart3}
                />
            </div>
        </div>
    )
}

export default KeyMetricsGrid
