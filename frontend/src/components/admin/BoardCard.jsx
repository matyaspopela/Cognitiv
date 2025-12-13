import { useState, useEffect } from 'react'
import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  TimeScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js'
import 'chartjs-adapter-date-fns'
import { historyAPI } from '../../services/api'
import { buildMiniCo2Chart, miniChartOptions } from '../../utils/charts'

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  TimeScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
)
import Card from '../ui/Card'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import ProgressBar from '../ui/ProgressBar'
import OfflineInfoTooltip from './OfflineInfoTooltip'
import './BoardCard.css'

/**
 * BoardCard Component
 * Compact board/device card with mini CO2 graph and status.
 * Entire card is clickable to show details.
 */
const BoardCard = ({ device, onDetailsClick, onRenameClick, selected = false }) => {
  const [miniChartData, setMiniChartData] = useState(null)
  const [loadingMiniChart, setLoadingMiniChart] = useState(false)
  const [currentCo2, setCurrentCo2] = useState(null)

  useEffect(() => {
    // Load last 1 hour of CO2 data for mini graph
    // Only load for online devices
    const loadMiniChartData = async () => {
      if (!device?.device_id) return
      if (device?.status !== 'online') {
        // Don't load graph data for offline devices
        setMiniChartData(null)
        setCurrentCo2(null)
        setLoadingMiniChart(false)
        return
      }

      // Set current CO2 from device readings immediately as fallback
      if (device.current_readings?.co2) {
        setCurrentCo2(device.current_readings.co2)
      }

      try {
        setLoadingMiniChart(true)
        const now = new Date()
        // Exactly 1 hour ago (3600000 milliseconds = 1 hour)
        const oneHourAgo = new Date(now.getTime() - (60 * 60 * 1000))
        const startIso = oneHourAgo.toISOString()
        const endIso = now.toISOString()

        // Try multiple bucket sizes and handle errors gracefully
        const bucketOptions = ['10min', 'hour', 'raw']
        let chartLoaded = false

        for (const bucket of bucketOptions) {
          try {
            const response = await historyAPI.getSeries(startIso, endIso, bucket, device.device_id)
            
            // Check for HTTP error status in response
            if (response?.response?.status >= 400 || response?.status >= 400) {
              continue // Try next bucket
            }

            const seriesData = response?.data || response

            // Check if response indicates an error
            if (seriesData?.status === 'error' || !seriesData) {
              continue // Try next bucket
            }

            if (seriesData?.status === 'success' && seriesData.series?.length > 0) {
              // Sample data if too many points (for raw bucket)
              let seriesToUse = seriesData.series
              if (bucket === 'raw' && seriesToUse.length > 200) {
                const step = Math.ceil(seriesToUse.length / 200)
                seriesToUse = seriesToUse.filter((_, index) => index % step === 0)
              }

              const chartData = buildMiniCo2Chart(seriesToUse, bucket)
              if (chartData.datasets?.[0]?.data?.length > 0) {
                setMiniChartData(chartData)
                chartLoaded = true
                // Don't update currentCo2 from chart data - use device.current_readings.co2 instead
                // The chart shows historical/averaged data, not the current reading
                break // Success, stop trying other buckets
              }
            }
          } catch (error) {
            // Check for axios error response
            if (error?.response?.status >= 400) {
              // HTTP error - silently continue to next bucket
              continue
            }
            // For other errors, also continue silently
            continue
          }
        }

        // If no chart data loaded, at least we have current CO2 from device readings
        if (!chartLoaded && device.current_readings?.co2) {
          setCurrentCo2(device.current_readings.co2)
        }
      } catch (error) {
        // Final fallback - use current reading
        if (device.current_readings?.co2) {
          setCurrentCo2(device.current_readings.co2)
        }
      } finally {
        setLoadingMiniChart(false)
      }
    }

    loadMiniChartData()
  }, [device])

  // Determine if device is offline based on status and last_seen timestamp
  // Device is offline if:
  // 1. Status is explicitly 'offline', OR
  // 2. last_seen timestamp is more than 5 minutes ago
  const getIsOffline = () => {
    if (!device) return true
    
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
        console.warn('Failed to parse last_seen timestamp:', device.last_seen, error)
      }
    }
    
    // Default to checking status
    return device.status !== 'online'
  }
  
  const isOffline = getIsOffline()

  // Format voltage for display - safely handle different data types
  // Returns formatted voltage string or "N/A" if missing/invalid
  const formatVoltage = (voltage) => {
    if (voltage == null) return 'N/A'
    
    // Handle string, number, or float
    const voltageNum = typeof voltage === 'string' 
      ? parseFloat(voltage) 
      : typeof voltage === 'number' 
        ? voltage 
        : null
    
    // Validate and format to 2 decimal places
    if (voltageNum != null && !isNaN(voltageNum) && isFinite(voltageNum)) {
      return `${voltageNum.toFixed(2)}V`
    }
    return 'N/A'
  }

  const voltageDisplay = formatVoltage(device?.current_readings?.voltage)

  const handleExportCSV = async (e) => {
    e.stopPropagation() // Prevent card click
    
    if (!device?.device_id) {
      console.error('Cannot export: missing device_id')
      return
    }

    try {
      // Export last 30 days of data
      const now = new Date()
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      const startIso = thirtyDaysAgo.toISOString()
      const endIso = now.toISOString()

      const response = await historyAPI.exportCSV(startIso, endIso, device.device_id)
      
      // Create blob and download
      const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      
      // Generate filename with device name
      const deviceNameSafe = (device.display_name || device.device_id || 'device').replace(/[^a-z0-9]/gi, '_').toLowerCase()
      const dateStr = now.toISOString().split('T')[0]
      link.download = `cognitiv_${deviceNameSafe}_${dateStr}.csv`
      
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error exporting CSV:', error)
      alert('Nepodařilo se exportovat CSV. Zkuste to prosím později.')
    }
  }

  return (
    <Card
      className={`board-card ${selected ? 'board-card--selected' : ''}`}
      elevation={selected ? 3 : 1}
      onClick={() => onDetailsClick?.(device?.device_id)}
    >
      <div className="board-card__header">
        <h3 className="board-card__name">{device?.display_name || device?.device_id || 'Unknown'}</h3>
        <div className="board-card__header-actions">
          {device?.mac_address && onRenameClick && (
            <Button
              variant="outlined"
              size="small"
              onClick={(e) => {
                e.stopPropagation()
                onRenameClick(device)
              }}
              className="board-card__rename-btn"
              title="Přejmenovat zařízení"
            >
              ✏️
            </Button>
          )}
          <Button
            variant="outlined"
            size="small"
            onClick={handleExportCSV}
            className="board-card__export-btn"
            title="Exportovat data do CSV (posledních 30 dní)"
          >
            📥
          </Button>
          <OfflineInfoTooltip
            lastSeen={device?.last_seen}
            totalDataPoints={device?.total_data_points}
            isOffline={isOffline}
          >
            <Badge
              variant="standard"
              color={device?.status === 'online' ? 'success' : 'error'}
            >
              {device?.status === 'online' ? 'Online' : 'Offline'}
            </Badge>
          </OfflineInfoTooltip>
          {/* Voltage badge - show for all online devices (N/A if voltage data missing) */}
          {!isOffline && (
            <Badge
              variant="standard"
              color={voltageDisplay === 'N/A' ? 'secondary' : 'info'}
              title="Battery/Board Voltage"
            >
              {voltageDisplay}
            </Badge>
          )}
        </div>
      </div>

      <div className="board-card__body">
        {/* Mini CO2 Graph - Only show for online devices */}
        {!isOffline && (
          <div className="board-card__graph-container">
            {loadingMiniChart ? (
              <div className="board-card__graph-loading">
                <ProgressBar indeterminate />
              </div>
            ) : miniChartData && miniChartData.datasets?.[0]?.data?.length > 0 ? (
              <div className="board-card__graph">
                <Line data={miniChartData} options={miniChartOptions} />
              </div>
            ) : currentCo2 !== null && currentCo2 !== undefined ? (
              // Show a simple placeholder with current value if no graph data
              <div className="board-card__graph-placeholder">
                <div className="board-card__graph-placeholder-value">{currentCo2}</div>
                <div className="board-card__graph-placeholder-label">ppm</div>
              </div>
            ) : (
              <div className="board-card__graph-empty">
                <span>Žádná data</span>
              </div>
            )}
          </div>
        )}

        {/* Current CO2 Value - Only show for online devices */}
        {!isOffline && (
          <div className="board-card__current-value">
            <span className="board-card__current-label">Aktuální CO₂:</span>
            <span className="board-card__current-number">
              {currentCo2 !== null && currentCo2 !== undefined
                ? `${currentCo2} ppm`
                : device?.current_readings?.co2
                  ? `${device.current_readings.co2} ppm`
                  : '--'}
            </span>
          </div>
        )}

        {/* Offline message */}
        {isOffline && (
          <div className="board-card__offline-message">
            <span>Toto zařízení je offline</span>
          </div>
        )}
      </div>

    </Card>
  )
}

export default BoardCard

