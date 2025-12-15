import { useState } from 'react'
import { adminAPI } from '../../services/api'
import Card from '../ui/Card'
import Button from '../ui/Button'
import TextField from '../ui/TextField'
import './DeviceRenameModal.css'

const DeviceRenameModal = ({ device, onClose, onRenameSuccess }) => {
  const [displayName, setDisplayName] = useState(device?.display_name || device?.device_id || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!displayName.trim()) {
      setError('Název je povinný')
      return
    }

    if (!device?.mac_address) {
      setError('Toto zařízení nemá MAC adresu, nelze přejmenovat')
      return
    }

    setLoading(true)
    setError('')

    try {
      await adminAPI.renameDevice(device.mac_address, displayName.trim())
      onRenameSuccess?.()
      onClose?.()
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.message || 'Chyba při přejmenování zařízení'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="device-rename-modal-overlay" onClick={onClose}>
      <Card className="device-rename-modal" elevation={3} onClick={(e) => e.stopPropagation()}>
        <h2>Přejmenovat zařízení</h2>
        <form onSubmit={handleSubmit}>
          <TextField
            label="Název zařízení"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
            maxLength={100}
            autoFocus
            disabled={loading}
          />
          {error && <div className="device-rename-modal-error">{error}</div>}
          <div className="device-rename-modal-actions">
            <Button type="button" variant="outlined" onClick={onClose} disabled={loading}>
              Zrušit
            </Button>
            <Button type="submit" variant="filled" disabled={loading}>
              {loading ? 'Ukládám...' : 'Uložit'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}

export default DeviceRenameModal













