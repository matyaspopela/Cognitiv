import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import LoadingSpinner from './ui/LoadingSpinner'
import Card from './ui/Card'

const ProtectedRoute = ({ children }) => {
  const { isAdmin, loading } = useAuth()

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
        <Card style={{ padding: 'var(--md3-spacing-8)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--md3-spacing-4)' }}>
          <LoadingSpinner size="medium" />
          <p style={{ margin: 0, color: 'var(--md3-color-text-secondary)', fontSize: 'var(--md3-font-size-body-medium)' }}>
            Načítám...
          </p>
        </Card>
      </div>
    )
  }

  if (!isAdmin) {
    return <Navigate to="/login" replace />
  }

  return children
}

export default ProtectedRoute
