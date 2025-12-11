import { useState, useEffect } from 'react'
import { dataAPI } from '../../services/api'
import Card from '../ui/Card'
import ProgressBar from '../ui/ProgressBar'
import './DashboardOverview.css'

/**
 * DashboardOverview Component
 * Displays aggregate statistics across all devices
 */
const DashboardOverview = () => {
  const [stats, setStats] = useState({
    totalDevices: 0,
    averageCo2: null,
    totalDataPoints: 0
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

        if (!devicesResponse.error && devicesResponse.data) {
          const devices = devicesResponse.data?.devices || devicesResponse.data || []
          totalDevices = Array.isArray(devices) ? devices.length : 0
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
          totalDataPoints
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
      <Card className="dashboard-overview" elevation={2}>
        <div className="dashboard-overview__loading">
          <ProgressBar indeterminate />
          <p>Načítám přehledové statistiky...</p>
        </div>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="dashboard-overview dashboard-overview--error" elevation={2}>
        <p className="dashboard-overview__error">{error}</p>
      </Card>
    )
  }

  return (
    <Card className="dashboard-overview" elevation={2}>
      <div className="dashboard-overview__header">
        <h2 className="dashboard-overview__title">Přehled systému</h2>
      </div>
      <div className="dashboard-overview__content">
        <div className="dashboard-overview__stat">
          <span className="dashboard-overview__stat-label">Celkem zařízení</span>
          <span className="dashboard-overview__stat-value">{stats.totalDevices}</span>
        </div>

        <div className="dashboard-overview__divider" />

        <div className="dashboard-overview__stat">
          <span className="dashboard-overview__stat-label">Průměrná CO₂</span>
          <span className="dashboard-overview__stat-value">
            {stats.averageCo2 !== null && stats.averageCo2 !== undefined
              ? `${Math.round(stats.averageCo2)} ppm`
              : '--'}
          </span>
        </div>

        <div className="dashboard-overview__divider" />

        <div className="dashboard-overview__stat">
          <span className="dashboard-overview__stat-label">Celkem měření</span>
          <span className="dashboard-overview__stat-value">
            {stats.totalDataPoints > 0
              ? stats.totalDataPoints.toLocaleString('cs-CZ')
              : '--'}
          </span>
        </div>
      </div>
    </Card>
  )
}

export default DashboardOverview

