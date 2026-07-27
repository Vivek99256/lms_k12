'use client';

import {
  appendSessionParams,
  asRecord,
  fetchLaravelJson,
  getFeesSession,
  readString,
  toArray,
} from '@/app/fees/_lib/fees-api';

export type BulkField = {
  key: string;
  label: string;
  type: 'text' | 'email' | 'date' | 'select';
};

export type BulkOption = { id: string; label: string };
export type BulkOptions = Record<string, BulkOption[]>;
export type BulkStudentRow = {
  id: string;
  student_name: string;
  updated_on: string;
  [key: string]: string;
};

type ApiEnvelope = {
  status?: string | number;
  message?: string;
  data?: unknown;
};

export type BulkSearchFilters = {
  grade?: string;
  standard?: string;
  division?: string;
  orderBy?: string;
  fields: string[];
};

function assertSuccess(payload: ApiEnvelope) {
  if (Number(payload.status) !== 1) {
    throw new Error(payload.message || 'Unable to complete the request.');
  }
}

export async function getBulkMetadata(signal?: AbortSignal): Promise<{
  fields: BulkField[];
  options: BulkOptions;
}> {
  const session = getFeesSession();
  const params = new URLSearchParams();
  appendSessionParams(params, session);
  const payload = await fetchLaravelJson<ApiEnvelope>(
    session,
    `/api/proxy?path=bulk-students/metadata&${params.toString()}`,
    { signal },
  );
  assertSuccess(payload);
  const data = asRecord(payload.data);
  const fields = toArray(data.fields).map((value) => {
    const row = asRecord(value);
    return {
      key: readString(row.key),
      label: readString(row.label),
      type: readString(row.type) as BulkField['type'],
    };
  }).filter((field) => field.key);

  const options: BulkOptions = {};
  Object.entries(asRecord(data.options)).forEach(([key, value]) => {
    options[key] = toArray(value).map((item) => {
      const row = asRecord(item);
      return { id: readString(row.id), label: readString(row.label) };
    });
  });
  return { fields, options };
}

export async function searchBulkStudents(
  filters: BulkSearchFilters,
  signal?: AbortSignal,
): Promise<BulkStudentRow[]> {
  const session = getFeesSession();
  const body = new URLSearchParams();
  appendSessionParams(body, session);
  if (filters.grade) body.set('grade', filters.grade);
  if (filters.standard) body.set('standard', filters.standard);
  if (filters.division) body.set('division', filters.division);
  if (filters.orderBy) body.set('order_by', filters.orderBy);
  filters.fields.forEach((field) => body.append('fields[]', field));

  const payload = await fetchLaravelJson<ApiEnvelope>(
    session,
    '/api/proxy?path=bulk-students/search',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      signal,
    },
  );
  assertSuccess(payload);
  return toArray(asRecord(payload.data).students).map((value) => {
    const row = asRecord(value);
    return Object.fromEntries(
      Object.entries(row).map(([key, item]) => [key, readString(item)]),
    ) as BulkStudentRow;
  });
}

export async function saveBulkStudents(rows: BulkStudentRow[], fields: string[]): Promise<string> {
  const session = getFeesSession();
  const payload = await fetchLaravelJson<ApiEnvelope>(
    session,
    '/api/proxy?path=bulk-students',
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'API',
        token: session.token,
        sub_institute_id: session.subInstituteId,
        syear: session.academicYearId,
        user_id: session.userId,
        students: rows.map((row) => ({
          id: row.id,
          values: Object.fromEntries(fields.map((field) => [field, row[field] ?? ''])),
        })),
      }),
    },
  );
  assertSuccess(payload);
  return payload.message || 'Students updated successfully.';
}
