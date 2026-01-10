import './LoadingSpinner.css'

/**
 * LoadingSpinner Component
 * 
 * A polished loading spinner following Linear/Apple style.
 * Supports different sizes and can be used inline or as overlay.
 */
const LoadingSpinner = ({ 
  size = 'medium', 
  className = '',
  label = 'Loading...',
  showLabel = false 
}) => {
  return (
    <div className={`md3-loading-spinner md3-loading-spinner--${size} ${className}`} role="status" aria-label={label}>
      <div className="md3-loading-spinner__circle"></div>
      {showLabel && (
        <span className="md3-loading-spinner__label">{label}</span>
      )}
    </div>
  )
}

export default LoadingSpinner

