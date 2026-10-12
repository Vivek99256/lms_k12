'use client';

/**
 * Quiz builder API client.
 *
 * Wraps the Laravel `ApiLmsCourseController` REST endpoints (see
 * `routes/api.php`) using this project's shared `lib/erp-client.ts`
 * session/header helpers.
 *
 * - `POST /api/lms-courses` -> subjects (grouped by content category) with their chapters,
 *   used to populate the subject/chapter dropdowns.
 */

import {
  appendCommonParams,
  buildSessionContext,
  createAuthHeaders,
  readString,
  type SessionContext,
} from '@/lib/erp-client';

export { buildSessionContext };
export type { SessionContext };

/**
 * The caller's profile name ("Teacher" / "STUDENT" / ...), read the same way
 * `lib/session/internal-access.ts` reads it: `userData`/`menuContext` in
 * browser storage, `user_profile` or `user_profile_name`. Needed because
 * `QuizAttemptApiController@index` branches teacher vs student by this value
 * (see routes/api.php -> app/Http/Controllers/api/QuizAttemptApiController.php).
 */
export function readUserProfileName(): string {
  if (typeof window === 'undefined') return '';
  try {
    const readStoredRecord = (key: string): Record<string, unknown> => {
      const value = localStorage.getItem(key) ?? sessionStorage.getItem(key) ?? '{}';
      const parsed = JSON.parse(value) as unknown;
      return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
    };
    const userData = readStoredRecord('userData');
    const menuContext = readStoredRecord('menuContext');
    return readString(menuContext.user_profile_name ?? userData.user_profile ?? userData.user_profile_name ?? '');
  } catch {
    return '';
  }
}

export function isStudentRole(): boolean {
  return readUserProfileName().toUpperCase() === 'STUDENT';
}

export type QuizChapter = {
  id: number;
  name: string;
};

export type QuizSubject = {
  id: number;
  name: string;
  standardId: number;
  chapters: QuizChapter[];
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function toArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') return Object.values(value as Record<string, unknown>);
  return [];
}

function readNumber(value: unknown): number {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

async function postForm<T>(session: SessionContext, path: string, extraParams?: Record<string, string>): Promise<T> {
  const body = new URLSearchParams();
  appendCommonParams(body, session);
  if (session.userId) body.set('user_id', session.userId);
  Object.entries(extraParams ?? {}).forEach(([key, value]) => {
    if (value) body.set(key, value);
  });

  const response = await fetch(`${session.baseUrl}/api${path}`, {
    method: 'POST',
    headers: createAuthHeaders(session, 'application/x-www-form-urlencoded'),
    body,
  });

  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(readString(payload.message) || "Couldn't complete the request. Try again.");
  }
  return payload as T;
}

function chapterFromRow(row: unknown): QuizChapter {
  const record = asRecord(row);
  return {
    id: readNumber(record.id),
    name: readString(record.chapter_name) || readString(record.name),
  };
}

/** Flattens the `lms-courses` response (grouped by content category) into a de-duplicated subject list with nested chapters. */
export async function fetchQuizSubjects(session: SessionContext): Promise<QuizSubject[]> {
  const payload = await postForm<Record<string, unknown>>(session, '/lms-courses');
  const grouped = asRecord(payload.lms_subject);

  const subjectsById = new Map<number, QuizSubject>();
  Object.values(grouped).forEach((categoryRows) => {
    toArray(categoryRows).forEach((row) => {
      const record = asRecord(row);
      const subjectId = readNumber(record.subject_id);
      if (!subjectId || subjectsById.has(subjectId)) return;

      subjectsById.set(subjectId, {
        id: subjectId,
        name: readString(record.subject_name),
        standardId: readNumber(record.standard_id),
        chapters: toArray(record.chapters).map(chapterFromRow).filter((chapter) => chapter.id),
      });
    });
  });

  return Array.from(subjectsById.values()).filter((subject) => subject.id && subject.name);
}

// ---------------------------------------------------------------------------
// LMS Quiz -- teacher-authored, non-adaptive quizzes.
//
// Wraps `QuizAttemptApiController` (routes/api.php: `/api/quiz*`). This is NOT
// the PAL Adaptive Quiz. A quiz is a `question_paper` row (exam_type='quiz');
// an attempt is a real `lms_quiz_attempts` row scored server-side against
// `answer_master` -- nothing here computes a score on the client.
// ---------------------------------------------------------------------------

export type QuizSummary = {
  id: number;
  title: string;
  description: string;
  standardName: string;
  subjectName: string;
  totalQuestions: number;
  totalMarks: number;
  timeAllowed: number;
  createdOn: string;
  /** Teacher view only. */
  attemptCount?: number;
  avgScore?: number | null;
  /** Student view only -- their own latest attempt, if any. */
  myAttemptId?: number | null;
  myAttemptStatus?: string | null;
  myScore?: number | null;
  myMaxMarks?: number | null;
};

export type QuizQuestionDraft = {
  text: string;
  options: string[];
  correctOptionIndex: number;
};

export type PublishQuizPayload = {
  standardId: number;
  subjectId: number;
  chapterId?: number | null;
  gradeId?: number | null;
  title: string;
  description?: string;
  timeAllowedMinutes?: number;
  questions: QuizQuestionDraft[];
};

export type QuizTakeOption = { id: number; text: string };
export type QuizTakeQuestion = { id: number; text: string; points: number; options: QuizTakeOption[] };

export type StartAttemptResponse = {
  attemptId: number;
  quiz: { id: number; title: string; timeAllowed: number | null; totalMarks: number; totalQues: number };
  questions: QuizTakeQuestion[];
};

export type QuizResultOption = { id: number; text: string; isCorrect: boolean };
export type QuizResultQuestion = {
  id: number;
  text: string;
  options: QuizResultOption[];
  given: number[];
  isCorrect: boolean;
};

export type QuizAttemptResult = {
  attemptId: number;
  quizId: number;
  title: string | null;
  status: string;
  totalQuestions: number;
  correctCount: number;
  wrongCount: number;
  unansweredCount: number;
  scoreMarks: number;
  maxMarks: number;
  percentage: number | null;
  startedAt: string | null;
  completedAt: string | null;
  questions: QuizResultQuestion[];
};

export type QuizHistoryEntry = {
  attemptId: number;
  quizId: number;
  title: string;
  status: string;
  scoreMarks: number | null;
  maxMarks: number | null;
  completedAt: string | null;
};

function commonQuery(session: SessionContext, extra?: Record<string, string>): string {
  const params = new URLSearchParams();
  appendCommonParams(params, session);
  if (session.userId) params.set('user_id', session.userId);
  params.set('user_profile_name', readUserProfileName());
  Object.entries(extra ?? {}).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  return params.toString();
}

async function getJson<T>(session: SessionContext, path: string, extra?: Record<string, string>): Promise<T> {
  const response = await fetch(`${session.baseUrl}/api${path}?${commonQuery(session, extra)}`, {
    method: 'GET',
    headers: createAuthHeaders(session),
  });
  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok || normalizeApiStatusLocal(payload) === '0') {
    throw new Error(readString(payload.message) || "Couldn't complete the request. Try again.");
  }
  return (payload.data ?? payload) as T;
}

async function postJson<T>(session: SessionContext, path: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${session.baseUrl}/api${path}`, {
    method: 'POST',
    headers: createAuthHeaders(session, 'application/json'),
    body: JSON.stringify({
      sub_institute_id: session.subInstituteId,
      syear: session.syear,
      user_id: session.userId,
      user_profile_name: readUserProfileName(),
      ...body,
    }),
  });
  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok || normalizeApiStatusLocal(payload) === '0') {
    throw new Error(readString(payload.message) || "Couldn't complete the request. Try again.");
  }
  return (payload.data ?? payload) as T;
}

function normalizeApiStatusLocal(payload: Record<string, unknown>): string {
  return String(payload.status_code ?? payload.status ?? '1');
}

function quizSummaryFromRow(row: unknown): QuizSummary {
  const r = asRecord(row);
  return {
    id: readNumber(r.id),
    title: readString(r.paper_name),
    description: readString(r.paper_desc),
    standardName: readString(r.standard_name),
    subjectName: readString(r.subject_name),
    totalQuestions: readNumber(r.total_ques),
    totalMarks: readNumber(r.total_marks),
    timeAllowed: readNumber(r.time_allowed),
    createdOn: readString(r.created_on),
    attemptCount: r.attempt_count != null ? readNumber(r.attempt_count) : undefined,
    avgScore: r.avg_score != null ? Number(r.avg_score) : null,
    myAttemptId: r.my_attempt_id != null ? readNumber(r.my_attempt_id) : null,
    myAttemptStatus: r.my_attempt_status != null ? readString(r.my_attempt_status) : null,
    myScore: r.my_score != null ? Number(r.my_score) : null,
    myMaxMarks: r.my_max_marks != null ? Number(r.my_max_marks) : null,
  };
}

/** GET /api/quiz -- quizzes the caller may see (role-branched server-side). */
export async function fetchQuizList(session: SessionContext): Promise<QuizSummary[]> {
  const data = await getJson<unknown[]>(session, '/quiz');
  return toArray(data).map(quizSummaryFromRow);
}

/** POST /api/quiz -- a teacher publishes a quiz. Returns the new quiz id. */
export async function publishQuiz(session: SessionContext, payload: PublishQuizPayload): Promise<number> {
  const data = await postJson<Record<string, unknown>>(session, '/quiz', {
    standard_id: payload.standardId,
    subject_id: payload.subjectId,
    chapter_id: payload.chapterId ?? null,
    grade_id: payload.gradeId ?? null,
    title: payload.title,
    description: payload.description ?? '',
    time_allowed: payload.timeAllowedMinutes ?? null,
    questions: payload.questions.map((q) => ({
      text: q.text,
      options: q.options,
      correctOptionIndex: q.correctOptionIndex,
    })),
  });
  return readNumber(data.id);
}

function takeQuestionFromRow(row: unknown): QuizTakeQuestion {
  const r = asRecord(row);
  return {
    id: readNumber(r.id),
    text: readString(r.text),
    points: readNumber(r.points) || 1,
    options: toArray(r.options).map((o) => {
      const opt = asRecord(o);
      return { id: readNumber(opt.id), text: readString(opt.text) };
    }),
  };
}

/** POST /api/quiz/{id}/attempts -- start (or resume) a student's attempt. */
export async function startQuizAttempt(session: SessionContext, quizId: number): Promise<StartAttemptResponse> {
  const data = await postJson<Record<string, unknown>>(session, `/quiz/${quizId}/attempts`, {});
  const quiz = asRecord(data.quiz);
  return {
    attemptId: readNumber(data.attempt_id),
    quiz: {
      id: readNumber(quiz.id),
      title: readString(quiz.title),
      timeAllowed: quiz.time_allowed != null ? readNumber(quiz.time_allowed) : null,
      totalMarks: readNumber(quiz.total_marks),
      totalQues: readNumber(quiz.total_ques),
    },
    questions: toArray(data.questions).map(takeQuestionFromRow),
  };
}

function resultFromPayload(data: Record<string, unknown>): QuizAttemptResult {
  return {
    attemptId: readNumber(data.attempt_id),
    quizId: readNumber(data.quiz_id),
    title: data.title != null ? readString(data.title) : null,
    status: readString(data.status),
    totalQuestions: readNumber(data.total_questions),
    correctCount: readNumber(data.correct_count),
    wrongCount: readNumber(data.wrong_count),
    unansweredCount: readNumber(data.unanswered_count),
    scoreMarks: Number(data.score_marks ?? 0),
    maxMarks: Number(data.max_marks ?? 0),
    percentage: data.percentage != null ? Number(data.percentage) : null,
    startedAt: data.started_at != null ? readString(data.started_at) : null,
    completedAt: data.completed_at != null ? readString(data.completed_at) : null,
    questions: toArray(data.questions).map((row) => {
      const r = asRecord(row);
      return {
        id: readNumber(r.id),
        text: readString(r.text),
        options: toArray(r.options).map((o) => {
          const opt = asRecord(o);
          return { id: readNumber(opt.id), text: readString(opt.text), isCorrect: Boolean(opt.is_correct) };
        }),
        given: toArray(r.given).map((v) => readNumber(v)),
        isCorrect: Boolean(r.is_correct),
      };
    }),
  };
}

/**
 * POST /api/quiz/attempts/{attemptId}/submit -- submit answers and get the
 * REAL, server-computed score. `answers` maps question id -> selected
 * answer_master id (the only thing the client ever asserts is WHICH option
 * it picked, never whether that option is correct).
 */
export async function submitQuizAttempt(
  session: SessionContext,
  attemptId: number,
  answers: Record<number, number>
): Promise<QuizAttemptResult> {
  const data = await postJson<Record<string, unknown>>(session, `/quiz/attempts/${attemptId}/submit`, { answers });
  return resultFromPayload(data);
}

/** GET /api/quiz/attempts -- the caller's own past attempts. */
export async function fetchQuizHistory(session: SessionContext): Promise<QuizHistoryEntry[]> {
  const data = await getJson<unknown[]>(session, '/quiz/attempts');
  return toArray(data).map((row) => {
    const r = asRecord(row);
    return {
      attemptId: readNumber(r.id),
      quizId: readNumber(r.question_paper_id),
      title: readString(r.paper_name),
      status: readString(r.status),
      scoreMarks: r.score_marks != null ? Number(r.score_marks) : null,
      maxMarks: r.max_marks != null ? Number(r.max_marks) : null,
      completedAt: r.completed_at != null ? readString(r.completed_at) : null,
    };
  });
}

/** GET /api/quiz/attempts/{attemptId} -- one attempt's full result. */
export async function fetchAttemptResult(session: SessionContext, attemptId: number): Promise<QuizAttemptResult> {
  const data = await getJson<Record<string, unknown>>(session, `/quiz/attempts/${attemptId}`);
  return resultFromPayload(data);
}
