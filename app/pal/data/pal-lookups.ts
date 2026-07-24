import {
  buildSessionContext,
  createAuthHeaders,
  readString,
  type SessionContext,
} from '@/lib/erp-client';

/**
 * PAL lookup data layer — student picker source.
 *
 * Backed by the purpose-built PAL Workspace API (secured by `pal.auth`):
 *   GET /api/pal/workspace/students?syear=&grade_id=&standard_id=&division_id=
 *
 * Grades/standards/divisions themselves come from the shared <SearchDropdown>
 * (get_admin* endpoints), so they are not duplicated here.
 */

interface SessionExtras {
  userProfileName: string;
}

/** Profile name, read from the same localStorage the AuthContext writes. */
function readSessionExtras(): SessionExtras {
  if (typeof window === 'undefined') return { userProfileName: '' };
  try {
    const menuContext = JSON.parse(localStorage.getItem('menuContext') || '{}') as Record<string, unknown>;
    const userData = JSON.parse(localStorage.getItem('userData') || '{}') as Record<string, unknown>;
    return {
      userProfileName: readString(
        menuContext.user_profile_name ?? userData.user_profile_name ?? userData.user_profile
      ),
    };
  } catch {
    return { userProfileName: '' };
  }
}

/** True when the signed-in user is a student (drives self vs. picker view). */
export function isStudentSession(): boolean {
  return readSessionExtras().userProfileName.trim().toLowerCase() === 'student';
}

export function currentProfileName(): string {
  return readSessionExtras().userProfileName;
}

function requireSession(): SessionContext {
  const session = buildSessionContext();
  if (!session.baseUrl) {
    throw new Error('Session data is missing. Please sign in again.');
  }
  return session;
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

// ---------------------------------------------------------------------------
// Students by grade / standard / division
// ---------------------------------------------------------------------------

export interface PalClassStudent {
  /** tblstudent.id — the learner id the PAL workspace/engine endpoints key on. */
  id: string;
  name: string;
  gradeId: string;
  standardId: string;
  divisionId: string;
  standardName: string;
  divisionName: string;
  enrollmentNo: string;
  rollNo: string;
}

export interface ClassFilter {
  gradeId?: string;
  standardId?: string;
  divisionId?: string;
}

export async function fetchClassStudents(
  filter: ClassFilter,
  signal?: AbortSignal
): Promise<PalClassStudent[]> {
  const session = requireSession();

  const url = new URL(`${session.baseUrl}/api/pal/workspace/students`);
  url.searchParams.set('syear', session.syear);
  if (filter.gradeId) url.searchParams.set('grade_id', filter.gradeId);
  if (filter.standardId) url.searchParams.set('standard_id', filter.standardId);
  if (filter.divisionId) url.searchParams.set('division_id', filter.divisionId);

  const response = await fetch(url.toString(), {
    headers: createAuthHeaders(session),
    signal,
  });
  // Backend not deployed yet → fall back to the existing admin student list.
  if (response.status === 404) {
    const { legacyFetchStudents } = await import('@/app/pal/data/pal-legacy');
    return legacyFetchStudents(filter, signal);
  }
  if (response.status === 401 || response.status === 403) {
    const payload = toRecord(await response.json().catch(() => ({})));
    throw new Error(readString(payload.message) || 'You are not allowed to list these students.');
  }
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: Unable to load students.`);
  }

  const payload = toRecord(await response.json());
  const rows = Array.isArray(payload.data) ? payload.data : [];
  return rows.map((entry) => {
    const record = toRecord(entry);
    return {
      id: readString(record.id),
      name: readString(record.student_name).trim(),
      gradeId: readString(record.grade_id),
      standardId: readString(record.standard_id),
      divisionId: readString(record.division_id),
      standardName: readString(record.standard_name),
      divisionName: readString(record.division_name),
      enrollmentNo: readString(record.enrollment_no),
      rollNo: readString(record.roll_no),
    };
  });
}
