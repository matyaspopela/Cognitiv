import { useLocation, useNavigate } from 'react-router-dom'
import './TopHeader.css'

const TopHeader = () => {
  const location = useLocation()
  const navigate = useNavigate()
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


      </div>
    </header>
  )
}

export default TopHeader
