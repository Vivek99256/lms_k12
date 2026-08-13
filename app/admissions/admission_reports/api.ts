'use client';

import {
  buildSessionContext,
  createAuthHeaders,
  normalizeApiStatus,
  readString,
  type SessionContext,
} from '@/lib/erp-client';

export type AdmissionReportId =
  | 'inquiry_followup'
  | 'admission_inquiry'
  | 'admission_registration'
  | 'admission_without_confirmation'
  | 'admission_confirmation';

export type AdmissionReportFilters = {
  fromDate: string;
  toDate: string;
  user: string;
  status: string;
  followUpStatus: string;
};

export type AdmissionReportUser = {
  id: string;
  label: string;
};

export type AdmissionReportFieldOption = {
  key: string;
  label: string;
};

export type AdmissionReportRow = Record<string, string>;

export type AdmissionReportResult = {
  message: string;
  rows: AdmissionReportRow[];
  headers: string[];
  users: AdmissionReportUser[];
  fields: AdmissionReportFieldOption[];
};

type RawAdmissionReportResponse = {
  status?: string | number;
  status_code?: string | number;
  message?: string;
  data?: unknown;
  users?: unknown;
  fields?: unknown;
  headers?: unknown;
  editData?: unknown;
  dataCustomFields?: unknown;
};

const withoutConfirmationFallbackHeaders = [
  'enquiry_no',
  'created_on',
  'followup_date',
  'first_name',
  'middle_name',
  'last_name',
  'mobile',
  'email',
  'admission_standard',
  'form_no',
  'status',
];

const admissionRegistrationDefaultFields = [
  'first_name',
  'middle_name',
  'last_name',
  'mobile',
  'email',
];

const sessionDrivenReportIds: AdmissionReportId[] = [
  'inquiry_followup',
  'admission_registration',
  'admission_without_confirmation',
];

const endpointByReport: Record<AdmissionReportId, string> = {
  inquiry_followup: '/admission/admission_enquiry_followup_report',
  admission_inquiry: '/admission/admission_enquiry_report',
  admission_registration: '/admission/admission_registration_report',
  admission_without_confirmation: '/admission/admission_without_con_report',
  admission_confirmation: '/admission/admission_confirmation_report_v2',
};

function requireSession(): SessionContext {
  const session = buildSessionContext();
  if (!session.baseUrl || !session.subInstituteId || !session.syear) {
    throw new Error('Session is missing API base URL, sub institute, or academic year.');
  }
  return session;
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function toArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function toRows(value: unknown): AdmissionReportRow[] {
  return toArray(value).map((entry) => {
    const record = toRecord(entry);
    return Object.fromEntries(
      Object.entries(record).map(([key, item]) => [key, readString(item)])
    );
  });
}

function prettifyLabel(value: string) {
  return value
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function normalizeFields(value: unknown): AdmissionReportFieldOption[] {
  const record = toRecord(value);
  return Object.entries(record)
    .map(([key, label]) => ({
      key,
      label: readString(label) || prettifyLabel(key),
    }))
    .filter((option) => option.key);
}

function normalizeUsers(value: unknown): AdmissionReportUser[] {
  return toArray(value)
    .map((entry) => {
      const record = toRecord(entry);
      const firstName = readString(record.first_name);
      const lastName = readString(record.last_name);
      return {
        id: readString(record.id),
        label: [firstName, lastName].filter(Boolean).join(' ') || readString(record.id),
      };
    })
    .filter((user) => user.id);
}

async function readJson<T>(response: Response, fallbackMessage: string): Promise<T> {
  const text = (await response.text()).trim();
  if (!text) {
    throw new Error(fallbackMessage);
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(fallbackMessage);
  }
}

function buildBackendGapMessage(reportId: AdmissionReportId, responseText: string) {
  if (
    responseText.includes('sub_institute_id =  OR common_to_all = 1') ||
    responseText.includes('tblcustom_fields')
  ) {
    return `${reportId.replace(/_/g, ' ')} is using a session-only Laravel report controller. The frontend sent type=API, but the controller still reads sub_institute_id/syear from the Laravel session, so this environment needs either an active Laravel session cookie or a backend API fix.`;
  }

  return '';
}

function buildHeaders(raw: RawAdmissionReportResponse, rows: AdmissionReportRow[]) {
  const headers = toArray(raw.headers)
    .map((value) => readString(value))
    .filter(Boolean);

  if (headers.length > 0) {
    return headers;
  }

  return rows[0] ? Object.keys(rows[0]) : [];
}

function toIsoDatePart(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return '';
  return trimmed.slice(0, 10);
}

function withinDateRange(value: string, fromDate: string, toDate: string) {
  const current = toIsoDatePart(value);
  if (!current) return false;
  if (fromDate && current < fromDate) return false;
  if (toDate && current > toDate) return false;
  return true;
}

async function fetchProxyPayload(
  session: SessionContext,
  path: string,
  query: Record<string, string>
) {
  const proxyQuery = new URLSearchParams({
    path,
    ...query,
  });

  const response = await fetch(`/api/proxy?${proxyQuery.toString()}`, {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
    headers: {
      ...createAuthHeaders(session),
      'X-Requested-With': 'XMLHttpRequest',
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Failed to load ${path} (${response.status}).`);
  }

  const payload = await readJson<RawAdmissionReportResponse>(
    response,
    `Failed to parse ${path} response.`
  );

  if (normalizeApiStatus(payload) !== '1') {
    throw new Error(readString(payload.message) || `Failed to load ${path}.`);
  }

  return payload;
}

async function buildWithoutConfirmationFallbackResult(
  filters: AdmissionReportFilters
): Promise<AdmissionReportResult> {
  const session = requireSession();
  const baseQuery = {
    type: 'API',
    sub_institute_id: session.subInstituteId,
    syear: session.syear,
  };

  const listPayload = await fetchProxyPayload(session, 'api/admission_without_confirmation_report_v2', baseQuery);
  const listRows = toArray(listPayload.data).map((entry) => toRecord(entry));

  const detailRows = await Promise.all(
    listRows.map(async (row): Promise<AdmissionReportRow | null> => {
      const id = readString(row.id);
      if (!id) return null;

      try {
        const detailPayload = await fetchProxyPayload(
          session,
          `api/admission_without_confirmation_report_v2/${encodeURIComponent(id)}/edit`,
          {
            ...baseQuery,
            ...(session.termId ? { term_id: session.termId } : {}),
          }
        );

        const editData = toRecord(detailPayload.editData);
        const registrationEnquiryId = readString(editData.registration_enquiry_id);
        if (registrationEnquiryId) return null;

        const createdOn = readString(editData.enquiry_created_on || editData.created_on);
        if (!withinDateRange(createdOn, filters.fromDate, filters.toDate)) return null;

        const status = readString(editData.status).toUpperCase();
        if (filters.status && status !== filters.status.toUpperCase()) return null;

        return {
          enquiry_no: readString(editData.enquiry_no),
          created_on: createdOn,
          followup_date: readString(editData.followup_date),
          first_name: readString(editData.first_name),
          middle_name: readString(editData.middle_name),
          last_name: readString(editData.last_name),
          mobile: readString(editData.mobile),
          email: readString(editData.email),
          admission_standard: readString(editData.std_name || editData.admission_standard),
          form_no: readString(editData.form_no),
          status: status || '-',
        } satisfies AdmissionReportRow;
      } catch {
        return null;
      }
    })
  );

  const rows = detailRows.filter((row): row is AdmissionReportRow => Boolean(row));

  return {
    message: rows.length > 0 ? 'Success' : 'Please revise your search. No data found.',
    rows,
    headers: withoutConfirmationFallbackHeaders,
    users: [],
    fields: [],
  };
}

/**
 * Corrected variant of buildWithoutConfirmationFallbackResult() for the Admission
 * Without Confirmation Report.
 *
 * Added as a new function (rather than editing buildWithoutConfirmationFallbackResult())
 * so existing call sites/behaviour are untouched. The original silently swallows every
 * per-row detail-fetch failure into `null` via `catch { return null; }`, so if the list
 * call succeeds but every detail call then fails (e.g. a transient network/DB blip while
 * fetching 8 rows in parallel), the user sees the exact same "Please revise your search.
 * No data found." as a genuine empty result - there is no way to tell a real failure
 * apart from a correct empty answer. This variant tracks detail-fetch failures
 * separately and throws a real, actionable error when every candidate row failed to
 * load (list had candidates, but zero rows/zero successes), instead of masking it as
 * "no data".
 */
async function buildWithoutConfirmationFallbackResultV2(
  filters: AdmissionReportFilters
): Promise<AdmissionReportResult> {
  const session = requireSession();
  const baseQuery = {
    type: 'API',
    sub_institute_id: session.subInstituteId,
    syear: session.syear,
  };

  const listPayload = await fetchProxyPayload(session, 'api/admission_without_confirmation_report_v2', baseQuery);
  const listRows = toArray(listPayload.data).map((entry) => toRecord(entry));

  let detailErrorCount = 0;

  const detailRows = await Promise.all(
    listRows.map(async (row): Promise<AdmissionReportRow | null> => {
      const id = readString(row.id);
      if (!id) return null;

      let detailPayload: RawAdmissionReportResponse;
      try {
        detailPayload = await fetchProxyPayload(
          session,
          `api/admission_without_confirmation_report_v2/${encodeURIComponent(id)}/edit`,
          {
            ...baseQuery,
            ...(session.termId ? { term_id: session.termId } : {}),
          }
        );
      } catch {
        detailErrorCount += 1;
        return null;
      }

      const editData = toRecord(detailPayload.editData);
      const registrationEnquiryId = readString(editData.registration_enquiry_id);
      if (registrationEnquiryId) return null;

      const createdOn = readString(editData.enquiry_created_on || editData.created_on);
      if (!withinDateRange(createdOn, filters.fromDate, filters.toDate)) return null;

      // There is no admission_registration row for anything this report lists
      // (that's what "registrationEnquiryId" being empty just confirmed above), so
      // there is no registration-status value (Open/Close lives on that record) to
      // read here - admission_enquiry.status holds unrelated values like "approve"
      // and is never Open/Close. Every row this report can show is, by definition,
      // still pending confirmation, i.e. inherently "Open"; "Close" can never
      // legitimately match a row here, since a closed/registered record leaves this
      // report entirely once it gets a registration.
      if (filters.status && filters.status.toUpperCase() !== 'OPEN') return null;

      return {
        enquiry_no: readString(editData.enquiry_no),
        created_on: createdOn,
        followup_date: readString(editData.followup_date),
        first_name: readString(editData.first_name),
        middle_name: readString(editData.middle_name),
        last_name: readString(editData.last_name),
        mobile: readString(editData.mobile),
        email: readString(editData.email),
        admission_standard: readString(editData.std_name || editData.admission_standard),
        form_no: readString(editData.form_no),
        status: 'OPEN',
      } satisfies AdmissionReportRow;
    })
  );

  const rows = detailRows.filter((row): row is AdmissionReportRow => Boolean(row));

  if (rows.length === 0 && listRows.length > 0 && detailErrorCount === listRows.length) {
    throw new Error(
      `Failed to load ${detailErrorCount} admission record${detailErrorCount === 1 ? '' : 's'} while running this report (a network or database error, not an empty result) - please retry the search.`
    );
  }

  return {
    message: rows.length > 0 ? 'Success' : 'Please revise your search. No data found.',
    rows,
    headers: withoutConfirmationFallbackHeaders,
    users: [],
    fields: [],
  };
}

async function fetchAdmissionFormDetail(
  session: SessionContext,
  id: string
): Promise<Record<string, unknown> | null> {
  try {
    const detailPayload = await fetchProxyPayload(
      session,
      `admission/admission_registration_report_v2/${encodeURIComponent(id)}/edit`,
      {
        type: 'API',
        sub_institute_id: session.subInstituteId,
        syear: session.syear,
        ...(session.termId ? { term_id: session.termId } : {}),
      }
    );

    return toRecord(detailPayload.editData);
  } catch {
    return null;
  }
}

function normalizeAdmissionFormFields(value: unknown): AdmissionReportFieldOption[] {
  return toArray(value)
    .map((entry) => {
      const record = toRecord(entry);
      const key = readString(record.field_name);
      const label = readString(record.field_label) || prettifyLabel(key);
      return { key, label };
    })
    .filter((option) => option.key && !admissionRegistrationDefaultFields.includes(option.key));
}

async function buildAdmissionRegistrationFallbackContext(): Promise<AdmissionReportResult> {
  const session = requireSession();
  const payload = await fetchProxyPayload(session, 'admission/admission_registration_report_v2', {
    type: 'API',
    sub_institute_id: session.subInstituteId,
    syear: session.syear,
  });

  return {
    message: 'Fallback mode enabled for Admission Registration Report.',
    rows: [],
    headers: admissionRegistrationDefaultFields,
    users: [],
    fields: normalizeAdmissionFormFields(payload.dataCustomFields),
  };
}

async function buildAdmissionRegistrationFallbackResult(
  filters: AdmissionReportFilters,
  selectedFields: string[]
): Promise<AdmissionReportResult> {
  const session = requireSession();
  const payload = await fetchProxyPayload(session, 'admission/admission_registration_report_v2', {
    type: 'API',
    sub_institute_id: session.subInstituteId,
    syear: session.syear,
  });
  const listRows = toArray(payload.data).map((entry) => toRecord(entry));
  const headers = Array.from(
    new Set([
      ...admissionRegistrationDefaultFields,
      ...selectedFields.filter(Boolean),
    ])
  );

  const detailRows = await Promise.all(
    listRows.map(async (row) => {
      const id = readString(row.id);
      if (!id) return null;

      const detail = await fetchAdmissionFormDetail(session, id);
      if (!detail) return null;

      const createdOn = readString(detail.created_on);
      if (!withinDateRange(createdOn, filters.fromDate, filters.toDate)) return null;

      const registrationStatus = readString(detail.registration_status).toUpperCase();
      if (filters.status && registrationStatus !== filters.status.toUpperCase()) return null;

      return Object.fromEntries(
        headers.map((header) => [header, readString(detail[header]) || readString(row[header])])
      ) satisfies AdmissionReportRow;
    })
  );

  const rows = detailRows.filter((row): row is AdmissionReportRow => Boolean(row));

  return {
    message: rows.length > 0 ? 'Success' : 'Please revise your search. No data found.',
    rows,
    headers,
    users: [],
    fields: normalizeAdmissionFormFields(payload.dataCustomFields),
  };
}

function buildPayload(
  reportId: AdmissionReportId,
  filters: AdmissionReportFilters,
  selectedFields: string[]
) {
  const payload = new URLSearchParams();
  const session = requireSession();

  payload.set('type', 'API');
  payload.set('sub_institute_id', session.subInstituteId);
  payload.set('syear', session.syear);
  payload.set('report', 'Search');

  if (filters.fromDate) payload.set('from_date', filters.fromDate);
  if (filters.toDate) payload.set('to_date', filters.toDate);

  if (reportId === 'admission_inquiry' && filters.user) {
    payload.set('user', filters.user);
  }

  if (
    reportId === 'admission_registration' ||
    reportId === 'admission_without_confirmation' ||
    reportId === 'admission_confirmation'
  ) {
    if (filters.status) payload.set('status', filters.status);
  }

  if (reportId === 'inquiry_followup' && filters.followUpStatus) {
    payload.set('follow_up_status', filters.followUpStatus);
  }

  selectedFields.forEach((field) => {
    if (field) payload.append('dynamicFields[]', field);
  });

  return payload;
}

export async function fetchAdmissionReportContext(
  reportId: AdmissionReportId
): Promise<AdmissionReportResult> {
  if (reportId === 'admission_registration') {
    return buildAdmissionRegistrationFallbackContext();
  }

  if (reportId === 'admission_without_confirmation') {
    return {
      message: 'Fallback mode enabled for Admission Without Confirmation Report.',
      rows: [],
      headers: withoutConfirmationFallbackHeaders,
      users: [],
      fields: [],
    };
  }

  const session = requireSession();
  const proxyQuery = new URLSearchParams({
    path: endpointByReport[reportId].replace(/^\/+/, ''),
    type: 'API',
  });
  if (session.subInstituteId) proxyQuery.set('sub_institute_id', session.subInstituteId);
  if (session.syear) proxyQuery.set('syear', session.syear);

  const response = await fetch(`/api/proxy?${proxyQuery.toString()}`, {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
    headers: {
      ...createAuthHeaders(session),
      'X-Requested-With': 'XMLHttpRequest',
    },
  });

  if (!response.ok) {
    const responseText = await response.text();
    const backendGapMessage = buildBackendGapMessage(reportId, responseText);
    if (backendGapMessage) {
      return {
        message: 'Fallback mode enabled for Admission Without Confirmation Report.',
        rows: [],
        headers: withoutConfirmationFallbackHeaders,
        users: [],
        fields: [],
      };
    }
    throw new Error(
      backendGapMessage || `Failed to load ${reportId.replace(/_/g, ' ')} (${response.status}).`
    );
  }

  const raw = await readJson<RawAdmissionReportResponse>(
    response,
    'Failed to parse the admission report metadata response.'
  );

  if (normalizeApiStatus(raw) !== '1') {
    throw new Error(readString(raw.message) || 'Failed to load report metadata.');
  }

  const rows = toRows(raw.data);
  const headers = buildHeaders(raw, rows);

  return {
    message: readString(raw.message) || 'Success',
    rows,
    headers: headers.length > 0 ? headers : admissionRegistrationDefaultFields,
    users: normalizeUsers(raw.users),
    fields: normalizeFields(raw.fields),
  };
}

export async function runAdmissionReport(
  reportId: AdmissionReportId,
  filters: AdmissionReportFilters,
  selectedFields: string[]
): Promise<AdmissionReportResult> {
  if (reportId === 'admission_registration') {
    return buildAdmissionRegistrationFallbackResult(filters, selectedFields);
  }

  if (reportId === 'admission_without_confirmation') {
    return buildWithoutConfirmationFallbackResultV2(filters);
  }

  const session = requireSession();
  const proxyQuery = new URLSearchParams({
    path: endpointByReport[reportId].replace(/^\/+/, ''),
  });
  const response = await fetch(
    `/api/proxy?${proxyQuery.toString()}`,
    {
      method: 'POST',
      credentials: 'include',
      cache: 'no-store',
      headers: {
        ...createAuthHeaders(session, 'application/x-www-form-urlencoded;charset=UTF-8'),
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: buildPayload(reportId, filters, selectedFields).toString(),
    }
  );

  if (!response.ok) {
    const responseText = await response.text();
    const backendGapMessage = buildBackendGapMessage(reportId, responseText);
    if (backendGapMessage) {
      return buildWithoutConfirmationFallbackResult(filters);
    }
    const sessionHint = sessionDrivenReportIds.includes(reportId)
      ? ' This report relies on a Laravel web-session controller.'
      : '';
    throw new Error(
      backendGapMessage ||
        `Failed to run ${reportId.replace(/_/g, ' ')} (${response.status}).${sessionHint}`
    );
  }

  const raw = await readJson<RawAdmissionReportResponse>(
    response,
    'Failed to parse the admission report response.'
  );

  if (normalizeApiStatus(raw) !== '1') {
    throw new Error(readString(raw.message) || 'No data found for the selected filters.');
  }

  const rows = toRows(raw.data);

  return {
    message: readString(raw.message) || 'Success',
    rows,
    headers: buildHeaders(raw, rows),
    users: normalizeUsers(raw.users),
    fields: normalizeFields(raw.fields),
  };
}

export function formatReportHeaderLabel(value: string) {
  return prettifyLabel(value);
}
