import React from 'react';
import { ChevronDown } from 'lucide-react';

const BucketingSelector = ({ value, onChange }) => {
  const options = [
    { id: 'raw', label: 'Raw Data (No Aggregation)' },
    { id: '15m', label: '15 Minutes' },
    { id: '1h', label: 'Hourly' },
    { id: '1d', label: 'Daily' },
  ];

  return (
    <div className="w-full">
      <div className="grid grid-cols-4 gap-1 p-1 bg-zinc-900/50 border border-zinc-800 rounded-lg">
        {options.map((option) => (
          <button
            key={option.id}
            onClick={() => onChange(option.id)}
            className={`
              flex items-center justify-center py-2 text-xs font-medium rounded-md transition-all
              ${value === option.id
                ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/30'}
            `}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default BucketingSelector;
