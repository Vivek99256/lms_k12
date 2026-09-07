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
// Shared types (mirror the Laravel `homework` table / StudentHomeworkApiController)
// ---------------------------------------------------------------------------

export type HomeworkRecord = {
  id: number;
  title: string;
  description: string;
  date: string;
  submissionDate: string;
  studentId: number;
  studentName: string;
  standardId: number;
  standardName: string;
  divisionId: number;
  divisionName: string;
  subjectId: number;
  subjectName: string;
  image: string;
  type: string;
};

export type StudentRow = {
  id: number;
  studentName: string;
  enrollmentNo: string;
  gender: string;
  mobile: string;
  rollNo: string;
  standardId: number;
  standardName: string;
  divisionId: number;
  divisionName: string;
};

export type SubmissionRow = {
  id: number;
  rollNo: string;
  enrollmentNo: string;
  studentName: string;
  standard: string;
  division: string;
  mobile: string;
  title: string;
  description: string;
  image: string;
  homeworkDate: string;
  submissionDate: string;
  submissionRemarks: string;
};

export type SubmissionReportRow = {
  id: number;
  enrollmentNo: string;
  studentName: string;
  stdDiv: string;
  mobile: string;
  homeworkDate: string;
  title: string;
  description: string;
  image: string;
  submissionDate: string;
  submissionRemarks: string;
  submissionTakenBy: string;
  submissionFile: string;
  aiGeneratedFile: string;
  completionStatus: string;
  /** "Checking" | "Evaluated" | "OCR Failed" | "Evaluation Failed" | "Failed" | "" (not yet submitted) */
  aiStatus: string;
  aiFailureReason: string;
  aiScore: number | null;
  aiTotalQuestions: number | null;
  aiPercentage: number | null;
  reviewedPdfUrl: string;
  evaluatedAt: string;
};

export type AiEvaluationStatus = {
  id: number;
  aiStatus: string;
  aiFailureReason: string;
  aiScore: number | null;
  aiTotalQuestions: number | null;
  aiPercentage: number | null;
  reviewedPdfUrl: string;
  submissionRemarks: string;
  evaluatedAt: string;
};

export type HomeworkFilters = {
  grade?: string;
  standard?: string;
  division?: string;
  subject?: string;
  fromDate?: string;
  toDate?: string;
};

export type SubmissionReportFilters = HomeworkFilters & {
  status?: "" | "Y" | "N";
};

// ---------------------------------------------------------------------------
// Session helpers
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

/** Reads profile/name from the stored userData without adding them to SessionContext. */
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

function readNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
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
 * bodies as text and would corrupt binary uploads). Mirrors the direct-to-API
 * calls already used elsewhere in the app.
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

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

function toHomework(row: UnknownRecord): HomeworkRecord {
  return {
    id: readNumber(row.id),
    title: readString(row.title),
    description: readString(row.description),
    date: readString(row.date),
    submissionDate: readString(row.submission_date),
    studentId: readNumber(row.student_id),
    studentName: readString(row.student_name).trim(),
    standardId: readNumber(row.standard_id),
    standardName: readString(row.standard_name),
    divisionId: readNumber(row.division_id),
    divisionName: readString(row.division_name),
    subjectId: readNumber(row.subject_id),
    subjectName: readString(row.subject_name),
    image: readString(row.image),
    type: readString(row.type),
  };
}

function toStudent(row: UnknownRecord): StudentRow {
  return {
    id: readNumber(row.id),
    studentName: readString(row.student_name).trim(),
    enrollmentNo: readString(row.enrollment_no),
    gender: readString(row.gender),
    mobile: readString(row.mobile),
    rollNo: readString(row.roll_no),
    standardId: readNumber(row.standard_id),
    standardName: readString(row.standard_name),
    divisionId: readNumber(row.division_id),
    divisionName: readString(row.division_name),
  };
}

function toSubmission(row: UnknownRecord): SubmissionRow {
  return {
    id: readNumber(row.id),
    rollNo: readString(row.roll_no),
    enrollmentNo: readString(row.enrollment_no),
    studentName: readString(row.student_name).trim(),
    standard: readString(row.standard),
    division: readString(row.division),
    mobile: readString(row.mobile),
    title: readString(row.title),
    description: readString(row.description),
    image: readString(row.image),
    homeworkDate: readString(row.homework_date),
    submissionDate: readString(row.submission_date),
    submissionRemarks: readString(row.submission_remarks),
  };
}

function toSubmissionReport(row: UnknownRecord): SubmissionReportRow {
  return {
    id: readNumber(row.id),
    enrollmentNo: readString(row.enrollment_no),
    studentName: readString(row.student_name).trim(),
    stdDiv: readString(row.std_div),
    mobile: readString(row.mobile),
    homeworkDate: readString(row.homework_date),
    title: readString(row.title),
    description: readString(row.description),
    image: readString(row.image),
    submissionDate: readString(row.submission_date_fmt),
    submissionRemarks: readString(row.submission_remarks),
    submissionTakenBy: readString(row.submission_taken_by).trim(),
    submissionFile: readString(row.submission_file),
    aiGeneratedFile: readString(row.ai_generated_file),
    completionStatus: readString(row.completion_status),
    aiStatus: readString(row.ai_status),
    aiFailureReason: readString(row.ai_failure_reason),
    aiScore: readNullableNumber(row.ai_score),
    aiTotalQuestions: readNullableNumber(row.ai_total_questions),
    aiPercentage: readNullableNumber(row.ai_percentage),
    reviewedPdfUrl: readString(row.reviewed_pdf_path) || readString(row.ai_generated_file),
    evaluatedAt: readString(row.evaluated_at),
  };
}

function toAiEvaluationStatus(row: UnknownRecord): AiEvaluationStatus {
  return {
    id: readNumber(row.id),
    aiStatus: readString(row.ai_status),
    aiFailureReason: readString(row.ai_failure_reason),
    aiScore: readNullableNumber(row.ai_score),
    aiTotalQuestions: readNullableNumber(row.ai_total_questions),
    aiPercentage: readNullableNumber(row.ai_percentage),
    reviewedPdfUrl: readString(row.reviewed_pdf_path),
    submissionRemarks: readString(row.submission_remarks),
    evaluatedAt: readString(row.evaluated_at),
  };
}

const dataRows = (payload: UnknownRecord): UnknownRecord[] => records(payload.data);

// ---------------------------------------------------------------------------
// Feature 1 — Student Homework (assign) + list
// ---------------------------------------------------------------------------

export async function listStudents(filters: HomeworkFilters): Promise<StudentRow[]> {
  const payload = await postJson("lms-homework/students", {
    grade: filters.grade || null,
    standard: filters.standard || null,
    division: filters.division || null,
  });
  return dataRows(payload).map(toStudent);
}

export async function assignHomework(input: {
  studentIds: number[];
  title: string;
  description: string;
  submissionDate: string;
  standardId: string;
  divisionId: string;
  subjectId: string;
  prompt?: string;
  image?: File | null;
}): Promise<number> {
  const payload = await postMultipart("lms-homework/store", (form) => {
    form.append("students", input.studentIds.join(","));
    form.append("title", input.title);
    form.append("description", input.description);
    form.append("submission_date", input.submissionDate);
    form.append("standard_id", input.standardId);
    form.append("division_id", input.divisionId);
    form.append("subject_id", input.subjectId);
    if (input.prompt) form.append("prompt", input.prompt);
    if (input.image) form.append("image", input.image);
  });
  return records(payload.homework_ids).length || input.studentIds.length;
}

// ---------------------------------------------------------------------------
// Feature 3 — Student Homework Report
// ---------------------------------------------------------------------------

export async function listHomework(
  filters: HomeworkFilters
): Promise<HomeworkRecord[]> {
  const payload = await postJson("lms-homework/list", {
    grade: filters.grade || null,
    standard_id: filters.standard || null,
    division_id: filters.division || null,
    subject_id: filters.subject || null,
    from_date: filters.fromDate || null,
    to_date: filters.toDate || null,
    type: "Homework",
  });
  return dataRows(payload).map(toHomework);
}

export async function bulkDeleteHomework(ids: number[]): Promise<number> {
  const payload = await postJson("lms-homework/bulk-delete", {
    selected_students: ids.join(","),
  });
  return readNumber(payload.deleted);
}

// ---------------------------------------------------------------------------
// Feature 2 — Homework Submission (entry)
// ---------------------------------------------------------------------------

export async function listSubmissions(
  filters: HomeworkFilters & { submissionDate?: string }
): Promise<SubmissionRow[]> {
  const payload = await postJson("lms-homework/submission-list", {
    grade: filters.grade || null,
    standard: filters.standard || null,
    division: filters.division || null,
    subject: filters.subject || null,
    submission_date: filters.submissionDate || null,
  });
  return dataRows(payload).map(toSubmission);
}

export type SubmissionInput = {
  homeworkId: number;
  file: File | null;
  remark: string;
};

export async function submitHomework(items: SubmissionInput[]): Promise<number> {
  const payload = await postMultipart("lms-homework/submission-store", (form) => {
    items.forEach((item) => {
      form.append("students[]", String(item.homeworkId));
      form.append(`submission_remarks[${item.homeworkId}]`, item.remark);
      if (item.file) form.append(`image[${item.homeworkId}]`, item.file);
    });
  });
  return readNumber(payload.updated);
}

// ---------------------------------------------------------------------------
// Feature 4 — Student Homework Submission Report
// ---------------------------------------------------------------------------

export async function listSubmissionReport(
  filters: SubmissionReportFilters
): Promise<SubmissionReportRow[]> {
  const payload = await postJson("lms-homework/submission-report", {
    grade: filters.grade || null,
    standard: filters.standard || null,
    division: filters.division || null,
    subject: filters.subject || null,
    from_date: filters.fromDate || null,
    to_date: filters.toDate || null,
    status: filters.status || null,
  });
  return dataRows(payload).map(toSubmissionReport);
}

/** Polls the AI evaluation status/result for one homework submission (used to refresh "Checking..." rows). */
export async function getAiEvaluationStatus(
  homeworkId: number
): Promise<AiEvaluationStatus> {
  const payload = await postJson(`lms-homework/ai-status/${homeworkId}`, {});
  return toAiEvaluationStatus(isRecord(payload.data) ? payload.data : {});
}
