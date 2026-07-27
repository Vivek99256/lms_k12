import {
  buildSessionContext,
  createAuthHeaders,
  readNumber,
  readString,
  type SessionContext,
} from '@/lib/erp-client';

/**
 * Online-exam attempt/result data layer (LMS → Test → Exam).
 *
 *   GET  /lms/online_exam?type=API&questionpaper_id=          load a paper to attempt
 *   POST /lms/online_exam  (type=API)                          submit an attempt → JSON
 *   GET  /lms/online_exam/{paperId}?type=API&online_exam_id=   result (per-question review)
 *   GET  /lms/online_exam_attempt?type=API&...                 per-attempt DOK/Bloom breakdown
 *   GET  /api/question-paper                                   list online exams
 *
 * The `/lms/online_exam*` endpoints were made headless (request-with-session
 * fallback for sub_institute_id/user_id, and `store` returns JSON for type=API
 * instead of redirecting) — those backend edits must be deployed. `online_exam_attempt`
 * was already request-driven. The list uses the already-live REST endpoint.
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

export function isStudentProfile(): boolean {
  return userProfileName().trim().toLowerCase() === 'student';
}

function ajaxHeaders(session: SessionContext, contentType?: string): HeadersInit {
  return { ...createAuthHeaders(session, contentType), 'X-Requested-With': 'XMLHttpRequest' };
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}
function toArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}
async function readJson(res: Response, fallback: string): Promise<Record<string, unknown>> {
  const text = (await res.text()).trim();
  if (!text) return {};
  try {
    const parsed = JSON.parse(text) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : { data: parsed };
  } catch {
    throw new Error(`${fallback} (HTTP ${res.status}).`);
  }
}
function csvIds(value: unknown): string[] {
  return readString(value).split(',').map((x) => x.trim()).filter(Boolean);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OnlineExamOption {
  id: string;
  answer: string;
  correctFlag: string;
}
export interface OnlineExamQuestion {
  id: string;
  title: string;
  typeId: string;
  multipleAnswer: boolean;
  points: number;
  options: OnlineExamOption[];
}
export interface OnlineExamPaper {
  id: string;
  name: string;
  timeAllowedMinutes: number;
  totalMarks: number;
  totalQuestions: number;
  questions: OnlineExamQuestion[];
}

export interface OnlineExamListItem {
  id: string;
  name: string;
  standardId: string;
  subjectId: string;
  gradeId: string;
  examType: string;
  totalMarks: number;
  totalQuestions: number;
  openDate: string;
  closeDate: string;
  activeExam: boolean;
}

export interface SubmitResult {
  onlineExamId: string;
  totalRight: number;
  totalWrong: number;
  obtainMarks: number;
}

export interface ResultQuestion {
  id: string;
  title: string;
  points: number;
  rightWrong: string; // "right" | "wrong" | ""
  actualAnswerIds: string[];
  givenAnswerIds: string[];
  options: { id: string; answer: string; correct: boolean }[];
  mapping: { typeName: string; valueName: string }[];
}
export interface ExamResult {
  paperName: string;
  totalMarks: number;
  obtainMarks: number;
  totalRight: number;
  totalWrong: number;
  questions: ResultQuestion[];
}

export interface BreakdownRow {
  name: string;
  totalQuestions: number;
  rightAnswer: number;
  obtainedPercentage: number;
}
export interface BreakdownGroup {
  parentName: string;
  rows: BreakdownRow[];
}
export interface AttemptBreakdown {
  onlineExamId: string;
  startTime: string;
  totalRight: number;
  totalWrong: number;
  obtainMarks: number;
  groups: BreakdownGroup[];
}

// ---------------------------------------------------------------------------
// List online exams (already-live REST endpoint)
// ---------------------------------------------------------------------------

export async function listOnlineExams(
  filter: { standardId?: string; subjectId?: string } = {},
  signal?: AbortSignal
): Promise<OnlineExamListItem[]> {
  const session = requireSession();
  const url = new URL(`${session.baseUrl}/api/question-paper`);
  url.searchParams.set('type', 'API');
  url.searchParams.set('sub_institute_id', session.subInstituteId);
  url.searchParams.set('syear', session.syear);
  url.searchParams.set('user_profile_name', userProfileName());
  url.searchParams.set('user_id', session.userId);
  if (filter.standardId) url.searchParams.set('standard_id', filter.standardId);
  if (filter.subjectId) url.searchParams.set('subject_id', filter.subjectId);

  const res = await fetch(url.toString(), { headers: createAuthHeaders(session), signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}: Unable to load exams.`);
  const raw = await readJson(res, 'Failed to load exams');
  return toArray(raw.data)
    .map((entry) => {
      const r = toRecord(entry);
      return {
        id: readString(r.id),
        name: readString(r.paper_name) || `Paper #${readString(r.id)}`,
        standardId: readString(r.standard_id),
        subjectId: readString(r.subject_id),
        gradeId: readString(r.grade_id),
        examType: readString(r.exam_type),
        totalMarks: readNumber(r.total_marks),
        totalQuestions: readNumber(r.total_ques),
        openDate: readString(r.open_date),
        closeDate: readString(r.close_date),
        activeExam: Boolean(r.active_exam),
      };
    })
    .filter((e) => e.id)
    .filter((e) => {
      const t = e.examType.toLowerCase();
      return t === 'online' || t === '' || t === 'practice';
    });
}

// ---------------------------------------------------------------------------
// Load a paper to attempt
// ---------------------------------------------------------------------------

export async function fetchOnlineExam(paperId: string, signal?: AbortSignal): Promise<OnlineExamPaper> {
  const session = requireSession();
  const url = new URL(`${session.baseUrl}/lms/online_exam`);
  url.searchParams.set('type', 'API');
  url.searchParams.set('sub_institute_id', session.subInstituteId);
  url.searchParams.set('questionpaper_id', paperId);

  const res = await fetch(url.toString(), { headers: ajaxHeaders(session), signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}: Unable to load the exam.`);
  const raw = await readJson(res, 'Failed to load the exam');

  const paper = toRecord(raw.questionpaper_data);
  const answers = toRecord(raw.answer_arr);
  const questions: OnlineExamQuestion[] = toArray(raw.question_arr).map((entry) => {
    const q = toRecord(entry);
    const id = readString(q.id);
    return {
      id,
      title: readString(q.question_title ?? q.description),
      typeId: readString(q.question_type_id),
      multipleAnswer: readString(q.multiple_answer) === '1',
      points: readNumber(q.points) || 1,
      options: toArray(answers[id]).map((opt) => {
        const o = toRecord(opt);
        return { id: readString(o.id), answer: readString(o.answer), correctFlag: readString(o.correct_answer) };
      }),
    };
  });

  return {
    id: readString(paper.id) || paperId,
    name: readString(paper.paper_name) || 'Online Exam',
    timeAllowedMinutes: readNumber(paper.time_allowed) || 30,
    totalMarks: readNumber(paper.total_marks) || questions.reduce((s, q) => s + q.points, 0),
    totalQuestions: readNumber(paper.total_ques) || questions.length,
    questions,
  };
}

// ---------------------------------------------------------------------------
// Submit
// ---------------------------------------------------------------------------

/** Format a Date as Laravel "YYYY-MM-DD HH:mm:ss". */
export function formatExamTimestamp(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  );
}

export interface SubmitInput {
  paperId: string;
  /** The learner id to record against (usually the signed-in student). */
  studentId?: string;
  /** questionId -> selected option values "ansId##correctFlag" (MCQ). */
  mcqAnswers: Record<string, string[]>;
  /** questionId -> free text (narrative). */
  narrativeAnswers: Record<string, string>;
  startedAt: string;
}

export async function submitOnlineExam(input: SubmitInput): Promise<SubmitResult> {
  const session = requireSession();
  const form = new URLSearchParams();
  form.set('type', 'API');
  form.set('sub_institute_id', session.subInstituteId);
  form.set('user_id', input.studentId || session.userId);
  form.set('questionpaper_id', input.paperId);
  form.set('hid_session_quiz', input.startedAt);
  Object.entries(input.mcqAnswers).forEach(([qid, values]) => {
    values.forEach((v) => form.append(`answer_multiple[${qid}][]`, v));
  });
  Object.entries(input.narrativeAnswers).forEach(([qid, text]) => {
    if (text.trim()) form.set(`answer_narrative[${qid}]`, text);
  });

  // dev.triz.co.in / erp are CSRF-exempt, and the fixed store returns JSON for
  // type=API, so a direct POST works (no BFF proxy needed).
  const res = await fetch(`${session.baseUrl}/lms/online_exam`, {
    method: 'POST',
    headers: ajaxHeaders(session, 'application/x-www-form-urlencoded'),
    body: form.toString(),
  });
  const raw = await readJson(res, 'Failed to submit the exam');
  const status = String(raw.status_code ?? raw.status ?? '');
  const onlineExamId = readString(raw.online_exam_id);
  if (!res.ok || (status !== '1' && status.toUpperCase() !== 'SUCCESS') || !onlineExamId) {
    throw new Error(
      (raw.message as string) ||
        'Unable to submit — the online-exam backend update may not be deployed yet.'
    );
  }
  return {
    onlineExamId,
    totalRight: readNumber(raw.total_right),
    totalWrong: readNumber(raw.total_wrong),
    obtainMarks: readNumber(raw.obtain_marks),
  };
}

// ---------------------------------------------------------------------------
// Result (per-question review)
// ---------------------------------------------------------------------------

export async function fetchExamResult(
  paperId: string,
  onlineExamId: string,
  studentId?: string,
  signal?: AbortSignal
): Promise<ExamResult> {
  const session = requireSession();
  const url = new URL(`${session.baseUrl}/lms/online_exam/${encodeURIComponent(paperId)}`);
  url.searchParams.set('type', 'API');
  url.searchParams.set('sub_institute_id', session.subInstituteId);
  url.searchParams.set('user_id', studentId || session.userId);
  url.searchParams.set('online_exam_id', onlineExamId);

  const res = await fetch(url.toString(), { headers: ajaxHeaders(session), signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}: Unable to load the result.`);
  const raw = await readJson(res, 'Failed to load the result');

  const paper = toRecord(raw.questionpaper_data);
  const oe = toRecord(raw.online_exam_data);
  const answers = toRecord(raw.answer_arr);
  const online = toRecord(raw.online_answer_data);
  const mappingArr = toRecord(raw.mapping_arr);

  const questions: ResultQuestion[] = toArray(raw.question_arr).map((entry) => {
    const q = toRecord(entry);
    const id = readString(q.id);
    const oa = toRecord(online[id]);
    return {
      id,
      title: readString(q.question_title ?? q.description),
      points: readNumber(q.points) || 1,
      rightWrong: readString(oa.RIGHT_WRONG),
      actualAnswerIds: csvIds(oa.ACTUAL_ANSWER),
      givenAnswerIds: csvIds(oa.GIVEN_ANSWER),
      options: toArray(answers[id]).map((opt) => {
        const o = toRecord(opt);
        return { id: readString(o.id), answer: readString(o.answer), correct: readString(o.correct_answer) === '1' };
      }),
      mapping: Object.entries(toRecord(mappingArr[id])).map(([typeName, valueName]) => ({
        typeName,
        valueName: readString(valueName),
      })),
    };
  });

  const totalRight = readNumber(oe.total_right);
  return {
    paperName: readString(paper.paper_name) || 'Online Exam',
    totalMarks: readNumber(paper.total_marks) || questions.reduce((s, q) => s + q.points, 0),
    obtainMarks: readNumber(oe.obtain_marks),
    totalRight,
    totalWrong: readNumber(oe.total_wrong),
    questions,
  };
}

// ---------------------------------------------------------------------------
// Per-attempt DOK/Bloom breakdown
// ---------------------------------------------------------------------------

export async function fetchAttemptBreakdown(
  paperId: string,
  studentId: string,
  signal?: AbortSignal
): Promise<AttemptBreakdown[]> {
  const session = requireSession();
  const url = new URL(`${session.baseUrl}/lms/online_exam_attempt`);
  url.searchParams.set('type', 'API');
  url.searchParams.set('questionpaper_id', paperId);
  url.searchParams.set('student_id', studentId);

  const res = await fetch(url.toString(), { headers: ajaxHeaders(session), signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}: Unable to load the breakdown.`);
  const raw = await readJson(res, 'Failed to load the breakdown');

  const attempted = toArray(raw.attempted_data).map(toRecord);
  const finalData = toRecord(raw.final_progressbar_data);

  return attempted.map((attempt) => {
    const oeId = readString(attempt.id);
    const groupsRaw = toRecord(finalData[oeId]);
    const groups: BreakdownGroup[] = Object.entries(groupsRaw).map(([parentName, rows]) => ({
      parentName,
      rows: toArray(rows).map((row) => {
        const r = toRecord(row);
        return {
          name: readString(r.name),
          totalQuestions: readNumber(r.total_question),
          rightAnswer: readNumber(r.right_answer),
          obtainedPercentage: readNumber(r.obtained_percentage),
        };
      }),
    }));
    return {
      onlineExamId: oeId,
      startTime: readString(attempt.start_time),
      totalRight: readNumber(attempt.total_right),
      totalWrong: readNumber(attempt.total_wrong),
      obtainMarks: readNumber(attempt.obtain_marks),
      groups,
    };
  });
}
