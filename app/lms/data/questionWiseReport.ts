import {
  buildSessionContext,
  createAuthHeaders,
  readString,
  type SessionContext,
} from '@/lib/erp-client';

export { fetchExamsForSubject, type ReportExam } from '@/app/exam/data/progressReport';

/**
 * LMS → Question Wise Report data layer.
 *
 *   POST /lms/show_question_wise_report   (form-urlencoded, type=API)
 *     grade, standard, division, subject, exam, action, sub_institute_id, syear
 *
 * `action`: 0 = "Not-attempt" mode — LEFT JOIN, includes students who did not
 * attempt; any non-zero = "Attempt" mode — INNER JOIN, only attempters.
 *
 * Response `results` is nested: results[questionPaperId][studentId][onlineExamId]
 * = array of per-(student,question) rows. We flatten it into a question × student
 * matrix of right/wrong. The controller now reads tenant params from the request
 * (headless fallback), falling back to the session.
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

export interface QwQuestion {
  id: string;
  label: string;
}

export interface QwStudent {
  id: string;
  name: string;
  rollNo: string;
  attempted: boolean;
}

export interface QuestionWiseReport {
  paperName: string;
  standardName: string;
  divisionName: string;
  subjectName: string;
  questions: QwQuestion[];
  students: QwStudent[];
  /** answers[studentId][questionId] = true when answered correctly. */
  answers: Record<string, Record<string, boolean>>;
}

export interface QuestionWiseFilters {
  gradeId: string;
  standardId: string;
  divisionId: string;
  subjectId: string;
  examId: string;
  /** true = include students who did not attempt (action=0 / LEFT join). */
  includeNonAttempters: boolean;
}

// ---------------------------------------------------------------------------
// Fetch
// ---------------------------------------------------------------------------

export async function fetchQuestionWiseReport(
  filters: QuestionWiseFilters,
  signal?: AbortSignal
): Promise<QuestionWiseReport> {
  const session = requireSession();

  const body = new URLSearchParams();
  body.set('type', 'API');
  body.set('sub_institute_id', session.subInstituteId);
  body.set('syear', session.syear);
  body.set('grade', filters.gradeId);
  body.set('standard', filters.standardId);
  body.set('division', filters.divisionId);
  body.set('subject', filters.subjectId);
  body.set('exam', filters.examId);
  body.set('action', filters.includeNonAttempters ? '0' : '1');

  const res = await fetch(`${session.baseUrl}/lms/show_question_wise_report`, {
    method: 'POST',
    headers: {
      ...createAuthHeaders(session, 'application/x-www-form-urlencoded'),
      'X-Requested-With': 'XMLHttpRequest',
    },
    body: body.toString(),
    signal,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: Unable to load the report.`);
  const raw = toRecord(await readJson(res, 'Failed to load the report'));

  // Flatten results[qpId][studentId][onlineExamId][] into matrix + ordered lists.
  const questionOrder: QwQuestion[] = [];
  const questionSeen = new Set<string>();
  const studentMap = new Map<string, QwStudent>();
  const answers: Record<string, Record<string, boolean>> = {};

  const results = toRecord(raw.results);
  let paperName = '';

  for (const paperGroup of Object.values(results)) {
    for (const studentGroup of Object.values(toRecord(paperGroup))) {
      for (const rows of Object.values(toRecord(studentGroup))) {
        for (const entry of toArray(rows)) {
          const r = toRecord(entry);
          const studentId = readString(r.id);
          const questionId = readString(r.question_id);
          if (!studentId || !questionId) continue;

          if (!paperName) paperName = readString(r.question_paper_name);

          if (!questionSeen.has(questionId)) {
            questionSeen.add(questionId);
            questionOrder.push({ id: questionId, label: readString(r.questions) });
          }

          const existing = studentMap.get(studentId);
          const attempted = readString(r.online_exam_id) !== '';
          if (!existing) {
            studentMap.set(studentId, {
              id: studentId,
              name: readString(r.student_name).trim() || `Student #${studentId}`,
              rollNo: readString(r.roll_no),
              attempted,
            });
          } else if (attempted && !existing.attempted) {
            existing.attempted = true;
          }

          if (!answers[studentId]) answers[studentId] = {};
          if (readString(r.ans_status).toLowerCase() === 'right') {
            answers[studentId][questionId] = true;
          } else if (answers[studentId][questionId] === undefined) {
            answers[studentId][questionId] = false;
          }
        }
      }
    }
  }

  const students = Array.from(studentMap.values()).sort((a, b) => {
    const ra = Number(a.rollNo);
    const rb = Number(b.rollNo);
    if (Number.isFinite(ra) && Number.isFinite(rb) && ra !== rb) return ra - rb;
    return a.name.localeCompare(b.name);
  });

  if (!paperName) {
    const examData = toArray(raw.exams_data)[0];
    paperName = readString(toRecord(examData).paper_name);
  }

  return {
    paperName,
    standardName: readString(raw.standard_name),
    divisionName: readString(raw.division_name),
    subjectName: readString(raw.subject_name),
    questions: questionOrder,
    students,
    answers,
  };
}
