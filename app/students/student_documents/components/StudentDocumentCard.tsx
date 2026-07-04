// app/students/student_documents/components/StudentDocumentCard.tsx
'use client';

import React from 'react';
import { CheckCircle, Clock, AlertCircle, MoreVertical } from 'lucide-react';

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

interface StudentDocumentCardProps {
  student: StudentDocument;
}

export function StudentDocumentCard({ student }: StudentDocumentCardProps) {
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
      case 'complete': return <CheckCircle className="w-4 h-4" />;
      case 'pending': return <Clock className="w-4 h-4" />;
      case 'missing': return <AlertCircle className="w-4 h-4" />;
      default: return null;
    }
  };

  return (
    <div className="flex items-center justify-between p-4 hover:bg-slate-50 rounded-lg transition-colors border-b border-slate-100 last:border-0">
      <div className="flex items-center gap-4 flex-1">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#0D6EFD] to-blue-400 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
          {student.name.split(' ').map(n => n[0]).join('')}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900">{student.name}</p>
          <p className="text-xs text-slate-500">Grade {student.class} - {student.section} · {student.admissionNo}</p>
        </div>
      </div>
      
      <div className="flex items-center gap-6">
        <div className="text-center">
          <p className="text-sm font-semibold text-slate-900">{student.verifiedDocs}/{student.totalDocs}</p>
          <p className="text-xs text-slate-500">Verified</p>
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-amber-600">{student.pendingDocs}</p>
          <p className="text-xs text-slate-500">Pending</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(student.status)}`}>
            {getStatusIcon(student.status)}
            {student.status.charAt(0).toUpperCase() + student.status.slice(1)}
          </span>
        </div>
        <button className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
          <MoreVertical className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}