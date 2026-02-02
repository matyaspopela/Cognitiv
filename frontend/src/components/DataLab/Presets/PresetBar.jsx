import React, { useState } from 'react';
import { Save, X } from 'lucide-react';

/**
 * PresetBar Component
 * 
 * Minimalist preset management UI placed at the top of ActionSidebar.
 * Allows users to save current filter states and quickly load them back.
 */
const PresetBar = ({ currentFilters, onLoadPreset }) => {
    const [presets, setPresets] = useState([
        // Example preset structure
        // { id: '1', name: 'Morning CO2', filters: {...} }
    ]);
    const [isNaming, setIsNaming] = useState(false);
    const [newPresetName, setNewPresetName] = useState('');

    const handleSavePreset = () => {
        if (newPresetName.trim()) {
            const newPreset = {
                id: Date.now().toString(),
                name: newPresetName.trim(),
                filters: currentFilters,
                createdAt: new Date().toISOString(),
            };
            setPresets([...presets, newPreset]);
            setNewPresetName('');
            setIsNaming(false);

            // TODO: Save to backend
            // await presetService.savePreset(newPreset);
        }
    };

    const handleDeletePreset = (e, presetId) => {
        e.stopPropagation();
        setPresets(presets.filter(p => p.id !== presetId));

        // TODO: Delete from backend
        // await presetService.deletePreset(presetId);
    };

    return (
        <div className="mb-6 pb-6" style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wider font-ui">Quick Load</h3>
                {!isNaming && (
                    <button
                        onClick={() => setIsNaming(true)}
                        className="text-xs text-white hover:text-zinc-300 transition-colors font-ui flex items-center gap-1"
                    >
                        <Save size={12} />
                        Save View
                    </button>
                )}
            </div>

            {/* Save Preset Input */}
            {isNaming && (
                <div className="mb-3">
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={newPresetName}
                            onChange={(e) => setNewPresetName(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleSavePreset()}
                            placeholder="Preset name..."
                            autoFocus
                            className="flex-1 px-3 py-2 text-sm rounded-lg bg-transparent border text-white placeholder:text-zinc-600 focus:outline-none focus:border-white font-ui"
                            style={{ borderColor: 'rgba(255, 255, 255, 0.2)' }}
                        />
                        <button
                            onClick={handleSavePreset}
                            className="px-3 py-2 rounded-lg bg-white text-black text-sm font-medium hover:bg-zinc-200 transition-colors font-ui"
                        >
                            Save
                        </button>
                        <button
                            onClick={() => {
                                setIsNaming(false);
                                setNewPresetName('');
                            }}
                            className="p-2 rounded-lg hover:bg-zinc-900 transition-colors"
                        >
                            <X size={16} className="text-zinc-400" />
                        </button>
                    </div>
                </div>
            )}

            {/* Preset Pills */}
            {presets.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                    {presets.map((preset) => (
                        <button
                            key={preset.id}
                            onClick={() => onLoadPreset(preset.filters)}
                            className="group px-3 py-1.5 rounded-full text-xs font-medium transition-all font-ui flex items-center gap-2"
                            style={{
                                border: '1px solid rgba(255, 255, 255, 0.2)',
                                color: '#FFFFFF',
                                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                            }}
                        >
                            <span>{preset.name}</span>
                            <button
                                onClick={(e) => handleDeletePreset(e, preset.id)}
                                className="opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-400"
                            >
                                <X size={12} />
                            </button>
                        </button>
                    ))}
                </div>
            ) : (
                <p className="text-xs text-zinc-600 italic font-ui">No saved presets yet</p>
            )}
        </div>
    );
};

export default PresetBar;
