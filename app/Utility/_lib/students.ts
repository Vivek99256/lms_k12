import { readNumber, readString, type UnknownRecord } from "./erp";

/**
 * Student row shape shared by the Utility screens. It maps the columns that
 * `App\Helpers\SearchStudent()` selects (`ts.*` plus enrolment/standard/division
 * aliases), and the narrower projection that
 * `transferStudentController::searchStudent()` returns.
 */
export type UtilityStudent = {
  studentId: number;
  name: string;
  enrollmentNo: string;
  standardName: string;
  divisionName: string;
  gradeName: string;
  rollNo: string;
  mobile: string;
  gender: string;
  /** True when the student already has an enrolment row in the target year. */
  alreadyExists: boolean;
};

function fullName(record: UnknownRecord): string {
  const composed = readString(record.student_name).trim();
  if (composed) return composed;
  return [record.first_name, record.middle_name, record.last_name]
    .map(readString)
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" ");
}

export function mapStudent(record: UnknownRecord): UtilityStudent {
  return {
    studentId: readNumber(record.student_id ?? record.id),
    name: fullName(record),
    enrollmentNo: readString(record.enrollment_no).trim(),
    standardName: readString(record.standard_name).trim(),
    divisionName: readString(record.division_name).trim(),
    gradeName: readString(record.grade ?? record.grade_name).trim(),
    rollNo: readString(record.roll_no).trim(),
    mobile: readString(record.mobile).trim(),
    gender: readString(record.gender).trim(),
    alreadyExists: false,
  };
}

export function toggleId(ids: number[], id: number): number[] {
  return ids.includes(id) ? ids.filter((entry) => entry !== id) : [...ids, id];
}

export function selectableIds(students: UtilityStudent[]): number[] {
  return students.filter((student) => !student.alreadyExists).map((student) => student.studentId);
}
