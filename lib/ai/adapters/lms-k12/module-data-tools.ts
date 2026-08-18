/**
 * Module data tools for the LMS_K12 conversational assistant.
 *
 * These tools extend the existing LMS tool set (see `./tools`) to the modules
 * that had no conversational coverage yet — the student and teacher
 * directories, the academic catalogue (classes, subjects, courses), student
 * attendance, departments, and the fee dashboard — plus a cross-module analysis
 * tool for questions that need comparison or ranking.
 *
 * Every function calls an existing LMS backend route with the trusted session
 * scope and returns only rows the backend produced. Derived values (counts,
 * percentages, rankings) are computed from those rows; nothing is fabricated.
 * When a backend has no data for a request, the tool says so explicitly through
 * `available: false` so the conversation can tell the user instead of guessing.
 */

import { z } from "zod";
import type { ProjectContext, ProjectToolDefinition } from "@shared/conversational-ai-core";
import {
  attendanceOverviewInputSchema,
  classTeachersInputSchema,
  courseCatalogInputSchema,
  departmentDirectoryInputSchema,
  departmentInsightInputSchema,
  feesSummaryInputSchema,
  lmsAnalysisInputSchema,
  studentAttendanceDetailInputSchema,
  studentDirectoryInputSchema,
  subjectCatalogInputSchema,
  teacherDirectoryInputSchema,
} from "./schemas";
import { buildTrustedQuery, fetchLmsJson, postLmsForm } from "./server-api";
import {
  filterStudentDirectory,
  listSubjectsForStandard,
  loadClassIndex,
  loadDepartmentDirectory,
  loadStudentDirectory,
  loadTeacherDirectory,
  normalizeEntityLabel,
  resolveClassScope,
  resolveDepartmentsByName,
  resolveStudentsByName,
  resolveTeachersByName,
  type StudentRecord,
} from "./entity-resolution";

/* -------------------------------------------------------------------------- */
/* Small shared helpers                                                       */
/* -------------------------------------------------------------------------- */

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function readString(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function readNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
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

function percent(part: number, total: number) {
  if (!total) return null;
  return Math.round((part / total) * 1000) / 10;
}

function countBy<T>(rows: T[], read: (row: T) => string) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = read(row) || "Unspecified";
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((left, right) => right.count - left.count);
}

/** Reports a missing scope the same way for every tool so the assistant can ask. */
function unavailable(reason: string, extra: Record<string, unknown> = {}) {
  return {
    source: "lms_backend",
    available: false,
    reason,
    ...extra,
  };
}

/* -------------------------------------------------------------------------- */
/* Students                                                                   */
/* -------------------------------------------------------------------------- */

function toStudentSummary(student: StudentRecord) {
  return {
    id: student.id,
    studentId: student.id,
    studentName: student.studentName,
    standard: student.standard,
    standardId: student.standardId,
    division: student.division,
    divisionId: student.divisionId,
    grade: student.grade,
    enrollmentNo: student.enrollmentNo,
    rollNo: student.rollNo,
    mobileNo: student.mobileNo,
    gender: student.gender,
  };
}

export async function getStudentDirectory(
  input: z.infer<typeof studentDirectoryInputSchema>,
  context: ProjectContext
) {
  if (!context.subInstituteId || !context.syear) {
    return unavailable(
      "The current session does not carry an institute or academic year, so student records cannot be scoped safely."
    );
  }

  const scope = await resolveClassScope(context, {
    grade: input.grade,
    standard: input.standard,
    division: input.division,
  });

  if (scope.unresolved.length > 0) {
    return unavailable(
      `The LMS does not have ${scope.unresolved.join(" or ")} for this institute and academic year.`,
      { unresolvedFilters: scope.unresolved }
    );
  }

  const students = await loadStudentDirectory(context);
  const filtered = filterStudentDirectory(students, {
    grade: input.grade,
    standard: scope.standard || input.standard,
    division: scope.division || input.division,
    studentName: input.studentName,
    enrollmentNo: input.enrollmentNo,
    rollNo: input.rollNo,
    mobileNo: input.mobileNo,
    gender: input.gender,
  });

  const groupBy = input.groupBy && input.groupBy !== "none" ? input.groupBy : null;
  const breakdown = groupBy
    ? countBy(filtered, (student) => {
        if (groupBy === "standard") return student.standard;
        if (groupBy === "division") return `${student.standard} ${student.division}`.trim();
        if (groupBy === "grade") return student.grade;
        return student.gender === "M" ? "Male" : student.gender === "F" ? "Female" : student.gender;
      })
    : [];

  return {
    source: "lms_backend",
    available: true,
    module: "students",
    appliedFilters: {
      grade: scope.grade || input.grade || null,
      standard: scope.standard || input.standard || null,
      division: scope.division || input.division || null,
      studentName: input.studentName || null,
      gender: input.gender || null,
    },
    totalCount: filtered.length,
    instituteTotal: students.length,
    breakdown,
    students: filtered.slice(0, 25).map(toStudentSummary),
  };
}

/* -------------------------------------------------------------------------- */
/* Teachers                                                                   */
/* -------------------------------------------------------------------------- */

export async function getTeacherDirectory(
  input: z.infer<typeof teacherDirectoryInputSchema>,
  context: ProjectContext
) {
  if (!context.subInstituteId) {
    return unavailable(
      "The current session does not carry an institute, so teacher records cannot be scoped safely."
    );
  }

  const teachers = input.teacherName
    ? await resolveTeachersByName(context, input.teacherName)
    : await loadTeacherDirectory(context);

  const filtered = input.profileName
    ? teachers.filter((teacher) =>
        normalizeEntityLabel(teacher.profileName).includes(
          normalizeEntityLabel(input.profileName)
        )
      )
    : teachers;

  return {
    source: "lms_backend",
    available: true,
    module: "teachers",
    appliedFilters: {
      teacherName: input.teacherName || null,
      profileName: input.profileName || null,
    },
    totalCount: filtered.length,
    breakdown: countBy(filtered, (teacher) => teacher.profileName),
    teachers: filtered.slice(0, 25).map((teacher) => ({
      id: teacher.id,
      teacherName: teacher.teacherName,
      profileName: teacher.profileName,
      email: teacher.email,
      mobileNo: teacher.mobileNo,
    })),
  };
}

/**
 * Teachers assigned to one class. The LMS exposes the timetable-driven teacher
 * list per enrolled student (`/studentTeacherListAPI`), so the class roster is
 * resolved first and one of its real students is used to read the class's
 * timetable teachers.
 */
export async function getClassTeachers(
  input: z.infer<typeof classTeachersInputSchema>,
  context: ProjectContext
) {
  const scope = await resolveClassScope(context, {
    standard: input.standard,
    division: input.division,
  });

  if (scope.unresolved.length > 0) {
    return unavailable(
      `The LMS does not have ${scope.unresolved.join(" or ")} for this institute and academic year.`
    );
  }

  if (!scope.standardId) {
    return unavailable(
      "A standard is required to list the teachers assigned to a class.",
      { needs: ["standard"] }
    );
  }

  const students = filterStudentDirectory(await loadStudentDirectory(context), {
    standard: scope.standard,
    division: scope.division,
  });

  if (students.length === 0) {
    return unavailable(
      `No students are enrolled in ${scope.standard}${scope.division ? ` ${scope.division}` : ""}, so the LMS has no class timetable to read teachers from.`
    );
  }

  const body = new URLSearchParams();
  body.set("type", "API");
  body.set("student_id", students[0].id);
  body.set("sub_institute_id", context.subInstituteId || "");
  body.set("syear", context.syear || "");
  if (context.token) body.set("token", context.token);

  try {
    const payload = await postLmsForm(context, "/studentTeacherListAPI", body);
    const rows = asRows(payload.data);

    return {
      source: "lms_backend",
      available: true,
      module: "teachers",
      standard: scope.standard,
      division: scope.division,
      totalCount: rows.length,
      teachers: rows.map((row) => ({
        teacherName: readString(row.teacher_name),
        subject: readString(row.subject_name),
        mobileNo: readString(row.mobile),
      })),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error || "");
    return unavailable(
      `The LMS timetable has no teacher assignment for ${scope.standard}${scope.division ? ` ${scope.division}` : ""} (${message}).`
    );
  }
}

/* -------------------------------------------------------------------------- */
/* Academic catalogue: classes, subjects, courses                             */
/* -------------------------------------------------------------------------- */

export async function getSubjectCatalog(
  input: z.infer<typeof subjectCatalogInputSchema>,
  context: ProjectContext
) {
  const classes = await loadClassIndex(context);

  if (classes.length === 0) {
    return unavailable(
      "The LMS has no enrolled classes for this institute and academic year, so no subject mapping is available."
    );
  }

  const scope = await resolveClassScope(context, {
    grade: input.grade,
    standard: input.standard,
    division: input.division,
  });

  if (scope.unresolved.length > 0) {
    return unavailable(
      `The LMS does not have ${scope.unresolved.join(" or ")} for this institute and academic year.`
    );
  }

  // Without a named standard, read the subject map for every distinct standard
  // the institute actually runs so "which subjects are available" is complete.
  const standards = scope.standardId
    ? [{ id: scope.standardId, name: scope.standard }]
    : [
        ...new Map(
          classes.map((option) => [option.standardId, { id: option.standardId, name: option.standard }])
        ).values(),
      ];

  // One lookup per standard, run together so a whole-institute subject question
  // does not serialise twenty backend round trips.
  const byStandard = await Promise.all(
    standards.slice(0, 20).map(async (standard) => ({
      standard: standard.name,
      standardId: standard.id,
      subjects: (await listSubjectsForStandard(context, standard.id)).map((subject) => ({
        id: subject.id,
        name: subject.label,
      })),
    }))
  );

  const distinctSubjects = [
    ...new Set(byStandard.flatMap((entry) => entry.subjects.map((subject) => subject.name))),
  ];

  if (distinctSubjects.length === 0) {
    return unavailable(
      scope.standard
        ? `No subjects are mapped to ${scope.standard} in the LMS for this academic year.`
        : "No subjects are mapped to any standard in the LMS for this academic year."
    );
  }

  return {
    source: "lms_backend",
    available: true,
    module: "subjects",
    standard: scope.standard || null,
    totalCount: distinctSubjects.length,
    subjects: distinctSubjects,
    byStandard,
  };
}

export async function getCourseCatalog(
  input: z.infer<typeof courseCatalogInputSchema>,
  context: ProjectContext
) {
  if (!context.subInstituteId) {
    return unavailable(
      "The current session does not carry an institute, so the course catalogue cannot be scoped safely."
    );
  }

  const scope = await resolveClassScope(context, {
    grade: input.grade,
    standard: input.standard,
  });

  if (scope.unresolved.length > 0) {
    return unavailable(
      `The LMS does not have ${scope.unresolved.join(" or ")} for this institute and academic year.`
    );
  }

  // The catalogue endpoint already scopes courses to the caller's profile, so
  // the standard filter is applied to the rows it returns.
  const query = buildTrustedQuery(context);
  const payload = await fetchLmsJson(context, `/api/lms-courses?${query.toString()}`, {
    method: "POST",
    body: JSON.stringify({
      sub_institute_id: context.subInstituteId,
      syear: context.syear || "",
      user_id: context.userId || "",
      user_profile_name: context.profileName || context.role || "",
    }),
  });

  // `lms_subject` is keyed by content category, with an array of courses under
  // each key, so both levels are flattened before mapping.
  const grouped =
    typeof payload.lms_subject === "object" && payload.lms_subject !== null
      ? (payload.lms_subject as Record<string, unknown>)
      : {};
  const rows = Object.values(grouped).flatMap((value) => asRows(value));

  const allCourses = rows.map((row) => ({
    subjectId: readString(row.subject_id),
    courseName: readString(row.subject_name),
    standard: readString(row.standard_name),
    standardId: readString(row.standard_id),
    category: readString(row.content_category),
    chapterCount: Array.isArray(row.chapters) ? row.chapters.length : 0,
  }));

  const courses = scope.standardId
    ? allCourses.filter(
        (course) =>
          course.standardId === scope.standardId ||
          normalizeEntityLabel(course.standard) === normalizeEntityLabel(scope.standard)
      )
    : allCourses;

  if (courses.length === 0) {
    return unavailable(
      scope.standard
        ? `The LMS course catalogue has no courses published for ${scope.standard}.`
        : "The LMS course catalogue has no published courses for this institute and academic year."
    );
  }

  return {
    source: "lms_backend",
    available: true,
    module: "courses",
    standard: scope.standard || null,
    totalCount: courses.length,
    breakdown: countBy(courses, (course) => course.category),
    courses: courses.slice(0, 40),
  };
}

export async function getClassStructure(
  _input: unknown,
  context: ProjectContext
) {
  const classes = await loadClassIndex(context);

  if (classes.length === 0) {
    return unavailable(
      "The LMS has no enrolled classes for this institute and academic year."
    );
  }

  const students = await loadStudentDirectory(context);
  const strength = new Map<string, number>();
  for (const student of students) {
    const key = `${student.standardId}:${student.divisionId}`;
    strength.set(key, (strength.get(key) || 0) + 1);
  }

  return {
    source: "lms_backend",
    available: true,
    module: "classes",
    totalCount: classes.length,
    classes: classes.map((option) => ({
      ...option,
      studentCount: strength.get(`${option.standardId}:${option.divisionId}`) || 0,
    })),
  };
}

/* -------------------------------------------------------------------------- */
/* Attendance                                                                 */
/* -------------------------------------------------------------------------- */

type AttendanceClassRow = {
  standard: string;
  standardId: string;
  division: string;
  divisionId: string;
  totalStudents: number;
  present: number;
  absent: number;
  attendancePercent: number | null;
  attendanceTaken: boolean;
};

/**
 * Class-wise attendance for one date, read through the same
 * `student/show_daywise_student_attendance` workflow the Daywise Attendance
 * Report screen uses, so the assistant and the screen always agree.
 */
export async function getAttendanceOverview(
  input: z.infer<typeof attendanceOverviewInputSchema>,
  context: ProjectContext
) {
  if (!context.subInstituteId || !context.syear) {
    return unavailable(
      "The current session does not carry an institute or academic year, so attendance cannot be scoped safely."
    );
  }

  const scope = await resolveClassScope(context, {
    standard: input.standard,
    division: input.division,
  });

  if (scope.unresolved.length > 0) {
    return unavailable(
      `The LMS does not have ${scope.unresolved.join(" or ")} for this institute and academic year.`
    );
  }

  const date = input.date?.trim() || todayIso();

  const body = new URLSearchParams();
  body.set("type", "API");
  body.set("sub_institute_id", context.subInstituteId);
  body.set("syear", context.syear);
  body.set("date", date);
  if (input.taken) body.set("taken", input.taken);
  if (context.userId) body.set("user_id", context.userId);
  if (context.termId) body.set("term_id", context.termId);
  if (context.token) body.set("token", context.token);

  let payload: Record<string, unknown>;
  try {
    payload = await postLmsForm(context, "/student/show_daywise_student_attendance", body);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error || "");
    return unavailable(
      `The LMS could not return attendance for ${date}: ${message}`,
      { date }
    );
  }

  const rows = asRows(payload.attendance_data).map((row): AttendanceClassRow => {
    // The report labels the class as "Standard/Division"; the division name is
    // also returned on its own, so the standard is the remaining part.
    const combined = readString(row.standard_name);
    const division = readString(row.division_name);
    const standard = combined.includes("/")
      ? combined.split("/")[0].trim()
      : combined;

    const boys = readNumber(row.BOY);
    const girls = readNumber(row.GIRL);
    const present = readNumber(row.TBP) + readNumber(row.TGP);
    const absent = readNumber(row.TBA) + readNumber(row.TGA);
    const totalStudents = boys + girls;

    return {
      standard,
      standardId: readString(row.standard_id),
      division,
      divisionId: readString(row.section_id),
      totalStudents,
      present,
      absent,
      attendancePercent: percent(present, totalStudents),
      attendanceTaken: present + absent > 0,
    };
  });

  const filtered = rows.filter((row) => {
    if (
      scope.standard &&
      normalizeEntityLabel(row.standard) !== normalizeEntityLabel(scope.standard) &&
      row.standardId !== scope.standardId
    ) {
      return false;
    }
    if (
      scope.division &&
      normalizeEntityLabel(row.division) !== normalizeEntityLabel(scope.division) &&
      row.divisionId !== scope.divisionId
    ) {
      return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    return unavailable(
      scope.standard
        ? `The LMS has no attendance rows for ${scope.standard}${scope.division ? ` ${scope.division}` : ""} on ${date}.`
        : `The LMS has no attendance rows for ${date}. It may be a holiday, a vacation day, or attendance may not be published yet.`,
      { date }
    );
  }

  const totals = filtered.reduce(
    (accumulator, row) => ({
      totalStudents: accumulator.totalStudents + row.totalStudents,
      present: accumulator.present + row.present,
      absent: accumulator.absent + row.absent,
    }),
    { totalStudents: 0, present: 0, absent: 0 }
  );

  const reported = filtered.filter((row) => row.attendanceTaken);
  const ranked = [...reported].sort(
    (left, right) => (left.attendancePercent ?? 0) - (right.attendancePercent ?? 0)
  );

  return {
    source: "lms_backend",
    available: true,
    module: "attendance",
    date,
    appliedFilters: {
      standard: scope.standard || input.standard || null,
      division: scope.division || input.division || null,
    },
    totals: {
      ...totals,
      attendancePercent: percent(totals.present, totals.totalStudents),
      classesReported: reported.length,
      classesPending: filtered.length - reported.length,
    },
    lowestAttendance: ranked[0] || null,
    highestAttendance: ranked[ranked.length - 1] || null,
    classes: filtered,
  };
}

/**
 * One student's attendance across the academic year, optionally narrowed to a
 * date range, read through the existing `/studentAttendanceAPI` route.
 */
export async function getStudentAttendanceDetail(
  input: z.infer<typeof studentAttendanceDetailInputSchema>,
  context: ProjectContext
) {
  if (!context.subInstituteId || !context.syear) {
    return unavailable(
      "The current session does not carry an institute or academic year, so attendance cannot be scoped safely."
    );
  }

  let studentId = input.studentId?.trim() || "";
  let student: StudentRecord | undefined;

  if (!studentId) {
    const candidates = input.studentName
      ? await resolveStudentsByName(context, input.studentName)
      : input.enrollmentNo
        ? filterStudentDirectory(await loadStudentDirectory(context), {
            enrollmentNo: input.enrollmentNo,
          })
        : [];

    if (candidates.length === 0) {
      return unavailable(
        input.studentName || input.enrollmentNo
          ? `No enrolled student matches "${input.studentName || input.enrollmentNo}" in this institute and academic year.`
          : "A student name, enrollment number, or student id is required to read individual attendance.",
        { needs: ["studentName"] }
      );
    }

    const narrowed =
      input.standard || input.division
        ? filterStudentDirectory(candidates, {
            standard: input.standard,
            division: input.division,
          })
        : candidates;
    const matches = narrowed.length > 0 ? narrowed : candidates;

    if (matches.length > 1) {
      return {
        source: "lms_backend",
        available: false,
        ambiguous: true,
        reason: `${matches.length} enrolled students match that name.`,
        candidates: matches.slice(0, 10).map(toStudentSummary),
      };
    }

    student = matches[0];
    studentId = student.id;
  }

  const body = new URLSearchParams();
  body.set("type", "API");
  body.set("student_id", studentId);
  body.set("sub_institute_id", context.subInstituteId);
  body.set("syear", context.syear);
  if (context.token) body.set("token", context.token);

  let payload: Record<string, unknown>;
  try {
    payload = await postLmsForm(context, "/studentAttendanceAPI", body);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error || "");
    return unavailable(`The LMS could not return attendance for this student: ${message}`);
  }

  const data =
    typeof payload.data === "object" && payload.data !== null
      ? (payload.data as Record<string, unknown>)
      : {};
  const allRows = asRows(data.attendance_data).map((row) => ({
    date: readString(row.attendance_date),
    code: readString(row.attendance_code).toUpperCase(),
  }));

  const fromDate = input.fromDate?.trim() || "";
  const toDate = input.toDate?.trim() || "";
  const rows = allRows.filter((row) => {
    if (fromDate && row.date < fromDate) return false;
    if (toDate && row.date > toDate) return false;
    return true;
  });

  if (rows.length === 0) {
    return unavailable(
      `The LMS has no attendance records for ${student?.studentName || "this student"}${fromDate || toDate ? " in that date range" : ""}.`,
      { student: student ? toStudentSummary(student) : { id: studentId } }
    );
  }

  const present = rows.filter((row) => row.code === "P").length;
  const absent = rows.filter((row) => row.code === "A").length;
  const late = rows.filter((row) => row.code === "L").length;

  return {
    source: "lms_backend",
    available: true,
    module: "attendance",
    student: student ? toStudentSummary(student) : { id: studentId },
    range: { fromDate: fromDate || rows[0].date, toDate: toDate || rows[rows.length - 1].date },
    totals: {
      recordedDays: rows.length,
      present,
      absent,
      late,
      attendancePercent: percent(present, rows.length),
    },
    absentDates: rows.filter((row) => row.code === "A").map((row) => row.date).slice(0, 30),
  };
}

/* -------------------------------------------------------------------------- */
/* Departments                                                                */
/* -------------------------------------------------------------------------- */

export async function getDepartmentDirectory(
  input: z.infer<typeof departmentDirectoryInputSchema>,
  context: ProjectContext
) {
  if (!context.subInstituteId) {
    return unavailable(
      "The current session does not carry an institute, so department records cannot be scoped safely."
    );
  }

  const departments = input.departmentName
    ? await resolveDepartmentsByName(context, input.departmentName)
    : await loadDepartmentDirectory(context);

  if (departments.length === 0) {
    return unavailable(
      input.departmentName
        ? `No department named "${input.departmentName}" exists in this institute.`
        : "No departments are configured for this institute."
    );
  }

  const ranked = [...departments].sort(
    (left, right) => right.totalEmployees - left.totalEmployees
  );

  return {
    source: "lms_backend",
    available: true,
    module: "departments",
    totalCount: departments.length,
    totalEmployees: departments.reduce(
      (sum, department) => sum + department.totalEmployees,
      0
    ),
    largestDepartment: ranked[0]
      ? { name: ranked[0].name, totalEmployees: ranked[0].totalEmployees }
      : null,
    departments: departments.slice(0, 30).map((department) => ({
      id: department.id,
      name: department.name,
      parentName: department.parentName || null,
      totalEmployees: department.totalEmployees,
      employees: input.includeEmployees ? department.employees.slice(0, 25) : undefined,
    })),
  };
}

/**
 * Everything the LMS actually knows about one department, assembled so a
 * "why is this department a concern?" question can be answered from records
 * rather than from inference.
 *
 * The honest half matters as much as the data: the institute has no skill
 * matrix, competency rating, workload or appraisal dataset wired to this
 * assistant, so those are named as gaps instead of being guessed at. That is
 * what stops a headcount from being dressed up as a capability judgement.
 */
export async function getDepartmentInsight(
  input: z.infer<typeof departmentInsightInputSchema>,
  context: ProjectContext
) {
  if (!context.subInstituteId) {
    return unavailable(
      "The current session does not carry an institute, so department records cannot be scoped safely."
    );
  }

  const all = await loadDepartmentDirectory(context);
  if (all.length === 0) {
    return unavailable("No departments are configured for this institute.");
  }

  const wanted = (input.departmentName || "").trim();
  const matches = wanted ? await resolveDepartmentsByName(context, wanted) : [];

  if (wanted && matches.length === 0) {
    return unavailable(
      `No department named "${wanted}" exists in this institute.`,
      { knownDepartments: all.slice(0, 15).map((department) => department.name) }
    );
  }

  const ranked = [...all].sort(
    (left, right) => right.totalEmployees - left.totalEmployees
  );
  const target = matches[0] || ranked[0];

  const totalEmployees = all.reduce(
    (sum, department) => sum + department.totalEmployees,
    0
  );
  const averageEmployees =
    all.length > 0 ? Math.round((totalEmployees / all.length) * 10) / 10 : 0;
  const rank = ranked.findIndex((department) => department.id === target.id) + 1;

  const subDepartments = all.filter(
    (department) => department.parentName && department.parentName === target.name
  );

  return {
    source: "lms_backend",
    available: true,
    module: "departments",
    department: {
      id: target.id,
      name: target.name,
      parentName: target.parentName || null,
      totalEmployees: target.totalEmployees,
      employees: target.employees.slice(0, 25).map((employee) => ({
        name: employee.name,
        employeeNo: employee.employeeNo || null,
      })),
    },
    comparison: {
      rankByHeadcount: rank > 0 ? rank : null,
      departmentCount: all.length,
      instituteEmployees: totalEmployees,
      averageEmployeesPerDepartment: averageEmployees,
      isLargest: ranked[0]?.id === target.id,
      shareOfWorkforcePercent:
        totalEmployees > 0
          ? Math.round((target.totalEmployees / totalEmployees) * 1000) / 10
          : null,
    },
    subDepartments: subDepartments.map((department) => ({
      name: department.name,
      totalEmployees: department.totalEmployees,
    })),
    // Stated explicitly so an explanation can say what it could not check.
    availableSignals: [
      "department headcount",
      "sub-department structure",
      "employee names within the department",
      "share of the total workforce",
    ],
    unavailableSignals: [
      "skill matrix and competency ratings",
      "training records and completion",
      "workload or task allocation",
      "staff attendance and leave",
      "performance appraisal",
    ],
  };
}

/* -------------------------------------------------------------------------- */
/* Fees summary                                                               */
/* -------------------------------------------------------------------------- */

export async function getFeesSummary(
  input: z.infer<typeof feesSummaryInputSchema>,
  context: ProjectContext
) {
  if (!context.subInstituteId || !context.syear) {
    return unavailable(
      "The current session does not carry an institute or academic year, so the fee summary cannot be scoped safely."
    );
  }

  const scope = await resolveClassScope(context, {
    grade: input.grade,
    standard: input.standard,
    division: input.division,
  });

  if (scope.unresolved.length > 0) {
    return unavailable(
      `The LMS does not have ${scope.unresolved.join(" or ")} for this institute and academic year.`
    );
  }

  const query = buildTrustedQuery(context);
  const payload = await fetchLmsJson(context, `/api/fees-dashboard/summary?${query.toString()}`, {
    method: "POST",
    body: JSON.stringify({
      sub_institute_id: context.subInstituteId,
      syear: context.syear,
      month_id: input.monthId || null,
      grade_id: scope.gradeId || null,
      standard_id: scope.standardId || null,
      section_id: scope.divisionId || null,
      from_date: input.fromDate || null,
      to_date: input.toDate || null,
    }),
  });

  const summary =
    typeof payload.summary === "object" && payload.summary !== null
      ? (payload.summary as Record<string, unknown>)
      : {};

  return {
    source: "lms_backend",
    available: true,
    module: "fees",
    appliedFilters: {
      standard: scope.standard || null,
      division: scope.division || null,
      monthId: input.monthId || null,
    },
    summary: {
      demandAmount: readNumber(summary.demand_amount),
      collectedAmount: readNumber(summary.collected_amount),
      outstandingAmount: readNumber(summary.outstanding_amount),
      collectionRate: readNumber(summary.collection_rate),
      fineAmount: readNumber(summary.fine_amount),
      discountAmount: readNumber(summary.discount_amount),
      receiptsCount: readNumber(summary.receipts_count),
      demandDisplay: readString(summary.demand_display),
      collectedDisplay: readString(summary.collected_display),
      outstandingDisplay: readString(summary.outstanding_display),
    },
    headwise: asRows(payload.headwise).map((row) => ({
      feeTitle: readString(row.display_name) || readString(row.fee_title),
      targetAmount: readNumber(row.target_amount),
      collectedAmount: readNumber(row.collected_amount),
      pendingAmount: readNumber(row.pending_amount),
    })),
    collectionVsTarget: asRows(payload.collection_vs_target).map((row) => ({
      monthLabel: readString(row.month_label),
      targetAmount: readNumber(row.target_amount),
      collectedAmount: readNumber(row.collected_amount),
    })),
  };
}

/* -------------------------------------------------------------------------- */
/* Cross-module analysis                                                      */
/* -------------------------------------------------------------------------- */

async function loadFeesPending(context: ProjectContext, standard?: string, division?: string) {
  const body = new URLSearchParams();
  const scope = await resolveClassScope(context, { standard, division });
  if (scope.standardId) body.set("standard", scope.standardId);
  if (scope.divisionId) body.set("division", scope.divisionId);

  const query = buildTrustedQuery(context);
  const payload = await postLmsForm(
    context,
    `/fees/fees_defaulter_report?${query.toString()}`,
    body
  );

  const rows = asRows(payload.fees_data);
  const students = rows.map((row) => {
    const stddiv = readString(row.stddiv);
    const [rowStandard = "", rowDivision = ""] = stddiv.split(/[-/]/).map((value) => value.trim());
    const totals =
      typeof row["-"] === "object" && row["-"] !== null
        ? (row["-"] as Record<string, unknown>)
        : {};

    return {
      studentId: readString(row.student_id) || readString(row.id),
      studentName: readString(row.name) || readString(row.student_name),
      standard: rowStandard,
      division: rowDivision,
      enrollmentNo: readString(row.enrollment),
      pendingFees: readNumber(totals.remain ?? totals.bk),
    };
  });

  return students.filter((student) => {
    if (
      scope.standard &&
      normalizeEntityLabel(student.standard) !== normalizeEntityLabel(scope.standard)
    ) {
      return false;
    }
    if (
      scope.division &&
      normalizeEntityLabel(student.division) !== normalizeEntityLabel(scope.division)
    ) {
      return false;
    }
    return true;
  });
}

async function safely<T>(label: string, load: () => Promise<T>) {
  try {
    return { dataset: label, ok: true as const, value: await load() };
  } catch (error) {
    return {
      dataset: label,
      ok: false as const,
      error: error instanceof Error ? error.message : String(error || ""),
    };
  }
}

/**
 * Loads the real LMS datasets an analytical question needs and returns them
 * together with the derived comparisons (totals, rates, rankings) computed from
 * those rows. The conversational model explains this factbase — it never
 * supplies the numbers itself, and datasets the backend could not return are
 * reported in `unavailableDatasets` so the answer can say what is missing.
 */
export async function analyzeLmsData(
  input: z.infer<typeof lmsAnalysisInputSchema>,
  context: ProjectContext
) {
  const requested = [...new Set(input.datasets)];
  const facts: Record<string, unknown> = {};
  const unavailableDatasets: Array<{ dataset: string; reason: string }> = [];

  const targets =
    input.compareStandards && input.compareStandards.length > 0
      ? input.compareStandards
      : [input.standard || ""];

  for (const dataset of requested) {
    if (dataset === "students") {
      const result = await safely(dataset, async () => {
        const students = await loadStudentDirectory(context);
        return {
          totalStudents: students.length,
          byStandard: countBy(students, (student) => student.standard),
          byClass: countBy(students, (student) =>
            `${student.standard} ${student.division}`.trim()
          ),
          byGender: countBy(students, (student) =>
            student.gender === "M" ? "Male" : student.gender === "F" ? "Female" : "Unspecified"
          ),
        };
      });
      if (result.ok) facts.students = result.value;
      else unavailableDatasets.push({ dataset, reason: result.error });
      continue;
    }

    if (dataset === "teachers") {
      const result = await safely(dataset, async () => {
        const teachers = await loadTeacherDirectory(context);
        return {
          totalTeachers: teachers.length,
          byProfile: countBy(teachers, (teacher) => teacher.profileName),
        };
      });
      if (result.ok) facts.teachers = result.value;
      else unavailableDatasets.push({ dataset, reason: result.error });
      continue;
    }

    if (dataset === "classes") {
      const result = await safely(dataset, () => getClassStructure({}, context));
      if (result.ok) facts.classes = result.value;
      else unavailableDatasets.push({ dataset, reason: result.error });
      continue;
    }

    if (dataset === "attendance") {
      const result = await safely(dataset, async () => {
        const perTarget = [];
        for (const target of targets) {
          const overview = await getAttendanceOverview(
            {
              date: input.date,
              standard: target || undefined,
              division: input.division,
            },
            context
          );
          perTarget.push({ standard: target || "all", overview });
        }
        return perTarget.length === 1 ? perTarget[0].overview : perTarget;
      });
      if (result.ok) facts.attendance = result.value;
      else unavailableDatasets.push({ dataset, reason: result.error });
      continue;
    }

    if (dataset === "fees_pending") {
      const result = await safely(dataset, async () => {
        const students = await loadFeesPending(context, input.standard, input.division);
        const withDues = students.filter((student) => student.pendingFees > 0);
        const ranked = [...withDues].sort((left, right) => right.pendingFees - left.pendingFees);
        return {
          studentsWithPendingFees: withDues.length,
          totalPendingAmount: withDues.reduce((sum, student) => sum + student.pendingFees, 0),
          byClass: countBy(withDues, (student) =>
            `${student.standard} ${student.division}`.trim()
          ),
          highestRisk: ranked.slice(0, 10),
        };
      });
      if (result.ok) facts.feesPending = result.value;
      else unavailableDatasets.push({ dataset, reason: result.error });
      continue;
    }

    if (dataset === "fees_summary") {
      const result = await safely(dataset, () =>
        getFeesSummary(
          { standard: input.standard, division: input.division, grade: input.grade },
          context
        )
      );
      if (result.ok) facts.feesSummary = result.value;
      else unavailableDatasets.push({ dataset, reason: result.error });
      continue;
    }

    if (dataset === "departments") {
      const result = await safely(dataset, () =>
        getDepartmentDirectory({ includeEmployees: false }, context)
      );
      if (result.ok) facts.departments = result.value;
      else unavailableDatasets.push({ dataset, reason: result.error });
      continue;
    }

    if (dataset === "homework") {
      const result = await safely(dataset, async () => {
        const payload = await fetchLmsJson(context, "/api/lms-homework/list", {
          method: "POST",
          body: JSON.stringify({
            type: "Homework",
            sub_institute_id: Number(context.subInstituteId || 0),
            syear: Number(context.syear || 0),
            user_id: Number(context.userId || 0),
            user_profile_name: context.profileName || "",
            user_name: context.profileName || "",
            grade: null,
            standard_id: null,
            division_id: null,
            subject_id: null,
            from_date: null,
            to_date: null,
          }),
        });
        const rows = asRows(payload.data);
        return {
          totalHomework: rows.length,
          bySubject: countBy(rows, (row) =>
            readString(row.subject_name) || readString(row.subject)
          ),
          byStandard: countBy(rows, (row) =>
            readString(row.standard_name) || readString(row.standard)
          ),
        };
      });
      if (result.ok) facts.homework = result.value;
      else unavailableDatasets.push({ dataset, reason: result.error });
      continue;
    }

    if (dataset === "admissions") {
      const result = await safely(dataset, async () => {
        const query = buildTrustedQuery(context);
        const payload = await fetchLmsJson(
          context,
          `/api/admission_enquiry?${query.toString()}`
        );
        const rows = asRows(payload.data ?? payload.enquiries);
        return {
          totalEnquiries: rows.length,
          byStatus: countBy(rows, (row) => readString(row.status) || "Unspecified"),
        };
      });
      if (result.ok) facts.admissions = result.value;
      else unavailableDatasets.push({ dataset, reason: result.error });
    }
  }

  return {
    source: "lms_backend",
    available: Object.keys(facts).length > 0,
    module: "analysis",
    question: input.question,
    requestedDatasets: requested,
    scope: {
      standard: input.standard || null,
      division: input.division || null,
      grade: input.grade || null,
      date: input.date || null,
      compareStandards: input.compareStandards || null,
      subInstituteId: context.subInstituteId || null,
      academicYear: context.syear || null,
    },
    facts,
    unavailableDatasets,
  };
}

/* -------------------------------------------------------------------------- */
/* Tool definitions                                                           */
/* -------------------------------------------------------------------------- */

export const MODULE_DATA_TOOL_NAMES = {
  read: [
    "getStudentDirectory",
    "getTeacherDirectory",
    "getClassTeachers",
    "getClassStructure",
    "getSubjectCatalog",
    "getCourseCatalog",
    "getAttendanceOverview",
    "getStudentAttendanceDetail",
  ],
  admin: ["getDepartmentDirectory", "getDepartmentInsight", "getFeesSummary"],
  analysis: ["analyzeLmsData"],
} as const;

/**
 * Turns a backend transport, auth or query failure into the same
 * `available: false` shape the tools already use for "no rows", so the user gets
 * a plain explanation in the conversation instead of a raw backend error.
 */
function withGracefulFailure(
  definition: ProjectToolDefinition
): ProjectToolDefinition {
  return {
    ...definition,
    execute: async (input: unknown, context: ProjectContext) => {
      try {
        return await definition.execute(input, context);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error || "");
        console.warn(`[lms-ai.module-data] ${definition.name} failed`, message);
        return unavailable(
          `The LMS backend could not return that information right now (${message}).`,
          { tool: definition.name }
        );
      }
    },
  };
}

export function getModuleDataToolDefinitions(): ProjectToolDefinition[] {
  const definitions: ProjectToolDefinition[] = [
    {
      name: "getStudentDirectory",
      description:
        "Count and list real enrolled students from the LMS student directory. Use this for questions like how many students are there, show students of Standard 7, or class strength. Standard and division may be given as names; they are resolved to backend ids automatically.",
      inputSchema: studentDirectoryInputSchema,
      requiredPermissions: ["lms:student:read"],
      riskLevel: "low",
      requiresConfirmation: false,
      capabilities: ["student_directory", "student_count", "class_roster"],
      execute: getStudentDirectory,
    },
    {
      name: "getTeacherDirectory",
      description:
        "Count and list real teacher and staff records for the current institute. Use this for questions like how many teachers are there or show the teacher list.",
      inputSchema: teacherDirectoryInputSchema,
      requiredPermissions: ["lms:teacher:read"],
      riskLevel: "low",
      requiresConfirmation: false,
      capabilities: ["teacher_directory", "teacher_count", "staff_list"],
      execute: getTeacherDirectory,
    },
    {
      name: "getClassTeachers",
      description:
        "List the teachers assigned to one class through the LMS timetable. Use this when the user asks which teachers teach a particular standard and division.",
      inputSchema: classTeachersInputSchema,
      requiredPermissions: ["lms:teacher:read"],
      riskLevel: "low",
      requiresConfirmation: false,
      capabilities: ["class_teachers", "teacher_assignment"],
      execute: getClassTeachers,
    },
    {
      name: "getClassStructure",
      description:
        "List every standard and division the institute actually runs this academic year, with real class strength. Use this for questions about available classes, standards, divisions, or class sizes.",
      inputSchema: z.object({}),
      requiredPermissions: ["lms:student:read"],
      riskLevel: "low",
      requiresConfirmation: false,
      capabilities: ["class_structure", "standards", "divisions"],
      execute: getClassStructure,
    },
    {
      name: "getSubjectCatalog",
      description:
        "List the subjects mapped to the institute's standards in the LMS. Use this for questions about available subjects, or the subjects of a particular standard.",
      inputSchema: subjectCatalogInputSchema,
      requiredPermissions: ["lms:subject:read"],
      riskLevel: "low",
      requiresConfirmation: false,
      capabilities: ["subject_catalog", "subjects"],
      execute: getSubjectCatalog,
    },
    {
      name: "getCourseCatalog",
      description:
        "List the published LMS courses and their chapters for the institute. Use this for questions about which courses are available or assigned.",
      inputSchema: courseCatalogInputSchema,
      requiredPermissions: ["lms:course:read"],
      riskLevel: "low",
      requiresConfirmation: false,
      capabilities: ["course_catalog", "courses"],
      execute: getCourseCatalog,
    },
    {
      name: "getAttendanceOverview",
      description:
        "Load real class-wise student attendance for one date, including present and absent counts and attendance percentage per standard and division. Use this for today's attendance, attendance for a class, or which class has the lowest attendance.",
      inputSchema: attendanceOverviewInputSchema,
      requiredPermissions: ["lms:attendance:read"],
      riskLevel: "low",
      requiresConfirmation: false,
      capabilities: ["attendance", "daily_attendance", "class_attendance"],
      execute: getAttendanceOverview,
    },
    {
      name: "getStudentAttendanceDetail",
      description:
        "Load one student's real attendance history and percentage. Resolve the student by name, enrollment number, or id before calling the backend.",
      inputSchema: studentAttendanceDetailInputSchema,
      requiredPermissions: ["lms:attendance:read"],
      riskLevel: "low",
      requiresConfirmation: false,
      capabilities: ["student_attendance", "attendance_detail"],
      execute: getStudentAttendanceDetail,
    },
    {
      name: "getDepartmentDirectory",
      description:
        "List the institute's real departments and sub-departments with their employee counts. Always name the department in the answer.",
      inputSchema: departmentDirectoryInputSchema,
      requiredPermissions: ["hrms:department:read"],
      riskLevel: "low",
      requiresConfirmation: false,
      capabilities: ["departments", "department_directory", "employee_distribution"],
      execute: getDepartmentDirectory,
    },
    {
      name: "getDepartmentInsight",
      description:
        "Explain one department in depth: its headcount, how it ranks against the other departments, its sub-departments, the employees in it, and — importantly — which risk-related signals the LMS does not hold. Use this for follow-up questions such as why a department is a concern, what is driving its risk, or who is in it.",
      inputSchema: departmentInsightInputSchema,
      requiredPermissions: ["hrms:department:read"],
      riskLevel: "low",
      requiresConfirmation: false,
      capabilities: [
        "department_insight",
        "department_risk",
        "department_explanation",
      ],
      execute: getDepartmentInsight,
    },
    {
      name: "getFeesSummary",
      description:
        "Load the real fee demand, collection, outstanding amount, collection rate and fee-head breakdown from the LMS fees dashboard.",
      inputSchema: feesSummaryInputSchema,
      requiredPermissions: ["lms:fees:defaulter:read"],
      riskLevel: "low",
      requiresConfirmation: false,
      capabilities: ["fees_summary", "fee_collection_summary", "outstanding_fees"],
      execute: getFeesSummary,
    },
    {
      name: "analyzeLmsData",
      description:
        "Load several real LMS datasets at once and return them with derived totals, rates and rankings so an analytical question can be answered. Use this for comparisons, rankings, risk questions, trends, and summaries that need more than one module. Choose only the datasets the question needs. Answer strictly from the returned facts and state clearly when a dataset was unavailable.",
      inputSchema: lmsAnalysisInputSchema,
      requiredPermissions: ["assistant:suggestions:read"],
      riskLevel: "low",
      requiresConfirmation: false,
      capabilities: ["data_analysis", "cross_module_analysis", "comparison", "trends"],
      execute: analyzeLmsData,
    },
  ];

  return definitions.map(withGracefulFailure);
}
