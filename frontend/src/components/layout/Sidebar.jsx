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
    <div className="flex flex-col h-full py-6 px-4 gap-8">
      {/* Logo */}
      <div className="px-2">
        <Link to="/" className="flex items-center" onClick={onClose}>
          <span className="text-xl font-semibold tracking-tight text-stone-900">
            Cognitiv
          </span>
        </Link>
      </div>

      {/* Navigation */}
      <NavList onItemClick={onClose} />

      {/* User Profile */}
      <div className="mt-auto px-2 pt-4 border-t border-stone-200 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-8 h-8 rounded-full bg-stone-100 border border-stone-200 flex items-center justify-center text-xs font-semibold text-stone-600 shrink-0">
            {username ? username.charAt(0).toUpperCase() : 'U'}
          </div>
          <div className="flex flex-col min-w-0 flex-1">
            <span className="text-xs font-medium text-stone-900 truncate">
              {username || 'Guest'}
            </span>
            {isAdmin && (
              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
                Admin
              </span>
            )}
          </div>
        </div>
        
        {isAdmin ? (
          <button
            onClick={handleLogout}
            className="p-1.5 rounded-md hover:bg-stone-100 text-stone-400 hover:text-stone-600 transition-colors"
            aria-label="Logout"
          >
            <LogOut size={18} strokeWidth={1.5} />
          </button>
        ) : (
          <Link 
            to="/login"
            onClick={onClose}
            className="text-xs font-medium text-stone-500 hover:text-stone-900 transition-colors"
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
      <aside className="hidden md:flex fixed left-0 top-0 bottom-0 w-[200px] bg-[var(--surface)] border-r border-[var(--border-subtle)] flex-col z-40 overflow-y-auto">
        <SidebarContent />
      </aside>

      {/* Mobile Menu Toggle Button */}
      <button
        className="md:hidden fixed top-4 left-4 z-50 w-10 h-10 rounded-md bg-white border border-stone-200 text-stone-600 flex items-center justify-center shadow-sm"
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        aria-label="Toggle menu"
      >
        {mobileMenuOpen ? <X size={20} strokeWidth={2} /> : <Menu size={20} strokeWidth={2} />}
      </button>

      {/* Mobile Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-stone-900/20 z-30 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Sidebar Drawer */}
      <aside 
        className={`
          md:hidden fixed inset-y-0 left-0 w-64 bg-white border-r border-stone-200 z-40 transform transition-transform duration-250 ease-in-out
          ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {mobileMenuOpen && (
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="absolute top-4 right-4 p-1.5 rounded-md hover:bg-stone-100 text-stone-400 hover:text-stone-600 transition-colors"
            aria-label="Close menu"
          >
            <X size={18} strokeWidth={2} />
          </button>
        )}
        <SidebarContent onClose={() => setMobileMenuOpen(false)} />
      </aside>
    </>
  )
}

export default Sidebar