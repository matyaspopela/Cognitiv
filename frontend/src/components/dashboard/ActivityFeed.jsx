import './ActivityFeed.css'

const ActivityFeed = ({ activities = [] }) => {
  // Placeholder activities if none provided
  const defaultActivities = activities.length > 0 ? activities : [
    { id: 1, type: 'success', message: 'Device A3 connected', timestamp: '2m ago' },
    { id: 2, type: 'warning', message: 'High CO₂ detected on Device B7', timestamp: '15m ago' },
    { id: 3, type: 'info', message: 'Device C2 data sync completed', timestamp: '1h ago' },
  ]

  const getStatusColor = (type) => {
    switch (type) {
      case 'success':
        return 'rgb(34, 197, 94)' // green-500
      case 'warning':
        return 'rgb(251, 191, 36)' // amber-400
      case 'error':
        return 'rgb(239, 68, 68)' // red-500
      default:
        return 'rgb(113, 113, 122)' // zinc-500
    }
  }

  return (
    <div className="activity-feed">
      <h3 className="activity-feed__title">Recent Activity</h3>
      <div className="activity-feed__list">
        {defaultActivities.map((activity) => (
          <div key={activity.id} className="activity-feed__item">
            <div
              className="activity-feed__status-dot"
              style={{ backgroundColor: getStatusColor(activity.type) }}
            />
            <div className="activity-feed__content">
              <p className="activity-feed__message">{activity.message}</p>
              <span className="activity-feed__timestamp">{activity.timestamp}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default ActivityFeed





