import { useState, useEffect, useMemo } from 'react'
import { dataAPI } from '../../services/api'
import useDeviceHistory from '../../hooks/useDeviceHistory'
import TimePicker from '../ui/TimePicker'
import DataValue from '../ui/DataValue'
import Co2Graph from './Co2Graph'
import Card from '../ui/Card'

/** Derive a status label + colors from an average CO₂ value */
const getCO2Status = (co2) => {
  if (co2 == null) return { label: '--', color: '#78716C', bg: 'transparent', border: '#E7E5E4' }
  if (co2 < 800)  return { label: 'Good',     color: '#16A34A', bg: '#DCFCE7', border: '#16A34A' }
  if (co2 < 1200) return { label: 'Moderate', color: '#D97706', bg: '#FEF3C7', border: '#D97706' }
  if (co2 < 1800) return { label: 'Poor',     color: '#EA580C', bg: '#FFEDD5', border: '#EA580C' }
  return             { label: 'Critical',  color: '#DC2626', bg: '#FEE2E2', border: '#DC2626' }
}

/** % of series buckets with CO₂ above 2000 ppm */
const computeRiskPercent = (series) => {
  if (!series || series.length === 0) return null
  const risky = series.filter(p => {
    const val = p.co2?.avg ?? p.co2
    return val != null && val > 2000
  }).length
  return Math.round((risky / series.length) * 100)
}

/**
 * DeviceDetailView — regular user device detail, clean single-page layout.
 */
const DeviceDetailView = ({ deviceId, timeWindow, onTimeWindowChange }) => {
  const [device, setDevice] = useState(null)
  const [loading, setLoading] = useState(true)

  // Fetch current device info (for CO₂ and Temperature live values)
  useEffect(() => {
    const fetchDeviceData = async () => {
      try {
        setLoading(true)
        const response = await dataAPI.getDevices()
        if (response.data && response.data.devices) {
          const found = response.data.devices.find(
            (d) => d.device_id === deviceId || d.mac_address === deviceId || d.display_name === deviceId
          )
          if (found) setDevice(found)
        }
      } catch (error) {
        console.error('Error fetching device for detail view:', error)
      } finally {
        setLoading(false)
      }
    }

    if (deviceId) fetchDeviceData()
  }, [deviceId])

  // Fetch history for the selected timeWindow — drives Status and At Risk cards
  const { series, summary } = useDeviceHistory(deviceId, timeWindow)

  const readings = device?.current_readings || {}

  // Status derived from period average CO₂ (falls back to live reading while summary loads)
  const avgCo2 = summary?.co2?.avg ?? readings.co2 ?? null
  const status = getCO2Status(avgCo2)

  const riskPct = useMemo(() => computeRiskPercent(series), [series])

  return (
    <div className="flex flex-col gap-8">
      {/* Time range picker */}
      <div className="flex justify-end items-center">
        <TimePicker
          value={timeWindow}
          onChange={onTimeWindowChange}
          compact
        />
      </div>

      {/* Metric cards — 2-column on mobile, 4-column on md+ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* CO₂ Level */}
        <Card className="p-3 sm:p-4 flex flex-col justify-center min-h-[88px]">
          <DataValue
            label="CO2 Level"
            value={readings.co2 != null ? Math.round(readings.co2) : '--'}
            unit="ppm"
          />
        </Card>

        {/* Temperature */}
        <Card className="p-3 sm:p-4 flex flex-col justify-center min-h-[88px]">
          <DataValue
            label="Temperature"
            value={readings.temperature != null ? readings.temperature.toFixed(1) : '--'}
            unit="°C"
          />
        </Card>

        {/* Air Quality Status */}
        <Card
          className="p-3 sm:p-4 flex flex-col justify-center min-h-[88px]"
          style={{ borderLeft: `3px solid ${status.border}` }}
        >
          <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1">
            Status
          </span>
          <span
            className="text-2xl font-bold leading-none"
            style={{ color: status.color }}
          >
            {status.label}
          </span>
          <span className="text-[10px] text-stone-400 mt-1">air quality</span>
        </Card>

        {/* Today at Risk */}
        <Card className="p-3 sm:p-4 flex flex-col justify-center min-h-[88px]">
          <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1">
            At Risk
          </span>
          <span className="text-2xl font-bold text-stone-900 leading-none">
            {riskPct != null ? `${riskPct}%` : '--'}
          </span>
          <span className="text-[10px] text-stone-400 mt-1">above 2000 ppm</span>
        </Card>
      </div>

      {/* Primary chart */}
      <Card className="p-3 sm:p-6 h-[300px] sm:h-[420px]">
        <Co2Graph deviceId={deviceId} timeWindow={timeWindow} />
      </Card>
    </div>
  )
}

export default DeviceDetailView
