import { useAuth } from '../context/AuthContext'
import DashboardOverview from '../components/dashboard/DashboardOverview'
import QuickActionCard from '../components/ui/QuickActionCard'
import Card from '../components/ui/Card'
import { LayoutDashboard, Settings } from 'lucide-react'
import './Home.css'

const Home = () => {
  const { isAdmin } = useAuth()

  return (
    <div className="home-page">
      <header className="home-page__header">
        <h1 className="home-page__title">Overview</h1>
        <p className="home-page__description">
          Monitor your IoT devices and system metrics at a glance
        </p>
      </header>

      <section className="home-page__metrics">
        <DashboardOverview />
      </section>

      <section className="home-page__quick-actions">
        <h2 className="home-page__section-title">Quick Actions</h2>
        <div className="home-page__quick-actions-grid">
          <QuickActionCard
            to="/dashboard"
            icon={LayoutDashboard}
            title="Dashboard"
            description="View all devices and detailed metrics"
          />
          {isAdmin && (
            <QuickActionCard
              to="/admin"
              icon={Settings}
              title="Admin Panel"
              description="Manage devices and system settings"
            />
          )}
        </div>
      </section>

      <section className="home-page__about">
        <h2 className="home-page__section-title">About</h2>
        <Card className="home-page__about-card" elevation={2}>
          <div className="home-page__about-content">
            <p className="home-page__about-text">
              Cognitiv is an IoT monitoring system designed to track and analyze environmental data
              from connected devices. Monitor air quality, temperature, and humidity in real-time
              with comprehensive analytics and visualization tools.
            </p>
            <p className="home-page__about-text">
              Use the dashboard to view detailed metrics for individual devices, analyze historical
              trends, and manage your device network. Stay informed about your environment with
              intuitive visualizations and actionable insights.
            </p>
          </div>
        </Card>
      </section>
    </div>
  )
}

export default Home

