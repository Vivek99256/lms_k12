import {
  appendCommonParams,
  buildSessionContext,
  createAuthHeaders,
  normalizeApiStatus,
  readNumber,
  readString,
  type ApiEnvelope,
  type SessionContext,
} from '@/lib/erp-client';

// ---------------------------------------------------------------------------
// Result Dashboard — the "Results dashboard" tab beside "Exams" on
// LMS > Test > Exam. Backed by LmsResultDashboardApiController::summary,
// which aggregates question_paper against lms_online_exam attempts.
//
// Shapes mirror TeacherDashboardSummary in app/dashboard/_lib/dashboard-api.ts
// so the same dashboard primitives render both screens.
// ---------------------------------------------------------------------------

export type ResultDashboardSummary = {
  examsPublished: number;
  attemptsRecorded: number;
  studentsAssessed: number;
  /** null when nothing has been attempted yet — distinct from an average of 0. */
  averageScore: number | null;
  needsAttention: number;
};

export type ResultExamRow = {
  id: number;
  paperName: string;
  examType: string;
  standardName: string;
  subjectName: string;
  totalMarks: number;
  totalQuestions: number;
  closeDate: string;
  attempts: number;
  averagePercent: number | null;
  highestPercent: number | null;
  lowestPercent: number | null;
};

export type ScoreBand = { label: string; attempts: number };

export type SubjectPerformanceRow = {
  subjectId: number;
  subjectName: string;
  attempts: number;
  averagePercent: number | null;
};

export type StudentToWatchRow = {
  id: number;
  studentId: number;
  studentName: string;
  paperName: string;
  obtainMarks: number;
  totalMarks: number;
  percent: number | null;
  attemptedOn: string;
};

export type StudentOption = {
  id: number;
  studentName: string;
  rollNo: number;
  standardName: string;
  divisionName: string;
};

/**
 * What the teacher has narrowed to. Ids are kept as strings because that is
 * what <select> and <SearchDropdown> hand back; '' means "no filter".
 */
export type ResultDashboardFilters = {
  gradeId: string;
  standardId: string;
  divisionId: string;
  studentId: string;
};

export const EMPTY_RESULT_FILTERS: ResultDashboardFilters = {
  gradeId: '',
  standardId: '',
  divisionId: '',
  studentId: '',
};

export type ResultDashboardData = {
  /** 'own_exams' for a teacher, 'institute' for admin-level profiles. */
  scope: string;
  summary: ResultDashboardSummary;
  recentExams: ResultExamRow[];
  scoreDistribution: ScoreBand[];
  subjectPerformance: SubjectPerformanceRow[];
  studentsToWatch: StudentToWatchRow[];
  /** Empty until a standard or division is picked - the list is too big otherwise. */
  studentOptions: StudentOption[];
};

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value));

const records = (value: unknown): UnknownRecord[] =>
  Array.isArray(value) ? value.filter(isRecord) : [];

/** null stays null (no data yet); anything numeric becomes a number. */
function readOptionalNumber(value: unknown): number | null {
  return value === null || value === undefined || value === '' ? null : readNumber(value);
}

function session(): SessionContext {
  const value = buildSessionContext();
  if (!value.token || !value.subInstituteId || !value.userId || !value.syear) {
    throw new Error('Your login session is missing a token, institute, user, or academic year.');
  }
  return value;
}

function message(payload: unknown, fallback: string) {
  return isRecord(payload) ? readString(payload.message) || fallback : fallback;
}

/**
 * The endpoint runs behind ['api.session', 'staff.only'], so the bearer token
 * is what identifies the teacher; sub_institute_id / syear / term_id are sent
 * because api.session reads the academic year from the request when the
 * frontend has switched it explicitly.
 */
export async function fetchResultDashboard(
  filters: ResultDashboardFilters = EMPTY_RESULT_FILTERS,
  signal?: AbortSignal
): Promise<ResultDashboardData> {
  const current = session();
  const params = new URLSearchParams();
  appendCommonParams(params, current);

  const response = await fetch(
    `/api/proxy?path=${encodeURIComponent('api/lms-result-dashboard/summary')}&${params}`,
    {
      method: 'POST',
      cache: 'no-store',
      signal,
      headers: createAuthHeaders(current, 'application/json'),
      body: JSON.stringify({
        type: 'API',
        sub_institute_id: Number(current.subInstituteId),
        syear: Number(current.syear),
        user_id: Number(current.userId),
        ...(current.termId ? { term_id: Number(current.termId) } : {}),
        // Empty string means "no filter"; the backend treats '' / 0 / 'all' alike.
        grade_id: filters.gradeId,
        standard_id: filters.standardId,
        division_id: filters.divisionId,
        student_id: filters.studentId,
      }),
    }
  );

  const payload: unknown = await response.json().catch(() => null);

  if (
    !response.ok ||
    (isRecord(payload) && ['0', '2'].includes(normalizeApiStatus(payload as ApiEnvelope)))
  ) {
    throw new Error(message(payload, `Unable to load the result dashboard (${response.status}).`));
  }

  const data = isRecord(payload) ? payload : {};
  const summary = isRecord(data.summary) ? data.summary : {};

  return {
    scope: readString(data.scope),
    summary: {
      examsPublished: readNumber(summary.exams_published),
      attemptsRecorded: readNumber(summary.attempts_recorded),
      studentsAssessed: readNumber(summary.students_assessed),
      averageScore: readOptionalNumber(summary.average_score),
      needsAttention: readNumber(summary.needs_attention),
    },
    recentExams: records(data.recent_exams).map((row) => ({
      id: readNumber(row.id),
      paperName: readString(row.paper_name),
      examType: readString(row.exam_type),
      standardName: readString(row.standard_name),
      subjectName: readString(row.subject_name),
      totalMarks: readNumber(row.total_marks),
      totalQuestions: readNumber(row.total_ques),
      closeDate: readString(row.close_date),
      attempts: readNumber(row.attempts),
      averagePercent: readOptionalNumber(row.average_percent),
      highestPercent: readOptionalNumber(row.highest_percent),
      lowestPercent: readOptionalNumber(row.lowest_percent),
    })),
    scoreDistribution: records(data.score_distribution).map((row) => ({
      label: readString(row.label),
      attempts: readNumber(row.attempts),
    })),
    subjectPerformance: records(data.subject_performance).map((row) => ({
      subjectId: readNumber(row.subject_id),
      subjectName: readString(row.subject_name),
      attempts: readNumber(row.attempts),
      averagePercent: readOptionalNumber(row.average_percent),
    })),
    studentOptions: records(data.student_options).map((row) => ({
      id: readNumber(row.id),
      studentName: readString(row.student_name),
      rollNo: readNumber(row.roll_no),
      standardName: readString(row.standard_name),
      divisionName: readString(row.division_name),
    })),
    studentsToWatch: records(data.students_to_watch).map((row) => ({
      id: readNumber(row.id),
      studentId: readNumber(row.student_id),
      studentName: readString(row.student_name),
      paperName: readString(row.paper_name),
      obtainMarks: readNumber(row.obtain_marks),
      totalMarks: readNumber(row.total_marks),
      percent: readOptionalNumber(row.percent),
      attemptedOn: readString(row.attempted_on),
    })),
  };
}
