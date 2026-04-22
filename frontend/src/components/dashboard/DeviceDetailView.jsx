import { useState, useEffect, useMemo } from 'react'
import { dataAPI } from '../../services/api'
import TimePicker from '../ui/TimePicker'
import DataValue from '../ui/DataValue'
import Co2Graph from './Co2Graph'
import Card from '../ui/Card'

/**
 * DeviceDetailView Component - Laboratory Style
 * Provides high-density analytics for a single device.
 */
const DeviceDetailView = ({ deviceId, timeWindow, onTimeWindowChange }) => {
  const [device, setDevice] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchDeviceData = async () => {
      try {
        setLoading(true)
        const response = await dataAPI.getDevices()
        if (response.data && response.data.devices) {
          const found = response.data.devices.find(
            (d) => d.device_id === deviceId || d.mac_address === deviceId || d.display_name === deviceId
          )
          if (found) {
            setDevice(found)
          }
        }
      } catch (error) {
        console.error('Error fetching device for detail view:', error)
      } finally {
        setLoading(false)
      }
    }

    if (deviceId) {
      fetchDeviceData()
    }
  }, [deviceId])

  const readings = device?.current_readings || {}

  return (
    <div className="flex flex-col gap-8">
      {/* Action Bar */}
      <div className="flex justify-end items-center">
        <TimePicker 
          value={timeWindow} 
          onChange={onTimeWindowChange} 
          compact 
        />
      </div>

      {/* Metric Grid - High Density 4-column */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 flex flex-col justify-center min-h-[100px]">
          <DataValue 
            label="CO2 Level" 
            value={readings.co2 != null ? Math.round(readings.co2) : '--'} 
            unit="ppm" 
          />
        </Card>
        <Card className="p-4 flex flex-col justify-center min-h-[100px]">
          <DataValue 
            label="Temperature" 
            value={readings.temperature != null ? readings.temperature.toFixed(1) : '--'} 
            unit="°C" 
          />
        </Card>
        <Card className="p-4 flex flex-col justify-center min-h-[100px]">
          <DataValue 
            label="Humidity" 
            value={readings.humidity != null ? Math.round(readings.humidity) : '--'} 
            unit="%" 
          />
        </Card>
        <Card className="p-4 flex flex-col justify-center min-h-[100px]">
          <DataValue 
            label="Battery" 
            value={readings.voltage != null ? readings.voltage.toFixed(2) : '--'} 
            unit="V" 
          />
        </Card>
      </div>

      {/* Primary Analytics */}
      <Card className="p-6 h-[450px]">
        <Co2Graph deviceId={deviceId} timeWindow={timeWindow} />
      </Card>
      
      {/* Device metadata */}
      <Card className="p-4 bg-stone-50/50 border-stone-200">
        <div className="flex flex-col gap-2">
          <div className="flex justify-between text-[11px]">
            <span className="text-stone-500">Device ID</span>
            <span className="font-mono text-stone-900">{device?.device_id || deviceId}</span>
          </div>
          <div className="flex justify-between text-[11px]">
            <span className="text-stone-500">MAC Address</span>
            <span className="font-mono text-stone-900">{device?.mac_address || 'Unknown'}</span>
          </div>
          <div className="flex justify-between text-[11px]">
            <span className="text-stone-500">Last Seen</span>
            <span className="text-stone-900">{device?.last_seen || 'Never'}</span>
          </div>
        </div>
      </Card>
    </div>
  )
}

export default DeviceDetailView
