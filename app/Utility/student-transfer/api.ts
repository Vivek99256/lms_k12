import {
  isRecord,
  labelledKeys,
  messageFrom,
  readNumber,
  readString,
  recordArray,
  requireSession,
  utilityRequest,
  type LabelledKey,
} from "../_lib/erp";
import { mapStudent, type UtilityStudent } from "../_lib/students";

/**
 * Student transfer — moves students to a *sibling institute* under the same
 * client, optionally carrying their satellite records across.
 *
 * Laravel source of truth: `App\Http\Controllers\student\studentTransferController`
 * on the `student/student_transfer` resource route.
 *   GET  student/student_transfer          -> index()  : institute list
 *   GET  student/student_transfer/create   -> create() : student list + modules
 *   POST student/student_transfer          -> store()  : perform the transfer
 */

const INDEX_PATH = "student/student_transfer";
const CREATE_PATH = "student/student_transfer/create";

export type InstituteOption = {
  id: number;
  name: string;
};

export type StudentTransferBootstrap = {
  fromInstituteName: string;
  fromClientId: string;
  institutes: InstituteOption[];
};

export type StudentTransferSearch = {
  gradeId: string;
  standardId: string;
  divisionId: string;
  fromSyear: string;
  toSubInstituteId: string;
  toSyear: string;
  toAcademicSection: string;
  toStandard: string;
  toDivision: string;
  fromInstituteName: string;
  fromClientId: string;
};

export type StudentTransferSearchResult = {
  students: UtilityStudent[];
  /** `modules_array` — the optional record groups that travel with the student. */
  modules: LabelledKey[];
};

/** `general_information` is checked and disabled in the legacy form. */
export const ALWAYS_TRANSFERRED_MODULE = "general_information";

function institute(record: Record<string, unknown>): InstituteOption {
  return {
    // school_setup rows expose the primary key as `Id`.
    id: readNumber(record.Id ?? record.id),
    name: readString(record.SchoolName ?? record.school_name).trim(),
  };
}

export async function loadStudentTransferBootstrap(): Promise<StudentTransferBootstrap> {
  const payload = await utilityRequest(INDEX_PATH);
  return {
    fromInstituteName: readString(payload.from_institute_name).trim(),
    fromClientId: readString(payload.from_client_id).trim(),
    institutes: recordArray(payload.to_institute_details)
      .map(institute)
      .filter((option) => option.id > 0),
  };
}

export async function searchTransferableStudents(
  search: StudentTransferSearch
): Promise<StudentTransferSearchResult> {
  const payload = await utilityRequest(CREATE_PATH, {
    query: {
      from_institute_name: search.fromInstituteName,
      from_client_id: search.fromClientId,
      from_syear: search.fromSyear,
      grade: search.gradeId,
      standard: search.standardId,
      division: search.divisionId,
      to_sub_institute_id: search.toSubInstituteId,
      to_syear: search.toSyear,
      to_academic_section: search.toAcademicSection,
      to_standard: search.toStandard,
      to_division: search.toDivision,
    },
  });

  return {
    students: recordArray(payload.student_data).map(mapStudent),
    modules: labelledKeys(payload.modules_array),
  };
}

export async function transferStudentsToInstitute(
  search: StudentTransferSearch,
  studentIds: number[],
  modules: string[]
): Promise<string> {
  const session = requireSession();
  const payload = await utilityRequest(INDEX_PATH, {
    method: "POST",
    session,
    body: {
      from_institute_name: search.fromInstituteName,
      from_syear: search.fromSyear,
      grade: search.gradeId,
      standard: search.standardId,
      division: search.divisionId,
      to_sub_institute_id: search.toSubInstituteId,
      to_syear: search.toSyear,
      to_academic_section: search.toAcademicSection,
      to_standard: search.toStandard,
      to_division: search.toDivision,
      students: studentIds,
      modules,
    },
  });
  return messageFrom(payload, "Student transfer completed.");
}

/** Academic years offered by the login payload, newest first. */
export function sessionAcademicYears(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const userData = JSON.parse(localStorage.getItem("userData") || "{}") as Record<string, unknown>;
    const years = Array.isArray(userData.academicYears) ? userData.academicYears : [];
    const values = years
      .filter(isRecord)
      .map((entry) => readString(entry.syear ?? entry.academic_year).trim())
      .filter(Boolean);
    return Array.from(new Set(values)).sort((left, right) => Number(right) - Number(left));
  } catch {
    return [];
  }
}
