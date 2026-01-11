import './MetricCard.css'

const MetricCard = ({ label, value, trend, sparkline, className = '' }) => {
  return (
    <div className={`metric-card ${className}`}>
      <div className="metric-card__label">{label}</div>
      <div className="metric-card__value">{value}</div>
      {trend && (
        <div className={`metric-card__trend metric-card__trend--${trend.direction}`}>
          {trend.icon && <span className="metric-card__trend-icon">{trend.icon}</span>}
          {trend.value && <span className="metric-card__trend-value">{trend.value}</span>}
        </div>
      )}
      {sparkline && (
        <div className="metric-card__sparkline">
          {sparkline}
        </div>
      )}
    </div>
  )
}

export default MetricCard
