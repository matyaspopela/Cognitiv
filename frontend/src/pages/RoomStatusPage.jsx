import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { dataAPI } from '../services/api';
import { getCO2Status, getCO2Label, getCO2Recommendation, getCO2Color } from '../utils/co2';
import StatusBadge from '../components/ui/StatusBadge';
import LoadingSpinner from '../components/ui/LoadingSpinner';

/**
 * RoomStatusPage - Public teacher-facing page
 * Zero-auth, high-visibility mobile-first display.
 */
const RoomStatusPage = () => {
  const { deviceId } = useParams();
  const [device, setDevice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await dataAPI.getDevices();
        if (response.data && response.data.devices) {
          const found = response.data.devices.find(
            (d) => d.device_id === deviceId || d.mac_address === deviceId || d.display_name === deviceId
          );
          if (found) {
            setDevice(found);
            setLastUpdated(new Date());
          }
        }
      } catch (error) {
        console.error('Error fetching room status:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, [deviceId]);

  const co2 = device?.current_readings?.co2 != null ? Math.round(device.current_readings.co2) : null;
  const status = co2 != null ? getCO2Status(co2) : 'unknown';
  const label = co2 != null ? getCO2Label(co2) : '--';
  const recommendation = co2 != null ? getCO2Recommendation(co2) : 'Connecting to sensor...';

  if (loading && !device) {
    return (
      <div className="min-h-screen bg-app-bg flex flex-col items-center justify-center p-6">
        <LoadingSpinner size="large" />
        <p className="mt-4 text-stone-500 font-medium">Connecting to Laboratory...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-app-bg flex flex-col items-center justify-between py-12 px-6">
      <header className="w-full text-center">
        <h2 className="text-stone-400 text-[10px] font-bold uppercase tracking-[0.2em] mb-1">
          Classroom Environment
        </h2>
        <h1 className="text-stone-900 text-xl font-bold tracking-tight">
          {device?.display_name || deviceId}
        </h1>
      </header>

      <main className="flex flex-col items-center gap-6 w-full max-w-sm">
        <div className="flex flex-col items-center">
          <div 
            className="text-[96px] font-mono font-bold tracking-tighter leading-none tabular-nums"
            style={{ color: getCO2Color(co2 || 0) }}
          >
            {co2 || '--'}
          </div>
          <div className="text-stone-400 font-mono text-sm mt-[-10px]">PPM CO₂</div>
        </div>

        <StatusBadge status={status} className="px-4 py-1.5 text-xs">
          {label}
        </StatusBadge>

        <div className="w-full bg-white border border-stone-200 rounded-2xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.05)] text-center">
          <p className="text-stone-900 font-medium leading-relaxed">
            {recommendation}
          </p>
        </div>
      </main>

      <footer className="w-full text-center flex flex-col gap-4">
        <div className="flex justify-center gap-8 text-[11px] font-bold text-stone-400 uppercase tracking-wider">
          <div className="flex flex-col gap-0.5">
            <span className="opacity-50">TEMP</span>
            <span className="text-stone-600">{device?.current_readings?.temperature?.toFixed(1) || '--'}°C</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="opacity-50">HUMIDITY</span>
            <span className="text-stone-600">{Math.round(device?.current_readings?.humidity || 0) || '--'}%</span>
          </div>
        </div>

        <div className="text-[10px] text-stone-400 font-medium italic">
          Last updated: {lastUpdated.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
        </div>
      </footer>
    </div>
  );
};

export default RoomStatusPage;
