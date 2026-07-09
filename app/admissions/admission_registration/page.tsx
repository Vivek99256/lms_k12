'use client';

import React, { useState } from 'react';
import { 
  FileText, 
  Clock, 
  CreditCard, 
  CheckCircle2, 
  Search, 
  ChevronDown, 
  MoreVertical 
} from 'lucide-react';
import SideDrawer from './components/sideDrawer';

interface RegistrationData {
  no: string;
  student: string;
  initials: string;
  grade: string;
  docs: string;
  docsProgress: number;
  feeStatus: string;
  status: string;
  date: string;
}

export default function RegistrationPipelineContent() {
  // --- Side Drawer States ---
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState<RegistrationData | null>(null);

  const handleRowClick = (rowData: RegistrationData) => {
    setSelectedRow(rowData);
    setIsDrawerOpen(true);
  };

  // --- Metric Cards Data ---
  const metrics = [
    { title: "In registration", value: "24", icon: <FileText className="w-5 h-5 text-indigo-600" />, bgIcon: "bg-indigo-50" },
    { title: "Docs pending", value: "9", icon: <Clock className="w-5 h-5 text-blue-600" />, bgIcon: "bg-blue-50" },
    { title: "Fee collected", value: "₹2.4L", icon: <CreditCard className="w-5 h-5 text-emerald-600" />, bgIcon: "bg-emerald-50" },
    { title: "Verified", value: "11", icon: <CheckCircle2 className="w-5 h-5 text-purple-600" />, bgIcon: "bg-purple-50" }
  ];

  // --- Registration Roster Data ---
  const registrations: RegistrationData[] = [
    { no: 'REG-2026-0208', student: 'Ishaan Gupta', initials: 'IG', grade: 'Grade 9', docs: '5 of 6 verified', docsProgress: 83, feeStatus: 'Paid', status: 'Under verification', date: '29 Jun' },
    { no: 'REG-2026-0207', student: 'Arjun Pillai', initials: 'AP', grade: 'Grade 3', docs: '6 of 6 verified', docsProgress: 100, feeStatus: 'Paid', status: 'Verified', date: '28 Jun' },
    { no: 'REG-2026-0206', student: 'Vivaan Nair', initials: 'VN', grade: 'Grade 6', docs: '6 of 6 verified', docsProgress: 100, feeStatus: 'Paid', status: 'Approved', date: '26 Jun' },
    { no: 'REG-2026-0205', student: 'Kabir Rao', initials: 'KR', grade: 'LKG', docs: '3 of 6 verified', docsProgress: 50, feeStatus: 'Pending', status: 'Pending', date: '25 Jun' },
    { no: 'REG-2026-0204', student: 'Saanvi Deshpande', initials: 'SD', grade: 'Grade 1', docs: '4 of 6 verified', docsProgress: 66, feeStatus: 'Paid', status: 'Under verification', date: '24 Jun' },
    { no: 'REG-2026-0203', student: 'Advait Bose', initials: 'AB', grade: 'Grade 1', docs: '6 of 6 verified', docsProgress: 100, feeStatus: 'Paid', status: 'Verified', date: '22 Jun' },
  ];

  return (
    <div className="space-y-6 bg-[#fff] p-6 min-h-screen text-slate-800">
      
      {/* Title Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900">Registration pipeline</h2>
        <p className="text-sm text-slate-500">Document verification and registration fee status</p>
      </div>

      {/* --- KPI Metric Cards --- */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {metrics.map((metric, idx) => (
          <div key={idx} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-sm font-medium text-slate-500">{metric.title}</span>
              <div className="text-3xl font-bold tracking-tight mt-1 text-slate-900">{metric.value}</div>
            </div>
            <div className={`p-3 rounded-xl ${metric.bgIcon}`}>{metric.icon}</div>
          </div>
        ))}
      </div>

      {/* --- Table Roster Container --- */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        
        {/* Table Filters Header */}
        <div className="p-4 border-b border-slate-100 space-y-3 sm:space-y-0 sm:flex sm:items-center sm:justify-between">
          <div className="text-sm font-medium text-slate-500">
            <span className="text-slate-900 font-semibold">{registrations.length} registrations</span>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input type="text" placeholder="Search registrations…" className="pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none" />
            </div>
            <button className="flex items-center gap-1 px-3 py-1.5 bg-slate-50 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-100 font-medium">
              All statuses <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-400 font-medium border-b border-slate-100">
                <th className="p-4 font-semibold text-xs tracking-wider uppercase">Registration No.</th>
                <th className="p-4 font-semibold text-xs tracking-wider uppercase">Student</th>
                <th className="p-4 font-semibold text-xs tracking-wider uppercase">Grade</th>
                <th className="p-4 font-semibold text-xs tracking-wider uppercase">Documents</th>
                <th className="p-4 font-semibold text-xs tracking-wider uppercase">Reg. Fee</th>
                <th className="p-4 font-semibold text-xs tracking-wider uppercase">Status</th>
                <th className="p-4 font-semibold text-xs tracking-wider uppercase">Submitted</th>
                <th className="p-4 w-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {registrations.map((row) => (
                <tr 
                  key={row.no} 
                  onClick={() => handleRowClick(row)}
                  className="hover:bg-slate-50/70 cursor-pointer transition-colors"
                >
                  <td className="p-4 font-medium text-slate-500">{row.no}</td>
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 font-semibold text-xs flex items-center justify-center">
                        {row.initials}
                      </div>
                      <span className="font-semibold text-slate-900">{row.student}</span>
                    </div>
                  </td>
                  <td className="p-4 text-slate-600">{row.grade}</td>
                  <td className="p-4">
                    <div className="space-y-1 max-w-[120px]">
                      <div className="text-xs text-slate-500">{row.docs}</div>
                      <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-indigo-600 h-1.5 rounded-full" style={{ width: `${row.docsProgress}%` }} />
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className="inline-flex items-center gap-1.5 font-medium text-xs">
                      <span className={`w-1.5 h-1.5 rounded-full ${row.feeStatus === 'Paid' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                      {row.feeStatus}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium
                      ${row.status === 'Approved' ? 'bg-emerald-50 text-emerald-700' : ''}
                      ${row.status === 'Verified' ? 'bg-purple-50 text-purple-700' : ''}
                      ${row.status === 'Under verification' ? 'bg-amber-50 text-amber-700' : ''}
                      ${row.status === 'Pending' ? 'bg-slate-100 text-slate-600' : ''}
                    `}>
                      {row.status}
                    </span>
                  </td>
                  {/* Targeted click interaction section requested */}
                  <td className="p-4 text-indigo-600 font-medium hover:underline">{row.date}</td>
                  <td className="p-4" onClick={(e) => e.stopPropagation()}>
                    <button className="text-slate-400 hover:text-slate-600">
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- Side Drawer Integration --- */}
      <SideDrawer 
        isOpen={isDrawerOpen} 
        onClose={() => setIsDrawerOpen(false)} 
        data={selectedRow} 
      />
    </div>
  );
}