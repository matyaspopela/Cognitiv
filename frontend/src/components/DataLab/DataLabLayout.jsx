import React, { useState, useEffect, useCallback } from 'react';
import { datalabService } from '../../services/datalabService';
import ModeSwitcher from './ModeSwitcher';
import RoomSelector from './QueryBuilder/RoomSelector';
import DateRangePicker from './QueryBuilder/DateRangePicker';
import MetricToggler from './QueryBuilder/MetricToggler';
import FormatSelector from './ExportWizard/FormatSelector';
import DownloadButton from './ExportWizard/DownloadButton';
import CustomGraphBuilder from './DataVisualizer/CustomGraphBuilder';

import { Loader2 } from 'lucide-react';

const DataLabLayout = () => {
  // State
  const [mode, setMode] = useState('analysis'); // 'analysis' | 'export'
  const [filters, setFilters] = useState({
    rooms: [],
    dateRange: { start: new Date(new Date().setDate(new Date().getDate() - 7)), end: new Date() },
    metrics: ['co2', 'temp'],
  });
  const [exportFormat, setExportFormat] = useState('csv');
  const [previewData, setPreviewData] = useState(null);
  const [loading, setLoading] = useState(false);

  // Debounced preview fetch
  const fetchPreview = useCallback(async () => {
    setLoading(true);
    try {
      // Format dates as ISO strings for API
      const formattedFilters = {
        ...filters,
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
  }, [filters]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchPreview();
    }, 800); // Debounce 800ms
    return () => clearTimeout(timer);
  }, [filters, fetchPreview]);

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="p-4 md:p-8 max-w-[1920px] mx-auto h-[calc(100vh-64px)] overflow-hidden flex flex-col">
      {/* Page Header - Minimal */}
      <div className="flex flex-row items-center justify-between gap-4 mb-6 shrink-0 h-10">
        <div>
          <h1 className="text-xl font-bold text-zinc-100 tracking-tight">DataLab</h1>
        </div>
        <div className="flex items-center gap-6">
          <ModeSwitcher mode={mode} setMode={setMode} />
        </div>
      </div>

      <div className="flex flex-1 gap-8 overflow-hidden">
        {/* Left Column: Minimal Controls (No Card, blended) */}
        <div className="w-64 shrink-0 flex flex-col gap-6 overflow-y-auto pr-2 pb-4">

          {/* Scope Controls */}
          <div className="space-y-6">
            <RoomSelector
              selectedRooms={filters.rooms}
              onChange={(rooms) => handleFilterChange('rooms', rooms)}
            />
            <DateRangePicker
              startDate={filters.dateRange.start}
              endDate={filters.dateRange.end}
              onChange={(range) => handleFilterChange('dateRange', range)}
            />
          </div>

          {/* Metrics */}
          <div className="pt-2">
            <MetricToggler
              metrics={filters.metrics}
              onChange={(metrics) => handleFilterChange('metrics', metrics)}
            />
          </div>
        </div>

        {/* Right Column: Visualization (Card remains for the 'Screen') */}
        <div className="flex-1 min-w-0 h-full">
          <div className="h-full overflow-hidden">
            <div className="h-full flex flex-col">
              {loading && !previewData ? (
                <div className="flex-1 flex flex-col items-center justify-center text-zinc-400 gap-3">
                  <Loader2 className="animate-spin h-6 w-6 text-zinc-600 dark:text-zinc-500" />
                </div>
              ) : (
                <>
                  {mode === 'analysis' ? (
                    <div className="flex-1 h-full min-h-0 p-6">
                      {/* Main Analysis Chart - Single adjustable view */}
                      <div className="h-full w-full">
                        <CustomGraphBuilder data={previewData} />
                      </div>
                    </div>
                  ) : (
                    <div className="p-8 max-w-2xl mx-auto w-full">
                      <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100 mb-8">Export Configuration</h2>
                      <div className="space-y-8">
                        <FormatSelector format={exportFormat} setFormat={setExportFormat} />
                        <DownloadButton
                          filters={{
                            ...filters,
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
        </div>
      </div>
    </div>
  );
};

export default DataLabLayout;

