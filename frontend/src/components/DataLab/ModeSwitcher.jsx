import React from 'react';
import { Download, ChartArea } from 'lucide-react';

const ModeSwitcher = ({ mode, setMode }) => {
  return (
    <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-lg w-fit mb-6">
      <button
        onClick={() => setMode('analysis')}
        className={`flex items-center gap-2 px-4 py-2 rounded-md transition-all text-sm font-medium ${
          mode === 'analysis'
            ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm'
            : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'
        }`}
      >
        <ChartArea size={16} />
        Analysis
      </button>
      <button
        onClick={() => setMode('export')}
        className={`flex items-center gap-2 px-4 py-2 rounded-md transition-all text-sm font-medium ${
          mode === 'export'
            ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm'
            : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'
        }`}
      >
        <Download size={16} />
        Export Data
      </button>
    </div>
  );
};

export default ModeSwitcher;
