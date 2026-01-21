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

    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard
                label="CO₂"
                value={co2Value != null ? `${Math.round(co2Value)} ppm` : '--'}
                trend={co2Color ? {
                    direction: co2Value < 1000 ? 'up' : co2Value < 1500 ? 'neutral' : 'down',
                    icon: <Wind size={14} strokeWidth={2} style={{ color: co2Color }} />,
                    value: co2Value < 1000 ? 'Good' : co2Value < 1500 ? 'Moderate' : 'High'
                } : null}
                className="border border-white/10"
            />
            <MetricCard
                label="Temperature"
                value={values?.temperature != null ? `${values.temperature.toFixed(1)}°C` : '--'}
                trend={{
                    direction: 'neutral',
                    icon: <Thermometer size={14} strokeWidth={2} className="text-teal-400" />,
                }}
                className="border border-white/10"
            />
            <MetricCard
                label="Humidity"
                value={values?.humidity != null ? `${Math.round(values.humidity)}%` : '--'}
                trend={{
                    direction: 'neutral',
                    icon: <Droplets size={14} strokeWidth={2} className="text-blue-400" />,
                }}
                className="border border-white/10"
            />
            <MetricCard
                label="Readings"
                value={values?.readings != null ? values.readings.toLocaleString('en-US') : '--'}
                trend={{
                    direction: 'neutral',
                    icon: <BarChart3 size={14} strokeWidth={2} className="text-purple-400" />,
                }}
                className="border border-white/10"
            />
        </div>
    )
}

export default KeyMetricsGrid
