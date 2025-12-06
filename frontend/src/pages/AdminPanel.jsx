import { useState, useEffect } from 'react'
import { adminAPI } from '../services/api'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import ProgressBar from '../components/ui/ProgressBar'
import './AdminPanel.css'

const AdminPanel = () => {
  const [devices, setDevices] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedDevice, setSelectedDevice] = useState(null)
  const [deviceStats, setDeviceStats] = useState(null)
  const [loadingStats, setLoadingStats] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    loadDevices()
  }, [])

  const loadDevices = async () => {
    try {
      setLoading(true)
      setError('')
      const response = await adminAPI.getDevices()
      if (response.data.status === 'success') {
        setDevices(response.data.devices || [])
      } else {
        setError(response.data.message || 'Nepodařilo se načíst seznam zařízení')
      }
    } catch (error) {
      console.error('Error loading devices:', error)
      setError('Nepodařilo se načíst seznam zařízení')
    } finally {
      setLoading(false)
    }
  }

  const loadDeviceStats = async (deviceId) => {
    try {
      setLoadingStats(true)
      setError('')
      const response = await adminAPI.getDeviceStats(deviceId)
      if (response.data.status === 'success') {
        setDeviceStats(response.data.stats)
        setSelectedDevice(deviceId)
      } else {
        setError(response.data.message || 'Nepodařilo se načíst statistiky zařízení')
      }
    } catch (error) {
      console.error('Error loading device stats:', error)
      setError('Nepodařilo se načíst statistiky zařízení')
    } finally {
      setLoadingStats(false)
    }
  }

  return (
    <div className="admin-page">
      <div className="admin-page__container">
        <header className="admin-page__header">
          <Card className="admin-page__header-card" elevation={2}>
            <div className="admin-page__header-content">
              <div className="admin-page__header-text">
                <h1 className="admin-page__title">Administrační panel</h1>
                <p className="admin-page__subtitle">Správa a přehled všech zařízení v systému</p>
              </div>
              <Button variant="filled" size="medium" onClick={loadDevices} disabled={loading}>
                ⟳ Aktualizovat
              </Button>
            </div>
          </Card>
        </header>

        {error && (
          <Card className="admin-page__error-card" elevation={2}>
            <div className="admin-page__error">{error}</div>
          </Card>
        )}

        <div className="admin-page__content">
          <section className="admin-page__devices">
            <Card className="admin-page__devices-card" elevation={2}>
              <h2 className="admin-page__section-title">Seznam zařízení</h2>
              {loading ? (
                <div className="admin-page__loading">
                  <ProgressBar indeterminate />
                  <p>Načítám zařízení...</p>
                </div>
              ) : devices.length === 0 ? (
                <div className="admin-page__empty">Žádná zařízení nebyla nalezena.</div>
              ) : (
                <div className="admin-page__devices-grid">
                  {devices.map((device) => (
                    <Card
                      key={device.device_id}
                      className={`admin-page__device-card ${selectedDevice === device.device_id ? 'admin-page__device-card--selected' : ''}`}
                      elevation={selectedDevice === device.device_id ? 3 : 1}
                      onClick={() => loadDeviceStats(device.device_id)}
                    >
                      <div className="admin-page__device-header">
                        <h3 className="admin-page__device-name">{device.device_id}</h3>
                        <Badge
                          variant="standard"
                          color={device.status === 'online' ? 'success' : 'error'}
                        >
                          {device.status === 'online' ? 'Online' : 'Offline'}
                        </Badge>
                      </div>
                      <div className="admin-page__device-body">
                        <div className="admin-page__device-info">
                          <span className="admin-page__device-label">Celkem datových bodů:</span>
                          <span className="admin-page__device-value">{device.total_data_points.toLocaleString('cs-CZ')}</span>
                        </div>
                        <div className="admin-page__device-info">
                          <span className="admin-page__device-label">Naposledy viděno:</span>
                          <span className="admin-page__device-value">{device.last_seen || 'Nikdy'}</span>
                        </div>
                        {device.current_readings && (
                          <div className="admin-page__device-readings">
                            <div className="admin-page__reading">
                              <span>Teplota:</span>
                              <strong>{device.current_readings.temperature ?? '--'}°C</strong>
                            </div>
                            <div className="admin-page__reading">
                              <span>Vlhkost:</span>
                              <strong>{device.current_readings.humidity ?? '--'}%</strong>
                            </div>
                            <div className="admin-page__reading">
                              <span>CO₂:</span>
                              <strong>{device.current_readings.co2 ?? '--'} ppm</strong>
                            </div>
                          </div>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </Card>
          </section>

          {selectedDevice && (
            <section className="admin-page__details">
              <Card className="admin-page__details-card" elevation={2}>
                <h2 className="admin-page__section-title">Detail zařízení: {selectedDevice}</h2>
                {loadingStats ? (
                  <div className="admin-page__loading">
                    <ProgressBar indeterminate />
                    <p>Načítám statistiky...</p>
                  </div>
                ) : deviceStats ? (
                  <div className="admin-page__stats">
                    <div className="admin-page__stats-grid">
                      <Card className="admin-page__stat-card" elevation={1}>
                        <div className="admin-page__stat-label">Celkem datových bodů</div>
                        <div className="admin-page__stat-value">{deviceStats.total_data_points.toLocaleString('cs-CZ')}</div>
                      </Card>
                      <Card className="admin-page__stat-card" elevation={1}>
                        <div className="admin-page__stat-label">Stav</div>
                        <div className="admin-page__stat-value">
                          <Badge
                            variant="standard"
                            color={deviceStats.status === 'online' ? 'success' : 'error'}
                          >
                            {deviceStats.status === 'online' ? 'Online' : 'Offline'}
                          </Badge>
                        </div>
                      </Card>
                      <Card className="admin-page__stat-card" elevation={1}>
                        <div className="admin-page__stat-label">První záznam</div>
                        <div className="admin-page__stat-value-small">{deviceStats.first_seen || '--'}</div>
                      </Card>
                      <Card className="admin-page__stat-card" elevation={1}>
                        <div className="admin-page__stat-label">Poslední záznam</div>
                        <div className="admin-page__stat-value-small">{deviceStats.last_seen || '--'}</div>
                      </Card>
                    </div>

                    <div className="admin-page__stats-sections">
                      <Card className="admin-page__stats-section" elevation={1}>
                        <h3 className="admin-page__stats-section-title">Teplota</h3>
                        <div className="admin-page__stats-details">
                          <div className="admin-page__stat-detail">
                            <span>Aktuální:</span>
                            <strong>{deviceStats.temperature?.current ?? '--'}°C</strong>
                          </div>
                          <div className="admin-page__stat-detail">
                            <span>Průměr:</span>
                            <strong>{deviceStats.temperature?.avg ?? '--'}°C</strong>
                          </div>
                          <div className="admin-page__stat-detail">
                            <span>Min:</span>
                            <strong>{deviceStats.temperature?.min ?? '--'}°C</strong>
                          </div>
                          <div className="admin-page__stat-detail">
                            <span>Max:</span>
                            <strong>{deviceStats.temperature?.max ?? '--'}°C</strong>
                          </div>
                        </div>
                      </Card>

                      <Card className="admin-page__stats-section" elevation={1}>
                        <h3 className="admin-page__stats-section-title">Vlhkost</h3>
                        <div className="admin-page__stats-details">
                          <div className="admin-page__stat-detail">
                            <span>Aktuální:</span>
                            <strong>{deviceStats.humidity?.current ?? '--'}%</strong>
                          </div>
                          <div className="admin-page__stat-detail">
                            <span>Průměr:</span>
                            <strong>{deviceStats.humidity?.avg ?? '--'}%</strong>
                          </div>
                          <div className="admin-page__stat-detail">
                            <span>Min:</span>
                            <strong>{deviceStats.humidity?.min ?? '--'}%</strong>
                          </div>
                          <div className="admin-page__stat-detail">
                            <span>Max:</span>
                            <strong>{deviceStats.humidity?.max ?? '--'}%</strong>
                          </div>
                        </div>
                      </Card>

                      <Card className="admin-page__stats-section" elevation={1}>
                        <h3 className="admin-page__stats-section-title">CO₂</h3>
                        <div className="admin-page__stats-details">
                          <div className="admin-page__stat-detail">
                            <span>Aktuální:</span>
                            <strong>{deviceStats.co2?.current ?? '--'} ppm</strong>
                          </div>
                          <div className="admin-page__stat-detail">
                            <span>Průměr:</span>
                            <strong>{deviceStats.co2?.avg ?? '--'} ppm</strong>
                          </div>
                          <div className="admin-page__stat-detail">
                            <span>Min:</span>
                            <strong>{deviceStats.co2?.min ?? '--'} ppm</strong>
                          </div>
                          <div className="admin-page__stat-detail">
                            <span>Max:</span>
                            <strong>{deviceStats.co2?.max ?? '--'} ppm</strong>
                          </div>
                        </div>
                      </Card>
                    </div>
                  </div>
                ) : (
                  <div className="admin-page__empty">Nepodařilo se načíst statistiky zařízení.</div>
                )}
              </Card>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}

export default AdminPanel

