import React, { useState, useEffect } from 'react';
import { datalabService } from '../../services/datalabService';
import RoomSelector from './QueryBuilder/RoomSelector';
import DateRangePicker from './QueryBuilder/DateRangePicker';
import FormatSelector from './ExportWizard/FormatSelector';
import BucketingSelector from './ExportWizard/BucketingSelector';
import DownloadButton from './ExportWizard/DownloadButton';
import './DataLab.css';

import { FileDown, Database } from 'lucide-react';

const DataLabLayout = () => {
  const [filters, setFilters] = useState({
    rooms: [],
    dateRange: { start: new Date(new Date().setDate(new Date().getDate() - 7)), end: new Date() },
  });
  const [bucketing, setBucketing] = useState('raw');
  const [exportFormat, setExportFormat] = useState('csv');
  const [estimatedCount, setEstimatedCount] = useState(null);

  useEffect(() => {
    const fetchEstimate = async () => {
      try {
        const formattedFilters = {
          ...filters,
          start: filters.dateRange.start?.toISOString?.().split('T')[0],
          end: filters.dateRange.end?.toISOString?.().split('T')[0],
        };
        const result = await datalabService.previewQuery(formattedFilters, bucketing);
        setEstimatedCount(result.data.estimated_count);
      } catch (error) {
        console.error("Failed to fetch estimate", error);
      }
    };

    // Debounce
    const timer = setTimeout(fetchEstimate, 500);
    return () => clearTimeout(timer);
  }, [filters, bucketing]);

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="datalab-container min-h-screen p-8 md:p-12 flex flex-col items-center">

      {/* Content */}
      <div className="w-full max-w-4xl flex flex-col gap-12 mt-12">

        {/* Row 1: Scope */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <DateRangePicker
            startDate={filters.dateRange?.start}
            endDate={filters.dateRange?.end}
            onChange={(range) => handleFilterChange('dateRange', range)}
          />
          <RoomSelector
            selectedRooms={filters.rooms || []}
            onChange={(rooms) => handleFilterChange('rooms', rooms)}
          />
        </div>

        {/* Row 2: Settings */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <BucketingSelector value={bucketing} onChange={setBucketing} />
          </div>
          <div>
            <FormatSelector format={exportFormat} setFormat={setExportFormat} />
          </div>
        </div>

        {/* Row 3: Action */}
        <div className="pt-2">
          <DownloadButton
            filters={{
              ...filters,
              start: filters.dateRange.start?.toISOString?.().split('T')[0],
              end: filters.dateRange.end?.toISOString?.().split('T')[0],
            }}
            format={exportFormat}
            bucketing={bucketing}
          />
        </div>

      </div>
    </div>
  );
};

export default DataLabLayout;