import { useState, useEffect } from 'react'
import { Calendar } from 'lucide-react'
import { annotatedAPI } from '../../services/api'
import useAnnotatedData from '../../hooks/useAnnotatedData'
import LessonDistributionChart from './LessonDistributionChart'
import WeeklyHeatmap from './WeeklyHeatmap'
import TimePicker from '../ui/TimePicker'
import ProgressBar from '../ui/ProgressBar'
import AnnotatedDateRangePicker from './AnnotatedDateRangePicker'

const AdminAnnotatedView = ({ deviceId }) => {
    const [timeRange, setTimeRange] = useState('current_week')
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
    const [chartGrouping, setChartGrouping] = useState('period')

    // Custom range state
    const [customStart, setCustomStart] = useState(null)   // ISO string
    const [customEnd, setCustomEnd] = useState(null)       // ISO string
    const [showPicker, setShowPicker] = useState(false)

    // Available dates for calendar highlighting
    const [availableDates, setAvailableDates] = useState(new Set())

    useEffect(() => {
        if (!deviceId) return
        annotatedAPI.getAvailableDates(deviceId).then(res => {
            const dates = res?.data?.dates
            if (Array.isArray(dates)) setAvailableDates(new Set(dates))
        })
    }, [deviceId])

    const hookRange = timeRange === 'daily' ? selectedDate : timeRange
    const { summary, lessons, heatmap, loading, error } = useAnnotatedData(
        deviceId,
        hookRange,
        timeRange === 'custom' ? customStart : null,
        timeRange === 'custom' ? customEnd : null,
    )

    const handleTimeRangeChange = (val) => {
        setTimeRange(val)
        if (val === 'custom') setShowPicker(true)
        else setShowPicker(false)
    }

    const handlePickerApply = ({ start, end }) => {
        setCustomStart(start)
        setCustomEnd(end)
        setShowPicker(false)
    }

    // Label shown in the picker trigger when custom range is active
    const customLabel = customStart && customEnd
        ? `${customStart.slice(0, 10)} → ${customEnd.slice(0, 10)}`
        : 'Pick range'

    return (
        <div className="flex flex-col gap-4 sm:gap-6">
            {/* Header / Controls */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
                {/* Chart Grouping Tabs */}
                <div className="flex items-center gap-0 border-b border-stone-200 overflow-x-auto">
                    {['period', 'subject', 'teacher'].map((group) => (
                        <button
                            key={group}
                            onClick={() => setChartGrouping(group)}
                            className={`
                                px-3 sm:px-4 py-2 sm:py-2.5 text-[10px] sm:text-[11px] font-bold uppercase tracking-widest transition-all capitalize border-b-2 mb-[-1px] whitespace-nowrap
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

                <div className="flex items-center gap-2 sm:gap-3 ml-auto">
                    {timeRange === 'daily' && (
                        <div className="flex items-center gap-1.5 border border-stone-200 rounded-md px-2.5 py-1.5 animate-in fade-in slide-in-from-right-4 duration-300">
                            <Calendar size={13} className="text-stone-400 shrink-0" />
                            <input
                                type="date"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                className="bg-transparent border-none text-stone-700 text-[11px] focus:outline-none p-0 min-w-0"
                            />
                        </div>
                    )}

                    {/* Custom range trigger */}
                    {timeRange === 'custom' && (
                        <button
                            onClick={() => setShowPicker(p => !p)}
                            className="flex items-center gap-2 border border-stone-200 rounded-md px-3 py-1.5 text-[11px] text-stone-700 hover:border-stone-300 transition-colors"
                        >
                            <Calendar size={14} className="text-amber-600" />
                            <span className="font-medium">{customLabel}</span>
                        </button>
                    )}

                    <TimePicker
                        compact
                        value={timeRange}
                        onChange={handleTimeRangeChange}
                        options={[
                            { value: 'current_week', label: 'CUR', fullLabel: 'Current Week' },
                            { value: 'last_week',    label: 'LST', fullLabel: 'Last Week' },
                            { value: 'last_month',   label: 'MON', fullLabel: 'Last Month' },
                            { value: 'daily',        label: 'DAY', fullLabel: 'Daily' },
                            { value: 'custom',       label: 'RNG', fullLabel: 'Custom Range' },
                        ]}
                    />
                </div>
            </div>

            {/* Calendar date-range picker (shown inline when custom is active) */}
            {showPicker && timeRange === 'custom' && (
                <div className="max-w-xs">
                    <AnnotatedDateRangePicker
                        availableDates={availableDates}
                        onApply={handlePickerApply}
                    />
                </div>
            )}

            {/* Loading State */}
            {loading && (
                <div className="flex justify-center items-center py-20 bg-stone-50 rounded-lg border border-stone-200">
                    <div className="flex flex-col items-center gap-4">
                        <ProgressBar indeterminate className="w-48" />
                        <p className="text-stone-400 text-sm">Loading lesson data...</p>
                    </div>
                </div>
            )}

            {/* Waiting for custom range to be set */}
            {!loading && timeRange === 'custom' && (!customStart || !customEnd) && (
                <div className="flex justify-center items-center py-16 bg-stone-50 rounded-lg border border-stone-200 border-dashed">
                    <p className="text-stone-400 text-sm">Select a date range above to load lesson data</p>
                </div>
            )}

            {/* Error State */}
            {error && !loading && (
                <div className="p-6 bg-red-50 border border-red-100 rounded-lg">
                    <p className="text-red-600 text-sm">{error}</p>
                </div>
            )}

            {/* Data Display */}
            {!loading && !error && (timeRange !== 'custom' || (customStart && customEnd)) && (
                <>
                    {timeRange !== 'daily' && (
                        <WeeklyHeatmap heatmap={heatmap} />
                    )}
                    <LessonDistributionChart
                        lessons={lessons}
                        summary={summary}
                        grouping={chartGrouping}
                    />
                </>
            )}

            {/* No Data State */}
            {!loading && !error && !summary && (!lessons || (!lessons.by_teacher && !lessons.by_period)) &&
             (timeRange !== 'custom' || (customStart && customEnd)) && (
                <div className="flex justify-center items-center py-20 bg-stone-50 rounded-lg border border-stone-200 border-dashed">
                    <p className="text-stone-400 text-sm">No lesson data available for this time range</p>
                </div>
            )}
        </div>
    )
}

export default AdminAnnotatedView
