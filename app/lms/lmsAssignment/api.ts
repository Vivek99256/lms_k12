import {
  appendCommonParams,
  buildSessionContext,
  createAuthHeaders,
  normalizeApiStatus,
  readNumber,
  readString,
  type ApiEnvelope,
  type SessionContext,
} from "@/lib/erp-client";

// ---------------------------------------------------------------------------
// LMS Assignment service layer.
//
// Faithful port of the old Laravel blade modules that operate on the
// `lms_assignment` table:
//   - assignmentController            -> Assignment (create)          -> lmsAssignment
//   - assignmentSubmissionController  -> Assignment Submission        -> lmsAssignment_submission
//   - annotateAssignmentController    -> Annotate / Review Assignment -> lmsAnnotate_assignment
//
// Those modules are blade + session routes with NO API layer. This file targets
// a new `api/lms-assignment/*` contract that the backend team must implement
// (see docs/backend-api-spec-lms-assignment.md). It intentionally mirrors the
// existing `app/lms/homework/api.ts` conventions: JSON POSTs go through the
// Next.js proxy, multipart uploads post directly to the backend, and every
// endpoint returns a `{ status_code, message, data }` envelope.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

/** A student row for the create screen's selectable table. */
export type AssignmentStudent = {
  id: number;
  studentName: string;
  enrollmentNo: string;
  gender: string;
  mobile: string;
  standardId: number;
  standardName: string;
  divisionId: number;
  divisionName: string;
};

/** An offline exam question paper, chosen when creating an assignment. */
export type ExamPaper = {
  id: number;
  paperName: string;
  pdfName: string;
  totalMarks: number;
};

/** A student-facing assignment row (Assignment Submission screen). */
export type AssignmentSubmissionRow = {
  id: number;
  subjectName: string;
  title: string;
  description: string;
  createdDate: string;
  submissionDate: string;
  examPdf: string; // full URL to the assignment/question-paper file
  submissionImage: string; // full URL to the student's submitted file (if any)
  studentSubmissionStatus: string; // "Y" | "N"
  teacherRemarks: string;
  teacherSubmissionStatus: string; // "Y" | "N"
  studentId: number;
  examId: number;
};

/** A teacher-facing row for the Annotate/Review list. */
export type AnnotateRow = {
  id: number;
  standardName: string;
  studentName: string;
  subjectName: string;
  title: string;
  createdDate: string;
  submissionDate: string;
  examPdf: string;
  submissionImage: string;
  studentSubmissionStatus: string; // "Y" | "N"
  teacherSubmissionStatus: string; // "Y" | "N"
  studentId: number;
  examId: number;
};

/** A single question within a paper, for the per-question grading screen. */
export type ReviewQuestion = {
  id: number;
  questionName: string;
  questionTypeId: number; // 1 == MCQ (rendered as a toggle worth `points`)
  points: number;
};

/** Full payload backing the review/grade screen. */
export type ReviewDetail = {
  assignmentId: number;
  studentId: number;
  studentName: string;
  title: string;
  description: string;
  submissionImage: string; // full URL to the student's submitted file
  teacherRemarks: string;
  jsonAnnotation: string;
  paperId: number;
  paperName: string;
  totalMarks: number;
  questions: ReviewQuestion[];
};

export type AssignmentFilters = {
  grade?: string;
  standard?: string;
  division?: string;
  subject?: string;
  fromDate?: string;
  toDate?: string;
};

export type ReviewFilters = AssignmentFilters & {
  /** "" all, "Y" reviewed, "N" pending teacher review */
  teacherStatus?: "" | "Y" | "N";
};

// ---------------------------------------------------------------------------
// Session / transport helpers (mirrors app/lms/homework/api.ts)
// ---------------------------------------------------------------------------

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

const records = (value: unknown): UnknownRecord[] =>
  Array.isArray(value) ? value.filter(isRecord) : [];

function session(): SessionContext {
  const value = buildSessionContext();
  if (!value.token || !value.subInstituteId || !value.userId || !value.syear) {
    throw new Error(
      "Your login session is missing a token, institute, user, or academic year."
    );
  }
  return value;
}

/** Reads profile/name from stored userData without widening SessionContext. */
function profile(): { profileName: string; userName: string } {
  if (typeof window === "undefined") return { profileName: "", userName: "" };
  try {
    const userData = JSON.parse(
      localStorage.getItem("userData") || "{}"
    ) as Record<string, unknown>;
    return {
      profileName: readString(
        userData.user_profile_name ?? userData.profile_name
      ),
      userName: readString(
        userData.user_name ?? userData.first_name ?? userData.name
      ),
    };
  } catch {
    return { profileName: "", userName: "" };
  }
}

function message(payload: unknown, fallback: string) {
  return isRecord(payload) ? readString(payload.message) || fallback : fallback;
}

/** JSON POST through the Next.js proxy to a token-authenticated api.php endpoint. */
async function postJson(path: string, values: UnknownRecord): Promise<UnknownRecord> {
  const current = session();
  const { profileName, userName } = profile();
  const params = new URLSearchParams();
  appendCommonParams(params, current);
  const body = JSON.stringify({
    ...values,
    type: "API",
    sub_institute_id: Number(current.subInstituteId),
    syear: Number(current.syear),
    user_id: Number(current.userId),
    user_profile_name: profileName,
    user_name: userName,
  });
  const response = await fetch(
    `/api/proxy?path=${encodeURIComponent(`api/${path}`)}&${params}`,
    {
      method: "POST",
      cache: "no-store",
      headers: createAuthHeaders(current, "application/json"),
      body,
    }
  );
  const payload: unknown = await response.json().catch(() => null);
  if (
    !response.ok ||
    (isRecord(payload) &&
      ["0", "2"].includes(normalizeApiStatus(payload as ApiEnvelope)))
  ) {
    throw new Error(message(payload, `Request failed (${response.status}).`));
  }
  return isRecord(payload) ? payload : {};
}

/**
 * Multipart POST directly to the backend (bypasses the proxy, which serialises
 * bodies as text and would corrupt binary uploads).
 */
async function postMultipart(
  path: string,
  build: (form: FormData) => void
): Promise<UnknownRecord> {
  const current = session();
  const { profileName, userName } = profile();
  const form = new FormData();
  form.append("type", "API");
  form.append("sub_institute_id", current.subInstituteId);
  form.append("syear", current.syear);
  form.append("user_id", current.userId);
  form.append("teacher_id", current.userId);
  form.append("user_profile_name", profileName);
  form.append("user_name", userName || "web");
  build(form);
  const response = await fetch(`${current.baseUrl}/api/${path}`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      ...(current.token ? { Authorization: `Bearer ${current.token}` } : {}),
    },
    body: form,
  });
  const payload: unknown = await response.json().catch(() => null);
  if (
    !response.ok ||
    (isRecord(payload) &&
      ["0", "2"].includes(normalizeApiStatus(payload as ApiEnvelope)))
  ) {
    throw new Error(message(payload, `Request failed (${response.status}).`));
  }
  return isRecord(payload) ? payload : {};
}

const dataRows = (payload: UnknownRecord): UnknownRecord[] => records(payload.data);

// ---------------------------------------------------------------------------
// Mappers (snake_case API -> camelCase UI types)
// ---------------------------------------------------------------------------

function toStudent(row: UnknownRecord): AssignmentStudent {
  return {
    id: readNumber(row.id),
    studentName: readString(row.student_name).trim(),
    enrollmentNo: readString(row.enrollment_no),
    gender: readString(row.gender),
    mobile: readString(row.mobile),
    standardId: readNumber(row.standard_id),
    standardName: readString(row.standard_name),
    divisionId: readNumber(row.division_id),
    divisionName: readString(row.division_name),
  };
}

function toExamPaper(row: UnknownRecord): ExamPaper {
  return {
    id: readNumber(row.id),
    paperName: readString(row.paper_name),
    pdfName: readString(row.pdf_name),
    totalMarks: readNumber(row.total_marks),
  };
}

function toSubmissionRow(row: UnknownRecord): AssignmentSubmissionRow {
  return {
    id: readNumber(row.id),
    subjectName: readString(row.subject_name),
    title: readString(row.title),
    description: readString(row.description),
    createdDate: readString(row.created_date),
    submissionDate: readString(row.submission_date),
    examPdf: readString(row.exam_pdf),
    submissionImage: readString(row.submission_image),
    studentSubmissionStatus: readString(row.student_submission_status) || "N",
    teacherRemarks: readString(row.teacher_remarks),
    teacherSubmissionStatus: readString(row.teacher_submission_status) || "N",
    studentId: readNumber(row.student_id),
    examId: readNumber(row.exam_id),
  };
}

function toAnnotateRow(row: UnknownRecord): AnnotateRow {
  return {
    id: readNumber(row.id),
    standardName: readString(row.standard_name),
    studentName: readString(row.student_name).trim(),
    subjectName: readString(row.subject_name),
    title: readString(row.title),
    createdDate: readString(row.created_date),
    submissionDate: readString(row.submission_date),
    examPdf: readString(row.exam_pdf),
    submissionImage: readString(row.submission_image),
    studentSubmissionStatus: readString(row.student_submission_status) || "N",
    teacherSubmissionStatus: readString(row.teacher_submission_status) || "N",
    studentId: readNumber(row.student_id),
    examId: readNumber(row.exam_id),
  };
}

function toReviewQuestion(row: UnknownRecord): ReviewQuestion {
  return {
    id: readNumber(row.id),
    questionName: readString(row.question_name),
    questionTypeId: readNumber(row.question_type_id),
    points: readNumber(row.points),
  };
}

function toReviewDetail(payload: UnknownRecord): ReviewDetail {
  const assignment = isRecord(payload.assignment) ? payload.assignment : {};
  const paper = isRecord(payload.paper) ? payload.paper : {};
  return {
    assignmentId: readNumber(assignment.id),
    studentId: readNumber(assignment.student_id),
    studentName: readString(assignment.student_name).trim(),
    title: readString(assignment.title),
    description: readString(assignment.description),
    submissionImage: readString(assignment.submission_image),
    teacherRemarks: readString(assignment.teacher_remarks),
    jsonAnnotation: readString(assignment.json_annotation),
    paperId: readNumber(paper.id),
    paperName: readString(paper.paper_name),
    totalMarks: readNumber(paper.total_marks),
    questions: records(payload.questions).map(toReviewQuestion),
  };
}

// ---------------------------------------------------------------------------
// Feature 1 — Assignment (create)
// ---------------------------------------------------------------------------

/** Students for the selectable table, scoped by grade/standard/division. */
export async function listAssignmentStudents(
  filters: AssignmentFilters
): Promise<AssignmentStudent[]> {
  const payload = await postJson("lms-assignment/students", {
    grade: filters.grade || null,
    standard: filters.standard || null,
    division: filters.division || null,
  });
  return dataRows(payload).map(toStudent);
}

/** Offline exam question papers for the chosen subject. */
export async function listExamPapers(subjectId: string): Promise<ExamPaper[]> {
  const payload = await postJson("lms-assignment/exam-papers", {
    subject_id: subjectId || null,
    exam_type: "offline",
  });
  return dataRows(payload).map(toExamPaper);
}

export async function createAssignment(input: {
  studentIds: number[];
  title: string;
  description: string;
  submissionDate: string;
  standardId: string;
  divisionId: string;
  subjectId: string;
  examId: string;
  examPdf: string;
}): Promise<number> {
  const payload = await postMultipart("lms-assignment/store", (form) => {
    form.append("students", input.studentIds.join(","));
    form.append("title", input.title);
    form.append("description", input.description);
    form.append("submission_date", input.submissionDate);
    form.append("standard_id", input.standardId);
    form.append("division_id", input.divisionId);
    form.append("subject_id", input.subjectId);
    form.append("exam_id", input.examId);
    form.append("exam_pdf", input.examPdf);
  });
  return records(payload.assignment_ids).length || input.studentIds.length;
}

// ---------------------------------------------------------------------------
// Feature 2 — Assignment Submission (student)
// ---------------------------------------------------------------------------

/** The signed-in student's assignments (backend scopes by student_id). */
export async function listMyAssignments(
  filters: AssignmentFilters & { submissionDate?: string } = {}
): Promise<AssignmentSubmissionRow[]> {
  const payload = await postJson("lms-assignment/submission-list", {
    grade: filters.grade || null,
    standard: filters.standard || null,
    division: filters.division || null,
    subject: filters.subject || null,
    submission_date: filters.submissionDate || null,
  });
  return dataRows(payload).map(toSubmissionRow);
}

export type AssignmentSubmissionInput = {
  assignmentId: number;
  file: File | null;
};

export async function submitAssignments(
  items: AssignmentSubmissionInput[]
): Promise<number> {
  const payload = await postMultipart("lms-assignment/submission-store", (form) => {
    items.forEach((item) => {
      form.append("students[]", String(item.assignmentId));
      if (item.file) form.append(`image[${item.assignmentId}]`, item.file);
    });
  });
  return readNumber(payload.updated);
}

// ---------------------------------------------------------------------------
// Feature 3 — Annotate / Review Assignment (teacher)
// ---------------------------------------------------------------------------

export async function listReviewAssignments(
  filters: ReviewFilters
): Promise<AnnotateRow[]> {
  const payload = await postJson("lms-assignment/review-list", {
    grade: filters.grade || null,
    standard: filters.standard || null,
    division: filters.division || null,
    subject: filters.subject || null,
    from_date: filters.fromDate || null,
    to_date: filters.toDate || null,
    teacher_submission_status: filters.teacherStatus || null,
  });
  return dataRows(payload).map(toAnnotateRow);
}

export async function getReviewDetail(
  assignmentId: number
): Promise<ReviewDetail> {
  const payload = await postJson("lms-assignment/review-detail", {
    assignment_id: assignmentId,
  });
  return toReviewDetail(payload);
}

export async function saveReview(input: {
  assignmentId: number;
  studentId: number;
  paperId: number;
  marks: Record<number, number>; // questionId -> marks
  teacherRemarks: string;
  jsonAnnotation?: string;
}): Promise<number> {
  const questions: Record<string, number> = {};
  Object.entries(input.marks).forEach(([questionId, marks]) => {
    questions[questionId] = marks;
  });
  const payload = await postJson("lms-assignment/review-store", {
    hid_assignment_id: input.assignmentId,
    hid_student_id: input.studentId,
    hid_question_paper_id: input.paperId,
    questions,
    teacher_remarks: input.teacherRemarks,
    json_annotation: input.jsonAnnotation || null,
  });
  return readNumber(payload.obtain_marks);
}
