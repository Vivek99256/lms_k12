/**
 * Turns a tool result into the conversation's focus.
 *
 * After an answer like "Workplace Safety and Health has the highest headcount",
 * the next message may be nothing more than "Why?". For that to work, the turn
 * has to leave behind the record the answer was about, plus every record it
 * could have been about, so a pronoun or a name in the next message resolves
 * against real rows instead of being re-parsed from natural language.
 *
 * Everything here reads shapes the tools already return. No record is
 * synthesised: a tool that produced no rows leaves no focus behind, which is
 * what lets the conversation ask instead of guessing.
 */

import type { ConversationFocusEntity } from "./followup-state";

export interface ConversationFocusExtraction {
  module: string;
  focus?: ConversationFocusEntity;
  candidates: ConversationFocusEntity[];
  rowCount?: number;
}

function readText(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function readNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
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

function pick(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = readText(record[key]);
    if (value) return value;
  }
  return "";
}

function toEntity(
  kind: string,
  name: string,
  id: string,
  attributes: Record<string, unknown>
): ConversationFocusEntity | null {
  if (!name) {
    return null;
  }
  return { kind, name, id: id || undefined, attributes };
}

function classLabel(row: Record<string, unknown>) {
  const standard = pick(row, ["standard", "standardName", "standard_name"]);
  const division = pick(row, ["division", "divisionName", "division_name"]);
  if (!standard) return "";
  return division ? `${standard} ${division}` : standard;
}

function compactEntities(entities: Array<ConversationFocusEntity | null>) {
  return entities.filter((entity): entity is ConversationFocusEntity => Boolean(entity));
}

/* -------------------------------------------------------------------------- */
/* Per-module extraction                                                      */
/* -------------------------------------------------------------------------- */

function extractDepartments(payload: Record<string, unknown>): ConversationFocusExtraction {
  const rows = asRecordArray(payload.departments);
  const candidates = compactEntities(
    rows.map((row) =>
      toEntity("department", pick(row, ["name"]), pick(row, ["id"]), row)
    )
  );

  const largest = asRecord(payload.largestDepartment);
  const largestName = largest ? pick(largest, ["name"]) : "";
  const focus =
    candidates.find((entity) => entity.name === largestName) ||
    (candidates.length === 1 ? candidates[0] : undefined);

  return { module: "departments", focus, candidates, rowCount: rows.length };
}

function extractAttendanceClasses(payload: Record<string, unknown>): ConversationFocusExtraction {
  const rows = asRecordArray(payload.classes);
  const candidates = compactEntities(
    rows.map((row) =>
      toEntity("class", classLabel(row), pick(row, ["standardId"]), {
        ...row,
        date: payload.date,
      })
    )
  );

  const lowest = asRecord(payload.lowestAttendance);
  const lowestName = lowest ? classLabel(lowest) : "";
  const focus =
    candidates.find((entity) => entity.name === lowestName) ||
    (candidates.length === 1 ? candidates[0] : undefined);

  return { module: "attendance", focus, candidates, rowCount: rows.length };
}

function extractStudents(
  payload: Record<string, unknown>,
  module: string
): ConversationFocusExtraction {
  const rows = asRecordArray(payload.students);
  const candidates = compactEntities(
    rows.map((row) =>
      toEntity(
        "student",
        pick(row, ["studentName", "student_name", "name"]),
        pick(row, ["studentId", "student_id", "id"]),
        row
      )
    )
  );

  // A single match is the subject; several rows keep the highest pending amount
  // as the subject, because that is what a fee answer leads with.
  const ranked = [...rows].sort(
    (left, right) => (readNumber(right.pendingFees) ?? 0) - (readNumber(left.pendingFees) ?? 0)
  );
  const leaderName = ranked[0] ? pick(ranked[0], ["studentName", "student_name", "name"]) : "";
  const hasPending = ranked[0] ? (readNumber(ranked[0].pendingFees) ?? 0) > 0 : false;

  const focus =
    candidates.length === 1
      ? candidates[0]
      : hasPending
        ? candidates.find((entity) => entity.name === leaderName)
        : undefined;

  return {
    module,
    focus,
    candidates,
    rowCount: readNumber(payload.totalCount) ?? rows.length,
  };
}

function extractTeachers(payload: Record<string, unknown>): ConversationFocusExtraction {
  const rows = asRecordArray(payload.teachers);
  const candidates = compactEntities(
    rows.map((row) =>
      toEntity("teacher", pick(row, ["teacherName", "name"]), pick(row, ["id"]), row)
    )
  );

  // A class-scoped teacher list is about the class, not about any one teacher.
  const standard = pick(payload, ["standard"]);
  const focus = standard
    ? toEntity("class", classLabel(payload), "", payload) || undefined
    : candidates.length === 1
      ? candidates[0]
      : undefined;

  return { module: "teachers", focus, candidates, rowCount: rows.length };
}

function extractClasses(payload: Record<string, unknown>): ConversationFocusExtraction {
  const rows = asRecordArray(payload.classes);
  const candidates = compactEntities(
    rows.map((row) => toEntity("class", classLabel(row), pick(row, ["standardId"]), row))
  );
  return { module: "classes", candidates, rowCount: rows.length };
}

function extractSubjects(payload: Record<string, unknown>): ConversationFocusExtraction {
  const names = Array.isArray(payload.subjects)
    ? payload.subjects.filter((item): item is string => typeof item === "string")
    : [];
  const candidates = compactEntities(
    names.map((name) => toEntity("subject", name, "", { name }))
  );
  return { module: "subjects", candidates, rowCount: names.length };
}

function extractCourses(payload: Record<string, unknown>): ConversationFocusExtraction {
  const rows = asRecordArray(payload.courses);
  const candidates = compactEntities(
    rows.map((row) =>
      toEntity("course", pick(row, ["courseName"]), pick(row, ["subjectId"]), row)
    )
  );
  return { module: "courses", candidates, rowCount: rows.length };
}

function extractAdmissions(payload: Record<string, unknown>): ConversationFocusExtraction {
  const normalized = asRecord(payload.normalized);
  const rows =
    asRecordArray(payload.candidates).length > 0
      ? asRecordArray(payload.candidates)
      : normalized
        ? asRecordArray(normalized.filteredEnquiries)
        : [];

  const candidates = compactEntities(
    rows.map((row) =>
      toEntity(
        "admission enquiry",
        pick(row, ["studentName", "student_name", "fullName"]),
        pick(row, ["id", "enquiryId"]),
        row
      )
    )
  );

  return {
    module: "admissions",
    focus: candidates.length === 1 ? candidates[0] : undefined,
    candidates,
    rowCount: rows.length,
  };
}

/**
 * The analysis tool returns a bundle of datasets rather than one list, so the
 * focus is whichever dataset carries an unambiguous leader — the department with
 * the largest headcount, the class with the lowest attendance, and so on. That
 * leader is what "Why?" refers to on the next turn.
 */
function extractAnalysis(payload: Record<string, unknown>): ConversationFocusExtraction {
  const facts = asRecord(payload.facts);
  if (!facts) {
    return { module: "analysis", candidates: [] };
  }

  const parts: ConversationFocusExtraction[] = [];

  const departments = asRecord(facts.departments);
  if (departments) {
    parts.push(extractDepartments(departments));
  }

  const attendance = asRecord(facts.attendance);
  if (attendance) {
    parts.push(extractAttendanceClasses(attendance));
  }

  const feesPending = asRecord(facts.feesPending);
  if (feesPending) {
    const rows = asRecordArray(feesPending.highestRisk);
    const candidates = compactEntities(
      rows.map((row) =>
        toEntity("student", pick(row, ["studentName"]), pick(row, ["studentId"]), row)
      )
    );
    parts.push({
      module: "fees",
      focus: candidates[0],
      candidates,
      rowCount: rows.length,
    });
  }

  const classes = asRecord(facts.classes);
  if (classes) {
    parts.push(extractClasses(classes));
  }

  const withFocus = parts.find((part) => part.focus);
  const allCandidates = parts.flatMap((part) => part.candidates);

  return {
    module: withFocus?.module || parts[0]?.module || "analysis",
    focus: withFocus?.focus,
    candidates: allCandidates,
    rowCount: allCandidates.length,
  };
}

/* -------------------------------------------------------------------------- */
/* Entry point                                                                */
/* -------------------------------------------------------------------------- */

export function extractConversationFocus(
  toolName: string,
  result: unknown
): ConversationFocusExtraction | null {
  const payload = asRecord(result);
  if (!payload) {
    return null;
  }

  switch (toolName) {
    case "getDepartmentDirectory":
      return extractDepartments(payload);
    case "getAttendanceOverview":
      return extractAttendanceClasses(payload);
    case "getStudentAttendanceDetail": {
      const student = asRecord(payload.student);
      const focus = student
        ? toEntity(
            "student",
            pick(student, ["studentName"]),
            pick(student, ["studentId", "id"]),
            { ...student, ...(asRecord(payload.totals) || {}) }
          ) || undefined
        : undefined;
      return { module: "attendance", focus, candidates: focus ? [focus] : [] };
    }
    case "getStudentDirectory":
    case "searchStudents":
      return extractStudents(payload, "students");
    case "listFeesDefaulters":
    case "findStudentFeeRecord":
      return extractStudents(payload, "fees");
    case "getTeacherDirectory":
    case "getClassTeachers":
      return extractTeachers(payload);
    case "getClassStructure":
      return extractClasses(payload);
    case "getSubjectCatalog":
      return extractSubjects(payload);
    case "getCourseCatalog":
      return extractCourses(payload);
    case "listAdmissionEnquiries":
    case "findAdmissionCandidate":
      return extractAdmissions(payload);
    case "getFeesSummary":
      return { module: "fees", candidates: [] };
    case "analyzeLmsData":
      return extractAnalysis(payload);
    default:
      return null;
  }
}
