import { useState } from 'react'
import useDeviceHistory from '../../hooks/useDeviceHistory'
import AdminStatsCards from './AdminStatsCards'
import Co2Graph from '../dashboard/Co2Graph'
import TimePicker from '../ui/TimePicker'
import ProgressBar from '../ui/ProgressBar'
import Card from '../ui/Card'

const AdminDeviceStats = ({ deviceId }) => {
    const [timeRange, setTimeRange] = useState('24h')
    const { summary, loading, error } = useDeviceHistory(deviceId, timeRange)

    return (
        <div className="flex flex-col gap-6">
            {/* Time Range Selector */}
            <div className="flex justify-end items-center">
                <TimePicker
                    compact
                    value={timeRange}
                    onChange={setTimeRange}
                    options={[
                        { value: '24h', label: '24H', fullLabel: '24 Hours' },
                        { value: '7d', label: '7D', fullLabel: '7 Days' },
                        { value: '30d', label: '30D', fullLabel: '30 Days' },
                        { value: '90d', label: '90D', fullLabel: '90 Days' },
                        { value: 'ytd', label: 'YTD', fullLabel: 'Year to Date' },
                    ]}
                />
            </div>

            {/* Loading State */}
            {loading && (
                <Card className="p-12 text-center" elevation={2}>
                    <ProgressBar indeterminate />
                    <p className="text-zinc-400 mt-4">Loading data...</p>
                </Card>
            )}

            {/* Error State */}
            {error && !loading && (
                <Card className="p-6 bg-red-900/20 border border-red-700/30" elevation={2}>
                    <p className="text-red-400">{error}</p>
                </Card>
            )}

            {/* Data Display */}
            {!loading && !error && (
                <>
                    <AdminStatsCards summary={summary} />
                    <Card className="p-3 sm:p-6 h-[300px] sm:h-[420px]">
                        <Co2Graph deviceId={deviceId} timeWindow={timeRange} />
                    </Card>
                </>
            )}

        </div>
    )
}

export default AdminDeviceStats
