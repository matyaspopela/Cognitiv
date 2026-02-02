import React, { useState } from 'react';
import { X, ChevronRight, ChevronLeft, Download, FileText, Database, FileSpreadsheet } from 'lucide-react';
import { datalabService } from '../../../services/datalabService';

/**
 * ExportDrawer Component
 * 
 * Step-by-step export wizard with minimalist design.
 * Slides in from the right with 3 steps: Format → Fields → Preview
 */
const ExportDrawer = ({ isOpen, onClose, filters }) => {
    const [step, setStep] = useState(1); // 1: Format, 2: Fields, 3: Preview
    const [selectedFormat, setSelectedFormat] = useState('csv');
    const [selectedFields, setSelectedFields] = useState({
        timestamp: true,
        co2: true,
        temperature: false,
        humidity: false,
        teacher: false,
        subject: false,
        room_volume: false,
        delta_co2: false,
        mold_factor: false,
    });
    const [isExporting, setIsExporting] = useState(false);

    const formatOptions = [
        { id: 'csv', name: 'CSV', icon: FileSpreadsheet, description: 'Spreadsheet-compatible data' },
        { id: 'json', name: 'JSON', icon: Database, description: 'Structured data for developers' },
        { id: 'pdf', name: 'PDF Report', icon: FileText, description: 'Visual infographic report' },
    ];

    const availableFields = [
        { key: 'timestamp', label: 'Timestamp', required: true },
        { key: 'co2', label: 'CO2 (ppm)', required: true },
        { key: 'temperature', label: 'Temperature (°C)', required: false },
        { key: 'humidity', label: 'Humidity (%)', required: false },
        { key: 'teacher', label: 'Teacher Name', required: false },
        { key: 'subject', label: 'Subject', required: false },
        { key: 'room_volume', label: 'Room Volume (m³)', required: false },
        { key: 'delta_co2', label: 'Delta CO2', required: false },
        { key: 'mold_factor', label: 'Mold Factor', required: false },
    ];

    const handleExport = async () => {
        setIsExporting(true);
        try {
            const fieldsToExport = Object.keys(selectedFields).filter(key => selectedFields[key]);
            await datalabService.exportData(selectedFormat, filters, fieldsToExport);
            onClose();
        } catch (error) {
            console.error('Export failed:', error);
        } finally {
            setIsExporting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black bg-opacity-50 z-40"
                onClick={onClose}
                style={{ backdropFilter: 'blur(2px)' }}
            />

            {/* Drawer */}
            <div
                className="fixed right-0 top-0 h-full w-[480px] bg-black z-50 flex flex-col"
                style={{
                    borderLeft: '1px solid rgba(255, 255, 255, 0.1)',
                    animation: 'slideIn 300ms ease-out',
                }}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b" style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}>
                    <div>
                        <h2 className="text-lg font-semibold text-white font-ui">Export Data</h2>
                        <p className="text-sm text-zinc-500 mt-1">Step {step} of 3</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-zinc-900 rounded-lg transition-colors"
                        aria-label="Close"
                    >
                        <X size={20} className="text-zinc-400" />
                    </button>
                </div>

                {/* Progress Indicator */}
                <div className="flex px-6 pt-4">
                    {[1, 2, 3].map((s) => (
                        <div key={s} className="flex-1 flex items-center">
                            <div
                                className="h-1 flex-1 rounded-full transition-colors"
                                style={{
                                    backgroundColor: s <= step ? '#FFFFFF' : 'rgba(255, 255, 255, 0.1)',
                                }}
                            />
                            {s < 3 && <div className="w-2" />}
                        </div>
                    ))}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {/* Step 1: Format Selection */}
                    {step === 1 && (
                        <div className="space-y-4">
                            <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-4 font-ui">Select Format</h3>
                            {formatOptions.map((format) => {
                                const Icon = format.icon;
                                const isSelected = selectedFormat === format.id;
                                return (
                                    <button
                                        key={format.id}
                                        onClick={() => setSelectedFormat(format.id)}
                                        className="w-full p-4 rounded-lg text-left transition-all font-ui"
                                        style={{
                                            border: isSelected ? '1px solid #FFFFFF' : '1px solid rgba(255, 255, 255, 0.1)',
                                            backgroundColor: isSelected ? 'rgba(255, 255, 255, 0.05)' : 'transparent',
                                        }}
                                    >
                                        <div className="flex items-start gap-3">
                                            <Icon size={20} className="text-white mt-0.5" />
                                            <div className="flex-1">
                                                <div className="text-white font-medium">{format.name}</div>
                                                <div className="text-sm text-zinc-500 mt-1">{format.description}</div>
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {/* Step 2: Field Selection */}
                    {step === 2 && (
                        <div>
                            <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-4 font-ui">Select Fields</h3>
                            <div className="space-y-2">
                                {availableFields.map((field) => (
                                    <label
                                        key={field.key}
                                        className="flex items-center gap-3 p-3 rounded-lg cursor-pointer hover:bg-zinc-900 transition-colors"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selectedFields[field.key]}
                                            disabled={field.required}
                                            onChange={(e) => setSelectedFields(prev => ({ ...prev, [field.key]: e.target.checked }))}
                                            className="w-4 h-4 rounded border-zinc-700 text-white focus:ring-2 focus:ring-white focus:ring-offset-0"
                                            style={{
                                                accentColor: '#FFFFFF',
                                            }}
                                        />
                                        <span className="flex-1 text-sm text-white font-ui">
                                            {field.label}
                                            {field.required && <span className="text-zinc-500 ml-2">(required)</span>}
                                        </span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Step 3: Preview */}
                    {step === 3 && (
                        <div>
                            <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-4 font-ui">Preview</h3>
                            <div className="space-y-4">
                                <div className="p-4 rounded-lg" style={{ backgroundColor: 'rgba(255, 255, 255, 0.05)' }}>
                                    <div className="text-sm text-zinc-400 mb-2">Format</div>
                                    <div className="text-white font-medium uppercase">{selectedFormat}</div>
                                </div>
                                <div className="p-4 rounded-lg" style={{ backgroundColor: 'rgba(255, 255, 255, 0.05)' }}>
                                    <div className="text-sm text-zinc-400 mb-2">Selected Fields</div>
                                    <div className="text-white text-sm">
                                        {Object.keys(selectedFields)
                                            .filter(key => selectedFields[key])
                                            .map(key => availableFields.find(f => f.key === key)?.label)
                                            .join(', ')}
                                    </div>
                                </div>
                                <div className="p-4 rounded-lg" style={{ backgroundColor: 'rgba(255, 255, 255, 0.05)' }}>
                                    <div className="text-sm text-zinc-400 mb-2">Estimated Size</div>
                                    <div className="text-white font-medium">~ 250 KB</div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Navigation */}
                <div className="p-6 border-t" style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}>
                    <div className="flex gap-3">
                        {step > 1 && (
                            <button
                                onClick={() => setStep(step - 1)}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border transition-colors font-ui"
                                style={{
                                    borderColor: 'rgba(255, 255, 255, 0.2)',
                                    color: '#FFFFFF',
                                }}
                            >
                                <ChevronLeft size={16} />
                                Back
                            </button>
                        )}
                        {step < 3 && (
                            <button
                                onClick={() => setStep(step + 1)}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg transition-colors font-ui"
                                style={{
                                    backgroundColor: '#FFFFFF',
                                    color: '#000000',
                                    border: '1px solid #FFFFFF',
                                }}
                            >
                                Next
                                <ChevronRight size={16} />
                            </button>
                        )}
                        {step === 3 && (
                            <button
                                onClick={handleExport}
                                disabled={isExporting}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg transition-colors font-ui"
                                style={{
                                    backgroundColor: '#FFFFFF',
                                    color: '#000000',
                                    border: '1px solid #FFFFFF',
                                    opacity: isExporting ? 0.5 : 1,
                                }}
                            >
                                <Download size={16} />
                                {isExporting ? 'Exporting...' : 'Download'}
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Slide-in animation */}
            <style jsx>{`
        @keyframes slideIn {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }
      `}</style>
        </>
    );
};

export default ExportDrawer;
