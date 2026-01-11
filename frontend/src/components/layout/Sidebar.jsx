import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { LayoutDashboard, Smartphone, Link2, Settings, LogOut, Menu, X } from 'lucide-react'
import './Sidebar.css'

const Sidebar = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const { isAdmin, username, logout } = useAuth()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const handleLogout = async () => {
    await logout()
    navigate('/')
    setMobileMenuOpen(false)
  }

  const navItems = [
    { path: '/', label: 'Overview', icon: LayoutDashboard },
    { path: '/dashboard', label: 'Devices', icon: Smartphone },
  ]

  // Admin-only navigation items
  const adminNavItems = [
    { path: '/connect', label: 'Connect', icon: Link2 },
    { path: '/admin', label: 'Settings', icon: Settings },
  ]

  const isActive = (path) => {
    if (path === '/') {
      return location.pathname === '/'
    }
    return location.pathname.startsWith(path)
  }

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="sidebar">
        <div className="sidebar__content">
          {/* Logo */}
          <div className="sidebar__logo">
            <Link to="/" className="sidebar__logo-link">
              <span className="sidebar__logo-text">Cognitiv</span>
            </Link>
          </div>

          {/* Navigation */}
          <nav className="sidebar__nav">
            {navItems.map((item) => {
              const IconComponent = item.icon
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`sidebar__nav-item ${isActive(item.path) ? 'sidebar__nav-item--active' : ''}`}
                >
                  <IconComponent className="sidebar__nav-icon" strokeWidth={1.5} size={20} />
                  <span className="sidebar__nav-label">{item.label}</span>
                </Link>
              )
            })}
            {isAdmin && adminNavItems.map((item) => {
              const IconComponent = item.icon
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`sidebar__nav-item ${isActive(item.path) ? 'sidebar__nav-item--active' : ''}`}
                >
                  <IconComponent className="sidebar__nav-icon" strokeWidth={1.5} size={20} />
                  <span className="sidebar__nav-label">{item.label}</span>
                </Link>
              )
            })}
          </nav>

          {/* User Profile */}
          <div className="sidebar__footer">
            <div className="sidebar__user">
              <div className="sidebar__user-avatar">
                {username ? username.charAt(0).toUpperCase() : 'U'}
              </div>
              <div className="sidebar__user-info">
                <span className="sidebar__user-name">{username || 'Guest'}</span>
                {isAdmin && <span className="sidebar__user-role">Admin</span>}
              </div>
            </div>
            {isAdmin && (
              <button
                className="sidebar__logout"
                onClick={handleLogout}
                aria-label="Logout"
              >
                <LogOut className="sidebar__logout-icon" strokeWidth={1.5} size={20} />
              </button>
            )}
            {!isAdmin && (
              <Link to="/login" className="sidebar__login">
                <span className="sidebar__login-text">Login</span>
              </Link>
            )}
          </div>
        </div>
      </aside>

      {/* Mobile Menu Toggle Button */}
      <button
        className="sidebar__mobile-toggle"
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        aria-label="Toggle menu"
      >
        {mobileMenuOpen ? <X strokeWidth={2} size={24} /> : <Menu strokeWidth={2} size={24} />}
      </button>

      {/* Mobile Overlay */}
      {mobileMenuOpen && (
        <div
          className="sidebar__overlay"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Sidebar Drawer */}
      <aside className={`sidebar sidebar--mobile ${mobileMenuOpen ? 'sidebar--mobile-open' : ''}`}>
        <div className="sidebar__content">
          {/* Logo */}
          <div className="sidebar__logo">
            <Link to="/" className="sidebar__logo-link" onClick={() => setMobileMenuOpen(false)}>
              <span className="sidebar__logo-text">Cognitiv</span>
            </Link>
            <button
              className="sidebar__close"
              onClick={() => setMobileMenuOpen(false)}
              aria-label="Close menu"
            >
              <X strokeWidth={2} size={24} />
            </button>
          </div>

          {/* Navigation */}
          <nav className="sidebar__nav">
            {navItems.map((item) => {
              const IconComponent = item.icon
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`sidebar__nav-item ${isActive(item.path) ? 'sidebar__nav-item--active' : ''}`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <IconComponent className="sidebar__nav-icon" strokeWidth={1.5} size={20} />
                  <span className="sidebar__nav-label">{item.label}</span>
                </Link>
              )
            })}
            {isAdmin && adminNavItems.map((item) => {
              const IconComponent = item.icon
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`sidebar__nav-item ${isActive(item.path) ? 'sidebar__nav-item--active' : ''}`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <IconComponent className="sidebar__nav-icon" strokeWidth={1.5} size={20} />
                  <span className="sidebar__nav-label">{item.label}</span>
                </Link>
              )
            })}
          </nav>

          {/* User Profile */}
          <div className="sidebar__footer">
            <div className="sidebar__user">
              <div className="sidebar__user-avatar">
                {username ? username.charAt(0).toUpperCase() : 'U'}
              </div>
              <div className="sidebar__user-info">
                <span className="sidebar__user-name">{username || 'Guest'}</span>
                {isAdmin && <span className="sidebar__user-role">Admin</span>}
              </div>
            </div>
            {isAdmin && (
              <button
                className="sidebar__logout"
                onClick={handleLogout}
                aria-label="Logout"
              >
                <LogOut className="sidebar__logout-icon" strokeWidth={1.5} size={20} />
              </button>
            )}
            {!isAdmin && (
              <Link to="/login" className="sidebar__login" onClick={() => setMobileMenuOpen(false)}>
                <span className="sidebar__login-text">Login</span>
              </Link>
            )}
          </div>
        </div>
      </aside>
    </>
  )
}

export default Sidebar
