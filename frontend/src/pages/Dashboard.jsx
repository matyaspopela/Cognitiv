import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { dataAPI } from '../services/api'
import Card from '../components/ui/Card'
import DashboardBox from '../components/dashboard/DashboardBox'
import DashboardOverview from '../components/dashboard/DashboardOverview'
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
            Načítám zařízení...
          </p>
        </div>
      </Card>
    )
  }

  if (!devices || devices.length === 0) {
    return (
      <Card className="dashboard-empty">
        <p>Žádná zařízení nejsou k dispozici.</p>
      </Card>
    )
  }

  return (
    <div className="dashboard-box-grid">
      {devices.map((device) => {
        // Use mac_address as key (preferred) or device_id or display_name
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

  // Read query parameters
  const searchParams = new URLSearchParams(location.search)
  const deviceId = searchParams.get('device')
  // Default to '1h' if no window param exists (first load)
  // Otherwise use the provided window or fallback to '24h' for backward compatibility
  const timeWindow = searchParams.get('window') || '1h'

  // State
  const [devices, setDevices] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Load devices list
  useEffect(() => {
    const loadDevices = async () => {
      try {
        setLoading(true)
        setError(null)
        const response = await dataAPI.getDevices()
        if (response.data && Array.isArray(response.data)) {
          setDevices(response.data)
        } else if (response.data?.devices) {
          setDevices(response.data.devices)
        } else {
          setDevices([])
        }
      } catch (err) {
        console.error('Error loading devices:', err)
        setError('Nepodařilo se načíst seznam zařízení')
        setDevices([])
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
    params.set('window', timeWindow) // preserve existing window
    navigate(`/dashboard?${params.toString()}`)
  }

  const handleTimeWindowChange = (newWindow) => {
    const params = new URLSearchParams(location.search)
    params.set('window', newWindow)
    if (deviceId) {
      params.set('device', deviceId) // preserve device
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
          <div className="dashboard-page__header">
            <h1>Přehled zařízení</h1>
            <p>Vyberte zařízení pro zobrazení detailních informací</p>
          </div>
          {error && (
            <Card className="dashboard-error">
              <p>{error}</p>
            </Card>
          )}
          <DashboardOverview />
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

