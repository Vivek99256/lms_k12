'use client';

import {
  appendSessionParams,
  asRecord,
  fetchLaravelJson,
  getFeesSession,
  readString,
  toArray,
} from '@/app/fees/_lib/fees-api';

export type StudentPreview = {
  schoolName: string;
  cardTitle: string;
  name: string;
  admissionNo: string;
  gradeClass: string;
  house: string;
  bloodGroup: string;
  emergencyContact: string;
  validTill: string;
  initials: string;
  photoUrl?: string;
};

type ApiEnvelope = { status?: string | number; message?: string; data?: unknown };

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

function getSchoolName(): string {
  if (typeof window === 'undefined') return 'Teach Connect';
  try {
    const stored = localStorage.getItem('userData');
    if (stored) {
      const parsed = JSON.parse(stored) as Record<string, unknown>;
      return readString(parsed.school_name) || 'Teach Connect';
    }
  } catch {}
  return 'Teach Connect';
}

export async function getStudentIdCardPreview(signal?: AbortSignal): Promise<StudentPreview | null> {
  const { session, params } = sessionParams();
  if (session.userProfileName) params.set('user_profile_name', session.userProfileName);
  if (session.userId) params.set('user_id', session.userId);

  const payload = await fetchLaravelJson<ApiEnvelope>(
    session,
    `/api/proxy?path=get_adminStudentSearch&${params.toString()}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
      signal,
    },
  );

  if (Number(payload.status) !== 1) throw new Error(payload.message || 'Unable to load student profile.');

  const rows = toArray(payload.data).map(asRecord);
  const student = rows[0];
  if (!student) return null;

  const name = [student.first_name, student.middle_name, student.last_name].map(readString).filter(Boolean).join(' ');
  const syear = session.academicYearId ? Number(session.academicYearId) : new Date().getFullYear();

  return {
    schoolName: getSchoolName(),
    cardTitle: 'STUDENT IDENTITY CARD',
    name,
    admissionNo: readString(student.enrollment_no),
    gradeClass: [readString(student.standard), readString(student.division)].filter(Boolean).join(' - '),
    house: readString(student.house),
    bloodGroup: readString(student.bloodgroup) || '—',
    emergencyContact: readString(student.mobile) || '—',
    validTill: `31 Mar ${Number.isFinite(syear) ? syear + 1 : new Date().getFullYear() + 1}`,
    initials: initialsOf(name) || '—',
  };
}
