import { useState } from 'react'
import { connectAPI } from '../services/api'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import TextField from '../components/ui/TextField'
import Snackbar from '../components/ui/Snackbar'
import Badge from '../components/ui/Badge'
import ProgressBar from '../components/ui/ProgressBar'
import './Connect.css'

const Connect = () => {
  const [boardName, setBoardName] = useState('')
  const [ssid, setSsid] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState({ type: '', message: '', show: false })
  const [loading, setLoading] = useState(false)

  const setStatusMessage = (type, message) => {
    setStatus({ type, message, show: true })
  }

  const clearStatus = () => {
    setStatus({ type: '', message: '', show: false })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!boardName.trim()) {
      setStatusMessage('error', 'Název desky je povinný.')
      return
    }

    if (!ssid.trim()) {
      setStatusMessage('error', 'SSID je povinné.')
      return
    }

    clearStatus()
    setStatusMessage('neutral', 'Připravuji nahrávání…')
    setLoading(true)

    try {
      const response = await connectAPI.uploadFirmware(
        boardName.trim(), 
        ssid.trim(), 
        password
      )

      const payload = response.data

      if (!response.ok || payload.status !== 'success') {
        const errorMessage = payload.message || payload.error || 'Nahrávání selhalo. Zkontrolujte logy serveru.'
        setStatusMessage('error', errorMessage)
        return
      }

      let message = 'Firmware byl úspěšně nahrán.'
      if (payload.log_excerpt) {
        message += ` ${payload.log_excerpt}`
      }
      setStatusMessage('success', message)
      setBoardName('')
      setSsid('')
      setPassword('')
    } catch (error) {
      console.error('Chyba při nahrávání:', error)
      setStatusMessage('error', 'Při nahrávání došlo k neočekávané chybě. Zkontrolujte připojení desky a zkuste to znovu.')
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
        <main className="connect-page__main">
          <Card className="connect-page__info-card" elevation={2}>
            <Badge variant="standard" color="primary" className="connect-page__step-badge">
              Krok 1
            </Badge>
            <h1 className="connect-page__title">Připojte desku k serveru</h1>
            <p className="connect-page__description">
              Zadejte údaje Wi-Fi, které má deska používat, a zbytek nechte na serveru s PlatformIO.
              Není potřeba terminál ani ruční flashování.
            </p>
            <div className="connect-page__tips">
              <div className="connect-page__tip">• Během nahrávání nechte desku připojenou přes USB.</div>
              <div className="connect-page__tip">• Tento postup zopakujte pro každou desku, kterou chcete připravit.</div>
              <div className="connect-page__tip">• Zadejte jedinečný název pro každou desku (např. třída, místnost) pro snadnou identifikaci.</div>
              <div className="connect-page__tip">• Systém ukládá MAC adresu desky, aby bylo možné ji identifikovat.</div>
            </div>
          </Card>

          <Card className="connect-page__form-card" elevation={2}>
            <h2 className="connect-page__form-title">Detaily Wi-Fi</h2>
            {loading && <ProgressBar indeterminate className="connect-page__progress" />}
            <form onSubmit={handleSubmit} className="connect-page__form">
              <TextField
                label="Název desky"
                helperText="Název pro identifikaci desky (např. třída, místnost)."
                placeholder="např. Třída 1A"
                value={boardName}
                onChange={(e) => setBoardName(e.target.value)}
                required
                autoComplete="off"
                disabled={loading}
                fullWidth
              />

              <TextField
                label="Název sítě (SSID)"
                helperText="Síť, ke které se má deska připojit."
                placeholder="např. Cognitiv-Lab"
                value={ssid}
                onChange={(e) => setSsid(e.target.value)}
                required
                autoComplete="off"
                disabled={loading}
                fullWidth
              />

              <TextField
                label="Heslo"
                helperText="U otevřených sítí ponechte prázdné."
                type="password"
                placeholder="Heslo sítě"
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
                  {loading ? 'Nahrávám…' : '⟳ Nahrát firmware'}
                </Button>
                <Button
                  type="button"
                  variant="outlined"
                  size="large"
                  onClick={handleReset}
                  disabled={loading}
                >
                  Vymazat
                </Button>
              </div>
            </form>
          </Card>
        </main>

        <footer className="connect-page__footer">
          Hotovo? Ověřte, že deska odesílá data.
        </footer>
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

