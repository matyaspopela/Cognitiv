import React from 'react';

const DEFAULT_OPTIONS = [
  { value: '1h', label: '1H', fullLabel: '1 Hour' },
  { value: '24h', label: '24H', fullLabel: '24 Hours' },
  { value: '7d', label: '7D', fullLabel: '7 Days' },
  { value: '30d', label: '30D', fullLabel: '30 Days' },
  { value: 'ytd', label: 'YTD', fullLabel: 'Year to Date' },
];

/**
 * TimePicker Component
 * A unified, threshold-aware (Bleached Stone) selector for time ranges.
 * Replaces TimeWindowSelector and MinimalTimeSelector.
 */
const TimePicker = ({ 
  value, 
  onChange, 
  compact = false, 
  options = DEFAULT_OPTIONS,
  className = "" 
}) => {
  return (
    <div className={`flex items-center p-1 bg-stone-100/50 rounded-lg border border-stone-200/60 ${className}`}>
      {options.map((option) => {
        const isActive = value === option.value;
        return (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            className={`
              transition-all duration-200 rounded-md text-[10px] font-bold uppercase tracking-[0.05em]
              ${isActive 
                ? 'bg-white text-stone-900 shadow-sm border border-stone-200 py-1.5' 
                : 'text-stone-400 hover:text-stone-600 hover:bg-stone-50 py-1.5'
              }
              ${compact ? 'px-2.5 min-w-[36px]' : 'px-4 min-w-[70px]'}
            `}
            aria-pressed={isActive}
          >
            {compact ? option.label : (option.fullLabel || option.label)}
          </button>
        );
      })}
    </div>
  );
};

export default TimePicker;
