import './ProgressBar.css'

const ProgressBar = ({
  value = 0,
  max = 100,
  variant = 'linear',
  indeterminate = false,
  color = 'primary',
  className = '',
  ...props
}) => {
  const percentage = indeterminate ? undefined : Math.min(100, Math.max(0, (value / max) * 100))
  const colorClass = color !== 'primary' ? `md3-progress-linear__bar--${color}` : ''

  if (variant === 'circular') {
    return (
      <div className={`md3-progress-circular ${className}`} {...props}>
        <svg className="md3-progress-circular__svg" viewBox="0 0 48 48">
          {indeterminate ? (
            <circle
              className="md3-progress-circular__circle md3-progress-circular__circle--indeterminate"
              cx="24"
              cy="24"
              r="20"
              fill="none"
              strokeWidth="4"
            />
          ) : (
            <circle
              className="md3-progress-circular__circle"
              cx="24"
              cy="24"
              r="20"
              fill="none"
              strokeWidth="4"
              strokeDasharray={`${2 * Math.PI * 20}`}
              strokeDashoffset={`${2 * Math.PI * 20 * (1 - percentage / 100)}`}
            />
          )}
        </svg>
      </div>
    )
  }

  return (
    <div className={`md3-progress-linear ${className}`} {...props}>
      <div
        className={`md3-progress-linear__track ${indeterminate ? 'md3-progress-linear__track--indeterminate' : ''}`}
      >
        <div
          className={`md3-progress-linear__bar ${colorClass}`}
          style={indeterminate ? undefined : { width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}

export default ProgressBar

