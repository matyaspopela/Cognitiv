import Skeleton from './Skeleton'

/**
 * LoadingSpinner Component
 * 
 * Modern loading spinner using skeleton loaders with pulsing dots pattern.
 * Pure Tailwind implementation - no CSS modules needed.
 */
const LoadingSpinner = ({ 
  size = 'medium', 
  className = '',
  label = 'Loading...',
  showLabel = false 
}) => {
  const sizeClasses = {
    small: 'w-4 h-4',
    medium: 'w-10 h-10',
    large: 'w-14 h-14'
  }

  return (
    <div 
      className={`flex flex-col items-center justify-center gap-3 ${className}`}
      role="status" 
      aria-label={label}
    >
      {/* Pulsing dots animation */}
      <div className={`flex items-center justify-center gap-1.5 ${sizeClasses[size]}`}>
        <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" style={{ animationDelay: '0ms', animationDuration: '1.4s' }} />
        <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" style={{ animationDelay: '200ms', animationDuration: '1.4s' }} />
        <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" style={{ animationDelay: '400ms', animationDuration: '1.4s' }} />
      </div>
      {showLabel && (
        <span className="text-sm text-zinc-500 font-sans">{label}</span>
      )}
    </div>
  )
}

export default LoadingSpinner
