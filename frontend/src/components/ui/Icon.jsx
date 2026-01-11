import React from 'react'
import * as LucideIcons from 'lucide-react'
import './Icon.css'

/**
 * Icon Component Wrapper
 * Provides consistent icon rendering with sizing and dark mode support
 * 
 * Usage:
 * <Icon name="Bell" size="md" className="custom-class" />
 */
const Icon = ({ name, size = 'md', className = '', ...props }) => {
  const IconComponent = LucideIcons[name]
  
  if (!IconComponent) {
    console.warn(`Icon "${name}" not found in lucide-react`)
    return null
  }

  const sizeClasses = {
    sm: 'icon--small',
    md: 'icon--medium',
    lg: 'icon--large',
  }

  return (
    <IconComponent
      className={`icon ${sizeClasses[size]} ${className}`}
      strokeWidth={1.5}
      {...props}
    />
  )
}

export default Icon




