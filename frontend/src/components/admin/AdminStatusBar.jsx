import { Share2, CheckCircle2 } from 'lucide-react'
import useDeviceAlerts from '../../hooks/useDeviceAlerts'

const AdminStatusBar = ({ devices }) => {
    const { summary, alerts } = useDeviceAlerts(devices)

    // Container style matches the previous header's "gray box"
    const containerClasses = "bg-zinc-900/50 border border-white/10 rounded-lg p-6 mb-6"

    // If no alerts, show minimalist gray box
    if (summary.totalAlerts === 0) {
        return (
            <div className={containerClasses}>
                <div className="flex items-center gap-3 text-zinc-500">
                    <CheckCircle2 size={20} className="text-zinc-600" />
                    <span className="text-sm font-medium">All systems normal</span>
                </div>
            </div>
        )
    }

    return (
        <div className={containerClasses}>
            <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-sm font-medium text-zinc-400">
                        {summary.totalAlerts} Active Alert{summary.totalAlerts !== 1 ? 's' : ''}
                    </h3>
                </div>

                <div className="grid gap-2">
                    {alerts.map((alert, index) => (
                        <div
                            key={`${alert.deviceId}-${index}`}
                            className="flex items-center justify-between p-3 bg-white/5 rounded-md border border-white/5 hover:bg-white/10 transition-colors"
                        >
                            <span className="text-sm font-medium text-zinc-300">
                                {alert.deviceName}
                            </span>

                            <div className="text-sm text-zinc-400 text-right flex items-center gap-2">
                                {alert.type === 'offline' && (
                                    <span>Offline</span>
                                )}
                                {(alert.type === 'co2_critical' || alert.type === 'co2_low') && (
                                    <span>CO₂ Issue</span>
                                )}
                                {alert.type === 'voltage_low' && (
                                    <span>Low Battery</span>
                                )}
                                <span className="text-zinc-700">|</span>
                                <span className="text-zinc-500">{alert.message}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

export default AdminStatusBar
