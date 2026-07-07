"use client";
// components/MetricCard.tsx
import React from 'react';

interface MetricCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  badge?: { text: string; positive: boolean };
}

export default function MetricCard({ title, value, icon, badge }: MetricCardProps) {
  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm flex justify-between items-start">
      <div className="space-y-2">
        <span className="text-sm font-medium text-slate-500 block">{title}</span>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold text-slate-900">{value}</span>
          {badge && (
            <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
              badge.positive ? 'text-emerald-600 bg-emerald-50' : 'text-rose-600 bg-rose-50'
            }`}>
              {badge.text}
            </span>
          )}
        </div>
      </div>
      <div className="w-9 h-9 rounded-xl bg-indigo-50/60 flex items-center justify-center border border-indigo-50 shrink-0">
        {icon}
      </div>
    </div>
  );
}