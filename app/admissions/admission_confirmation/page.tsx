'use client';

import React, { useState } from 'react';
import { 
  Users, 
  Layers, 
  UserMinus, 
  UserCheck, 
  Search, 
  ChevronDown, 
  MoreVertical,
  Maximize2,
  X,
  CheckCircle2,
  FileText,
  ExternalLink,
  Clock,
  User,
  Check,
  AlertCircle
} from 'lucide-react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

// --- Type Definitions ---
interface ConfirmationData {
  no: string;
  student: string;
  initials: string;
  grade: string;
  rollNo: string;
  section: string;
  status: 'Verified' | 'Confirmed' | 'Pending' | 'Approved';
  date: string;
  docs: string;
  feeStatus: string;
}

type TabType = 'Overview' | 'Documents' | 'History' | 'Activity & audit';

export default function ConfirmationScreen() {
  // --- Global States ---
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState<ConfirmationData | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('Overview');

  const handleOpenDrawer = (rowData: ConfirmationData) => {
    setSelectedRow(rowData);
    setActiveTab('Overview'); // Reset to default tab when opened
    setIsDrawerOpen(true);
  };

  // --- KPI Metrics ---
  const confirmationMetrics = [
    { title: "Confirmed admissions", value: "96", change: "+14 this week", icon: <UserCheck className="w-5 h-5 text-indigo-600" />, bg: "bg-indigo-50" },
    { title: "Seats filled", value: "258 / 300", change: "86% capacity", icon: <Layers className="w-5 h-5 text-blue-600" />, bg: "bg-blue-50" },
    { title: "Pending allocation", value: "8", change: "Awaiting roll no.", icon: <Users className="w-5 h-5 text-amber-600" />, bg: "bg-amber-50" },
    { title: "Cancellations", value: "4", change: "-1 vs last cycle", icon: <UserMinus className="w-5 h-5 text-rose-600" />, bg: "bg-rose-50" }
  ];

  // --- Seat Allocation Chart Config ---
  const chartData = {
    labels: ['1-A', '1-B', '3-A', '6-A', '6-B', '9-A'],
    datasets: [
      { label: 'Allocated', data: [38, 42, 30, 45, 35, 28], backgroundColor: '#4F46E5', borderRadius: 4 },
      { label: 'Capacity', data: [50, 50, 40, 50, 50, 40], backgroundColor: '#10B981', borderRadius: 4 }
    ]
  };

  // --- Roster Pool Data ---
  const candidates: ConfirmationData[] = [
    { no: 'REG-2026-0207', student: 'Arjun Pillai', initials: 'AP', grade: 'Grade 3', rollNo: 'Auto', section: 'Unassigned', status: 'Verified', date: '28 Jun', docs: '6 of 6 verified', feeStatus: 'Paid' },
    { no: 'REG-2026-0203', student: 'Advait Bose', initials: 'AB', grade: 'Grade 1', rollNo: 'Auto', section: 'Unassigned', status: 'Verified', date: '22 Jun', docs: '6 of 6 verified', feeStatus: 'Paid' },
    { no: 'REG-2026-0206', student: 'Vivaan Nair', initials: 'VN', grade: 'Grade 6', rollNo: '0612', section: 'Grade 6 · B', status: 'Confirmed', date: '26 Jun', docs: '6 of 6 verified', feeStatus: 'Paid' }
  ];

  // --- Mock Documents Checklist ---
  const initialDocuments = [
    { id: 1, name: 'Birth Certificate', status: 'Verified', updatedBy: 'Rahul K.', date: '24 Jun' },
    { id: 2, name: 'Previous Report Card (Term 2)', status: 'Verified', updatedBy: 'Priya N.', date: '25 Jun' },
    { id: 3, name: 'Transfer Certificate (TC)', status: 'Under review', updatedBy: 'System', date: '26 Jun' },
    { id: 4, name: 'Passport Size Photograph', status: 'Verified', updatedBy: 'Rahul K.', date: '24 Jun' },
    { id: 5, name: 'Aadhaar Card / ID Proof', status: 'Verified', updatedBy: 'Rahul K.', date: '24 Jun' },
    { id: 6, name: 'Immunization / Medical Record', status: 'Pending upload', updatedBy: '—', date: '—' },
  ];

  return (
    <div className="space-y-6 bg-slate-50 p-6 min-h-screen text-slate-800 relative overflow-x-hidden">
      
      {/* View Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900">Admission management</h2>
        <p className="text-sm text-slate-500">Capture enquiries, process registrations and confirm admissions for the current cycle.</p>
      </div>

      {/* --- KPI Metric Cards --- */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {confirmationMetrics.map((m, idx) => (
          <div key={idx} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-sm font-medium text-slate-500">{m.title}</span>
              <div className="text-2xl font-bold tracking-tight text-slate-900 mt-0.5">{m.value}</div>
              <div className="text-xs text-slate-400 mt-1 font-medium">{m.change}</div>
            </div>
            <div className={`p-3 rounded-xl ${m.bg}`}>{m.icon}</div>
          </div>
        ))}
      </div>

      {/* --- Main Dashboard View Grid --- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Side: Table List View Area */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden lg:col-span-2 flex flex-col justify-between">
          <div>
            <div className="p-5 border-b border-slate-100">
              <h3 className="font-semibold text-slate-900 text-base">Ready to confirm</h3>
              <p className="text-xs text-slate-400 mt-0.5">Verified registrations awaiting roll number and class allocation</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50 text-slate-400 font-medium border-b border-slate-100 text-xs uppercase tracking-wider">
                    <th className="p-4 font-semibold">Student</th>
                    <th className="p-4 font-semibold">Grade</th>
                    <th className="p-4 font-semibold">Roll No.</th>
                    <th className="p-4 font-semibold">Section</th>
                    <th className="p-4 font-semibold">Status</th>
                    <th className="p-4 w-4"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {candidates.map((row) => (
                    <tr key={row.no} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 font-bold text-xs flex items-center justify-center">
                            {row.initials}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900">{row.student}</div>
                            <div className="text-xs text-slate-400">{row.no}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-slate-600 font-medium">{row.grade}</td>
                      <td className="p-4 text-slate-500 font-mono">{row.rollNo}</td>
                      <td className="p-4 text-slate-500">{row.section}</td>
                      
                      {/* Interactivity Pillar Clickable Column Field Option */}
                      <td className="p-4">
                        <button 
                          onClick={() => handleOpenDrawer(row)}
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold shadow-sm hover:ring-2 hover:ring-offset-1 transition-all
                            ${row.status === 'Confirmed' ? 'bg-emerald-50 text-emerald-700 hover:ring-emerald-300' : ''}
                            ${row.status === 'Verified' ? 'bg-indigo-50 text-indigo-700 hover:ring-indigo-300' : ''}
                          `}
                        >
                          <span className={`w-1 h-1 rounded-full mr-1.5 ${row.status === 'Confirmed' ? 'bg-emerald-600' : 'bg-indigo-600'}`} />
                          {row.status}
                        </button>
                      </td>
                      
                      <td className="p-4">
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
          
          <div className="p-4 border-t border-slate-100 text-xs text-slate-400 bg-slate-50/50 text-right font-medium">
            Showing {candidates.length} verify pool items
          </div>
        </div>

        {/* Right Side: Seat Allocation Chart View Component */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="font-semibold text-slate-900 text-sm">Seat allocation</h3>
              <p className="text-xs text-slate-400">Allocated vs capacity by section</p>
            </div>
            <button className="text-xs font-semibold text-indigo-600 hover:bg-indigo-50 px-2 py-1 rounded flex items-center gap-1">
              Details <Maximize2 className="w-3 h-3" />
            </button>
          </div>
          
          <div className="h-56 flex items-center justify-center">
            <Bar 
              data={chartData} 
              options={{ 
                responsive: true, 
                maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 11 } } } },
                scales: { 
                  y: { grid: { color: '#f1f5f9' }, ticks: { font: { size: 10 } } }, 
                  x: { grid: { display: false }, ticks: { font: { size: 10 } } } 
                }
              }} 
            />
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* --- INTEGRATED SIDE DRAWER COMPONENT VIEW LAYOUT PANEL --- */}
      {/* ========================================================= */}
      {isDrawerOpen && selectedRow && (
        <>
          {/* Backdrop Overlay */}
          <div 
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 transition-opacity animate-in fade-in duration-200"
            onClick={() => setIsDrawerOpen(false)}
          />
          
          {/* Drawer Control Body Container */}
          <div className="fixed inset-y-0 right-0 w-full max-w-xl bg-white shadow-2xl z-50 flex flex-col h-full border-l border-slate-200 animate-in slide-in-from-right duration-200">
            
            {/* Header Area */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-white">
              <span className="text-sm font-semibold text-slate-500">{selectedRow.no}</span>
              <button 
                onClick={() => setIsDrawerOpen(false)}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Document Section Details Wrapper */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              
              {/* Profile Card Header Segment */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-indigo-50 text-indigo-600 font-bold text-lg flex items-center justify-center border border-indigo-100">
                    {selectedRow.initials}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">{selectedRow.student}</h3>
                    <p className="text-sm text-slate-500">{selectedRow.grade} · Registration</p>
                  </div>
                </div>
                
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                  ${selectedRow.status === 'Confirmed' ? 'bg-emerald-50 text-emerald-700' : 'bg-indigo-50 text-indigo-700'}
                `}>
                  <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${selectedRow.status === 'Confirmed' ? 'bg-emerald-600' : 'bg-indigo-600'}`} />
                  {selectedRow.status}
                </span>
              </div>

              {/* Stepper Implementation Pipeline Tracking Process */}
              <div className="flex justify-between gap-2 text-center border-t border-b border-slate-100 py-4">
                <div className="text-xs font-semibold text-indigo-600 flex flex-col items-center gap-1">
                  <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px]">✓</span>
                  Enquiry
                </div>
                <div className="text-xs font-semibold text-indigo-600 flex flex-col items-center gap-1">
                  <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px]">✓</span>
                  Application
                </div>
                <div className="text-xs font-semibold text-slate-800 flex flex-col items-center gap-1">
                  <span className="w-5 h-5 rounded-full border-2 border-indigo-600 text-indigo-600 flex items-center justify-center font-bold text-[10px]">3</span>
                  Verification
                </div>
                <div className="text-xs font-medium text-slate-400 flex flex-col items-center gap-1">
                  <span className="w-5 h-5 rounded-full border border-slate-200 text-slate-400 flex items-center justify-center text-[10px]">4</span>
                  Confirmation
                </div>
              </div>

              {/* Tab Navigation Layout Panel Options */}
              <div className="flex border-b border-slate-100 text-sm font-medium gap-6">
                {(['Overview', 'Documents', 'History', 'Activity & audit'] as TabType[]).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`pb-2 transition-all border-b-2 text-sm font-medium ${
                      activeTab === tab 
                        ? 'border-indigo-600 text-indigo-600 font-semibold' 
                        : 'border-transparent text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* --- TAB PANELS DISPLAY ROUTER --- */}
              
              {/* TAB 1: OVERVIEW */}
              {activeTab === 'Overview' && (
                <div className="space-y-6 animate-in fade-in duration-150">
                  <div className="space-y-3">
                    <h4 className="font-bold text-slate-900 text-xs tracking-wider uppercase">Applicant details</h4>
                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 grid grid-cols-2 gap-y-4 gap-x-4 text-sm">
                      <div>
                        <div className="text-slate-400 text-xs">Registration no.</div>
                        <div className="font-semibold text-slate-800 mt-0.5">{selectedRow.no}</div>
                      </div>
                      <div>
                        <div className="text-slate-400 text-xs">Grade</div>
                        <div className="font-semibold text-slate-800 mt-0.5">{selectedRow.grade}</div>
                      </div>
                      <div>
                        <div className="text-slate-400 text-xs">Documents status</div>
                        <div className="font-semibold text-indigo-600 mt-0.5">{selectedRow.docs}</div>
                      </div>
                      <div>
                        <div className="text-slate-400 text-xs">Registration fee</div>
                        <div className="font-semibold text-slate-800 mt-0.5">{selectedRow.feeStatus}</div>
                      </div>
                      <div>
                        <div className="text-slate-400 text-xs">Roll no.</div>
                        <div className="font-mono text-slate-800 mt-0.5">{selectedRow.rollNo}</div>
                      </div>
                      <div>
                        <div className="text-slate-400 text-xs">Section</div>
                        <div className="text-slate-800 font-medium mt-0.5">{selectedRow.section}</div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="font-bold text-slate-900 text-xs tracking-wider uppercase">Guardian & contact</h4>
                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className="text-slate-400 text-xs">Primary Guardian</div>
                        <div className="font-medium text-slate-800 mt-0.5">Sanjay Pillai</div>
                        <div className="text-xs text-slate-400">Father</div>
                      </div>
                      <div>
                        <div className="text-slate-400 text-xs">Contact Details</div>
                        <div className="font-medium text-slate-800 mt-0.5">+91 98450 12345</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: DOCUMENTS */}
              {activeTab === 'Documents' && (
                <div className="space-y-4 animate-in fade-in duration-150">
                  <div className="flex justify-between items-center">
                    <h4 className="font-bold text-slate-900 text-xs tracking-wider uppercase">Verification Checklist</h4>
                    <span className="text-xs text-slate-500 font-medium">{selectedRow.docs}</span>
                  </div>
                  
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white">
                    {initialDocuments.map((doc) => (
                      <div key={doc.id} className="p-4 flex items-center justify-between text-sm hover:bg-slate-50 transition-colors">
                        <div className="flex items-center gap-3">
                          <FileText className="w-4 h-4 text-slate-400" />
                          <div>
                            <div className="font-medium text-slate-800">{doc.name}</div>
                            <div className="text-xs text-slate-400">Updated: {doc.date} by {doc.updatedBy}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium
                            ${doc.status === 'Verified' ? 'bg-emerald-50 text-emerald-700' : ''}
                            ${doc.status === 'Under review' ? 'bg-amber-50 text-amber-700' : ''}
                            ${doc.status === 'Pending upload' ? 'bg-rose-50 text-rose-700' : ''}
                          `}>
                            {doc.status}
                          </span>
                          {doc.status !== 'Pending upload' && (
                            <button className="text-slate-400 hover:text-indigo-600 p-1 rounded hover:bg-slate-100">
                              <ExternalLink className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 3: LIFECYCLE HISTORY */}
              {activeTab === 'History' && (
                <div className="space-y-4 animate-in fade-in duration-150">
                  <h4 className="font-bold text-slate-900 text-xs tracking-wider uppercase">Pipeline Milestones</h4>
                  <div className="relative border-l border-slate-200 pl-4 ml-2 space-y-6 py-2">
                    <div className="relative">
                      <span className="absolute -left-[25px] top-0.5 bg-emerald-500 text-white rounded-full p-0.5">
                        <Check className="w-3 h-3" />
                      </span>
                      <div className="text-sm font-semibold text-slate-900">Registration Fee Paid</div>
                      <div className="text-xs font-medium text-slate-500 mt-0.5">{selectedRow.date} · 02:14 PM</div>
                    </div>
                    <div className="relative">
                      <span className="absolute -left-[25px] top-0.5 bg-indigo-600 text-white rounded-full p-0.5">
                        <Check className="w-3 h-3" />
                      </span>
                      <div className="text-sm font-semibold text-slate-900">Form Submitted Successfully</div>
                      <div className="text-xs text-slate-400 mt-0.5">All configurations and forms uploaded by guardian.</div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: ACTIVITY AUDIT */}
              {activeTab === 'Activity & audit' && (
                <div className="space-y-4 animate-in fade-in duration-150">
                  <h4 className="font-bold text-slate-900 text-xs tracking-wider uppercase">System Audit Log</h4>
                  <div className="space-y-3">
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 flex items-start gap-3 text-sm">
                      <Clock className="w-4 h-4 text-slate-400 mt-0.5" />
                      <div>
                        <span className="font-semibold text-slate-800">System Pipeline</span> updated status verification milestone flag to active.
                        <div className="text-xs text-slate-400 mt-1">{selectedRow.date}</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Sticky Action Footer Sheet */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-2">
              <button 
                onClick={() => setIsDrawerOpen(false)}
                className="px-4 py-2 bg-white border border-slate-200 text-slate-700 font-medium rounded-lg text-sm hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  alert(`Admission verified and confirmed successfully for ${selectedRow.student}!`);
                  setIsDrawerOpen(false);
                }}
                className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg text-sm hover:bg-indigo-700 shadow-sm flex items-center gap-1.5 transition-colors"
              >
                <CheckCircle2 className="w-4 h-4" /> Confirm admission
              </button>
            </div>

          </div>
        </>
      )}

    </div>
  );
}