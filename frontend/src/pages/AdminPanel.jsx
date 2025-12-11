import { useState, useEffect } from 'react'
import { adminAPI } from '../services/api'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import ProgressBar from '../components/ui/ProgressBar'
import BoardCard from '../components/admin/BoardCard'
import BoardAnalysisView from '../components/admin/BoardAnalysisView'
import DeviceRenameModal from '../components/admin/DeviceRenameModal'
import './AdminPanel.css'

const AdminPanel = () => {
  const [devices, setDevices] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedBoard, setSelectedBoard] = useState(null)
  const [renameDevice, setRenameDevice] = useState(null)
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
        // Sort devices: online first, then offline
        const devicesList = response.data.devices || []
        const sortedDevices = [...devicesList].sort((a, b) => {
          const aOnline = a.status === 'online' ? 1 : 0
          const bOnline = b.status === 'online' ? 1 : 0
          return bOnline - aOnline // Online devices first (1 - 0 = 1, so b comes before a)
        })
        setDevices(sortedDevices)
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

  const handleDetailsClick = (deviceId) => {
    setSelectedBoard(deviceId)
  }

  const handleCloseAnalysis = () => {
    setSelectedBoard(null)
  }

  const handleRenameClick = (device) => {
    setRenameDevice(device)
  }

  const handleRenameSuccess = () => {
    loadDevices()  // Refresh device list
    setRenameDevice(null)
  }

  const handleCloseRenameModal = () => {
    setRenameDevice(null)
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
                  {devices.map((device) => {
                    // Use mac_address as key if available, otherwise device_id
                    const deviceKey = device.mac_address || device.device_id
                    // For selection, prefer device_id (still used in API calls)
                    const deviceIdForSelection = device.device_id
                    return (
                      <BoardCard
                        key={deviceKey}
                        device={device}
                        onDetailsClick={handleDetailsClick}
                        onRenameClick={handleRenameClick}
                        selected={selectedBoard === deviceIdForSelection}
                      />
                    )
                  })}
                </div>
              )}
            </Card>
          </section>

          {selectedBoard && (
            <BoardAnalysisView deviceId={selectedBoard} onClose={handleCloseAnalysis} />
          )}
        </div>

        {renameDevice && (
          <DeviceRenameModal
            device={renameDevice}
            onClose={handleCloseRenameModal}
            onRenameSuccess={handleRenameSuccess}
          />
        )}
      </div>
    </div>
  )
}

export default AdminPanel

