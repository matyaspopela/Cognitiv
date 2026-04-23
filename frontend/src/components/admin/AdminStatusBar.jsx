import { AlertCircle, CheckCircle2 } from 'lucide-react'
import useDeviceAlerts from '../../hooks/useDeviceAlerts'

const AdminStatusBar = ({ devices }) => {
    const { summary, alerts } = useDeviceAlerts(devices)

    // Container style matches "Bleached Stone" Laboratory aesthetic
    const containerClasses = "bg-stone-50 border border-stone-200 rounded-lg p-4 sm:p-6 shadow-[0_1px_2px_rgba(0,0,0,0.05)]"

    // If no alerts, show minimalist gray box
    if (summary.totalAlerts === 0) {
        return (
            <div className={containerClasses}>
                <div className="flex items-center gap-3 text-stone-500">
                    <CheckCircle2 size={18} strokeWidth={1.5} className="text-emerald-500" />
                    <span className="text-sm font-medium">All classroom sensors reporting normally</span>
                </div>
            </div>
        )
    }

    return (
        <div className={containerClasses}>
            <div className="flex flex-col gap-4">
                <div className="flex items-center gap-2 mb-1">
                    <AlertCircle size={18} strokeWidth={1.5} className="text-amber-600" />
                    <h3 className="text-sm font-bold text-stone-900 uppercase tracking-tight">
                        {summary.totalAlerts} Active Alert{summary.totalAlerts !== 1 ? 's' : ''}
                    </h3>
                </div>

                <div className="grid gap-2">
                    {alerts.map((alert, index) => (
                        <div
                            key={`${alert.deviceId}-${index}`}
                            className="flex items-start sm:items-center justify-between gap-2 p-3 bg-white rounded-md border border-stone-200 hover:border-stone-300 transition-colors"
                        >
                            <span className="text-xs font-bold text-stone-900 uppercase tracking-tight shrink-0">
                                {alert.deviceName}
                            </span>

                            <div className="text-[10px] text-stone-500 text-right flex items-center gap-1.5 font-medium flex-wrap justify-end">
                                <span className="uppercase tracking-wider">
                                    {alert.type === 'offline' ? 'Offline' :
                                     alert.type.includes('co2') ? 'CO₂' :
                                     'Battery'}
                                </span>
                                <span className="text-stone-300">·</span>
                                <span className="text-stone-400 italic font-normal">{alert.message}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

export default AdminStatusBar
