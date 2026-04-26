import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { dataAPI } from '../../services/api'
import useDeviceHistory from '../../hooks/useDeviceHistory'
import TimePicker from '../ui/TimePicker'
import DataValue from '../ui/DataValue'
import Co2Graph from './Co2Graph'
import AirQualityGauge from './AirQualityGauge'
import Card from '../ui/Card'

const getCO2Status = (co2) => {
  if (co2 == null) return { label: '—',        color: '#78716C' }
  if (co2 < 800)   return { label: 'Good',     color: '#16A34A' }
  if (co2 < 1200)  return { label: 'Moderate', color: '#D97706' }
  if (co2 < 1800)  return { label: 'Poor',     color: '#EA580C' }
  return              { label: 'Critical',  color: '#DC2626' }
}

const DeviceDetailView = ({ deviceId, timeWindow, onTimeWindowChange }) => {
  const [device, setDevice] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (!deviceId) return
    dataAPI.getDevices().then((res) => {
      const found = res.data?.devices?.find(
        (d) => d.device_id === deviceId || d.mac_address === deviceId || d.display_name === deviceId
      )
      if (found) setDevice(found)
    }).catch(() => {})
  }, [deviceId])

  const { summary } = useDeviceHistory(deviceId, timeWindow)

  const readings = device?.current_readings ?? {}
  const online = device?.status === 'online'
  const avgCo2 = summary?.co2?.avg ?? readings.co2 ?? null
  const status = getCO2Status(avgCo2)

  return (
    <div className="flex flex-col gap-3">
      {/* ── Back nav + device name ── */}
      <div className="flex items-center gap-2 -ml-1">
        <button
          onClick={() => navigate('/dashboard')}
          className="p-1.5 rounded-md hover:bg-stone-100 text-stone-400 hover:text-stone-700 transition-colors"
          aria-label="Back to devices"
        >
          <ChevronLeft size={18} />
        </button>
        <span className="text-sm font-bold text-stone-900 truncate">
          {device?.display_name ?? '—'}
        </span>
        <span className={`text-xs font-medium ml-1 ${online ? 'text-green-600' : 'text-stone-400'}`}>
          ● {online ? 'Online' : 'Offline'}
        </span>
      </div>

      {/* ── Bento 2×2 grid ── */}
      <div className="grid grid-cols-2 gap-3">
        {/* Top-left: CO₂ */}
        <Card className="p-4 flex flex-col justify-center min-h-[80px]">
          <DataValue
            label="CO₂"
            value={readings.co2 != null ? Math.round(readings.co2) : '—'}
            unit="ppm"
          />
        </Card>

        {/* Top-right: temperature */}
        <Card className="p-4 flex flex-col justify-center min-h-[80px]">
          <DataValue
            label="Temperature"
            value={readings.temperature != null ? readings.temperature.toFixed(1) : '—'}
            unit="°C"
          />
        </Card>

        {/* Bottom-left: humidity */}
        <Card className="p-4 flex flex-col justify-center min-h-[80px]">
          <DataValue
            label="Humidity"
            value={readings.humidity != null ? Math.round(readings.humidity) : '—'}
            unit="%"
          />
        </Card>

        {/* Bottom-right: placeholder for future stat or leave asymmetric */}
        <Card className="p-4 flex flex-col justify-center min-h-[80px]">
          <DataValue
            label="Avg CO₂"
            value={avgCo2 != null ? Math.round(avgCo2) : '—'}
            unit="ppm"
          />
        </Card>
      </div>

      {/* ── Gauge + Graph ── */}
      <div className="flex flex-col md:flex-row md:items-center gap-6 md:gap-8 mt-6 md:mt-10">
        {/* Gauge — boxless hero, sits directly on background */}
        <div className="md:w-[44%] md:pl-4">
          <AirQualityGauge
            co2={avgCo2}
            status={status.label}
            statusColor={status.color}
          />
        </div>

        {/* CO₂ graph with inline time picker */}
        <Card className="p-4 flex-1 flex flex-col min-h-[300px] md:min-h-[360px]">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold uppercase tracking-widest text-stone-500">
              CO₂
            </span>
            <TimePicker value={timeWindow} onChange={onTimeWindowChange} compact />
          </div>
          <div className="flex-1 min-h-0">
            <Co2Graph deviceId={deviceId} timeWindow={timeWindow} showHeader={false} />
          </div>
        </Card>
      </div>
    </div>
  )
}

export default DeviceDetailView
