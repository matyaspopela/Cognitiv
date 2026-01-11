/**
 * ProgressBar Component
 * 
 * Modern progress bar with skeleton shimmer for indeterminate state.
 * Pure Tailwind implementation - no CSS modules needed.
 */
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

  const colorClasses = {
    primary: 'bg-blue-400',
    success: 'bg-emerald-500',
    warning: 'bg-amber-400',
    error: 'bg-red-500'
  }

  if (variant === 'circular') {
    const radius = 20
    const circumference = 2 * Math.PI * radius
    const strokeDashoffset = indeterminate 
      ? undefined 
      : circumference - (percentage / 100) * circumference

    // Generate unique ID for gradient to avoid conflicts
    const gradientId = `progress-gradient-${Math.random().toString(36).substr(2, 9)}`

    return (
      <div className={`inline-block w-12 h-12 ${className}`} {...props}>
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 48 48">
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#60a5fa" />
              <stop offset="100%" stopColor="#3b82f6" />
            </linearGradient>
          </defs>
          <circle
            cx="24"
            cy="24"
            r={radius}
            fill="none"
            strokeWidth="4"
            stroke="rgba(255, 255, 255, 0.1)"
            className="transition-colors duration-300"
          />
          <circle
            cx="24"
            cy="24"
            r={radius}
            fill="none"
            strokeWidth="4"
            stroke={indeterminate ? `url(#${gradientId})` : colorClasses[color]}
            strokeLinecap="round"
            strokeDasharray={indeterminate ? '40' : circumference}
            strokeDashoffset={strokeDashoffset}
            style={indeterminate ? {
              animation: 'circular-progress-indeterminate 1.4s cubic-bezier(0.4, 0, 0.2, 1) infinite'
            } : {}}
            className={indeterminate ? '' : 'transition-all duration-300 ease-out'}
          />
        </svg>
      </div>
    )
  }

  // Linear progress bar
  return (
    <div className={`w-full h-1.5 ${className}`} {...props}>
      <div className="relative w-full h-full bg-zinc-800/50 rounded-full overflow-hidden">
        {indeterminate ? (
          // Indeterminate: skeleton shimmer effect
          <div className="absolute inset-0">
            <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-blue-400/30 to-transparent" 
              style={{ width: '40%' }} />
          </div>
        ) : (
          // Determinate: percentage-based bar
          <div
            className={`h-full rounded-full transition-all duration-300 ease-out ${colorClasses[color]}`}
            style={{ width: `${percentage}%` }}
          />
        )}
      </div>
    </div>
  )
}

export default ProgressBar
