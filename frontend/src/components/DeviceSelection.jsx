import Card from './ui/Card'
import './DeviceSelection.css'

const DeviceSelection = ({ devices, selectedDevice, onDeviceSelect }) => {

  const getDeviceName = (device) => {
    if (typeof device === 'string') {
      return device
    }
    return device?.display_name || device?.device_id || device?.mac_address || 'Unknown Device'
  }

  const getDeviceId = (device) => {
    if (typeof device === 'string') {
      return device
    }
    // Prefer mac_address for API calls, fall back to device_id
    return device?.mac_address || device?.device_id || device?.display_name || null
  }

  // Determine if device is offline based on status and last_seen timestamp
  const getIsOffline = (device) => {
    if (!device || typeof device === 'string') return true
    
    // If status is explicitly 'offline', treat as offline
    if (device.status === 'offline') return true
    
    // If status is 'online', also check last_seen timestamp as safety measure
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

  const handleDeviceClick = (device) => {
    const deviceId = getDeviceId(device)
    if (onDeviceSelect) {
      onDeviceSelect(deviceId)
    }
  }

  if (!devices || devices.length === 0) {
    return null
  }

  return (
    <section className="device-selection">
      <Card className="device-selection__header" elevation={1}>
        <h2 className="device-selection__title">Device Selection</h2>
        <p className="device-selection__description">
          Select a device to view its statistics. Clicking on a card updates the URL for easy sharing.
        </p>
      </Card>

      <div className="device-selection__grid">
        {/* All Devices option */}
        <Card
          className={`device-selection__card ${!selectedDevice ? 'device-selection__card--selected' : ''}`}
          elevation={!selectedDevice ? 3 : 2}
          onClick={() => handleDeviceClick(null)}
        >
          <div className="device-selection__card-content">
            <h3 className="device-selection__card-name">All devices</h3>
            <div className="device-selection__card-co2">
              <span className="device-selection__card-value">—</span>
            </div>
          </div>
          {!selectedDevice && (
            <div className="device-selection__card-indicator">
              <span className="device-selection__card-indicator-dot"></span>
            </div>
          )}
        </Card>

        {devices.map((device) => {
          const deviceId = getDeviceId(device)
          const deviceName = getDeviceName(device)
          const isSelected = selectedDevice === deviceId
          const isOffline = getIsOffline(device)
          const co2Value = device?.current_readings?.co2

          return (
            <Card
              key={deviceId || deviceName}
              className={`device-selection__card ${isSelected ? 'device-selection__card--selected' : ''} ${isOffline ? 'device-selection__card--offline' : ''}`}
              elevation={isSelected ? 3 : 2}
              onClick={() => handleDeviceClick(device)}
            >
              <div className="device-selection__card-content">
                <h3 className="device-selection__card-name">{deviceName}</h3>
                <div className="device-selection__card-co2">
                  {!isOffline && co2Value != null ? (
                    <span className="device-selection__card-value">{Math.round(co2Value)} ppm</span>
                  ) : (
                    <span className="device-selection__card-offline">This device is offline</span>
                  )}
                </div>
              </div>
              {isSelected && (
                <div className="device-selection__card-indicator">
                  <span className="device-selection__card-indicator-dot"></span>
                </div>
              )}
            </Card>
          )
        })}
      </div>
    </section>
  )
}

export default DeviceSelection

