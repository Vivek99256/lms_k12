'use client';

import { appendSessionParams, asRecord, fetchLaravelJson, getFeesSession, readString, toArray } from '@/app/fees/_lib/fees-api';

export type CareModule = 'vaccination' | 'height-weight' | 'health' | 'discipline';
export type CareRecord = { id: string; student_id: string; student_name: string; [key: string]: string };
type Envelope = { status?: string | number; message?: string; data?: unknown };

function context() {
  const session = getFeesSession();
  const params = new URLSearchParams();
  appendSessionParams(params, session);
  return { session, params };
}
function assertSuccess(payload: Envelope) {
  if (Number(payload.status) !== 1) throw new Error(payload.message || 'Unable to complete request.');
}

export async function listCareRecords(module: CareModule, signal?: AbortSignal): Promise<CareRecord[]> {
  const { session, params } = context();
  const payload = await fetchLaravelJson<Envelope>(session, `/api/proxy?path=student-care/${module}&${params}`, { signal });
  assertSuccess(payload);
  return toArray(payload.data).map((value) => Object.fromEntries(
    Object.entries(asRecord(value)).map(([key, item]) => [key, readString(item)]),
  ) as CareRecord);
}

export async function saveCareRecord(module: CareModule, values: CareRecord, id?: string): Promise<string> {
  const { session } = context();
  const payload = await fetchLaravelJson<Envelope>(
    session,
    `/api/proxy?path=student-care/${module}${id ? `/${encodeURIComponent(id)}` : ''}`,
    {
      method: id ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...values,
        type: 'API',
        token: session.token,
        sub_institute_id: session.subInstituteId,
        syear: session.academicYearId,
        user_id: session.userId,
        term_id: session.termId,
      }),
    },
  );
  assertSuccess(payload);
  return payload.message || 'Record saved.';
}

export async function deleteCareRecord(module: CareModule, id: string): Promise<string> {
  const { session, params } = context();
  const payload = await fetchLaravelJson<Envelope>(
    session,
    `/api/proxy?path=student-care/${module}/${encodeURIComponent(id)}`,
    { method: 'DELETE', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: params.toString() },
  );
  assertSuccess(payload);
  return payload.message || 'Record deleted.';
}
