'use client';

import {
  appendSessionParams,
  asRecord,
  fetchLaravelJson,
  getFeesSession,
  readString,
  toArray,
} from '@/app/fees/_lib/fees-api';
import type { StudentDocument } from './page';

type ApiEnvelope = { status?: string | number; message?: string; data?: unknown; result_report?: unknown; docment_type_data?: unknown };

function sessionParams() {
  const session = getFeesSession();
  const params = new URLSearchParams();
  appendSessionParams(params, session);
  params.set('user_type', 'student');
  return { session, params };
}

export async function getStudentDocuments(signal?: AbortSignal): Promise<StudentDocument[]> {
  const { session, params } = sessionParams();
  const payload = await fetchLaravelJson<ApiEnvelope>(
    session,
    `/api/proxy?path=student/missing_document_report/create&${params.toString()}`,
    { signal },
  );

  const totalDocs = toArray(payload.docment_type_data).length;
  const rows = toArray(payload.result_report).map(asRecord);

  return rows.map((row, index) => {
    const documentList = readString(row.document_list)
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    const verifiedDocs = Math.min(totalDocs, new Set(documentList).size);
    const missingDocs = Math.max(0, totalDocs - verifiedDocs);
    const status: StudentDocument['status'] =
      verifiedDocs === 0 ? 'missing' : verifiedDocs >= totalDocs ? 'complete' : 'pending';

    return {
      id: readString(row.enrollment_no) || String(index),
      name: readString(row.student_name),
      class: readString(row.standard_name),
      section: readString(row.division_name),
      admissionNo: readString(row.enrollment_no),
      verifiedDocs,
      totalDocs,
      pendingDocs: 0,
      missingDocs,
      status,
      lastUpdated: '',
    };
  });
}
