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
// (Module 2: student Assignment Submission)
// ---------------------------------------------------------------------------

export type AssignmentSubmissionRow = {
  id: number;
  subjectName: string;
  title: string;
  description: string;
  assignedOn: string;
  submissionDate: string;
  examPdfUrl: string;
  submissionFileUrl: string;
  teacherRemarks: string;
  studentSubmitted: boolean;
  teacherReviewed: boolean;
  examId: number;
  studentId: number;
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

/**
 * Multipart POST directly to the backend (bypasses the proxy, which serialises
 * bodies as text and would corrupt binary uploads). Mirrors homework/api.ts.
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

const dataRows = (payload: UnknownRecord): UnknownRecord[] => records(payload.data);

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

function toSubmission(row: UnknownRecord): AssignmentSubmissionRow {
  return {
    id: readNumber(row.id),
    subjectName: readString(row.subject_name),
    title: readString(row.title),
    description: readString(row.description),
    assignedOn: readString(row.created_date_fmt),
    submissionDate: readString(row.submission_date_fmt),
    examPdfUrl: readString(row.exam_pdf_url),
    submissionFileUrl: readString(row.submission_file_url),
    teacherRemarks: readString(row.teacher_remarks),
    studentSubmitted: readString(row.student_submission_status) === "Y",
    teacherReviewed: readString(row.teacher_submission_status) === "Y",
    examId: readNumber(row.exam_id),
    studentId: readNumber(row.student_id),
  };
}

// ---------------------------------------------------------------------------
// Module 2 — Assignment Submission (student)
// ---------------------------------------------------------------------------

/** The logged-in student's assignments (submitted + pending). */
export async function listAssignmentSubmissions(): Promise<AssignmentSubmissionRow[]> {
  const payload = await postJson("lms-assignment/submission-list", {});
  return dataRows(payload).map(toSubmission);
}

export type SubmissionUpload = {
  assignmentId: number;
  file: File;
};

/** Upload one file per assignment; returns the number of rows updated. */
export async function submitAssignments(
  uploads: SubmissionUpload[]
): Promise<number> {
  if (uploads.length === 0) return 0;
  const payload = await postMultipart("lms-assignment/submission-store", (form) => {
    uploads.forEach((item) => {
      form.append(`image[${item.assignmentId}]`, item.file);
    });
  });
  return readNumber(payload.updated) || uploads.length;
}
