import React from 'react';
import { Download, ChartArea } from 'lucide-react';

const ModeSwitcher = ({ mode, setMode }) => {
  return (
    <div className="flex bg-zinc-900/50 border border-zinc-800 p-1 rounded-lg w-fit">
      <button
        onClick={() => setMode('analysis')}
        className={`flex items-center gap-2 px-4 py-2 rounded-md transition-all text-sm font-medium ${mode === 'analysis'
            ? 'bg-zinc-800 text-zinc-100 shadow-sm'
            : 'text-zinc-400 hover:text-zinc-200'
          }`}
      >
        <ChartArea size={16} />
        Analysis
      </button>
      <button
        onClick={() => setMode('export')}
        className={`flex items-center gap-2 px-4 py-2 rounded-md transition-all text-sm font-medium ${mode === 'export'
            ? 'bg-zinc-800 text-zinc-100 shadow-sm'
            : 'text-zinc-400 hover:text-zinc-200'
          }`}
      >
        <Download size={16} />
        Export Data
      </button>
    </div>
  );
};

export default ModeSwitcher;
