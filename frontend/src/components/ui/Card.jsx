import './Card.css'

const Card = ({
  children,
  variant = 'elevated',
  elevation = 1,
  className = '',
  onClick,
  ...props
}) => {
  const baseClass = 'md3-card'
  const variantClass = `md3-card--${variant}`
  const elevationClass = `md3-card--elevation-${elevation}`
  const clickableClass = onClick ? 'md3-card--clickable' : ''

  return (
    <div
      className={`${baseClass} ${variantClass} ${elevationClass} ${clickableClass} ${className}`}
      onClick={onClick}
      {...props}
    >
      {children}
    </div>
  )
}

export default Card







