import { useState } from 'react'
import { Upload, HelpCircle, X } from 'lucide-react'
import { connectAPI } from '../services/api'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import TextField from '../components/ui/TextField'
import Snackbar from '../components/ui/Snackbar'
import ProgressBar from '../components/ui/ProgressBar'
import './Connect.css'

const Connect = () => {
  const [boardName, setBoardName] = useState('')
  const [ssid, setSsid] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState({ type: '', message: '', show: false })
  const [loading, setLoading] = useState(false)
  const [showHelp, setShowHelp] = useState(false)

  const setStatusMessage = (type, message) => {
    setStatus({ type, message, show: true })
  }

  const clearStatus = () => {
    setStatus({ type: '', message: '', show: false })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!boardName.trim()) {
      setStatusMessage('error', 'Board name is required.')
      return
    }

    if (!ssid.trim()) {
      setStatusMessage('error', 'WiFi SSID is required.')
      return
    }

    clearStatus()
    setStatusMessage('neutral', 'Preparing upload…')
    setLoading(true)

    try {
      const response = await connectAPI.uploadFirmware(
        boardName.trim(), 
        ssid.trim(), 
        password
      )

      const payload = response.data

      if (!response.ok || payload.status !== 'success') {
        const errorMessage = payload.message || payload.error || 'Upload failed. Check server logs.'
        setStatusMessage('error', errorMessage)
        return
      }

      let message = 'Firmware uploaded successfully.'
      if (payload.log_excerpt) {
        message += ` ${payload.log_excerpt}`
      }
      setStatusMessage('success', message)
      setBoardName('')
      setSsid('')
      setPassword('')
    } catch (error) {
      console.error('Upload error:', error)
      setStatusMessage('error', 'Unexpected error occurred. Check device connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleReset = () => {
    clearStatus()
    setBoardName('')
    setSsid('')
    setPassword('')
  }

  const getSnackbarVariant = () => {
    if (status.type === 'success') return 'success'
    if (status.type === 'error') return 'error'
    return 'standard'
  }

  return (
    <div className="connect-page">
      <div className="connect-page__container">
        <header className="connect-page__header">
          <h1 className="connect-page__title">Firmware Upload</h1>
          <button
            className="connect-page__help-toggle"
            onClick={() => setShowHelp(!showHelp)}
            aria-label="Toggle help"
            title="Show help"
          >
            <HelpCircle size={20} strokeWidth={1.5} />
          </button>
        </header>

        {showHelp && (
          <Card className="connect-page__help-card">
            <div className="connect-page__help-header">
              <h3 className="connect-page__help-title">Quick Guide</h3>
              <button
                className="connect-page__help-close"
                onClick={() => setShowHelp(false)}
                aria-label="Close help"
              >
                <X size={18} strokeWidth={2} />
              </button>
            </div>
            <ul className="connect-page__help-list">
              <li>Ensure device is connected via USB before uploading</li>
              <li>Enter a unique board name for identification</li>
              <li>Provide WiFi credentials the device should use</li>
              <li>System automatically detects MAC address</li>
            </ul>
          </Card>
        )}

        <main className="connect-page__main">
          <Card className="connect-page__form-card">
            {loading && <ProgressBar indeterminate className="connect-page__progress" />}
            <form onSubmit={handleSubmit} className="connect-page__form">
              <TextField
                label="Board Name"
                helperText="Unique identifier (e.g., room, location)"
                placeholder="e.g., Room 101"
                value={boardName}
                onChange={(e) => setBoardName(e.target.value)}
                required
                autoComplete="off"
                disabled={loading}
                fullWidth
              />

              <TextField
                label="WiFi SSID"
                helperText="Network name to connect to"
                placeholder="e.g., Cognitiv-Lab"
                value={ssid}
                onChange={(e) => setSsid(e.target.value)}
                required
                autoComplete="off"
                disabled={loading}
                fullWidth
              />

              <TextField
                label="Password"
                helperText="Leave empty for open networks"
                type="password"
                placeholder="Network password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                fullWidth
              />

              <div className="connect-page__actions">
                <Button
                  type="submit"
                  variant="filled"
                  size="large"
                  disabled={loading}
                >
                  {loading ? (
                    <>Uploading…</>
                  ) : (
                    <>
                      <Upload size={18} strokeWidth={2} style={{ marginRight: '8px' }} />
                      Upload Firmware
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outlined"
                  size="large"
                  onClick={handleReset}
                  disabled={loading}
                >
                  Clear
                </Button>
              </div>
            </form>
          </Card>
        </main>
      </div>

      <Snackbar
        message={status.message}
        open={status.show}
        onClose={clearStatus}
        variant={getSnackbarVariant()}
        duration={status.type === 'success' ? 5000 : 7000}
      />
    </div>
  )
}

export default Connect

