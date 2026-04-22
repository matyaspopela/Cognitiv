import { useState } from 'react'
import { Calendar } from 'lucide-react'
import useAnnotatedData from '../../hooks/useAnnotatedData'
import LessonDistributionChart from './LessonDistributionChart'
import WeeklyHeatmap from './WeeklyHeatmap'
import TimePicker from '../ui/TimePicker'
import ProgressBar from '../ui/ProgressBar'

const AdminAnnotatedView = ({ deviceId }) => {
    const [timeRange, setTimeRange] = useState('current_week')
    // Default to today's date in YYYY-MM-DD format
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
    const [chartGrouping, setChartGrouping] = useState('period')

    const hookRange = timeRange === 'daily' ? selectedDate : timeRange

    const { summary, lessons, heatmap, loading, error } = useAnnotatedData(deviceId, hookRange)

    return (
        <div className="flex flex-col gap-6">
            {/* Header / Controls */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                {/* Chart Grouping Tabs — underline style */}
                <div className="flex items-center gap-0 border-b border-stone-200">
                    {['period', 'subject', 'teacher'].map((group) => (
                        <button
                            key={group}
                            onClick={() => setChartGrouping(group)}
                            className={`
                                px-4 py-2.5 text-[11px] font-bold uppercase tracking-widest transition-all capitalize border-b-2 mb-[-1px]
                                ${chartGrouping === group
                                    ? 'border-amber-600 text-stone-900'
                                    : 'border-transparent text-stone-400 hover:text-stone-600'
                                }
                            `}
                        >
                            {group}
                        </button>
                    ))}
                </div>

                <div className="flex items-center gap-4 ml-auto">
                    {timeRange === 'daily' && (
                        <div className="flex items-center gap-2 border border-stone-200 rounded-md px-3 py-1.5 animate-in fade-in slide-in-from-right-4 duration-300">
                            <Calendar size={14} className="text-stone-400" />
                            <input
                                type="date"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                className="bg-transparent border-none text-stone-700 text-xs focus:outline-none p-0"
                            />
                        </div>
                    )}

                    <TimePicker
                        compact
                        value={timeRange}
                        onChange={setTimeRange}
                        options={[
                            { value: 'current_week', label: 'CUR', fullLabel: 'Current Week' },
                            { value: 'last_week', label: 'LST', fullLabel: 'Last Week' },
                            { value: 'last_month', label: 'MON', fullLabel: 'Last Month' },
                            { value: 'daily', label: 'DAY', fullLabel: 'Daily' },
                        ]}
                    />
                </div>
            </div>

            {/* Loading State */}
            {loading && (
                <div className="flex justify-center items-center py-20 bg-zinc-900/30 rounded-lg border border-white/5">
                    <div className="flex flex-col items-center gap-4">
                        <ProgressBar indeterminate className="w-48" />
                        <p className="text-zinc-500 text-sm">Loading lesson data...</p>
                    </div>
                </div>
            )}

            {/* Error State */}
            {error && !loading && (
                <div className="p-6 bg-red-900/10 border border-red-900/30 rounded-lg">
                    <p className="text-red-400 text-sm">{error}</p>
                </div>
            )}

            {/* Data Display */}
            {!loading && !error && (
                <>
                    {/* Weekly View: Heatmap First */}
                    {timeRange !== 'daily' && (
                        <WeeklyHeatmap heatmap={heatmap} />
                    )}

                    {/* Main Chart (Groupable) */}
                    <LessonDistributionChart
                        lessons={lessons}
                        summary={summary}
                        grouping={chartGrouping}
                    />
                </>
            )}

            {/* No Data State */}
            {!loading && !error && !summary && (!lessons || (!lessons.by_teacher && !lessons.by_period)) && (
                <div className="flex justify-center items-center py-20 bg-zinc-900/30 rounded-lg border border-white/5 border-dashed">
                    <p className="text-zinc-500 text-sm">No lesson data available for this time range</p>
                </div>
            )}
        </div>
    )
}

export default AdminAnnotatedView
