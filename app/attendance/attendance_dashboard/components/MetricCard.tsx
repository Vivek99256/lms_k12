'use client';

import React from 'react';

export interface MetricCardProps {
  title: string;
  value: string;
  trend?: { direction: 'up' | 'down' | 'flat'; value: string; label: string };
  icon: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger';
}

export function MetricCard({ title, value, trend, icon, variant = 'default' }: MetricCardProps) {
  const iconStyles = {
    default: 'text-[#3f5bf6] bg-[#eef2ff]',
    success: 'text-emerald-600 bg-emerald-50',
    warning: 'text-amber-600 bg-amber-50',
    danger: 'text-red-600 bg-red-50',
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="mb-2 text-xs font-medium text-slate-500">{title}</p>
          <p className="text-2xl font-bold leading-none text-slate-950">{value}</p>
          {trend && (
            <div className="flex items-center gap-1 mt-2">
              {trend.direction === 'up' && <span className="text-emerald-500">↑</span>}
              {trend.direction === 'down' && <span className="text-red-500">↓</span>}
              {trend.direction === 'flat' && <span className="text-gray-400">−</span>}
              <span className={`text-xs font-medium ${
                trend.direction === 'up' ? 'text-emerald-600' : trend.direction === 'down' ? 'text-red-600' : 'text-gray-500'
              }`}>
                {trend.value}
              </span>
              <span className="text-xs text-gray-400">{trend.label}</span>
            </div>
          )}
        </div>
        <div className={`p-3 rounded-xl ${iconStyles[variant]}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}
