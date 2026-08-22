'use client';

import { buildSessionContext, createAuthHeaders, normalizeApiStatus, readString } from '@/lib/erp-client';
import { runAdmissionReport, type AdmissionReportRow } from '../../admission_reports/api';

/**
 * Admission → Follow-ups agenda + activity feed.
 *
 * There is no dedicated "follow-up tasks calendar" or "communication log"
 * endpoint on the backend — `follow_up` rows (admissionFollowUpModel) only carry
 * enquiry_id / follow_up_date / status / remarks, with no actor or type field.
 * The closest real data source is the Inquiry Follow-up Report
 * (admissionReportController::followUpReport, already wired up for
 * app/admissions/admission_reports/inquiry-followup via runAdmissionReport),
 * which joins admission_enquiry with follow_up and returns one row per enquiry
 * with its most recent follow_up_date/remarks. This module reuses that same
 * report call and reshapes its rows into the two panels this screen renders:
 * upcoming/scheduled follow-ups ("tasks") and already-logged follow-ups
 * ("communication log").
 */

export interface FollowUpTask {
  id: string;
  day: string;
  weekday: string;
  title: string;
}

export interface CommunicationLogEntry {
  id: string;
  initials: string;
  actor: string;
  actionText: string;
  target: string;
  timeAgo: string;
  bgColor: string;
  textColor: string;
}

const LOG_PALETTE = [
  { bgColor: 'bg-indigo-50', textColor: 'text-indigo-600' },
  { bgColor: 'bg-amber-50', textColor: 'text-amber-600' },
  { bgColor: 'bg-slate-100', textColor: 'text-slate-600' },
];

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function parseDdMmYyyy(value: string): Date | null {
  const match = value.trim().match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (!match) return null;
  const [, day, month, year] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  return Number.isNaN(date.getTime()) ? null : date;
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '—';
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('');
}

function formatTimeAgo(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return 'Today';
  if (diffDays === 1) return '1 day ago';
  return `${diffDays} days ago`;
}

function studentName(row: AdmissionReportRow): string {
  return row.student_name?.trim() || row.father_name?.trim() || `Enquiry ${row.enquiry_no || row.enquiry_id}`;
}

async function fetchFollowUpRows(): Promise<AdmissionReportRow[]> {
  const today = new Date();
  const from = new Date(today);
  from.setDate(from.getDate() - 30);
  const to = new Date(today);
  to.setDate(to.getDate() + 14);

  const result = await runAdmissionReport(
    'inquiry_followup',
    { fromDate: toIsoDate(from), toDate: toIsoDate(to), user: '', status: '', followUpStatus: '' },
    []
  );

  return result.rows;
}

export async function fetchFollowUpTasks(): Promise<FollowUpTask[]> {
  const rows = await fetchFollowUpRows();

  return rows
    .map((row) => {
      const date = parseDdMmYyyy(row.follow_up_date || '');
      if (!date) return null;
      return {
        id: row.enquiry_id || row.enquiry_no,
        date,
        title: `Follow-up — ${studentName(row)}${row.admission_std ? ` (${row.admission_std})` : ''}`,
      };
    })
    .filter((task): task is { id: string; date: Date; title: string } => task !== null)
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .map((task) => ({
      id: task.id,
      day: String(task.date.getDate()).padStart(2, '0'),
      weekday: task.date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(),
      title: task.title,
    }));
}

export interface EnquiryOption {
  id: string;
  label: string;
}

export interface NewFollowUpInput {
  enquiryId: string;
  followUpDate: string;
  remarks: string;
  status: string;
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function toArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/** Enquiries a reminder/follow-up can be logged against — for the "New reminder" form. */
export async function fetchEnquiryOptions(): Promise<EnquiryOption[]> {
  const session = buildSessionContext();
  if (!session.baseUrl || !session.subInstituteId || !session.syear) {
    throw new Error('Session is missing API base URL, sub institute, or academic year.');
  }

  const query = new URLSearchParams({
    path: 'admission/admission_enquiry',
    type: 'API',
    sub_institute_id: session.subInstituteId,
    syear: session.syear,
  });

  const response = await fetch(`/api/proxy?${query.toString()}`, {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
    headers: createAuthHeaders(session),
  });

  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok || normalizeApiStatus(payload) !== '1') {
    throw new Error(readString(payload.message) || 'Failed to load enquiries.');
  }

  return toArray(payload.data)
    .map((entry) => toRecord(entry))
    .map((row) => {
      const name = [row.first_name, row.middle_name, row.last_name]
        .map((part) => readString(part).trim())
        .filter(Boolean)
        .join(' ');
      const enquiryNo = readString(row.enquiry_no);
      return {
        id: readString(row.id),
        label: [name || `Enquiry ${enquiryNo || readString(row.id)}`, enquiryNo && `(${enquiryNo})`]
          .filter(Boolean)
          .join(' '),
      };
    })
    .filter((option) => option.id);
}

/** Logs a new follow-up reminder against an enquiry — admissionFollowUpController@store. */
export async function createFollowUp(input: NewFollowUpInput): Promise<void> {
  const session = buildSessionContext();
  if (!session.baseUrl || !session.subInstituteId) {
    throw new Error('Session is missing API base URL or sub institute.');
  }

  const query = new URLSearchParams({ path: 'admission/admission_follow_up' });
  const response = await fetch(`/api/proxy?${query.toString()}`, {
    method: 'POST',
    credentials: 'include',
    cache: 'no-store',
    headers: createAuthHeaders(session, 'application/json'),
    body: JSON.stringify({
      type: 'API',
      sub_institute_id: session.subInstituteId,
      enquiry_id: input.enquiryId,
      follow_up_date: input.followUpDate,
      status: input.status,
      remarks: input.remarks,
      module_type: 'admission_enquiry',
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok || normalizeApiStatus(payload) !== '1') {
    throw new Error(readString(payload.message) || 'Failed to create the reminder.');
  }
}

export async function fetchCommunicationLog(): Promise<CommunicationLogEntry[]> {
  const rows = await fetchFollowUpRows();

  return rows
    .map((row) => {
      const remark = row.followup_remark?.trim();
      if (!remark) return null;
      const date = parseDdMmYyyy(row.follow_up_date || '') ?? parseDdMmYyyy(row.enquiry_date || '');
      return { row, date: date ?? new Date(0) };
    })
    .filter((entry): entry is { row: AdmissionReportRow; date: Date } => entry !== null)
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, 8)
    .map(({ row, date }, index) => {
      const palette = LOG_PALETTE[index % LOG_PALETTE.length];
      const name = studentName(row);
      return {
        id: row.enquiry_id || row.enquiry_no,
        initials: initialsOf(name),
        actor: 'Admissions team',
        actionText: 'logged a follow-up with',
        target: name,
        timeAgo: formatTimeAgo(date),
        ...palette,
      };
    });
}
