import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { LogOut, Menu, X } from 'lucide-react'
import NavList from './NavList'

const Sidebar = () => {
  const navigate = useNavigate()
  const { isAdmin, username, logout } = useAuth()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const handleLogout = async () => {
    await logout()
    navigate('/')
    setMobileMenuOpen(false)
  }

  const SidebarContent = ({ onClose }) => (
    <div className="flex flex-col h-full p-4 gap-6">
      {/* Logo */}
      <div className="flex items-center justify-between pb-2 border-b border-white/5 mb-2">
        <Link to="/" className="flex items-center" onClick={onClose}>
          <span className="text-lg font-semibold tracking-tight text-zinc-100 font-sans">
            Cognitiv
          </span>
        </Link>
        {onClose && (
           <button
            onClick={onClose}
            className="md:hidden p-1 rounded-md hover:bg-white/5 text-zinc-400 hover:text-zinc-100 transition-colors"
            aria-label="Close menu"
          >
            <X size={20} strokeWidth={2} />
          </button>
        )}
      </div>

      {/* Navigation */}
      <NavList onItemClick={onClose} />

      {/* User Profile */}
      <div className="mt-auto pt-4 border-t border-white/5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-sm font-semibold text-zinc-100 shrink-0">
            {username ? username.charAt(0).toUpperCase() : 'U'}
          </div>
          <div className="flex flex-col min-w-0 flex-1">
            <span className="text-sm font-medium text-zinc-100 truncate">
              {username || 'Guest'}
            </span>
            {isAdmin && (
              <span className="text-[11px] uppercase tracking-wider text-zinc-500">
                Admin
              </span>
            )}
          </div>
        </div>
        
        {isAdmin ? (
          <button
            onClick={handleLogout}
            className="p-2 rounded-md hover:bg-white/5 text-zinc-500 hover:text-zinc-100 transition-colors"
            aria-label="Logout"
          >
            <LogOut size={20} strokeWidth={1.5} />
          </button>
        ) : (
          <Link 
            to="/login"
            onClick={onClose}
            className="text-sm text-zinc-500 hover:text-zinc-100 transition-colors"
          >
            Login
          </Link>
        )}
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex fixed left-0 top-0 bottom-0 w-60 bg-zinc-900/80 backdrop-blur-md border-r border-white/5 flex-col z-40 overflow-y-auto">
        <SidebarContent />
      </aside>

      {/* Mobile Menu Toggle Button */}
      <button
        className="md:hidden fixed top-4 left-4 z-50 w-10 h-10 rounded-md bg-zinc-900/80 backdrop-blur-md border border-white/10 text-zinc-100 flex items-center justify-center shadow-lg"
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        aria-label="Toggle menu"
      >
        {mobileMenuOpen ? <X size={20} strokeWidth={2} /> : <Menu size={20} strokeWidth={2} />}
      </button>

      {/* Mobile Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 backdrop-blur-[2px] md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Sidebar Drawer */}
      <aside 
        className={`
          md:hidden fixed inset-y-0 left-0 w-64 bg-zinc-900 border-r border-white/10 z-40 transform transition-transform duration-250 ease-in-out
          ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <SidebarContent onClose={() => setMobileMenuOpen(false)} />
      </aside>
    </>
  )
}

export default Sidebar