import React, { useEffect, useState } from 'react';
import { datalabService } from '../../../services/datalabService';
import { Bookmark, Clock, ArrowRight, Trash2 } from 'lucide-react';

const PresetList = ({ onSelect }) => {
  const [presets, setPresets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchPresets = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await datalabService.getPresets();
      // Handle response structure: { presets: [...] } or { data: { presets: [...] } }
      const presetData = response.data?.presets || response.presets || [];
      setPresets(presetData);
    } catch (error) {
      console.error('Failed to load presets:', error);
      setError('Failed to load saved queries');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPresets();
  }, []);

  const handleDelete = async (e, presetId) => {
    e.stopPropagation(); // Prevent triggering onSelect

    if (!window.confirm('Delete this preset?')) {
      return;
    }

    try {
      await datalabService.deletePreset(presetId);
      // Remove from local state
      setPresets(presets.filter(p => p.id !== presetId));
    } catch (error) {
      console.error('Failed to delete preset:', error);
      alert('Failed to delete preset');
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-16 bg-zinc-100 dark:bg-zinc-800 animate-pulse rounded-md" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-red-600 dark:text-red-400 mb-2">{error}</p>
        <button
          onClick={fetchPresets}
          className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
        >
          Try again
        </button>
      </div>
    );
  }

  if (presets.length === 0) {
    return (
      <div className="text-center py-8 text-zinc-500 text-sm">
        No saved queries yet.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {presets.map((preset) => (
        <div
          key={preset.id}
          onClick={() => onSelect(preset.filters)}
          className="group relative flex items-start p-3 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-700/50 rounded-lg cursor-pointer hover:border-zinc-300 dark:hover:border-zinc-600 transition-all"
        >
          <div className="bg-white dark:bg-zinc-800 p-2 rounded mr-3 border border-zinc-100 dark:border-zinc-700/50 shadow-sm">
            <Bookmark size={16} className="text-zinc-400 dark:text-zinc-500 group-hover:text-emerald-500 transition-colors" />
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-medium text-zinc-900 dark:text-zinc-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
              {preset.name}
            </h4>
            {preset.created_at && (
              <div className="flex items-center gap-2 mt-1 text-xs text-zinc-500">
                <Clock size={12} />
                <span>
                  {new Date(preset.created_at).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>
          <button
            onClick={(e) => handleDelete(e, preset.id)}
            className="p-1 text-zinc-400 hover:text-red-600 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
            title="Delete preset"
          >
            <Trash2 size={14} />
          </button>
          <ArrowRight className="text-zinc-300 group-hover:text-emerald-500 dark:group-hover:text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity ml-2" size={16} />
        </div>
      ))}
    </div>
  );
};

export default PresetList;

