import React, { useMemo } from 'react';
import { CO2_LEVELS } from '../../utils/co2';

/**
 * FleetHealthBanner - Minimalist status overview for the dashboard
 * Shows online counts and alert status.
 */
const FleetHealthBanner = ({ devices = [] }) => {
  const stats = useMemo(() => {
    const total = devices.length;
    let online = 0;
    let alerts = 0;

    devices.forEach(device => {
      // Offline logic (consistent with DashboardBox)
      let isOffline = false;
      if (!device || typeof device === 'string') {
        isOffline = true;
      } else if (device.status === 'offline') {
        isOffline = true;
      } else if (device.last_seen) {
        const lastSeenDate = new Date(device.last_seen);
        if (!isNaN(lastSeenDate.getTime())) {
          const now = new Date();
          const minutesAgo = (now.getTime() - lastSeenDate.getTime()) / (1000 * 60);
          if (minutesAgo > 5) isOffline = true;
        }
      } else if (device.status !== 'online') {
        isOffline = true;
      }

      if (!isOffline) {
        online++;
      }

      // Alert logic: Offline or CO2 > 1200
      const co2 = device?.current_readings?.co2;
      if (isOffline || (co2 != null && co2 > CO2_LEVELS.FAIR)) {
        alerts++;
      }
    });

    return { online, alerts, total };
  }, [devices]);

  // Last updated: 2m ago (simplified for now, could be dynamic)
  // In a real app, this might track the timestamp of the last fetch
  const lastUpdated = "Just now";

  return (
    <div className="w-full h-[40px] flex items-center px-6 border-b border-border-subtle bg-surface/50 backdrop-blur-sm text-[11px] font-medium text-text-muted">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          <span className="text-text-primary font-bold">{stats.online}</span>
          <span className="uppercase tracking-wider">Online</span>
        </div>
        
        <div className="w-[1px] h-3 bg-stone-200" />

        <div className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${stats.alerts > 0 ? 'bg-amber-500' : 'bg-stone-300'}`} />
          <span className={`font-bold ${stats.alerts > 0 ? 'text-text-primary' : 'text-text-muted'}`}>
            {stats.alerts}
          </span>
          <span className="uppercase tracking-wider">Alerts</span>
        </div>

        <div className="w-[1px] h-3 bg-stone-200" />

        <div className="flex items-center gap-1.5 opacity-60">
          <span>Updated {lastUpdated}</span>
        </div>
      </div>
    </div>
  );
};

export default FleetHealthBanner;
