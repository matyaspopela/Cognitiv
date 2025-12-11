import { useState, useEffect } from 'react'
import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js'
import { historyAPI } from '../../services/api'
import { buildMiniCo2Chart, miniChartOptions } from '../../utils/charts'

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

import Card from '../ui/Card'
import Badge from '../ui/Badge'
import ProgressBar from '../ui/ProgressBar'
import './DashboardBox.css'

/**
 * DashboardBox Component
 * Public dashboard box component for displaying device cards.
 * Simplified version of BoardCard without admin features.
 */
const DashboardBox = ({ device, onClick }) => {
  const [miniChartData, setMiniChartData] = useState(null)
  const [loadingMiniChart, setLoadingMiniChart] = useState(false)
  const [currentCo2, setCurrentCo2] = useState(null)

  // Get device identifier - prefer mac_address for API calls, fall back to device_id
  // This ensures we use a valid string identifier, never the whole object
  const getDeviceIdentifier = () => {
    if (typeof device === 'string') return device
    // Prefer mac_address as it's the primary identifier in the new system
    if (device?.mac_address) return device.mac_address
    // Fall back to device_id for legacy devices
    if (device?.device_id) return device.device_id
    // Last resort: display_name (can be used to look up device)
    if (device?.display_name) return device.display_name
    return null
  }
  
  const deviceIdentifier = getDeviceIdentifier()
  const deviceName = typeof device === 'string' ? device : device?.display_name || device?.device_id || device?.mac_address || 'Unknown'

  // Determine if device is offline based on status and last_seen timestamp
  // Same logic as BoardCard in admin panel
  const getIsOffline = () => {
    if (!device) return true
    if (typeof device === 'string') return true // Can't determine status from string
    
    // If status is explicitly 'offline', treat as offline
    if (device.status === 'offline') return true
    
    // If status is 'online', also check last_seen timestamp as safety measure
    if (device.last_seen) {
      try {
        // Parse last_seen timestamp (format: "2024-01-31 12:00:00")
        const lastSeenDate = new Date(device.last_seen)
        if (!isNaN(lastSeenDate.getTime())) {
          const now = new Date()
          const minutesAgo = (now.getTime() - lastSeenDate.getTime()) / (1000 * 60)
          // If last_seen is more than 5 minutes ago, consider offline
          if (minutesAgo > 5) {
            return true
          }
        }
      } catch (error) {
        // If parsing fails, fall back to status
      }
    }
    
    // Default to checking status
    return device.status !== 'online'
  }
  
  const isOffline = getIsOffline()

  // Initialize current CO2 from device readings
  useEffect(() => {
    if (device?.current_readings?.co2 != null) {
      setCurrentCo2(Math.round(device.current_readings.co2))
    }
  }, [device])

  useEffect(() => {
    // Load last 1 hour of CO2 data for mini graph
    // Only load for online devices
    const loadMiniChartData = async () => {
      if (!deviceIdentifier) return
      if (isOffline) {
        setMiniChartData(null)
        setLoadingMiniChart(false)
        return
      }

      try {
        setLoadingMiniChart(true)
        const now = new Date()
        const oneHourAgo = new Date(now.getTime() - (60 * 60 * 1000))
        const startIso = oneHourAgo.toISOString()
        const endIso = now.toISOString()

        // Try multiple bucket sizes and handle errors gracefully
        const bucketOptions = ['10min', 'hour', 'raw']
        let chartLoaded = false

        for (const bucket of bucketOptions) {
          try {
            const response = await historyAPI.getSeries(startIso, endIso, bucket, deviceIdentifier)
            
            if (response?.response?.status >= 400 || response?.status >= 400) {
              continue
            }

            const seriesData = response?.data || response

            if (seriesData?.status === 'error' || !seriesData) {
              continue
            }

            if (seriesData?.status === 'success' && seriesData.series?.length > 0) {
              let seriesToUse = seriesData.series
              if (bucket === 'raw' && seriesToUse.length > 200) {
                const step = Math.ceil(seriesToUse.length / 200)
                seriesToUse = seriesToUse.filter((_, index) => index % step === 0)
              }

              const chartData = buildMiniCo2Chart(seriesToUse)
              if (chartData.datasets?.[0]?.data?.length > 0) {
                setMiniChartData(chartData)
                chartLoaded = true
                // Don't update currentCo2 from chart data - use device.current_readings.co2 instead
                // The chart shows historical/averaged data, not the current reading
                break
              }
            }
          } catch (error) {
            continue
          }
        }

        // If no chart data loaded, at least we have current CO2 from device readings
        if (!chartLoaded && device?.current_readings?.co2 != null) {
          setCurrentCo2(Math.round(device.current_readings.co2))
        }
      } catch (error) {
        // Final fallback - use current reading from device
        if (device?.current_readings?.co2 != null) {
          setCurrentCo2(Math.round(device.current_readings.co2))
        }
      } finally {
        setLoadingMiniChart(false)
      }
    }

    if (!isOffline) {
      loadMiniChartData()
    }
  }, [deviceIdentifier, isOffline, device])

  const handleClick = () => {
    if (onClick && deviceIdentifier) {
      onClick(deviceIdentifier)
    }
  }

  return (
    <Card
      className={`dashboard-box ${isOffline ? 'dashboard-box--offline' : ''}`}
      elevation={2}
      onClick={handleClick}
    >
      <div className="dashboard-box__header">
        <h3 className="dashboard-box__name">{deviceName}</h3>
        <div className="dashboard-box__header-actions">
          <Badge
            variant="standard"
            color={isOffline ? 'error' : 'success'}
          >
            {isOffline ? 'Offline' : 'Online'}
          </Badge>
        </div>
      </div>

      <div className="dashboard-box__body">
        {/* Mini CO2 Graph - Only show for online devices */}
        {!isOffline && (
          <div className="dashboard-box__graph-container">
            {loadingMiniChart ? (
              <div className="dashboard-box__graph-loading">
                <ProgressBar indeterminate />
              </div>
            ) : miniChartData && miniChartData.datasets?.[0]?.data?.length > 0 ? (
              <div className="dashboard-box__graph">
                <Line data={miniChartData} options={miniChartOptions} />
              </div>
            ) : currentCo2 !== null && currentCo2 !== undefined ? (
              <div className="dashboard-box__graph-placeholder">
                <div className="dashboard-box__graph-placeholder-value">{currentCo2}</div>
                <div className="dashboard-box__graph-placeholder-label">ppm</div>
              </div>
            ) : (
              <div className="dashboard-box__graph-empty">
                <span>Žádná data</span>
              </div>
            )}
          </div>
        )}

        {/* Current CO2 Value - Only show for online devices */}
        {!isOffline && (
          <div className="dashboard-box__current-value">
            <span className="dashboard-box__current-label">Aktuální CO₂:</span>
            <span className="dashboard-box__current-number">
              {currentCo2 !== null && currentCo2 !== undefined
                ? `${currentCo2} ppm`
                : '--'}
            </span>
          </div>
        )}

        {/* Offline message */}
        {isOffline && (
          <div className="dashboard-box__offline-message">
            <span>Nejsou dostupná žádná data</span>
          </div>
        )}
      </div>
    </Card>
  )
}

export default DashboardBox

