import React, { useState, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import RoomSelector from './QueryBuilder/RoomSelector';
import DateRangePicker from './QueryBuilder/DateRangePicker';
import AdvancedFilters from './QueryBuilder/AdvancedFilters';
import GraphLayerControls from './QueryBuilder/GraphLayerControls';
import PresetBar from './Presets/PresetBar';

/**
 * ActionSidebar
 * 
 * Unified glassmorphism sidebar containing all DataLab filters and controls.
 * Implements the new design system with high-fidelity dark mode aesthetics.
 * 
 * @param {Object} filters - Current filter state
 * @param {Function} onFilterChange - Callback when filters change
 * @param {Object} advancedFilters - Advanced filter state (teacher, subject, etc.)
 * @param {Function} onAdvancedFilterChange - Callback for advanced filters
 * @param {Array} layers - Visualization layers
 * @param {Function} onLayersChange - Callback when layers change
 * @param {String} backgroundLayer - Selected background layer
 * @param {Function} onBackgroundLayerChange - Callback when background layer changes
 */
const ActionSidebar = ({
    filters,
    onFilterChange,
    advancedFilters = {},
    onAdvancedFilterChange,
    layers = [],
    onLayersChange,
    backgroundLayer = 'none',
    onBackgroundLayerChange
}) => {
    return (
        <div className="action-sidebar h-full flex flex-col">
            {/* Minimalist Container */}
            <div
                className="flex-1 overflow-y-auto rounded-none border-l px-8 py-8"
                style={{
                    background: 'transparent', // Blends with global black background
                    borderColor: 'rgba(255, 255, 255, 0.1)', // Subtle gray border
                    backdropFilter: 'none',
                    boxShadow: 'none',
                }}
            >
                {/* Header */}
                <div className="mb-6">
                    <h2 className="text-[11px] font-semibold tracking-[0.05em] uppercase text-zinc-400">
                        Filters
                    </h2>
                </div>

                {/* Preset Bar */}
                <PresetBar
                    currentFilters={{ ...filters, ...advancedFilters }}
                    onLoadPreset={(presetFilters) => {
                        // Load preset logic
                        if (presetFilters.dateRange) onFilterChange('dateRange', presetFilters.dateRange);
                        if (presetFilters.rooms) onFilterChange('rooms', presetFilters.rooms);
                        if (presetFilters.metrics) onFilterChange('metrics', presetFilters.metrics);
                        if (onAdvancedFilterChange) onAdvancedFilterChange(presetFilters);
                    }}
                />

                {/* Main Filters Section */}
                <div className="space-y-6">
                    {/* Time Range */}
                    <div>
                        <label className="block text-[11px] font-semibold tracking-[0.05em] uppercase text-zinc-400 mb-3">
                            Time Range
                        </label>
                        <DateRangePicker
                            startDate={filters.dateRange?.start}
                            endDate={filters.dateRange?.end}
                            onChange={(range) => onFilterChange('dateRange', range)}
                        />
                    </div>

                    {/* Room Selection */}
                    <div>
                        <RoomSelector
                            selectedRooms={filters.rooms || []}
                            onChange={(rooms) => onFilterChange('rooms', rooms)}
                        />
                    </div>

                    {/* Advanced Filters - Always Visible */}
                    <div>
                        <AdvancedFilters
                            filters={advancedFilters}
                            onChange={onAdvancedFilterChange}
                        />
                    </div>

                    {/* Graph Layer Controls */}
                    <div>
                        <GraphLayerControls
                            layers={layers}
                            onLayersChange={onLayersChange}
                            backgroundLayer={backgroundLayer}
                            onBackgroundLayerChange={onBackgroundLayerChange}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ActionSidebar;
