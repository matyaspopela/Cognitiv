import { useState, useEffect } from 'react'
import { CheckCircle, Circle, TrendingDown, TrendingUp } from 'lucide-react'
import { dataAPI } from '../../services/api'
import MetricCard from './MetricCard'
import ProgressBar from '../ui/ProgressBar'
import './DashboardOverview.css'

/**
 * DashboardOverview Component
 * Displays aggregate statistics across all devices using MetricCards
 */
const DashboardOverview = () => {
  const [stats, setStats] = useState({
    totalDevices: 0,
    averageCo2: null,
    totalDataPoints: 0,
    onlineDevices: 0
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const loadOverviewStats = async () => {
      try {
        setLoading(true)
        setError(null)

        // Fetch all data in parallel
        const [devicesResponse, statsResponse, statusResponse] = await Promise.all([
          dataAPI.getDevices().catch(err => ({ error: err })),
          dataAPI.getStats(24).catch(err => ({ error: err })), // 24 hour window for overall stats
          dataAPI.getStatus().catch(err => ({ error: err }))
        ])

        // Process devices list
        let totalDevices = 0
        let onlineDevices = 0

        if (!devicesResponse.error && devicesResponse.data) {
          const devices = devicesResponse.data?.devices || devicesResponse.data || []
          totalDevices = Array.isArray(devices) ? devices.length : 0
          onlineDevices = Array.isArray(devices) 
            ? devices.filter(d => d.status === 'online' || (d.last_seen && (new Date() - new Date(d.last_seen)) < 5 * 60 * 1000)).length 
            : 0
        }

        // Process overall stats
        let averageCo2 = null

        if (!statsResponse.error && statsResponse.data) {
          const payload = statsResponse.data
          if (payload?.status === 'success' && payload?.stats?.co2) {
            const co2Stats = payload.stats.co2
            averageCo2 = co2Stats.avg ?? co2Stats.current ?? null
          }
        }

        // Process status
        let totalDataPoints = 0
        if (!statusResponse.error && statusResponse.data) {
          const payload = statusResponse.data
          if (payload?.status === 'online' && payload?.data_points !== undefined) {
            totalDataPoints = payload.data_points
          }
        }

        setStats({
          totalDevices,
          averageCo2,
          totalDataPoints,
          onlineDevices
        })
      } catch (err) {
        console.error('Error loading overview statistics:', err)
        setError('Nepodařilo se načíst přehledové statistiky')
      } finally {
        setLoading(false)
      }
    }

    loadOverviewStats()
  }, [])


  if (loading) {
    return (
      <div className="dashboard-overview-loading">
        <ProgressBar indeterminate />
        <p>Načítám přehledové statistiky...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="dashboard-overview-error">
        <p>{error}</p>
      </div>
    )
  }

  return (
    <div className="dashboard-overview-grid">
      <MetricCard
        label="Total Devices"
        value={stats.totalDevices}
        trend={null}
      />
      <MetricCard
        label="Online Devices"
        value={stats.onlineDevices}
        trend={stats.totalDevices > 0 ? {
          direction: stats.onlineDevices === stats.totalDevices ? 'up' : 'neutral',
          icon: stats.onlineDevices === stats.totalDevices ? <CheckCircle size={14} strokeWidth={2} /> : <Circle size={14} strokeWidth={2} />,
          value: `${Math.round((stats.onlineDevices / stats.totalDevices) * 100)}%`
        } : null}
      />
      <MetricCard
        label="Average CO₂"
        value={stats.averageCo2 !== null && stats.averageCo2 !== undefined
          ? `${Math.round(stats.averageCo2)} ppm`
          : '--'}
        trend={stats.averageCo2 !== null && stats.averageCo2 < 1500 ? {
          direction: 'up',
          icon: <TrendingDown size={14} strokeWidth={2} />,
          value: 'Good'
        } : stats.averageCo2 !== null ? {
          direction: 'down',
          icon: <TrendingUp size={14} strokeWidth={2} />,
          value: 'High'
        } : null}
      />
      <MetricCard
        label="Total Measurements"
        value={stats.totalDataPoints > 0
          ? stats.totalDataPoints.toLocaleString('en-US')
          : '--'}
      />
    </div>
  )
}

export default DashboardOverview

