'use client';

import {
  appendSessionParams,
  asRecord,
  fetchLaravelJson,
  getFeesSession,
  readString,
  toArray,
} from '@/app/fees/_lib/fees-api';
import type { Incident } from './page';

type ApiEnvelope = { status?: string | number; message?: string; data?: unknown };

function assertSuccess(payload: ApiEnvelope) {
  if (Number(payload.status) !== 1) throw new Error(payload.message || 'Unable to load discipline records.');
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

function formatShortDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

export type DisciplineMetrics = {
  incidentsThisTerm: number;
  demeritPointsIssued: number;
  studentsFlagged: number;
  resolved: number;
};

export async function getDisciplineData(signal?: AbortSignal): Promise<{
  incidents: Incident[];
  metrics: DisciplineMetrics;
}> {
  const { session, params } = sessionParams();

  const [rosterPayload, disciplinePayload] = await Promise.all([
    fetchLaravelJson<ApiEnvelope>(session, `/api/proxy?path=get_adminStudentSearch&${params.toString()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
      signal,
    }),
    fetchLaravelJson<ApiEnvelope>(session, `/api/proxy?path=student-care/discipline&${params.toString()}`, { signal }),
  ]);

  assertSuccess(rosterPayload);
  assertSuccess(disciplinePayload);

  const rosterByStudentId = new Map<string, Record<string, unknown>>();
  toArray(rosterPayload.data).map(asRecord).forEach((row) => {
    const studentId = readString(row.student_id ?? row.id);
    if (studentId) rosterByStudentId.set(studentId, row);
  });

  const records = toArray(disciplinePayload.data).map(asRecord);

  const incidents: Incident[] = records.map((record) => {
    const studentId = readString(record.student_id);
    const roster = rosterByStudentId.get(studentId);
    const name = readString(record.student_name) || (roster ? readString(roster.first_name) : '');
    const flag = Number(record.flag ?? 0);
    const status: Incident['status'] = flag > 0 ? 'Resolved' : flag < 0 ? 'Open' : 'Under review';
    return {
      date: formatShortDate(readString(record.date_)),
      initials: initialsOf(name) || '—',
      name,
      grade: roster ? readString(roster.standard) : '',
      section: roster ? readString(roster.division) : '',
      category: readString(record.message) || readString(record.dicipline) || '—',
      demeritPoints: flag,
      status,
    };
  });

  const metrics: DisciplineMetrics = {
    incidentsThisTerm: incidents.length,
    demeritPointsIssued: incidents.reduce((sum, incident) => sum + Math.abs(incident.demeritPoints), 0),
    studentsFlagged: new Set(records.map((record) => readString(record.student_id))).size,
    resolved: incidents.filter((incident) => incident.status === 'Resolved').length,
  };

  return { incidents, metrics };
}
