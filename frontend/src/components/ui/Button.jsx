import { forwardRef } from 'react'
import './Button.css'

const Button = forwardRef(({
  children,
  variant = 'filled',
  size = 'medium',
  color = 'primary',
  disabled = false,
  onClick,
  type = 'button',
  component,
  className = '',
  ...props
}, ref) => {
  const baseClass = 'md3-button'
  const variantClass = `md3-button--${variant}`
  const sizeClass = `md3-button--${size}`
  const colorClass = `md3-button--${color}`
  const disabledClass = disabled ? 'md3-button--disabled' : ''

  const classes = `${baseClass} ${variantClass} ${sizeClass} ${colorClass} ${disabledClass} ${className}`
  const content = (
    <>
      <span className="md3-button__ripple"></span>
      <span className="md3-button__content">{children}</span>
    </>
  )

  if (component) {
    const Component = component
    return (
      <Component
        ref={ref}
        className={classes}
        onClick={onClick}
        disabled={disabled}
        {...props}
      >
        {content}
      </Component>
    )
  }

  return (
    <button
      ref={ref}
      type={type}
      className={classes}
      onClick={onClick}
      disabled={disabled}
      {...props}
    >
      {content}
    </button>
  )
})

Button.displayName = 'Button'

export default Button

