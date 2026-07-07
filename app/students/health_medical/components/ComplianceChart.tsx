"use client";
// components/ComplianceChart.tsx
import React from 'react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip, Legend);

interface ComplianceChartProps {
  compliancePercentage: number;
}

export default function ComplianceChart({ compliancePercentage }: ComplianceChartProps) {
  const data = {
    labels: ['Up to date', 'Overdue'],
    datasets: [
      {
        data: [compliancePercentage, 100 - compliancePercentage],
        backgroundColor: ['#10b981', '#f59e0b'], // Emerald and Amber
        borderWidth: 0,
        cutout: '72%',
      },
    ],
  };

  const options = {
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: { boxWidth: 10, padding: 20, font: { family: 'sans-serif', size: 12 } },
      },
    },
    maintainAspectRatio: false,
  };

  return (
    <div className="flex flex-col h-full justify-between">
      <div className="relative w-44 h-44 mx-auto my-6 flex items-center justify-center">
        <Doughnut data={data} options={options} />
        <div className="absolute text-center transform -translate-y-2">
          <span className="text-3xl font-extrabold text-slate-900">{compliancePercentage}%</span>
          <span className="block text-[10px] uppercase tracking-wider text-slate-400 font-bold mt-0.5">Compliant</span>
        </div>
      </div>
    </div>
  );
}