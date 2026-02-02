import React, { useState, useEffect, useCallback } from 'react';
import { datalabService } from '../../services/datalabService';
import ModeSwitcher from './ModeSwitcher';
import ActionSidebar from './ActionSidebar';
import ExportDrawer from './ExportWizard/ExportDrawer';
import FormatSelector from './ExportWizard/FormatSelector';
import DownloadButton from './ExportWizard/DownloadButton';
import DataLabGraph from './DataVisualizer/DataLabGraph';
import './DataLab.css'; // Import interactive state styles

import { Loader2 } from 'lucide-react';

const DataLabLayout = () => {
  // State
  const [mode, setMode] = useState('analysis'); // 'analysis' | 'export'
  const [filters, setFilters] = useState({
    rooms: [],
    dateRange: { start: new Date(new Date().setDate(new Date().getDate() - 7)), end: new Date() },
    metrics: ['co2', 'temp'],
  });
  const [advancedFilters, setAdvancedFilters] = useState({});
  const [exportFormat, setExportFormat] = useState('csv');
  const [previewData, setPreviewData] = useState(null);
  const [loading, setLoading] = useState(false);

  // Graph visualization state
  const [layers, setLayers] = useState([
    { id: 1, type: 'line', metric: 'co2', visible: true }
  ]);
  const [backgroundLayer, setBackgroundLayer] = useState('none');

  // Debounced preview fetch
  const fetchPreview = useCallback(async () => {
    setLoading(true);
    try {
      // Format dates as ISO strings for API
      const formattedFilters = {
        ...filters,
        ...advancedFilters,
        start: filters.dateRange.start?.toISOString?.().split('T')[0],
        end: filters.dateRange.end?.toISOString?.().split('T')[0],
      };

      const result = await datalabService.previewQuery(formattedFilters);
      setPreviewData(result.data.preview_data);
    } catch (error) {
      console.error('Preview failed:', error);
      setPreviewData([]);
    } finally {
      setLoading(false);
    }
  }, [filters, advancedFilters]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchPreview();
    }, 800); // Debounce 800ms
    return () => clearTimeout(timer);
  }, [filters, advancedFilters, fetchPreview]);

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleAdvancedFilterChange = (newFilters) => {
    setAdvancedFilters(newFilters);
  };

  return (
    <div
      className="datalab-container p-12 mx-auto"
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 320px', // Fixed width sidebar for stability
        gap: '4rem',
        minHeight: 'calc(100vh - 4rem)',
        maxWidth: '100%', // Allow full width
      }}
    >
      {/* Main Canvas Area (80%) */}
      <div className="flex flex-col min-w-0">
        {/* Streamlined Header */}
        <div className="flex items-center justify-between mb-8 shrink-0">
          <h1 className="text-2xl font-semibold font-ui" style={{ color: '#F9FAFB' }}>DataLab</h1>
          <ModeSwitcher mode={mode} setMode={setMode} />
        </div>

        {/* Content Area */}
        <div className="flex-1" style={{ minHeight: '500px' }}>
          {loading && !previewData ? (
            <div className="flex items-center justify-center h-full text-zinc-400">
              <Loader2 className="animate-spin h-6 w-6 text-zinc-500" />
            </div>
          ) : (
            <>
              {mode === 'analysis' ? (
                <div style={{ height: '100%', minHeight: '500px' }}>
                  {/* Main Analysis Chart */}
                  <DataLabGraph
                    data={previewData}
                    layers={layers}
                    backgroundLayer={backgroundLayer}
                  />
                </div>
              ) : (
                <div className="p-8 max-w-2xl mx-auto w-full">
                  <h2 className="text-lg font-medium text-zinc-100 mb-2">Export Configuration</h2>
                  <p className="text-sm text-zinc-400 mb-8">
                    Export will use the filters configured in the sidebar (time range, devices, lesson filters).
                  </p>
                  <div className="space-y-8">
                    <FormatSelector format={exportFormat} setFormat={setExportFormat} />
                    <DownloadButton
                      filters={{
                        ...filters,
                        ...advancedFilters,
                        start: filters.dateRange.start?.toISOString?.().split('T')[0],
                        end: filters.dateRange.end?.toISOString?.().split('T')[0],
                      }}
                      format={exportFormat}
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Action Sidebar (20%) */}
      <ActionSidebar
        filters={filters}
        onFilterChange={handleFilterChange}
        advancedFilters={advancedFilters}
        onAdvancedFilterChange={handleAdvancedFilterChange}
        layers={layers}
        onLayersChange={setLayers}
        backgroundLayer={backgroundLayer}
        onBackgroundLayerChange={setBackgroundLayer}
      />
    </div>
  );
};

export default DataLabLayout;
