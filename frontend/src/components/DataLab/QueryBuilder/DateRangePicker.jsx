import React from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { Calendar } from 'lucide-react';

const CustomInput = React.forwardRef(({ value, onClick, activePreset }, ref) => (
  <button
    className={`
      flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-all
      ${activePreset === 'custom'
        ? 'bg-zinc-800 text-zinc-100 shadow-sm'
        : 'text-zinc-400 hover:text-zinc-200'}
    `}
    onClick={onClick}
    ref={ref}
  >
    <Calendar className="h-3.5 w-3.5" />
    <span>{activePreset === 'custom' ? value : 'Custom'}</span>
  </button>
));

const DateRangePicker = ({ startDate, endDate, onChange }) => {
  const [activePreset, setActivePreset] = React.useState('7d');

  const handlePreset = (preset) => {
    setActivePreset(preset);
    const end = new Date();
    const start = new Date();

    if (preset === '7d') {
      start.setDate(end.getDate() - 7);
    } else if (preset === '1m') {
      start.setMonth(end.getMonth() - 1);
    } else if (preset === 'ytd') {
      start.setMonth(0, 1);
    }
    onChange({ start, end });
  };

  return (
    <div className="w-full">
      <div className="flex p-1 bg-zinc-900/50 border border-zinc-800 rounded-lg">
        {['7d', '1m', 'ytd'].map((preset) => (
          <button
            key={preset}
            onClick={() => handlePreset(preset)}
            className={`
              flex-1 py-1.5 text-xs font-medium rounded-md transition-all
              ${activePreset === preset
                ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'}
            `}
          >
            {preset === '7d' ? '7 Days' : preset === '1m' ? '1 Month' : 'YTD'}
          </button>
        ))}

        <div className="relative">
          <DatePicker
            selected={startDate}
            onChange={(dates) => {
              const [start, end] = dates;
              onChange({ start, end });
              if (end) setActivePreset('custom');
            }}
            startDate={startDate}
            endDate={endDate}
            selectsRange
            customInput={<CustomInput activePreset={activePreset} />}
            dateFormat="MMM d"
            popperPlacement="bottom-end"
          />
        </div>
      </div>
    </div>
  );
};

export default DateRangePicker;
