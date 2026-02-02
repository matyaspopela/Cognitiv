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
      <div className="flex items-center justify-center h-full min-h-[300px] text-zinc-500 font-medium">
        No data to display. Select filters and click "Apply".
      </div>
    );
  }

  // Generate lines for each metric - using light colors for visibility on black background
  const colors = ['#ffffff', '#a1a1aa', '#d4d4d8', '#71717a']; // White to light gray palette

  return (
    <div className="w-full h-full min-h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{
            top: 10,
            right: 10,
            left: 0,
            bottom: 0,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
          <XAxis
            dataKey="timestamp"
            tickFormatter={(str) => new Date(str).toLocaleDateString()}
            stroke="#71717a"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tickMargin={10}
          />
          <YAxis
            stroke="#71717a"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tickMargin={10}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#18181b',
              borderColor: '#27272a',
              color: '#f4f4f5',
              borderRadius: '8px',
              fontSize: '12px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
            }}
            itemStyle={{ color: '#d4d4d8' }}
            cursor={{ stroke: '#52525b', strokeDasharray: '3 3' }}
          />
          <Legend wrapperStyle={{ paddingTop: '20px' }} />
          {metrics.map((metric, index) => (
            <Line
              key={metric}
              type="monotone"
              dataKey={metric}
              stroke={colors[index % colors.length]}
              strokeWidth={3}
              dot={false}
              activeDot={{ r: 6, strokeWidth: 0, fill: colors[index % colors.length] }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default TrendChart;
