"use client";
// components/DisciplineChart.tsx
import React from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

export default function DisciplineChart() {
  const data = {
    labels: [
      'Late to class',
      'Uniform violation',
      'Disruptive behaviour',
      'Missing homework',
      'Damage to property',
    ],
    datasets: [
      {
        data: [2, 1, 5, 2, 8],
        backgroundColor: [
          '#f59e0b', // Amber
          '#3b82f6', // Blue
          '#ef4444', // Red
          '#64748b', // Slate
          '#8b5cf6', // Purple
        ],
        borderRadius: 4,
        barThickness: 14,
      },
    ],
  };

  const options = {
    indexAxis: 'y' as const,
    responsive: true,
    scales: {
      x: {
        grid: { color: '#f1f5f9' },
        ticks: { stepSize: 1, font: { size: 11 } },
      },
      y: {
        grid: { display: false },
        ticks: { font: { size: 12, weight: 500 } },
      },
    },
    plugins: {
      legend: { display: false },
    },
    maintainAspectRatio: false,
  };

  return (
    <div className="h-full flex flex-col justify-between">
      <div>
        <h3 className="font-bold text-slate-900 text-base">Demerit points by category</h3>
        <p className="text-xs text-slate-400 mt-0.5">Where behavioural points are concentrated this term</p>
      </div>
      <div className="h-56 mt-4">
        <Bar data={data} options={options} />
      </div>
    </div>
  );
}