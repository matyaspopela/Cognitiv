import React from 'react';
import { FileSpreadsheet, FileJson, FileText, CheckCircle2 } from 'lucide-react';

const FormatSelector = ({ format, setFormat }) => {
  const formats = [
    {
      id: 'csv',
      label: 'CSV',
      desc: 'Standard comma-separated values for Excel.',
      icon: FileSpreadsheet
    },
    {
      id: 'jsonl',
      label: 'JSON Lines',
      desc: 'Machine-learning ready format.',
      icon: FileJson
    }
  ];

  return (
    <div className="w-full">
      <div className="grid grid-cols-2 gap-1 p-1 bg-zinc-900/50 border border-zinc-800 rounded-lg">
        {formats.map((f) => {
          const isSelected = format === f.id;
          const Icon = f.icon;
          return (
            <button
              key={f.id}
              onClick={() => setFormat(f.id)}
              className={`
                 flex items-center justify-center gap-2 py-2 text-xs font-medium rounded-md transition-all
                 ${isSelected
                  ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/30'}
              `}
            >
              <Icon size={14} />
              <span>{f.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default FormatSelector;
