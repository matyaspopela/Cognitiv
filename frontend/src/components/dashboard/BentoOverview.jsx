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
        : (isHealthy ? 'text-emerald-400' : 'text-red-400')
    const glowColor = isStale
        ? 'shadow-zinc-500/10'
        : (isHealthy ? 'shadow-emerald-500/20' : 'shadow-red-500/20')

    return (
        <BentoCard
            span="col-span-1 md:col-span-2 row-span-2"
            className={`flex flex-col justify-between min-h-[320px] shadow-lg ${glowColor} ${isStale ? 'opacity-60' : ''}`}
        >
            <div>
                <div className="flex items-center gap-2 mb-4">
                    <Activity className={`w-5 h-5 ${accentColor}`} />
                    <span className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                        Current CO₂
                    </span>
                </div>

                {!isStale && !isHealthy && (
                    <div className="flex items-center gap-2 mb-4 text-red-400">
                        <AlertTriangle className="w-4 h-4" />
                        <span className="text-sm">CO₂ levels elevated</span>
                    </div>
                )}
            </div>

            <div className="flex flex-col items-center justify-center flex-1">
                {loading ? (
                    <div className="animate-pulse">
                        <div className="w-32 h-20 bg-zinc-700 rounded-lg" />
                    </div>
                ) : isStale ? (
                    <>
                        <span className="text-7xl md:text-8xl font-bold tracking-tight text-zinc-600">
                            --
                        </span>
                        <span className="text-lg text-zinc-500 mt-2">
                            No recent data
                        </span>
                    </>
                ) : (
                    <>
                        <span className={`text-7xl md:text-8xl font-bold tracking-tight ${accentColor}`}>
                            {averageCo2 !== null ? Math.round(averageCo2) : '--'}
                        </span>
                        <span className="text-lg text-zinc-400 mt-2">
                            ppm CO₂
                        </span>
                    </>
                )}
            </div>
        </BentoCard>
    )
}

// Box B: Welcome/About Card
const WelcomeCard = () => (
    <BentoCard span="col-span-1 md:col-span-2" className="bg-gradient-to-br from-zinc-900/80 to-zinc-800/40">
        <div className="flex flex-col h-full">
            <h2 className="text-2xl font-bold text-white mb-2">
                Welcome to Cognitiv
            </h2>
            <p className="text-zinc-400 leading-relaxed">
                IoT monitoring system for environmental data. Track CO₂ levels, temperature,
                and humidity across your connected devices in real-time.
            </p>
        </div>
    </BentoCard>
)

// Box C & D: Small Metric Cards
const MetricBox = ({ icon: Icon, label, value, loading }) => (
    <BentoCard className="flex flex-col justify-between min-h-[140px]">
        <div className="flex items-center gap-2 mb-4">
            <Icon className="w-5 h-5 text-zinc-400" />
            <span className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                {label}
            </span>
        </div>
        <div>
            {loading ? (
                <div className="animate-pulse">
                    <div className="w-16 h-10 bg-zinc-700 rounded" />
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
    // Show ghost placeholder if stale OR no data
    const showGhost = isStale || !data || data.length === 0
    const ghostMessage = isStale ? 'No recent data' : 'No data in the last 24 hours'

    return (
        <BentoCard span="col-span-1 md:col-span-2" className={`min-h-[200px] ${isStale ? 'opacity-60' : ''}`}>
            <div className="flex items-center gap-2 mb-4">
                <Activity className="w-5 h-5 text-zinc-400" />
                <span className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                    Last 24 Hours
                </span>
            </div>
            <div className="h-[140px] w-full relative">
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
                        <AreaChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                            <defs>
                                <linearGradient id="co2Gradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#34d399" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <XAxis
                                dataKey="time"
                                stroke="#52525b"
                                fontSize={10}
                                tickLine={false}
                                axisLine={false}
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
                                itemStyle={{ color: '#34d399' }}
                            />
                            <Area
                                type="monotone"
                                dataKey="co2"
                                stroke="#34d399"
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

// Box F & G: Action Cards
const ActionCard = ({ icon: Icon, label, to, disabled = false }) => {
    const navigate = useNavigate()

    return (
        <BentoCard
            onClick={disabled ? undefined : () => navigate(to)}
            className={`flex items-center justify-between min-h-[100px] group ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
            <div className="flex items-center gap-3">
                <Icon className="w-5 h-5 text-zinc-400" />
                <span className="text-sm font-medium text-white">{label}</span>
            </div>
            {!disabled && (
                <ArrowRight className="w-5 h-5 text-zinc-500 transition-transform group-hover:translate-x-1" />
            )}
        </BentoCard>
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

                // Process devices
                let activeDevices = 0
                if (devicesRes?.data?.devices) {
                    activeDevices = devicesRes.data.devices.filter(d =>
                        d.status === 'online' ||
                        (d.last_seen && (new Date() - new Date(d.last_seen)) < 5 * 60 * 1000)
                    ).length || devicesRes.data.devices.length
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
                const historyRes = await dataAPI.getData(24, 500).catch(() => null)
                if (historyRes?.data?.readings && Array.isArray(historyRes.data.readings)) {
                    const readings = historyRes.data.readings

                    // Check staleness: is the most recent reading older than 5 minutes?
                    if (readings.length > 0 && readings[0].timestamp) {
                        const latestTimestamp = new Date(readings[0].timestamp).getTime()
                        const now = Date.now()
                        setIsStale((now - latestTimestamp) > STALE_THRESHOLD_MS)
                    } else {
                        setIsStale(true) // No timestamps = stale
                    }

                    // Transform readings to chart format
                    const chartPoints = readings
                        .filter(r => r.co2 !== undefined && r.timestamp)
                        .map(r => ({
                            time: new Date(r.timestamp).toLocaleTimeString('en-US', {
                                hour: '2-digit',
                                minute: '2-digit'
                            }),
                            co2: Math.round(r.co2),
                        }))
                        .reverse() // Oldest first
                    setChartData(chartPoints)
                } else {
                    setChartData([]) // No data available
                    setIsStale(true) // No data = stale
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
        <div className="min-h-screen bg-[#0a0a0a] p-6 md:p-8">
            {/* Header */}
            <header className="mb-8">
                <h1 className="text-3xl font-bold text-white tracking-tight">Overview</h1>
                <p className="text-zinc-400 mt-1">Monitor your environment at a glance</p>
            </header>

            {/* Bento Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 md:gap-6">
                {/* Row 1-2: Hero (A) + Welcome (B) + Metrics (C, D) */}
                <HeroCard averageCo2={stats.averageCo2} loading={loading} isStale={isStale} />

                <WelcomeCard />

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

                {/* Row 3: Chart (E) + Actions (F, G) */}
                <ChartCard data={chartData} isStale={isStale} />

                <ActionCard
                    icon={Cpu}
                    label="Manage Devices"
                    to="/dashboard"
                />

                <ActionCard
                    icon={Settings}
                    label="Settings"
                    to="/admin"
                    disabled={!isAdmin}
                />
            </div>
        </div>
    )
}

export default BentoOverview
