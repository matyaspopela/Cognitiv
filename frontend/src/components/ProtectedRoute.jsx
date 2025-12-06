import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const ProtectedRoute = ({ children }) => {
  const { isAdmin, loading } = useAuth()

  if (loading) {
    return <div>Načítám...</div>
  }

  if (!isAdmin) {
    return <Navigate to="/login" replace />
  }

  return children
}

export default ProtectedRoute
