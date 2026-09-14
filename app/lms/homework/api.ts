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
// Feature 5 — Homework detail, submission (multi-file), teacher review
// ---------------------------------------------------------------------------

export type HomeworkSubmissionFile = {
  id: string;
  filePath: string;
  fileUrl: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
};

/** One attempt on `homework_submissions` (attempt_number, status, AI + teacher review fields). */
export type HomeworkSubmissionRecord = {
  id: number;
  attemptNumber: number;
  /** "Pending" | "Submitted" | "Under Review" | "Reviewed" | "Rejected" */
  status: string;
  submissionRemarks: string;
  teacherRemarks: string;
  /** "" | "Checking" | "Evaluated" | "OCR Failed" | "Evaluation Failed" | "Failed" */
  aiStatus: string;
  aiFailureReason: string;
  aiScore: number | null;
  aiTotalQuestions: number | null;
  aiPercentage: number | null;
  reviewedPdfPath: string;
  evaluatedAt: string;
  feedbackPublished: boolean;
  submittedAt: string;
  submittedAtFmt: string;
  files: HomeworkSubmissionFile[];
};

/** One row of the student "my submissions" table — homework info + its own submission/status in one flat object (mirrors the LMS Assignment submission table's row shape). */
export type MySubmissionRow = {
  id: number;
  title: string;
  subjectName: string;
  date: string;
  dateFmt: string;
  submissionDate: string;
  submissionDateFmt: string;
  referenceFileUrl: string;
  sourceType: string;
  status: string;
  submissionRemarks: string;
  teacherRemarks: string;
  aiStatus: string;
  aiFailureReason: string;
  aiScore: number | null;
  aiTotalQuestions: number | null;
  aiPercentage: number | null;
  evaluatedAt: string;
  feedbackPublished: boolean;
  files: HomeworkSubmissionFile[];
};

export type HomeworkDetailInfo = {
  id: number;
  title: string;
  description: string;
  subjectId: number;
  subjectName: string;
  standardId: number;
  divisionId: number;
  date: string;
  dateFmt: string;
  submissionDate: string;
  submissionDateFmt: string;
  teacherName: string;
  referenceFileUrl: string;
  /** "question_bank" when this homework was assigned from the question bank, otherwise the default attachment flow. */
  sourceType?: string;
  /** Present only for `sourceType === "question_bank"` homework. */
  questions?: HomeworkQuestion[];
};

// ---------------------------------------------------------------------------
// Feature 6 — Homework from question bank (chapters, question types, questions)
// ---------------------------------------------------------------------------

export type HomeworkChapter = {
  id: number;
  name: string;
};

export type HomeworkQuestionType = {
  id: number;
  label: string;
};

export type HomeworkQuestion = {
  id: number;
  title: string;
  description: string;
  questionTypeId: number;
  points: number;
  chapterId: number;
};

export type HomeworkDetail = {
  homework: HomeworkDetailInfo;
  submissions: HomeworkSubmissionRecord[];
};

export type ReviewQueueRow = {
  submissionId: number;
  homeworkId: number;
  studentId: number;
  studentName: string;
  rollNo: string;
  standard: string;
  division: string;
  subject: string;
  title: string;
  status: string;
  aiStatus: string;
  aiScore: number | null;
  aiPercentage: number | null;
  submittedAt: string;
  submittedAtFmt: string;
  attemptNumber: number;
};

export type ReviewPreviousAttempt = {
  id: number;
  attemptNumber: number;
  status: string;
  submittedAtFmt: string;
};

export type ReviewDetail = {
  homework: HomeworkDetailInfo;
  submission: HomeworkSubmissionRecord;
  files: HomeworkSubmissionFile[];
  previousAttempts: ReviewPreviousAttempt[];
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

function toSubmissionFile(row: UnknownRecord): HomeworkSubmissionFile {
  return {
    id: readString(row.id),
    filePath: readString(row.file_path),
    fileUrl: readString(row.file_url),
    originalName: readString(row.original_name),
    mimeType: readString(row.mime_type),
    fileSize: readNumber(row.file_size),
  };
}

function toHomeworkSubmissionRecord(row: UnknownRecord): HomeworkSubmissionRecord {
  return {
    id: readNumber(row.id),
    attemptNumber: readNumber(row.attempt_number),
    status: readString(row.status),
    submissionRemarks: readString(row.submission_remarks),
    teacherRemarks: readString(row.teacher_remarks),
    aiStatus: readString(row.ai_status),
    aiFailureReason: readString(row.ai_failure_reason),
    aiScore: readNullableNumber(row.ai_score),
    aiTotalQuestions: readNullableNumber(row.ai_total_questions),
    aiPercentage: readNullableNumber(row.ai_percentage),
    reviewedPdfPath: readString(row.reviewed_pdf_path),
    evaluatedAt: readString(row.evaluated_at),
    feedbackPublished: Boolean(row.feedback_published) && row.feedback_published !== "0",
    submittedAt: readString(row.submitted_at),
    submittedAtFmt: readString(row.submitted_at_fmt),
    files: records(row.files).map(toSubmissionFile),
  };
}

function toMySubmissionRow(row: UnknownRecord): MySubmissionRow {
  return {
    id: readNumber(row.id),
    title: readString(row.title),
    subjectName: readString(row.subject_name),
    date: readString(row.date),
    dateFmt: readString(row.date_fmt),
    submissionDate: readString(row.submission_date),
    submissionDateFmt: readString(row.submission_date_fmt),
    referenceFileUrl: readString(row.reference_file_url),
    sourceType: readString(row.source_type),
    status: readString(row.status),
    submissionRemarks: readString(row.submission_remarks),
    teacherRemarks: readString(row.teacher_remarks),
    aiStatus: readString(row.ai_status),
    aiFailureReason: readString(row.ai_failure_reason),
    aiScore: readNullableNumber(row.ai_score),
    aiTotalQuestions: readNullableNumber(row.ai_total_questions),
    aiPercentage: readNullableNumber(row.ai_percentage),
    evaluatedAt: readString(row.evaluated_at),
    feedbackPublished: Boolean(row.feedback_published) && row.feedback_published !== "0",
    files: records(row.submission_files ?? row.files).map(toSubmissionFile),
  };
}

function toHomeworkChapter(row: UnknownRecord): HomeworkChapter {
  return {
    id: readNumber(row.id),
    name: readString(row.chapter_name ?? row.name),
  };
}

function toHomeworkQuestionType(row: UnknownRecord): HomeworkQuestionType {
  return {
    id: readNumber(row.id),
    label: readString(row.questionType ?? row.question_type ?? row.label),
  };
}

function toHomeworkQuestion(row: UnknownRecord): HomeworkQuestion {
  return {
    id: readNumber(row.id),
    title: readString(row.question_title ?? row.title),
    description: readString(row.description),
    questionTypeId: readNumber(row.question_type_id),
    points: readNumber(row.points),
    chapterId: readNumber(row.chapter_id),
  };
}

function toHomeworkDetailInfo(row: UnknownRecord): HomeworkDetailInfo {
  return {
    id: readNumber(row.id),
    title: readString(row.title),
    description: readString(row.description),
    subjectId: readNumber(row.subject_id),
    subjectName: readString(row.subject_name),
    standardId: readNumber(row.standard_id),
    divisionId: readNumber(row.division_id),
    date: readString(row.date),
    dateFmt: readString(row.date_fmt),
    submissionDate: readString(row.submission_date),
    submissionDateFmt: readString(row.submission_date_fmt),
    teacherName: readString(row.teacher_name),
    referenceFileUrl: readString(row.reference_file_url),
    sourceType: readString(row.source_type ?? row.sourceType),
    questions: records(row.questions).map(toHomeworkQuestion),
  };
}

function toReviewQueueRow(row: UnknownRecord): ReviewQueueRow {
  return {
    submissionId: readNumber(row.submission_id),
    homeworkId: readNumber(row.homework_id),
    studentId: readNumber(row.student_id),
    studentName: readString(row.student_name).trim(),
    rollNo: readString(row.roll_no),
    standard: readString(row.standard),
    division: readString(row.division),
    subject: readString(row.subject),
    title: readString(row.title),
    status: readString(row.status),
    aiStatus: readString(row.ai_status),
    aiScore: readNullableNumber(row.ai_score),
    aiPercentage: readNullableNumber(row.ai_percentage),
    submittedAt: readString(row.submitted_at),
    submittedAtFmt: readString(row.submitted_at_fmt),
    attemptNumber: readNumber(row.attempt_number),
  };
}

function toReviewPreviousAttempt(row: UnknownRecord): ReviewPreviousAttempt {
  return {
    id: readNumber(row.id),
    attemptNumber: readNumber(row.attempt_number),
    status: readString(row.status),
    submittedAtFmt: readString(row.submitted_at_fmt),
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
  /** Optional: assigns homework from the question bank instead of an uploaded attachment. */
  sourceType?: "attachment" | "question_bank";
  /** Optional: question-bank question ids, required when `sourceType === "question_bank"`. */
  questionIds?: number[];
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
    if (input.sourceType) form.append("source_type", input.sourceType);
    if (input.questionIds) {
      input.questionIds.forEach((id) => form.append("question_ids[]", String(id)));
    }
  });
  return records(payload.homework_ids).length || input.studentIds.length;
}

/** Question-bank chapters scoped to a standard+subject (also used by other LMS modules). */
export async function listHomeworkChapters(params: {
  standardId: string;
  subjectId?: string;
}): Promise<HomeworkChapter[]> {
  const payload = await postJson("lms-chapters", {
    standard_id: params.standardId,
    subject_id: params.subjectId || null,
  });
  return dataRows(payload).map(toHomeworkChapter);
}

/** Question-bank question types available for the current academic year. */
export async function listHomeworkQuestionTypes(): Promise<HomeworkQuestionType[]> {
  const payload = await postJson("lms-homework/question-bank/types", {});
  return dataRows(payload).map(toHomeworkQuestionType);
}

/** Question-bank questions filtered by subject, standard, chapters and question types. */
export async function listHomeworkQuestions(params: {
  subjectId: string;
  standardId: string;
  chapterIds: number[];
  questionTypeIds: number[];
}): Promise<HomeworkQuestion[]> {
  const payload = await postJson("lms-homework/question-bank/questions", {
    subject_id: params.subjectId,
    standard_id: params.standardId,
    chapter_id: params.chapterIds,
    question_type_id: params.questionTypeIds,
  });
  return dataRows(payload).map(toHomeworkQuestion);
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

// ---------------------------------------------------------------------------
// Feature 5 — Homework detail, student submission (multi-file), teacher review
// ---------------------------------------------------------------------------

/** Loads one homework's full detail (assignment info + every submission attempt). */
export async function getHomeworkDetail(homeworkId: number): Promise<HomeworkDetail> {
  const payload = await postJson(`lms-homework/detail/${homeworkId}`, {});
  const data = isRecord(payload.data) ? payload.data : {};
  const homework = isRecord(data.homework) ? data.homework : {};
  return {
    homework: toHomeworkDetailInfo(homework),
    submissions: records(data.submissions).map(toHomeworkSubmissionRecord),
  };
}

/**
 * Uploads a student's homework submission (multi-file). Uses XMLHttpRequest
 * (not fetch) so xhr.upload.onprogress can report real upload progress via
 * onProgress. Mirrors postMultipart's URL resolution and auth headers.
 */
export async function submitHomeworkSubmission(params: {
  homeworkId: number;
  remarks: string;
  files: File[];
  onProgress?: (percent: number) => void;
}): Promise<HomeworkSubmissionRecord> {
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
  form.append("homework_id", String(params.homeworkId));
  form.append("remarks", params.remarks);
  params.files.forEach((file) => form.append("files[]", file));

  const payload = await new Promise<UnknownRecord>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${current.baseUrl}/api/lms-homework/submission/store`);
    xhr.setRequestHeader("Accept", "application/json");
    if (current.token) {
      xhr.setRequestHeader("Authorization", `Bearer ${current.token}`);
    }
    if (xhr.upload && params.onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          params.onProgress?.(Math.round((event.loaded / event.total) * 100));
        }
      };
    }
    xhr.onload = () => {
      let parsed: unknown = null;
      try {
        parsed = xhr.responseText ? JSON.parse(xhr.responseText) : null;
      } catch {
        parsed = null;
      }
      const parsedRecord = isRecord(parsed) ? parsed : {};
      if (
        xhr.status < 200 ||
        xhr.status >= 300 ||
        ["0", "2"].includes(normalizeApiStatus(parsedRecord as ApiEnvelope))
      ) {
        reject(new Error(message(parsed, `Request failed (${xhr.status}).`)));
        return;
      }
      resolve(parsedRecord);
    };
    xhr.onerror = () => reject(new Error("Network error while uploading the submission."));
    xhr.send(form);
  });

  const data = isRecord(payload.data) ? payload.data : {};
  const submission = isRecord(data.submission) ? data.submission : {};
  return toHomeworkSubmissionRecord(submission);
}

/** Polls the AI evaluation status/result for one homework submission attempt. */
export async function getSubmissionAiStatus(
  submissionId: number
): Promise<HomeworkSubmissionRecord> {
  const payload = await postJson(`lms-homework/submission/ai-status/${submissionId}`, {});
  const data = isRecord(payload.data) ? payload.data : {};
  return toHomeworkSubmissionRecord({ id: submissionId, ...data });
}

/** The logged-in student's own homework, each row flattened with its current submission/AI/status. */
export async function listMySubmissions(): Promise<MySubmissionRow[]> {
  const payload = await postJson("lms-homework/my-submissions", {});
  return dataRows(payload).map(toMySubmissionRow);
}

/** Teacher review queue: all homework submissions awaiting/under review. */
export async function listReviewQueue(params?: {
  status?: string;
}): Promise<ReviewQueueRow[]> {
  const payload = await postJson("lms-homework/review-list", {
    status: params?.status || null,
  });
  return dataRows(payload).map(toReviewQueueRow);
}

/** Loads one submission's full review detail (homework + submission + files + previous attempts). */
export async function getReviewDetail(submissionId: number): Promise<ReviewDetail> {
  const payload = await postJson(`lms-homework/review-detail/${submissionId}`, {});
  const data = isRecord(payload.data) ? payload.data : {};
  const homework = isRecord(data.homework) ? data.homework : {};
  const submission = isRecord(data.submission) ? data.submission : {};
  return {
    homework: toHomeworkDetailInfo(homework),
    submission: toHomeworkSubmissionRecord(submission),
    files: records(data.files).map(toSubmissionFile),
    previousAttempts: records(data.previous_attempts).map(toReviewPreviousAttempt),
  };
}

/** Saves the teacher's review decision (remarks, status, publish-to-student flag). */
export async function submitReview(params: {
  submissionId: number;
  teacherRemarks: string;
  status: string;
  publish: boolean;
}): Promise<HomeworkSubmissionRecord> {
  const payload = await postJson("lms-homework/review-store", {
    submission_id: params.submissionId,
    teacher_remarks: params.teacherRemarks,
    status: params.status,
    publish: params.publish,
  });
  const data = isRecord(payload.data) ? payload.data : {};
  return toHomeworkSubmissionRecord(data);
}
