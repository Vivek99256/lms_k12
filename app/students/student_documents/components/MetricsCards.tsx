// app/students/student_documents/components/MetricsCards.tsx
'use client';

import React from 'react';
import { CheckCircle, Clock, AlertCircle, FileText } from 'lucide-react';

interface MetricsCardsProps {
  verified: number;
  pending: number;
  missing: number;
  total: number;
  complianceRate: number;
}

export function MetricsCards({ verified, pending, missing, total, complianceRate }: MetricsCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-500">Verified</p>
            <p className="text-2xl font-bold text-slate-900">{verified}</p>
          </div>
          <div className="w-11 h-11 rounded-full bg-emerald-100 flex items-center justify-center">
            <CheckCircle className="w-5 h-5 text-emerald-600" />
          </div>
        </div>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-500">Pending Verification</p>
            <p className="text-2xl font-bold text-amber-600">{pending}</p>
          </div>
          <div className="w-11 h-11 rounded-full bg-amber-100 flex items-center justify-center">
            <Clock className="w-5 h-5 text-amber-600" />
          </div>
        </div>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-500">Missing Documents</p>
            <p className="text-2xl font-bold text-red-600">{missing}</p>
          </div>
          <div className="w-11 h-11 rounded-full bg-red-100 flex items-center justify-center">
            <AlertCircle className="w-5 h-5 text-red-600" />
          </div>
        </div>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-500">Compliance</p>
            <p className="text-2xl font-bold text-slate-900">{complianceRate}%</p>
          </div>
          <div className="w-11 h-11 rounded-full bg-blue-100 flex items-center justify-center">
            <FileText className="w-5 h-5 text-blue-600" />
          </div>
        </div>
        <p className="text-xs text-emerald-600 mt-1">↑ 4.6% this month</p>
      </div>
    </div>
  );
}