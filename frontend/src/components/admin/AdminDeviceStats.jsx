import { useState } from 'react'
import useDeviceHistory from '../../hooks/useDeviceHistory'
import AdminStatsCards from './AdminStatsCards'
import AdminCombinedGraph from './AdminCombinedGraph'
import MinimalTimeSelector from '../dashboard/MinimalTimeSelector'
import ProgressBar from '../ui/ProgressBar'
import Card from '../ui/Card'

const AdminDeviceStats = ({ deviceId }) => {
    const [timeRange, setTimeRange] = useState('24h')
    const { series, summary, loading, error } = useDeviceHistory(deviceId, timeRange)

    return (
        <div className="flex flex-col gap-6">
            {/* Time Range Selector */}
            <div className="flex justify-end items-center">
                <MinimalTimeSelector
                    value={timeRange}
                    onChange={setTimeRange}
                    options={[
                        { value: '24h', label: '24 Hours' },
                        { value: '7d', label: '7 Days' },
                        { value: '30d', label: '30 Days' },
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
                    <AdminCombinedGraph series={series} />
                </>
            )}

            {/* No Data State */}
            {!loading && !error && !summary && !series.length && (
                <Card className="p-12 text-center" elevation={2}>
                    <p className="text-zinc-400">No data available for this time range</p>
                </Card>
            )}
        </div>
    )
}

export default AdminDeviceStats
