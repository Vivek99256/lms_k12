import {
  isRecord,
  legacyRequest,
  messageFrom,
  readNumber,
  readString,
  recordArray,
  requireSession,
  type UnknownRecord,
} from "@/lib/erp-legacy";

/**
 * Consent master, delete consent master and consent report.
 *
 * Backed by `App\Http\Controllers\api\ConsentApiController` on the stateless,
 * CSRF-exempt `api/*` routes:
 *   GET  api/consents/students?grade&standard&division   -> student picker
 *   GET  api/consents?standard&division&from_date&to_date -> issued consents
 *   POST api/consents                                     -> issue consents
 *   POST api/consents/delete                              -> delete by consent id
 *
 * The Blade-era `consent/*` routes are not used. `consent_masterController::
 * create()` calls `SearchStudent()` without an institute or year, so the helper
 * falls back to the (empty) session and emits `where ts.sub_institute_id = and
 * ...` — a SQL syntax error. The other two controllers read the tenant from the
 * session as well, and `consent/*` is not CSRF-exempt.
 *
 * Delete and report share one endpoint; only the delete screen exposes the
 * checkbox column.
 */

const STUDENTS_PATH = "api/consents/students";
const PATH = "api/consents";

/** The two options in the Blade `accountable_status` select. */
export const ACCOUNTABLE_STATUSES = [
  { value: "Accountable", label: "Accountable" },
  { value: "Non_Accountable", label: "Non accountable" },
] as const;

export type AccountableStatus = (typeof ACCOUNTABLE_STATUSES)[number]["value"];

export type ConsentStudent = {
  studentId: number;
  name: string;
  enrollmentNo: string;
  standardName: string;
  divisionName: string;
  mobile: string;
};

export type ConsentRecord = {
  id: number;
  enrollmentNo: string;
  studentName: string;
  syear: string;
  standard: string;
  title: string;
  consentDate: string;
  accountStatus: string;
  amount: string;
  /** `status` is null until the parent responds; the ERP shows that as Pending. */
  parentStatus: string;
  createdBy: string;
  mobile: string;
};

export type ConsentFilter = {
  gradeId: string;
  standardId: string;
  divisionId: string;
  fromDate: string;
  toDate: string;
};

export type ConsentInput = {
  title: string;
  date: string;
  accountableStatus: AccountableStatus;
  standardId: string;
  divisionId: string;
  studentIds: number[];
};

function mapConsentStudent(record: UnknownRecord): ConsentStudent {
  return {
    studentId: readNumber(record.student_id ?? record.id),
    name: [record.first_name, record.middle_name, record.last_name]
      .map(readString)
      .map((part) => part.trim())
      .filter(Boolean)
      .join(" "),
    enrollmentNo: readString(record.enrollment_no).trim(),
    standardName: readString(record.standard_name).trim(),
    divisionName: readString(record.division_name).trim(),
    mobile: readString(record.mobile).trim(),
  };
}

function mapConsentRecord(record: UnknownRecord): ConsentRecord {
  return {
    id: readNumber(record.CHECKBOX ?? record.ID ?? record.id),
    enrollmentNo: readString(record.enrollment_no).trim(),
    studentName: readString(record.FULL_NAME).replace(/\s+/g, " ").trim(),
    syear: readString(record.syear),
    standard: readString(record.STANDARD).trim(),
    title: readString(record.title).trim(),
    consentDate: readString(record.consent_date),
    accountStatus: readString(record.account_status).trim(),
    amount: readString(record.amount).trim(),
    parentStatus: readString(record.status).trim() || "Pending",
    createdBy: readString(record.created_by).replace(/\s+/g, " ").trim(),
    mobile: readString(record.SMS_NO).trim(),
  };
}

export async function searchConsentStudents(filter: {
  gradeId: string;
  standardId: string;
  divisionId: string;
}): Promise<ConsentStudent[]> {
  const payload = await legacyRequest(STUDENTS_PATH, {
    query: {
      grade: filter.gradeId,
      standard: filter.standardId,
      division: filter.divisionId,
    },
  });
  const data = isRecord(payload.data) ? payload.data : {};
  return recordArray(data.students).map(mapConsentStudent);
}

export async function createConsents(input: ConsentInput): Promise<string> {
  const payload = await legacyRequest(PATH, {
    method: "POST",
    body: {
      title: input.title,
      date: input.date,
      accountable_status: input.accountableStatus,
      standard_id: input.standardId || null,
      division_id: input.divisionId || null,
      students: input.studentIds,
    },
  });
  return messageFrom(payload, "Consent added successfully.");
}

async function loadConsentRows(filter: ConsentFilter): Promise<ConsentRecord[]> {
  const payload = await legacyRequest(PATH, {
    query: {
      standard: filter.standardId,
      division: filter.divisionId,
      // The controller applies the range only when both bounds are present.
      from_date: filter.fromDate,
      to_date: filter.toDate,
    },
  });
  const data = isRecord(payload.data) ? payload.data : {};
  return recordArray(data.consents).map(mapConsentRecord);
}

export function loadDeletableConsents(filter: ConsentFilter): Promise<ConsentRecord[]> {
  return loadConsentRows(filter);
}

export function loadConsentReport(filter: ConsentFilter): Promise<ConsentRecord[]> {
  return loadConsentRows(filter);
}

/** `students[]` here carries consent-master row ids, not student ids. */
export async function deleteConsents(consentIds: number[]): Promise<string> {
  const session = requireSession();
  const payload = await legacyRequest(`${PATH}/delete`, {
    method: "POST",
    session,
    body: { students: consentIds },
  });
  return messageFrom(payload, "Consent deleted successfully.");
}
