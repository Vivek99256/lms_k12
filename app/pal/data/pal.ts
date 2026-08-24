import {
  appendCommonParams,
  buildSessionContext,
  createAuthHeaders,
  normalizeApiStatus,
  readNumber,
  readString,
  type ApiEnvelope,
} from '@/lib/erp-client';

/**
 * PAL (Personalized Adaptive Learning) data layer.
 *
 * Mirrors the Laravel ERP `/lms/*` web routes the PAL Blade views call. All GET
 * endpoints return JSON when `type=API` is sent (via the `is_mobile()` helper,
 * which also normalizes `status_code` -> `status`). Student, tenant and year
 * come from the signed-in session context (localStorage), exactly like the
 * Blade views read them from the server session.
 *
 *   GET  /lms/palreport                     palController@palreport   (report)
 *   GET  /lms/pal                           palController@index       (landing)
 *   GET  /lms/pedagogy-suggested-content    palController@getPedagogySuggestedContent
 *   GET  /lms/misconception                 palController@misconception
 *   POST /lms/misconception/generate-content palController@generateMisconceptionContent
 *   POST /lms/increment-content-visit       palController@incrementContentVisit
 */

// ===========================================================================
// PAL Report (REPORT menu)
// ===========================================================================

/** Raw row shape returned by Laravel (snake_case). */
export interface PalReportApiRow {
  first_name?: string | null;
  middle_name?: string | null;
  last_name?: string | null;
  standard?: string | null;
  division?: string | null;
  /** Pre-formatted "dd-mm-yyyy hh:ii:ss" from Laravel. */
  start_time?: string | null;
  /** "obtain_marks/(total_right+total_wrong)". */
  grade?: string | null;
}

/** Normalized row consumed by the report table. */
export interface PalReportRow {
  studentName: string;
  standard: string;
  division: string;
  stdDiv: string;
  startTime: string;
  grade: string;
}

export interface PalReportResult {
  rows: PalReportRow[];
  /** "1" = success, "0" = no data (mirrors Laravel `$res['status']`). */
  status: string;
  message: string;
}

type PalReportEnvelope = ApiEnvelope & { data?: PalReportApiRow[] | unknown };

function mapPalReportRow(raw: PalReportApiRow): PalReportRow {
  const studentName = [raw.first_name, raw.middle_name, raw.last_name]
    .map((part) => readString(part).trim())
    .filter(Boolean)
    .join(' ');
  const standard = readString(raw.standard).trim();
  const division = readString(raw.division).trim();

  return {
    studentName,
    standard,
    division,
    stdDiv: [standard, division].filter(Boolean).join('/'),
    startTime: readString(raw.start_time).trim(),
    grade: readString(raw.grade).trim(),
  };
}

/**
 * Parse Laravel's "dd-mm-yyyy hh:ii:ss" timestamp into an epoch value for
 * chronological sorting. Returns 0 when the string is missing/unparseable so
 * such rows sort to the bottom without throwing.
 */
export function parsePalStartTime(value: string): number {
  const match = value.match(/^(\d{2})-(\d{2})-(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/);
  if (!match) return 0;
  const [, dd, mm, yyyy, hh, min, ss] = match;
  const timestamp = Date.parse(`${yyyy}-${mm}-${dd}T${hh}:${min}:${ss}`);
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

/**
 * Fetch the PAL report from Laravel. Tenant + academic year are taken from the
 * signed-in session context, as the Blade view reads them from the server
 * session.
 */
export async function fetchPalReport(signal?: AbortSignal): Promise<PalReportResult> {
  const session = requireSession();

  const params = new URLSearchParams();
  appendCommonParams(params, session); // type=API, sub_institute_id, syear

  const response = await fetch(
    `${session.baseUrl}/lms/palreport?${params.toString()}`,
    { headers: createAuthHeaders(session), signal }
  );

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: Unable to load the PAL report.`);
  }

  const payload = (await response.json()) as PalReportEnvelope;
  const rawRows = Array.isArray(payload.data)
    ? (payload.data as PalReportApiRow[])
    : [];

  return {
    rows: rawRows.map(mapPalReportRow),
    status: normalizeApiStatus(payload),
    message: readString(payload.message),
  };
}

// ===========================================================================
// PAL Entry (ENTRY menu — landing / pedagogy engine / misconceptions)
// ===========================================================================

export interface PalStudentDetails {
  /** The learner/user id whose PAL this landing represents (self, or picked). */
  studentId: string;
  name: string;
  gradeId: string;
  standardId: string;
  enrollmentNo: string;
}

/**
 * A student an admin/teacher has selected to view. When present it overrides the
 * signed-in user for the PAL landing and the per-chapter engine calls.
 */
export interface PalStudentSelection {
  studentId: string;
  name: string;
  gradeId: string;
  standardId: string;
  divisionId?: string;
  enrollmentNo?: string;
  /** True for the "guest student" class preview (no specific learner). */
  guest?: boolean;
}

export interface PalChapter {
  id: string;
  name: string;
  /** Number of PAL quizzes the student has attempted for this chapter. */
  quizCount: number;
}

export interface PalAttempt {
  chapterId: string;
  totalRight: number;
  total: number;
  /** Percentage of correct answers (0-100), clamped. */
  percent: number;
}

export interface PalSubject {
  id: string;
  name: string;
  chapters: PalChapter[];
}

export interface PalLandingData {
  student: PalStudentDetails;
  subjects: PalSubject[];
  /** Attempts grouped by chapter id, newest first as returned by Laravel. */
  attemptsByChapter: Record<string, PalAttempt[]>;
  message: string;
}

export interface PalContentMapping {
  typeName: string;
  valueName: string;
}

export type PalContentCategory =
  | 'remediation'
  | 'practice'
  | 'enrichment'
  | 'misconception';

export interface PedagogyContentItem {
  id: string;
  title: string;
  description: string;
  contentUrl: string;
  fileType: string;
  studentLevel: string;
  pedagogyType: string;
  learningTips: string[];
  mapping: PalContentMapping[];
  category: PalContentCategory;
}

export interface PedagogyRecommendation {
  type: string;
  label: string;
  reason: string;
  tip: string;
  cognitiveLoad: string;
}

export interface PalStudentProfile {
  learningStyle: string;
  learningPace: string;
  preferredContentTypes: string[];
}

export interface PalMasterySummary {
  totalConcepts: number;
  mastered: number;
  developing: number;
  needsPractice: number;
  dueForReview: number;
}

export interface PalTeacherInsight {
  title: string;
  description: string;
  priority: string;
}

export interface PedagogyResult {
  status: string;
  studentLevel: string;
  studentProfile: PalStudentProfile;
  masterySummary: PalMasterySummary;
  recommendations: PedagogyRecommendation[];
  teacherInsights: PalTeacherInsight[];
  content: PedagogyContentItem[];
}

export interface MisconceptionQuestion {
  questionId: string;
  question: string;
  wrongCount: number;
  contentGenerated: boolean;
  mapping: PalContentMapping[];
}

export interface GenerateMisconceptionResult {
  status: string;
  message: string;
  generated: number;
  skipped: number;
}

export interface PalChapterContext {
  gradeId: string;
  subjectId: string;
  chapterId: string;
  standardId: string;
  enrollmentNo?: string;
}

type SessionContext = ReturnType<typeof buildSessionContext>;

// --- small helpers ---------------------------------------------------------

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function toArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function readMapping(value: unknown): PalContentMapping[] {
  return toArray(value).map((entry) => {
    const record = toRecord(entry);
    return {
      typeName: readString(record.type_name ?? record.mapping_type),
      valueName: readString(record.value_name ?? record.mapping_value),
    };
  });
}

function requireSession(): SessionContext {
  const session = buildSessionContext();
  if (!session.baseUrl) {
    throw new Error('Session data is missing. Please sign in again.');
  }
  return session;
}

/** Session params required by the session-scoped `/lms/*` endpoints. */
function commonEntryParams(session: SessionContext): URLSearchParams {
  const params = new URLSearchParams();
  appendCommonParams(params, session); // type=API, sub_institute_id, syear
  if (session.userId) params.set('user_id', session.userId);
  return params;
}

function ajaxHeaders(session: SessionContext, contentType?: string): HeadersInit {
  return {
    ...createAuthHeaders(session, contentType),
    'X-Requested-With': 'XMLHttpRequest',
  };
}

// --- landing ---------------------------------------------------------------

/** Build the query string used to launch the adaptive quiz for a chapter. */
export function buildQuizStartQuery(context: PalChapterContext): string {
  const params = new URLSearchParams({
    grade_id: context.gradeId,
    subject_id: context.subjectId,
    chapter_id: context.chapterId,
    standard_id: context.standardId,
  });
  if (context.enrollmentNo) params.set('enrollment_no', context.enrollmentNo);
  return params.toString();
}

/** Map the shared PAL Workspace/Preview `{success,data}` payload to landing data. */
function mapWorkspacePayload(
  payload: Record<string, unknown>,
  fallback: { studentId: string; name?: string }
): PalLandingData {
  const data = toRecord(payload.data);
  const studentRow = toRecord(data.student);
  const perChapterQuiz = toRecord(data.per_chapter_quiz);

  const attemptsByChapter: Record<string, PalAttempt[]> = {};
  Object.entries(toRecord(data.attempts_by_chapter)).forEach(([chapterId, entries]) => {
    toArray(entries).forEach((entry) => {
      const record = toRecord(entry);
      const totalRight = readNumber(record.total_right);
      const total = readNumber(record.total) || totalRight + readNumber(record.total_wrong);
      const percent =
        readNumber(record.percent) ||
        (total > 0 ? Math.min(100, Math.round((totalRight / total) * 100)) : 0);
      (attemptsByChapter[chapterId] ??= []).push({ chapterId, totalRight, total, percent });
    });
  });

  const subjects: PalSubject[] = toArray(data.subjects).map((entry) => {
    const subject = toRecord(entry);
    return {
      id: readString(subject.subject_id),
      name: readString(subject.subject_name),
      chapters: toArray(subject.chapters).map((chapterEntry) => {
        const chapter = toRecord(chapterEntry);
        const id = readString(chapter.id);
        return { id, name: readString(chapter.chapter_name), quizCount: readNumber(perChapterQuiz[id]) };
      }),
    };
  });

  return {
    student: {
      studentId: readString(studentRow.student_id) || fallback.studentId,
      name: fallback.name || readString(studentRow.name),
      gradeId: readString(studentRow.grade_id),
      standardId: readString(studentRow.standard_id),
      enrollmentNo: readString(studentRow.enrollment_no),
    },
    subjects,
    attemptsByChapter,
    message: readString(payload.message),
  };
}

export async function fetchPalLanding(
  opts: { student?: PalStudentSelection; signal?: AbortSignal } = {}
): Promise<PalLandingData> {
  const { student, signal } = opts;
  const session = requireSession();
  // The learner: an explicit picker selection, otherwise the signed-in student.
  const learnerId = student?.studentId || session.userId;

  const url = new URL(`${session.baseUrl}/api/pal/workspace/${encodeURIComponent(learnerId)}`);
  url.searchParams.set('syear', session.syear);

  const response = await fetch(url.toString(), { headers: createAuthHeaders(session), signal });
  // Backend not deployed yet → fall back to the legacy /lms/pal + catalog path.
  if (response.status === 404) {
    const { legacyPalLanding } = await import('@/app/pal/data/pal-legacy');
    return legacyPalLanding(student, signal);
  }
  if (response.status === 401 || response.status === 403) {
    const denied = toRecord(await response.json().catch(() => ({})));
    throw new Error(readString(denied.message) || 'You are not allowed to view this learner.');
  }
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: Unable to load PAL subjects.`);
  }

  const payload = toRecord(await response.json());
  return mapWorkspacePayload(payload, { studentId: learnerId, name: student?.name });
}

/**
 * "Guest student" class preview: the student-facing PAL for a whole standard
 * (subjects + chapters, no learner/attempts). Powers the "View as student"
 * audience mode where staff experience what a class's students see.
 */
export async function fetchPalPreview(
  opts: { standardId: string; gradeId?: string; divisionId?: string; signal?: AbortSignal }
): Promise<PalLandingData> {
  const session = requireSession();
  const url = new URL(`${session.baseUrl}/api/pal/workspace/preview`);
  url.searchParams.set('syear', session.syear);
  url.searchParams.set('standard_id', opts.standardId);
  if (opts.gradeId) url.searchParams.set('grade_id', opts.gradeId);
  if (opts.divisionId) url.searchParams.set('division_id', opts.divisionId);

  const response = await fetch(url.toString(), { headers: createAuthHeaders(session), signal: opts.signal });
  // Backend not deployed yet → build the class preview from the LMS catalog.
  if (response.status === 404) {
    const { legacyPalPreview } = await import('@/app/pal/data/pal-legacy');
    return legacyPalPreview(opts);
  }
  if (response.status === 401 || response.status === 403) {
    const denied = toRecord(await response.json().catch(() => ({})));
    throw new Error(readString(denied.message) || 'You are not allowed to preview this class.');
  }
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: Unable to load the class preview.`);
  }

  const payload = toRecord(await response.json());
  return mapWorkspacePayload(payload, { studentId: '', name: 'Guest student' });
}

// --- pedagogy engine suggested content -------------------------------------

function mapPedagogyContent(
  bucket: unknown,
  category: PalContentCategory
): PedagogyContentItem[] {
  return toArray(bucket).map((entry) => {
    const record = toRecord(entry);
    const pedagogy = toRecord(record.recommended_pedagogy);
    return {
      id: readString(record.id ?? record.content_id),
      title: readString(record.content_title ?? record.title),
      description: readString(record.description),
      contentUrl: readString(
        record.content_link ?? record.content_url ?? record.url ?? record.filename
      ),
      fileType: readString(record.file_type),
      studentLevel: readString(record.student_level),
      pedagogyType: readString(record.pedagogy_type ?? pedagogy.label),
      learningTips: toArray(record.learning_tips)
        .map((tip) => readString(tip))
        .filter(Boolean),
      mapping: readMapping(record.mapping),
      category,
    };
  });
}

export async function fetchPedagogySuggestedContent(
  context: PalChapterContext,
  signal?: AbortSignal,
  learnerUserId?: string
): Promise<PedagogyResult> {
  const session = requireSession();
  const params = commonEntryParams(session);
  // Admin/teacher viewing a specific student: the pedagogy engine keys on
  // user_id (request param), so override it with the viewed learner.
  if (learnerUserId) params.set('user_id', learnerUserId);
  params.set('grade_id', context.gradeId);
  params.set('subject_id', context.subjectId);
  params.set('chapter_id', context.chapterId);
  params.set('standard_id', context.standardId);
  params.set('device_type', 'desktop');

  const response = await fetch(
    `${session.baseUrl}/lms/pedagogy-suggested-content?${params.toString()}`,
    { headers: ajaxHeaders(session), signal }
  );
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: Unable to load suggested content.`);
  }

  const payload = toRecord(await response.json());
  const contentData = toRecord(payload.content_data);
  const profile = toRecord(payload.student_profile);
  const summary = toRecord(payload.mastery_summary);

  return {
    status: normalizeApiStatus(payload),
    studentLevel: readString(payload.student_level),
    studentProfile: {
      learningStyle: readString(profile.learning_style),
      learningPace: readString(profile.learning_pace),
      preferredContentTypes: toArray(profile.preferred_content_types)
        .map((item) => readString(item))
        .filter(Boolean),
    },
    masterySummary: {
      totalConcepts: readNumber(summary.total_concepts),
      mastered: readNumber(summary.mastered),
      developing: readNumber(summary.developing),
      needsPractice: readNumber(summary.needs_practice),
      dueForReview: readNumber(summary.due_for_review),
    },
    recommendations: toArray(payload.pedagogy).map((entry) => {
      const record = toRecord(entry);
      return {
        type: readString(record.type),
        label: readString(record.label),
        reason: readString(record.reason),
        tip: readString(record.tip),
        cognitiveLoad: readString(record.cognitive_load_display),
      };
    }),
    teacherInsights: toArray(payload.teacher_insights).map((entry) => {
      const record = toRecord(entry);
      return {
        title: readString(record.title),
        description: readString(record.description),
        priority: readString(record.priority),
      };
    }),
    content: [
      ...mapPedagogyContent(contentData.remediation_content, 'remediation'),
      ...mapPedagogyContent(contentData.practice_content, 'practice'),
      ...mapPedagogyContent(contentData.enrichment_content, 'enrichment'),
      ...mapPedagogyContent(contentData.misconception_content, 'misconception'),
    ],
  };
}

// --- misconceptions --------------------------------------------------------

export async function fetchMisconceptions(
  chapterId: string,
  signal?: AbortSignal,
  learnerUserId?: string
): Promise<MisconceptionQuestion[]> {
  const session = requireSession();
  const params = commonEntryParams(session);
  // NOTE: on the live backend `misconception()` reads the learner from the
  // Laravel session; user_id here only takes effect where the request-param
  // fallback has been deployed. Harmless otherwise.
  if (learnerUserId) params.set('user_id', learnerUserId);
  params.set('chapter_id', chapterId);

  const response = await fetch(
    `${session.baseUrl}/lms/misconception?${params.toString()}`,
    { headers: ajaxHeaders(session), signal }
  );
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: Unable to load misconceptions.`);
  }

  const payload = toRecord(await response.json());
  const questions = toArray(payload.data).map((entry) => {
    const record = toRecord(entry);
    return {
      questionId: readString(record.question_id),
      question: readString(record.question),
      wrongCount: readNumber(record.wrong_count),
      contentGenerated: Boolean(record.content_generated),
      mapping: readMapping(record.mapping),
    };
  });

  // Record badge event for misconception view (fire-and-forget).
  try {
    const badgeEventUrl = new URL('/api/pal/gamification/badge-events', window.location.origin);
    badgeEventUrl.searchParams.set('user_id', session.userId);
    badgeEventUrl.searchParams.set('sub_institute_id', session.subInstituteId);
    badgeEventUrl.searchParams.set('syear', session.syear);
    await fetch(badgeEventUrl.toString(), {
      method: 'POST',
      headers: {
        ...createAuthHeaders(session),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        eventType: 'misconception_view',
        sourceId: chapterId,
        context: { learnerUserId: learnerUserId || session.userId, questionCount: questions.length },
      }),
    });
  } catch {
    /* ignore badge event failures */
  }

  return questions;
}

export async function generateMisconceptionContent(
  chapterId: string,
  learnerUserId?: string
): Promise<GenerateMisconceptionResult> {
  const session = requireSession();
  const body = commonEntryParams(session);
  if (learnerUserId) body.set('user_id', learnerUserId);
  body.set('chapter_id', chapterId);

  const response = await fetch(
    `${session.baseUrl}/lms/misconception/generate-content`,
    {
      method: 'POST',
      headers: ajaxHeaders(session, 'application/x-www-form-urlencoded'),
      body: body.toString(),
    }
  );
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: Unable to generate misconception content.`);
  }

  const payload = toRecord(await response.json());
  return {
    status: normalizeApiStatus(payload),
    message: readString(payload.message),
    generated: readNumber(payload.generated),
    skipped: readNumber(payload.skipped),
  };
}

// --- content-visit tracking ------------------------------------------------

export async function incrementContentVisit(input: {
  contentId: string;
  standardId: string;
  subjectId: string;
  chapterId: string;
  contentType?: string;
  learnerUserId?: string;
}): Promise<void> {
  const session = buildSessionContext();
  if (!session.baseUrl || !input.contentId) return;

  const body = commonEntryParams(session);
  if (input.learnerUserId) body.set('user_id', input.learnerUserId);
  body.set('content_id', input.contentId);
  body.set('standard_id', input.standardId);
  body.set('subject_id', input.subjectId);
  body.set('chapter_id', input.chapterId);
  body.set('content_type', input.contentType ?? 'pal_content');

  // Fire-and-forget: a failed visit counter must not disrupt the learner.
  try {
    await fetch(`${session.baseUrl}/lms/increment-content-visit`, {
      method: 'POST',
      headers: ajaxHeaders(session, 'application/x-www-form-urlencoded'),
      body: body.toString(),
    });
  } catch {
    /* ignore tracking failures */
  }

  // Record badge event for content visit (fire-and-forget).
  try {
    const badgeEventUrl = new URL('/api/pal/gamification/badge-events', window.location.origin);
    badgeEventUrl.searchParams.set('user_id', session.userId);
    badgeEventUrl.searchParams.set('sub_institute_id', session.subInstituteId);
    badgeEventUrl.searchParams.set('syear', session.syear);
    await fetch(badgeEventUrl.toString(), {
      method: 'POST',
      headers: {
        ...createAuthHeaders(session),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        eventType: 'content_visit',
        sourceId: input.contentId,
        context: { contentType: input.contentType, standardId: input.standardId, subjectId: input.subjectId, chapterId: input.chapterId },
      }),
    });
  } catch {
    /* ignore badge event failures */
  }
}

// ===========================================================================
// PAL Quiz (create -> take -> submit -> result)
//
//   GET  /lms/pal/create   palController@create  (adaptive question selection)
//   POST /lms/pal          palController@store   (submit; via BFF proxy)
//   GET  /lms/pal/{id}      palController@show    (result)
// ===========================================================================

export interface PalAnswerOption {
  id: string;
  answer: string;
  /** "1" for a correct option, "0" otherwise (mirrors answer_master). */
  correctFlag: string;
}

export interface PalQuestion {
  questionId: string;
  questionText: string;
  options: PalAnswerOption[];
}

export interface PalQuizData {
  paperName: string;
  totalMarks: number;
  timeAllowedMinutes: number;
  questions: PalQuestion[];
  context: PalChapterContext;
  status: string;
  message: string;
}

/** Format a Date as Laravel's "YYYY-MM-DD HH:mm:ss" (used for start_time). */
export function formatQuizTimestamp(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  );
}

export async function fetchPalQuiz(
  context: PalChapterContext,
  signal?: AbortSignal
): Promise<PalQuizData> {
  const session = requireSession();
  const params = commonEntryParams(session);
  params.set('grade_id', context.gradeId);
  params.set('standard_id', context.standardId);
  params.set('subject_id', context.subjectId);
  params.set('chapter_id', context.chapterId);
  if (context.enrollmentNo) params.set('enrollment_no', context.enrollmentNo);

  const response = await fetch(`${session.baseUrl}/lms/pal/create?${params.toString()}`, {
    headers: ajaxHeaders(session),
    signal,
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: Unable to start the quiz.`);
  }

  const payload = toRecord(await response.json());
  const answerArr = toRecord(payload.answer_arr);
  const qp = toRecord(payload.questionpaper_data);

  const questions: PalQuestion[] = toArray(payload.question_arr).map((entry) => {
    const record = toRecord(entry);
    const questionId = readString(record.question_id);
    const options = toArray(answerArr[questionId]).map((opt) => {
      const option = toRecord(opt);
      return {
        id: readString(option.id),
        answer: readString(option.answer),
        correctFlag: readString(option.correct_answer),
      };
    });
    return {
      questionId,
      questionText: readString(record.question_text),
      options,
    };
  });

  return {
    paperName: readString(qp.paper_name) || 'PAL Test',
    totalMarks: readNumber(qp.total_marks) || questions.length,
    timeAllowedMinutes: readNumber(qp.time_allowed) || 20,
    questions,
    context,
    status: normalizeApiStatus(payload),
    message: readString(payload.message),
  };
}

export interface PalQuizSubmitInput {
  context: PalChapterContext;
  paperName: string;
  totalMarks: number;
  timeAllowedMinutes: number;
  /** questionId -> selected "answerId##correctFlag". */
  answers: Record<string, string>;
  /** questionId -> seconds spent (capped upstream at 60). */
  attemptTimes: Record<string, number>;
  questionIds: string[];
  /** Laravel "YYYY-MM-DD HH:mm:ss" quiz start time. */
  startedAt: string;
}

export interface PalQuizSubmitResult {
  status: string;
  message: string;
  questionPaperId: string;
  onlineExamId: string;
}

/**
 * Submit a PAL quiz. Routed through the Next BFF proxy (`/api/pal/submit`)
 * because Laravel `store()` responds with a cross-origin redirect a browser
 * cannot follow. The proxy translates the redirect into `{questionPaperId,
 * onlineExamId}`.
 */
export async function submitPalQuiz(
  input: PalQuizSubmitInput
): Promise<PalQuizSubmitResult> {
  const session = requireSession();

  const form = new URLSearchParams();
  form.set('type', 'API');
  if (session.subInstituteId) form.set('sub_institute_id', session.subInstituteId);
  if (session.syear) form.set('syear', session.syear);
  if (session.userId) form.set('user_id', session.userId);
  form.set('grade_id', input.context.gradeId);
  form.set('standard_id', input.context.standardId);
  form.set('subject_id', input.context.subjectId);
  form.set('chapter_id', input.context.chapterId);
  form.set('paper_name', input.paperName);
  form.set('total_marks', String(input.totalMarks));
  form.set('total_question', String(input.questionIds.length));
  form.set('questionpaper_time', String(input.timeAllowedMinutes));
  form.set('hid_session_quiz', input.startedAt);
  input.questionIds.forEach((questionId) => form.append('question_ids[]', questionId));
  Object.entries(input.answers).forEach(([questionId, value]) => {
    if (value) form.append(`answer_multiple[${questionId}][]`, value);
  });
  Object.entries(input.attemptTimes).forEach(([questionId, seconds]) => {
    form.set(`attempt_time[${questionId}]`, String(Math.min(60, Math.max(0, Math.round(seconds)))));
  });

  const response = await fetch('/api/pal/submit', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
      'x-laravel-base-url': session.baseUrl,
      ...(session.token ? { Authorization: `Bearer ${session.token}` } : {}),
    },
    body: form.toString(),
  });

  const payload = toRecord(await response.json());
  const status = normalizeApiStatus(payload) || (response.ok ? '1' : '0');
  const message = readString(payload.message);
  if (!response.ok || status === '0') {
    throw new Error(message || `HTTP ${response.status}: Unable to submit the quiz.`);
  }

  return {
    status,
    message,
    questionPaperId: readString(payload.questionPaperId),
    onlineExamId: readString(payload.onlineExamId),
  };
}

// --- result ----------------------------------------------------------------

export interface PalResultOption {
  id: string;
  answer: string;
  correct: boolean;
}

export interface PalResultMapping {
  typeName: string;
  values: string[];
}

export interface PalResultQuestion {
  questionId: string;
  title: string;
  points: number;
  /** "right" | "wrong" | "" (unattempted). */
  rightWrong: string;
  conceptName: string;
  options: PalResultOption[];
  givenAnswerIds: string[];
  correctAnswerIds: string[];
  mapping: PalResultMapping[];
}

export interface PalResultData {
  paperName: string;
  totalMarks: number;
  totalQuestions: number;
  obtainMarks: number;
  totalRight: number;
  totalWrong: number;
  studentLevel: string;
  studentId: string;
  showAnswers: boolean;
  questions: PalResultQuestion[];
  context: PalChapterContext;
  status: string;
  message: string;
}

function csvToIds(value: unknown): string[] {
  return readString(value)
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

export async function fetchPalResult(
  questionPaperId: string,
  onlineExamId: string,
  signal?: AbortSignal
): Promise<PalResultData> {
  const session = requireSession();
  const params = commonEntryParams(session);
  params.set('online_exam_id', onlineExamId);

  const response = await fetch(
    `${session.baseUrl}/lms/pal/${encodeURIComponent(questionPaperId)}?${params.toString()}`,
    { headers: ajaxHeaders(session), signal }
  );
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: Unable to load the quiz result.`);
  }

  const payload = toRecord(await response.json());
  const qp = toRecord(payload.questionpaper_data);
  const oe = toRecord(payload.online_exam_data);
  const answerArr = toRecord(payload.answer_arr);
  const onlineAnswer = toRecord(payload.online_answer_data);
  const mappingArr = toRecord(payload.mapping_arr);

  const questions: PalResultQuestion[] = toArray(payload.question_arr).map((entry) => {
    const record = toRecord(entry);
    const questionId = readString(record.id ?? record.question_id);
    const oa = toRecord(onlineAnswer[questionId]);
    const options = toArray(answerArr[questionId]).map((opt) => {
      const option = toRecord(opt);
      return {
        id: readString(option.id),
        answer: readString(option.answer),
        correct: readString(option.correct_answer) === '1',
      };
    });
    const mapping = Object.entries(toRecord(mappingArr[questionId])).map(([typeName, values]) => ({
      typeName,
      values: toArray(values).map((value) => readString(value)).filter(Boolean),
    }));
    return {
      questionId,
      title: readString(record.question_title ?? record.question_text),
      points: readNumber(record.points) || 1,
      rightWrong: readString(oa.RIGHT_WRONG),
      conceptName: readString(record.concept_name),
      options,
      givenAnswerIds: csvToIds(oa.GIVEN_ANSWER),
      correctAnswerIds: csvToIds(oa.ACTUAL_ANSWER),
      mapping,
    };
  });

  return {
    paperName: readString(qp.paper_name),
    totalMarks: readNumber(qp.total_marks),
    totalQuestions: readNumber(qp.total_ques) || questions.length,
    obtainMarks: readNumber(oe.obtain_marks),
    totalRight: readNumber(oe.total_right),
    totalWrong: readNumber(oe.total_wrong),
    studentLevel: readString(oe.student_level),
    studentId: readString(oe.student_id) || session.userId,
    showAnswers: readString(qp.result_show_ans) === '1',
    questions,
    context: {
      gradeId: readString(qp.grade_id),
      subjectId: readString(qp.subject_id),
      chapterId: readString(qp.paper_desc),
      standardId: readString(qp.standard_id),
      enrollmentNo: readString(oe.enrollment_no),
    },
    status: normalizeApiStatus(payload),
    message: readString(payload.message),
  };
}

export type PalConceptStatus = 'mastered' | 'developing' | 'needs_practice' | 'not_started';

export interface PalConceptMastery {
  conceptName: string;
  attempted: number;
  correct: number;
  wrong: number;
  total: number;
  accuracy: number;
  masteryLevel: number;
  status: PalConceptStatus;
}

/**
 * Compute a concept mastery matrix from the result payload, client-side, using
 * the same formula as the Blade result view (accuracy + correct*2, capped 100).
 */
export function computeConceptMastery(questions: PalResultQuestion[]): PalConceptMastery[] {
  const groups = new Map<string, { attempted: number; correct: number; wrong: number; total: number }>();

  questions.forEach((question) => {
    const key = question.conceptName || 'General Concept';
    const group = groups.get(key) ?? { attempted: 0, correct: 0, wrong: 0, total: 0 };
    group.total += 1;
    if (question.rightWrong === 'right') {
      group.attempted += 1;
      group.correct += 1;
    } else if (question.rightWrong === 'wrong') {
      group.attempted += 1;
      group.wrong += 1;
    }
    groups.set(key, group);
  });

  return Array.from(groups.entries()).map(([conceptName, group]) => {
    const accuracy = group.attempted > 0 ? (group.correct / group.attempted) * 100 : 0;
    const masteryLevel = Math.min(100, Math.round(accuracy + group.correct * 2));
    let status: PalConceptStatus;
    if (masteryLevel >= 70) status = 'mastered';
    else if (masteryLevel >= 40) status = 'developing';
    else if (masteryLevel > 0) status = 'needs_practice';
    else status = 'not_started';
    return {
      conceptName,
      attempted: group.attempted,
      correct: group.correct,
      wrong: group.wrong,
      total: group.total,
      accuracy: Math.round(accuracy),
      masteryLevel,
      status,
    };
  });
}

// ===========================================================================
// PAL Practice engine (result-screen features)
//
//   GET  /lms/adaptive-practice   assessmentQuestionController@generateAdaptivePractice
//   POST /lms/submit-practice     assessmentQuestionController@submitPractice
//   GET  /lms/spaced-repetition   assessmentQuestionController@getSpacedRepetition
//   GET  /lms/practice-history    assessmentQuestionController@getPracticeHistory
//
// These endpoints read `student_id` from the request (session only supplies
// sub_institute_id) and use the `status_code` convention.
// ===========================================================================

/** Params required by the practice endpoints (student_id + tenant). */
function practiceParams(session: SessionContext, studentId: string): URLSearchParams {
  const params = new URLSearchParams();
  params.set('type', 'API');
  if (session.subInstituteId) params.set('sub_institute_id', session.subInstituteId);
  if (session.syear) params.set('syear', session.syear);
  params.set('student_id', studentId || session.userId);
  return params;
}

export interface PracticeQuestionOption {
  id: string;
  answer: string;
  correct: boolean;
}

export interface PracticeQuestion {
  id: string;
  title: string;
  questionTypeId: string;
  multipleAnswer: boolean;
  difficulty: string;
  hintText: string;
  conceptId: string;
  conceptName: string;
  options: PracticeQuestionOption[];
}

export interface PracticeStrategy {
  type: string;
  description: string;
  difficulty: string;
  questionCount: number;
}

export interface AdaptivePracticeData {
  status: string;
  message: string;
  questions: PracticeQuestion[];
  strategy: PracticeStrategy | null;
}

export interface AdaptivePracticeInput {
  studentId: string;
  standardId: string;
  subjectId: string;
  chapterId: string;
  conceptId?: string;
  questionCount?: number;
}

export async function fetchAdaptivePractice(
  input: AdaptivePracticeInput,
  signal?: AbortSignal
): Promise<AdaptivePracticeData> {
  const session = requireSession();
  const params = practiceParams(session, input.studentId);
  params.set('standard_id', input.standardId);
  params.set('subject_id', input.subjectId);
  params.set('chapter_id', input.chapterId);
  params.set('concept_id', input.conceptId ?? '0');
  params.set('question_count', String(input.questionCount ?? 5));

  const response = await fetch(
    `${session.baseUrl}/lms/adaptive-practice?${params.toString()}`,
    { headers: ajaxHeaders(session), signal }
  );
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: Unable to load practice questions.`);
  }

  const payload = toRecord(await response.json());
  const data = toRecord(payload.data);
  const strategyRecord = toRecord(data.strategy);
  const strategy: PracticeStrategy | null = Object.keys(strategyRecord).length
    ? {
        type: readString(strategyRecord.type),
        description: readString(strategyRecord.description),
        difficulty: readString(strategyRecord.difficulty),
        questionCount: readNumber(strategyRecord.question_count),
      }
    : null;

  const questions: PracticeQuestion[] = toArray(data.questions).map((entry) => {
    const record = toRecord(entry);
    const options = toArray(record.options).map((opt) => {
      const option = toRecord(opt);
      return {
        id: readString(option.id),
        answer: readString(option.answer),
        correct: readString(option.correct_answer) === '1',
      };
    });
    return {
      id: readString(record.id),
      title: readString(record.question_title),
      questionTypeId: readString(record.question_type_id),
      multipleAnswer: readString(record.multiple_answer) === '1',
      difficulty: readString(record.difficulty),
      hintText: readString(record.hint_text),
      conceptId: readString(record.concept_id),
      conceptName: readString(record.concept_name),
      options,
    };
  });

  return {
    status: normalizeApiStatus(payload),
    message: readString(payload.message),
    questions,
    strategy,
  };
}

export interface PracticeSubmitSummary {
  totalCorrect: number;
  totalWrong: number;
  totalMarks: number;
  obtainedMarks: number;
  percentage: number;
}

export interface PracticeNextRecommendation {
  action: string;
  message: string;
  concepts: string[];
}

export interface PracticeSubmitResult {
  status: string;
  message: string;
  summary: PracticeSubmitSummary;
  nextRecommendation: PracticeNextRecommendation | null;
}

export async function submitAdaptivePractice(input: {
  studentId: string;
  /** questionId -> selected answer_master id (single) or ids (multiple). */
  answers: Record<string, string | string[]>;
}): Promise<PracticeSubmitResult> {
  const session = requireSession();
  const body = practiceParams(session, input.studentId);
  Object.entries(input.answers).forEach(([questionId, value]) => {
    if (Array.isArray(value)) {
      value.forEach((id) => body.append(`answers[${questionId}][]`, id));
    } else if (value) {
      body.set(`answers[${questionId}]`, value);
    }
  });

  const response = await fetch(`${session.baseUrl}/lms/submit-practice`, {
    method: 'POST',
    headers: ajaxHeaders(session, 'application/x-www-form-urlencoded'),
    body: body.toString(),
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: Unable to submit practice.`);
  }

  const payload = toRecord(await response.json());
  const data = toRecord(payload.data);
  const summary = toRecord(data.summary);
  const recommendation = toRecord(data.next_practice_recommendation);

  return {
    status: normalizeApiStatus(payload),
    message: readString(payload.message),
    summary: {
      totalCorrect: readNumber(summary.total_correct),
      totalWrong: readNumber(summary.total_wrong),
      totalMarks: readNumber(summary.total_marks),
      obtainedMarks: readNumber(summary.obtained_marks),
      percentage: readNumber(summary.percentage),
    },
    nextRecommendation: Object.keys(recommendation).length
      ? {
          action: readString(recommendation.action),
          message: readString(recommendation.message),
          concepts: toArray(recommendation.concepts).map((concept) => readString(concept)),
        }
      : null,
  };
}

export interface SpacedRepetitionItem {
  conceptId: string;
  conceptName: string;
  masteryLevel: number;
  daysAgo: number;
}

export interface SpacedRepetitionData {
  today: SpacedRepetitionItem[];
  tomorrow: SpacedRepetitionItem[];
  thisWeek: SpacedRepetitionItem[];
  nextWeek: SpacedRepetitionItem[];
}

function mapRepetitionBucket(value: unknown): SpacedRepetitionItem[] {
  return toArray(value).map((entry) => {
    const record = toRecord(entry);
    return {
      conceptId: readString(record.concept_id),
      conceptName: readString(record.concept_name),
      masteryLevel: readNumber(record.mastery_level),
      daysAgo: readNumber(record.days_ago),
    };
  });
}

export async function fetchSpacedRepetition(
  studentId: string,
  signal?: AbortSignal
): Promise<SpacedRepetitionData> {
  const session = requireSession();
  const params = practiceParams(session, studentId);

  const response = await fetch(
    `${session.baseUrl}/lms/spaced-repetition?${params.toString()}`,
    { headers: ajaxHeaders(session), signal }
  );
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: Unable to load review schedule.`);
  }

  const payload = toRecord(await response.json());
  const data = toRecord(payload.data);
  return {
    today: mapRepetitionBucket(data.today),
    tomorrow: mapRepetitionBucket(data.tomorrow),
    thisWeek: mapRepetitionBucket(data.this_week),
    nextWeek: mapRepetitionBucket(data.next_week),
  };
}

export interface PracticeHistoryItem {
  questionTitle: string;
  conceptName: string;
  statusText: string;
  createdAt: string;
}

export interface WeeklyProgress {
  date: string;
  total: number;
  correct: number;
}

export interface PracticeHistoryData {
  history: PracticeHistoryItem[];
  weekly: WeeklyProgress[];
  totalPracticed: number;
  accuracy: number;
}

export async function fetchPracticeHistory(
  studentId: string,
  limit = 20,
  signal?: AbortSignal
): Promise<PracticeHistoryData> {
  const session = requireSession();
  const params = practiceParams(session, studentId);
  params.set('limit', String(limit));

  const response = await fetch(
    `${session.baseUrl}/lms/practice-history?${params.toString()}`,
    { headers: ajaxHeaders(session), signal }
  );
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: Unable to load practice history.`);
  }

  const payload = toRecord(await response.json());
  const data = toRecord(payload.data);
  return {
    history: toArray(data.history).map((entry) => {
      const record = toRecord(entry);
      return {
        questionTitle: readString(record.question_title),
        conceptName: readString(record.concept_name),
        statusText: readString(record.status_text),
        createdAt: readString(record.created_at),
      };
    }),
    weekly: toArray(data.weekly_progress).map((entry) => {
      const record = toRecord(entry);
      return {
        date: readString(record.date),
        total: readNumber(record.total),
        correct: readNumber(record.correct),
      };
    }),
    totalPracticed: readNumber(data.total_practiced),
    accuracy: readNumber(data.accuracy),
  };
}

// ===========================================================================
// PAL Personalize Marks (teacher offline-marks entry)
//
//   GET  /result_personalize_marks   resultPersonalizeMarksController@index (options)
//   POST /result_personalize_marks   resultPersonalizeMarksController@store (save)
//
// Both honor `type=API` (JSON) via is_mobile().
// ===========================================================================

export interface StdDivOption {
  gradeId: string;
  stdId: string;
  divId: string;
  standardName: string;
  divisionName: string;
  /** "standard_name-division_name" — the value stored by Laravel. */
  label: string;
}

export async function fetchPersonalizeMarksOptions(
  signal?: AbortSignal
): Promise<StdDivOption[]> {
  const session = requireSession();
  const params = new URLSearchParams();
  appendCommonParams(params, session); // type=API, sub_institute_id, syear

  const response = await fetch(
    `${session.baseUrl}/result_personalize_marks?${params.toString()}`,
    { headers: ajaxHeaders(session), signal }
  );
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: Unable to load standard/division list.`);
  }

  const payload = toRecord(await response.json());
  return toArray(payload.getStdDiv).map((entry) => {
    const record = toRecord(entry);
    const standardName = readString(record.standard_name);
    const divisionName = readString(record.division_name);
    return {
      gradeId: readString(record.grade_id),
      stdId: readString(record.std_id),
      divId: readString(record.div_id),
      standardName,
      divisionName,
      label: `${standardName}-${divisionName}`,
    };
  });
}

export interface PersonalizeMarkRow {
  stdDiv: string;
  studentName: string;
  enrollmentNo: string;
  subject: string;
  exam: string;
  total: string;
  obtain: string;
}

export interface PersonalizeMarksResult {
  status: string;
  message: string;
  savedCount: number;
}

export async function submitPersonalizeMarks(
  rows: PersonalizeMarkRow[]
): Promise<PersonalizeMarksResult> {
  const session = requireSession();
  const body = new URLSearchParams();
  appendCommonParams(body, session); // type=API, sub_institute_id, syear

  rows.forEach((row) => {
    body.append('std_div[]', row.stdDiv);
    body.append('student_name[]', row.studentName);
    body.append('enrollment_no[]', row.enrollmentNo);
    body.append('subject[]', row.subject);
    body.append('exam[]', row.exam);
    body.append('total[]', row.total);
    body.append('obtain[]', row.obtain);
  });

  const response = await fetch(`${session.baseUrl}/result_personalize_marks`, {
    method: 'POST',
    headers: ajaxHeaders(session, 'application/x-www-form-urlencoded'),
    body: body.toString(),
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: Unable to save marks.`);
  }

  const payload = toRecord(await response.json());
  const status = normalizeApiStatus(payload);
  const message = readString(payload.message);
  if (status !== '1' && status !== 'SUCCESS') {
    throw new Error(message || 'Failed to save marks.');
  }
  return {
    status,
    message,
    savedCount: toArray(payload.StudentData).length,
  };
}

// ===========================================================================
// Session Summary
// ===========================================================================

export interface SessionSummaryConcept {
    conceptId: string | null;
    conceptName: string;
    masteryBefore: number;
    masteryAfter: number;
    masteryChange: number;
    accuracy: number;
    attempted: number;
    correct: number;
}

export interface SessionSummaryPraise {
    praiseText: string;
    reason: string;
    sourceType: string | null;
    conceptName: string | null;
}

export interface SessionSummaryUpcoming {
    conceptId: string | null;
    conceptName: string;
    reason: string | null;
    expectedTiming: string | null;
}

export interface SessionSummaryStreak {
    currentStreak: number;
    longestStreak: number;
    lastActivityDate: string | null;
}

export interface SessionSummaryCareerQuest {
    currentStage: string;
    stageLabel: string;
    stageDescription: string;
    activityCount: number;
    masteredSkillCount: number;
    totalSkillCount: number;
}

export interface SessionSummaryBadge {
    badgeCode: string;
    badgeName: string;
    category: string;
    description: string;
    earnedAt: string;
}

export interface SessionSummary {
    sessionId: string;
    userId: string;
    subInstituteId: string;
    syear: string;
    sessionStart: string | null;
    sessionEnd: string | null;
    completionState: string;
    totalConcepts: number;
    totalQuestions: number;
    obtainMarks: number;
    totalMarks: number;
    accuracy: number;
    conceptsWorkedOn: SessionSummaryConcept[];
    specificPraise: SessionSummaryPraise[];
    upcoming: SessionSummaryUpcoming[];
    streak: SessionSummaryStreak | null;
    careerQuestUpdate: SessionSummaryCareerQuest | null;
    badgesEarned: SessionSummaryBadge[];
}

export async function fetchSessionSummary(
    sessionId: string,
    signal?: AbortSignal
): Promise<SessionSummary> {
    const session = requireSession();
    const url = `/api/pal/gamification/session-summary/${encodeURIComponent(sessionId)}?user_id=${encodeURIComponent(session.userId)}&sub_institute_id=${encodeURIComponent(session.subInstituteId)}&syear=${encodeURIComponent(session.syear)}`;

    const response = await fetch(url, {
        headers: createAuthHeaders(session),
        signal,
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ message: `HTTP ${response.status}` }));
        throw new Error(error.message || `HTTP ${response.status}: Unable to load session summary.`);
    }

    const payload = toRecord(await response.json());
    const data = toRecord(payload.data);

    return {
        sessionId: readString(data.sessionId),
        userId: readString(data.user_id ?? data.userId),
        subInstituteId: readString(data.sub_institute_id ?? data.subInstituteId),
        syear: readString(data.syear),
        sessionStart: readString(data.session_start ?? data.sessionStart),
        sessionEnd: readString(data.session_end ?? data.sessionEnd),
        completionState: readString(data.completion_state ?? data.completionState),
        totalConcepts: readNumber(data.total_concepts ?? data.totalConcepts),
        totalQuestions: readNumber(data.total_questions ?? data.totalQuestions),
        obtainMarks: readNumber(data.obtain_marks ?? data.obtainMarks),
        totalMarks: readNumber(data.total_marks ?? data.totalMarks),
        accuracy: readNumber(data.accuracy),
        conceptsWorkedOn: toArray(data.conceptsWorkedOn ?? data.concepts_worked_on).map((entry) => {
            const record = toRecord(entry);
            return {
                conceptId: readString(record.concept_id ?? record.conceptId),
                conceptName: readString(record.concept_name ?? record.conceptName),
                masteryBefore: readNumber(record.mastery_before ?? record.masteryBefore),
                masteryAfter: readNumber(record.mastery_after ?? record.masteryAfter),
                masteryChange: readNumber(record.mastery_change ?? record.masteryChange),
                accuracy: readNumber(record.accuracy),
                attempted: readNumber(record.attempted),
                correct: readNumber(record.correct),
            } as SessionSummaryConcept;
        }),
        specificPraise: toArray(data.specificPraise ?? data.specific_praise).map((entry) => {
            const record = toRecord(entry);
            return {
                praiseText: readString(record.praise_text ?? record.praiseText),
                reason: readString(record.reason),
                sourceType: readString(record.source_type ?? record.sourceType),
                conceptName: readString(record.concept_name ?? record.conceptName),
            } as SessionSummaryPraise;
        }),
        upcoming: toArray(data.upcoming).map((entry) => {
            const record = toRecord(entry);
            return {
                conceptId: readString(record.concept_id ?? record.conceptId),
                conceptName: readString(record.concept_name ?? record.conceptName),
                reason: readString(record.reason),
                expectedTiming: readString(record.expected_timing ?? record.expectedTiming),
            } as SessionSummaryUpcoming;
        }),
        streak: data.streak && typeof data.streak === 'object' ? {
            currentStreak: readNumber((data.streak as Record<string, unknown>).currentStreak),
            longestStreak: readNumber((data.streak as Record<string, unknown>).longestStreak),
            lastActivityDate: readString((data.streak as Record<string, unknown>).lastActivityDate),
        } : null,
        careerQuestUpdate: data.careerQuestUpdate && typeof data.careerQuestUpdate === 'object' ? {
            currentStage: readString((data.careerQuestUpdate as Record<string, unknown>).currentStage),
            stageLabel: readString((data.careerQuestUpdate as Record<string, unknown>).stageLabel),
            stageDescription: readString((data.careerQuestUpdate as Record<string, unknown>).stageDescription),
            activityCount: readNumber((data.careerQuestUpdate as Record<string, unknown>).activityCount),
            masteredSkillCount: readNumber((data.careerQuestUpdate as Record<string, unknown>).masteredSkillCount),
            totalSkillCount: readNumber((data.careerQuestUpdate as Record<string, unknown>).totalSkillCount),
        } : null,
        badgesEarned: toArray(data.badgesEarned ?? data.badges_earned).map((entry) => {
            const record = toRecord(entry);
            return {
                badgeCode: readString(record.badge_code ?? record.badgeCode),
                badgeName: readString(record.badge_name ?? record.badgeName),
                category: readString(record.category),
                description: readString(record.description),
                earnedAt: readString(record.earned_at ?? record.earnedAt),
            } as SessionSummaryBadge;
        }),
    };
}
