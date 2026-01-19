import { useState, useEffect } from 'react'
import { adminAPI } from '../../services/api'
import Card from '../ui/Card'
import Button from '../ui/Button'
import TextField from '../ui/TextField'
import Select from '../ui/Select'
import './DeviceCustomizationModal.css'

// Valid room codes from BakalAPI
const ROOM_CODES = [
  "a1", "a2", "a3", "a4", "a5", "aula", "av",
  "b1", "b2", "b3", "b4", "b5", "b6", "b7", "BC", "bi",
  "c1", "c2", "c3", "c4", "c5", "c6", "c7", "ch",
  "el", "f", "j1", "j2", "j3",
  "lbi", "lch", "lf",
  "sbor", "tv1", "tv2", "tv3", "tv4", "Vv"
]

// Room code options for Select component
const ROOM_OPTIONS = [
  { value: '', label: '-- Nepřiřazeno --' },
  ...ROOM_CODES.map(code => ({ value: code, label: code.toUpperCase() }))
]

const DeviceCustomizationModal = ({ device, onClose, onCustomizeSuccess }) => {
  const [displayName, setDisplayName] = useState(device?.display_name || device?.device_id || '')
  const [roomCode, setRoomCode] = useState(device?.room_code || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    // Load current values when device changes
    setDisplayName(device?.display_name || device?.device_id || '')
    setRoomCode(device?.room_code || '')
  }, [device])

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!displayName.trim()) {
      setError('Název je povinný')
      return
    }

    if (!device?.mac_address) {
      setError('Zařízení nemá MAC adresu')
      return
    }

    setLoading(true)
    setError('')

    try {
      await adminAPI.customizeDevice(device.mac_address, {
        display_name: displayName.trim(),
        room_code: roomCode
      })
      onCustomizeSuccess?.()
      onClose?.()
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.message || 'Chyba při ukládání'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="device-customization-modal-overlay" onClick={onClose}>
      <Card className="device-customization-modal" elevation={3} onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title">Přizpůsobit zařízení</h2>
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-field">
            <TextField
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Název zařízení"
              required
              maxLength={100}
              autoFocus
              disabled={loading}
            />
          </div>
          <div className="form-field">
            <Select
              label="Kód místnosti (BakalAPI)"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value)}
              options={ROOM_OPTIONS}
              disabled={loading}
              helperText="Pro automatickou anotaci rozvrhem"
            />
          </div>
          {error && <div className="device-customization-modal-error">{error}</div>}
          <div className="device-customization-modal-actions">
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

export default DeviceCustomizationModal
