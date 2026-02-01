import React from 'react';
import { ToggleLeft, ToggleRight } from 'lucide-react';

const MetricToggler = ({ metrics, onChange }) => {
  const availableMetrics = [
    { id: 'co2', label: 'CO2 (ppm)' },
    { id: 'temp', label: 'Temperature (°C)' },
    { id: 'humidity', label: 'Humidity (%)' },
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

  return (
    <div className="mb-6">
      <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
        Metrics
      </label>
      <div className="grid grid-cols-2 gap-2">
        {availableMetrics.map((metric) => {
          const isSelected = metrics.includes(metric.id);
          return (
            <button
              key={metric.id}
              onClick={() => toggleMetric(metric.id)}
              className={`flex items-center justify-between px-3 py-2 text-sm rounded-md border transition-all ${isSelected
                  ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-transparent'
                  : 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-500'
                }`}
            >
              <span>{metric.label}</span>
              {isSelected ? (
                <ToggleRight className="h-4 w-4" />
              ) : (
                <ToggleLeft className="h-4 w-4 text-zinc-400" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default MetricToggler;
