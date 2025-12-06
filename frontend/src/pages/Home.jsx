import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { dataAPI } from '../services/api'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import './Home.css'

const Home = () => {
  const [co2Status, setCo2Status] = useState({
    value: '--',
    state: 'Čekám na data',
    stateClass: '',
    summary: 'Načítám nejnovější data z vašich zařízení…',
    updated: '—'
  })
  const [totalDataPoints, setTotalDataPoints] = useState('—')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadCo2Status()
    loadTotalStats()
  }, [])

  const loadCo2Status = async () => {
    try {
      const response = await dataAPI.getStats(1)
      const payload = response.data

      if (payload.status !== 'success' || !payload.stats) {
        setCo2Status({
          value: '-- ppm',
          state: 'Čekám na data',
          stateClass: '',
          summary: 'V poslední hodině zatím nejsou dostupná data CO₂. Připojte desku a zkuste to znovu.',
          updated: '—'
        })
        return
      }

      const co2Stats = payload.stats.co2
      if (!co2Stats) {
        setCo2Status({
          value: '-- ppm',
          state: 'Čekám na data',
          stateClass: '',
          summary: 'V poslední hodině zatím nejsou dostupná data CO₂. Připojte desku a zkuste to znovu.',
          updated: '—'
        })
        return
      }

      const current = co2Stats.current ?? co2Stats.avg ?? '--'
      const lastUpdated = payload.stats.time_range_hours
        ? `posledních ${payload.stats.time_range_hours} h`
        : 'nedávno'

      let message = 'Kvalita vzduchu je stabilní.'
      let stateClass = 'good'
      let label = 'Dobrá kvalita vzduchu'

      if (typeof current === 'number') {
        if (current >= 2000) {
          label = 'Kritická kvalita vzduchu'
          stateClass = 'critical'
          message = 'Koncentrace CO₂ je velmi vysoká. Intenzivně vyvětrejte.'
        } else if (current >= 1500) {
          label = 'Špatná kvalita vzduchu'
          stateClass = 'high'
          message = 'Koncentrace CO₂ je vysoká. Doporučujeme intenzivně větrat.'
        } else if (current >= 1000) {
          label = 'Střední kvalita vzduchu'
          stateClass = 'moderate'
          message = 'Koncentrace CO₂ pozvolna roste. Zvažte otevření okna'
        }
      } else {
        label = 'Čekám na data'
        stateClass = ''
        message = 'Žádná živá data nejsou k dispozici. Senzory brzy odešlou nový záznam.'
      }

      setCo2Status({
        value: typeof current === 'number' ? `${current} ppm` : `${current}`,
        state: label,
        stateClass,
        summary: message,
        updated: lastUpdated
      })
    } catch (error) {
      console.error('Nepodařilo se načíst stav CO₂:', error)
      setCo2Status({
        value: '-- ppm',
        state: 'Problém s připojením',
        stateClass: '',
        summary: 'Server je momentálně nedostupný. Otevřete přehled pro detailní stav.',
        updated: '—'
      })
    } finally {
      setLoading(false)
    }
  }

  const loadTotalStats = async () => {
    try {
      const response = await dataAPI.getStatus()
      const payload = response.data

      if (payload.status === 'online' && payload.data_points !== undefined) {
        const totalPoints = payload.data_points
        const formatted = totalPoints.toLocaleString('cs-CZ')
        setTotalDataPoints(formatted)
      } else {
        setTotalDataPoints('0')
      }
    } catch (error) {
      console.error('Nepodařilo se načíst celkové statistiky:', error)
      setTotalDataPoints('—')
    }
  }

  const getStatusColor = () => {
    switch (co2Status.stateClass) {
      case 'good':
        return 'success'
      case 'moderate':
        return 'warning'
      case 'high':
        return 'warning'
      case 'critical':
        return 'error'
      default:
        return 'primary'
    }
  }

  return (
    <div className="home-page">
      <main className="home-page__main">
        <Card className="home-page__banner" elevation={2}>
          <div className="home-page__banner-content">
            <span>Momentálně probíhá úprava senzoru a neprobíhá měření dat.</span>
          </div>
        </Card>

        <section className="home-page__hero">
          <Card className="home-page__hero-card" elevation={3}>
            <div className="home-page__hero-content">
              <h1 className="home-page__hero-title">Sledujte kvalitu vzduchu v reálném čase</h1>
              <p className="home-page__hero-description">
                Cognitiv monitoruje teplotu, vlhkost a koncentraci CO₂ pomocí senzorů ESP32.
                Všechna data jsou zobrazena v přehledném dashboardu s grafy a statistikami.
              </p>
              <div className="home-page__hero-actions">
                <Button
                  variant="filled"
                  size="large"
                  component={Link}
                  to="/dashboard"
                >
                  Otevřít živý přehled
                </Button>
                <Button
                  variant="outlined"
                  size="large"
                  component="a"
                  href="#features"
                >
                  Cíl projektu
                </Button>
              </div>
            </div>
          </Card>

          <Card className="home-page__hero-features" elevation={2}>
            <h2 className="home-page__features-title">Přehledný dashboard</h2>
            <p className="home-page__features-description">
              Dashboard zobrazuje aktuální hodnoty a trendy v přehledných grafech. Barevné indikátory okamžitě ukazují kvalitu vzduchu.
            </p>
            <ul className="home-page__features-list">
              <li>Živá data z vašich senzorů v reálném čase</li>
              <li>Historická data pro analýzu dlouhodobých trendů</li>
            </ul>
          </Card>
        </section>

        <section className="home-page__co2-status" id="co2Status">
          <Card className="home-page__co2-card" elevation={3}>
            <div className="home-page__co2-header">
              <Badge variant="standard" color="primary" className="home-page__co2-badge">
                Živý stav vzduchu
              </Badge>
              <h2 className="home-page__co2-title">Aktuální koncentrace CO₂</h2>
              <p className="home-page__co2-summary">{co2Status.summary}</p>
            </div>
            <div className="home-page__co2-reading">
              <div className="home-page__co2-value">{co2Status.value}</div>
              <Badge
                variant="standard"
                color={getStatusColor()}
                className="home-page__co2-state"
              >
                {co2Status.state}
              </Badge>
              <div className="home-page__co2-meta">
                <span>Aktualizováno <strong>{co2Status.updated}</strong></span>
                <span>Okno <strong>Poslední hodina</strong></span>
              </div>
            </div>
          </Card>
        </section>

        <section id="features" className="home-page__mission">
          <Card className="home-page__mission-card" elevation={2}>
            <div className="home-page__mission-content">
              <div className="home-page__mission-text">
                <h2 className="home-page__mission-title">Cíle projektu</h2>
                <p className="home-page__mission-description">
                  Cognitiv je systém pro monitorování kvality vzduchu v budovách. Projekt vznikl s cílem zlepšit prostředí ve školách, kancelářích a dalších veřejných prostorách.
                </p>
                <p className="home-page__mission-description">
                  Kvalita vzduchu významně ovlivňuje schopnost koncentrace a produktivitu. Moderní školy by měly klást důraz na monitoring a řízení kvality vzduchu, zejména v prostorách s chytrými ventilačními systémy.
                </p>
              </div>
              <Card className="home-page__mission-stats" elevation={4}>
                <div className="home-page__stats-label">Celkem nasbíráno</div>
                <div className="home-page__stats-value">{totalDataPoints}</div>
                <div className="home-page__stats-unit">měření</div>
              </Card>
            </div>
          </Card>
        </section>
      </main>

      <footer className="home-page__footer">
        <div className="home-page__footer-text">Vytvořeno pro zodpovědnou péči o kvalitu vzduchu.</div>
        <div className="home-page__footer-links">
          <Link to="/connect">Připojit</Link>
          <Link to="/dashboard">Přehled</Link>
          <a href="#features">Funkce</a>
          <a href="mailto:hello@cognitiv.dev">Kontakt</a>
        </div>
      </footer>
    </div>
  )
}

export default Home

