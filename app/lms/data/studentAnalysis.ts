import {
  buildSessionContext,
  createAuthHeaders,
  readNumber,
  readString,
  type SessionContext,
} from '@/lib/erp-client';

/**
 * LMS → Student Analysis Report data layer.
 *
 *   GET /lms/lmsStudent_report/create?type=API&sub_institute_id&syear
 *       &grade&standard&division                         → student list
 *   GET /lms/lmsStudent_report/{id}/edit?type=API&sub_institute_id&syear
 *       &subject_id                                       → per-student analysis
 *
 * The Laravel controllers now read tenant params from the request (headless
 * fallback), falling back to the session otherwise. Note: the Laravel `edit`
 * intentionally returns an empty `lo_arr` (Learning Outcome tabs are disabled in
 * the live app), so we do not surface those — this matches current behaviour.
 */

function requireSession(): SessionContext {
  const session = buildSessionContext();
  if (!session.baseUrl) throw new Error('Session data is missing. Please sign in again.');
  return session;
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}
function toArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

async function readJson(res: Response, fallback: string): Promise<unknown> {
  const text = (await res.text()).trim();
  if (!text) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error(`${fallback} (HTTP ${res.status}).`);
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StudentListRow {
  id: string;
  name: string;
  enrollmentNo: string;
  mobile: string;
}

export interface AnalysisSubject {
  subjectId: string;
  displayName: string;
}

export interface AnalysisExam {
  paperId: string;
  paperName: string;
  obtainedMarks: number;
  totalMarks: number;
  /** 0–100, clamped. */
  obtainedPercentage: number;
}

export interface StudentProfile {
  name: string;
  enrollmentNo: string;
  mobile: string;
  dob: string;
  city: string;
  image: string;
}

export interface StudentAnalysis {
  studentId: string;
  profile: StudentProfile;
  subjects: AnalysisSubject[];
  currentSubjectId: string;
  exams: AnalysisExam[];
  grandTotal: number;
  grandObtained: number;
}

export interface StudentListFilters {
  gradeId: string;
  standardId: string;
  divisionId: string;
}

// ---------------------------------------------------------------------------
// Student list
// ---------------------------------------------------------------------------

function studentName(r: Record<string, unknown>): string {
  const composed = [r.first_name, r.middle_name, r.last_name]
    .map((v) => readString(v).trim())
    .filter(Boolean)
    .join(' ');
  return composed || readString(r.student_name).trim();
}

export async function fetchStudentList(
  filters: StudentListFilters,
  signal?: AbortSignal
): Promise<StudentListRow[]> {
  const session = requireSession();

  const url = new URL(`${session.baseUrl}/lms/lmsStudent_report/create`);
  url.searchParams.set('type', 'API');
  url.searchParams.set('sub_institute_id', session.subInstituteId);
  url.searchParams.set('syear', session.syear);
  url.searchParams.set('grade', filters.gradeId);
  url.searchParams.set('standard', filters.standardId);
  url.searchParams.set('division', filters.divisionId);

  const res = await fetch(url.toString(), {
    headers: { ...createAuthHeaders(session), 'X-Requested-With': 'XMLHttpRequest' },
    signal,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: Unable to load students.`);
  const raw = toRecord(await readJson(res, 'Failed to load students'));

  return toArray(raw.student_data)
    .map((entry) => {
      const r = toRecord(entry);
      const id = readString(r.id);
      if (!id) return null;
      return {
        id,
        name: studentName(r) || `Student #${id}`,
        enrollmentNo: readString(r.enrollment_no),
        mobile: readString(r.mobile),
      };
    })
    .filter((row): row is StudentListRow => row !== null);
}

// ---------------------------------------------------------------------------
// Per-student analysis
// ---------------------------------------------------------------------------

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export async function fetchStudentAnalysis(
  studentId: string,
  subjectId?: string,
  signal?: AbortSignal
): Promise<StudentAnalysis> {
  const session = requireSession();

  const url = new URL(`${session.baseUrl}/lms/lmsStudent_report/${encodeURIComponent(studentId)}/edit`);
  url.searchParams.set('type', 'API');
  url.searchParams.set('sub_institute_id', session.subInstituteId);
  url.searchParams.set('syear', session.syear);
  if (subjectId) url.searchParams.set('subject_id', subjectId);

  const res = await fetch(url.toString(), {
    headers: { ...createAuthHeaders(session), 'X-Requested-With': 'XMLHttpRequest' },
    signal,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: Unable to load the analysis.`);
  const raw = toRecord(await readJson(res, 'Failed to load the analysis'));

  const profileRecord = toRecord(raw.student_data);
  const profile: StudentProfile = {
    name: readString(profileRecord.student_name).trim() || studentName(profileRecord),
    enrollmentNo: readString(profileRecord.enrollment_no),
    mobile: readString(profileRecord.mobile),
    dob: readString(profileRecord.dob),
    city: readString(profileRecord.city),
    image: readString(profileRecord.image),
  };

  const subjects: AnalysisSubject[] = toArray(raw.all_subject_arr)
    .map((entry) => {
      const r = toRecord(entry);
      const subjectId2 = readString(r.subject_id);
      if (!subjectId2) return null;
      return { subjectId: subjectId2, displayName: readString(r.display_name) || `Subject ${subjectId2}` };
    })
    .filter((s): s is AnalysisSubject => s !== null);

  const exams: AnalysisExam[] = toArray(raw.exam_arr)
    .map((entry) => {
      const r = toRecord(entry);
      const paperId = readString(r.paper_id);
      const totalMarks = readNumber(r.total_marks);
      const obtainedMarks = readNumber(r.obtained_marks);
      const pctRaw = r.obtained_percentage;
      const obtainedPercentage =
        pctRaw == null || pctRaw === ''
          ? totalMarks > 0
            ? clampPercent((obtainedMarks / totalMarks) * 100)
            : 0
          : clampPercent(readNumber(pctRaw));
      return {
        paperId: paperId || readString(r.paper_name),
        paperName: readString(r.paper_name) || `Paper ${paperId}`,
        obtainedMarks,
        totalMarks,
        obtainedPercentage,
      };
    })
    .filter((e) => e.paperName);

  return {
    studentId,
    profile,
    subjects,
    currentSubjectId: readString(raw.current_subject) || subjectId || subjects[0]?.subjectId || '',
    exams,
    grandTotal: readNumber(raw.grand_total),
    grandObtained: readNumber(raw.grand_obtained),
  };
}
