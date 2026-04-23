import React, { useState } from 'react';
import { X, Download, FileText, Code, Check, Database, BookOpen } from 'lucide-react';
import { datalabService } from '../../services/datalabService';
import Button from '../ui/Button';
import Card from '../ui/Card';

const ExportDrawer = ({ isOpen, onClose, devices }) => {
  const [source, setSource] = useState('annotated'); // 'annotated' | 'raw'
  const [format, setFormat] = useState('csv');
  const [timeRange, setTimeRange] = useState('7d');
  const [selectedDevices, setSelectedDevices] = useState(['all']);
  const [isExporting, setIsExporting] = useState(false);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const now = new Date();
      let start = new Date();

      if (timeRange === '24h') {
        start.setHours(now.getHours() - 24);
      } else if (timeRange === '7d') {
        start.setDate(now.getDate() - 7);
      } else if (timeRange === '30d') {
        start.setDate(now.getDate() - 30);
      } else if (timeRange === 'ytd') {
        start = new Date(now.getFullYear(), 0, 1);
      }

      const allSelected = selectedDevices.includes('all');

      const filters = {
        start: start.toISOString(),
        end: now.toISOString(),
        source,
        // Annotated uses room IDs; raw uses device IDs / mac addresses
        ...(source === 'annotated'
          ? { rooms: allSelected ? [] : selectedDevices }
          : { devices: allSelected ? [] : selectedDevices }
        ),
      };

      await datalabService.downloadExport(filters, format, 'raw');
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 2000);
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const toggleDevice = (id) => {
    if (id === 'all') {
      setSelectedDevices(['all']);
      return;
    }
    let next = selectedDevices.filter(d => d !== 'all');
    if (next.includes(id)) {
      next = next.filter(d => d !== id);
      if (next.length === 0) next = ['all'];
    } else {
      next.push(id);
    }
    setSelectedDevices(next);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-stone-900/10 backdrop-blur-[2px]"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="relative w-full max-w-sm bg-white border-l border-stone-200 shadow-xl flex flex-col">
        <div className="p-6 border-b border-stone-100 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-stone-900 uppercase tracking-tight">Export Data</h2>
            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mt-0.5">Laboratory Records</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-stone-50 rounded-md text-stone-400 transition-colors"
          >
            <X size={20} strokeWidth={1.5} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-8">

          {/* Data Source */}
          <section className="flex flex-col gap-3">
            <h3 className="text-[11px] font-bold text-stone-400 uppercase tracking-widest px-1">Data Source</h3>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setSource('annotated')}
                className={`p-4 rounded-lg border flex flex-col items-center gap-2 transition-all ${
                  source === 'annotated'
                    ? 'bg-amber-50 border-amber-200 text-amber-700 shadow-sm'
                    : 'bg-white border-stone-200 text-stone-500 hover:border-stone-300'
                }`}
              >
                <BookOpen size={22} strokeWidth={1.5} />
                <span className="text-xs font-bold uppercase text-center leading-tight">Annotated<br/>+ Lessons</span>
              </button>
              <button
                onClick={() => setSource('raw')}
                className={`p-4 rounded-lg border flex flex-col items-center gap-2 transition-all ${
                  source === 'raw'
                    ? 'bg-amber-50 border-amber-200 text-amber-700 shadow-sm'
                    : 'bg-white border-stone-200 text-stone-500 hover:border-stone-300'
                }`}
              >
                <Database size={22} strokeWidth={1.5} />
                <span className="text-xs font-bold uppercase text-center leading-tight">Raw<br/>Timeseries</span>
              </button>
            </div>

            {/* Source description */}
            <p className="text-[10px] text-stone-400 px-1 leading-relaxed">
              {source === 'annotated'
                ? 'Hourly buckets enriched with lesson context, mold risk, and weather data.'
                : 'Every individual sensor reading — CO\u2082, temperature, humidity, and voltage — straight from the device.'}
            </p>
          </section>

          {/* File Format */}
          <section className="flex flex-col gap-3">
            <h3 className="text-[11px] font-bold text-stone-400 uppercase tracking-widest px-1">File Format</h3>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setFormat('csv')}
                className={`p-4 rounded-lg border flex flex-col items-center gap-2 transition-all ${
                  format === 'csv'
                    ? 'bg-amber-50 border-amber-200 text-amber-700 shadow-sm'
                    : 'bg-white border-stone-200 text-stone-500 hover:border-stone-300'
                }`}
              >
                <FileText size={24} strokeWidth={1.5} />
                <span className="text-xs font-bold uppercase">CSV (Excel)</span>
              </button>
              <button
                onClick={() => setFormat('jsonl')}
                className={`p-4 rounded-lg border flex flex-col items-center gap-2 transition-all ${
                  format === 'jsonl'
                    ? 'bg-amber-50 border-amber-200 text-amber-700 shadow-sm'
                    : 'bg-white border-stone-200 text-stone-500 hover:border-stone-300'
                }`}
              >
                <Code size={24} strokeWidth={1.5} />
                <span className="text-xs font-bold uppercase">JSON Lines</span>
              </button>
            </div>
          </section>

          {/* Time Range */}
          <section className="flex flex-col gap-3">
            <h3 className="text-[11px] font-bold text-stone-400 uppercase tracking-widest px-1">Time Window</h3>
            <div className="flex flex-wrap gap-2">
              {['24h', '7d', '30d', 'ytd'].map(range => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`px-4 py-2 rounded-md text-[11px] font-bold uppercase tracking-wider border transition-all ${
                    timeRange === range
                      ? 'bg-stone-900 text-white border-stone-900 shadow-sm'
                      : 'bg-white text-stone-500 border-stone-200 hover:border-stone-300'
                  }`}
                >
                  {range === '24h' ? '24 Hours' : range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : 'Year to Date'}
                </button>
              ))}
            </div>
          </section>

          {/* Device Selection */}
          <section className="flex flex-col gap-3">
            <h3 className="text-[11px] font-bold text-stone-400 uppercase tracking-widest px-1">Device Filter</h3>
            <div className="flex flex-col gap-1 max-h-[260px] overflow-y-auto pr-2">
              <button
                onClick={() => toggleDevice('all')}
                className={`flex items-center justify-between p-3 rounded-md border transition-all ${
                  selectedDevices.includes('all')
                    ? 'bg-stone-50 border-stone-200 text-stone-900'
                    : 'bg-white border-transparent text-stone-500 hover:bg-stone-50'
                }`}
              >
                <span className="text-xs font-bold uppercase tracking-tight">All Devices</span>
                {selectedDevices.includes('all') && <Check size={14} strokeWidth={3} className="text-emerald-500" />}
              </button>

              {devices.map(device => (
                <button
                  key={device.device_id}
                  onClick={() => toggleDevice(device.device_id)}
                  className={`flex items-center justify-between p-3 rounded-md border transition-all ${
                    selectedDevices.includes(device.device_id)
                      ? 'bg-stone-50 border-stone-200 text-stone-900'
                      : 'bg-white border-transparent text-stone-500 hover:bg-stone-50'
                  }`}
                >
                  <span className="text-xs font-medium">{device.display_name || device.device_id}</span>
                  {selectedDevices.includes(device.device_id) && <Check size={14} strokeWidth={3} className="text-emerald-500" />}
                </button>
              ))}
            </div>
          </section>
        </div>

        <div className="p-6 border-t border-stone-100 bg-stone-50/50">
          <button
            onClick={handleExport}
            disabled={isExporting || success}
            className={`w-full py-4 rounded-lg flex items-center justify-center gap-2 text-sm font-bold uppercase tracking-widest transition-all ${
              success
                ? 'bg-emerald-500 text-white'
                : 'bg-amber-600 text-white hover:bg-amber-700 shadow-md active:shadow-sm active:translate-y-0.5'
            }`}
          >
            {isExporting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Processing...
              </>
            ) : success ? (
              <>
                <Check size={18} strokeWidth={3} />
                Downloaded
              </>
            ) : (
              <>
                <Download size={18} strokeWidth={2} />
                Start Export
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExportDrawer;
