// app/students/attendance/components/DailyRegister.tsx
'use client';

import React from 'react';
import { UserCheck, UserX, AlertCircle } from 'lucide-react';
import type { AttendanceStudent } from '../page';

interface DailyRegisterProps {
  students: AttendanceStudent[];
  onStatusChange: (studentId: string, status: AttendanceStudent['status']) => void;
  selectedDate: Date;
  selectedClass: string;
  getInitials: (name: string) => string;
}

export function DailyRegister({ 
  students, 
  onStatusChange, 
  selectedDate, 
  selectedClass,
  getInitials 
}: DailyRegisterProps) {
  
  const getStatusButton = (student: AttendanceStudent) => {
    const statuses: { key: AttendanceStudent['status']; label: string; icon: React.ReactNode; color: string }[] = [
      { 
        key: 'present', 
        label: 'Present', 
        icon: <UserCheck className="w-4 h-4" />, 
        color: student.status === 'present' ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-white text-slate-600 hover:bg-emerald-50 border-slate-200' 
      },
      {
        key: 'absent',
        label: 'Absent',
        icon: <UserX className="w-4 h-4" />,
        color: student.status === 'absent' ? 'bg-red-500 text-white border-red-500' : 'bg-white text-slate-600 hover:bg-red-50 border-slate-200'
      },
    ];

    return (
      <div className="flex flex-wrap gap-1.5">
        {statuses.map((status) => (
          <button
            key={status.key}
            onClick={() => onStatusChange(student.id, status.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
              student.status === status.key
                ? status.color
                : 'bg-white text-slate-600 hover:bg-slate-50 border-slate-200'
            }`}
          >
            {status.icon}
            <span className="hidden sm:inline">{status.label}</span>
          </button>
        ))}
      </div>
    );
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px]">
        <thead className="border-b border-slate-200 bg-slate-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Roll</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Student</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Attendance</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {students.map((student) => (
            <tr key={student.id} className="hover:bg-slate-50">
              <td className="px-4 py-3 text-sm font-medium text-slate-700">{student.rollNo}</td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#eef2ff] text-xs font-bold text-[#3f5bf6]">
                    {getInitials(student.name)}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-950">{student.name}</p>
                    <p className="text-xs text-slate-500">{student.admissionNo}</p>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3">
                {getStatusButton(student)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Empty State */}
      {students.length === 0 && (
        <div className="py-12 text-center">
          <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500">No students found for this class</p>
        </div>
      )}
    </div>
  );
}