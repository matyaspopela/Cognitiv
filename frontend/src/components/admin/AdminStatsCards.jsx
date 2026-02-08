import Card from '../ui/Card'
import './AdminStatsCards.css'

const safeValue = (value) => {
    if (value === undefined || value === null || Number.isNaN(value)) return '—'
    return typeof value === 'number' ? Math.round(value) : value
}

const AdminStatsCards = ({ summary }) => {
    if (!summary) {
        return (
            <div className="admin-stats-cards">
                <Card className="admin-stats-card" elevation={1}>
                    <div className="admin-stats-card__label">No data available</div>
                </Card>
            </div>
        )
    }

    return (
        <div className="admin-stats-cards">
            <Card className="admin-stats-card" elevation={1}>
                <div className="admin-stats-card__label">CO₂ (ppm)</div>
                <div className="admin-stats-card__value">{safeValue(summary.co2?.avg)}</div>
                <div className="admin-stats-card__footer">
                    Min {safeValue(summary.co2?.min)} · Max {safeValue(summary.co2?.max)}
                </div>
            </Card>

            <Card className="admin-stats-card" elevation={1}>
                <div className="admin-stats-card__label">Temperature (°C)</div>
                <div className="admin-stats-card__value">{safeValue(summary.temperature?.avg)}</div>
                <div className="admin-stats-card__footer">
                    Min {safeValue(summary.temperature?.min)} · Max {safeValue(summary.temperature?.max)}
                </div>
            </Card>

            <Card className="admin-stats-card" elevation={1}>
                <div className="admin-stats-card__label">Humidity (%)</div>
                <div className="admin-stats-card__value">{safeValue(summary.humidity?.avg)}</div>
                <div className="admin-stats-card__footer">
                    Min {safeValue(summary.humidity?.min)} · Max {safeValue(summary.humidity?.max)}
                </div>
            </Card>

            <Card className="admin-stats-card" elevation={1}>
                <div className="admin-stats-card__label">Samples</div>
                <div className="admin-stats-card__value">{safeValue(summary.samples)}</div>
                <div className="admin-stats-card__footer">
                    {summary.range?.data_start ? new Date(summary.range.data_start).toLocaleDateString() : '—'}
                </div>
            </Card>
        </div>
    )
}

export default AdminStatsCards
