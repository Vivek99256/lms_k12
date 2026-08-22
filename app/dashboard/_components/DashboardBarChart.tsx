'use client';

import React from 'react';
import { BarElement, CategoryScale, Chart as ChartJS, Legend, LinearScale, Tooltip, type ChartOptions } from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const CHART_OPTIONS: ChartOptions<'bar'> = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: { backgroundColor: '#0f172a', padding: 10, cornerRadius: 6 },
  },
  scales: {
    x: { grid: { display: false }, ticks: { color: '#64748b', font: { size: 12 } } },
    y: { beginAtZero: true, grid: { color: '#f1f5f9' }, ticks: { color: '#64748b', font: { size: 12 } } },
  },
};

export function DashboardBarChart({
  labels,
  values,
  color = '#4F46E5',
  height = 260,
}: {
  labels: string[];
  values: number[];
  color?: string;
  height?: number;
}) {
  return (
    <div style={{ height }}>
      <Bar
        data={{
          labels,
          datasets: [
            {
              data: values,
              backgroundColor: color,
              borderRadius: 6,
              maxBarThickness: 48,
            },
          ],
        }}
        options={CHART_OPTIONS}
      />
    </div>
  );
}
