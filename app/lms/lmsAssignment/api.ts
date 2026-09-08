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
// Shared types — mirror the Laravel `lms_assignment` table / LmsAssignmentApiController
// ---------------------------------------------------------------------------

export type AssignmentStudentRow = {
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

export type ExamPaperRow = {
  id: number;
  paperName: string;
  totalMarks: number;
  pdfName: string;
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
  form.append("student_id", current.userId);
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

function toStudent(row: UnknownRecord): AssignmentStudentRow {
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

function toExamPaper(row: UnknownRecord): ExamPaperRow {
  return {
    id: readNumber(row.id),
    paperName: readString(row.paper_name),
    totalMarks: readNumber(row.total_marks),
    pdfName: readString(row.pdf_name),
  };
}

// ---------------------------------------------------------------------------
// Module 1 — Assignment (teacher create)
// ---------------------------------------------------------------------------

export async function listAssignmentStudents(filters: {
  grade?: string;
  standard?: string;
  division?: string;
}): Promise<AssignmentStudentRow[]> {
  const payload = await postJson("lms-assignment/students", {
    grade: filters.grade || null,
    standard: filters.standard || null,
    division: filters.division || null,
  });
  return dataRows(payload).map(toStudent);
}

export async function listExamPapers(subjectId: string): Promise<ExamPaperRow[]> {
  if (!subjectId) return [];
  const payload = await postJson("lms-assignment/exam-papers", {
    subject_id: subjectId,
  });
  return dataRows(payload).map(toExamPaper);
}

export async function createAssignment(input: {
  studentIds: number[];
  title: string;
  description: string;
  submissionDate: string;
  subjectId: string;
  examId: string;
  examPdf: string;
  assignmentSourceType?: "exam_paper" | "uploaded_homework";
  homeworkFile?: string;
}): Promise<number> {
  const payload = await postJson("lms-assignment/store", {
    students: input.studentIds.join(","),
    title: input.title,
    description: input.description,
    submission_date: input.submissionDate || null,
    subject_id: input.subjectId,
    exam_id: input.examId,
    exam_pdf: input.examPdf,
    assignment_source_type: input.assignmentSourceType ?? "exam_paper",
    homework_file: input.homeworkFile ?? null,
  });
  return readNumber(payload.count) || records(payload.assignment_ids).length || input.studentIds.length;
}

export async function uploadHomeworkFile(file: File): Promise<string> {
  const payload = await postMultipart("lms-assignment/upload-homework", (form) => {
    form.append("homework_file", file);
  });
  const filePath = readString(payload.file_path);
  if (!filePath) {
    throw new Error("Server did not return a file path.");
  }
  return filePath;
}
