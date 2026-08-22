'use client';

import {
  appendSessionParams,
  asRecord,
  fetchLaravelJson,
  getFeesSession,
  readString,
  toArray,
} from '@/app/fees/_lib/fees-api';
import type { FlaggedStudent } from './page';

type ApiEnvelope = { status?: string | number; message?: string; data?: unknown };

function assertSuccess(payload: ApiEnvelope) {
  if (Number(payload.status) !== 1) throw new Error(payload.message || 'Unable to load health records.');
}

function sessionParams() {
  const session = getFeesSession();
  const params = new URLSearchParams();
  appendSessionParams(params, session);
  return { session, params };
}

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export type HealthMetrics = {
  totalProfiles: number;
  vaccinationCompliance: number;
  conditionsFlagged: number;
  infirmaryVisits: number;
};

export async function getHealthAndMedicalData(signal?: AbortSignal): Promise<{
  flagged: FlaggedStudent[];
  metrics: HealthMetrics;
}> {
  const { session, params } = sessionParams();

  const [rosterPayload, infirmaryPayload, vaccinationPayload] = await Promise.all([
    fetchLaravelJson<ApiEnvelope>(session, `/api/proxy?path=get_adminStudentSearch&${params.toString()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
      signal,
    }),
    fetchLaravelJson<ApiEnvelope>(session, `/api/proxy?path=student-infirmary&${params.toString()}`, { signal }),
    fetchLaravelJson<ApiEnvelope>(session, `/api/proxy?path=student-care/vaccination&${params.toString()}`, { signal }),
  ]);

  assertSuccess(rosterPayload);
  const roster = toArray(rosterPayload.data).map(asRecord);

  const infirmaryRecords = Number(infirmaryPayload.status) === 1
    ? toArray(asRecord(infirmaryPayload.data).records).map(asRecord)
    : [];
  const vaccinationRecords = Number(vaccinationPayload.status) === 1
    ? toArray(vaccinationPayload.data).map(asRecord)
    : [];

  const visitsByStudent = new Map<string, number>();
  const conditionByStudent = new Map<string, string>();
  infirmaryRecords.forEach((record) => {
    const studentId = readString(record.student_id);
    if (!studentId) return;
    visitsByStudent.set(studentId, (visitsByStudent.get(studentId) ?? 0) + 1);
    const condition = readString(record.disease) || readString(record.complaint);
    if (condition) conditionByStudent.set(studentId, condition);
  });

  const vaccinatedStudents = new Set(vaccinationRecords.map((record) => readString(record.student_id)).filter(Boolean));

  const students: FlaggedStudent[] = roster.map((row) => {
    const studentId = readString(row.student_id ?? row.id);
    const name = readString(row.first_name)
      ? [row.first_name, row.middle_name, row.last_name].map(readString).filter(Boolean).join(' ')
      : readString(row.student_name);
    const condition = conditionByStudent.get(studentId) || '—';
    const vaccination: FlaggedStudent['vaccination'] = vaccinatedStudents.has(studentId) ? 'Up to date' : 'Overdue';
    return {
      initials: initialsOf(name) || '—',
      name,
      grade: readString(row.standard),
      section: readString(row.division),
      bloodGroup: readString(row.bloodgroup) || '—',
      condition,
      allergies: 'None',
      vaccination,
      infirmaryVisits: visitsByStudent.get(studentId) ?? 0,
    };
  });

  const flagged = students.filter(
    (student) => student.condition !== '—' || student.allergies !== 'None' || student.vaccination === 'Overdue'
  );

  const metrics: HealthMetrics = {
    totalProfiles: students.length,
    vaccinationCompliance: students.length
      ? Math.round((vaccinatedStudents.size / students.length) * 100)
      : 0,
    conditionsFlagged: students.filter((student) => student.condition !== '—').length,
    infirmaryVisits: infirmaryRecords.length,
  };

  return { flagged, metrics };
}
