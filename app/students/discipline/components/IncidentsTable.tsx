"use client";
// components/IncidentsTable.tsx
import React from 'react';
import { Incident } from '../page';
import { Plus } from 'lucide-react';

interface IncidentsTableProps {
  incidents: Incident[];
}

export default function IncidentsTable({ incidents }: IncidentsTableProps) {
  return (
    <div className="mt-4 bg-white rounded">
      <div className="flex justify-between items-center p-4">
        <div>
          <h3 className="font-bold text-slate-950 text-base">Recent incidents</h3>
        </div>
        <button className="inline-flex items-center gap-1.5 border border-slate-200 bg-white hover:bg-slate-50 px-3 py-1.5 rounded-xl font-medium text-xs text-slate-700 shadow-sm transition">
          <Plus size={14} />
          <span>Log incident</span>
        </button>
      </div>

      <div className="overflow-x-auto border border-slate-100 rounded-xl">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 font-semibold text-xs tracking-wider uppercase">
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Student</th>
              <th className="px-4 py-3">Class</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3 text-right">Demerit Points</th>
              <th className="px-4 py-3 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
            {incidents.map((incident, idx) => (
              <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-4 py-3.5 text-slate-500 whitespace-nowrap">{incident.date}</td>
                <td className="px-4 py-3.5 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-xs shrink-0 border border-slate-200">
                    {incident.initials}
                  </div>
                  <span className="font-semibold text-slate-900 whitespace-nowrap">{incident.name}</span>
                </td>
                <td className="px-4 py-3.5 text-slate-500 whitespace-nowrap">
                  Grade {incident.grade} · {incident.section}
                </td>
                <td className="px-4 py-3.5 text-slate-700">{incident.category}</td>
                <td className="px-4 py-3.5 text-right font-bold text-slate-900 font-mono">
                  {incident.demeritPoints}
                </td>
                <td className="px-4 py-3.5 text-center">
                  <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                    incident.status === 'Resolved' 
                      ? 'bg-emerald-50 text-emerald-700' 
                      : incident.status === 'Under review'
                      ? 'bg-amber-50 text-amber-700'
                      : 'bg-rose-50 text-rose-700'
                  }`}>
                    <span className={`w-1 h-1 rounded-full ${
                      incident.status === 'Resolved' 
                        ? 'bg-emerald-500' 
                        : incident.status === 'Under review'
                        ? 'bg-amber-500'
                        : 'bg-rose-500'
                    }`} />
                    {incident.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}