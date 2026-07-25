import {
  labelledKeys,
  messageFrom,
  readNumber,
  readString,
  recordArray,
  utilityRequest,
  utilityUpload,
  type LabelledKey,
} from "../_lib/erp";

/**
 * Update all data — the year-end bulk maintenance screen.
 *
 * Laravel source of truth:
 * `App\Http\Controllers\student\studentBulkUpdateController` on the
 * `student/student_bulk_update` resource route. `store()` is a single endpoint
 * that branches on which field is present, so each action below sends exactly
 * one trigger field:
 *   tables=1                                -> end-date every active enrolment
 *   bk_month[]                              -> archive + delete fee breakoff months
 *   student_active_inactive_excel + file    -> activate/deactivate by GR number
 *   rollno_standard + division              -> renumber roll numbers A→Z
 *   leave_rollover=on                       -> carry earned-leave balance forward
 *   cleave_rollover=on                      -> carry casual-leave balance forward
 */

const PATH = "student/student_bulk_update";

export type BulkUpdateStandard = {
  standardId: number;
  standardName: string;
  gradeId: number;
  gradeName: string;
};

export type BulkUpdateBootstrap = {
  activeStudentCount: number;
  standards: BulkUpdateStandard[];
  breakoffMonths: LabelledKey[];
};

export type ActiveInactiveMode = "Active" | "Inactive";

export async function loadBulkUpdateBootstrap(): Promise<BulkUpdateBootstrap> {
  const payload = await utilityRequest(PATH);
  return {
    activeStudentCount: recordArray(payload.get_student_enrollments).length,
    standards: recordArray(payload.standard_arr)
      .map((record) => ({
        standardId: readNumber(record.standard_id),
        standardName: readString(record.standard_name).trim(),
        gradeId: readNumber(record.grade_id),
        gradeName: readString(record.grade_name).trim(),
      }))
      .filter((entry) => entry.standardId > 0),
    breakoffMonths: labelledKeys(payload.bk_month),
  };
}

export async function inactivateAllStudents(): Promise<string> {
  const payload = await utilityRequest(PATH, { method: "POST", body: { tables: 1 } });
  return messageFrom(payload, "All active students were made inactive.");
}

export async function deleteBreakoffMonths(monthIds: string[]): Promise<string> {
  const payload = await utilityRequest(PATH, { method: "POST", body: { bk_month: monthIds } });
  return messageFrom(payload, "Selected breakoff months deleted.");
}

/**
 * Excel import. Column A of each row must hold the GR (enrolment) number; the
 * header row is skipped. The response reports totals for records not found and
 * records already in the requested state.
 */
export async function importActiveInactiveExcel(
  mode: ActiveInactiveMode,
  file: File
): Promise<string> {
  const formData = new FormData();
  formData.append("student_active_inactive_excel", mode);
  formData.append("attachment", file);
  const payload = await utilityUpload(PATH, formData);
  return messageFrom(payload, `Students marked ${mode.toLowerCase()}.`);
}

/** Renumbers roll numbers 1..n ordered by first name then last name. */
export async function updateRollNumbers(
  standardId: string,
  divisionId: string
): Promise<string> {
  const payload = await utilityRequest(PATH, {
    method: "POST",
    body: { rollno_standard: standardId, division: divisionId },
  });
  return messageFrom(payload, "Roll numbers updated.");
}

export type LeaveRolloverKind = "earned" | "casual";

/**
 * Carries the closing leave balance into next year. Employees who already have
 * a next-year allocation for that leave type are skipped by the controller.
 */
export async function rolloverLeaveBalance(kind: LeaveRolloverKind): Promise<string> {
  const field = kind === "earned" ? "leave_rollover" : "cleave_rollover";
  const payload = await utilityRequest(PATH, { method: "POST", body: { [field]: "on" } });
  return messageFrom(payload, "Leave balances rolled over.");
}
