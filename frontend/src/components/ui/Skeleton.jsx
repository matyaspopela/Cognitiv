/**
 * Skeleton Loader Component
 * 
 * Modern skeleton loader with shimmer animation following Linear dark mode aesthetic.
 * Pure Tailwind implementation - no CSS modules needed.
 */
const Skeleton = ({ 
  variant = 'rectangular',
  width,
  height,
  className = '',
  rounded = true
}) => {
  const baseClasses = 'relative overflow-hidden bg-zinc-800/50 animate-pulse'
  
  const variantClasses = {
    text: 'h-4',
    circular: 'rounded-full',
    rectangular: rounded ? 'rounded-lg' : '',
    custom: ''
  }

  const style = {
    ...(width && { width: typeof width === 'number' ? `${width}px` : width }),
    ...(height && { height: typeof height === 'number' ? `${height}px` : height })
  }

  return (
    <div 
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      style={Object.keys(style).length > 0 ? style : undefined}
      aria-hidden="true"
    >
      {/* Shimmer overlay */}
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/10 to-transparent" />
    </div>
  )
}

export default Skeleton




