import { createContext, useContext, useState, useEffect } from 'react'
import { adminAPI } from '../services/api'

const AuthContext = createContext(null)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export const AuthProvider = ({ children }) => {
  const [isAdmin, setIsAdmin] = useState(false)
  const [username, setUsername] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check if user is already logged in from localStorage
    const storedAuth = localStorage.getItem('cognitiv_admin_auth')
    if (storedAuth) {
      try {
        const authData = JSON.parse(storedAuth)
        if (authData.username && authData.isAdmin) {
          setIsAdmin(true)
          setUsername(authData.username)
        }
      } catch (error) {
        console.error('Error parsing stored auth:', error)
        localStorage.removeItem('cognitiv_admin_auth')
      }
    }
    setLoading(false)
  }, [])

  const login = async (username, password) => {
    try {
      const response = await adminAPI.login(username, password)
      
      if (response.data.status === 'success') {
        setIsAdmin(true)
        setUsername(username)
        localStorage.setItem('cognitiv_admin_auth', JSON.stringify({
          username,
          isAdmin: true
        }))
        return { success: true }
      } else {
        return { success: false, error: response.data.message || 'Přihlášení selhalo' }
      }
    } catch (error) {
      console.error('Login error:', error)
      return { 
        success: false, 
        error: error.response?.data?.message || 'Chyba při přihlašování' 
      }
    }
  }

  const logout = async () => {
    setIsAdmin(false)
    setUsername(null)
    localStorage.removeItem('cognitiv_admin_auth')
  }

  const value = {
    isAdmin,
    username,
    loading,
    login,
    logout
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
