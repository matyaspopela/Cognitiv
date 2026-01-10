import { useState, useEffect } from 'react'
import { useTheme } from '../../theme/ThemeProvider'
import Card from './Card'
import Button from './Button'
import Chip from './Chip'
import TextField from './TextField'
import Select from './Select'
import './SettingsModal.css'

const SettingsModal = ({ 
  isOpen, 
  onClose, 
  onApply,
  initialSettings = {},
  devices = []
}) => {
  const { theme, setTheme } = useTheme()
  const [settings, setSettings] = useState({
    // History settings
    start: null,
    end: null,
    selectedPreset: '30d',
    bucket: 'day',
    deviceId: '',
    
    ...initialSettings
  })

  useEffect(() => {
    if (isOpen) {
      // Reset to initial settings when modal opens
      setSettings({
        start: null,
        end: null,
        bucket: 'day',
        selectedPreset: '30d',
        deviceId: '',
        ...initialSettings
      })
    }
  }, [isOpen, initialSettings])

  const formatDateForInput = (date) => {
    if (!date) return ''
    if (typeof date === 'string') return date
    const pad = (n) => String(n).padStart(2, '0')
    const year = date.getFullYear()
    const month = pad(date.getMonth() + 1)
    const day = pad(date.getDate())
    const hours = pad(date.getHours())
    const minutes = pad(date.getMinutes())
    return `${year}-${month}-${day}T${hours}:${minutes}`
  }

  const handleApply = () => {
    if (onApply) {
      onApply(settings)
    }
    onClose()
  }

  const handleCancel = () => {
    // Reset to initial settings
    setSettings({
      start: null,
      end: null,
      bucket: 'day',
      selectedPreset: '30d',
      deviceId: '',
      ...initialSettings
    })
    onClose()
  }

  const applyPreset = (preset) => {
    const now = new Date()
    let start = null
    let end = formatDateForInput(now)

    switch (preset) {
      case '24h':
        start = formatDateForInput(new Date(now.getTime() - 24 * 60 * 60 * 1000))
        break
      case '7d':
        start = formatDateForInput(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000))
        break
      case '30d':
        start = formatDateForInput(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000))
        break
      case '90d':
        start = formatDateForInput(new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000))
        break
    }

    setSettings(prev => ({ 
      ...prev, 
      start, 
      end,
      selectedPreset: preset 
    }))
  }

  if (!isOpen) return null

  const presetOptions = [
    { id: '24h', label: '24h' },
    { id: '7d', label: '7d' },
    { id: '30d', label: '30d' },
    { id: '90d', label: '90d' },
    { id: 'custom', label: 'Vlastní' },
  ]

  const bucketOptions = [
    { value: 'raw', label: 'Bez granularity', desc: 'Všechna data bez agregace' },
    { value: '10min', label: '10 minut', desc: 'Průměr za 10 minut' },
    { value: 'hour', label: 'Hodinová', desc: 'Průměr za hodinu' },
    { value: 'day', label: 'Denní', desc: 'Průměr za den' },
  ]

  return (
    <div 
      className="settings-modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleCancel()
      }}
    >
      <Card className="settings-modal" elevation={5}>
        <div className="settings-modal__header">
          <h2 className="settings-modal__title">Nastavení</h2>
          <Button
            variant="text"
            size="small"
            onClick={handleCancel}
            aria-label="Zavřít"
          >
            ✕
          </Button>
        </div>

        <div className="settings-modal__content">
          {/* Theme Selection Section */}
          <div className="settings-modal__section">
            <h3 className="settings-modal__section-title">Vzhled</h3>
            <div className="settings-modal__theme-selector">
              <label className={`settings-modal__theme-option ${theme === 'light' ? 'settings-modal__theme-option--checked' : ''}`}>
                <input
                  type="radio"
                  name="theme"
                  value="light"
                  checked={theme === 'light'}
                  onChange={(e) => setTheme(e.target.value)}
                />
                <span className="settings-modal__theme-label">
                  <span className="settings-modal__theme-icon">☀️</span>
                  <span>Light</span>
                </span>
              </label>
              <label className={`settings-modal__theme-option ${theme === 'dark' ? 'settings-modal__theme-option--checked' : ''}`}>
                <input
                  type="radio"
                  name="theme"
                  value="dark"
                  checked={theme === 'dark'}
                  onChange={(e) => setTheme(e.target.value)}
                />
                <span className="settings-modal__theme-label">
                  <span className="settings-modal__theme-icon">🌙</span>
                  <span>Dark</span>
                </span>
              </label>
              <label className={`settings-modal__theme-option ${theme === 'system' ? 'settings-modal__theme-option--checked' : ''}`}>
                <input
                  type="radio"
                  name="theme"
                  value="system"
                  checked={theme === 'system'}
                  onChange={(e) => setTheme(e.target.value)}
                />
                <span className="settings-modal__theme-label">
                  <span className="settings-modal__theme-icon">💻</span>
                  <span>System</span>
                </span>
              </label>
            </div>
          </div>

          <div className="settings-modal__section">
            <h3 className="settings-modal__section-title">Rychlý výběr období</h3>
            <div className="settings-modal__chips">
              {presetOptions.map((preset) => (
                <Chip
                  key={preset.id}
                  variant="filter"
                  selected={settings.selectedPreset === preset.id}
                  onClick={() => {
                    if (preset.id === 'custom') {
                      setSettings(prev => ({ ...prev, selectedPreset: 'custom' }))
                    } else {
                      applyPreset(preset.id)
                    }
                  }}
                >
                  {preset.label}
                </Chip>
              ))}
            </div>
          </div>

          <div className={`settings-modal__section ${settings.selectedPreset === 'custom' ? 'settings-modal__section--active' : ''}`}>
            <h3 className="settings-modal__section-title">Vlastní časové období</h3>
            <div className="settings-modal__date-range">
              <TextField
                type="datetime-local"
                label="Od"
                value={settings.start || ''}
                onChange={(e) => {
                  setSettings(prev => ({ 
                    ...prev, 
                    start: e.target.value,
                    selectedPreset: 'custom'
                  }))
                }}
                fullWidth
              />
              <TextField
                type="datetime-local"
                label="Do"
                value={settings.end || ''}
                onChange={(e) => {
                  setSettings(prev => ({ 
                    ...prev, 
                    end: e.target.value,
                    selectedPreset: 'custom'
                  }))
                }}
                fullWidth
              />
            </div>
          </div>

          <div className="settings-modal__section">
            <h3 className="settings-modal__section-title">Granularita dat</h3>
            <div className="settings-modal__buckets">
              {bucketOptions.map((bucket) => (
                <Card
                  key={bucket.value}
                  className={`settings-modal__bucket-card ${settings.bucket === bucket.value ? 'settings-modal__bucket-card--active' : ''}`}
                  elevation={settings.bucket === bucket.value ? 2 : 1}
                  onClick={() => setSettings(prev => ({ ...prev, bucket: bucket.value }))}
                >
                  <div className="settings-modal__bucket-title">{bucket.label}</div>
                  <div className="settings-modal__bucket-desc">{bucket.desc}</div>
                </Card>
              ))}
            </div>
          </div>

          <div className="settings-modal__section">
            <Select
              label="Zařízení"
              value={settings.deviceId || ''}
              onChange={(e) => setSettings(prev => ({ ...prev, deviceId: e.target.value }))}
              options={[
                { value: '', label: 'Všechna zařízení' },
                ...(devices || []).map((device) => {
                  const deviceId = typeof device === 'string' ? device : (device?.device_id || device)
                  return { value: deviceId, label: deviceId }
                })
              ]}
              fullWidth
            />
          </div>
        </div>

        <div className="settings-modal__footer">
          <Button
            variant="outlined"
            size="medium"
            onClick={handleCancel}
          >
            Zrušit
          </Button>
          <Button
            variant="filled"
            size="medium"
            onClick={handleApply}
          >
            Použít
          </Button>
        </div>
      </Card>
    </div>
  )
}

export default SettingsModal

