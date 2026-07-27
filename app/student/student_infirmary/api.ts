'use client';

import {
  appendSessionParams,
  asRecord,
  fetchLaravelJson,
  getFeesSession,
  readString,
  toArray,
} from '@/app/fees/_lib/fees-api';

export type InfirmaryRecord = {
  id: string;
  student_id: string;
  student_name: string;
  medical_case_no: string;
  doctor_name: string;
  doctor_contact: string;
  date: string;
  complaint: string;
  symptoms: string;
  disease: string;
  treatments: string;
  medical_close_date: string;
  health_center: string;
};

export type StudentOption = {
  id: string;
  enrollmentNo: string;
  name: string;
};

export type InfirmaryForm = Omit<InfirmaryRecord, 'id' | 'student_name'> & {
  student_name?: string;
};

type ApiEnvelope = { status?: string | number; message?: string; data?: unknown };

function assertSuccess(payload: ApiEnvelope) {
  if (Number(payload.status) !== 1) throw new Error(payload.message || 'Unable to complete request.');
}

function sessionParams() {
  const session = getFeesSession();
  const params = new URLSearchParams();
  appendSessionParams(params, session);
  return { session, params };
}

function normalizeRecord(value: unknown): InfirmaryRecord {
  const row = asRecord(value);
  const keys: Array<keyof InfirmaryRecord> = [
    'id', 'student_id', 'student_name', 'medical_case_no', 'doctor_name',
    'doctor_contact', 'date', 'complaint', 'symptoms', 'disease',
    'treatments', 'medical_close_date', 'health_center',
  ];
  return Object.fromEntries(keys.map((key) => [key, readString(row[key])])) as InfirmaryRecord;
}

export async function getInfirmaryRecords(signal?: AbortSignal): Promise<{
  records: InfirmaryRecord[];
  nextCaseNumber: string;
}> {
  const { session, params } = sessionParams();
  const payload = await fetchLaravelJson<ApiEnvelope>(
    session,
    `/api/proxy?path=student-infirmary&${params.toString()}`,
    { signal },
  );
  assertSuccess(payload);
  const data = asRecord(payload.data);
  return {
    records: toArray(data.records).map(normalizeRecord),
    nextCaseNumber: readString(data.next_case_number),
  };
}

export async function searchInfirmaryStudents(query: string, signal?: AbortSignal): Promise<StudentOption[]> {
  const { session, params } = sessionParams();
  params.set('query', query);
  const payload = await fetchLaravelJson<ApiEnvelope>(
    session,
    `/api/proxy?path=student-infirmary/students&${params.toString()}`,
    { signal },
  );
  assertSuccess(payload);
  return toArray(payload.data).map((value) => {
    const row = asRecord(value);
    return {
      id: readString(row.id),
      enrollmentNo: readString(row.enrollment_no),
      name: readString(row.student_name),
    };
  });
}

export async function saveInfirmaryRecord(form: InfirmaryForm, id?: string): Promise<string> {
  const { session, params } = sessionParams();
  Object.entries(form).forEach(([key, value]) => {
    if (key !== 'student_name') params.set(key, value ?? '');
  });
  const payload = await fetchLaravelJson<ApiEnvelope>(
    session,
    `/api/proxy?path=student-infirmary${id ? `/${encodeURIComponent(id)}` : ''}`,
    {
      method: id ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    },
  );
  assertSuccess(payload);
  return payload.message || 'Infirmary record saved.';
}

export async function deleteInfirmaryRecord(id: string): Promise<string> {
  const { session, params } = sessionParams();
  const payload = await fetchLaravelJson<ApiEnvelope>(
    session,
    `/api/proxy?path=student-infirmary/${encodeURIComponent(id)}`,
    {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    },
  );
  assertSuccess(payload);
  return payload.message || 'Infirmary record deleted.';
}
