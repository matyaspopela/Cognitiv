import { useState, useEffect } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
} from 'chart.js'
import { Line } from 'react-chartjs-2'
import { historyAPI } from '../../services/api'
import { buildMiniCo2ChartData, hasValidChartData, getMiniChartOptions } from '../../utils/charts'

import Card from '../ui/Card'
import Badge from '../ui/Badge'
import ProgressBar from '../ui/ProgressBar'
import './DashboardBox.css'

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler
)

/**
 * DashboardBox Component
 * Public dashboard box component for displaying device cards.
 */
const DashboardBox = ({ device, onClick }) => {
  const [miniChartData, setMiniChartData] = useState(null)
  const [loadingMiniChart, setLoadingMiniChart] = useState(false)
  const [currentCo2, setCurrentCo2] = useState(null)

  const getDeviceIdentifier = () => {
    if (typeof device === 'string') return device
    if (device?.mac_address) return device.mac_address
    if (device?.device_id) return device.device_id
    if (device?.display_name) return device.display_name
    return null
  }

  const deviceIdentifier = getDeviceIdentifier()
  const deviceName = typeof device === 'string' ? device : device?.display_name || device?.device_id || device?.mac_address || 'Unknown'

  const getIsOffline = () => {
    if (!device) return true
    if (typeof device === 'string') return true

    if (device.status === 'offline') return true

    if (device.last_seen) {
      try {
        const lastSeenDate = new Date(device.last_seen)
        if (!isNaN(lastSeenDate.getTime())) {
          const now = new Date()
          const minutesAgo = (now.getTime() - lastSeenDate.getTime()) / (1000 * 60)
          if (minutesAgo > 5) {
            return true
          }
        }
      } catch (error) {
        // If parsing fails, fall back to status
      }
    }

    return device.status !== 'online'
  }

  const isOffline = getIsOffline()

  useEffect(() => {
    if (device?.current_readings?.co2 != null) {
      setCurrentCo2(Math.round(device.current_readings.co2))
    }
  }, [device])

  useEffect(() => {
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

            if (seriesData?.status === 'success' && Array.isArray(seriesData.series) && seriesData.series.length > 0) {
              let seriesToUse = seriesData.series
              if (bucket === 'raw' && seriesToUse.length > 200) {
                const step = Math.ceil(seriesToUse.length / 200)
                seriesToUse = seriesToUse.filter((_, index) => index % step === 0)
              }

              const chartData = buildMiniCo2ChartData(seriesToUse)
              if (hasValidChartData(chartData)) {
                setMiniChartData(chartData)
                chartLoaded = true
                break
              }
            }
          } catch (error) {
            continue
          }
        }

        if (!chartLoaded && device?.current_readings?.co2 != null) {
          setCurrentCo2(Math.round(device.current_readings.co2))
        }
      } catch (error) {
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
            color={isOffline ? 'offline' : 'success'}
          >
            {isOffline ? 'Offline' : 'Online'}
          </Badge>
        </div>
      </div>

      <div className="dashboard-box__body">
        {!isOffline && (
          <div className="dashboard-box__graph-container">
            {loadingMiniChart ? (
              <div className="dashboard-box__graph-loading">
                <ProgressBar indeterminate />
              </div>
            ) : miniChartData ? (
              <div className="dashboard-box__graph" style={{ height: '100px' }}>
                <Line data={miniChartData} options={getMiniChartOptions()} />
              </div>
            ) : currentCo2 !== null && currentCo2 !== undefined ? (
              <div className="dashboard-box__graph-placeholder">
                <div className="dashboard-box__graph-placeholder-value">{currentCo2}</div>
                <div className="dashboard-box__graph-placeholder-label">ppm</div>
              </div>
            ) : (
              <div className="dashboard-box__graph-empty">
                <span>No data</span>
              </div>
            )}
          </div>
        )}

        {!isOffline && (
          <div className="dashboard-box__current-value">
            <span className="dashboard-box__current-label">Current CO₂:</span>
            <span className="dashboard-box__current-number">
              {currentCo2 !== null && currentCo2 !== undefined
                ? `${currentCo2} ppm`
                : '--'}
            </span>
          </div>
        )}

        {isOffline && (
          <div className="dashboard-box__offline-message">
            <span>This device is offline</span>
          </div>
        )}
      </div>
    </Card>
  )
}

export default DashboardBox
