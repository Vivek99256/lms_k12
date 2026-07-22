'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  FileText,
  Clock,
  CreditCard,
  CheckCircle2,
  Search,
  ChevronDown,
  Pencil,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import SideDrawer from './components/sideDrawer';
import {
  appendCommonParams,
  buildSessionContext,
  createAuthHeaders,
  normalizeApiStatus,
  readString,
} from '@/lib/erp-client';
import type {
  AdmissionEnquiryApiResponse,
  AdmissionEnquiryApiRow,
  LegacyCustomField,
  LegacyRegistrationApiRow,
  RegistrationPipelineRow,
} from './types';
import { fetchRegistrationDetail, saveRegistration, type RegistrationFormState } from './workflow';

function getFullName(...parts: Array<string | null | undefined>): string {
  return parts.map((part) => part?.trim()).filter(Boolean).join(' ');
}

function getInitials(name: string): string {
  const parts = name.split(' ').filter(Boolean);
  const initials =
    parts.length > 1 ? `${parts[0][0]}${parts[parts.length - 1][0]}` : name.slice(0, 2);

  return initials.toUpperCase() || '--';
}

function parseApiDate(value?: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value.replace(' ', 'T'));
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatShortDate(value?: string | null): string {
  if (!value) return '-';
  const date = parseApiDate(value);
  if (!date) return readString(value) || '-';

  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
  }).format(date);
}

function readCount(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function deriveStatusFromDetail(detail?: RegistrationPipelineRow['detail'] | null): string {
  const rawStatus = readString(detail?.record.status).toUpperCase();
  if (rawStatus === 'OPEN') return 'Open';
  if (rawStatus === 'CLOSE') return 'Closed';
  if (readCount(detail?.record.total_student_count) > 0) return 'Approved';
  return 'Pending';
}

function deriveFeeStatus(detail?: RegistrationPipelineRow['detail'] | null): string {
  if (readString(detail?.record.receipt_id)) return 'Paid';
  const fee = Number(detail?.record.admission_form_fee);
  if (Number.isFinite(fee) && fee > 0) return 'Pending';
  return 'Pending';
}

function getFieldAvailability(
  row: AdmissionEnquiryApiRow | LegacyRegistrationApiRow,
  customFields: LegacyCustomField[]
) {
  const baseFields = [
    readString(row.mobile),
    readString(row.email),
    readString(row.date_of_birth),
    readString((row as LegacyRegistrationApiRow).registration_no),
    readString((row as LegacyRegistrationApiRow).admission_docket_no),
    readString(row.admission_standard ?? (row as LegacyRegistrationApiRow).std_name),
  ];

  const customFieldNames = customFields.map((field) => readString(field.field_name)).filter(Boolean);
  const customFilledCount = customFieldNames.filter((fieldName) => readString(row[fieldName]).trim() !== '').length;
  const filledBaseCount = baseFields.filter((value) => value.trim() !== '').length;
  const total = baseFields.length + customFieldNames.length;
  const completed = filledBaseCount + customFilledCount;

  return {
    progress: total > 0 ? Math.round((completed / total) * 100) : 0,
    label: total > 0 ? `${completed} of ${total} fields synced` : 'No mapped fields',
  };
}

function mapEnquiryRowToPipelineRow(row: AdmissionEnquiryApiRow): RegistrationPipelineRow {
  const firstName = readString(row.first_name);
  const middleName = readString(row.middle_name);
  const lastName = readString(row.last_name);
  const student = getFullName(firstName, middleName, lastName) || `Enquiry ${readString(row.enquiry_no)}`;
  const fieldAvailability = getFieldAvailability(row, []);

  const pipelineRow = {
    id: readString(row.id),
    no: readString(row.enquiry_no) || readString(row.id),
    student,
    initials: getInitials(student),
    grade: readString(row.admission_standard) ? `Grade ${readString(row.admission_standard)}` : '-',
    docs: fieldAvailability.label,
    docsProgress: fieldAvailability.progress,
    feeStatus: 'Pending',
    status: 'Pending',
    date: formatShortDate(row.created_on),
    enquiryNo: readString(row.enquiry_no),
    admissionDocketNo: '',
    formNo: '',
    inquiryDate: readString(row.created_on),
    followUpDate: readString(row.followup_date),
    mobile: readString(row.mobile),
    email: readString(row.email),
    dateOfBirth: readString(row.date_of_birth),
    age: readString(row.age),
    previousSchoolName: readString(row.previous_school_name),
    previousStandard: readString(row.previous_standard),
    enquiryRemark: readString(row.remarks),
    admissionFormFee: '',
    receiptId: '',
    receiptHtml: '',
    transportFees: '',
    totalStudentCount: 0,
    raw: row,
    customFields: [],
  };

  return {
    ...pipelineRow,
    searchText: Object.values(pipelineRow)
      .map((value) => (typeof value === 'string' || typeof value === 'number' ? String(value) : ''))
      .join(' ')
      .toLowerCase(),
    detail: null,
  };
}

function applyDetailToRow(
  row: RegistrationPipelineRow,
  detail: RegistrationPipelineRow['detail']
): RegistrationPipelineRow {
  if (!detail) return row;

  const fieldAvailability = getFieldAvailability(detail.record, detail.customFields);
  const grade =
    readString(detail.record.std_name) ||
    (readString(detail.record.admission_standard) ? `Grade ${readString(detail.record.admission_standard)}` : row.grade);

  const updated = {
    ...row,
    no:
      readString(detail.record.registration_no) ||
      readString(detail.record.admission_docket_no) ||
      row.no,
    grade,
    docs: fieldAvailability.label,
    docsProgress: fieldAvailability.progress,
    feeStatus: deriveFeeStatus(detail),
    status: deriveStatusFromDetail(detail),
    admissionDocketNo: readString(detail.record.admission_docket_no),
    formNo: readString(detail.record.form_no),
    previousSchoolName: readString(detail.record.previous_school_name) || row.previousSchoolName,
    previousStandard: readString(detail.record.previous_standard) || row.previousStandard,
    enquiryRemark:
      readString(detail.record.enquiry_remark) ||
      readString(detail.record.remarks) ||
      row.enquiryRemark,
    admissionFormFee: readString(detail.record.admission_form_fee),
    receiptId: readString(detail.record.receipt_id),
    receiptHtml: readString(detail.record.receipt_html),
    transportFees: readString(detail.record.transport_fees),
    totalStudentCount: readCount(detail.record.total_student_count),
    customFields: detail.customFields,
    detail,
  };

  return {
    ...updated,
    searchText: Object.values(updated)
      .map((value) => (typeof value === 'string' || typeof value === 'number' ? String(value) : ''))
      .join(' ')
      .toLowerCase(),
  };
}

export default function RegistrationPipelineContent() {
  const router = useRouter();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState<RegistrationPipelineRow | null>(null);
  const [rows, setRows] = useState<RegistrationPipelineRow[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isDrawerLoading, setIsDrawerLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadRegistrations = useCallback(async (signal?: AbortSignal) => {
    const session = buildSessionContext();

    if (!session.baseUrl || !session.subInstituteId || !session.syear) {
      setRows([]);
      setError('Session is missing API base URL, sub institute, or academic year.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const baseUrl = session.baseUrl.replace(/\/$/, '');
      const url = new URL(`${baseUrl}/api/admission_enquiry`);
      appendCommonParams(url.searchParams, session);

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: createAuthHeaders(session),
        signal,
      });

      if (!response.ok) {
        throw new Error(`Failed to load admission enquiries (${response.status})`);
      }

      const payload = (await response.json()) as AdmissionEnquiryApiResponse;
      if (normalizeApiStatus(payload) !== '1') {
        throw new Error(payload.message || 'Failed to load admission enquiries.');
      }

      const baseRows = Array.isArray(payload.data) ? payload.data.map(mapEnquiryRowToPipelineRow) : [];
      const hydratedRows = await Promise.all(
        baseRows.map(async (row) => {
          try {
            const detail = await fetchRegistrationDetail(row.id, signal);
            return applyDetailToRow(row, detail);
          } catch {
            return row;
          }
        })
      );

      setRows(hydratedRows.filter((row) => row.status !== 'Open'));
    } catch (loadError) {
      if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
      setRows([]);
      setError(loadError instanceof Error ? loadError.message : 'Failed to load admission enquiries.');
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      void loadRegistrations(controller.signal);
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [loadRegistrations]);

  const filteredRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((row) => row.searchText.includes(query));
  }, [rows, searchQuery]);

  const metrics = useMemo(() => {
    const inRegistration = rows.length;
    const docsPending = rows.filter((row) => row.docsProgress < 100).length;
    const feeCollected = rows.filter((row) => row.feeStatus === 'Paid').length;
    const verified = rows.filter((row) => row.status === 'Approved' || row.status === 'Closed').length;

    return [
      { title: 'In registration', value: String(inRegistration), icon: <FileText className="w-5 h-5 text-indigo-600" />, bgIcon: 'bg-indigo-50' },
      { title: 'Docs pending', value: String(docsPending), icon: <Clock className="w-5 h-5 text-blue-600" />, bgIcon: 'bg-blue-50' },
      { title: 'Fee collected', value: String(feeCollected), icon: <CreditCard className="w-5 h-5 text-emerald-600" />, bgIcon: 'bg-emerald-50' },
      { title: 'Verified', value: String(verified), icon: <CheckCircle2 className="w-5 h-5 text-purple-600" />, bgIcon: 'bg-purple-50' },
    ];
  }, [rows]);

  const handleRowClick = async (rowData: RegistrationPipelineRow) => {
    setSelectedRow(rowData);
    setIsDrawerOpen(true);
    if (rowData.detail) return;

    setIsDrawerLoading(true);
    try {
      const detail = await fetchRegistrationDetail(rowData.id);
      const nextRow = applyDetailToRow(rowData, detail);
      setRows((currentRows) => currentRows.map((row) => (row.id === rowData.id ? nextRow : row)));
      setSelectedRow(nextRow);
    } catch (detailError) {
      setError(detailError instanceof Error ? detailError.message : 'Failed to load registration details.');
    } finally {
      setIsDrawerLoading(false);
    }
  };

  const handleSave = async (updates: Partial<RegistrationFormState>) => {
    if (!selectedRow) return;
    setIsSaving(true);
    setError(null);

    try {
      let detail = selectedRow.detail;
      if (!detail) {
        detail = await fetchRegistrationDetail(selectedRow.id);
      }
      if (!detail) {
        throw new Error('Registration details are not available for this record.');
      }

      const { detail: refreshedDetail } = await saveRegistration(selectedRow.id, detail, updates);
      const nextRow = applyDetailToRow(selectedRow, refreshedDetail);

      if (nextRow.status === 'Open') {
        setRows((currentRows) => currentRows.filter((row) => row.id !== selectedRow.id));
        setSelectedRow(nextRow);
        setIsDrawerOpen(false);
        router.push('/admissions/confirmation');
        return;
      }

      setRows((currentRows) => currentRows.map((row) => (row.id === selectedRow.id ? nextRow : row)));
      setSelectedRow(nextRow);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to update registration.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 bg-[#fff] p-6 min-h-screen text-slate-800">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Registration pipeline</h2>
        <p className="text-sm text-slate-500">Document verification and registration fee status</p>
      </div>

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

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 space-y-3 sm:space-y-0 sm:flex sm:items-center sm:justify-between">
          <div className="text-sm font-medium text-slate-500">
            <span className="text-slate-900 font-semibold">{filteredRows.length} registrations</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search registrations..."
                className="pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none"
              />
            </div>
            <button className="flex items-center gap-1 px-3 py-1.5 bg-slate-50 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-100 font-medium">
              All statuses <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

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
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-500">
                    <div className="inline-flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Loading registrations...
                    </div>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-rose-600">
                    <div className="inline-flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      {error}
                    </div>
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-500">
                    No registrations found.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => (
                  <tr key={row.id} onClick={() => void handleRowClick(row)} className="hover:bg-slate-50/70 cursor-pointer transition-colors">
                    <td className="p-4 font-medium text-slate-500">{row.no || '-'}</td>
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
                      <div className="space-y-1 max-w-[140px]">
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
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium
                        ${row.status === 'Approved' ? 'bg-emerald-50 text-emerald-700' : ''}
                        ${row.status === 'Closed' ? 'bg-purple-50 text-purple-700' : ''}
                        ${row.status === 'Open' ? 'bg-blue-50 text-blue-700' : ''}
                        ${row.status === 'Pending' ? 'bg-slate-100 text-slate-600' : ''}
                      `}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="p-4 text-indigo-600 font-medium hover:underline">{row.date}</td>
                    <td className="p-4" onClick={(event) => event.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => void handleRowClick(row)}
                        className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-[#0D6EFD]"
                        aria-label={`Edit registration ${row.no || row.enquiryNo || row.id}`}
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <SideDrawer
        key={selectedRow?.id ?? 'registration-drawer'}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        data={selectedRow}
        isLoading={isDrawerLoading}
        onSave={handleSave}
        isSaving={isSaving}
      />
    </div>
  );
}
