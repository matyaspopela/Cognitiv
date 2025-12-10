import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import './Navigation.css'

const Navigation = ({ isAdmin, username, onLogout }) => {
  const location = useLocation()
  const navigate = useNavigate()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const handleLogout = async () => {
    await onLogout()
    navigate('/')
    setMobileMenuOpen(false)
  }

  const navItems = [
    { path: '/', label: 'Domů' },
    { path: '/dashboard', label: 'Přehled' },
    { path: '/connect', label: 'Připojit' },
  ]

  const isActive = (path) => {
    if (path === '/') {
      return location.pathname === '/'
    }
    return location.pathname.startsWith(path)
  }

  return (
    <>
      {/* App Bar */}
      <header className="md3-app-bar">
        <div className="md3-app-bar__container">
          <Link to="/" className="md3-app-bar__title">
            <span className="md3-app-bar__text">Cognitiv</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="md3-app-bar__nav md3-app-bar__nav--desktop">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`md3-app-bar__nav-item ${isActive(item.path) ? 'md3-app-bar__nav-item--active' : ''}`}
              >
                <span className="md3-app-bar__nav-label">{item.label}</span>
              </Link>
            ))}
          </nav>

          {/* User Actions */}
          <div className="md3-app-bar__actions">
            {isAdmin ? (
              <>
                <Link
                  to="/admin"
                  className={`md3-app-bar__action ${location.pathname === '/admin' ? 'md3-app-bar__action--active' : ''}`}
                >
                  <span className="md3-app-bar__action-label">Admin</span>
                </Link>
                <button
                  className="md3-app-bar__action"
                  onClick={handleLogout}
                  aria-label="Odhlásit se"
                >
                  <span className="md3-app-bar__action-label">Odhlásit</span>
                </button>
              </>
            ) : (
              <Link
                to="/login"
                className={`md3-app-bar__action ${location.pathname === '/login' ? 'md3-app-bar__action--active' : ''}`}
              >
                <span className="md3-app-bar__action-label">Přihlásit</span>
              </Link>
            )}

            {/* Mobile Menu Toggle */}
            <button
              className="md3-app-bar__menu-toggle"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Menu"
            >
              {mobileMenuOpen ? '✕' : '☰'}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div
          className="md3-nav-drawer"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div
            className="md3-nav-drawer__content"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="md3-nav-drawer__header">
              <h2>Menu</h2>
              <button
                className="md3-nav-drawer__close"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Zavřít menu"
              >
                ✕
              </button>
            </div>
            <nav className="md3-nav-drawer__nav">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`md3-nav-drawer__item ${isActive(item.path) ? 'md3-nav-drawer__item--active' : ''}`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <span>{item.label}</span>
                </Link>
              ))}
              {isAdmin && (
                <Link
                  to="/admin"
                  className={`md3-nav-drawer__item ${location.pathname === '/admin' ? 'md3-nav-drawer__item--active' : ''}`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <span>Admin Panel</span>
                </Link>
              )}
            </nav>
          </div>
        </div>
      )}

      {/* Bottom Navigation (Mobile) */}
      <nav className="md3-bottom-nav">
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`md3-bottom-nav__item ${isActive(item.path) ? 'md3-bottom-nav__item--active' : ''}`}
          >
            <span className="md3-bottom-nav__label">{item.label}</span>
          </Link>
        ))}
      </nav>
    </>
  )
}

export default Navigation

