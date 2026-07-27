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
 * Complaint management and complaint report.
 *
 * Backed by `App\Http\Controllers\api\ComplaintApiController` on the stateless,
 * CSRF-exempt `api/*` routes:
 *   GET  api/complaints[?from_date&to_date] -> list + status and user lookups
 *   POST api/complaints                     -> create (multipart attachment)
 *   POST api/complaints/{id}                -> update (multipart attachment)
 *   POST api/complaints/{id}/delete         -> delete
 *
 * The Blade-era `frontdesk/complaint` routes are not used: `store()`/`update()`
 * there insert `$request->except([...])` verbatim, so the API context
 * parameters land in the SQL and MySQL rejects the write with "Unknown column
 * 'type' in 'field list'". The API controller writes an explicit column
 * whitelist instead.
 *
 * The report screen sends the same `from_date` / `to_date` pair, so both menus
 * share one endpoint — the report is the filtered list.
 */

const PATH = "api/complaints";

export type ComplaintRecord = {
  id: number;
  title: string;
  description: string;
  date: string;
  complaintBy: string;
  solution: string;
  solutionById: number;
  solutionBy: string;
  attachment: string;
  createdDate: string;
};

export type ComplaintOption = {
  id: number;
  name: string;
};

export type ComplaintBoard = {
  complaints: ComplaintRecord[];
  /** `complaint_status` rows of type COMPLAIN. */
  statuses: string[];
  users: ComplaintOption[];
};

export type ComplaintInput = {
  title: string;
  description: string;
  date: string;
  attachment: File | null;
};

export type ComplaintUpdateInput = ComplaintInput & {
  solution: string;
  solutionById: string;
};

/** `store()` seeds every new complaint with this solution state. */
export const DEFAULT_COMPLAINT_SOLUTION = "PENDING";

function mapComplaint(record: UnknownRecord): ComplaintRecord {
  return {
    id: readNumber(record.ID ?? record.id),
    title: readString(record.TITLE).trim(),
    description: readString(record.DESCRIPTION).trim(),
    // The column is a DATETIME; the form only ever edits the date part.
    date: readString(record.DATE).slice(0, 10),
    complaintBy: readString(record.COMPLAINT_BY_NAME).replace(/\s+/g, " ").trim(),
    solution: readString(record.COMPLAINT_SOLUTION).trim(),
    solutionById: readNumber(record.COMPLAINT_SOLUTION_BY),
    solutionBy: readString(record.COMPLAINT_SOLUTION_BY_NAME).replace(/\s+/g, " ").trim(),
    attachment: readString(record.ATTACHEMENT).trim(),
    createdDate: readString(record.CREATED_DATE),
  };
}

export async function loadComplaintBoard(range?: {
  fromDate?: string;
  toDate?: string;
}): Promise<ComplaintBoard> {
  const payload = await legacyRequest(PATH, {
    query: {
      ...(range?.fromDate ? { from_date: range.fromDate } : {}),
      ...(range?.toDate ? { to_date: range.toDate } : {}),
    },
  });
  const data = isRecord(payload.data) ? payload.data : {};

  return {
    complaints: recordArray(data.complaints).map(mapComplaint),
    statuses: recordArray(data.statuses)
      .map((record) => readString(record.TITLE).trim())
      .filter(Boolean),
    users: recordArray(data.users)
      .map((record) => ({
        id: readNumber(record.id),
        name: readString(record.name).replace(/\s+/g, " ").trim(),
      }))
      .filter((option) => option.id > 0 && option.name),
  };
}

export async function loadComplaints(range?: {
  fromDate?: string;
  toDate?: string;
}): Promise<ComplaintRecord[]> {
  const board = await loadComplaintBoard(range);
  return board.complaints;
}

function complaintFormData(input: ComplaintInput): FormData {
  const formData = new FormData();
  formData.append("TITLE", input.title);
  formData.append("DESCRIPTION", input.description);
  formData.append("DATE", input.date);
  if (input.attachment) formData.append("ATTACHEMENT", input.attachment);
  return formData;
}

export async function createComplaint(input: ComplaintInput): Promise<string> {
  const payload = await legacyUpload(PATH, complaintFormData(input));
  return messageFrom(payload, "Complaint added successfully.");
}

export async function updateComplaint(
  id: number,
  input: ComplaintUpdateInput
): Promise<string> {
  const formData = complaintFormData(input);
  formData.append("COMPLAINT_SOLUTION", input.solution);
  if (input.solutionById) formData.append("COMPLAINT_SOLUTION_BY", input.solutionById);

  const payload = await legacyUpload(`${PATH}/${id}`, formData);
  return messageFrom(payload, "Complaint updated successfully.");
}

export async function deleteComplaint(id: number): Promise<string> {
  const session = requireSession();
  const payload = await legacyRequest(`${PATH}/${id}/delete`, {
    method: "POST",
    session,
    body: {},
  });
  return messageFrom(payload, "Complaint deleted successfully.");
}
