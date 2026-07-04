// app/students/student_documents/components/DocumentCharts.tsx
'use client';

import React from 'react';
import {
  Chart as ChartJS,
  ArcElement,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  ChartOptions,
} from 'chart.js';
import { Doughnut, Bar } from 'react-chartjs-2';

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

interface DocumentChartsProps {
  verified: number;
  pending: number;
  missing: number;
  gradeData: {
    labels: string[];
    verified: number[];
    pending: number[];
  };
}

export function DocumentCharts({ verified, pending, missing, gradeData }: DocumentChartsProps) {
  // Doughnut chart data
  const doughnutData = {
    labels: ['Completed', 'Pending Verification', 'Missing Documents'],
    datasets: [
      {
        data: [verified, pending, missing],
        backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
        borderColor: '#ffffff',
        borderWidth: 3,
      },
    ],
  };

  const doughnutOptions: ChartOptions<'doughnut'> = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '70%',
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          boxWidth: 10,
          boxHeight: 10,
          usePointStyle: true,
          pointStyle: 'circle',
          color: '#64748b',
          font: { size: 11 },
          padding: 15,
        },
      },
      tooltip: {
        backgroundColor: '#0f172a',
        padding: 12,
        callbacks: {
          label: function(context) {
            const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
            const percentage = Math.round((context.parsed / total) * 100);
            return `${context.label}: ${context.parsed} (${percentage}%)`;
          }
        }
      },
    },
  };

  // Bar chart data
  const barData = {
    labels: gradeData.labels,
    datasets: [
      {
        label: 'Verified',
        data: gradeData.verified,
        backgroundColor: '#10b981',
        borderRadius: 4,
        barThickness: 28,
      },
      {
        label: 'Pending',
        data: gradeData.pending,
        backgroundColor: '#f59e0b',
        borderRadius: 4,
        barThickness: 28,
      },
    ],
  };

  const barOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          boxWidth: 10,
          boxHeight: 10,
          usePointStyle: true,
          pointStyle: 'circle',
          color: '#64748b',
          font: { size: 11 },
          padding: 15,
        },
      },
      tooltip: {
        backgroundColor: '#0f172a',
        padding: 12,
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: '#64748b', font: { size: 11 } },
      },
      y: {
        beginAtZero: true,
        grid: { color: '#e2e8f0' },
        ticks: { color: '#64748b', font: { size: 11 }, stepSize: 5 },
      },
    },
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Doughnut Chart */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Verification Status</h3>
            <p className="text-xs text-slate-500">Share of students by document completeness</p>
          </div>
        </div>
        <div className="h-64">
          <Doughnut data={doughnutData} options={doughnutOptions} />
        </div>
      </div>

      {/* Bar Chart */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Documents by Grade</h3>
            <p className="text-xs text-slate-500">Verified vs pending document count per grade</p>
          </div>
        </div>
        <div className="h-64">
          <Bar data={barData} options={barOptions} />
        </div>
      </div>
    </div>
  );
}