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
import { getCO2Status } from '../../utils/co2'

import Card from '../ui/Card'
import StatusBadge from '../ui/StatusBadge'
import DataValue from '../ui/DataValue'
import LoadingSpinner from '../ui/LoadingSpinner'

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler
)

/**
 * DashboardBox Component - High-density device overview card
 * Bleached Stone - Laboratory Style
 */
const DashboardBox = ({ device, onClick }) => {
  const [miniChartData, setMiniChartData] = useState(null)
  const [loadingMiniChart, setLoadingMiniChart] = useState(false)
  const [currentReadings, setCurrentReadings] = useState({
    co2: null,
    temp: null,
    humidity: null,
    battery: null
  })

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
          if (minutesAgo > 5) return true
        }
      } catch (error) {}
    }
    return device.status !== 'online'
  }

  const isOffline = getIsOffline()

  useEffect(() => {
    if (device?.current_readings) {
      setCurrentReadings({
        co2: device.current_readings.co2 != null ? Math.round(device.current_readings.co2) : null,
        temp: device.current_readings.temperature != null ? device.current_readings.temperature.toFixed(1) : null,
        humidity: device.current_readings.humidity != null ? Math.round(device.current_readings.humidity) : null,
        battery: device.current_readings.battery != null ? device.current_readings.battery.toFixed(2) : null
      })
    }
  }, [device])

  useEffect(() => {
    const loadMiniChartData = async () => {
      if (!deviceIdentifier || isOffline) {
        setMiniChartData(null)
        return
      }

      try {
        setLoadingMiniChart(true)
        const now = new Date()
        const oneHourAgo = new Date(now.getTime() - (60 * 60 * 1000))
        const response = await historyAPI.getSeries(
          oneHourAgo.toISOString(), 
          now.toISOString(), 
          '10min', 
          deviceIdentifier
        )

        const seriesData = response?.data || response
        if (seriesData?.status === 'success' && Array.isArray(seriesData.series) && seriesData.series.length > 0) {
          const chartData = buildMiniCo2ChartData(seriesData.series)
          if (hasValidChartData(chartData)) {
            setMiniChartData(chartData)
          }
        }
      } catch (error) {
        console.error('Failed to load mini chart:', error)
      } finally {
        setLoadingMiniChart(false)
      }
    }

    loadMiniChartData()
  }, [deviceIdentifier, isOffline])

  const handleClick = () => {
    if (onClick && deviceIdentifier) {
      onClick(deviceIdentifier)
    }
  }

  const co2Status = isOffline ? 'unknown' : getCO2Status(currentReadings.co2 || 0)

  return (
    <Card
      className="w-full p-4 flex flex-col gap-3 group cursor-pointer"
      onClick={handleClick}
    >
      {/* Header row: name + status badge */}
      <div className="flex justify-between items-start gap-2">
        <h3 className="text-sm font-bold text-text-primary truncate leading-snug" title={deviceName}>
          {deviceName}
        </h3>
        <StatusBadge status={isOffline ? 'offline' : co2Status}>
          {isOffline ? 'Offline' : null}
        </StatusBadge>
      </div>

      {/* CO₂ reading */}
      <DataValue
        value={isOffline ? '--' : (currentReadings.co2 || '--')}
        unit="ppm"
        label="CO₂"
      />

      {/* Mini trend chart */}
      <div className="h-8 w-full relative">
        {loadingMiniChart ? (
          <div className="absolute inset-0 flex items-center justify-center opacity-30">
            <LoadingSpinner size="small" />
          </div>
        ) : miniChartData && !isOffline ? (
          <Line data={miniChartData} options={getMiniChartOptions()} />
        ) : (
          <div className="h-full w-full border-b border-stone-100 opacity-20" />
        )}
      </div>

      {/* Secondary readings */}
      <div className="flex items-center gap-3 text-[11px] font-medium text-text-muted tabular-nums">
        <span className="opacity-50 uppercase text-[9px] tracking-wider">Temp</span>
        <span className="text-text-primary">{currentReadings.temp || '--'}°C</span>
        <span className="opacity-50 uppercase text-[9px] tracking-wider">Hum</span>
        <span className="text-text-primary">{currentReadings.humidity || '--'}%</span>
      </div>
    </Card>
  )
}

export default DashboardBox
