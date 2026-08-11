/**
 * Module record registry — the single place that knows how to turn a backend
 * tool result into selectable records, how to turn a selected record back into
 * the next tool's structured input, and which existing module page a resolved
 * record should open.
 *
 * Everything here is derived from real backend rows. No record is ever
 * synthesised: if the backend did not return a field, it stays absent so the
 * conversation can ask for it instead of guessing.
 */

import type { WorkflowEntitySummary } from "./workflow-state";

export interface ModuleRecordExtraction {
  module: string;
  workflowId: string;
  intent: string;
  entities: WorkflowEntitySummary[];
  totalCount: number;
}

export interface ModuleNavigationTarget {
  route: string;
  query: Record<string, string | number>;
  label: string;
}

function readString(value: unknown) {
  if (typeof value === "string") {
    return value.trim();
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return "";
}

function readNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function pick(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = readString(record[key]);
    if (value) {
      return value;
    }
  }
  return "";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asRecordArray(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => Boolean(asRecord(item)))
    : [];
}

function compact(record: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(record).filter(([, value]) => {
      if (value == null) return false;
      if (typeof value === "string") return value.trim().length > 0;
      return true;
    })
  );
}

/* -------------------------------------------------------------------------- */
/* Record normalisers — backend row -> canonical module record                 */
/* -------------------------------------------------------------------------- */

/** Fees / students share the LMS student-row shape produced by the fee tools. */
export function normalizeStudentFeeRecord(row: Record<string, unknown>) {
  return compact({
    module: "fees",
    studentId: pick(row, ["studentId", "student_id", "id"]),
    studentName: pick(row, ["studentName", "student_name", "name", "fullName"]),
    standard: pick(row, ["standard", "standardName", "standard_name"]),
    division: pick(row, ["division", "divisionName", "division_name"]),
    grade: pick(row, ["grade", "gradeName", "grade_name"]),
    enrollmentNo: pick(row, ["enrollmentNo", "enrollment_no", "enrollment", "grNo", "grno"]),
    rollNo: pick(row, ["rollNo", "roll_no"]),
    mobileNo: pick(row, ["mobileNo", "mobile_no", "mobile"]),
    pendingFees: readNumber(row.pendingFees ?? row.pending_fees ?? row.remain),
  });
}

export function normalizeAdmissionRecord(row: Record<string, unknown>) {
  return compact({
    module: "admissions",
    id: pick(row, ["id", "enquiryId", "enquiry_id"]),
    enquiryId: pick(row, ["enquiryId", "enquiry_id", "id"]),
    enquiryNo: pick(row, ["enquiryNo", "enquiry_no"]),
    registrationId: pick(row, [
      "registrationId",
      "registration_id",
      "registrationEnquiryId",
      "registration_enquiry_id",
    ]),
    studentName: pick(row, ["studentName", "student_name", "fullName", "full_name"]),
    standard: pick(row, ["standard", "standardName", "standard_name"]),
    mobileNo: pick(row, ["mobile", "mobileNo", "mobile_no"]),
    status: pick(row, ["status"]),
    readiness: pick(row, ["readiness"]),
  });
}

export function normalizeHomeworkRecord(row: Record<string, unknown>) {
  return compact({
    module: "homework",
    homeworkId: pick(row, ["homeworkId", "homework_id", "id"]),
    title: pick(row, ["title", "homework_title"]),
    description: pick(row, ["description"]),
    date: pick(row, ["date", "homework_date", "created_date"]),
    submissionDate: pick(row, ["submissionDate", "submission_date"]),
    studentId: pick(row, ["studentId", "student_id"]),
    studentName: pick(row, ["studentName", "student_name"]),
    standardId: pick(row, ["standardId", "standard_id"]),
    standard: pick(row, ["standardName", "standard_name", "standard"]),
    divisionId: pick(row, ["divisionId", "division_id"]),
    division: pick(row, ["divisionName", "division_name", "division"]),
    subjectId: pick(row, ["subjectId", "subject_id"]),
    subject: pick(row, ["subjectName", "subject_name", "subject"]),
    gradeId: pick(row, ["gradeId", "grade_id", "grade"]),
  });
}

/* -------------------------------------------------------------------------- */
/* Tool result -> selectable entities                                          */
/* -------------------------------------------------------------------------- */

function toEntity(
  record: Record<string, unknown>,
  parts: { id: string; label: string; reference?: string; secondary?: string }
): WorkflowEntitySummary {
  return {
    id: parts.id,
    label: parts.label || "Unknown record",
    reference: parts.reference || undefined,
    secondary: parts.secondary || undefined,
    metadata: record,
  };
}

function extractStudentFeeEntities(rows: Array<Record<string, unknown>>) {
  return rows.map((row) => {
    const record = normalizeStudentFeeRecord(row);
    return toEntity(record, {
      id: readString(record.studentId),
      label: readString(record.studentName),
      reference: readString(record.enrollmentNo) || readString(record.rollNo),
      secondary: readString(record.standard),
    });
  });
}

function extractAdmissionEntities(rows: Array<Record<string, unknown>>) {
  return rows.map((row) => {
    const record = normalizeAdmissionRecord(row);
    return toEntity({ ...row, ...record }, {
      id: readString(record.id),
      label: readString(record.studentName),
      reference: readString(record.enquiryNo),
      secondary: readString(record.standard),
    });
  });
}

function extractHomeworkEntities(rows: Array<Record<string, unknown>>) {
  return rows.map((row) => {
    const record = normalizeHomeworkRecord(row);
    const secondary = [
      readString(record.standard),
      readString(record.division),
      readString(record.subject),
    ]
      .filter(Boolean)
      .join(" ");

    return toEntity(record, {
      id: readString(record.homeworkId),
      label: readString(record.title) || readString(record.studentName),
      reference: readString(record.homeworkId),
      secondary,
    });
  });
}

/**
 * Converts a raw tool result into the module's selectable records. Returns null
 * when the tool is not a record-producing tool, so callers can skip it.
 */
export function extractModuleRecords(
  toolName: string,
  result: unknown
): ModuleRecordExtraction | null {
  const payload = asRecord(result);
  if (!payload) {
    return null;
  }

  switch (toolName) {
    case "listFeesDefaulters":
    case "findStudentFeeRecord": {
      const rows = asRecordArray(payload.students);
      return {
        module: "fees",
        workflowId: "fee_collection",
        intent: "fee_collection",
        entities: extractStudentFeeEntities(rows),
        totalCount:
          readNumber(payload.totalCount) ?? rows.length,
      };
    }
    case "searchStudents": {
      const rows = asRecordArray(payload.students);
      return {
        module: "students",
        workflowId: "student_lookup",
        intent: "student_lookup",
        entities: extractStudentFeeEntities(rows),
        totalCount: readNumber(payload.totalCount) ?? rows.length,
      };
    }
    case "listAdmissionEnquiries": {
      const normalized = asRecord(payload.normalized);
      const rows = normalized
        ? asRecordArray(normalized.filteredEnquiries)
        : [];
      return {
        module: "admissions",
        workflowId: "admission_confirmation",
        intent: "confirm_admission",
        entities: extractAdmissionEntities(rows),
        totalCount: rows.length,
      };
    }
    case "findAdmissionCandidate":
    case "updateAdmissionCandidateDetails": {
      const rows = asRecordArray(payload.candidates);
      const single = asRecord(payload.candidate);
      const all = rows.length > 0 ? rows : single ? [single] : [];
      return {
        module: "admissions",
        workflowId: "admission_confirmation",
        intent: "confirm_admission",
        entities: extractAdmissionEntities(all),
        totalCount: readNumber(payload.totalCount) ?? all.length,
      };
    }
    case "listHomework": {
      const rows =
        asRecordArray(payload.data).length > 0
          ? asRecordArray(payload.data)
          : asRecordArray(payload.homework);
      return {
        module: "homework",
        workflowId: "homework_review",
        intent: "homework_review",
        entities: extractHomeworkEntities(rows),
        totalCount: readNumber(payload.count) ?? rows.length,
      };
    }
    default:
      return null;
  }
}

/* -------------------------------------------------------------------------- */
/* Selected record -> next tool input                                          */
/* -------------------------------------------------------------------------- */

function dedupeCandidates(candidates: Array<Record<string, unknown>>) {
  const seen = new Set<string>();
  const result: Array<Record<string, unknown>> = [];

  for (const candidate of candidates) {
    const cleaned = compact(candidate);
    if (Object.keys(cleaned).length === 0) {
      continue;
    }
    const key = JSON.stringify(
      Object.keys(cleaned)
        .sort()
        .map((name) => [name, cleaned[name]])
    );
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(cleaned);
  }

  return result;
}

/**
 * Projects an already-resolved backend record onto the input schema of the next
 * tool. Returns progressively looser candidates (most specific first) so the
 * executor can retry with fewer filters instead of asking the user again for
 * information the conversation already holds.
 */
export function buildToolInputCandidates(
  toolName: string,
  record: Record<string, unknown> | null | undefined
): Array<Record<string, unknown>> {
  if (!record) {
    return [];
  }

  const studentName = pick(record, ["studentName", "student_name", "label", "fullName"]);
  const standard = pick(record, ["standard", "standardName", "standard_name", "secondary"]);
  const division = pick(record, ["division", "divisionName", "division_name"]);
  const grade = pick(record, ["grade", "gradeId", "grade_id"]);
  const enrollmentNo = pick(record, [
    "enrollmentNo",
    "enrollment_no",
    "enrollment",
    "grNo",
    "grno",
    "reference",
  ]);
  const rollNo = pick(record, ["rollNo", "roll_no"]);
  const mobileNo = pick(record, ["mobileNo", "mobile_no", "mobile"]);
  const studentId = pick(record, ["studentId", "student_id", "id"]);
  const enquiryId = pick(record, ["enquiryId", "enquiry_id", "id"]);
  const enquiryNo = pick(record, ["enquiryNo", "enquiry_no", "reference"]);
  const admissionId = pick(record, ["id", "registrationId", "registration_id"]);

  switch (toolName) {
    case "findStudentFeeRecord":
      return dedupeCandidates([
        { studentName, standard, division, enrollmentNo, rollNo, mobileNo },
        { studentName, enrollmentNo, mobileNo },
        { enrollmentNo },
        { studentName },
      ]);
    case "getStudentFeeDetails":
      return dedupeCandidates([{ studentId }]);
    case "searchStudents":
      return dedupeCandidates([
        { studentName, standard, division, enrollmentNo, rollNo, mobileNo },
        { studentName, enrollmentNo },
        { studentName },
      ]);
    case "findAdmissionCandidate":
      return dedupeCandidates([
        { studentName, enquiryNo, standard, onlyPending: true },
        { studentName, enquiryNo, onlyPending: true },
        { studentName, onlyPending: true },
      ]);
    case "hydrateAdmissionCandidate":
      return dedupeCandidates([{ enquiryId }]);
    case "updateAdmissionCandidateDetails":
      return dedupeCandidates([
        { id: admissionId, studentName, enquiryNo, standard },
      ]);
    case "confirmAdmissionCandidate":
      return dedupeCandidates([
        { id: admissionId, enquiryId },
      ]);
    case "listHomework": {
      const date = pick(record, ["date", "homework_date"]);
      return dedupeCandidates([
        {
          grade,
          standard: pick(record, ["standardId", "standard_id"]) || standard,
          division: pick(record, ["divisionId", "division_id"]) || division,
          subject: pick(record, ["subjectId", "subject_id"]),
          fromDate: date,
          toDate: date,
        },
        {
          standard: pick(record, ["standardId", "standard_id"]) || standard,
          division: pick(record, ["divisionId", "division_id"]) || division,
        },
      ]);
    }
    default:
      return [];
  }
}

/* -------------------------------------------------------------------------- */
/* Selected record -> existing module page                                     */
/* -------------------------------------------------------------------------- */

/**
 * Maps a resolved record onto the existing module route that should be opened.
 * Only real application routes are used; when the record does not carry the
 * identifier that route needs, null is returned so the conversation keeps
 * working instead of navigating somewhere useless.
 */
export function buildRecordNavigation(
  module: string | undefined,
  record: Record<string, unknown> | null | undefined
): ModuleNavigationTarget | null {
  if (!record) {
    return null;
  }

  switch ((module || "").toLowerCase()) {
    case "fees": {
      const studentId = pick(record, ["studentId", "student_id", "id"]);
      if (!studentId) {
        return null;
      }
      return {
        route: `/fees/collect/${encodeURIComponent(studentId)}`,
        query: {},
        label: "Continue to Fee Collection",
      };
    }
    case "admissions": {
      const enquiryId = pick(record, ["enquiryId", "enquiry_id", "enquiryNo", "enquiry_no", "id"]);
      const registrationId = pick(record, [
        "registrationId",
        "registration_id",
        "registrationEnquiryId",
        "registration_enquiry_id",
        "id",
      ]);
      if (!enquiryId && !registrationId) {
        return null;
      }
      return {
        route: "/admissions/confirmation",
        query: compact({
          enquiry_id: enquiryId,
          registration_id: registrationId,
        }) as Record<string, string | number>,
        label: "Continue to Admission Confirmation",
      };
    }
    case "homework": {
      const homeworkId = pick(record, ["homeworkId", "homework_id", "id"]);
      const query = compact({
        homework_id: homeworkId,
        standard_id: pick(record, ["standardId", "standard_id"]),
        division_id: pick(record, ["divisionId", "division_id"]),
        subject_id: pick(record, ["subjectId", "subject_id"]),
        from_date: pick(record, ["date", "homework_date"]),
        to_date: pick(record, ["date", "homework_date"]),
        q: pick(record, ["title"]),
      }) as Record<string, string | number>;

      if (Object.keys(query).length === 0) {
        return null;
      }

      return {
        route: "/lms/homework/report",
        query,
        label: "Open Homework Report",
      };
    }
    case "students": {
      const studentId = pick(record, ["studentId", "student_id", "id"]);
      if (!studentId) {
        return null;
      }
      return {
        route: "/students/search_student",
        query: compact({
          id: studentId,
          enrollment_no: pick(record, ["enrollmentNo", "enrollment_no"]),
        }) as Record<string, string | number>,
        label: "View Student Details",
      };
    }
    default:
      return null;
  }
}

/** Human-readable detail lines for a resolved record, used in chat replies. */
export function describeRecord(record: Record<string, unknown> | null | undefined) {
  if (!record) {
    return [] as string[];
  }

  const lines: Array<[string, string]> = [
    ["Enquiry No.", pick(record, ["enquiryNo", "enquiry_no"])],
    ["GR / Enrollment", pick(record, ["enrollmentNo", "enrollment_no", "grNo"])],
    ["Roll No.", pick(record, ["rollNo", "roll_no"])],
    ["Standard", pick(record, ["standard", "standardName", "standard_name"])],
    ["Division", pick(record, ["division", "divisionName", "division_name"])],
    ["Subject", pick(record, ["subject", "subjectName", "subject_name"])],
    ["Date", pick(record, ["date"])],
    ["Mobile", pick(record, ["mobileNo", "mobile_no", "mobile"])],
  ];

  const pendingFees = readNumber(record.pendingFees);
  if (pendingFees != null && pendingFees > 0) {
    lines.push(["Pending fees", String(pendingFees)]);
  }

  return lines
    .filter(([, value]) => Boolean(value))
    .map(([label, value]) => `${label}: ${value}`);
}
