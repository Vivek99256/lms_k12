'use client';

import React, { useState } from 'react';
import { 
  X, 
  CheckCircle2, 
  FileText, 
  ExternalLink, 
  Clock, 
  User, 
  Check, 
  AlertCircle 
} from 'lucide-react';

interface SideDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  data: {
    no: string;
    student: string;
    initials: string;
    grade: string;
    docs: string;
    feeStatus: string;
    status: string;
    date: string;
  } | null;
}

type TabType = 'Overview' | 'Documents' | 'History' | 'Activity & audit';

export default function SideDrawer({ isOpen, onClose, data }: SideDrawerProps) {
  const [activeTab, setActiveTab] = useState<TabType>('Overview');

  if (!isOpen || !data) return null;

  // --- Mock Document Checklist for the Documents Tab ---
  const initialDocuments = [
    { id: 1, name: 'Birth Certificate', status: 'Verified', updatedBy: 'Rahul K.', date: '24 Jun' },
    { id: 2, name: 'Previous Report Card (Term 2)', status: 'Verified', updatedBy: 'Priya N.', date: '25 Jun' },
    { id: 3, name: 'Transfer Certificate (TC)', status: 'Under review', updatedBy: 'System', date: '26 Jun' },
    { id: 4, name: 'Passport Size Photograph', status: 'Verified', updatedBy: 'Rahul K.', date: '24 Jun' },
    { id: 5, name: 'Aadhaar Card / ID Proof', status: 'Verified', updatedBy: 'Rahul K.', date: '24 Jun' },
    { id: 6, name: 'Immunization / Medical Record', status: 'Pending upload', updatedBy: '—', date: '—' },
  ];

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 transition-opacity"
        onClick={onClose}
      />
      
      {/* Drawer Panel */}
      <div className="fixed inset-y-0 right-0 w-full max-w-xl bg-white shadow-2xl z-50 flex flex-col h-full border-l border-slate-200 animate-in slide-in-from-right duration-200">
        
        {/* Drawer Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-white">
          <span className="text-sm font-semibold text-slate-500">{data.no}</span>
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Hero Header Area */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-indigo-50 text-indigo-600 font-bold text-lg flex items-center justify-center border border-indigo-100">
                {data.initials}
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">{data.student}</h3>
                <p className="text-sm text-slate-500">{data.grade} · Registration</p>
              </div>
            </div>
            
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
              ${data.status === 'Approved' ? 'bg-emerald-50 text-emerald-700' : ''}
              ${data.status === 'Verified' ? 'bg-purple-50 text-purple-700' : ''}
              ${data.status === 'Under verification' ? 'bg-amber-50 text-amber-700' : ''}
              ${data.status === 'Pending' ? 'bg-slate-100 text-slate-600' : ''}
            `}>
              <span className={`w-1.5 h-1.5 rounded-full mr-1.5 
                ${data.status === 'Approved' ? 'bg-emerald-600' : ''}
                ${data.status === 'Verified' ? 'bg-purple-600' : ''}
                ${data.status === 'Under verification' ? 'bg-amber-600' : ''}
                ${data.status === 'Pending' ? 'bg-slate-500' : ''}
              `} />
              {data.status}
            </span>
          </div>

          {/* Stepper Process Pipeline Tracking */}
          <div className="flex justify-between gap-2 text-center relative border-t border-b border-slate-100 py-4">
            <div className="flex text-xs font-semibold text-indigo-600 flex flex-col items-center gap-1">
              <span className="w-5 h-5 rounded-full bg-[#0D6EFD] text-white flex items-center justify-center text-[10px]">✓</span>
              Enquiry
            </div>
            <div className="text-xs font-semibold text-indigo-600 flex flex-col items-center gap-1">
              <span className="w-5 h-5 rounded-full bg-[#0D6EFD] text-white flex items-center justify-center text-[10px]">✓</span>
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

          {/* Tab Selection Navigation Bar */}
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

          {/* --- Tab Content Renderer Containers --- */}
          
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'Overview' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              {/* Applicant Details Group */}
              <div className="space-y-3">
                <h4 className="font-bold text-slate-900 text-xs tracking-wider uppercase">Applicant details</h4>
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 grid grid-cols-2 gap-y-4 gap-x-4 text-sm">
                  <div>
                    <div className="text-slate-400 text-xs">Registration no.</div>
                    <div className="font-semibold text-slate-800 mt-0.5">{data.no}</div>
                  </div>
                  <div>
                    <div className="text-slate-400 text-xs">Grade</div>
                    <div className="font-semibold text-slate-800 mt-0.5">{data.grade}</div>
                  </div>
                  <div>
                    <div className="text-slate-400 text-xs">Documents status</div>
                    <div className="font-semibold text-indigo-600 mt-0.5">{data.docs}</div>
                  </div>
                  <div>
                    <div className="text-slate-400 text-xs">Registration fee</div>
                    <div className="font-semibold text-slate-800 mt-0.5">{data.feeStatus}</div>
                  </div>
                  <div>
                    <div className="text-slate-400 text-xs">Roll no.</div>
                    <div className="text-slate-400 mt-0.5 italic">Pending verification</div>
                  </div>
                  <div>
                    <div className="text-slate-400 text-xs">Section</div>
                    <div className="text-slate-400 mt-0.5 italic">Unassigned</div>
                  </div>
                </div>
              </div>

              {/* Guardian details box */}
              <div className="space-y-3">
                <h4 className="font-bold text-slate-900 text-xs tracking-wider uppercase">Guardian & contact</h4>
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-slate-400 text-xs">Primary Guardian</div>
                    <div className="font-medium text-slate-800 mt-0.5">Sanjay Deshpande</div>
                    <div className="text-xs text-slate-400">Father</div>
                  </div>
                  <div>
                    <div className="text-slate-400 text-xs">Contact Number</div>
                    <div className="font-medium text-slate-800 mt-0.5">+91 98765 43210</div>
                    <div className="text-xs text-slate-400">sanjay.d@example.com</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: DOCUMENTS CHECKLIST */}
          {activeTab === 'Documents' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="flex justify-between items-center">
                <h4 className="font-bold text-slate-900 text-xs tracking-wider uppercase">Verification Checklist</h4>
                <span className="text-xs text-slate-500 font-medium">{data.docs}</span>
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
                  <div className="text-xs text-slate-400 mt-0.5">Processed via Online Gateway · Transaction ID: #84920</div>
                  <div className="text-xs font-medium text-slate-500 mt-1">24 Jun 2026, 02:14 PM</div>
                </div>
                <div className="relative">
                  <span className="absolute -left-[25px] top-0.5 bg-indigo-600 text-white rounded-full p-0.5">
                    <Check className="w-3 h-3" />
                  </span>
                  <div className="text-sm font-semibold text-slate-900">Form Submitted Successfully</div>
                  <div className="text-xs text-slate-400 mt-0.5">All initial parent configurations and forms uploaded by applicant guardian.</div>
                  <div className="text-xs font-medium text-slate-500 mt-1">24 Jun 2026, 01:45 PM</div>
                </div>
                <div className="relative">
                  <span className="absolute -left-[25px] top-0.5 bg-slate-300 text-white rounded-full p-0.5">
                    <Check className="w-3 h-3" />
                  </span>
                  <div className="text-sm font-semibold text-slate-800">Enquiry Converted to Application</div>
                  <div className="text-xs text-slate-400 mt-0.5">Processed internally by Staff user (Priya N.)</div>
                  <div className="text-xs font-medium text-slate-500 mt-1">22 Jun 2026, 11:00 AM</div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: SYSTEM ACTIVITY AUDIT TRAIL */}
          {activeTab === 'Activity & audit' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <h4 className="font-bold text-slate-900 text-xs tracking-wider uppercase">System Audit Log</h4>
              <div className="space-y-3">
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 flex items-start gap-3 text-sm">
                  <Clock className="w-4 h-4 text-slate-400 mt-0.5" />
                  <div>
                    <span className="font-semibold text-slate-800">Rahul K.</span> updated document verification status for <span className="font-medium text-slate-700">Birth Certificate</span> to <span className="text-emerald-600 font-medium">Verified</span>.
                    <div className="text-xs text-slate-400 mt-1">29 Jun 2026 · 10:32 AM</div>
                  </div>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 flex items-start gap-3 text-sm">
                  <User className="w-4 h-4 text-slate-400 mt-0.5" />
                  <div>
                    <span className="font-semibold text-slate-800">System Gateway</span> matched invoice reference pattern for fee verification setup.
                    <div className="text-xs text-slate-400 mt-1">24 Jun 2026 · 02:15 PM</div>
                  </div>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 flex items-start gap-3 text-sm">
                  <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5" />
                  <div>
                    <span className="font-semibold text-slate-800">Priya N.</span> flagged <span className="font-medium text-slate-700">Transfer Certificate (TC)</span> for secondary authority re-review.
                    <div className="text-xs text-slate-400 mt-1">24 Jun 2026 · 11:02 AM</div>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Drawer Action Buttons Footer Panel */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-2">
          <button 
            onClick={onClose}
            className="px-4 py-2 bg-white border border-slate-200 text-slate-700 font-medium rounded-lg text-sm hover:bg-slate-100 transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={() => alert(`Registration verified successfully for ${data.student}`)}
            className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg text-sm hover:bg-indigo-700 shadow-sm flex items-center gap-1.5 transition-colors"
          >
            <CheckCircle2 className="w-4 h-4" /> Mark verified
          </button>
        </div>

      </div>
    </>
  );
}