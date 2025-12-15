import { useEffect, useState } from 'react'
import './Snackbar.css'

const Snackbar = ({
  message,
  open = false,
  onClose,
  action,
  actionLabel,
  duration = 4000,
  variant = 'standard',
  className = '',
  ...props
}) => {
  const [isVisible, setIsVisible] = useState(open)

  useEffect(() => {
    setIsVisible(open)
    if (open && duration > 0) {
      const timer = setTimeout(() => {
        setIsVisible(false)
        if (onClose) {
          setTimeout(onClose, 300) // Wait for animation
        }
      }, duration)
      return () => clearTimeout(timer)
    }
  }, [open, duration, onClose])

  if (!open && !isVisible) return null

  return (
    <div
      className={`md3-snackbar ${isVisible ? 'md3-snackbar--open' : ''} md3-snackbar--${variant} ${className}`}
      {...props}
    >
      <div className="md3-snackbar__content">
        <span className="md3-snackbar__message">{message}</span>
        {action && actionLabel && (
          <button
            className="md3-snackbar__action"
            onClick={() => {
              action()
              setIsVisible(false)
              if (onClose) setTimeout(onClose, 300)
            }}
          >
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  )
}

export default Snackbar





















