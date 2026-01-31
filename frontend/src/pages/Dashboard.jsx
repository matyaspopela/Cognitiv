import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { dataAPI } from '../services/api'
import Card from '../components/ui/Card'
import DashboardBox from '../components/dashboard/DashboardBox'
import BentoOverview from '../components/dashboard/BentoOverview'
import DeviceDetailView from '../components/dashboard/DeviceDetailView'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import './Dashboard.css'

const DashboardBoxGrid = ({ devices, onDeviceSelect, loading }) => {
  if (loading) {
    return (
      <Card className="dashboard-loading" elevation={2}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--md3-spacing-4)', padding: 'var(--md3-spacing-8)' }}>
          <LoadingSpinner size="large" />
          <p style={{ margin: 0, color: 'var(--md3-color-text-secondary)', fontSize: 'var(--md3-font-size-body-medium)' }}>
            Loading devices...
          </p>
        </div>
      </Card>
    )
  }

  if (!devices || devices.length === 0) {
    return (
      <Card className="dashboard-empty">
        <p>No devices available.</p>
      </Card>
    )
  }

  return (
    <div className="dashboard-box-grid">
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
    <div className="dashboard-page">
      {deviceId ? (
        <DeviceDetailView
          deviceId={deviceId}
          timeWindow={timeWindow}
          onTimeWindowChange={handleTimeWindowChange}
        />
      ) : (
        <>
          {error && (
            <div className="dashboard-error">
              <p>{error}</p>
            </div>
          )}

          <BentoOverview />

          <h2 className="text-xl font-semibold text-zinc-100 mt-12 mb-6 px-1">
            All Devices
          </h2>
          <DashboardBoxGrid
            devices={devices}
            onDeviceSelect={handleDeviceSelect}
            loading={loading}
          />
        </>
      )}
    </div>
  )
}

export default Dashboard
