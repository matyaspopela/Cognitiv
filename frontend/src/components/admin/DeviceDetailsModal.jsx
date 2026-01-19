import Card from '../ui/Card'
import Button from '../ui/Button'
import Badge from '../ui/Badge'
import './DeviceDetailsModal.css'

const DeviceDetailsModal = ({ device, onClose }) => {
    if (!device) return null

    const formatValue = (value, unit = '') => {
        if (value == null || value === undefined || value === '') return '—'
        return `${value}${unit}`
    }

    const formatTimestamp = (timestamp) => {
        if (!timestamp || timestamp === '—') return '—'
        try {
            return new Date(timestamp).toLocaleString('cs-CZ')
        } catch {
            return timestamp
        }
    }

    const getStatusBadge = () => {
        if (device.status === 'online') {
            return <Badge variant="success">Online</Badge>
        }
        return <Badge variant="neutral">Offline</Badge>
    }

    return (
        <div className="device-details-modal-overlay" onClick={onClose}>
            <Card className="device-details-modal" elevation={3} onClick={(e) => e.stopPropagation()}>
                <div className="device-details-header">
                    <div>
                        <h2 className="device-details-title">{device.display_name || device.device_id || 'Unknown Device'}</h2>
                        <div className="device-details-subtitle">{device.mac_address || device.device_id}</div>
                    </div>
                    {getStatusBadge()}
                </div>

                <div className="device-details-content">
                    {/* Current Readings */}
                    <section className="device-details-section">
                        <h3 className="section-title">Aktuální měření</h3>
                        <div className="stats-grid">
                            <div className="stat-item">
                                <div className="stat-label">Teplota</div>
                                <div className="stat-value">
                                    {formatValue(device.current_readings?.temperature, '°C')}
                                </div>
                            </div>
                            <div className="stat-item">
                                <div className="stat-label">Vlhkost</div>
                                <div className="stat-value">
                                    {formatValue(device.current_readings?.humidity, '%')}
                                </div>
                            </div>
                            <div className="stat-item">
                                <div className="stat-label">CO₂</div>
                                <div className="stat-value">
                                    {formatValue(device.current_readings?.co2, ' ppm')}
                                </div>
                            </div>
                            <div className="stat-item">
                                <div className="stat-label">Napětí</div>
                                <div className="stat-value">
                                    {formatValue(device.current_readings?.voltage, 'V')}
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Device Information */}
                    <section className="device-details-section">
                        <h3 className="section-title">Informace o zařízení</h3>
                        <div className="info-list">
                            <div className="info-item">
                                <span className="info-label">MAC adresa:</span>
                                <span className="info-value">{device.mac_address || '—'}</span>
                            </div>
                            <div className="info-item">
                                <span className="info-label">Kód místnosti:</span>
                                <span className="info-value">{device.room_code ? device.room_code.toUpperCase() : '—'}</span>
                            </div>
                            <div className="info-item">
                                <span className="info-label">Třída:</span>
                                <span className="info-value">{device.class || '—'}</span>
                            </div>
                            <div className="info-item">
                                <span className="info-label">Celkový počet měření:</span>
                                <span className="info-value">{formatValue(device.total_data_points)}</span>
                            </div>
                            <div className="info-item">
                                <span className="info-label">Poslední měření:</span>
                                <span className="info-value">{formatTimestamp(device.last_seen)}</span>
                            </div>
                        </div>
                    </section>
                </div>

                <div className="device-details-actions">
                    <Button variant="filled" onClick={onClose}>
                        Zavřít
                    </Button>
                </div>
            </Card>
        </div>
    )
}

export default DeviceDetailsModal
