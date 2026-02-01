import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

const TrendChart = ({ data, metrics }) => {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-zinc-400 border border-dashed border-zinc-300 dark:border-zinc-700 rounded-lg">
        No data to display. Select filters and click "Apply".
      </div>
    );
  }

  // Generate lines for each metric
  // For simplicity, we'll map metrics to lines. In a real scenario, we might want multiple axes.
  const colors = ['#18181b', '#52525b', '#a1a1aa', '#d4d4d8']; // Zinc palette

  return (
    <div className="h-96 w-full" style={{ minHeight: '384px' }}>
      <ResponsiveContainer width="100%" height="100%" minHeight={300}>
        <LineChart
          data={data}
          margin={{
            top: 5,
            right: 30,
            left: 20,
            bottom: 5,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} />
          <XAxis
            dataKey="timestamp"
            tickFormatter={(str) => new Date(str).toLocaleDateString()}
            stroke="#71717a"
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            stroke="#71717a"
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#fff',
              border: '1px solid #e4e4e7',
              borderRadius: '6px',
              fontSize: '12px'
            }}
          />
          <Legend />
          {metrics.map((metric, index) => (
            <Line
              key={metric}
              type="monotone"
              dataKey={metric}
              stroke={colors[index % colors.length]}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 6 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default TrendChart;
