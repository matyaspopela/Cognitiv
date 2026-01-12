import { useTheme } from '../../theme/ThemeProvider'
import './ThemeToggle.css'

/**
 * ThemeToggle Component
 * 
 * A polished theme toggle button following Linear/Apple design principles.
 * Features smooth icon animation, keyboard accessibility, and tooltip support.
 */
const ThemeToggle = ({ showLabel = false, className = '' }) => {
  const { effectiveMode, toggleTheme } = useTheme()

  const handleClick = () => {
    toggleTheme()
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      toggleTheme()
    }
  }

  const isDark = effectiveMode === 'dark'

  return (
    <button
      className={`md3-theme-toggle ${className} ${isDark ? 'md3-theme-toggle--dark' : ''}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-pressed={isDark}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      type="button"
    >
      <span className="md3-theme-toggle__icon-container">
        {/* Sun Icon (Light Mode) */}
        <svg
          className="md3-theme-toggle__icon md3-theme-toggle__icon--sun"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="5" />
          <line x1="12" y1="1" x2="12" y2="3" />
          <line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" />
          <line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>

        {/* Moon Icon (Dark Mode) */}
        <svg
          className="md3-theme-toggle__icon md3-theme-toggle__icon--moon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      </span>

      {showLabel && (
        <span className="md3-theme-toggle__label">
          {isDark ? 'Light' : 'Dark'}
        </span>
      )}
    </button>
  )
}

export default ThemeToggle







