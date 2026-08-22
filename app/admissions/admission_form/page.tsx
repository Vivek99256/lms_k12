"use client";

import React, { useEffect, useState } from 'react';
import { ChevronRight, Loader2, X } from 'lucide-react';
import { addCustomField, fetchAdmissionFormTemplates, type AdmissionFormTemplate } from './_lib/admission-form-api';

function AddCustomFieldModal({
  formTitle,
  onClose,
  onSubmit,
}: {
  formTitle: string;
  onClose: () => void;
  onSubmit: (fieldLabel: string) => Promise<void>;
}) {
  const [fieldLabel, setFieldLabel] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!fieldLabel.trim()) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await onSubmit(fieldLabel.trim());
      onClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to add the field.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-8 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-custom-field-title"
        className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-white/80 bg-white shadow-[0_28px_80px_rgba(15,23,42,0.28)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 id="add-custom-field-title" className="text-base font-bold tracking-tight text-slate-900">
            Add custom field
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3 px-5 py-4">
          <p className="text-xs text-slate-500">Adding to {formTitle}</p>
          <div>
            <label htmlFor="custom-field-label" className="mb-1.5 block text-xs font-semibold text-slate-600">
              Field label
            </label>
            <input
              id="custom-field-label"
              type="text"
              value={fieldLabel}
              onChange={(event) => setFieldLabel(event.target.value)}
              required
              autoFocus
              placeholder="e.g. Sibling admission number"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
          </div>
          {submitError && <p className="text-xs text-red-600">{submitError}</p>}
          <div className="flex items-center justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900">
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !fieldLabel.trim()}
              className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-300"
            >
              {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Add field
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AdmissionFormsContent() {
  const [formsData, setFormsData] = useState<AdmissionFormTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFormId, setSelectedFormId] = useState<string>('');
  const [isAddFieldModalOpen, setIsAddFieldModalOpen] = useState(false);

  const loadForms = () => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchAdmissionFormTemplates()
      .then((forms) => {
        if (cancelled) return;
        setFormsData(forms);
        setSelectedFormId((current) => current || forms[0]?.id || '');
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load admission forms.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  };

  useEffect(() => loadForms(), []);

  // Find currently selected form details
  const selectedForm = formsData.find(f => f.id === selectedFormId) || formsData[0];

  // Click Handlers
  const handleAddCustomField = () => setIsAddFieldModalOpen(true);

  if (loading) {
    return (
      <div className="p-6 bg-[#f8fafc] min-h-screen font-sans text-[#1e293b] flex items-center justify-center">
        <p className="text-sm text-slate-500">Loading admission forms...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-[#f8fafc] min-h-screen font-sans text-[#1e293b] flex items-center justify-center">
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  if (!selectedForm) {
    return (
      <div className="p-6 bg-[#f8fafc] min-h-screen font-sans text-[#1e293b] flex items-center justify-center">
        <p className="text-sm text-slate-500">No admission forms found.</p>
      </div>
    );
  }

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
          </div>
        </section>

      </div>

      {isAddFieldModalOpen && selectedForm && (
        <AddCustomFieldModal
          formTitle={selectedForm.title}
          onClose={() => setIsAddFieldModalOpen(false)}
          onSubmit={(fieldLabel) => addCustomField(selectedForm.id, fieldLabel).then(() => { loadForms(); })}
        />
      )}
    </div>
  );
}