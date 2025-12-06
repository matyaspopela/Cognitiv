import './Badge.css'

const Badge = ({
  children,
  variant = 'standard',
  color = 'primary',
  className = '',
  ...props
}) => {
  const baseClass = 'md3-badge'
  const variantClass = `md3-badge--${variant}`
  const colorClass = `md3-badge--${color}`

  return (
    <span
      className={`${baseClass} ${variantClass} ${colorClass} ${className}`}
      {...props}
    >
      {children}
    </span>
  )
}

export default Badge

