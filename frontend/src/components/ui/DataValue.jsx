import React from 'react';

/**
 * DataValue - High-density information display component
 * @param {string|number} value - The numeric or string value to display
 * @param {string} unit - The unit of measurement (e.g., "ppm", "°C")
 * @param {string} [label] - Optional descriptive label
 * @param {number} [trend] - Optional trend value (positive for up, negative for down)
 * @param {string} [className] - Additional CSS classes
 */
const DataValue = ({ value, unit, label, trend, className = '' }) => {
  return (
    <div className={`flex flex-col ${className}`}>
      {label && (
        <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-0.5">
          {label}
        </span>
      )}
      <div className="flex items-baseline gap-1.5">
        <span className="font-mono text-xl font-semibold text-text-primary tabular-nums leading-none">
          {value}
        </span>
        <span className="text-[11px] text-text-muted font-medium uppercase">{unit}</span>
        {trend !== undefined && (
          <span className={`text-[10px] ml-0.5 ${trend > 0 ? 'text-co2-critical' : trend < 0 ? 'text-co2-good' : 'text-text-muted'}`}>
            {trend > 0 ? '▲' : trend < 0 ? '▼' : '•'}
          </span>
        )}
      </div>
    </div>
  );
};

export default DataValue;
