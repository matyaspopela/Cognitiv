import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider, useTheme } from './theme/ThemeProvider'
import ProtectedRoute from './components/ProtectedRoute'
import AppShell from './components/layout/AppShell'
import Login from './pages/Login'
import AdminPanel from './pages/AdminPanel'
import Dashboard from './pages/Dashboard'

import VentilationGuide from './pages/VentilationGuide'
import DataLabLayout from './components/DataLab/DataLabLayout'

// Component to handle global keyboard shortcuts
const KeyboardShortcuts = () => {
  const { toggleTheme } = useTheme()

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Cmd+Shift+T (Mac) or Ctrl+Shift+T (Windows/Linux) to toggle theme
      // Note: Ctrl+Shift+T is reserved by browsers for reopening closed tabs,
      // so we'll use Ctrl+Shift+U instead for Windows/Linux
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
      const modifier = isMac ? e.metaKey : e.ctrlKey

      if (modifier && e.shiftKey && (e.key === 'T' || e.key === 't' || e.key === 'U' || e.key === 'u')) {
        // Only toggle if not in an input field
        const target = e.target
        const isInput = target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable

        if (!isInput) {
          e.preventDefault()
          toggleTheme()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [toggleTheme])

  return null
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <KeyboardShortcuts />
          <div className="app">
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route
                path="/*"
                element={
                  <AppShell>
                    <div className="page-transition-wrapper">
                      <Routes>
                        <Route path="/" element={<Dashboard />} />
                        <Route path="/dashboard" element={<Dashboard />} />
                        <Route path="/datalab" element={<DataLabLayout />} />
                        <Route path="/ventilation-guide" element={<VentilationGuide />} />
                        <Route
                          path="/admin"
                          element={
                            <ProtectedRoute>
                              <AdminPanel />
                            </ProtectedRoute>
                          }
                        />
                        <Route path="*" element={<Navigate to="/" replace />} />
                      </Routes>
                    </div>
                  </AppShell>
                }
              />
            </Routes>
          </div>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App

