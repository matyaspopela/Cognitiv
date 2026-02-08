import { Settings } from 'lucide-react'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import useDeviceAlerts from '../../hooks/useDeviceAlerts'

const AdminDeviceHeader = ({ device, onSettingsClick }) => {
    // Note: useDeviceAlerts is no longer needed since we removed badges
    // const { alerts } = useDeviceAlerts(device ? [device] : [])

    if (!device) {
        return (
            <div className="bg-zinc-900/50 border border-white/10 rounded-lg p-6">
                <div className="text-zinc-400">Loading device information...</div>
            </div>
        )
    }

    const deviceName = device.display_name || device.device_id || device.mac_address || 'Unknown Device'

    return (
        <div className="bg-zinc-900/50 border border-white/10 rounded-lg p-6">
            <div className="flex items-center justify-between gap-4 mb-4">
                <div className="flex-1">
                    <h1 className="text-xl font-semibold tracking-tight text-zinc-100 mb-1">
                        {deviceName}
                    </h1>
                </div>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onSettingsClick}
                    className="text-zinc-400 hover:text-zinc-100"
                    title="Settings"
                >
                    <Settings size={20} />
                </Button>
            </div>

            {/* Live Stats Strip */}
            <div className="flex flex-wrap items-center gap-3">
                {device.current_readings?.co2 != null && (
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-zinc-500">CO₂:</span>
                        <span className="text-sm font-medium text-zinc-200">
                            {Math.round(device.current_readings.co2)} ppm
                        </span>
                    </div>
                )}
                {device.current_readings?.temperature != null && (
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-zinc-500">Temp:</span>
                        <span className="text-sm font-medium text-zinc-200">
                            {Math.round(device.current_readings.temperature)}°C
                        </span>
                    </div>
                )}
                {device.current_readings?.humidity != null && (
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-zinc-500">Humidity:</span>
                        <span className="text-sm font-medium text-zinc-200">
                            {Math.round(device.current_readings.humidity)}%
                        </span>
                    </div>
                )}
                {device.current_readings?.voltage != null && (
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-zinc-500">Voltage:</span>
                        <span className="text-sm font-medium text-zinc-200">
                            {device.current_readings.voltage.toFixed(2)}V
                        </span>
                    </div>
                )}
                {device.last_seen && (
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-zinc-500">Last Seen:</span>
                        <span className="text-sm font-medium text-zinc-200">
                            {new Date(device.last_seen).toLocaleString()}
                        </span>
                    </div>
                )}
            </div>
        </div>
    )
}

export default AdminDeviceHeader
