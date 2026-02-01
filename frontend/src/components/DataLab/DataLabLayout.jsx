import React, { useState, useEffect, useCallback } from 'react';
import { datalabService } from '../../services/datalabService';
import ModeSwitcher from './ModeSwitcher';
import RoomSelector from './QueryBuilder/RoomSelector';
import DateRangePicker from './QueryBuilder/DateRangePicker';
import MetricToggler from './QueryBuilder/MetricToggler';
import FormatSelector from './ExportWizard/FormatSelector';
import DownloadButton from './ExportWizard/DownloadButton';
import TrendChart from './DataVisualizer/TrendChart';
import CorrelationPlot from './DataVisualizer/CorrelationPlot';
import PresetList from './Presets/PresetList';
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
  const [estimatedRecords, setEstimatedRecords] = useState(0);

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
      setEstimatedRecords(result.data.estimated_count || 0); // Fixed: backend returns 'estimated_count'
    } catch (error) {
      console.error('Preview failed:', error);
      setPreviewData([]);
      setEstimatedRecords(0);
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
    <div className="flex flex-col lg:flex-row h-full min-h-[calc(100vh-64px)] bg-zinc-50 dark:bg-zinc-900">
      {/* Sidebar / Control Panel */}
      <aside className="w-full lg:w-80 bg-white dark:bg-zinc-800 border-r border-zinc-200 dark:border-zinc-700 p-6 overflow-y-auto">
        <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-6 flex items-center gap-2">
          DataLab <span className="text-xs font-normal text-zinc-500 bg-zinc-100 dark:bg-zinc-700 px-2 py-0.5 rounded-full">BETA</span>
        </h2>

        <div className="space-y-6">
          <ModeSwitcher mode={mode} setMode={setMode} />

          <div className="border-t border-zinc-100 dark:border-zinc-700 pt-6">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4 uppercase tracking-wider">Query Builder</h3>
            <RoomSelector
              selectedRooms={filters.rooms}
              onChange={(rooms) => handleFilterChange('rooms', rooms)}
            />
            <DateRangePicker
              startDate={filters.dateRange.start}
              endDate={filters.dateRange.end}
              onChange={(range) => handleFilterChange('dateRange', range)}
            />
            <MetricToggler
              metrics={filters.metrics}
              onChange={(metrics) => handleFilterChange('metrics', metrics)}
            />
          </div>

          <div className="border-t border-zinc-100 dark:border-zinc-700 pt-6">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4 uppercase tracking-wider">Saved Presets</h3>
            <PresetList onSelect={(savedFilters) => setFilters((prev) => ({ ...prev, ...savedFilters }))} />
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-8 overflow-y-auto">
        <header className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              {mode === 'analysis' ? 'Visual Analysis' : 'Data Export'}
            </h1>
            <p className="text-zinc-500 dark:text-zinc-400 mt-1">
              {mode === 'analysis'
                ? 'Visualize trends and correlations across your selected dataset.'
                : 'Configure and download raw data for external processing.'}
            </p>
          </div>
          <div className="text-right">
            <div className="text-sm text-zinc-500 dark:text-zinc-400">Estimated Records</div>
            <div className="text-2xl font-mono font-bold text-zinc-900 dark:text-zinc-100">
              {loading ? <Loader2 className="animate-spin inline h-5 w-5" /> : estimatedRecords.toLocaleString()}
            </div>
          </div>
        </header>

        <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-6 min-h-[500px]">
          {loading && !previewData ? (
            <div className="h-full flex flex-col items-center justify-center text-zinc-400 gap-4">
              <Loader2 className="animate-spin h-8 w-8" />
              <p>Fetching preview data...</p>
            </div>
          ) : (
            <>
              {mode === 'analysis' ? (
                <div className="space-y-8">
                  <div>
                    <h3 className="text-lg font-medium mb-4">Trend Analysis</h3>
                    <TrendChart data={previewData} metrics={filters.metrics} />
                  </div>
                  {filters.metrics.length >= 2 && (
                    <div className="pt-8 border-t border-zinc-100 dark:border-zinc-700">
                      <h3 className="text-lg font-medium mb-4">Correlation</h3>
                      <CorrelationPlot data={previewData} metrics={filters.metrics} />
                    </div>
                  )}
                </div>
              ) : (
                <div className="max-w-2xl mx-auto py-12">
                  <FormatSelector format={exportFormat} setFormat={setExportFormat} />

                  <div className="bg-zinc-50 dark:bg-zinc-900/50 rounded-lg p-6 mb-8 border border-zinc-100 dark:border-zinc-700">
                    <h4 className="font-medium mb-2 text-zinc-700 dark:text-zinc-300">Export Summary</h4>
                    <ul className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
                      <li className="flex justify-between">
                        <span>Rooms Selected:</span>
                        <span className="font-mono text-zinc-900 dark:text-zinc-200">{filters.rooms.length || 'All'}</span>
                      </li>
                      <li className="flex justify-between">
                        <span>Date Range:</span>
                        <span className="font-mono text-zinc-900 dark:text-zinc-200">
                          {filters.dateRange.start?.toLocaleDateString()} - {filters.dateRange.end?.toLocaleDateString()}
                        </span>
                      </li>
                      <li className="flex justify-between">
                        <span>Metrics:</span>
                        <span className="font-mono text-zinc-900 dark:text-zinc-200">{filters.metrics.join(', ')}</span>
                      </li>
                      <li className="flex justify-between pt-2 border-t border-zinc-200 dark:border-zinc-700 mt-2 font-semibold">
                        <span>Estimated File Size:</span>
                        <span>~{(estimatedRecords * 0.5).toFixed(1)} KB</span>
                      </li>
                    </ul>
                  </div>

                  <DownloadButton
                    filters={{
                      ...filters,
                      start: filters.dateRange.start?.toISOString?.().split('T')[0],
                      end: filters.dateRange.end?.toISOString?.().split('T')[0],
                    }}
                    format={exportFormat}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default DataLabLayout;
