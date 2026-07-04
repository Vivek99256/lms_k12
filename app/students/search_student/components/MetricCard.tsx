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
  const variantStyles = {
    default: 'bg-white border-gray-200',
    success: 'bg-emerald-50 border-emerald-200',
    warning: 'bg-amber-50 border-amber-200',
    danger: 'bg-red-50 border-red-200',
  };

  const iconStyles = {
    default: 'text-[#0D6EFD] bg-blue-100',
    success: 'text-emerald-600 bg-emerald-100',
    warning: 'text-amber-600 bg-amber-100',
    danger: 'text-red-600 bg-red-100',
  };

  return (
    <div className={`rounded-2xl border p-5 ${variantStyles[variant]} transition-all duration-200 hover:shadow-md`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
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
