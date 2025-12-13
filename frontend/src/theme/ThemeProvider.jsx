import { createContext, useContext } from 'react'
import tokens from '../design/tokens'

const ThemeContext = createContext(null)

export const useTheme = () => {
  const context = useContext(ThemeContext)
  if (!context) {
    return tokens // Return default tokens if no provider
  }
  return context
}

export const ThemeProvider = ({ children, theme = 'light' }) => {
  const themeConfig = {
    ...tokens,
    mode: theme,
    // Apply theme-specific overrides here if needed
  }

  return (
    <ThemeContext.Provider value={themeConfig}>
      {children}
    </ThemeContext.Provider>
  )
}

export default ThemeProvider


















