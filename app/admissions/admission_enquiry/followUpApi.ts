import {
  buildSessionContext,
  createAuthHeaders,
  normalizeApiStatus,
  readString,
  type SessionContext,
} from '@/lib/erp-client';

/**
 * Admission → Follow Up data layer (admission\admissionFollowUpController, `admission_follow_up`).
 *
 *   GET  /admission/admission_follow_up?type=API&enquiry_id&module=enquiry  → enquiry contact + follow-up history
 *   POST /admission/admission_follow_up (type=API)                         → create → {status,message}
 *
 * Mirrors resources/views/admission/follow_up/show_admission_follow_up.blade.php. `module` is
 * always "enquiry" here because this form is only reachable from the admission enquiry edit
 * screen (registration/form entry points use their own module value on the Laravel side).
 */

const FOLLOW_UP_MODULE = 'enquiry';

export const ADMISSION_FOLLOW_UP_STATUS_OPTIONS = [
  { value: 'open', label: 'Open' },
  { value: 'close', label: 'Close' },
];

export interface AdmissionFollowUpEntry {
  id: string;
  followUpDate: string;
  createdOn: string;
  remarks: string;
}

export interface AdmissionFollowUpDetails {
  name: string;
  mobile: string;
  entries: AdmissionFollowUpEntry[];
}

export interface AdmissionFollowUpInput {
  enquiryId: string;
  followUpDate: string;
  status: string;
  remarks: string;
}

function requireSession(): SessionContext {
  const session = buildSessionContext();
  if (!session.baseUrl) throw new Error('Session data is missing. Please sign in again.');
  return session;
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}
function toArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

async function readJson(res: Response, fallback: string): Promise<unknown> {
  const text = (await res.text()).trim();
  if (!text) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error(`${fallback} (HTTP ${res.status}).`);
  }
}

export async function fetchAdmissionFollowUps(
  enquiryId: string,
  signal?: AbortSignal
): Promise<AdmissionFollowUpDetails> {
  const session = requireSession();

  const url = new URL(`${session.baseUrl}/admission/admission_follow_up`);
  url.searchParams.set('type', 'API');
  url.searchParams.set('enquiry_id', enquiryId);
  url.searchParams.set('module', FOLLOW_UP_MODULE);

  const res = await fetch(url.toString(), {
    headers: { ...createAuthHeaders(session), 'X-Requested-With': 'XMLHttpRequest' },
    signal,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: Unable to load admission follow-ups.`);
  const raw = toRecord(await readJson(res, 'Failed to load admission follow-ups'));
  if (normalizeApiStatus(raw) !== '1') {
    throw new Error(readString(raw.message) || 'Failed to load admission follow-ups.');
  }

  const enquiryData = toRecord(raw.data);
  const entries = toArray(raw.followUpData).map((entry) => {
    const record = toRecord(entry);
    return {
      id: readString(record.id),
      followUpDate: readString(record.follow_up_date),
      createdOn: readString(record.created_on),
      remarks: readString(record.remarks),
    };
  });

  return {
    name: [enquiryData.first_name, enquiryData.middle_name, enquiryData.last_name]
      .map(readString)
      .filter(Boolean)
      .join(' '),
    mobile: readString(enquiryData.mobile),
    entries,
  };
}

export async function saveAdmissionFollowUp(input: AdmissionFollowUpInput): Promise<string> {
  const session = requireSession();

  const body = new URLSearchParams();
  body.set('type', 'API');
  body.set('sub_institute_id', session.subInstituteId);
  body.set('enquiry_id', input.enquiryId);
  body.set('follow_up_date', input.followUpDate);
  body.set('status', input.status);
  body.set('remarks', input.remarks);
  body.set('module_type', FOLLOW_UP_MODULE);

  const res = await fetch(`${session.baseUrl}/admission/admission_follow_up`, {
    method: 'POST',
    headers: {
      ...createAuthHeaders(session, 'application/x-www-form-urlencoded'),
      'X-Requested-With': 'XMLHttpRequest',
    },
    body: body.toString(),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: Unable to save the follow-up.`);
  const raw = toRecord(await readJson(res, 'Failed to save the follow-up'));
  if (normalizeApiStatus(raw) !== '1') {
    throw new Error(readString(raw.message) || 'Failed to save the follow-up.');
  }
  return readString(raw.message) || 'Follow-up added successfully.';
}
