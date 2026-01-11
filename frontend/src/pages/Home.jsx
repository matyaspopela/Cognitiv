import { useAuth } from '../context/AuthContext'
import DashboardOverview from '../components/dashboard/DashboardOverview'
import QuickActionCard from '../components/ui/QuickActionCard'
import { LayoutDashboard, Smartphone, Link2, Settings } from 'lucide-react'
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
            <>
              <QuickActionCard
                to="/admin"
                icon={Settings}
                title="Admin Panel"
                description="Manage devices and system settings"
              />
              <QuickActionCard
                to="/connect"
                icon={Link2}
                title="Connect Device"
                description="Add new devices to the network"
              />
            </>
          )}
        </div>
      </section>
    </div>
  )
}

export default Home

