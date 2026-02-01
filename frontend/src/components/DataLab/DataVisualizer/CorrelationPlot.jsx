import React from 'react';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

const CorrelationPlot = ({ data, metrics }) => {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-zinc-400 border border-dashed border-zinc-300 dark:border-zinc-700 rounded-lg">
        No data for scatter plot.
      </div>
    );
  }

  // Expecting at least 2 metrics
  if (metrics.length < 2) {
    return (
      <div className="flex items-center justify-center h-64 text-zinc-400 border border-dashed border-zinc-300 dark:border-zinc-700 rounded-lg">
        Select at least 2 metrics for correlation analysis.
      </div>
    );
  }

  // Assuming data is in [{ co2: 500, temp: 22, ... }] format
  // We'll plot the first two metrics against each other.
  const xMetric = metrics[0];
  const yMetric = metrics[1];

  return (
    <div className="h-96 w-full" style={{ minHeight: '384px' }}>
      <ResponsiveContainer width="100%" height="100%" minHeight={300}>
        <ScatterChart
          margin={{
            top: 20,
            right: 20,
            bottom: 20,
            left: 20,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="number" dataKey={xMetric} name={xMetric} />
          <YAxis type="number" dataKey={yMetric} name={yMetric} />
          <Tooltip cursor={{ strokeDasharray: '3 3' }} />
          <Legend />
          <Scatter
            name={`${xMetric} vs ${yMetric}`}
            data={data}
            fill="#52525b"
            shape="circle"
          />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
};

export default CorrelationPlot;
