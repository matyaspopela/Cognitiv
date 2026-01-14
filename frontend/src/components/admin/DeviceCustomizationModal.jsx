import { useState, useEffect } from 'react'
import { adminAPI } from '../../services/api'
import Card from '../ui/Card'
import Button from '../ui/Button'
import TextField from '../ui/TextField'
import './DeviceCustomizationModal.css'

const DeviceCustomizationModal = ({ device, onClose, onCustomizeSuccess }) => {
  const [displayName, setDisplayName] = useState(device?.display_name || device?.device_id || '')
  const [className, setClassName] = useState(device?.class || '')
  const [school, setSchool] = useState(device?.school || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    // Load current values when device changes
    setDisplayName(device?.display_name || device?.device_id || '')
    setClassName(device?.class || '')
    setSchool(device?.school || '')
  }, [device])

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!displayName.trim()) {
      setError('Name is required')
      return
    }

    if (!device?.mac_address) {
      setError('This device does not have a MAC address, cannot customize')
      return
    }

    setLoading(true)
    setError('')

    try {
      await adminAPI.customizeDevice(device.mac_address, {
        display_name: displayName.trim(),
        class: className.trim(),
        school: school.trim()
      })
      onCustomizeSuccess?.()
      onClose?.()
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.message || 'Error customizing device'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="device-customization-modal-overlay" onClick={onClose}>
      <Card className="device-customization-modal" elevation={3} onClick={(e) => e.stopPropagation()}>
        <h2>Customize Device</h2>
        <form onSubmit={handleSubmit}>
          <TextField
            label="Device Name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
            maxLength={100}
            autoFocus
            disabled={loading}
          />
          <TextField
            label="Class"
            value={className}
            onChange={(e) => setClassName(e.target.value)}
            maxLength={50}
            disabled={loading}
            placeholder="e.g., 5A, Biology Lab"
          />
          <TextField
            label="School"
            value={school}
            onChange={(e) => setSchool(e.target.value)}
            maxLength={100}
            disabled={loading}
            placeholder="e.g., Elementary School"
          />
          {error && <div className="device-customization-modal-error">{error}</div>}
          <div className="device-customization-modal-actions">
            <Button type="button" variant="outlined" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" variant="filled" disabled={loading}>
              {loading ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}

export default DeviceCustomizationModal
