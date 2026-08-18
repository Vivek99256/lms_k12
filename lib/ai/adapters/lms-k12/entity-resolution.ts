/**
 * Entity resolution for the LMS_K12 conversational assistant.
 *
 * The LMS backend APIs take numeric identifiers (standard_id, division_id,
 * student_id, subject_id, department id …) while users speak in names
 * ("Standard 7", "B division", "Zeel Tank", "Computer Science"). This module is
 * the single place that turns a spoken name into the identifier the existing
 * backend route expects, using only real rows returned by the existing LMS
 * endpoints. Nothing here invents a record: when the backend has no matching
 * row, the resolver reports that instead of guessing an id.
 *
 * Every lookup is scoped by the trusted session context (sub_institute_id,
 * syear, token) that the chat route resolved server-side.
 */

import type { ProjectContext } from "@shared/conversational-ai-core";
import { buildTrustedQuery, fetchLmsJson, postLmsForm } from "./server-api";

export type LookupOption = {
  id: string;
  label: string;
};

export type StudentRecord = {
  id: string;
  studentName: string;
  enrollmentNo: string;
  rollNo: string;
  mobileNo: string;
  email: string;
  gender: string;
  grade: string;
  gradeId: string;
  standard: string;
  standardId: string;
  division: string;
  divisionId: string;
  fatherName: string;
  motherName: string;
};

export type TeacherRecord = {
  id: string;
  teacherName: string;
  userName: string;
  email: string;
  mobileNo: string;
  gender: string;
  profileName: string;
  profileId: string;
};

export type DepartmentRecord = {
  id: string;
  name: string;
  parentName: string;
  totalEmployees: number;
  employees: Array<{ id: string; name: string; mobileNo: string; employeeNo: string }>;
};

/* -------------------------------------------------------------------------- */
/* Shared helpers                                                             */
/* -------------------------------------------------------------------------- */

export function normalizeEntityLabel(value: string | null | undefined) {
  return (value || "")
    .toLowerCase()
    .replace(/^(standard|std|class|grade)\s+/i, "")
    .replace(/^(division|section|div)\s+/i, "")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

function normalizePersonName(value: string | null | undefined) {
  return (value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function pickString(row: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = readString(row[key]);
    if (value) {
      return value;
    }
  }
  return "";
}

function asRows(value: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(value)) {
    return value.filter(
      (item): item is Record<string, unknown> =>
        typeof item === "object" && item !== null && !Array.isArray(item)
    );
  }

  if (typeof value === "object" && value !== null) {
    return asRows(Object.values(value as Record<string, unknown>));
  }

  return [];
}

/**
 * The admin lookup endpoints answer `{status: 0, message: "No Record"}` when the
 * institute has no matching rows, which `fetchLmsJson` correctly reports as a
 * failure. For directory lookups an empty institute is a normal answer, not an
 * error, so this wrapper turns "no rows" into an empty list and lets genuine
 * transport/auth failures keep throwing.
 */
async function readRowsSafely(
  load: () => Promise<Record<string, unknown>>,
  dataKeys: string[] = ["data"]
): Promise<Array<Record<string, unknown>>> {
  try {
    const payload = await load();
    for (const key of dataKeys) {
      const rows = asRows(payload[key]);
      if (rows.length > 0) {
        return rows;
      }
    }
    return [];
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error || "");
    if (/no record|not found|no data/i.test(message)) {
      return [];
    }
    throw error;
  }
}

/* -------------------------------------------------------------------------- */
/* Per-request caching                                                        */
/* -------------------------------------------------------------------------- */

type CacheEntry = { expiresAt: number; value: Promise<unknown> };

const lookupCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 30_000;

function getScopeKey(context: ProjectContext) {
  return [
    context.projectId || "lms_k12",
    context.subInstituteId || "-",
    context.syear || "-",
    context.userId || "-",
  ].join(":");
}

/**
 * Caches the in-flight promise, not just the settled value, so several tools
 * asking for the same directory inside one conversation turn share a single
 * backend call. A failed lookup is evicted immediately so the next turn retries.
 */
async function withCache<T>(
  context: ProjectContext,
  name: string,
  load: () => Promise<T>
): Promise<T> {
  const key = `${getScopeKey(context)}::${name}`;
  const cached = lookupCache.get(key);
  const now = Date.now();

  if (cached && cached.expiresAt > now) {
    return cached.value as Promise<T>;
  }

  const pending = load();
  lookupCache.set(key, { expiresAt: now + CACHE_TTL_MS, value: pending });

  try {
    return await pending;
  } catch (error) {
    lookupCache.delete(key);
    throw error;
  }
}

/* -------------------------------------------------------------------------- */
/* Academic structure: grades -> standards -> divisions -> subjects           */
/* -------------------------------------------------------------------------- */

function toLookupOptions(rows: Array<Record<string, unknown>>): LookupOption[] {
  return rows
    .map((row) => ({
      id: pickString(row, ["id", "standard_id", "division_id", "subject_id"]),
      label: pickString(row, [
        "name",
        "title",
        "display_name",
        "label",
        "subject_name",
        "standard_name",
      ]),
    }))
    .filter((option) => option.id && option.label);
}

export async function listAcademicSections(context: ProjectContext) {
  if (!context.subInstituteId) {
    return [] as LookupOption[];
  }

  return withCache(context, "academic-sections", async () => {
    const body = new URLSearchParams();
    body.set("sub_institute_id", context.subInstituteId || "");
    if (context.token) body.set("token", context.token);

    const rows = await readRowsSafely(() =>
      postLmsForm(context, "/get_adminAcademicSection", body)
    );
    return toLookupOptions(rows);
  });
}

export async function listStandardsForGrade(context: ProjectContext, gradeId: string) {
  if (!context.subInstituteId || !gradeId) {
    return [] as LookupOption[];
  }

  return withCache(context, `standards:${gradeId}`, async () => {
    const body = new URLSearchParams();
    body.set("sub_institute_id", context.subInstituteId || "");
    body.set("grade_id", gradeId);
    if (context.token) body.set("token", context.token);

    const rows = await readRowsSafely(() =>
      postLmsForm(context, "/get_adminStandard", body)
    );
    return toLookupOptions(rows);
  });
}

export async function listDivisionsForStandard(
  context: ProjectContext,
  standardId: string
) {
  if (!context.subInstituteId || !standardId) {
    return [] as LookupOption[];
  }

  return withCache(context, `divisions:${standardId}`, async () => {
    const body = new URLSearchParams();
    body.set("sub_institute_id", context.subInstituteId || "");
    body.set("standard_id", standardId);
    if (context.token) body.set("token", context.token);

    const rows = await readRowsSafely(() =>
      postLmsForm(context, "/get_adminDivision", body)
    );
    return toLookupOptions(rows);
  });
}

export async function listSubjectsForStandard(
  context: ProjectContext,
  standardId: string
) {
  if (!context.subInstituteId || !standardId) {
    return [] as LookupOption[];
  }

  return withCache(context, `subjects:${standardId}`, async () => {
    const body = new URLSearchParams();
    body.set("sub_institute_id", context.subInstituteId || "");
    body.set("standard_id", standardId);
    if (context.token) body.set("token", context.token);

    const rows = await readRowsSafely(() =>
      postLmsForm(context, "/get_adminSubject", body)
    );

    return rows
      .map((row) => ({
        id: pickString(row, ["subject_id", "id"]),
        label: pickString(row, ["subject_name", "display_name", "name"]),
      }))
      .filter((option) => option.id && option.label);
  });
}

/* -------------------------------------------------------------------------- */
/* Student directory                                                          */
/* -------------------------------------------------------------------------- */

function toStudentRecord(row: Record<string, unknown>): StudentRecord {
  return {
    id: pickString(row, ["id", "student_id"]),
    studentName: pickString(row, ["student_name", "name", "full_name"]),
    enrollmentNo: pickString(row, ["enrollment_no", "enrollment", "grno"]),
    rollNo: pickString(row, ["roll_no", "rollno"]),
    mobileNo: pickString(row, ["mobile", "mobile_no"]),
    email: pickString(row, ["email"]),
    gender: pickString(row, ["gender"]),
    grade: pickString(row, ["academic_section", "grade", "grade_name"]),
    gradeId: pickString(row, ["grade_id"]),
    standard: pickString(row, ["standard_name", "standard"]),
    standardId: pickString(row, ["standard_id"]),
    division: pickString(row, ["division_name", "division"]),
    divisionId: pickString(row, ["division_id", "section_id"]),
    fatherName: pickString(row, ["father_name"]),
    motherName: pickString(row, ["mother_name"]),
  };
}

/**
 * Loads the institute's enrolled students from the existing
 * `POST /get_adminStudentList` route. This single real dataset backs student
 * counts, class rosters, name -> id resolution, and the standard/division index
 * used when the user names a class instead of an id.
 */
export async function loadStudentDirectory(context: ProjectContext) {
  if (!context.subInstituteId || !context.syear) {
    return [] as StudentRecord[];
  }

  return withCache(context, "student-directory", async () => {
    const body = new URLSearchParams();
    body.set("type", "API");
    body.set("sub_institute_id", context.subInstituteId || "");
    body.set("syear", context.syear || "");
    if (context.token) body.set("token", context.token);

    const rows = await readRowsSafely(() =>
      postLmsForm(context, "/get_adminStudentList", body)
    );
    return rows.map(toStudentRecord).filter((student) => student.id);
  });
}

export function filterStudentDirectory(
  students: StudentRecord[],
  filters: {
    standard?: string;
    division?: string;
    grade?: string;
    studentName?: string;
    enrollmentNo?: string;
    rollNo?: string;
    mobileNo?: string;
    gender?: string;
  }
) {
  const wantedStandard = normalizeEntityLabel(filters.standard);
  const wantedDivision = normalizeEntityLabel(filters.division);
  const wantedGrade = normalizeEntityLabel(filters.grade);
  const wantedName = normalizePersonName(filters.studentName);
  const wantedEnrollment = normalizeEntityLabel(filters.enrollmentNo);
  const wantedRoll = normalizeEntityLabel(filters.rollNo);
  const wantedMobile = (filters.mobileNo || "").replace(/\D+/g, "");
  const wantedGender = (filters.gender || "").trim().toLowerCase();

  return students.filter((student) => {
    if (
      wantedStandard &&
      normalizeEntityLabel(student.standard) !== wantedStandard &&
      student.standardId !== filters.standard
    ) {
      return false;
    }
    if (
      wantedDivision &&
      normalizeEntityLabel(student.division) !== wantedDivision &&
      student.divisionId !== filters.division
    ) {
      return false;
    }
    if (wantedGrade && !normalizeEntityLabel(student.grade).includes(wantedGrade)) {
      return false;
    }
    if (wantedName && !normalizePersonName(student.studentName).includes(wantedName)) {
      return false;
    }
    if (wantedEnrollment && normalizeEntityLabel(student.enrollmentNo) !== wantedEnrollment) {
      return false;
    }
    if (wantedRoll && normalizeEntityLabel(student.rollNo) !== wantedRoll) {
      return false;
    }
    if (wantedMobile && student.mobileNo.replace(/\D+/g, "") !== wantedMobile) {
      return false;
    }
    if (wantedGender) {
      const gender = student.gender.trim().toLowerCase();
      const isMale = gender === "m" || gender === "male";
      const isFemale = gender === "f" || gender === "female";
      if (wantedGender.startsWith("m") && !isMale) return false;
      if (wantedGender.startsWith("f") && !isFemale) return false;
    }
    return true;
  });
}

/**
 * Resolves a spoken student name to the backend student rows that match it.
 * Returns every match so the caller can ask the user to disambiguate instead of
 * silently picking one.
 */
export async function resolveStudentsByName(context: ProjectContext, name: string) {
  const wanted = normalizePersonName(name);
  if (!wanted) {
    return [] as StudentRecord[];
  }

  const students = await loadStudentDirectory(context);
  const exact = students.filter(
    (student) => normalizePersonName(student.studentName) === wanted
  );
  if (exact.length > 0) {
    return exact;
  }

  const partial = students.filter((student) =>
    normalizePersonName(student.studentName).includes(wanted)
  );
  if (partial.length > 0) {
    return partial;
  }

  // Fall back to token overlap so "Zeel Tank" still finds "Zeel J Tank".
  const wantedTokens = wanted.split(" ").filter((token) => token.length > 1);
  if (wantedTokens.length === 0) {
    return [];
  }

  return students.filter((student) => {
    const studentTokens = normalizePersonName(student.studentName).split(" ");
    return wantedTokens.every((token) => studentTokens.includes(token));
  });
}

/* -------------------------------------------------------------------------- */
/* Class (standard / division) index derived from real enrolment rows          */
/* -------------------------------------------------------------------------- */

export type ClassOption = {
  standardId: string;
  standard: string;
  divisionId: string;
  division: string;
  gradeId: string;
  grade: string;
};

/**
 * Builds the institute's real class list from enrolment rows. `get_adminStandard`
 * needs a grade id up front, so deriving the index from the student directory
 * lets the assistant resolve "Standard 7" or "7-B" without first asking which
 * academic section it belongs to.
 */
export async function loadClassIndex(context: ProjectContext) {
  return withCache(context, "class-index", async () => {
    const students = await loadStudentDirectory(context);
    const seen = new Map<string, ClassOption>();

    for (const student of students) {
      if (!student.standardId) {
        continue;
      }
      const key = `${student.standardId}:${student.divisionId}`;
      if (seen.has(key)) {
        continue;
      }
      seen.set(key, {
        standardId: student.standardId,
        standard: student.standard,
        divisionId: student.divisionId,
        division: student.division,
        gradeId: student.gradeId,
        grade: student.grade,
      });
    }

    return [...seen.values()];
  });
}

/**
 * Resolves standard/division/grade names to the ids the LMS routes expect.
 * Values that already look like ids are passed through untouched, and anything
 * the backend does not know about is returned as `unresolved` so the caller can
 * tell the user rather than sending a name where an id is required.
 */
export async function resolveClassScope(
  context: ProjectContext,
  input: { grade?: string; standard?: string; division?: string }
) {
  const resolved = {
    gradeId: "",
    grade: "",
    standardId: "",
    standard: "",
    divisionId: "",
    division: "",
    unresolved: [] as string[],
  };

  const classes = await loadClassIndex(context);
  const wantedStandardInput = (input.standard || "").trim();
  const wantedDivisionInput = (input.division || "").trim();
  const wantedGradeInput = (input.grade || "").trim();

  if (wantedStandardInput) {
    const wanted = normalizeEntityLabel(wantedStandardInput);
    const match =
      classes.find((option) => option.standardId === wantedStandardInput) ||
      classes.find((option) => normalizeEntityLabel(option.standard) === wanted) ||
      classes.find((option) => normalizeEntityLabel(option.standard).includes(wanted));

    if (match) {
      resolved.standardId = match.standardId;
      resolved.standard = match.standard;
      resolved.gradeId = match.gradeId;
      resolved.grade = match.grade;
    } else {
      resolved.unresolved.push(`standard "${wantedStandardInput}"`);
    }
  }

  if (wantedDivisionInput) {
    const wanted = normalizeEntityLabel(wantedDivisionInput);
    const scoped = resolved.standardId
      ? classes.filter((option) => option.standardId === resolved.standardId)
      : classes;
    const match =
      scoped.find((option) => option.divisionId === wantedDivisionInput) ||
      scoped.find((option) => normalizeEntityLabel(option.division) === wanted) ||
      scoped.find((option) => normalizeEntityLabel(option.division).includes(wanted));

    if (match) {
      resolved.divisionId = match.divisionId;
      resolved.division = match.division;
      if (!resolved.standardId) {
        resolved.standardId = match.standardId;
        resolved.standard = match.standard;
      }
    } else {
      resolved.unresolved.push(`division "${wantedDivisionInput}"`);
    }
  }

  if (wantedGradeInput && !resolved.gradeId) {
    const wanted = normalizeEntityLabel(wantedGradeInput);
    const match =
      classes.find((option) => option.gradeId === wantedGradeInput) ||
      classes.find((option) => normalizeEntityLabel(option.grade) === wanted) ||
      classes.find((option) => normalizeEntityLabel(option.grade).includes(wanted));

    if (match) {
      resolved.gradeId = match.gradeId;
      resolved.grade = match.grade;
    } else {
      const sections = await listAcademicSections(context);
      const sectionMatch =
        sections.find((option) => option.id === wantedGradeInput) ||
        sections.find((option) => normalizeEntityLabel(option.label) === wanted);
      if (sectionMatch) {
        resolved.gradeId = sectionMatch.id;
        resolved.grade = sectionMatch.label;
      } else {
        resolved.unresolved.push(`grade "${wantedGradeInput}"`);
      }
    }
  }

  return resolved;
}

/* -------------------------------------------------------------------------- */
/* Teacher / employee directory                                               */
/* -------------------------------------------------------------------------- */

function toTeacherRecord(row: Record<string, unknown>): TeacherRecord {
  return {
    id: pickString(row, ["id", "user_id"]),
    teacherName: pickString(row, ["user_full_name", "name", "user_name"]),
    userName: pickString(row, ["user_name"]),
    email: pickString(row, ["email"]),
    mobileNo: pickString(row, ["mobile", "mobile_no"]),
    gender: pickString(row, ["gender"]),
    profileName: pickString(row, ["user_profile_name"]),
    profileId: pickString(row, ["user_profile_id"]),
  };
}

export async function loadTeacherDirectory(context: ProjectContext) {
  if (!context.subInstituteId) {
    return [] as TeacherRecord[];
  }

  return withCache(context, "teacher-directory", async () => {
    const body = new URLSearchParams();
    body.set("type", "API");
    body.set("sub_institute_id", context.subInstituteId || "");
    if (context.token) body.set("token", context.token);

    const rows = await readRowsSafely(() =>
      postLmsForm(context, "/get_adminTeacherList", body)
    );
    return rows.map(toTeacherRecord).filter((teacher) => teacher.id);
  });
}

export async function resolveTeachersByName(context: ProjectContext, name: string) {
  const wanted = normalizePersonName(name);
  if (!wanted) {
    return [] as TeacherRecord[];
  }

  const teachers = await loadTeacherDirectory(context);
  const exact = teachers.filter(
    (teacher) => normalizePersonName(teacher.teacherName) === wanted
  );
  if (exact.length > 0) {
    return exact;
  }

  return teachers.filter((teacher) =>
    normalizePersonName(teacher.teacherName).includes(wanted)
  );
}

/* -------------------------------------------------------------------------- */
/* Department directory                                                       */
/* -------------------------------------------------------------------------- */

function toEmployeeRows(value: unknown) {
  return asRows(value).map((row) => ({
    id: pickString(row, ["id"]),
    name: pickString(row, ["name"]),
    mobileNo: pickString(row, ["mobile"]),
    employeeNo: pickString(row, ["employee_no"]),
  }));
}

export async function loadDepartmentDirectory(context: ProjectContext) {
  if (!context.subInstituteId) {
    return [] as DepartmentRecord[];
  }

  return withCache(context, "department-directory", async () => {
    const query = buildTrustedQuery(context);
    const payload = await fetchLmsJson(
      context,
      `/api/departments/hierarchy?${query.toString()}`
    );

    const departments: DepartmentRecord[] = [];

    for (const parent of asRows(payload.departments)) {
      const parentName = pickString(parent, ["name", "department"]);
      departments.push({
        id: pickString(parent, ["id"]),
        name: parentName,
        parentName: "",
        totalEmployees: readNumber(parent.total_employees),
        employees: toEmployeeRows(parent.employees),
      });

      for (const child of asRows(parent.sub_departments)) {
        departments.push({
          id: pickString(child, ["id"]),
          name: pickString(child, ["name", "department"]),
          parentName,
          totalEmployees: readNumber(child.total_employees),
          employees: toEmployeeRows(child.employees),
        });
      }
    }

    return departments.filter((department) => department.id && department.name);
  });
}

export async function resolveDepartmentsByName(context: ProjectContext, name: string) {
  const wanted = normalizePersonName(name);
  if (!wanted) {
    return [] as DepartmentRecord[];
  }

  const departments = await loadDepartmentDirectory(context);
  const exact = departments.filter(
    (department) => normalizePersonName(department.name) === wanted
  );
  if (exact.length > 0) {
    return exact;
  }

  return departments.filter((department) =>
    normalizePersonName(department.name).includes(wanted)
  );
}
