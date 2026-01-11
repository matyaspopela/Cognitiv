import { useState, useEffect } from 'react'
import { Pencil } from 'lucide-react'
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
import Button from '../ui/Button'
import ProgressBar from '../ui/ProgressBar'
import OfflineInfoTooltip from './OfflineInfoTooltip'
import './BoardCard.css'

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler
)

/**
 * BoardCard Component
 * Compact board/device card with mini CO2 graph and status.
 */
const BoardCard = ({ device, onDetailsClick, onRenameClick, selected = false }) => {
  const [miniChartData, setMiniChartData] = useState(null)
  const [loadingMiniChart, setLoadingMiniChart] = useState(false)
  const [currentCo2, setCurrentCo2] = useState(null)

  useEffect(() => {
    const loadMiniChartData = async () => {
      if (!device?.device_id) return
      if (device?.status !== 'online') {
        setMiniChartData(null)
        setCurrentCo2(null)
        setLoadingMiniChart(false)
        return
      }

      if (device.current_readings?.co2) {
        setCurrentCo2(device.current_readings.co2)
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
            const response = await historyAPI.getSeries(startIso, endIso, bucket, device.device_id)
            
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
            if (error?.response?.status >= 400) {
              continue
            }
            continue
          }
        }

        if (!chartLoaded && device.current_readings?.co2) {
          setCurrentCo2(device.current_readings.co2)
        }
      } catch (error) {
        if (device.current_readings?.co2) {
          setCurrentCo2(device.current_readings.co2)
        }
      } finally {
        setLoadingMiniChart(false)
      }
    }

    loadMiniChartData()
  }, [device])

  const getIsOffline = () => {
    if (!device) return true
    
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
        console.warn('Failed to parse last_seen timestamp:', device.last_seen, error)
      }
    }
    
    return device.status !== 'online'
  }
  
  const isOffline = getIsOffline()

  const formatVoltage = (voltage) => {
    if (voltage == null) return 'N/A'
    
    const voltageNum = typeof voltage === 'string' 
      ? parseFloat(voltage) 
      : typeof voltage === 'number' 
        ? voltage 
        : null
    
    if (voltageNum != null && !isNaN(voltageNum) && isFinite(voltageNum)) {
      return `${voltageNum.toFixed(2)}V`
    }
    return 'N/A'
  }

  const voltageDisplay = formatVoltage(device?.current_readings?.voltage)

  const handleExportCSV = async (e) => {
    e.stopPropagation()
    
    if (!device?.device_id) {
      console.error('Cannot export: missing device_id')
      return
    }

    try {
      const now = new Date()
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      const startIso = thirtyDaysAgo.toISOString()
      const endIso = now.toISOString()

      const response = await historyAPI.exportCSV(startIso, endIso, device.device_id)
      
      const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      
      const deviceNameSafe = (device.display_name || device.device_id || 'device').replace(/[^a-z0-9]/gi, '_').toLowerCase()
      const dateStr = now.toISOString().split('T')[0]
      link.download = `cognitiv_${deviceNameSafe}_${dateStr}.csv`
      
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error exporting CSV:', error)
      alert('Failed to export CSV. Please try again later.')
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
              title="Rename device"
            >
              <Pencil strokeWidth={1.5} size={16} />
            </Button>
          )}
          <Button
            variant="outlined"
            size="small"
            onClick={handleExportCSV}
            className="board-card__export-btn"
            title="Export data to CSV (last 30 days)"
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
              color={isOffline ? 'offline' : 'success'}
            >
              {isOffline ? 'Offline' : 'Online'}
            </Badge>
          </OfflineInfoTooltip>
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
        {!isOffline && (
          <div className="board-card__graph-container">
            {loadingMiniChart ? (
              <div className="board-card__graph-loading">
                <ProgressBar indeterminate />
              </div>
            ) : miniChartData ? (
              <div className="board-card__graph" style={{ height: '100px' }}>
                <Line data={miniChartData} options={getMiniChartOptions()} />
              </div>
            ) : currentCo2 !== null && currentCo2 !== undefined ? (
              <div className="board-card__graph-placeholder">
                <div className="board-card__graph-placeholder-value">{currentCo2}</div>
                <div className="board-card__graph-placeholder-label">ppm</div>
              </div>
            ) : (
              <div className="board-card__graph-empty">
                <span>No data</span>
              </div>
            )}
          </div>
        )}

        {!isOffline && (
          <div className="board-card__current-value">
            <span className="board-card__current-label">Current CO₂:</span>
            <span className="board-card__current-number">
              {currentCo2 !== null && currentCo2 !== undefined
                ? `${currentCo2} ppm`
                : device?.current_readings?.co2
                  ? `${device.current_readings.co2} ppm`
                  : '--'}
            </span>
          </div>
        )}

        {isOffline && (
          <div className="board-card__offline-message">
            <span>This device is offline</span>
          </div>
        )}
      </div>

    </Card>
  )
}

export default BoardCard
