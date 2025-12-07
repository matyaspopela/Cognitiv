import './Chip.css'

const Chip = ({
  children,
  variant = 'filter',
  selected = false,
  onClick,
  onDelete,
  disabled = false,
  className = '',
  ...props
}) => {
  const baseClass = 'md3-chip'
  const variantClass = `md3-chip--${variant}`
  const selectedClass = selected ? 'md3-chip--selected' : ''
  const disabledClass = disabled ? 'md3-chip--disabled' : ''
  const clickableClass = onClick ? 'md3-chip--clickable' : ''

  return (
    <div
      className={`${baseClass} ${variantClass} ${selectedClass} ${disabledClass} ${clickableClass} ${className}`}
      onClick={disabled ? undefined : onClick}
      {...props}
    >
      <span className="md3-chip__content">{children}</span>
      {onDelete && !disabled && (
        <button
          className="md3-chip__delete"
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          aria-label="Delete"
        >
          ×
        </button>
      )}
    </div>
  )
}

export default Chip






