import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { dataAPI } from '../../services/api'
import MinimalTimeSelector from './MinimalTimeSelector'
import KeyMetricsGrid from './KeyMetricsGrid'
import AQIGraph from './AQIGraph'
import Co2Graph from './Co2Graph'

import './DeviceDetailView.css'

/**
 * DeviceDetailView Component
 */
const DeviceDetailView = ({ deviceId, timeWindow, onTimeWindowChange }) => {
  const [deviceName, setDeviceName] = useState(deviceId)

  useEffect(() => {
    const fetchDeviceName = async () => {
      try {
        const response = await dataAPI.getDevices()
        if (response.data && response.data.devices) {
          const device = response.data.devices.find(
            (d) => d.device_id === deviceId ||
              d.mac_address === deviceId ||
              d.display_name === deviceId
          )
          if (device && device.display_name) {
            setDeviceName(device.display_name)
          } else if (device && device.device_id) {
            setDeviceName(device.device_id)
          }
        }
      } catch (error) {
        console.error('Error fetching device name:', error)
      }
    }

    if (deviceId) {
      fetchDeviceName()
    }
  }, [deviceId])

  return (
    <div className="device-detail-view">
      <div className="device-detail-view__header">
        <div className="device-detail-view__header-top">
          <Link to="/dashboard" className="device-detail-view__back-link">
            ← Back
          </Link>
          <div className="device-detail-view__controls">
            <MinimalTimeSelector value={timeWindow} onChange={onTimeWindowChange} />
          </div>
        </div>
        <h2 className="device-detail-view__title">{deviceName || deviceId}</h2>
      </div>

      <div className="device-detail-view__content">
        <KeyMetricsGrid deviceId={deviceId} timeWindow={timeWindow} />

        {/* Primary Trends - AQI Graph */}
        <div className="mb-6">
          <AQIGraph deviceId={deviceId} timeWindow={timeWindow} />
        </div>

        {/* Dev Verification - CO2 Graph */}
        <div className="mb-6">
          <Co2Graph deviceId={deviceId} timeWindow={timeWindow} />
        </div>

      </div>
    </div>
  )
}

export default DeviceDetailView