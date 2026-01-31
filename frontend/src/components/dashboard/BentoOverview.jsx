import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Cpu, Database, ArrowRight, Settings, Activity, AlertTriangle } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { dataAPI } from '../../services/api'
import { useAuth } from '../../context/AuthContext'


// Bento Card wrapper with consistent styling and hover effects
const BentoCard = ({ children, className = '', onClick, span = '' }) => {
    const baseClasses = `
    relative overflow-hidden
    bg-zinc-900/60 backdrop-blur-sm
    border border-white/10
    rounded-2xl p-6
    transition-all duration-300 ease-out
    hover:border-white/20 hover:bg-zinc-900/80
    ${onClick ? 'cursor-pointer hover:scale-[1.02]' : ''}
    ${span}
    ${className}
  `

    return (
        <div className={baseClasses} onClick={onClick}>
            {children}
        </div>
    )
}

// Staleness threshold: 5 minutes
const STALE_THRESHOLD_MS = 5 * 60 * 1000

// Box A: Hero - System Health
const HeroCard = ({ averageCo2, loading, isStale }) => {
    const isHealthy = averageCo2 === null || averageCo2 < 1000

    // When stale, use gray styling; otherwise use normal color logic
    const accentColor = isStale
        ? 'text-zinc-500'
        : (isHealthy ? 'text-zinc-400' : 'text-zinc-200')
    const glowColor = isStale
        ? 'shadow-zinc-500/10'
        : (isHealthy ? 'shadow-zinc-500/20' : 'shadow-zinc-200/20')

    return (
        <BentoCard
            span="col-span-1 md:col-span-2 row-span-2"
            className={`flex flex-col justify-between min-h-[320px] shadow-lg ${glowColor} ${isStale ? 'opacity-60' : ''}`}
        >
            <div className="flex flex-col h-full justify-between">

                {/* Top Section: Icon & Alert */}
                <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                        <Activity className={`w-5 h-5 ${accentColor}`} />
                        <span className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                            Current CO₂
                        </span>
                    </div>

                    {!isStale && !isHealthy && (
                        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 text-red-400">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span className="text-xs font-medium">Elevated</span>
                        </div>
                    )}
                </div>

                {/* Bottom-Left Alignment as requested */}
                <div className="mt-auto">
                    {loading ? (
                        <div className="animate-pulse">
                            <div className="w-48 h-24 bg-zinc-800 rounded-lg" />
                        </div>
                    ) : isStale ? (
                        <>
                            <span className="block text-7xl md:text-8xl font-bold tracking-tight text-zinc-700 leading-none">
                                --
                            </span>
                            <span className="block text-lg text-zinc-500 mt-2 font-medium">
                                No recent data
                            </span>
                        </>
                    ) : (
                        <>
                            <div className="flex items-baseline gap-1">
                                <span className={`text-7xl md:text-8xl font-bold tracking-tight leading-none ${accentColor}`}>
                                    {averageCo2 !== null ? Math.round(averageCo2) : '--'}
                                </span>
                            </div>
                            <span className="block text-xl text-zinc-400 mt-2 font-medium">
                                ppm CO₂
                            </span>
                        </>
                    )}
                </div>
            </div>
        </BentoCard>
    )
}

// Box C & D: Small Metric Cards
const MetricBox = ({ icon: Icon, label, value, loading }) => (
    <BentoCard className="flex flex-col justify-between min-h-[150px]">
        <div className="flex items-center gap-2 mb-4">
            <Icon className="w-5 h-5 text-zinc-400" />
            <span className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                {label}
            </span>
        </div>
        <div>
            {loading ? (
                <div className="animate-pulse">
                    <div className="w-16 h-10 bg-zinc-800 rounded" />
                </div>
            ) : (
                <span className="text-4xl font-bold text-white tracking-tight">
                    {value}
                </span>
            )}
        </div>
    </BentoCard>
)

// Box E: Chart Card
const ChartCard = ({ data, isStale }) => {
    const showGhost = isStale || !data || data.length === 0
    const ghostMessage = isStale ? 'No recent data' : 'No data in the last 24 hours'

    return (
        <BentoCard span="col-span-1 md:col-span-3" className={`min-h-[250px] ${isStale ? 'opacity-60' : ''}`}>
            <div className="flex items-center gap-2 mb-6">
                <Activity className="w-5 h-5 text-zinc-400" />
                <span className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                    Last 24 Hours
                </span>
            </div>
            <div className="h-[160px] w-full relative">
                {showGhost ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <svg className="w-full h-16 opacity-20" viewBox="0 0 400 60" preserveAspectRatio="none">
                            <path
                                d="M0,30 Q50,15 100,28 T200,25 T300,35 T400,28"
                                fill="none"
                                stroke="#52525b"
                                strokeWidth="2"
                                strokeDasharray="4,4"
                            />
                        </svg>
                        <span className="text-sm text-zinc-500 mt-2">{ghostMessage}</span>
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={data} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                            <defs>
                                <linearGradient id="co2Gradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#a1a1aa" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#a1a1aa" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <XAxis
                                dataKey="time"
                                stroke="#52525b"
                                fontSize={10}
                                tickLine={false}
                                axisLine={false}
                                tickFormatter={(val, index) => index % 4 === 0 ? val : ''}
                            />
                            <YAxis
                                stroke="#52525b"
                                fontSize={10}
                                tickLine={false}
                                axisLine={false}
                            />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: '#18181b',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '8px',
                                    fontSize: '12px'
                                }}
                                labelStyle={{ color: '#a1a1aa' }}
                                itemStyle={{ color: '#a1a1aa' }}
                            />
                            <Area
                                type="monotone"
                                dataKey="co2"
                                stroke="#a1a1aa"
                                strokeWidth={2}
                                fill="url(#co2Gradient)"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                )}
            </div>
        </BentoCard>
    )
}

// Action Tiles (Compact)
const ActionTile = ({ icon: Icon, label, to, disabled = false }) => {
    const navigate = useNavigate()

    return (
        <button
            onClick={disabled ? undefined : () => navigate(to)}
            disabled={disabled}
            className={`
                flex items-center gap-3 px-4 py-3 
                bg-zinc-900/40 border border-white/5 rounded-xl
                transition-all duration-200
                hover:bg-zinc-800 hover:border-white/10
                text-left w-full
                ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:translate-y-[-2px]'}
            `}
        >
            <div className="p-2 rounded-lg bg-white/5 text-zinc-400">
                <Icon size={18} />
            </div>
            <span className="text-sm font-medium text-zinc-200">
                {label}
            </span>
            {!disabled && (
                <ArrowRight className="w-4 h-4 text-zinc-600 ml-auto" />
            )}
        </button>
    )
}

// Main BentoOverview Component
const BentoOverview = () => {
    const { isAdmin } = useAuth()
    const [stats, setStats] = useState({
        activeDevices: 0,
        totalMeasurements: 0,
        averageCo2: null,
    })
    const [chartData, setChartData] = useState([])
    const [loading, setLoading] = useState(true)
    const [isStale, setIsStale] = useState(false)

    useEffect(() => {
        const loadData = async () => {
            try {
                setLoading(true)

                // Fetch data in parallel
                const [devicesRes, statusRes, statsRes] = await Promise.all([
                    dataAPI.getDevices().catch(() => null),
                    dataAPI.getStatus().catch(() => null),
                    dataAPI.getStats(24).catch(() => null),
                ])

                // Process active devices
                let activeDevices = 0
                if (devicesRes?.data?.devices) {
                    activeDevices = devicesRes.data.devices.filter(d =>
                        d.status === 'online' ||
                        (d.last_seen && (new Date() - new Date(d.last_seen)) < 5 * 60 * 1000)
                    ).length || 0
                }

                // Process measurements count
                let totalMeasurements = 0
                if (statusRes?.data?.data_points) {
                    totalMeasurements = statusRes.data.data_points
                }

                // Process average CO2
                let averageCo2 = null
                if (statsRes?.data?.stats?.co2) {
                    averageCo2 = statsRes.data.stats.co2.avg ?? statsRes.data.stats.co2.current ?? null
                }

                setStats({
                    activeDevices,
                    totalMeasurements,
                    averageCo2,
                })

                // Fetch real chart data from API
                const historyRes = await dataAPI.getData(24, 200).catch(() => null)
                if (historyRes?.data?.readings && Array.isArray(historyRes.data.readings)) {
                    const readings = historyRes.data.readings

                    // Check staleness
                    if (readings.length > 0 && readings[0].timestamp) {
                        const latestTimestamp = new Date(readings[0].timestamp).getTime()
                        const now = Date.now()
                        setIsStale((now - latestTimestamp) > STALE_THRESHOLD_MS)
                    } else {
                        setIsStale(true)
                    }

                    // Transform readings
                    const chartPoints = readings
                        .filter(r => r.co2 !== undefined && r.timestamp)
                        .map(r => ({
                            time: new Date(r.timestamp).toLocaleTimeString('en-US', {
                                hour: '2-digit',
                                minute: '2-digit'
                            }),
                            co2: Math.round(r.co2),
                        }))
                        .reverse()
                    setChartData(chartPoints)
                } else {
                    setChartData([])
                    setIsStale(true)
                }
            } catch (err) {
                console.error('Error loading overview data:', err)
            } finally {
                setLoading(false)
            }
        }

        loadData()
    }, [])

    return (
        <div className="mb-8">
            {/* Header */}
            <header className="mb-6">
                <h1 className="text-2xl font-semibold text-white tracking-tight">Overview</h1>
                <p className="text-sm text-zinc-400 mt-1">Real-time environment monitoring</p>
            </header>

            {/* Modular Bento Grid (3 Columns) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                {/* Hero Card (Spans 2 cols, 2 rows) */}
                <HeroCard averageCo2={stats.averageCo2} loading={loading} isStale={isStale} />

                {/* Right Stack (Vertical) */}
                <div className="flex flex-col gap-4 col-span-1 h-full">
                    <MetricBox
                        icon={Cpu}
                        label="Active Devices"
                        value={stats.activeDevices}
                        loading={loading}
                    />
                    <MetricBox
                        icon={Database}
                        label="Total Measurements"
                        value={stats.totalMeasurements.toLocaleString('en-US')}
                        loading={loading}
                    />
                </div>

                {/* Full Width Trend Row */}
                <ChartCard data={chartData} isStale={isStale} />

                {/* Compact Quick Actions */}
                <div className="col-span-1 md:col-span-3 flex flex-wrap gap-4 mt-2">
                    <div className="w-full md:w-auto min-w-[200px]">
                        <ActionTile
                            icon={Cpu}
                            label="Manage Devices"
                            to="/dashboard"
                        />
                    </div>
                    <div className="w-full md:w-auto min-w-[200px]">
                        <ActionTile
                            icon={Settings}
                            label="System Settings"
                            to="/admin"
                            disabled={!isAdmin}
                        />
                    </div>
                </div>

            </div>
        </div>
    )
}

export default BentoOverview
