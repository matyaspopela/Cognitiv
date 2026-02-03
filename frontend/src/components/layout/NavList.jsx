import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { LayoutDashboard, Smartphone, Settings, LineChart, Wind } from 'lucide-react'

const NavList = ({ onItemClick }) => {
  const location = useLocation()
  const { isAdmin } = useAuth()

  const navItems = [
    { path: '/', label: 'Overview', icon: LayoutDashboard },
    { path: '/ventilation', label: 'Ventilation Guide', icon: Wind },
  ]

  const adminNavItems = [
    { path: '/datalab', label: 'Export', icon: LineChart },
    { path: '/admin', label: 'Management', icon: Settings },
  ]

  const isActive = (path) => {
    if (path === '/') {
      return location.pathname === '/'
    }
    return location.pathname.startsWith(path)
  }

  const renderItem = (item) => {
    const IconComponent = item.icon
    const active = isActive(item.path)

    return (
      <Link
        key={item.path}
        to={item.path}
        onClick={onItemClick}
        className={`
          flex items-center gap-3 px-4 py-3 mx-2 rounded-xl text-sm font-medium transition-all duration-200 ease-in-out
          ${active
            ? 'bg-zinc-800 text-white shadow-md translate-x-1'
            : 'text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-200 hover:translate-x-1'
          }
        `}
      >
        <IconComponent size={20} strokeWidth={1.5} className="shrink-0" />
        <span>{item.label}</span>
      </Link>
    )
  }

  return (
    <nav className="flex flex-col gap-3 flex-1 px-2 py-4">
      {navItems.map(renderItem)}

      {isAdmin && (
        <>
          <div className="my-4 mx-4 h-px bg-white/5" />
          <div className="px-4 py-1 text-xs font-semibold uppercase tracking-wider text-zinc-600 mb-1">
            Admin
          </div>
          {adminNavItems.map(renderItem)}
        </>
      )}
    </nav>
  )
}

export default NavList
