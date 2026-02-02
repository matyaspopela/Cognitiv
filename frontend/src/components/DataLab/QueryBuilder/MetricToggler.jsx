import React from 'react';
import { ToggleLeft, ToggleRight, Check } from 'lucide-react';

const MetricToggler = ({ metrics, onChange }) => {
  const envMetrics = [
    { id: 'co2', label: 'CO2 (ppm)' },
    { id: 'temp', label: 'Temperature (°C)' },
    { id: 'humidity', label: 'Humidity (%)' },
  ];

  const specMetrics = [
    { id: 'occupancy', label: 'Est. Occupancy' },
    { id: 'window_area', label: 'Window Area (m²)' },
    { id: 'room_volume', label: 'Room Volume (m³)' },
  ];

  const toggleMetric = (id) => {
    if (metrics.includes(id)) {
      onChange(metrics.filter((m) => m !== id));
    } else {
      onChange([...metrics, id]);
    }
  };

  const MetricGroup = ({ title, items }) => (
    <div className="mb-4 last:mb-0">
      <h3 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2">{title}</h3>
      <div className="space-y-1.5">
        {items.map((metric) => {
          const isSelected = metrics.includes(metric.id);
          return (
            <button
              key={metric.id}
              onClick={() => toggleMetric(metric.id)}
              className="group flex items-center w-full text-left gap-2"
            >
              <div className={`
                w-4 h-4 rounded border flex items-center justify-center transition-colors
                ${isSelected
                  ? 'bg-emerald-500 border-emerald-500 dark:bg-emerald-600 dark:border-emerald-600'
                  : 'bg-transparent border-zinc-300 dark:border-zinc-700 group-hover:border-zinc-400 dark:group-hover:border-zinc-600'}
              `}>
                {isSelected && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
              </div>
              <span className={`text-sm transition-colors ${isSelected ? 'text-zinc-900 dark:text-zinc-100 font-medium' : 'text-zinc-600 dark:text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-zinc-300'}`}>
                {metric.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="mb-0">
      <MetricGroup title="Environmental" items={envMetrics} />
      <MetricGroup title="Room Specs" items={specMetrics} />
    </div>
  );
};

export default MetricToggler;
