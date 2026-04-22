import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { LayoutDashboard, Smartphone, Settings, Wind } from 'lucide-react'

const NavList = ({ onItemClick }) => {
  const location = useLocation()
  const { isAdmin } = useAuth()

  const navItems = [
    { path: '/', label: 'Overview', icon: LayoutDashboard },
    { path: '/ventilation', label: 'Ventilation Guide', icon: Wind },
  ]

  const adminNavItems = [
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
          group relative flex items-center gap-3 px-3 py-2 rounded-md text-xs font-medium transition-colors
          ${active
            ? 'bg-stone-100 text-stone-900'
            : 'text-stone-500 hover:bg-stone-50/50 hover:text-stone-700'
          }
        `}
      >
        <IconComponent size={16} strokeWidth={active ? 2 : 1.5} className="shrink-0" />
        <span className="flex-1">{item.label}</span>
        
        {active && (
          <span className="absolute right-2 w-1 h-1 rounded-full bg-amber-600 shadow-[0_0_8px_rgba(217,119,6,0.4)]" />
        )}
      </Link>
    )
  }

  return (
    <nav className="flex flex-col gap-1 flex-1">
      {navItems.map(renderItem)}

      {isAdmin && (
        <>
          <div className="my-4 mx-2 h-px bg-stone-100" />
          <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1">
            System
          </div>
          {adminNavItems.map(renderItem)}
        </>
      )}
    </nav>
  )
}

export default NavList
