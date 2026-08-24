import {
  buildSessionContext,
  createAuthHeaders,
  readNumber,
  readString,
  type SessionContext,
} from '@/lib/erp-client';

/**
 * Exam-wise progress report data layer (LMS → Test → Exam).
 *
 *   GET /lms/ajax_LMS_SubjectWiseExam?type=API&std_id=&sub_id=  → exams for a class
 *   GET /lms/lmsExamwise_progress_report/create?type=API&...     → the report matrix
 *
 * Backend fixes (committed in next_lms_erp): `ajax_LMS_SubjectWiseExam` now
 * honours `type=API`, and `create` now returns a clean per-(student,exam)
 * `marks_matrix`. This layer prefers those; when the backend isn't deployed yet
 * it falls back to `/api/question-paper` for the exam list and to the legacy
 * `student_data` marks — so the report works now and upgrades after deploy.
 */

function requireSession(): SessionContext {
  const session = buildSessionContext();
  if (!session.baseUrl) throw new Error('Session data is missing. Please sign in again.');
  return session;
}

function userProfileName(): string {
  if (typeof window === 'undefined') return '';
  try {
    const menuContext = JSON.parse(localStorage.getItem('menuContext') || '{}') as Record<string, unknown>;
    const userData = JSON.parse(localStorage.getItem('userData') || '{}') as Record<string, unknown>;
    return readString(menuContext.user_profile_name ?? userData.user_profile_name ?? userData.user_profile);
  } catch {
    return '';
  }
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

export interface ReportExam {
  id: string;
  name: string;
  totalMarks: number;
  examType: string;
}

export interface ReportStudent {
  id: string;
  name: string;
  enrollmentNo: string;
  standard: string;
  division: string;
}

export interface GradeBand {
  title: string;
  breakoff: number;
}

export interface ExamScore {
  obtain: number | null;
  answered: number;
  attempts: number;
}

export interface ProgressReport {
  students: ReportStudent[];
  exams: ReportExam[];
  gradeScale: GradeBand[];
  /** marks[studentId][examId] */
  marks: Record<string, Record<string, ExamScore>>;
}

export interface ReportFilters {
  gradeId: string;
  standardId: string;
  divisionId: string;
  subjectId: string;
  examIds: string[];
  /** true = only students who attempted (inner join); false = all students. */
  attemptedOnly: boolean;
}

// ---------------------------------------------------------------------------
// Exam list for the multi-select
// ---------------------------------------------------------------------------

function mapExam(entry: unknown): ReportExam | null {
  const r = toRecord(entry);
  const id = readString(r.id);
  if (!id) return null;
  return {
    id,
    name: readString(r.paper_name) || `Paper #${id}`,
    totalMarks: readNumber(r.total_marks),
    examType: readString(r.exam_type),
  };
}

export async function fetchExamsForSubject(
  standardId: string,
  subjectId: string,
  signal?: AbortSignal
): Promise<ReportExam[]> {
  if (!standardId || !subjectId) return [];
  const session = requireSession();

  // Primary: purpose-built endpoint returning ALL class exams (needs the backend
  // fix deployed for type=API).
  const url = new URL(`${session.baseUrl}/lms/ajax_LMS_SubjectWiseExam`);
  url.searchParams.set('type', 'API');
  url.searchParams.set('sub_institute_id', session.subInstituteId);
  url.searchParams.set('syear', session.syear);
  url.searchParams.set('std_id', standardId);
  url.searchParams.set('sub_id', subjectId);

  try {
    const res = await fetch(url.toString(), {
      headers: { ...createAuthHeaders(session), 'X-Requested-With': 'XMLHttpRequest' },
      signal,
    });
    if (res.ok) {
      const raw = await readJson(res, 'Failed to load exams');
      const rows = Array.isArray(raw) ? raw : toArray(toRecord(raw).data);
      const exams = rows.map(mapExam).filter((e): e is ReportExam => e !== null);
      if (exams.length > 0) return exams;
    }
  } catch {
    // fall through to the deploy-free fallback
  }

  // Fallback (deploy-free): the REST list, filtered client-side by std+subject.
  return fetchExamsFallback(session, standardId, subjectId, signal);
}

async function fetchExamsFallback(
  session: SessionContext,
  standardId: string,
  subjectId: string,
  signal?: AbortSignal
): Promise<ReportExam[]> {
  const url = new URL(`${session.baseUrl}/api/question-paper`);
  url.searchParams.set('type', 'API');
  url.searchParams.set('sub_institute_id', session.subInstituteId);
  url.searchParams.set('syear', session.syear);
  url.searchParams.set('user_profile_name', userProfileName());
  url.searchParams.set('user_id', session.userId);
  url.searchParams.set('standard_id', standardId);
  url.searchParams.set('subject_id', subjectId);

  const res = await fetch(url.toString(), { headers: createAuthHeaders(session), signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}: Unable to load exams.`);
  const raw = toRecord(await readJson(res, 'Failed to load exams'));
  return toArray(raw.data)
    .map((entry) => {
      const r = toRecord(entry);
      if (readString(r.standard_id) !== standardId || readString(r.subject_id) !== subjectId) return null;
      return mapExam(entry);
    })
    .filter((e): e is ReportExam => e !== null);
}

// ---------------------------------------------------------------------------
// The report
// ---------------------------------------------------------------------------

export async function fetchProgressReport(
  filters: ReportFilters,
  signal?: AbortSignal
): Promise<ProgressReport> {
  const session = requireSession();

  const url = new URL(`${session.baseUrl}/lms/lmsExamwise_progress_report/create`);
  url.searchParams.set('type', 'API');
  url.searchParams.set('sub_institute_id', session.subInstituteId);
  url.searchParams.set('syear', session.syear);
  url.searchParams.set('grade', filters.gradeId);
  url.searchParams.set('standard', filters.standardId);
  url.searchParams.set('division', filters.divisionId);
  url.searchParams.set('subject', filters.subjectId);
  url.searchParams.set('exam_type', filters.attemptedOnly ? '0' : '1');
  filters.examIds.forEach((id) => url.searchParams.append('exam_id[]', id));

  const res = await fetch(url.toString(), {
    headers: { ...createAuthHeaders(session), 'X-Requested-With': 'XMLHttpRequest' },
    signal,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: Unable to load the report.`);
  const raw = toRecord(await readJson(res, 'Failed to load the report'));

  const exams: ReportExam[] = toArray(raw.exams_data)
    .map(mapExam)
    .filter((e): e is ReportExam => e !== null);

  const students: ReportStudent[] = toArray(raw.student_data).map((entry) => {
    const r = toRecord(entry);
    return {
      id: readString(r.id),
      name: readString(r.student_name).trim(),
      enrollmentNo: readString(r.enrollment_no),
      standard: readString(r.std_name),
      division: readString(r.div_name),
    };
  });

  const gradeScale: GradeBand[] = toArray(raw.grade_data)
    .map((entry) => {
      const r = toRecord(entry);
      return { title: readString(r.title), breakoff: readNumber(r.breakoff) };
    })
    .filter((g) => g.title)
    .sort((a, b) => b.breakoff - a.breakoff);

  // Prefer the clean per-(student,exam) matrix (backend fix). Fall back to the
  // legacy student_data best-score per exam when the fix isn't deployed yet.
  const marks: Record<string, Record<string, ExamScore>> = {};
  const matrix = toRecord(raw.marks_matrix);
  if (Object.keys(matrix).length > 0) {
    for (const [studentId, perExam] of Object.entries(matrix)) {
      marks[studentId] = {};
      for (const [examId, score] of Object.entries(toRecord(perExam))) {
        const s = toRecord(score);
        const obtainRaw = s.obtain;
        marks[studentId][examId] = {
          obtain: obtainRaw == null || obtainRaw === '-' ? null : readNumber(obtainRaw),
          answered: readNumber(s.answered),
          attempts: readNumber(s.attempts),
        };
      }
    }
  } else {
    // Legacy fallback: student_data carries a single (best) obtain_marks + the
    // CSV of exam ids the row aggregates — apply it to each of those exams.
    toArray(raw.student_data).forEach((entry) => {
      const r = toRecord(entry);
      const studentId = readString(r.id);
      const obtainRaw = r.obtain_marks;
      const obtain = obtainRaw == null || obtainRaw === '-' ? null : readNumber(obtainRaw);
      const examIds = readString(r.question_paper_id).split(',').map((x) => x.trim()).filter(Boolean);
      marks[studentId] = {};
      examIds.forEach((examId) => {
        marks[studentId][examId] = { obtain, answered: 0, attempts: obtain == null ? 0 : 1 };
      });
    });
  }

  return { students, exams, gradeScale, marks };
}

/** Resolve a score to its grade band title (highest breakoff ≤ percentage). */
export function gradeForPercent(percent: number, scale: GradeBand[]): string {
  for (const band of scale) {
    if (percent >= band.breakoff) return band.title;
  }
  return scale.length > 0 ? scale[scale.length - 1].title : '';
}
