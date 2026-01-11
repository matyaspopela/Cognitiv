import React from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import './QuickActionCard.css'

/**
 * QuickActionCard Component
 * Compact navigation card with icon, title, description, and arrow indicator
 * 
 * Usage:
 * <QuickActionCard
 *   to="/dashboard"
 *   icon={LayoutDashboard}
 *   title="Dashboard"
 *   description="View all devices and metrics"
 * />
 */
const QuickActionCard = ({ to, icon: Icon, title, description, onClick }) => {
  const content = (
    <div className="quick-action-card">
      <div className="quick-action-card__icon">
        {Icon && <Icon className="quick-action-card__icon-svg" strokeWidth={1.5} />}
      </div>
      <div className="quick-action-card__content">
        <h3 className="quick-action-card__title">{title}</h3>
        {description && (
          <p className="quick-action-card__description">{description}</p>
        )}
      </div>
      <div className="quick-action-card__arrow">
        <ArrowRight className="quick-action-card__arrow-svg" strokeWidth={2} />
      </div>
    </div>
  )

  if (onClick) {
    return (
      <button
        className="quick-action-card__button"
        onClick={onClick}
        type="button"
      >
        {content}
      </button>
    )
  }

  return (
    <Link to={to} className="quick-action-card__link">
      {content}
    </Link>
  )
}

export default QuickActionCard




