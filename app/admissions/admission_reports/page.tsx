"use client";

import React, { useState } from 'react';
import { ArrowUpRight, ArrowUpDown } from 'lucide-react';

interface SourceMetric {
  source: string;
  count: number;
}

interface StatusMetric {
  status: string;
  count: number;
  color: string;
  percentage: number;
  offset: number;
}

interface PerformanceMetric {
  source: string;
  enquiries: number;
  applications: number;
  confirmed: number;
  conversion: number;
}

export default function ReportsDashboard() {
  // 1. Enquiries by Source Data (Vertical Bars)
  const [sourceData] = useState<SourceMetric[]>([
    { source: 'Website', count: 128 },
    { source: 'Referral', count: 85 },
    { source: 'Walk-in', count: 54 },
    { source: 'Social', count: 42 },
    { source: 'Event', count: 31 },
  ]);

  // 2. Enquiries by Status Data (Donut Chart)
  const [statusData] = useState<StatusMetric[]>([
    { status: 'New', count: 62, color: '#4f46e5', percentage: 19.375, offset: 0 },
    { status: 'Contacted', count: 88, color: '#10b981', percentage: 27.5, offset: -19.375 },
    { status: 'Visit', count: 44, color: '#f59e0b', percentage: 13.75, offset: -46.875 },
    { status: 'Application', count: 30, color: '#3b82f6', percentage: 9.375, offset: -60.625 },
    { status: 'Confirmed', count: 96, color: '#a78bfa', percentage: 30.0, offset: -70.0 },
  ]);

  // 3. Source Performance Table & Grouped Bars Data
  const [performanceData] = useState<PerformanceMetric[]>([
    { source: 'Website', enquiries: 118, applications: 52, confirmed: 36, conversion: 31 },
    { source: 'Referral', enquiries: 76, applications: 44, confirmed: 32, conversion: 42 },
    { source: 'Walk-in', enquiries: 54, applications: 22, confirmed: 15, conversion: 28 },
    { source: 'Social', enquiries: 42, applications: 14, confirmed: 8, conversion: 19 },
    { source: 'Event', enquiries: 30, applications: 12, confirmed: 5, conversion: 17 },
  ]);

  const maxAxisValue = 200;
  const totalLeads = 320;

  const handleDetailsRoute = (metricName: string) => {
    alert(`Opening detailed analytical audit trail for: ${metricName}`);
  };

  return (
    <div className="p-8 bg-[#f4f6fa] min-h-screen font-sans antialiased text-slate-800">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* ================= ROW 1: SOURCE BARS & STATUS DONUT ================= */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* 1. Enquiries by Source Column Bar Chart */}
          <section className="lg:col-span-7 bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 tracking-tight">Enquiries by source</h2>
                  <p className="text-xs font-semibold text-slate-400 mt-0.5 tracking-wider uppercase">Cycle 2026-27</p>
                </div>
                <button 
                  onClick={() => handleDetailsRoute('Enquiries by source')}
                  className="text-xs font-semibold text-indigo-600 bg-indigo-50/60 hover:bg-indigo-100/80 px-3 py-1.5 rounded-lg transition-all flex items-center gap-1"
                >
                  Details <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Render Vertical Chart Columns Grouping */}
              <div className="h-64 flex items-end justify-between gap-4 pt-4 px-2 relative">
                {/* Background Grid Axis Guides */}
                <div className="absolute inset-0 flex flex-col justify-between pointer-events-none border-b border-slate-100">
                  <div className="w-full border-t border-slate-100/70 h-0" />
                  <div className="w-full border-t border-slate-100/70 h-0" />
                  <div className="w-full border-t border-slate-100/70 h-0" />
                  <div className="w-full border-t border-slate-100/70 h-0" />
                </div>

                {sourceData.map((item) => {
                  const heightPercentage = (item.count / maxAxisValue) * 100;
                  return (
                    <div key={item.source} className="flex-1 flex flex-col items-center gap-3 relative z-10 group">
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-7 bg-slate-900 text-white text-[11px] font-bold font-mono py-0.5 px-2 rounded shadow-sm">
                        {item.count}
                      </span>
                      <div className="w-full bg-slate-50/40 rounded-t-xl h-48 flex items-end overflow-hidden">
                        <div 
                          className="w-full bg-indigo-600 rounded-t-lg transition-all duration-700 ease-out origin-bottom group-hover:bg-indigo-500"
                          style={{ height: `${heightPercentage}%` }}
                        />
                      </div>
                      <span className="text-xs font-semibold text-slate-500 group-hover:text-slate-800 transition-colors">
                        {item.source}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Chart Y-Axis Scale Reference Marks */}
            <div className="flex items-center justify-between border-t border-slate-100 pt-4 mt-6 text-[10px] font-bold text-slate-400 font-mono tracking-widest px-1">
              <span>0</span><span>50</span><span>100</span><span>150</span><span>200</span>
            </div>
          </section>

          {/* 2. Enquiries by Status Donut Distribution Chart */}
          <section className="lg:col-span-5 bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 tracking-tight">Enquiries by status</h2>
                  <p className="text-xs font-semibold text-slate-400 mt-0.5 tracking-wider uppercase">Current pipeline distribution</p>
                </div>
                <button 
                  onClick={() => handleDetailsRoute('Enquiries by status')}
                  className="text-xs font-semibold text-indigo-600 bg-indigo-50/60 hover:bg-indigo-100/80 px-3 py-1.5 rounded-lg transition-all flex items-center gap-1"
                >
                  Details <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Vector Render Ring Pipeline Chart Layout */}
              <div className="relative w-52 h-52 mx-auto my-6 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                  {statusData.map((segment, index) => (
                    <circle
                      key={index}
                      cx="18"
                      cy="18"
                      r="15.915"
                      fill="none"
                      stroke={segment.color}
                      strokeWidth="4.2"
                      strokeDasharray={`${segment.percentage} ${100 - segment.percentage}`}
                      strokeDashoffset={segment.offset}
                      className="transition-all duration-300 hover:stroke-[5]"
                    />
                  ))}
                </svg>
                <div className="absolute text-center select-none">
                  <span className="block text-4xl font-black text-slate-900 tracking-tight font-mono">
                    {totalLeads}
                  </span>
                  <span className="text-[10px] font-bold tracking-widest text-slate-400 uppercase mt-0.5 block">
                    Total Leads
                  </span>
                </div>
              </div>
            </div>

            {/* Color-Coded Value Reference Legends */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 pt-4 border-t border-slate-100">
              {statusData.map((data) => (
                <div key={data.status} className="flex items-center gap-2 text-xs font-semibold text-slate-600 group cursor-pointer">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: data.color }} />
                  <span className="truncate group-hover:text-slate-900 transition-colors">{data.status}</span>
                  <span className="text-slate-400 font-mono ml-auto">{data.count}</span>
                </div>
              ))}
            </div>
          </section>

        </div>

        {/* ================= ROW 2: TREND LINE & CONVERSION GROUPS ================= */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* 3. Enquiry to Admission Trend (Line Chart) */}
          <section className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 tracking-tight">Enquiry to admission trend</h2>
                  <p className="text-xs text-slate-400 mt-0.5">Monthly, this cycle</p>
                </div>
                <button 
                  onClick={() => handleDetailsRoute('Enquiry Trend')}
                  className="text-xs font-semibold text-indigo-600 bg-indigo-50/60 hover:bg-indigo-100/80 px-3 py-1.5 rounded-lg transition-all flex items-center gap-1"
                >
                  Details <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Native SVG Line Chart Component */}
              <div className="h-44 w-full relative pt-2">
                <svg className="w-full h-full overflow-visible" viewBox="0 0 500 150" preserveAspectRatio="none">
                  <line x1="0" y1="30" x2="500" y2="30" stroke="#f1f5f9" strokeWidth="1" />
                  <line x1="0" y1="70" x2="500" y2="70" stroke="#f1f5f9" strokeWidth="1" />
                  <line x1="0" y1="110" x2="500" y2="110" stroke="#f1f5f9" strokeWidth="1" />
                  
                  {/* Enquiries Path */}
                  <path d="M 20 100 L 110 70 L 200 55 L 290 40 L 385 20 L 480 50" fill="none" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round" />
                  {/* Confirmed Path */}
                  <path d="M 20 130 L 110 125 L 200 115 L 290 100 L 385 105 L 480 118" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" />

                  {/* Nodes */}
                  {[20, 110, 200, 290, 385, 480].map((cx, i) => (
                    <g key={i}>
                      <circle cx={cx} cy={[100, 70, 55, 40, 20, 50][i]} r="3.5" fill="#6366f1" />
                      <circle cx={cx} cy={[130, 125, 115, 100, 105, 118][i]} r="3.5" fill="#10b981" />
                    </g>
                  ))}
                </svg>
              </div>

              <div className="flex justify-between text-[11px] font-medium text-slate-400 font-mono mt-3 px-1">
                <span>Feb</span><span>Mar</span><span>Apr</span><span>May</span><span>Jun</span><span>Jul</span>
              </div>
            </div>

            <div className="flex items-center gap-4 border-t border-slate-50 pt-4 mt-4 text-xs font-semibold">
              <div className="flex items-center gap-1.5 text-slate-600">
                <span className="w-2 h-2 rounded-full bg-[#6366f1]" /> Enquiries
              </div>
              <div className="flex items-center gap-1.5 text-slate-600">
                <span className="w-2 h-2 rounded-full bg-[#10b981]" /> Confirmed
              </div>
            </div>
          </section>

          {/* 4. Conversion by Source (Grouped Bar Chart) */}
          <section className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 tracking-tight">Conversion by source</h2>
                  <p className="text-xs text-slate-400 mt-0.5">Enquiries vs confirmed</p>
                </div>
                <button 
                  onClick={() => handleDetailsRoute('Conversion Source')}
                  className="text-xs font-semibold text-indigo-600 bg-indigo-50/60 hover:bg-indigo-100/80 px-3 py-1.5 rounded-lg transition-all flex items-center gap-1"
                >
                  Details <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Stacked/Grouped Bar Columns Grid Layout */}
              <div className="h-44 flex items-end justify-between gap-2 pt-2 px-2 relative">
                <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                  <div className="w-full border-t border-slate-100 h-0" />
                  <div className="w-full border-t border-slate-100 h-0" />
                  <div className="w-full border-t border-slate-100 h-0" />
                  <div className="w-full border-b border-slate-100 h-0" />
                </div>

                {performanceData.map((item) => (
                  <div key={item.source} className="flex-1 flex flex-col items-center gap-2 relative z-10 group">
                    <div className="w-full flex items-end justify-center gap-1 h-32">
                      <div className="w-2.5 bg-indigo-200 group-hover:bg-indigo-300 rounded-t h-full" style={{ height: `${(item.enquiries / 130) * 100}%` }} />
                      <div className="w-2.5 bg-indigo-600 group-hover:bg-indigo-500 rounded-t h-full" style={{ height: `${(item.confirmed / 130) * 100}%` }} />
                    </div>
                    <span className="text-[11px] font-semibold text-slate-500 truncate max-w-full">
                      {item.source}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-4 border-t border-slate-50 pt-4 mt-4 text-xs font-semibold">
              <div className="flex items-center gap-1.5 text-slate-600">
                <span className="w-2 h-2 rounded-full bg-indigo-200" /> Enquiries
              </div>
              <div className="flex items-center gap-1.5 text-slate-600">
                <span className="w-2 h-2 rounded-full bg-indigo-600" /> Confirmed
              </div>
            </div>
          </section>

        </div>

        {/* ================= ROW 3: SOURCE PERFORMANCE DATA TABLE ================= */}
        <section className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Source performance</h2>
            <p className="text-sm text-slate-400 mt-0.5">Detailed conversion metrics breakdown</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/70 border-b border-slate-100 text-[11px] font-bold text-slate-400 tracking-wider uppercase select-none">
                  <th className="py-4 px-6 font-semibold">
                    <div className="flex items-center gap-1 cursor-pointer hover:text-slate-600">
                      Source <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th className="py-4 px-6 font-semibold text-right">
                    <div className="flex items-center justify-end gap-1 cursor-pointer hover:text-slate-600">
                      Enquiries <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th className="py-4 px-6 font-semibold text-right">
                    <div className="flex items-center justify-end gap-1 cursor-pointer hover:text-slate-600">
                      Applications <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th className="py-4 px-6 font-semibold text-right">
                    <div className="flex items-center justify-end gap-1 cursor-pointer hover:text-slate-600">
                      Confirmed <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th className="py-4 px-6 font-semibold text-right">
                    <div className="flex items-center justify-end gap-1 cursor-pointer hover:text-slate-600">
                      Conversion <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm font-medium text-slate-600">
                {performanceData.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-4 px-6 text-slate-900 font-semibold">{row.source}</td>
                    <td className="py-4 px-6 text-right font-mono text-slate-700">{row.enquiries}</td>
                    <td className="py-4 px-6 text-right font-mono text-slate-700">{row.applications}</td>
                    <td className="py-4 px-6 text-right font-mono text-slate-700">{row.confirmed}</td>
                    <td className="py-4 px-6 text-right font-mono text-emerald-600 font-bold">{row.conversion}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

      </div>
    </div>
  );
}