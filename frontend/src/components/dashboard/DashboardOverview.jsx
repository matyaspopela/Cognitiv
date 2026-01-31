import React from 'react'
import { CheckCircle, Circle } from 'lucide-react'
import { useDashboardStats } from '../../hooks/useDashboardStats'
import MetricCard from './MetricCard'
import ProgressBar from '../ui/ProgressBar'

/**
 * DashboardOverview Component
 * Displays aggregate statistics across all devices using MetricCards
 */
const DashboardOverview = () => {
  const { stats, loading, error } = useDashboardStats()

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-zinc-400">
        <div className="w-32 mb-4">
          <ProgressBar indeterminate />
        </div>
        <p className="text-sm font-medium">Loading overview statistics...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 rounded-md bg-red-900/10 border border-red-500/20 text-red-400 text-sm">
        <p>{error}</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <MetricCard
        label="Total Devices"
        value={stats.totalDevices}
        trend={null}
      />
      <MetricCard
        label="Online Devices"
        value={stats.onlineDevices}
        trend={stats.totalDevices > 0 ? {
          direction: stats.onlineDevices === stats.totalDevices ? 'up' : 'neutral',
          icon: stats.onlineDevices === stats.totalDevices ? <CheckCircle size={14} strokeWidth={2} /> : <Circle size={14} strokeWidth={2} />,
          value: `${Math.round((stats.onlineDevices / stats.totalDevices) * 100)}%`
        } : null}
      />
      <MetricCard
        label="Total Measurements"
        value={stats.totalDataPoints > 0
          ? stats.totalDataPoints.toLocaleString('en-US')
          : '--'}
      />
    </div>
  )
}

export default DashboardOverview