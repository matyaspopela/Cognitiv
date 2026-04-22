import Sidebar from './Sidebar'
import PageHeader from './PageHeader'
import './AppShell.css'

const AppShell = ({ children }) => {
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-shell__main">
        <div className="app-shell__content">
          {children}
        </div>
      </div>
    </div>
  )
}

export default AppShell

