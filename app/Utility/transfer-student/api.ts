import { messageFrom, recordArray, utilityRequest } from "../_lib/erp";
import { mapStudent, type UtilityStudent } from "../_lib/students";

/**
 * Transfer student — promotes students into the next academic year using the
 * standard's mapped `rollover_id` (next standard) and that standard's grade.
 *
 * Laravel source of truth:
 * `App\Http\Controllers\student\transferStudentController`.
 *   POST student/show_student      -> searchStudent()   : eligible students
 *   POST student/transfer_student  -> transferStudent() : creates next-year rows
 *
 * `searchStudent()` deliberately excludes students who already have a next-year
 * enrolment (`se.standard_id IS NULL` on the left join), so the returned list is
 * always the *pending* set. Only students with status 1 and no enrolment end
 * date are returned.
 */

const SEARCH_PATH = "student/show_student";
const TRANSFER_PATH = "student/transfer_student";

export type TransferStudentSearch = {
  gradeId: string;
  standardId: string;
  divisionId: string;
};

export async function searchPendingStudents(
  search: TransferStudentSearch
): Promise<UtilityStudent[]> {
  const payload = await utilityRequest(SEARCH_PATH, {
    method: "POST",
    body: {
      grade: search.gradeId,
      standard: search.standardId,
      division: search.divisionId,
    },
  });
  return recordArray(payload.student_data).map(mapStudent);
}

export async function promoteStudents(
  search: TransferStudentSearch,
  studentIds: number[]
): Promise<string> {
  const payload = await utilityRequest(TRANSFER_PATH, {
    method: "POST",
    body: {
      hid_gradeid: search.gradeId,
      hid_standardid: search.standardId,
      hid_divisionid: search.divisionId,
      stud_ids: studentIds,
    },
  });
  return messageFrom(payload, "Students transferred successfully.");
}
