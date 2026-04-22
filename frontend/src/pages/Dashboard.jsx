import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { dataAPI } from '../services/api'
import Card from '../components/ui/Card'
import DashboardBox from '../components/dashboard/DashboardBox'
import DeviceDetailView from '../components/dashboard/DeviceDetailView'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import PageHeader from '../components/layout/PageHeader'

const DashboardBoxGrid = ({ devices, onDeviceSelect, loading }) => {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 w-full">
        <LoadingSpinner size="large" />
        <p className="mt-4 text-text-muted text-sm font-medium">
          Loading devices...
        </p>
      </div>
    )
  }

  if (!devices || devices.length === 0) {
    return (
      <Card className="w-full py-12 flex flex-col items-center justify-center border-dashed">
        <p className="text-text-muted">No devices available.</p>
      </Card>
    )
  }

  return (
    <div className="flex flex-wrap gap-4">
      {devices.map((device) => {
        const deviceKey = typeof device === 'string'
          ? device
          : device?.mac_address || device?.device_id || device?.display_name || 'unknown'
        return (
          <DashboardBox
            key={deviceKey}
            device={device}
            onClick={onDeviceSelect}
          />
        )
      })}
    </div>
  )
}

const Dashboard = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const [devices, setDevices] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Parse URL parameters for device and time window
  const params = new URLSearchParams(location.search)
  const deviceId = params.get('device')
  const timeWindow = params.get('window') || '24h'

  // Load devices
  useEffect(() => {
    const loadDevices = async () => {
      try {
        setLoading(true)
        const response = await dataAPI.getDevices()
        if (response.data && response.data.devices) {
          setDevices(response.data.devices)
        } else {
          setError('Failed to load devices')
        }
      } catch (err) {
        console.error('Error loading devices:', err)
        setError('Error loading devices')
      } finally {
        setLoading(false)
      }
    }

    loadDevices()
  }, [])

  // URL update handlers
  const handleDeviceSelect = (selectedDeviceId) => {
    const params = new URLSearchParams()
    params.set('device', selectedDeviceId)
    params.set('window', timeWindow)
    navigate(`/dashboard?${params.toString()}`)
  }

  const handleTimeWindowChange = (newWindow) => {
    const params = new URLSearchParams(location.search)
    params.set('window', newWindow)
    if (deviceId) {
      params.set('device', deviceId)
    }
    navigate(`/dashboard?${params.toString()}`)
  }

  return (
    <div className="flex flex-col min-h-full">
      <PageHeader />
      {deviceId ? (
        <div className="p-6 pt-0">
          <DeviceDetailView
            deviceId={deviceId}
            timeWindow={timeWindow}
            onTimeWindowChange={handleTimeWindowChange}
          />
        </div>
      ) : (
        <>
          
          <div className="p-6">
            {error && (
              <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-lg border border-red-100 text-sm font-medium">
                {error}
              </div>
            )}

            <DashboardBoxGrid
              devices={devices}
              onDeviceSelect={handleDeviceSelect}
              loading={loading}
            />
          </div>
        </>
      )}
    </div>
  )
}

export default Dashboard
