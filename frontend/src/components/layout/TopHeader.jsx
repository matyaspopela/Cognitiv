import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Bell } from 'lucide-react'
import './TopHeader.css'

const TopHeader = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const [searchFocused, setSearchFocused] = useState(false)
  const isMac = typeof window !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0
  const searchShortcut = isMac ? '⌘K' : 'Ctrl+K'

  // Generate breadcrumbs from path
  const getBreadcrumbs = () => {
    const path = location.pathname
    if (path === '/') {
      return [{ label: 'Dashboard', path: '/' }]
    }

    const parts = path.split('/').filter(Boolean)
    const crumbs = [{ label: 'Dashboard', path: '/' }]

    parts.forEach((part, index) => {
      const pathToPart = '/' + parts.slice(0, index + 1).join('/')
      let label = part.charAt(0).toUpperCase() + part.slice(1)

      // Map route names to display labels
      if (part === 'dashboard') label = 'Devices'
      else if (part === 'admin') label = 'Management'
      else if (part === 'datalab') label = 'Export'

      // If there's a device ID in the path, extract it
      if (path.includes('device=') || /^[A-Z0-9]+$/.test(part)) {
        const params = new URLSearchParams(location.search)
        const deviceId = params.get('device') || part
        if (deviceId && deviceId !== 'dashboard' && deviceId !== 'admin') {
          label = deviceId
        }
      }

      crumbs.push({ label, path: pathToPart })
    })

    return crumbs
  }

  const breadcrumbs = getBreadcrumbs()

  // Handle Cmd+K / Ctrl+K for search
  useEffect(() => {
    const handleKeyDown = (e) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
      const modifier = isMac ? e.metaKey : e.ctrlKey

      if (modifier && e.key === 'k') {
        e.preventDefault()
        const searchInput = document.getElementById('global-search-input')
        if (searchInput) {
          searchInput.focus()
          searchInput.select()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <header className="top-header">
      <div className="top-header__content">
        {/* Breadcrumbs */}
        <nav className="top-header__breadcrumbs" aria-label="Breadcrumb">
          {breadcrumbs.map((crumb, index) => (
            <span key={crumb.path} className="top-header__breadcrumb">
              {index > 0 && <span className="top-header__breadcrumb-separator">/</span>}
              {index === breadcrumbs.length - 1 ? (
                <span className="top-header__breadcrumb-current">{crumb.label}</span>
              ) : (
                <button
                  onClick={() => navigate(crumb.path)}
                  className="top-header__breadcrumb-link"
                >
                  {crumb.label}
                </button>
              )}
            </span>
          ))}
        </nav>

        {/* Search and Actions */}
        <div className="top-header__actions">
          {/* Global Search */}
          <div className={`top-header__search ${searchFocused ? 'top-header__search--focused' : ''}`}>
            <input
              id="global-search-input"
              type="text"
              placeholder={`Search... (${searchShortcut})`}
              className="top-header__search-input"
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.currentTarget.blur()
                  setSearchFocused(false)
                }
              }}
            />
            <span className="top-header__search-shortcut">
              {isMac ? (
                <>
                  <kbd>⌘</kbd><kbd>K</kbd>
                </>
              ) : (
                <>
                  <kbd>Ctrl</kbd><kbd>K</kbd>
                </>
              )}
            </span>
          </div>

          {/* Notification Bell */}
          <button
            className="top-header__notification"
            aria-label="Notifications"
            title="Notifications"
          >
            <Bell className="top-header__notification-icon" strokeWidth={1.5} size={20} />
          </button>
        </div>
      </div>
    </header>
  )
}

export default TopHeader
