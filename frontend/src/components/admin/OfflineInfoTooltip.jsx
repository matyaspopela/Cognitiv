import './OfflineInfoTooltip.css'

/**
 * OfflineInfoTooltip Component
 * Wraps a badge and shows tooltip with last seen timestamp
 * and total data points when hovering over badge (especially for offline devices)
 */
const OfflineInfoTooltip = ({ lastSeen, totalDataPoints, isOffline, children }) => {
  const formatLastSeen = (timestamp) => {
    if (!timestamp || timestamp === 'Nikdy') return 'Nikdy'
    try {
      // Handle ISO 8601 format with timezone (e.g., "2025-11-12T20:32:48+01:00")
      let date
      if (typeof timestamp === 'string' && timestamp.includes('T')) {
        // Try parsing as-is first
        date = new Date(timestamp)
        // If that fails and has timezone offset, try without timezone
        if (isNaN(date.getTime()) && timestamp.match(/[+-]\d{2}:\d{2}$/)) {
          const withoutTz = timestamp.replace(/[+-]\d{2}:\d{2}$/, '')
          date = new Date(withoutTz)
        }
      } else {
        date = new Date(timestamp)
      }
      
      if (isNaN(date.getTime())) return timestamp
      
      return date.toLocaleString('cs-CZ', {
        dateStyle: 'medium',
        timeStyle: 'short'
      })
    } catch {
      return timestamp
    }
  }

  const formatDataPoints = (count) => {
    if (!count && count !== 0) return '--'
    return count.toLocaleString('cs-CZ')
  }

  // Show tooltip for offline devices or if we have info to show
  const showTooltip = isOffline && (lastSeen || totalDataPoints !== undefined)

  if (!showTooltip) {
    return <>{children}</>
  }

  return (
    <div className="offline-info-tooltip">
      <div className="offline-info-tooltip__trigger">
        {children}
      </div>
      <div className="offline-info-tooltip__content">
        <div className="offline-info-tooltip__item">
          <span className="offline-info-tooltip__label">Naposledy viděno:</span>
          <span className="offline-info-tooltip__value">{formatLastSeen(lastSeen)}</span>
        </div>
        <div className="offline-info-tooltip__item">
          <span className="offline-info-tooltip__label">Celkem datových bodů:</span>
          <span className="offline-info-tooltip__value">{formatDataPoints(totalDataPoints)}</span>
        </div>
      </div>
    </div>
  )
}

export default OfflineInfoTooltip

