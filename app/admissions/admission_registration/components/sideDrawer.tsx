'use client';

import React, { useMemo, useState } from 'react';
import {
  X,
  FileText,
  Clock,
  User,
  Loader2,
  Save,
  CreditCard,
  ShieldCheck,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { RegistrationPipelineRow } from '../types';
import {
  buildInitialFormState,
  buildOptions,
  documentFieldKeys,
  type RegistrationFormState,
} from '../workflow';
import { readString } from '@/lib/erp-client';

interface SideDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  data: RegistrationPipelineRow | null;
  isLoading?: boolean;
  onSave?: (updates: Partial<RegistrationFormState>) => void | Promise<void>;
  isSaving?: boolean;
}

type TabType = 'Student details' | 'Registration' | 'Documents' | 'Activity';

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</Label>
      {children}
    </div>
  );
}

export default function SideDrawer({
  isOpen,
  onClose,
  data,
  isLoading = false,
  onSave,
  isSaving = false,
}: SideDrawerProps) {
  const detail = data?.detail;
  const [activeTab, setActiveTab] = useState<TabType>('Student details');
  const [formState, setFormState] = useState<RegistrationFormState>(() =>
    detail ? buildInitialFormState(detail.record, detail.customFields) : {}
  );

  const studentName = useMemo(() => {
    return [formState.first_name, formState.middle_name, formState.last_name].filter(Boolean).join(' ');
  }, [formState.first_name, formState.middle_name, formState.last_name]);

  const statusOptions = useMemo(
    () =>
      buildOptions(detail?.dataFields ?? {}, 'status', [
        { label: 'Open', value: 'OPEN' },
        { label: 'Close', value: 'CLOSE' },
      ]),
    [detail]
  );

  const quotaOptions = useMemo(() => {
    const fallback = (detail?.category ?? [])
      .map((item) => ({
        label: readString(item.title || item.name),
        value: readString(item.id),
      }))
      .filter((item) => item.label && item.value);

    return buildOptions(detail?.dataFields ?? {}, 'student_quota', fallback);
  }, [detail]);

  const divisionOptions = useMemo(() => {
    const fallback = (detail?.division ?? [])
      .map((item) => ({
        label: readString(item.name),
        value: readString(item.id),
      }))
      .filter((item) => item.label && item.value);

    return buildOptions(detail?.dataFields ?? {}, 'admission_division', fallback);
  }, [detail]);

  const paymentModeOptions = useMemo(
    () => buildOptions(detail?.dataFields ?? {}, 'payment_mode'),
    [detail]
  );

  const bloodGroupOptions = useMemo(
    () => buildOptions(detail?.dataFields ?? {}, 'blood_group'),
    [detail]
  );

  const religionOptions = useMemo(
    () => buildOptions(detail?.dataFields ?? {}, 'religion'),
    [detail]
  );

  const casteOptions = useMemo(
    () => buildOptions(detail?.dataFields ?? {}, 'cast'),
    [detail]
  );

  const admissionStatusOptions = useMemo(
    () => buildOptions(detail?.dataFields ?? {}, 'admission_status'),
    [detail]
  );

  const documentChecklist = useMemo(() => {
    const customFields = (detail?.customFields ?? []).map((field) => {
      const fieldName = readString(field.field_name);
      return {
        id: fieldName,
        label: readString(field.field_label || field.field_name || 'Custom Field'),
        required: String(field.required ?? '') === '1',
        value: readString(formState[fieldName]),
      };
    });

    const requiredFields = documentFieldKeys.map((fieldName) => ({
      id: fieldName,
      label: fieldName.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase()),
      required: true,
      value: readString(formState[fieldName]),
    }));

    return [...requiredFields, ...customFields].map((item) => ({
      ...item,
      complete: item.value.trim() !== '',
    }));
  }, [detail, formState]);

  const completionSummary = useMemo(() => {
    const total = documentChecklist.length;
    const complete = documentChecklist.filter((item) => item.complete).length;
    return total > 0 ? `${complete} of ${total} fields verified` : 'No fields mapped';
  }, [documentChecklist]);

  const handleChange = (field: string, value: string) => {
    setFormState((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleSave = () => {
    void onSave?.(formState);
  };

  if (!isOpen || !data) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />

      <div className="fixed inset-y-0 right-0 z-50 flex h-full w-full max-w-[760px] flex-col border-l border-slate-200 bg-white shadow-2xl">
        <div className="border-b border-slate-100 bg-white px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-indigo-100 bg-indigo-50 text-lg font-bold text-indigo-600">
                {data.initials}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="truncate text-lg font-bold text-slate-900">{studentName || data.student}</h3>
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                    {data.no || data.enquiryNo || data.id}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  {data.grade} • Edit registration, verification, and document details
                </p>
              </div>
            </div>
            <button onClick={onClose} className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Stage</div>
              <div className="mt-1 text-sm font-semibold text-slate-800">{readString(formState.status).toUpperCase() === 'OPEN' ? 'Confirmation' : 'Registration'}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Documents</div>
              <div className="mt-1 text-sm font-semibold text-slate-800">{completionSummary}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Fee Status</div>
              <div className="mt-1 text-sm font-semibold text-slate-800">{data.feeStatus}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Enrollment</div>
              <div className="mt-1 text-sm font-semibold text-slate-800">{formState.enrollment_no || readString(detail?.newEnrollmentNo) || '-'}</div>
            </div>
          </div>
        </div>

        <div className="border-b border-slate-100 px-5">
          <div className="flex gap-6 overflow-x-auto">
            {(['Student details', 'Registration', 'Documents', 'Activity'] as TabType[]).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`border-b-2 py-3 text-sm font-medium transition-colors ${
                  activeTab === tab
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-slate-50/60 px-5 py-5">
          {isLoading ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
              <div className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading registration details...
              </div>
            </div>
          ) : null}

          {activeTab === 'Student details' ? (
            <div className="space-y-5">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <User className="h-4 w-4 text-indigo-600" />
                  Student Profile
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Field label="Enquiry Number"><Input value={formState.enquiry_no || ''} onChange={(event) => handleChange('enquiry_no', event.target.value)} /></Field>
                  <Field label="Admission Standard"><Input value={formState.admission_standard || ''} onChange={(event) => handleChange('admission_standard', event.target.value)} /></Field>
                  <Field label="First Name"><Input value={formState.first_name || ''} onChange={(event) => handleChange('first_name', event.target.value)} /></Field>
                  <Field label="Middle Name"><Input value={formState.middle_name || ''} onChange={(event) => handleChange('middle_name', event.target.value)} /></Field>
                  <Field label="Last Name"><Input value={formState.last_name || ''} onChange={(event) => handleChange('last_name', event.target.value)} /></Field>
                  <Field label="Gender"><Input value={formState.gender || ''} onChange={(event) => handleChange('gender', event.target.value)} /></Field>
                  <Field label="Mobile"><Input value={formState.mobile || ''} onChange={(event) => handleChange('mobile', event.target.value)} /></Field>
                  <Field label="Email"><Input value={formState.email || ''} onChange={(event) => handleChange('email', event.target.value)} /></Field>
                  <Field label="Date of Birth"><Input value={formState.date_of_birth || ''} onChange={(event) => handleChange('date_of_birth', event.target.value)} /></Field>
                  <Field label="Age"><Input value={formState.age || ''} onChange={(event) => handleChange('age', event.target.value)} /></Field>
                  <Field label="Previous School"><Input value={formState.previous_school_name || ''} onChange={(event) => handleChange('previous_school_name', event.target.value)} /></Field>
                  <Field label="Previous Standard"><Input value={formState.previous_standard || ''} onChange={(event) => handleChange('previous_standard', event.target.value)} /></Field>
                  <div className="md:col-span-2">
                    <Field label="Address">
                      <Textarea value={formState.address || ''} onChange={(event) => handleChange('address', event.target.value)} className="min-h-[90px] resize-none" />
                    </Field>
                  </div>
                  <div className="md:col-span-2">
                    <Field label="Remarks">
                      <Textarea value={formState.remarks || ''} onChange={(event) => handleChange('remarks', event.target.value)} className="min-h-[90px] resize-none" />
                    </Field>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {activeTab === 'Registration' ? (
            <div className="space-y-5">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <ShieldCheck className="h-4 w-4 text-indigo-600" />
                  Registration Verification
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Field label="Register Number"><Input value={formState.register_number || ''} onChange={(event) => handleChange('register_number', event.target.value)} /></Field>
                  <Field label="Status">
                    <Select value={formState.status || 'CLOSE'} onValueChange={(value) => handleChange('status', (value ?? '').toUpperCase())}>
                      <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
                      <SelectContent>
                        {statusOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Mother Name"><Input value={formState.mother_name || ''} onChange={(event) => handleChange('mother_name', event.target.value)} /></Field>
                  <Field label="Mother Mobile"><Input value={formState.mother_mobile_number || ''} onChange={(event) => handleChange('mother_mobile_number', event.target.value)} /></Field>
                  <Field label="Aadhar Number"><Input value={formState.aadhar_number || ''} onChange={(event) => handleChange('aadhar_number', event.target.value)} /></Field>
                  <Field label="Place of Birth"><Input value={formState.place_of_birth || ''} onChange={(event) => handleChange('place_of_birth', event.target.value)} /></Field>
                  <Field label="Student Quota">
                    <Select value={formState.student_quota || ''} onValueChange={(value) => handleChange('student_quota', value ?? '')}>
                      <SelectTrigger><SelectValue placeholder="Select quota" /></SelectTrigger>
                      <SelectContent>
                        {quotaOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Division">
                    <Select value={formState.admission_division || ''} onValueChange={(value) => handleChange('admission_division', value ?? '')}>
                      <SelectTrigger><SelectValue placeholder="Select division" /></SelectTrigger>
                      <SelectContent>
                        {divisionOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Enrollment No"><Input value={formState.enrollment_no || ''} onChange={(event) => handleChange('enrollment_no', event.target.value)} /></Field>
                  <Field label="Amount"><Input value={formState.amount || ''} onChange={(event) => handleChange('amount', event.target.value)} /></Field>
                  <Field label="Blood Group">
                    <Select value={formState.blood_group || ''} onValueChange={(value) => handleChange('blood_group', value ?? '')}>
                      <SelectTrigger><SelectValue placeholder="Select blood group" /></SelectTrigger>
                      <SelectContent>
                        {bloodGroupOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Admission Status">
                    <Select value={formState.admission_status || ''} onValueChange={(value) => handleChange('admission_status', value ?? '')}>
                      <SelectTrigger><SelectValue placeholder="Select admission status" /></SelectTrigger>
                      <SelectContent>
                        {admissionStatusOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Religion">
                    <Select value={formState.religion || ''} onValueChange={(value) => handleChange('religion', value ?? '')}>
                      <SelectTrigger><SelectValue placeholder="Select religion" /></SelectTrigger>
                      <SelectContent>
                        {religionOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Cast">
                    <Select value={formState.cast || ''} onValueChange={(value) => handleChange('cast', value ?? '')}>
                      <SelectTrigger><SelectValue placeholder="Select cast" /></SelectTrigger>
                      <SelectContent>
                        {casteOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <CreditCard className="h-4 w-4 text-indigo-600" />
                  Payment and Follow-up
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Field label="Payment Mode">
                    <Select value={formState.payment_mode || ''} onValueChange={(value) => handleChange('payment_mode', value ?? '')}>
                      <SelectTrigger><SelectValue placeholder="Select payment mode" /></SelectTrigger>
                      <SelectContent>
                        {paymentModeOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Admission Date"><Input value={formState.admission_date || ''} onChange={(event) => handleChange('admission_date', event.target.value)} /></Field>
                  <Field label="Bank Name"><Input value={formState.bank_name || ''} onChange={(event) => handleChange('bank_name', event.target.value)} /></Field>
                  <Field label="Bank Branch"><Input value={formState.bank_branch || ''} onChange={(event) => handleChange('bank_branch', event.target.value)} /></Field>
                  <Field label="Cheque No"><Input value={formState.cheque_no || ''} onChange={(event) => handleChange('cheque_no', event.target.value)} /></Field>
                  <Field label="Cheque Date"><Input value={formState.cheque_date || ''} onChange={(event) => handleChange('cheque_date', event.target.value)} /></Field>
                  <Field label="Date of Payment"><Input value={formState.date_of_payment || ''} onChange={(event) => handleChange('date_of_payment', event.target.value)} /></Field>
                  <Field label="Follow Up Date"><Input value={formState.followup_date || ''} onChange={(event) => handleChange('followup_date', event.target.value)} /></Field>
                  <div className="md:col-span-2">
                    <Field label="Fees Remark">
                      <Textarea value={formState.fees_remark || ''} onChange={(event) => handleChange('fees_remark', event.target.value)} className="min-h-[90px] resize-none" />
                    </Field>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {activeTab === 'Documents' ? (
            <div className="space-y-5">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                    <FileText className="h-4 w-4 text-indigo-600" />
                    Document Verification
                  </div>
                  <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700">
                    {completionSummary}
                  </span>
                </div>
                <div className="space-y-3">
                  {documentChecklist.map((item) => (
                    <div key={item.id} className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-slate-800">{item.label}</div>
                        <div className="mt-1 break-all text-xs text-slate-500">{item.value || 'No saved value'}</div>
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${item.complete ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                        {item.complete ? 'Verified' : item.required ? 'Required' : 'Pending'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {detail?.customFields?.length ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="mb-4 text-sm font-semibold text-slate-800">Custom Registration Fields</div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {detail.customFields.map((field) => {
                      const fieldName = readString(field.field_name);
                      if (!fieldName) return null;

                      return (
                        <Field key={fieldName} label={readString(field.field_label || fieldName)}>
                          <Input
                            value={formState[fieldName] || ''}
                            onChange={(event) => handleChange(fieldName, event.target.value)}
                          />
                        </Field>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {activeTab === 'Activity' ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <Clock className="h-4 w-4 text-indigo-600" />
                  Workflow Activity
                </div>
                <div className="space-y-3 text-sm text-slate-600">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="font-medium text-slate-800">Inquiry linked</div>
                    <div className="mt-1 text-xs text-slate-500">Inquiry #{data.enquiryNo || '-'} is connected to this registration record.</div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="font-medium text-slate-800">Safe update mode</div>
                    <div className="mt-1 text-xs text-slate-500">Only edited values are changed. Existing saved values stay intact unless the user modifies them.</div>
                  </div>
                  <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-blue-800">
                    When the status is saved as <span className="font-semibold">OPEN</span>, this record will leave Registration and appear in Admission Confirmation.
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <div className="border-t border-slate-100 bg-white px-5 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs text-slate-500">
              Saved values remain unchanged unless the user edits a field.
            </div>
            <div className="flex items-center justify-end gap-2">
              <button onClick={onClose} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100">
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving || isLoading || !detail}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:opacity-70"
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {isSaving ? 'Saving...' : readString(formState.status).toUpperCase() === 'OPEN' ? 'Save & Move to Confirmation' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
