import React from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { Calendar } from 'lucide-react';

const DateRangePicker = ({ startDate, endDate, onChange }) => {
  return (
    <div className="w-full mb-4">
      <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
        Date Range
      </label>
      <div className="flex gap-2 items-center">
        <div className="relative flex-1">
          <Calendar className="absolute left-2 top-2.5 h-4 w-4 text-zinc-400 z-10 pointer-events-none" />
          <DatePicker
            selected={startDate}
            onChange={(dates) => {
              const [start, end] = dates;
              onChange({ start, end });
            }}
            startDate={startDate}
            endDate={endDate}
            selectsRange
            className="w-full pl-8 pr-3 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-zinc-500 focus:outline-none"
            placeholderText="Select range..."
            dateFormat="MMM d, yyyy"
          />
        </div>
      </div>
      <div className="flex gap-2 mt-2">
        <button
          onClick={() => {
            const end = new Date();
            const start = new Date();
            start.setDate(end.getDate() - 7);
            onChange({ start, end });
          }}
          className="text-xs px-2 py-1 bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 rounded text-zinc-600 dark:text-zinc-300"
        >
          Last 7 Days
        </button>
        <button
          onClick={() => {
            const end = new Date();
            const start = new Date();
            start.setMonth(end.getMonth() - 1);
            onChange({ start, end });
          }}
          className="text-xs px-2 py-1 bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 rounded text-zinc-600 dark:text-zinc-300"
        >
          Last Month
        </button>
        <button
          onClick={() => {
             const now = new Date();
             const start = new Date(now.getFullYear(), 0, 1);
             onChange({ start, end: now });
          }}
          className="text-xs px-2 py-1 bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 rounded text-zinc-600 dark:text-zinc-300"
        >
          YTD
        </button>
      </div>
    </div>
  );
};

export default DateRangePicker;
