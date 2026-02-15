import React from 'react';
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { theme } from '../../design/theme';

ChartJS.register(ArcElement, Tooltip, Legend);

const CircularGauge = ({ value, label = "AQI", status, size = 120 }) => {
    // Determine color based on AQI value (0-100)
    // 100-90: Excellent/Good (Green)
    // 90-50: Fair (Yellow)
    // 50-0: Poor (Red)

    let color = theme.colors.safe; // Default Green
    if (value < 50) {
        color = theme.colors.danger; // Red
    } else if (value < 90) {
        color = theme.colors.warning; // Yellow
    }

    // Background color for the empty part of the gauge
    const emptyColor = 'rgba(255, 255, 255, 0.05)';

    const data = {
        datasets: [
            {
                data: [value, 100 - value],
                backgroundColor: [color, emptyColor],
                borderWidth: 0,
                cutout: '85%', // Thinner ring
                circumference: 360,
                rotation: 0,
            },
        ],
    };

    const options = {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
            legend: { display: false },
            tooltip: { enabled: false }, // Disable tooltip for simple gauge
        },
        animation: {
            animateScale: true,
            animateRotate: true
        }
    };

    return (
        <div style={{ position: 'relative', display: 'inline-flex', justifyContent: 'center', alignItems: 'center' }}>
            <div style={{ width: size, height: size }}>
                <Doughnut data={data} options={options} />
            </div>
            <div
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    bottom: 0,
                    right: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
            >
                <div className="text-4xl font-bold text-zinc-100 leading-none">
                    {Math.round(value)}
                </div>
                {status && (
                    <div className="text-sm font-medium mt-1" style={{ color: color }}>
                        {status}
                    </div>
                )}
                <div className="text-[10px] text-zinc-600 uppercase tracking-widest mt-1">
                    {label}
                </div>
            </div>
        </div>
    );
};

export default CircularGauge;
