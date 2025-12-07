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
  const [enableBundling, setEnableBundling] = useState(true)
  const [enableWifiOnDemand, setEnableWifiOnDemand] = useState(false)
  const [enableDeepSleep, setEnableDeepSleep] = useState(false)
  const [deepSleepDuration, setDeepSleepDuration] = useState(60) // Default: 60 seconds
  const [enableScheduledShutdown, setEnableScheduledShutdown] = useState(false)
  const [shutdownHour, setShutdownHour] = useState(16) // Default: 4pm
  const [shutdownMinute, setShutdownMinute] = useState(0)
  const [wakeHour, setWakeHour] = useState(8) // Default: 8am
  const [wakeMinute, setWakeMinute] = useState(0)
  const [status, setStatus] = useState({ type: '', message: '', show: false })
  const [loading, setLoading] = useState(false)

  const setStatusMessage = (type, message) => {
    setStatus({ type, message, show: true })
  }

  const clearStatus = () => {
    setStatus({ type: '', message: '', show: false })
  }

  // Handle WiFi-on-demand checkbox change
  const handleWifiOnDemandChange = (checked) => {
    setEnableWifiOnDemand(checked)
    if (checked) {
      // Auto-enable bundling and deep sleep
      setEnableBundling(true)
      setEnableDeepSleep(true)
      setDeepSleepDuration(10)  // Fixed at 10 seconds for WiFi-on-demand
    }
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

    // Validate deep sleep duration if enabled
    if (enableDeepSleep) {
      const duration = parseInt(deepSleepDuration, 10)
      if (isNaN(duration) || duration < 10 || duration > 4260) {
        setStatusMessage('error', 'Doba hlubokého spánku musí být mezi 10 sekundami a 71 minutami (4260 sekund).')
        return
      }
    }

    // Validate scheduled shutdown times if enabled
    if (enableScheduledShutdown) {
      const hour = parseInt(shutdownHour, 10)
      const minute = parseInt(shutdownMinute, 10)
      const wakeH = parseInt(wakeHour, 10)
      const wakeM = parseInt(wakeMinute, 10)
      
      if (isNaN(hour) || hour < 0 || hour > 23 ||
          isNaN(minute) || minute < 0 || minute > 59 ||
          isNaN(wakeH) || wakeH < 0 || wakeH > 23 ||
          isNaN(wakeM) || wakeM < 0 || wakeM > 59) {
        setStatusMessage('error', 'Časy vypnutí a probuzení musí být platné (hodiny: 0-23, minuty: 0-59).')
        return
      }
    }

    try {
      const response = await connectAPI.uploadFirmware(
        boardName.trim(), 
        ssid.trim(), 
        password,
        enableBundling,
        enableWifiOnDemand,
        enableDeepSleep,
        enableDeepSleep ? parseInt(deepSleepDuration, 10) : null,
        enableScheduledShutdown,
        enableScheduledShutdown ? parseInt(shutdownHour, 10) : null,
        enableScheduledShutdown ? parseInt(shutdownMinute, 10) : null,
        enableScheduledShutdown ? parseInt(wakeHour, 10) : null,
        enableScheduledShutdown ? parseInt(wakeMinute, 10) : null
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
      setEnableBundling(true)
      setEnableWifiOnDemand(false)
      setEnableDeepSleep(false)
      setDeepSleepDuration(60)
      setEnableScheduledShutdown(false)
      setShutdownHour(16)
      setShutdownMinute(0)
      setWakeHour(8)
      setWakeMinute(0)
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
    setEnableBundling(true)
    setEnableWifiOnDemand(false)
    setEnableDeepSleep(false)
    setDeepSleepDuration(60)
    setEnableScheduledShutdown(false)
    setShutdownHour(16)
    setShutdownMinute(0)
    setWakeHour(8)
    setWakeMinute(0)
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

              <div className="connect-page__settings">
                <h3 className="connect-page__settings-title">Nastavení funkce</h3>
                
                <div className="connect-page__setting-item">
                  <label className="connect-page__checkbox-label">
                    <input
                      type="checkbox"
                      checked={enableWifiOnDemand}
                      onChange={(e) => handleWifiOnDemandChange(e.target.checked)}
                      disabled={loading}
                      className="connect-page__checkbox"
                    />
                    <span className="connect-page__checkbox-text">
                      <strong>WiFi-On-Demand Mode</strong>
                      <span className="connect-page__checkbox-description">
                        Připojí WiFi pouze když je buffer plný a data jsou připravena k odeslání. 
                        Po odeslání se WiFi vypne a deska přejde do hlubokého spánku na 10 sekund. 
                        Maximální úspora energie (~99%).
                      </span>
                    </span>
                  </label>
                </div>

                <div className="connect-page__setting-item">
                  <label className="connect-page__checkbox-label">
                    <input
                      type="checkbox"
                      checked={enableBundling}
                      onChange={(e) => setEnableBundling(e.target.checked)}
                      disabled={loading || enableWifiOnDemand}
                      className="connect-page__checkbox"
                    />
                    <span className="connect-page__checkbox-text">
                      <strong>HTTP Bundling</strong>
                      <span className="connect-page__checkbox-description">
                        Seskupuje HTTP požadavky do balíčků (snižuje počet požadavků o ~90%)
                        {enableWifiOnDemand && " (Automaticky zapnuto v režimu WiFi-On-Demand)"}
                      </span>
                    </span>
                  </label>
                </div>

                <div className="connect-page__setting-item">
                  <label className="connect-page__checkbox-label">
                    <input
                      type="checkbox"
                      checked={enableDeepSleep}
                      onChange={(e) => setEnableDeepSleep(e.target.checked)}
                      disabled={loading || enableWifiOnDemand}
                      className="connect-page__checkbox"
                    />
                    <span className="connect-page__checkbox-text">
                      <strong>Deep Sleep Mode</strong>
                      <span className="connect-page__checkbox-description">
                        Režim hlubokého spánku pro úsporu energie (vyžaduje připojení EN + IO16 pinů)
                        {enableWifiOnDemand && " (Automaticky zapnuto v režimu WiFi-On-Demand)"}
                      </span>
                    </span>
                  </label>
                  {enableDeepSleep && !enableWifiOnDemand && (
                    <div className="connect-page__deep-sleep-duration">
                      <TextField
                        label="Doba spánku (sekundy)"
                        helperText="Doba, po kterou bude deska v hlubokém spánku (10-4260 sekund, doporučeno: 60)"
                        type="number"
                        min="10"
                        max="4260"
                        value={deepSleepDuration}
                        onChange={(e) => setDeepSleepDuration(e.target.value)}
                        disabled={loading}
                        fullWidth
                        style={{ marginTop: 'var(--md3-spacing-3)' }}
                      />
                    </div>
                  )}
                  {enableWifiOnDemand && (
                    <div className="connect-page__deep-sleep-duration">
                      <TextField
                        label="Doba spánku (sekundy)"
                        helperText="WiFi-On-Demand režim používá pevně nastavenou dobu 10 sekund pro optimální úsporu energie"
                        type="number"
                        value="10"
                        disabled={true}
                        fullWidth
                        style={{ marginTop: 'var(--md3-spacing-3)' }}
                      />
                    </div>
                  )}
                </div>

                <div className="connect-page__setting-item">
                  <label className="connect-page__checkbox-label">
                    <input
                      type="checkbox"
                      checked={enableScheduledShutdown}
                      onChange={(e) => setEnableScheduledShutdown(e.target.checked)}
                      disabled={loading}
                      className="connect-page__checkbox"
                    />
                    <span className="connect-page__checkbox-text">
                      <strong>Scheduled Shutdown</strong>
                      <span className="connect-page__checkbox-description">
                        Automaticky vypne měření v určený čas a probudí se následující den (např. po skončení školy)
                      </span>
                    </span>
                  </label>
                  {enableScheduledShutdown && (
                    <div className="connect-page__scheduled-shutdown-times">
                      <div className="connect-page__time-inputs">
                        <div className="connect-page__time-group">
                          <label className="connect-page__time-label">Čas vypnutí:</label>
                          <div className="connect-page__time-fields">
                            <TextField
                              label="Hodina"
                              type="number"
                              min="0"
                              max="23"
                              value={shutdownHour}
                              onChange={(e) => setShutdownHour(e.target.value)}
                              disabled={loading}
                              style={{ width: '80px' }}
                            />
                            <span className="connect-page__time-separator">:</span>
                            <TextField
                              label="Minuta"
                              type="number"
                              min="0"
                              max="59"
                              value={shutdownMinute}
                              onChange={(e) => setShutdownMinute(e.target.value)}
                              disabled={loading}
                              style={{ width: '80px' }}
                            />
                          </div>
                        </div>
                        <div className="connect-page__time-group">
                          <label className="connect-page__time-label">Čas probuzení (následující den):</label>
                          <div className="connect-page__time-fields">
                            <TextField
                              label="Hodina"
                              type="number"
                              min="0"
                              max="23"
                              value={wakeHour}
                              onChange={(e) => setWakeHour(e.target.value)}
                              disabled={loading}
                              style={{ width: '80px' }}
                            />
                            <span className="connect-page__time-separator">:</span>
                            <TextField
                              label="Minuta"
                              type="number"
                              min="0"
                              max="59"
                              value={wakeMinute}
                              onChange={(e) => setWakeMinute(e.target.value)}
                              disabled={loading}
                              style={{ width: '80px' }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

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
          Hotovo? Otevřete <a href="/dashboard">přehled</a> a ověřte, že deska odesílá data.
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

