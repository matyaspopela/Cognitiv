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
    },
    {
      id: 'pdf',
      label: 'PDF Report',
      desc: 'Executive summary with charts.',
      icon: FileText
    }
  ];

  return (
    <div className="mb-6">
      <h3 className="text-lg font-medium text-zinc-100 mb-4">Select Format</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {formats.map((f) => {
          const isSelected = format === f.id;
          const Icon = f.icon;
          return (
            <button
              key={f.id}
              onClick={() => setFormat(f.id)}
              className={`relative flex flex-col items-start p-4 rounded-lg border transition-all text-left group ${isSelected
                  ? 'bg-zinc-800 border-zinc-600 ring-1 ring-zinc-500'
                  : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/70'
                }`}
            >
              {isSelected && (
                <div className="absolute top-3 right-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                </div>
              )}
              <div className={`p-2 rounded-md mb-3 ${isSelected ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-800 text-zinc-400'
                }`}>
                <Icon size={20} />
              </div>
              <span className={`font-semibold ${isSelected ? 'text-zinc-100' : 'text-zinc-300'}`}>
                {f.label}
              </span>
              <span className="text-xs text-zinc-400 mt-1">
                {f.desc}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default FormatSelector;
