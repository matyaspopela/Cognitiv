import React, { useState } from 'react';
import {
    LineChart,
    Line,
    BarChart,
    Bar,
    ScatterChart,
    Scatter,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    ReferenceArea,
    ReferenceLine,
} from 'recharts';
import { Plus, X, Layers, TrendingUp, BarChart3, ScatterChart as ScatterIcon } from 'lucide-react';
import { colors } from '../../../design/tokens';
import { getCo2Style } from '../../../utils/colors';

// Subject color palette (10 distinct colors)
const SUBJECT_COLORS = [
    '#3B82F6', // Blue
    '#10B981', // Emerald
    '#F59E0B', // Amber
    '#8B5CF6', // Purple
    '#EF4444', // Red
    '#06B6D4', // Cyan
    '#EC4899', // Pink
    '#84CC16', // Lime
    '#F97316', // Orange
    '#6366F1', // Indigo
];

// Available metrics from annotated_readings
const AVAILABLE_METRICS = [
    { id: 'co2', label: 'CO₂ (ppm)', type: 'numeric' },
    { id: 'temp', label: 'Temperature (°C)', type: 'numeric' },
    { id: 'humidity', label: 'Humidity (%)', type: 'numeric' },
    { id: 'delta_co2', label: 'ΔCO₂', type: 'numeric' },
    { id: 'mold_factor', label: 'Mold Factor', type: 'numeric' },
    { id: 'occupancy', label: 'Occupancy', type: 'numeric' },
];

// Background layer options (categorical metadata)
const BACKGROUND_OPTIONS = [
    { id: 'none', label: 'None' },
    { id: 'subject', label: 'Subject' },
    { id: 'teacher', label: 'Teacher' },
    { id: 'co2_zone', label: 'CO₂ Safety Zone' },
];

// Chart types
const CHART_TYPES = [
    { id: 'line', label: 'Line', icon: TrendingUp },
    { id: 'bar', label: 'Bar', icon: BarChart3 },
    { id: 'scatter', label: 'Scatter', icon: ScatterIcon },
];

/**
 * Extract lesson/subject blocks from time-series data
 * Returns array of { start, end, value, color } for ReferenceArea rendering
 */
const extractContextBlocks = (data, field) => {
    if (!data || data.length === 0) return [];

    const blocks = [];
    let currentValue = null;
    let currentStart = null;
    let colorIndex = 0;
    const valueColorMap = {};

    data.forEach((point, index) => {
        const value = point[field];

        if (value !== currentValue) {
            // Value changed - close previous block if exists
            if (currentValue !== null && currentStart !== null) {
                if (!valueColorMap[currentValue]) {
                    valueColorMap[currentValue] = SUBJECT_COLORS[colorIndex % SUBJECT_COLORS.length];
                    colorIndex++;
                }

                blocks.push({
                    start: currentStart,
                    end: point.timestamp,
                    value: currentValue,
                    color: valueColorMap[currentValue],
                });
            }

            // Start new block
            currentValue = value;
            currentStart = point.timestamp;
        }

        // Handle last point
        if (index === data.length - 1 && currentValue !== null) {
            if (!valueColorMap[currentValue]) {
                valueColorMap[currentValue] = SUBJECT_COLORS[colorIndex % SUBJECT_COLORS.length];
            }

            blocks.push({
                start: currentStart,
                end: point.timestamp,
                value: currentValue,
                color: valueColorMap[currentValue],
            });
        }
    });

    return blocks;
};

/**
 * Extract CO₂ safety zones for background coloring
 */
const extractCO2Zones = (data) => {
    if (!data || data.length === 0) return [];

    const blocks = [];
    let currentZone = null;
    let currentStart = null;

    const getZone = (co2) => {
        if (co2 < 800) return { name: 'safe', color: '#10B981' }; // Emerald
        if (co2 < 1200) return { name: 'warning', color: '#F59E0B' }; // Amber
        return { name: 'critical', color: '#EF4444' }; // Red
    };

    data.forEach((point, index) => {
        const zone = getZone(point.co2 || 0);

        if (!currentZone || zone.name !== currentZone.name) {
            if (currentZone !== null) {
                blocks.push({
                    start: currentStart,
                    end: point.timestamp,
                    value: currentZone.name,
                    color: currentZone.color,
                });
            }

            currentZone = zone;
            currentStart = point.timestamp;
        }

        if (index === data.length - 1) {
            blocks.push({
                start: currentStart,
                end: point.timestamp,
                value: currentZone.name,
                color: currentZone.color,
            });
        }
    });

    return blocks;
};

const DataLabGraph = ({ data, layers = [], backgroundLayer = 'none' }) => {
    if (!data || data.length === 0) {
        return (
            <div className="flex items-center justify-center h-full min-h-[400px] text-zinc-500 font-medium">
                No data available. Adjust filters.
            </div>
        );
    }

    // Extract background blocks based on selection
    let backgroundBlocks = [];
    if (backgroundLayer === 'subject' || backgroundLayer === 'teacher') {
        backgroundBlocks = extractContextBlocks(data, backgroundLayer);
    } else if (backgroundLayer === 'co2_zone') {
        backgroundBlocks = extractCO2Zones(data);
    }

    // Generate legend items based on background layer
    const getLegendItems = () => {
        if (backgroundLayer === 'none') return [];

        if (backgroundLayer === 'co2_zone') {
            return [
                { label: 'Safe (< 800 ppm)', color: '#10B981' },
                { label: 'Warning (800-1200 ppm)', color: '#F59E0B' },
                { label: 'Critical (> 1200 ppm)', color: '#EF4444' }
            ];
        } else if (backgroundLayer === 'subject' || backgroundLayer === 'teacher') {
            // Get unique colors from background blocks
            const uniqueBlocks = backgroundBlocks.reduce((acc, block) => {
                if (!acc.find(b => b.value === block.value)) {
                    acc.push(block);
                }
                return acc;
            }, []);
            return uniqueBlocks.map(block => ({
                label: block.value || 'Unknown',
                color: block.color
            }));
        }
        return [];
    };

    const legendItems = getLegendItems();

    const commonProps = {
        margin: { top: 20, right: 30, left: 10, bottom: 10 },
    };

    const xAxisProps = {
        dataKey: 'timestamp',
        stroke: colors.text.tertiary,
        fontSize: 11,
        tickLine: false,
        axisLine: false,
        tickMargin: 10,
        className: 'font-ui',
        tickFormatter: (str) => {
            try {
                const date = new Date(str);
                return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            } catch {
                return str;
            }
        },
        minTickGap: 30
    };

    const yAxisProps = {
        stroke: colors.text.tertiary,
        fontSize: 11,
        tickLine: false,
        axisLine: false,
        tickMargin: 10,
        domain: ['auto', 'auto'],
        className: 'font-data',
    };

    const tooltipProps = {
        contentStyle: {
            backgroundColor: colors.base.surface,
            borderColor: colors.borders.medium,
            color: colors.text.primary,
            borderRadius: '12px',
            fontSize: '12px',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)',
            backdropFilter: 'blur(8px)',
        },
        itemStyle: {
            color: colors.text.secondary,
            fontFamily: "'JetBrains Mono', monospace",
        },
        cursor: { stroke: colors.borders.strong, strokeDasharray: '3 3' },
        labelFormatter: (label) => {
            try {
                return new Date(label).toLocaleString();
            } catch {
                return label;
            }
        },
    };

    // Determine which chart type to use (use first visible layer's type)
    const primaryLayer = layers.find(l => l.visible);
    const chartType = primaryLayer?.type || 'line';

    const getMetricColor = (metricId) => {
        const colorMap = {
            co2: colors.accent.primary,
            temp: colors.accent.secondary,
            humidity: colors.semantic.safe.color,
            mold_factor: colors.semantic.warning.color,
            delta_co2: '#8B5CF6',
            occupancy: '#F97316',
        };
        return colorMap[metricId] || colors.text.secondary;
    };

    const renderChart = () => {
        // Guard against missing data
        if (!data || data.length === 0) {
            return (
                <div className="flex items-center justify-center h-full text-zinc-500 text-sm">
                    No data available for selected range
                </div>
            );
        }



        // For line/bar/scatter charts
        const ChartComponent = {
            line: LineChart,
            bar: BarChart,
            scatter: ScatterChart,
        }[chartType] || LineChart;

        return (
            <ResponsiveContainer width="100%" height="100%" minHeight={400}>
                <ChartComponent data={data} {...commonProps}>
                    {/* Background Layer - Render FIRST so it's behind everything */}
                    {backgroundBlocks.map((block, idx) => (
                        <ReferenceArea
                            key={`bg-${idx}`}
                            x1={block.start}
                            x2={block.end}
                            fill={block.color}
                            fillOpacity={0.1}
                            strokeOpacity={0}
                        />
                    ))}

                    <CartesianGrid
                        strokeDasharray="3 3"
                        stroke={colors.borders.subtle}
                        vertical={false}
                    />
                    <XAxis {...xAxisProps} />
                    <YAxis {...yAxisProps} />
                    <Tooltip {...tooltipProps} />

                    {/* Foreground Layers - Render metrics */}
                    {layers.filter(l => l.visible).map((layer) => {
                        const metricColor = getMetricColor(layer.metric);

                        if (chartType === 'line') {
                            return (
                                <Line
                                    key={layer.id}
                                    type="monotone"
                                    dataKey={layer.metric}
                                    stroke={metricColor}
                                    strokeWidth={2}
                                    dot={false}
                                    connectNulls={false}
                                    activeDot={{
                                        r: 5,
                                        strokeWidth: 0,
                                        fill: metricColor,
                                    }}
                                />
                            );
                        } else if (chartType === 'bar') {
                            return (
                                <Bar
                                    key={layer.id}
                                    dataKey={layer.metric}
                                    fill={metricColor}
                                    radius={[4, 4, 0, 0]}
                                />
                            );
                        } else if (chartType === 'scatter') {
                            return (
                                <Scatter
                                    key={layer.id}
                                    name={layer.metric}
                                    data={data}
                                    fill={metricColor}
                                    shape="circle"
                                />
                            );
                        }
                        return null;
                    })}
                </ChartComponent>
            </ResponsiveContainer>
        );
    };

    return (
        <div className="flex flex-col h-full min-h-[400px]">
            {/* Legend */}
            {legendItems.length > 0 && (
                <div className="flex items-center gap-4 px-4 py-2 mb-2 text-xs">
                    <span className="text-zinc-500 font-medium uppercase tracking-wide">Background:</span>
                    {legendItems.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                            <div
                                className="w-3 h-3 rounded"
                                style={{ backgroundColor: item.color }}
                            />
                            <span className="text-zinc-400">{item.label}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* Chart */}
            <div className="flex-1 relative rounded-xl overflow-hidden w-full h-full min-h-[400px]">
                {renderChart()}
            </div>
        </div>
    );
};

export default DataLabGraph;
