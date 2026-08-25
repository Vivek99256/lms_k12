'use client';

/**
 * Institute / Organization Profile API client.
 *
 * Backed by next_lms_erp's `settings/organization_data` resource route
 * (App\Http\Controllers\settings\organizationDetailsController), ported
 * as-is from hp_erp / G2G. This route lives on the **web** route group, not
 * the `/api/*` prefix, so the URL is `{baseUrl}/settings/organization_data`.
 *
 * - GET  -> `{ org_data: OrgDetail[] }`, one row per sub_institute_id, with
 *   `sistersOrg` eager-loaded. Take `org_data[0]`.
 * - POST -> multipart FormData (the `logo` field is a file). The Laravel
 *   side reshapes the response through `is_mobile()`, turning
 *   `status_code` into `status` (uppercased string, e.g. "1" / "0").
 *   Sending `sister_companies[...]` fields does a FULL REPLACE of all
 *   sister rows for that org - not a merge.
 *
 * Auth follows the same pattern as every other already-completed module:
 * `buildSessionContext()` / `createAuthHeaders()` from `lib/erp-client`.
 */

import {
  buildSessionContext,
  createAuthHeaders,
  readString,
  type ApiEnvelope,
  type SessionContext,
} from '@/lib/erp-client';

export { buildSessionContext };
export type { SessionContext };

/** One `org_details` row (main org or a sister company), camelCased. */
export type OrgApiRecord = {
  id: string;
  legalName: string;
  cin: string;
  gstin: string;
  pan: string;
  registeredAddress: string;
  industry: string;
  employeeCount: string;
  workWeek: string;
  logo: string;
  mobileNo: string;
  countryCode: string;
  email: string;
  website: string;
  subInstituteId: string;
};

export type OrgProfileApiRecord = OrgApiRecord & {
  sisterCompanies: OrgApiRecord[];
};

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function record(value: unknown): UnknownRecord {
  return isRecord(value) ? value : {};
}

function list(value: unknown): UnknownRecord[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function normalizeOrgRecord(value: unknown): OrgApiRecord {
  const data = record(value);

  return {
    id: readString(data.id),
    legalName: readString(data.legal_name),
    cin: readString(data.cin),
    gstin: readString(data.gstin),
    pan: readString(data.pan),
    registeredAddress: readString(data.registered_address),
    industry: readString(data.industry),
    employeeCount: readString(data.employee_count),
    workWeek: readString(data.work_week),
    logo: readString(data.logo),
    mobileNo: readString(data.mobile_no),
    countryCode: readString(data.country_code),
    email: readString(data.email),
    website: readString(data.website),
    subInstituteId: readString(data.sub_institute_id),
  };
}

function messageFrom(payload: unknown, fallback: string): string {
  if (payload && typeof payload === 'object') {
    const message = (payload as ApiEnvelope).message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return fallback;
}

function isSuccess(payload: ApiEnvelope): boolean {
  const status = String(payload.status ?? payload.status_code ?? '').toUpperCase();
  return status === '1';
}

function requireSession(session: SessionContext): SessionContext {
  if (!session.token) {
    throw new Error('Your session has expired. Sign in again to continue.');
  }
  return session;
}

function orgDataUrl(session: SessionContext): string {
  return `${session.baseUrl.replace(/\/$/, '')}/settings/organization_data`;
}

/** GET the organization profile (with sister companies) for the current sub-institute. */
export async function getOrganizationProfile(
  session: SessionContext
): Promise<OrgProfileApiRecord | null> {
  const activeSession = requireSession(session);

  const url = new URL(orgDataUrl(activeSession));
  url.searchParams.set('type', 'API');
  if (activeSession.subInstituteId) url.searchParams.set('sub_institute_id', activeSession.subInstituteId);
  if (activeSession.token) url.searchParams.set('token', activeSession.token);

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method: 'GET',
      headers: createAuthHeaders(activeSession, 'application/json'),
      cache: 'no-store',
    });
  } catch {
    throw new Error('Could not reach the server. Check your connection and try again.');
  }

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    throw new Error(messageFrom(payload, `Request failed (${response.status}).`));
  }

  const envelope = record(payload);
  const rows = list(envelope.org_data);
  if (rows.length === 0) return null;

  const [first] = rows;
  const sisters = list(first.sistersOrg).map(normalizeOrgRecord);

  return {
    ...normalizeOrgRecord(first),
    sisterCompanies: sisters,
  };
}

export type SaveOrganizationProfileResult = {
  success: boolean;
  message: string;
};

/** POST a multipart FormData payload (built by the caller) to save the organization profile. */
export async function saveOrganizationProfile(
  session: SessionContext,
  formData: FormData
): Promise<SaveOrganizationProfileResult> {
  const activeSession = requireSession(session);

  if (!formData.has('token') && activeSession.token) formData.set('token', activeSession.token);
  if (!formData.has('sub_institute_id') && activeSession.subInstituteId) {
    formData.set('sub_institute_id', activeSession.subInstituteId);
  }
  if (!formData.has('user_id') && activeSession.userId) formData.set('user_id', activeSession.userId);
  if (!formData.has('type')) formData.set('type', 'API');

  let response: Response;
  try {
    response = await fetch(orgDataUrl(activeSession), {
      method: 'POST',
      // Do not set Content-Type - the browser must set the multipart boundary.
      headers: createAuthHeaders(activeSession),
      body: formData,
    });
  } catch {
    throw new Error('Could not reach the server. Check your connection and try again.');
  }

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    throw new Error(messageFrom(payload, `Request failed (${response.status}).`));
  }

  const envelope = record(payload) as ApiEnvelope;

  return {
    success: isSuccess(envelope),
    message: readString(envelope.message) || (isSuccess(envelope) ? 'Saved successfully.' : 'Failed to save.'),
  };
}
