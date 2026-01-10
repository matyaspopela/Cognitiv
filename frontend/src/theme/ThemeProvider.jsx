import { createContext, useContext, useState, useEffect } from 'react'
import tokens from '../design/tokens'

const ThemeContext = createContext(null)

export const useTheme = () => {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider')
  }
  return context
}

export const ThemeProvider = ({ children, initialTheme = 'system' }) => {
  // Determine initial theme from localStorage or system preference
  const getInitialTheme = () => {
    if (typeof window === 'undefined') return 'light'
    
    // Check localStorage first
    const savedTheme = localStorage.getItem('cognitiv-theme')
    if (savedTheme && ['light', 'dark', 'system'].includes(savedTheme)) {
      return savedTheme
    }
    
    // Fall back to prop or system preference
    if (initialTheme !== 'system') {
      return initialTheme
    }
    
    // Detect system preference
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark'
    }
    
    return 'light'
  }

  const [theme, setTheme] = useState(getInitialTheme)
  const [effectiveTheme, setEffectiveTheme] = useState(() => {
    if (theme === 'system') {
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
    }
    return theme
  })

  // Apply theme to document root
  useEffect(() => {
    if (typeof document === 'undefined') return

    // Determine effective theme
    let effective = theme
    if (theme === 'system') {
      effective = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
    }

    setEffectiveTheme(effective)
    
    // Apply data-theme attribute
    document.documentElement.setAttribute('data-theme', effective)
    
    // Persist to localStorage (except for 'system')
    if (theme !== 'system') {
      localStorage.setItem('cognitiv-theme', theme)
    } else {
      localStorage.removeItem('cognitiv-theme')
    }
  }, [theme])

  // Listen for system preference changes
  useEffect(() => {
    if (typeof window === 'undefined' || theme !== 'system') return

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = (e) => {
      const newEffective = e.matches ? 'dark' : 'light'
      setEffectiveTheme(newEffective)
      document.documentElement.setAttribute('data-theme', newEffective)
    }

    // Modern browsers
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange)
      return () => mediaQuery.removeEventListener('change', handleChange)
    }
    // Fallback for older browsers
    else if (mediaQuery.addListener) {
      mediaQuery.addListener(handleChange)
      return () => mediaQuery.removeListener(handleChange)
    }
  }, [theme])

  // Theme control functions
  const updateTheme = (newTheme) => {
    if (!['light', 'dark', 'system'].includes(newTheme)) {
      console.warn(`Invalid theme: ${newTheme}. Must be 'light', 'dark', or 'system'`)
      return
    }
    setTheme(newTheme)
  }

  const toggleTheme = () => {
    if (theme === 'system') {
      // If system, toggle based on current effective theme
      updateTheme(effectiveTheme === 'dark' ? 'light' : 'dark')
    } else {
      // Toggle between light and dark
      updateTheme(theme === 'dark' ? 'light' : 'dark')
    }
  }

  const themeConfig = {
    ...tokens,
    mode: theme,
    effectiveMode: effectiveTheme,
    setTheme: updateTheme,
    toggleTheme,
  }

  return (
    <ThemeContext.Provider value={themeConfig}>
      {children}
    </ThemeContext.Provider>
  )
}

export default ThemeProvider





































