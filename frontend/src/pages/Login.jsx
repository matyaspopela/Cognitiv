import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import TextField from '../components/ui/TextField'
import Snackbar from '../components/ui/Snackbar'
import './Login.css'

const Login = () => {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login, isAdmin } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (isAdmin) {
      navigate('/admin', { replace: true })
    }
  }, [isAdmin, navigate])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const result = await login(username, password)
    setLoading(false)

    if (result.success) {
      navigate('/admin', { replace: true })
    } else {
      setError(result.error || 'Login failed')
    }
  }

  return (
    <div className="login-page">
      <div className="login-page__container">
        <Card className="login-page__card" elevation={3}>
          <div className="login-page__header">
            <h1 className="login-page__title">Cognitiv Admin</h1>
            <p className="login-page__subtitle">Sign in to access the admin panel</p>
          </div>
          
          <form onSubmit={handleSubmit} className="login-page__form">
            <TextField
              label="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="username"
              disabled={loading}
              fullWidth
            />

            <TextField
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              disabled={loading}
              fullWidth
            />

            <Button
              type="submit"
              variant="filled"
              size="large"
              disabled={loading}
              className="login-page__submit"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </Button>
          </form>

          <div className="login-page__footer">
            <a href="/">Back to main page</a>
          </div>
        </Card>
      </div>

      <Snackbar
        message={error}
        open={!!error}
        onClose={() => setError('')}
        variant="error"
        duration={5000}
      />
    </div>
  )
}

export default Login

