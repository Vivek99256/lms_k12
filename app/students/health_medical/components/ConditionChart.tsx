"use client";
// components/ConditionChart.tsx
import React from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

export default function ConditionChart() {
  const data = {
    labels: ['Asthma', 'Peanut allergy', 'Dust allergy', 'Lactose intolerance', 'Type 1 diabetes', 'Epilepsy'],
    datasets: [
      {
        data: [5, 5, 5, 5, 5, 5], // Equal balance distribution as rendered on preview page
        backgroundColor: '#6366f1', // Beautiful Indigo
        borderRadius: 4,
        barThickness: 12,
      },
    ],
  };

  const options = {
    indexAxis: 'y' as const,
    responsive: true,
    scales: {
      x: { grid: { display: false }, ticks: { stepSize: 1, font: { size: 11 } } },
      y: { grid: { display: false }, ticks: { font: { size: 12, weight: '500' } } },
    },
    plugins: { legend: { display: false } },
    maintainAspectRatio: false,
  };

  return (
    <div className="h-full flex flex-col justify-between">
      <div className="h-48 mt-4">
        <Bar data={data} options={options} />
      </div>
    </div>
  );
}