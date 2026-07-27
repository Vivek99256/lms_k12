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
// Shared types — mirror the Laravel `lms_assignment` / `question_paper` /
// `lms_question_master` tables (Module 3: teacher Annotate Assignment)
// ---------------------------------------------------------------------------

export type AnnotateRow = {
  id: number;
  standardName: string;
  studentName: string;
  subjectName: string;
  title: string;
  assignedOn: string;
  submissionDate: string;
  examPdfUrl: string;
  submissionFileUrl: string;
  studentSubmitted: boolean;
  teacherReviewed: boolean;
  studentId: number;
  examId: number;
};

export type ReviewQuestion = {
  id: number;
  points: number;
  isMcq: boolean;
};

export type ReviewContext = {
  assignmentId: number;
  studentId: number;
  questionPaperId: number;
  paperName: string;
  totalMarks: number;
  title: string;
  studentName: string;
  submissionFileUrl: string;
  teacherReviewed: boolean;
  questions: ReviewQuestion[];
};

// ---------------------------------------------------------------------------
// Session helpers (identical contract to app/lms/homework/api.ts)
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

const dataRows = (payload: UnknownRecord): UnknownRecord[] => records(payload.data);

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

function toAnnotateRow(row: UnknownRecord): AnnotateRow {
  return {
    id: readNumber(row.id),
    standardName: readString(row.standard_name),
    studentName: readString(row.student_name).trim(),
    subjectName: readString(row.subject_name),
    title: readString(row.title),
    assignedOn: readString(row.created_date_fmt),
    submissionDate: readString(row.submission_date_fmt),
    examPdfUrl: readString(row.exam_pdf_url),
    submissionFileUrl: readString(row.submission_file_url),
    studentSubmitted: readString(row.student_submission_status) === "Y",
    teacherReviewed: readString(row.teacher_submission_status) === "Y",
    studentId: readNumber(row.student_id),
    examId: readNumber(row.exam_id),
  };
}

// ---------------------------------------------------------------------------
// Module 3 — Annotate Assignment (teacher)
// ---------------------------------------------------------------------------

/** All assignments for the teacher's annotate/review list. */
export async function listAnnotateAssignments(filters?: {
  standardId?: string;
  divisionId?: string;
  subjectId?: string;
}): Promise<AnnotateRow[]> {
  const payload = await postJson("lms-assignment/annotate-list", {
    standard_id: filters?.standardId || null,
    division_id: filters?.divisionId || null,
    subject_id: filters?.subjectId || null,
  });
  return dataRows(payload).map(toAnnotateRow);
}

/** Load one assignment's question paper + questions for the grading screen. */
export async function getReviewContext(
  assignmentId: number
): Promise<ReviewContext> {
  const payload = await postJson("lms-assignment/annotate-questions", {
    assignment_id: assignmentId,
  });
  const data = isRecord(payload.data) ? payload.data : {};
  const assignment = isRecord(data.assignment) ? data.assignment : {};
  const paper = isRecord(data.question_paper) ? data.question_paper : {};
  const questions = records(data.questions).map<ReviewQuestion>((q) => ({
    id: readNumber(q.id),
    points: readNumber(q.points),
    isMcq: readNumber(q.question_type_id) === 1,
  }));

  return {
    assignmentId: readNumber(assignment.id) || assignmentId,
    studentId: readNumber(assignment.student_id),
    questionPaperId: readNumber(paper.id),
    paperName: readString(paper.paper_name),
    totalMarks: readNumber(paper.total_marks),
    title: readString(assignment.title),
    studentName: readString(assignment.student_name).trim(),
    submissionFileUrl: readString(assignment.submission_file_url),
    teacherReviewed: readString(assignment.teacher_submission_status) === "Y",
    questions,
  };
}

/** Save the teacher's per-question marks + remarks. Returns obtained marks. */
export async function submitAnnotation(input: {
  assignmentId: number;
  studentId: number;
  questionPaperId: number;
  marks: Record<number, number>;
  teacherRemarks: string;
}): Promise<number> {
  const payload = await postJson("lms-assignment/annotate-store", {
    hid_assignment_id: input.assignmentId,
    hid_student_id: input.studentId,
    hid_question_paper_id: input.questionPaperId,
    questions: input.marks,
    teacher_remarks: input.teacherRemarks,
  });
  return readNumber(payload.obtain_marks);
}
