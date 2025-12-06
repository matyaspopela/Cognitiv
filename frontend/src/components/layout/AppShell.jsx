import { useAuth } from '../../context/AuthContext'
import Navigation from './Navigation'
import './AppShell.css'

const AppShell = ({ children }) => {
  const { isAdmin, username, logout } = useAuth()

  return (
    <div className="md3-app-shell">
      <Navigation isAdmin={isAdmin} username={username} onLogout={logout} />
      <main className="md3-app-shell__main">
        {children}
      </main>
    </div>
  )
}

export default AppShell

