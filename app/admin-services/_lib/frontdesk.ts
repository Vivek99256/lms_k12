import {
  isRecord,
  legacyRequest,
  legacyUpload,
  messageFrom,
  readNumber,
  readString,
  recordArray,
  requireSession,
  type UnknownRecord,
} from "@/lib/erp-legacy";

/**
 * Front desk and front desk report.
 *
 * Backed by `App\Http\Controllers\api\FrontDeskApiController` on the stateless,
 * CSRF-exempt `api/*` routes:
 *   GET  api/front-desk              -> log + staff list + whether the caller is admin
 *   GET  api/front-desk/report       -> date-ranged log for the academic year
 *   GET  api/front-desk/{id}         -> one entry (for editing)
 *   POST api/front-desk              -> create (multipart photo)
 *   POST api/front-desk/{id}         -> update (multipart photo)
 *   POST api/front-desk/{id}/delete  -> delete
 *
 * The Blade-era `frontdesk/frontdesk` routes are not used: `store()`/`update()`
 * insert `$request->except([...])` verbatim, so the API context parameters land
 * in the SQL ("Unknown column 'type'"), and `edit()` returns a Blade view with
 * no API mode. Role scoping still happens server-side — a non-admin profile
 * only ever receives the entries addressed to it.
 */

const PATH = "api/front-desk";

/** The two options in the Blade `VISITOR_TYPE` select. */
export const FRONT_DESK_VISITOR_TYPES = [
  { value: "parents", label: "Parents" },
  { value: "other", label: "Other" },
] as const;

export type FrontDeskVisitorType = (typeof FRONT_DESK_VISITOR_TYPES)[number]["value"];

export type FrontDeskRecord = {
  id: number;
  title: string;
  description: string;
  studentId: number;
  studentName: string;
  visitorType: string;
  toWhomMeetId: number;
  userName: string;
  date: string;
  inTime: string;
  outTime: string;
  outDate: string;
  visitorPhoto: string;
};

export type StaffOption = {
  id: number;
  name: string;
};

export type FrontDeskBoard = {
  entries: FrontDeskRecord[];
  staff: StaffOption[];
  isAdmin: boolean;
};

export type FrontDeskInput = {
  visitorType: FrontDeskVisitorType | "";
  title: string;
  description: string;
  studentId: string;
  toWhomMeetId: string;
  date: string;
  inTime: string;
  outTime: string;
  photo: File | null;
};

function mapFrontDesk(record: UnknownRecord): FrontDeskRecord {
  return {
    id: readNumber(record.ID ?? record.id),
    title: readString(record.TITLE).trim(),
    description: readString(record.DESCRIPTION).trim(),
    studentId: readNumber(record.STUDENT_ID),
    studentName: readString(record.student_name).replace(/\s+/g, " ").trim(),
    visitorType: readString(record.VISITOR_TYPE).trim(),
    toWhomMeetId: readNumber(record.TO_WHOM_MEET),
    userName: readString(record.user_name).replace(/\s+/g, " ").trim(),
    date: readString(record.DATE).slice(0, 10),
    // TIME columns come back as HH:MM:SS; the form edits HH:MM.
    inTime: readString(record.IN_TIME).slice(0, 5),
    outTime: readString(record.OUT_TIME).slice(0, 5),
    outDate: readString(record.OUT_DATE).slice(0, 10),
    visitorPhoto: readString(record.VISITOR_PHOTO).trim(),
  };
}

export async function loadFrontDeskBoard(): Promise<FrontDeskBoard> {
  const payload = await legacyRequest(PATH);
  const data = isRecord(payload.data) ? payload.data : {};

  return {
    entries: recordArray(data.entries).map(mapFrontDesk),
    staff: recordArray(data.staff)
      .map((record) => ({
        id: readNumber(record.id),
        name: readString(record.name).replace(/\s+/g, " ").trim(),
      }))
      .filter((option) => option.id > 0 && option.name),
    isAdmin: Boolean(data.is_admin),
  };
}

export async function loadFrontDeskEntry(id: number): Promise<FrontDeskRecord | null> {
  const payload = await legacyRequest(`${PATH}/${id}`);
  const data = isRecord(payload.data) ? payload.data : {};
  return isRecord(data.entry) ? mapFrontDesk(data.entry) : null;
}

function frontDeskFormData(input: FrontDeskInput): FormData {
  const formData = new FormData();
  formData.append("VISITOR_TYPE", input.visitorType);
  formData.append("TITLE", input.title);
  formData.append("DESCRIPTION", input.description);
  formData.append("STUDENT_ID", input.studentId);
  formData.append("TO_WHOM_MEET", input.toWhomMeetId);
  formData.append("DATE", input.date);
  formData.append("IN_TIME", input.inTime);
  if (input.outTime) formData.append("OUT_TIME", input.outTime);
  if (input.photo) formData.append("VISITOR_PHOTO", input.photo);
  return formData;
}

export async function createFrontDeskEntry(input: FrontDeskInput): Promise<string> {
  const payload = await legacyUpload(PATH, frontDeskFormData(input));
  return messageFrom(payload, "Front desk entry added successfully.");
}

export async function updateFrontDeskEntry(
  id: number,
  input: FrontDeskInput
): Promise<string> {
  const payload = await legacyUpload(`${PATH}/${id}`, frontDeskFormData(input));
  return messageFrom(payload, "Front desk entry updated successfully.");
}

export async function deleteFrontDeskEntry(id: number): Promise<string> {
  const session = requireSession();
  const payload = await legacyRequest(`${PATH}/${id}/delete`, {
    method: "POST",
    session,
    body: {},
  });
  return messageFrom(payload, "Front desk entry deleted successfully.");
}

export async function loadFrontDeskReport(
  fromDate: string,
  toDate: string
): Promise<FrontDeskRecord[]> {
  const payload = await legacyRequest(`${PATH}/report`, {
    query: {
      // Each bound is optional; the controller applies whichever is set.
      from_date: fromDate,
      to_date: toDate,
    },
  });
  const data = isRecord(payload.data) ? payload.data : {};
  return recordArray(data.entries).map(mapFrontDesk);
}
