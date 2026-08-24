// app/students/student_documents/components/StudentTable.tsx
'use client';

import React from 'react';
import { ChevronRight, CheckCircle, Clock, AlertCircle, FileText } from 'lucide-react';

interface StudentDocument {
  id: string;
  name: string;
  class: string;
  section: string;
  admissionNo: string;
  verifiedDocs: number;
  totalDocs: number;
  pendingDocs: number;
  missingDocs: number;
  status: 'complete' | 'pending' | 'missing';
  lastUpdated: string;
}

interface StudentTableProps {
  students: StudentDocument[];
}

export function StudentTable({ students }: StudentTableProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'complete': return 'bg-emerald-100 text-emerald-700';
      case 'pending': return 'bg-amber-100 text-amber-700';
      case 'missing': return 'bg-red-100 text-red-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'complete': return <CheckCircle className="w-3.5 h-3.5" />;
      case 'pending': return <Clock className="w-3.5 h-3.5" />;
      case 'missing': return <AlertCircle className="w-3.5 h-3.5" />;
      default: return null;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'complete': return 'Complete';
      case 'pending': return 'Missing documents';
      case 'missing': return 'Missing documents';
      default: return status;
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      {/* Table Header */}
      <div className="grid grid-cols-12 gap-4 px-6 py-4 bg-slate-50 border-b border-slate-200">
        <div className="col-span-3">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Student</span>
        </div>
        <div className="col-span-2">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Class</span>
        </div>
        <div className="col-span-2 text-center">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Verified</span>
        </div>
        <div className="col-span-2 text-center">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pending</span>
        </div>
        <div className="col-span-2">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</span>
        </div>
        <div className="col-span-1 text-right">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Action</span>
        </div>
      </div>

      {/* Students List */}
      <div className="divide-y divide-slate-100">
        {students.map((student) => (
          <div key={student.id} className="grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-slate-50 transition-colors">
            {/* Student Info */}
            <div className="col-span-3 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#0D6EFD] to-blue-400 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                {student.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">{student.name}</p>
                <p className="text-xs text-slate-500">{student.admissionNo}</p>
              </div>
            </div>

            {/* Class */}
            <div className="col-span-2">
              <span className="text-sm text-slate-700">Grade {student.class} - {student.section}</span>
            </div>

            {/* Verified */}
            <div className="col-span-2 text-center">
              <span className="text-sm font-semibold text-slate-900">{student.verifiedDocs} / {student.totalDocs}</span>
            </div>

            {/* Pending */}
            <div className="col-span-2 text-center">
              <span className={`text-sm font-semibold ${student.pendingDocs > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                {student.pendingDocs}
              </span>
            </div>

            {/* Status */}
            <div className="col-span-2">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(student.status)}`}>
                {getStatusIcon(student.status)}
                {getStatusLabel(student.status)}
              </span>
            </div>

            {/* Action */}
            <div className="col-span-1 flex items-center justify-end">
              <button className="flex items-center gap-1 text-sm text-[#0D6EFD] hover:text-blue-700 font-medium transition-colors">
                Review
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {students.length === 0 && (
        <div className="py-12 text-center">
          <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500">No students found matching your filters</p>
        </div>
      )}
    </div>
  );
}