'use client';

import React from 'react';
import AttendanceReportsPage from '@/app/hrit/attendance-management/attendance-reports/page';

export function HrmsAttendanceReportView() {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[#D9E3F1] bg-white p-3.5 shadow-sm">
        <h3 className="text-sm font-bold text-slate-800">HRMS Staff Attendance Report</h3>
        <p className="text-xs text-slate-500">
          Comprehensive employee attendance tracking, department summaries, shift timings, overtime, and early-departure analytics.
        </p>
      </div>

      <AttendanceReportsPage />
    </div>
  );
}

