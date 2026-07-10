"use client";

import React, { useState } from 'react';
import { 
  Plus, 
  ChevronRight, 
  Eye, 
  CheckCircle 
} from 'lucide-react';

interface AdmissionForm {
  id: string;
  title: string;
  grades: string;
  status: 'Published' | 'Draft';
  fieldsCount: number;
  ageRule: string;
  fields: { name: string; type: string; required: boolean }[];
}

export default function AdmissionFormsContent() {
  // Mock Data matching the screen context
  const formsData: AdmissionForm[] = [
    {
      id: 'AF',
      title: 'Admission form 2026–27',
      grades: 'Primary · Grades 1–5',
      status: 'Published',
      fieldsCount: 7,
      ageRule: '5y 10m – 7y (Grade 1)',
      fields: [
        { name: 'Student full name', type: 'text', required: true },
        { name: 'Date of birth', type: 'date', required: true },
        { name: 'Grade sought', type: 'select', required: true },
        { name: 'Guardian name', type: 'text', required: true },
        { name: 'Phone', type: 'tel', required: true },
        { name: 'Previous school', type: 'text', required: false },
        { name: 'Blood group', type: 'select', required: false },
      ]
    },
    {
      id: 'KF',
      title: 'Kindergarten form 2026–27',
      grades: 'LKG / UKG',
      status: 'Published',
      fieldsCount: 5,
      ageRule: '3y 10m – 5y',
      fields: [
        { name: 'Student full name', type: 'text', required: true },
        { name: 'Date of birth', type: 'date', required: true },
        { name: 'Guardian name', type: 'text', required: true },
        { name: 'Phone', type: 'tel', required: true },
      ]
    },
    {
      id: 'SF',
      title: 'Secondary form 2026–27',
      grades: 'Grades 6–10',
      status: 'Draft',
      fieldsCount: 9,
      ageRule: '11y – 15y',
      fields: [
        { name: 'Student full name', type: 'text', required: true },
        { name: 'Date of birth', type: 'date', required: true },
      ]
    }
  ];

  // State Management
  const [selectedFormId, setSelectedFormId] = useState<string>('AF');

  // Find currently selected form details
  const selectedForm = formsData.find(f => f.id === selectedFormId) || formsData[0];

  // Click Handlers
  const handleNewForm = () => alert('Creating a new form layout...');
  const handleAddCustomField = () => alert('Adding a custom field to ' + selectedForm.title);
  const handlePreview = () => alert('Opening preview for ' + selectedForm.title);
  const handlePublish = () => alert('Publishing updates for ' + selectedForm.title);

  return (
    <div className="p-6 bg-[#f8fafc] min-h-screen font-sans text-[#1e293b]">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Form Lists */}
        <section className="lg:col-span-5 bg-white border border-slate-100 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Admission forms</h2>
              <p className="text-xs text-slate-500">Configure form fields per admission cycle</p>
            </div>
            <button 
              onClick={handleNewForm}
              className="px-3 py-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> New form
            </button>
          </div>

          {/* List Array mapping */}
          <div className="space-y-2">
            {formsData.map((form) => (
              <div 
                key={form.id}
                onClick={() => setSelectedFormId(form.id)}
                className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between group ${
                  selectedFormId === form.id 
                    ? 'border-indigo-600 bg-indigo-50/40 shadow-sm' 
                    : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-xs ${
                    selectedFormId === form.id ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 group-hover:bg-slate-200'
                  }`}>
                    {form.id}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800">{form.title}</h3>
                    <p className="text-xs text-slate-500">{form.grades}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    form.status === 'Published' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                  }`}>
                    {form.status}
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-600" />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Right Column: Form Detailed View Editor */}
        <section className="lg:col-span-7 bg-white border border-slate-100 rounded-xl p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between border-b border-slate-100 pb-4 mb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">{selectedForm.title}</h2>
                <p className="text-xs text-slate-500 mt-0.5">{selectedForm.grades}</p>
              </div>
              <span className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 font-medium px-2 py-0.5 rounded-md border border-emerald-100">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" /> {selectedForm.status}
              </span>
            </div>

            {/* Form Metadata Badges */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-slate-50 p-3 rounded-xl mb-6 text-xs">
              <div>
                <span className="block text-slate-400 mb-0.5">Cycle</span>
                <span className="font-semibold text-slate-700">2026–27</span>
              </div>
              <div>
                <span className="block text-slate-400 mb-0.5">Status</span>
                <span className="font-semibold text-slate-700">{selectedForm.status}</span>
              </div>
              <div>
                <span className="block text-slate-400 mb-0.5">Fields</span>
                <span className="font-semibold text-slate-700">{selectedForm.fieldsCount}</span>
              </div>
              <div>
                <span className="block text-slate-400 mb-0.5">Age rule</span>
                <span className="font-semibold text-slate-700">{selectedForm.ageRule}</span>
              </div>
            </div>

            {/* Interactive Field View List */}
            <div className="mb-6">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                Fields ({selectedForm.fields.length})
              </div>
              <div className="space-y-1.5">
                {selectedForm.fields.map((field, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2.5 rounded-lg border border-slate-50 bg-slate-50/50 hover:bg-slate-50 text-sm">
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-slate-700">{field.name}</span>
                      <span className="text-xs text-slate-400 bg-white px-1.5 py-0.5 rounded border border-slate-100 font-mono">
                        {field.type}
                      </span>
                    </div>
                    <span className={`text-xs font-medium ${field.required ? 'text-indigo-600' : 'text-slate-400'}`}>
                      {field.required ? 'Required' : 'Optional'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Dynamic Information Callout box */}
            <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-100 text-xs text-indigo-900/80 mb-6">
              <span className="font-bold block mb-0.5">AGE VALIDATION</span>
              Grade 1 · child must be 5 years 10 months to 7 years as on 31 Mar 2026. Out-of-range submissions are blocked.
            </div>
          </div>

          {/* Configured Section Control Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-100">
            <button 
              onClick={handleAddCustomField}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
            >
              + Add custom field
            </button>
            <div className="flex gap-2">
              <button 
                onClick={handlePreview}
                className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-all flex items-center gap-1"
              >
                <Eye className="w-3.5 h-3.5" /> Preview
              </button>
              <button 
                onClick={handlePublish}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-all flex items-center gap-1"
              >
                <CheckCircle className="w-3.5 h-3.5" /> Publish
              </button>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}