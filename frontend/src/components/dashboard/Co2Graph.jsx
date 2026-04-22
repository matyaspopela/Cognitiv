import { useState, useEffect, useRef, useMemo } from 'react';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler,
    TimeScale,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import 'chartjs-adapter-date-fns';
import { historyAPI } from '../../services/api';
import {
    baseOptions,
    createThresholdGradient,
    CO2_THRESHOLDS,
    chartColors,
    semanticColors
} from '../../utils/chartSystem';
import { getTimeWindowRange, getBucketSize } from '../../utils/timeWindow';
import ProgressBar from '../ui/ProgressBar';

// Register Chart.js components
ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler,
    TimeScale
);

/**
 * Filter series data to only include points within the requested time range
 */
const filterSeriesInRange = (series, startISO, endISO) => {
    if (!series || !Array.isArray(series)) return [];

    const startTime = new Date(startISO).getTime();
    const endTime = new Date(endISO).getTime();

    return series.filter(item => {
        if (!item.bucket_start) return false;
        const pointTime = new Date(item.bucket_start).getTime();
        return pointTime >= startTime && pointTime <= endTime;
    });
};

const Co2Graph = ({ deviceId, timeWindow }) => {
    const [chartData, setChartData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const chartRef = useRef(null);

    useEffect(() => {
        const loadChartData = async () => {
            if (!deviceId) return;

            try {
                setLoading(true);
                setError(null);
                setChartData(null);
                const { start, end } = getTimeWindowRange(timeWindow);
                const bucket = getBucketSize(timeWindow);

                const response = await historyAPI.getSeries(start, end, bucket, deviceId);

                const seriesData = response?.data || response;

                if (seriesData?.status === 'success' && Array.isArray(seriesData.series)) {
                    const filteredSeries = filterSeriesInRange(seriesData.series, start, end);

                    if (filteredSeries.length > 0) {
                        const labels = filteredSeries.map(item => new Date(item.bucket_start));
                        const values = filteredSeries.map(item => {
                            const val = item.co2?.avg ?? item.co2;
                            return val !== null && val !== undefined ? Number(val) : null;
                        });

                        setChartData({
                            labels,
                            datasets: [{
                                label: 'CO₂',
                                data: values,
                                fill: true,
                                // Segment coloring: each line segment gets colored based on its CO₂ value.
                                // This runs at draw-time (not during dataset resolution), so no canvas crashes.
                                segment: {
                                    borderColor: (ctx) => {
                                        const v = ctx.p1.parsed.y
                                        if (v == null) return chartColors.stone[300]
                                        if (v < 800)  return semanticColors.safe.line
                                        if (v < 1200) return semanticColors.warning.line
                                        if (v < 1800) return '#EA580C' // orange-600
                                        return semanticColors.critical.line
                                    }
                                },
                                borderWidth: 2,
                                tension: 0.3,
                                pointRadius: 0,
                                spanGaps: true,
                                // backgroundColor gradient applied after render (see useEffect below)
                                backgroundColor: 'transparent',
                            }]
                        });
                    } else {
                        setError('No data points found for selected range');
                    }
                } else {
                    setError('No data available');
                }
            } catch (err) {
                console.error('Error loading CO2 graph:', err);
                setError('Failed to connect to laboratory data');
            } finally {
                setLoading(false);
            }
        };

        loadChartData();
    }, [deviceId, timeWindow]);

    // Apply gradient after chart rendering
    useEffect(() => {
        const chart = chartRef.current;
        if (!chart || !chartData) return;

        const { ctx, chartArea, scales } = chart;
        if (!chartArea || !scales.y) return;

        const gradient = createThresholdGradient(ctx, chartArea, scales);
        chart.data.datasets[0].backgroundColor = gradient;
        chart.update('none');
    }, [chartData]);

    const options = useMemo(() => ({
        ...baseOptions,
        scales: {
            ...baseOptions.scales,
            x: {
                ...baseOptions.scales.x,
                type: 'time',
                time: {
                    unit: timeWindow === '1h' || timeWindow === '6h' ? 'minute' : 'hour',
                    displayFormats: {
                        minute: 'HH:mm',
                        hour: 'HH:mm',
                        day: 'MMM d'
                    },
                    tooltipFormat: 'MMM d, HH:mm'
                },
                ticks: {
                    ...baseOptions.scales.x.ticks,
                    maxTicksLimit: 6,
                }
            },
            y: {
                ...baseOptions.scales.y,
                min: 400, // Typical outdoor CO2 level
                suggestedMax: 1500,
                ticks: {
                    ...baseOptions.scales.y.ticks,
                    callback: (value) => `${value} ppm`
                }
            }
        },
        plugins: {
            ...baseOptions.plugins,
            tooltip: {
                ...baseOptions.plugins.tooltip,
                callbacks: {
                    label: (context) => ` ${context.parsed.y} ppm`
                }
            }
        }
    }), [timeWindow]);

    // Calculate Average from displayed data
    const averageCo2 = useMemo(() => {
        if (!chartData?.datasets?.[0]?.data) return null;
        const values = chartData.datasets[0].data.filter(v => v !== null && v !== undefined);
        if (values.length === 0) return null;
        const sum = values.reduce((a, b) => a + b, 0);
        return Math.round(sum / values.length);
    }, [chartData]);

    return (
        <div className="w-full h-full flex flex-col">
            <div className="flex items-center justify-between mb-4 px-1">
                <div className="flex items-center gap-3">
                    <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-stone-500">
                        Historical CO₂ Distribution
                    </span>
                    {averageCo2 !== null && (
                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-stone-100 border border-stone-200">
                            <span className="text-[10px] font-medium text-stone-400">AVG</span>
                            <span className="text-[10px] font-mono font-bold text-stone-600">{averageCo2} PPM</span>
                        </div>
                    )}
                </div>
                
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500/20 border border-green-500/40"></div>
                        <span className="text-[10px] font-medium text-stone-400">Safe</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-amber-500/20 border border-amber-500/40"></div>
                        <span className="text-[10px] font-medium text-stone-400">Warning</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-red-500/20 border border-red-500/40"></div>
                        <span className="text-[10px] font-medium text-stone-400">Critical</span>
                    </div>
                </div>
            </div>

            <div className="flex-1 min-h-[240px] relative">
                {loading ? (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <ProgressBar indeterminate />
                    </div>
                ) : error ? (
                    <div className="absolute inset-0 flex items-center justify-center text-stone-400">
                        <p className="text-xs font-medium">{error}</p>
                    </div>
                ) : chartData ? (
                    <Line ref={chartRef} data={chartData} options={options} />
                ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-stone-400">
                        <p className="text-xs font-medium">Insufficient data points</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Co2Graph;
