import React from 'react';
import { X, Plus, Check, ChevronDown } from 'lucide-react';
console.log('[DEBUG] GraphLayerControls loaded - chevrons SHOULD be visible!');

// Available metrics for layer selection
const AVAILABLE_METRICS = [
    { id: 'co2', label: 'CO₂ (ppm)', type: 'numeric' },
    { id: 'temp', label: 'Temperature (°C)', type: 'numeric' },
    { id: 'humidity', label: 'Humidity (%)', type: 'numeric' },
    { id: 'delta_co2', label: 'ΔCO₂', type: 'numeric' },
    { id: 'mold_factor', label: 'Mold Factor', type: 'numeric' },
    { id: 'occupancy', label: 'Occupancy', type: 'numeric' },
];

// Background layer options
const BACKGROUND_OPTIONS = [
    { id: 'none', label: 'None' },
    { id: 'subject', label: 'Subject' },
    { id: 'teacher', label: 'Teacher' },
    { id: 'co2_zone', label: 'CO₂ Safety Zone' },
];

// Chart types
const CHART_TYPES = [
    { id: 'line', label: 'Line' },
    { id: 'bar', label: 'Bar' },
    { id: 'scatter', label: 'Scatter' },
];

/**
 * GraphLayerControls
 * 
 * Manages visualization layers and background options for DataLabGraph.
 * This component was moved from the canvas to the sidebar for cleaner UI.
 */
const GraphLayerControls = ({
    layers,
    onLayersChange,
    backgroundLayer,
    onBackgroundLayerChange
}) => {
    const addLayer = () => {
        const newId = Math.max(...layers.map(l => l.id), 0) + 1;
        onLayersChange([...layers, { id: newId, type: 'line', metric: 'temp', visible: true }]);
    };

    const removeLayer = (id) => {
        if (layers.length > 1) {
            onLayersChange(layers.filter(l => l.id !== id));
        }
    };

    const updateLayer = (id, field, value) => {
        onLayersChange(layers.map(l => l.id === id ? { ...l, [field]: value } : l));
    };

    const toggleLayerVisibility = (id) => {
        onLayersChange(layers.map(l => l.id === id ? { ...l, visible: !l.visible } : l));
    };

    return (
        <div className="space-y-6">
            {/* Background Layer */}
            <div>
                <label className="block text-[11px] font-semibold tracking-[0.05em] uppercase text-zinc-400 mb-3">
                    Background Layer
                </label>
                <div className="relative">
                    <select
                        value={backgroundLayer}
                        onChange={(e) => onBackgroundLayerChange(e.target.value)}
                        className="w-full pl-3 pr-8 py-2 text-sm border border-zinc-700 rounded-lg bg-zinc-900/30 text-zinc-200 focus:border-emerald-500 outline-none appearance-none cursor-pointer hover:border-zinc-500 transition-colors"
                    >
                        {BACKGROUND_OPTIONS.map(opt => (
                            <option
                                key={opt.id}
                                value={opt.id}
                                className="dark:bg-zinc-900"
                            >
                                {opt.label}
                            </option>
                        ))}
                    </select>
                    <ChevronDown size={14} className="absolute right-0 top-1/2 -translate-y-1/2 text-zinc-300 pointer-events-none" />
                </div>
            </div>

            {/* Foreground Layers */}
            <div>
                <div className="flex items-center justify-between mb-3">
                    <label className="block text-[11px] font-semibold tracking-[0.05em] uppercase text-zinc-400">
                        Data Layers
                    </label>
                    <button
                        onClick={addLayer}
                        className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors flex items-center gap-1"
                    >
                        <Plus size={12} />
                        Add
                    </button>
                </div>
                <div className="space-y-2">
                    {layers.map((layer) => (
                        <div
                            key={layer.id}
                            className="flex items-center gap-2 p-2 rounded-lg bg-zinc-900/20 border border-zinc-800"
                        >
                            {/* Visibility Checkbox */}
                            <div className="flex-shrink-0">
                                <div
                                    onClick={() => toggleLayerVisibility(layer.id)}
                                    className={`
                                        w-4 h-4 rounded border flex items-center justify-center cursor-pointer transition-colors
                                        ${layer.visible
                                            ? 'bg-emerald-500 border-emerald-500'
                                            : 'bg-transparent border-zinc-700 hover:border-zinc-600'}
                                    `}
                                >
                                    {layer.visible && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                                </div>
                            </div>

                            {/* Chart Type */}
                            <div className="relative">
                                <select
                                    value={layer.type}
                                    onChange={(e) => updateLayer(layer.id, 'type', e.target.value)}
                                    className="pl-2 pr-6 py-1.5 text-xs border border-zinc-700 rounded-md bg-zinc-900/30 text-zinc-200 focus:border-emerald-500 outline-none appearance-none cursor-pointer hover:border-zinc-500 transition-colors"
                                    style={{ minWidth: '70px' }}
                                >
                                    {CHART_TYPES.map(t => (
                                        <option key={t.id} value={t.id} className="dark:bg-zinc-900">
                                            {t.label}
                                        </option>
                                    ))}
                                </select>
                                <ChevronDown size={12} className="absolute right-0 top-1/2 -translate-y-1/2 text-zinc-300 pointer-events-none" />
                            </div>

                            {/* Metric Selection */}
                            <div className="relative flex-1">
                                <select
                                    value={layer.metric}
                                    onChange={(e) => updateLayer(layer.id, 'metric', e.target.value)}
                                    className="w-full pl-2 pr-6 py-1.5 text-xs border border-zinc-700 rounded-md bg-zinc-900/30 text-zinc-200 focus:border-emerald-500 outline-none appearance-none cursor-pointer hover:border-zinc-500 transition-colors"
                                >
                                    {AVAILABLE_METRICS.map(m => (
                                        <option key={m.id} value={m.id} className="dark:bg-zinc-900">
                                            {m.label}
                                        </option>
                                    ))}
                                </select>
                                <ChevronDown size={12} className="absolute right-0 top-1/2 -translate-y-1/2 text-zinc-300 pointer-events-none" />
                            </div>

                            {/* Remove Button */}
                            {layers.length > 1 && (
                                <button
                                    onClick={() => removeLayer(layer.id)}
                                    className="p-1 rounded hover:bg-red-500/20 transition-colors text-red-500"
                                >
                                    <X size={14} />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default GraphLayerControls;
