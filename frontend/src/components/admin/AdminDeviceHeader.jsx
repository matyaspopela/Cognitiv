import { Settings } from 'lucide-react'
import Button from '../ui/Button'

const AdminDeviceHeader = ({ device, onSettingsClick }) => {
    if (!device) {
        return (
            <div className="bg-stone-50 border border-stone-200 rounded-lg p-6">
                <div className="text-stone-400 font-bold uppercase tracking-widest text-[10px]">
                  Loading Registry Data...
                </div>
            </div>
        )
    }

    const deviceName = device.display_name || device.device_id || device.mac_address || 'Unknown Device'

    return (
        <div className="bg-stone-50 border border-stone-200 rounded-lg p-6 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
            <div className="flex items-center justify-between gap-4 mb-6">
                <div className="flex-1">
                    <h1 className="text-xl font-bold tracking-tight text-stone-900">
                        {deviceName}
                    </h1>
                </div>
                <Button
                    variant="outline"
                    size="icon"
                    onClick={onSettingsClick}
                    className="border-stone-200 text-stone-400 hover:text-stone-900 hover:border-stone-300"
                    title="Device Settings"
                >
                    <Settings size={18} strokeWidth={1.5} />
                </Button>
            </div>

            {/* Live Stats Strip */}
            <div className="flex flex-wrap items-center gap-6">
                {device.current_readings?.co2 != null && (
                    <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">CO₂</span>
                        <span className="text-sm font-data font-bold text-stone-900">
                            {Math.round(device.current_readings.co2)} PPM
                        </span>
                    </div>
                )}
                {device.current_readings?.temperature != null && (
                    <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">TEMP</span>
                        <span className="text-sm font-data font-bold text-stone-900">
                            {device.current_readings.temperature.toFixed(1)}°C
                        </span>
                    </div>
                )}
                {device.current_readings?.humidity != null && (
                    <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">HUMIDITY</span>
                        <span className="text-sm font-data font-bold text-stone-900">
                            {Math.round(device.current_readings.humidity)}%
                        </span>
                    </div>
                )}
                {device.current_readings?.voltage != null && (
                    <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">BATTERY</span>
                        <span className="text-sm font-data font-bold text-stone-900">
                            {device.current_readings.voltage.toFixed(2)}V
                        </span>
                    </div>
                )}
                {device.last_seen && (
                    <div className="flex flex-col gap-0.5 ml-auto text-right">
                        <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">LAST SEEN</span>
                        <span className="text-[11px] font-medium text-stone-500 italic">
                            {new Date(device.last_seen).toLocaleString('en-US', { 
                              month: 'short', 
                              day: 'numeric', 
                              hour: '2-digit', 
                              minute: '2-digit',
                              hour12: false
                            })}
                        </span>
                    </div>
                )}
            </div>
        </div>
    )
}

export default AdminDeviceHeader
