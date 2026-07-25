import {
  isRecord,
  labelledKeys,
  messageFrom,
  readNumber,
  readString,
  recordArray,
  utilityRequest,
} from "../_lib/erp";
import { mapStudent, type UtilityStudent } from "../_lib/students";

/**
 * Rollover — copies master data and student enrolments from the current
 * academic year into the next one.
 *
 * Laravel source of truth: `App\Http\Controllers\student\rollOverController`
 * on the `student/rollover` resource route.
 *   GET  student/rollover          -> index()  : module list + per-table status
 *   GET  student/rollover/create   -> create() : runs the rollover, or (with
 *                                                `new_tables`) lists students
 *   POST student/rollover          -> store()  : rolls the selected students
 */

const INDEX_PATH = "student/rollover";
const CREATE_PATH = "student/rollover/create";

/** The enrolment row is a radio, not a checkbox, in the legacy form. */
export const ENROLMENT_KEY = "tblstudent_enrollment";

/**
 * Pre-ticked and required in the Blade form: the fee tables depend on them, so
 * the ERP always rolls them over.
 */
export const MANDATORY_TABLES = ["academic_year", "fees_map_years", "fees_title"];

/** The Blade submit handler refuses fewer than four ticked tables. */
export const MINIMUM_TABLES = 4;

export type RolloverModule = {
  key: string;
  label: string;
  /** Rows already present in the next year; 0 means "not rolled over yet". */
  existingCount: number;
  done: boolean;
  mandatory: boolean;
};

export type EnrolmentStatus = {
  currentYearStudents: number;
  nextYearStudents: number;
  remaining: number;
};

export type RolloverBootstrap = {
  fromInstituteName: string;
  modules: RolloverModule[];
  enrolment: EnrolmentStatus;
};

export type SelectedStudentSearch = {
  tables: string[];
  gradeId: string;
  standardId: string;
  divisionId: string;
  toAcademicSection: string;
  toStandard: string;
  toDivision: string;
  toNextSyear: string;
  fromInstituteName: string;
};

function parseEnrolment(value: unknown): EnrolmentStatus {
  // index() packs the enrolment cell as "current/next/remaining".
  const parts = readString(value).split("/");
  return {
    currentYearStudents: readNumber(parts[0]),
    nextYearStudents: readNumber(parts[1]),
    remaining: readNumber(parts[2]),
  };
}

export async function loadRolloverBootstrap(): Promise<RolloverBootstrap> {
  const payload = await utilityRequest(INDEX_PATH);
  const status = isRecord(payload.table_array_check) ? payload.table_array_check : {};

  const modules = labelledKeys(payload.table_array)
    .filter((entry) => entry.key !== ENROLMENT_KEY)
    .map<RolloverModule>((entry) => {
      const existingCount = readNumber(status[entry.key]);
      return {
        key: entry.key,
        label: entry.label,
        existingCount,
        done: existingCount > 0,
        mandatory: MANDATORY_TABLES.includes(entry.key),
      };
    });

  return {
    fromInstituteName: readString(payload.from_institute_name).trim(),
    modules,
    enrolment: parseEnrolment(status[ENROLMENT_KEY]),
  };
}

/**
 * Runs the "all data / all students" rollover. `create()` branches on the
 * presence of `tables`, so the module keys must always be sent.
 */
export async function rolloverAllData(
  tables: string[],
  includeAllStudents: boolean
): Promise<string> {
  const payload = await utilityRequest(CREATE_PATH, {
    query: {
      tables,
      ...(includeAllStudents ? { tblstudent_enrollment: "all_students" } : {}),
    },
  });
  return messageFrom(payload, "Rollover completed.");
}

/** Rolls only the student enrolments, leaving master tables untouched. */
export async function rolloverAllStudentsOnly(): Promise<string> {
  const payload = await utilityRequest(CREATE_PATH, {
    query: { tblstudent_enrollment: "all_students" },
  });
  return messageFrom(payload, "Student data rollover completed.");
}

export type SelectedStudentResult = {
  students: UtilityStudent[];
  toNextSyear: string;
};

/** `create()` with `new_tables` returns the student list for the chosen class. */
export async function searchRolloverStudents(
  search: SelectedStudentSearch
): Promise<SelectedStudentResult> {
  const payload = await utilityRequest(CREATE_PATH, {
    query: {
      new_tables: search.tables.join(","),
      tblstudent_enrollment: "selected_students",
      from_institute_name: search.fromInstituteName,
      grade: search.gradeId,
      standard: search.standardId,
      division: search.divisionId,
      to_next_syear: search.toNextSyear,
      to_academic_section: search.toAcademicSection,
      to_standard: search.toStandard,
      to_division: search.toDivision,
    },
  });

  return {
    students: recordArray(payload.student_data).map(mapStudent),
    toNextSyear: readString(payload.to_next_syear).trim() || search.toNextSyear,
  };
}

export async function rolloverSelectedStudents(
  search: SelectedStudentSearch,
  studentIds: number[],
  fromCurrentSyear: string
): Promise<string> {
  const payload = await utilityRequest(INDEX_PATH, {
    method: "POST",
    body: {
      from_institute_name: search.fromInstituteName,
      from_current_syear: fromCurrentSyear,
      grade: search.gradeId,
      standard: search.standardId,
      division: search.divisionId,
      to_next_syear: search.toNextSyear,
      to_academic_section: search.toAcademicSection,
      to_standard: search.toStandard,
      to_division: search.toDivision,
      new_tables: search.tables.join(","),
      tblstudent_enrollment: "selected_students",
      students: studentIds,
    },
  });
  return messageFrom(payload, "Selected students rolled over.");
}
