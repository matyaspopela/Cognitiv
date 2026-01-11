import Sidebar from './Sidebar'
import TopHeader from './TopHeader'
import './AppShell.css'

const AppShell = ({ children }) => {
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-shell__main">
        <TopHeader />
        <div className="app-shell__content">
          {children}
        </div>
      </div>
    </div>
  )
}

export default AppShell

