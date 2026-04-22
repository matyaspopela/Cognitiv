import React from 'react';

/**
 * Card - Minimalist high-density container component (Bleached Stone)
 * Enforces 8px radius, 1px Stone-200 border, and white surface background.
 * 
 * @param {React.ReactNode} children - Card content
 * @param {string} [className] - Additional CSS classes
 * @param {function} [onClick] - Click handler
 */
const Card = ({ 
  children, 
  className = '', 
  onClick, 
  // Destructure legacy props to prevent them from being passed to the div
  variant,
  elevation,
  ...props 
}) => {
  return (
    <div
      className={`
        bg-surface 
        border border-border-subtle 
        rounded-[8px] 
        p-6
        transition-all 
        duration-200
        ${onClick ? 'cursor-pointer hover:border-stone-300 hover:bg-stone-50/50 active:bg-stone-100' : ''} 
        ${className}
      `}
      onClick={onClick}
      {...props}
    >
      {children}
    </div>
  );
};

export default Card;
