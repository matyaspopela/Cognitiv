import React, { useState } from 'react';
import {
    ScatterChart,
    Scatter,
    LineChart,
    Line,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer
} from 'recharts';
import { Plus, X, Settings2 } from 'lucide-react';

const AVAILABLE_METRICS = [
    { id: 'co2', label: 'CO2 (ppm)', color: '#ffffff' },
    { id: 'temp', label: 'Temperature (°C)', color: '#3b82f6' },
    { id: 'humidity', label: 'Humidity (%)', color: '#10b981' },
    { id: 'mold_factor', label: 'Mold Factor', color: '#f59e0b' },
    { id: 'delta_co2', label: 'ΔCO2', color: '#ef4444' },
];

const CHART_TYPES = [
    { id: 'scatter', label: 'Scatter' },
    { id: 'line', label: 'Line' },
    { id: 'bar', label: 'Bar' },
];

const CustomGraphBuilder = ({ data }) => {
    const [graphs, setGraphs] = useState([
        { id: 1, xMetric: 'timestamp', yMetric: 'co2', chartType: 'line' }
    ]);
    const [showConfig, setShowConfig] = useState(null);

    const addGraph = () => {
        const newId = Math.max(...graphs.map(g => g.id), 0) + 1;
        setGraphs([...graphs, { id: newId, xMetric: 'temp', yMetric: 'humidity', chartType: 'scatter' }]);
    };

    const removeGraph = (id) => {
        if (graphs.length > 1) {
            setGraphs(graphs.filter(g => g.id !== id));
        }
    };

    const updateGraph = (id, field, value) => {
        setGraphs(graphs.map(g => g.id === id ? { ...g, [field]: value } : g));
    };

    const renderChart = (graph) => {
        if (!data || data.length === 0) {
            return (
                <div className="flex items-center justify-center h-full min-h-[250px] text-zinc-500 font-medium">
                    No data available. Adjust filters.
                </div>
            );
        }

        const xMetric = graph.xMetric;
        const yMetric = graph.yMetric;
        const yColor = AVAILABLE_METRICS.find(m => m.id === yMetric)?.color || '#18181b';

        const commonProps = {
            margin: { top: 10, right: 10, left: 0, bottom: 0 },
        };

        const xAxisProps = {
            dataKey: xMetric,
            stroke: '#52525b', // darker zinc for subtle axis
            fontSize: 10,
            tickLine: false,
            axisLine: false,
            tickMargin: 10,
            ...(xMetric === 'timestamp' && {
                tickFormatter: (str) => {
                    try {
                        const date = new Date(str);
                        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        // Ideally we'd show date only on change, but for now this fixes the repetition
                    } catch {
                        return str;
                    }
                },
                minTickGap: 30
            })
        };

        const yAxisProps = {
            stroke: '#52525b',
            fontSize: 10,
            tickLine: false,
            axisLine: false,
            tickMargin: 10,
            domain: ['auto', 'auto'], // Dynamic scaling
        };

        const tooltipProps = {
            contentStyle: {
                backgroundColor: '#09090b', // zinc-950
                borderColor: '#27272a',
                color: '#f4f4f5',
                borderRadius: '8px',
                fontSize: '12px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
            },
            itemStyle: { color: '#d4d4d8' },
            cursor: { stroke: '#52525b', strokeDasharray: '3 3' }
        };

        switch (graph.chartType) {
            case 'scatter':
                return (
                    <ResponsiveContainer width="100%" height="100%" minHeight={280}>
                        <ScatterChart {...commonProps}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                            <XAxis type="number" {...xAxisProps} name={xMetric} />
                            <YAxis type="number" {...yAxisProps} name={yMetric} dataKey={yMetric} />
                            <Tooltip {...tooltipProps} />
                            {/* Legend removed */}
                            <Scatter
                                name={`${xMetric} vs ${yMetric}`}
                                data={data}
                                fill={yColor}
                                shape="circle"
                            />
                        </ScatterChart>
                    </ResponsiveContainer>
                );

            case 'bar':
                return (
                    <ResponsiveContainer width="100%" height="100%" minHeight={280}>
                        <BarChart data={data} {...commonProps}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                            <XAxis {...xAxisProps} />
                            <YAxis {...yAxisProps} />
                            <Tooltip {...tooltipProps} />
                            <Bar dataKey={yMetric} fill={yColor} radius={[2, 2, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                );

            case 'line':
            default:
                return (
                    <ResponsiveContainer width="100%" height="100%" minHeight={280}>
                        <LineChart data={data} {...commonProps}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                            <XAxis {...xAxisProps} />
                            <YAxis {...yAxisProps} />
                            <Tooltip {...tooltipProps} />
                            <Line
                                type="monotone"
                                dataKey={yMetric}
                                stroke={yColor}
                                strokeWidth={2}
                                dot={false}
                                activeDot={{ r: 4, strokeWidth: 0, fill: yColor }}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                );
        }
    };

    return (
        <div className="flex flex-col h-full overflow-y-auto pb-4 relative">
            {/* Global Add Button (Top Right absolute or integrated) */}
            <div className="absolute top-0 right-0 z-10">
                <button
                    onClick={addGraph}
                    className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
                    title="Add Analysis View"
                >
                    <Plus size={16} />
                </button>
            </div>

            {graphs.map((graph, index) => (
                <div key={graph.id} className="relative flex flex-col min-h-[400px] border-b border-zinc-900 last:border-0 mb-8 last:mb-0">
                    {/* Graph Header */}
                    <div className="flex items-center justify-between mb-2 px-1">
                        <h4 className="text-sm font-medium text-zinc-300">
                            {graph.yMetric === 'co2' ? 'CO₂ Concentration' : `Analysis ${index + 1}`}
                        </h4>
                        <div className="flex items-center gap-2 opacity-0 hover:opacity-100 transition-opacity">
                            <button
                                onClick={() => setShowConfig(showConfig === graph.id ? null : graph.id)}
                                className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
                                title="Configure"
                            >
                                <Settings2 size={14} />
                            </button>
                            {graphs.length > 1 && (
                                <button
                                    onClick={() => removeGraph(graph.id)}
                                    className="p-1.5 rounded hover:bg-red-900/20 text-zinc-400 hover:text-red-400 transition-colors"
                                    title="Remove"
                                >
                                    <X size={14} />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Configuration Panel */}
                    {showConfig === graph.id && (
                        <div className="flex flex-wrap gap-4 mb-4 p-4 bg-zinc-900/50 rounded-lg border border-zinc-800 mx-2">
                            <div className="flex-1 min-w-[140px]">
                                <label className="block text-[10px] font-semibold text-zinc-400 mb-1.5 uppercase tracking-wide">
                                    X-Axis
                                </label>
                                <select
                                    value={graph.xMetric}
                                    onChange={(e) => updateGraph(graph.id, 'xMetric', e.target.value)}
                                    className="w-full px-2 py-1.5 text-xs border border-zinc-700 rounded bg-zinc-800 text-zinc-200 outline-none focus:border-zinc-500"
                                >
                                    <option value="timestamp">Time</option>
                                    {AVAILABLE_METRICS.map(m => (
                                        <option key={m.id} value={m.id}>{m.label}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex-1 min-w-[140px]">
                                <label className="block text-[10px] font-semibold text-zinc-400 mb-1.5 uppercase tracking-wide">
                                    Y-Axis
                                </label>
                                <select
                                    value={graph.yMetric}
                                    onChange={(e) => updateGraph(graph.id, 'yMetric', e.target.value)}
                                    className="w-full px-2 py-1.5 text-xs border border-zinc-700 rounded bg-zinc-800 text-zinc-200 outline-none focus:border-zinc-500"
                                >
                                    {AVAILABLE_METRICS.map(m => (
                                        <option key={m.id} value={m.id}>{m.label}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex-1 min-w-[120px]">
                                <label className="block text-[10px] font-semibold text-zinc-400 mb-1.5 uppercase tracking-wide">
                                    Chart Type
                                </label>
                                <select
                                    value={graph.chartType}
                                    onChange={(e) => updateGraph(graph.id, 'chartType', e.target.value)}
                                    className="w-full px-2 py-1.5 text-xs border border-zinc-700 rounded bg-zinc-800 text-zinc-200 outline-none focus:border-zinc-500"
                                >
                                    {CHART_TYPES.map(t => (
                                        <option key={t.id} value={t.id}>{t.label}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    )}

                    {/* Chart */}
                    <div className="flex-1 min-h-[300px] w-full relative">
                        {renderChart(graph)}
                    </div>
                </div>
            ))}
        </div>
    );
};

export default CustomGraphBuilder;
