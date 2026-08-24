import {
  legacyRequest,
  messageFrom,
  readNumber,
  readString,
  recordArray,
  type UnknownRecord,
} from "@/lib/erp-legacy";

/**
 * PTM time slot master, PTM attended status and PTM report.
 *
 * Laravel source of truth: the two controllers in `App\Http\Controllers\ptm`,
 * routed under the `ptm` prefix.
 *   GET    ptm/add_ptm_time_slot_master             -> slots (already type=API aware)
 *   POST   ptm/add_ptm_time_slot_master             -> add one row per from/to pair
 *   PUT    ptm/add_ptm_time_slot_master/{id}        -> update a single slot
 *   DELETE ptm/add_ptm_time_slot_master/{id}        -> delete a slot
 *   GET    ptm/add_ptm_attened_status               -> standards + teachers
 *   GET    ptm/add_ptm_attened_status/create?...    -> bookable students for a slot
 *   POST   ptm/add_ptm_attened_status               -> record attendance
 *   GET    ptm/ptm_report?Search=1&...              -> booking report
 */

const SLOT_PATH = "ptm/add_ptm_time_slot_master";
const STATUS_PATH = "ptm/add_ptm_attened_status";
const REPORT_PATH = "ptm/ptm_report";

/** The two options in the Blade `attened_status` select. */
export const PTM_ATTENDED_STATUSES = ["Yes", "No"] as const;
export type PtmAttendedStatus = (typeof PTM_ATTENDED_STATUSES)[number];

export type PtmTimeSlot = {
  id: number;
  standardId: number;
  divisionId: number;
  standardName: string;
  divisionName: string;
  title: string;
  ptmDate: string;
  fromTime: string;
  toTime: string;
};

export type PtmTimeSlotInput = {
  standardId: string;
  divisionId: string;
  title: string;
  ptmDate: string;
  slots: Array<{ fromTime: string; toTime: string }>;
};

export type PtmStudentSlot = {
  studentId: number;
  studentName: string;
  stdDiv: string;
  mobile: string;
  title: string;
  ptmDate: string;
  timeSlot: string;
  timeSlotId: number;
};

export type PtmAttendanceEntry = {
  studentId: number;
  status: PtmAttendedStatus | "";
  remarks: string;
};

export type PtmReportRow = {
  id: number;
  studentName: string;
  standard: string;
  division: string;
  mobile: string;
  slotTitle: string;
  ptmDate: string;
  fromTime: string;
  toTime: string;
  confirmStatus: string;
  attendedStatus: string;
  attendedRemarks: string;
};

function mapSlot(record: UnknownRecord): PtmTimeSlot {
  return {
    id: readNumber(record.id),
    standardId: readNumber(record.standard_id),
    divisionId: readNumber(record.division_id),
    standardName: readString(record.standard_name).trim(),
    divisionName: readString(record.division_name).trim(),
    title: readString(record.title).trim(),
    ptmDate: readString(record.ptm_date),
    fromTime: readString(record.from_time),
    toTime: readString(record.to_time),
  };
}

/**
 * `getData()` already reads `sub_institute_id`, `syear`, `standard_id` and
 * `division_id` from the request when `type=API`, so the class filter is
 * applied server-side.
 */
export async function loadPtmTimeSlots(filter?: {
  standardId?: string;
  divisionId?: string;
}): Promise<PtmTimeSlot[]> {
  const payload = await legacyRequest(SLOT_PATH, {
    query: {
      ...(filter?.standardId ? { standard_id: filter.standardId } : {}),
      ...(filter?.divisionId ? { division_id: filter.divisionId } : {}),
    },
  });
  return recordArray(payload.data).map(mapSlot).filter((slot) => slot.id > 0);
}

/** `store()` writes one row per from/to pair, all sharing the title and date. */
export async function createPtmTimeSlots(input: PtmTimeSlotInput): Promise<string> {
  const payload = await legacyRequest(SLOT_PATH, {
    method: "POST",
    body: {
      standard_id: input.standardId,
      division_id: input.divisionId,
      title: input.title,
      ptm_date: input.ptmDate,
      from_time: input.slots.map((slot) => slot.fromTime),
      to_time: input.slots.map((slot) => slot.toTime),
    },
  });
  return messageFrom(payload, "PTM time slot added successfully.");
}

/** `update()` only ever reads the first from/to pair. */
export async function updatePtmTimeSlot(
  id: number,
  input: Omit<PtmTimeSlotInput, "slots"> & { fromTime: string; toTime: string }
): Promise<string> {
  const payload = await legacyRequest(`${SLOT_PATH}/${id}`, {
    method: "POST",
    query: { _method: "PUT" },
    body: {
      _method: "PUT",
      standard_id: input.standardId,
      division_id: input.divisionId,
      title: input.title,
      ptm_date: input.ptmDate,
      from_time: [input.fromTime],
      to_time: [input.toTime],
    },
  });
  return messageFrom(payload, "PTM time slot updated successfully.");
}

export async function deletePtmTimeSlot(id: number): Promise<string> {
  const payload = await legacyRequest(`${SLOT_PATH}/${id}`, {
    method: "POST",
    query: { _method: "DELETE" },
    body: { _method: "DELETE" },
  });
  return messageFrom(payload, "PTM time slot deleted successfully.");
}

/**
 * `create()` joins the slot master to the enrolment of the same standard and
 * division, so every student of that class gets a row per matching slot.
 */
export async function searchPtmStudents(filter: {
  gradeId: string;
  standardId: string;
  divisionId: string;
  ptmTitleId: string;
  date: string;
}): Promise<PtmStudentSlot[]> {
  const payload = await legacyRequest(`${STATUS_PATH}/create`, {
    query: {
      grade: filter.gradeId,
      standard: filter.standardId,
      division: filter.divisionId,
      ptm_title: filter.ptmTitleId,
      date: filter.date,
    },
  });

  return recordArray(payload.student_data).map((record) => ({
    studentId: readNumber(record.CHECKBOX),
    studentName: readString(record.STUDENT).replace(/\s+/g, " ").trim(),
    stdDiv: readString(record.std_div).trim(),
    mobile: readString(record.mobile).trim(),
    title: readString(record.title).trim(),
    ptmDate: readString(record.PTM_DATE),
    timeSlot: readString(record.TIME_SLOT),
    timeSlotId: readNumber(record.ptm_time_slot_id),
  }));
}

/**
 * `store()` keys every attribute by student id and only writes rows whose id
 * appears in `attened_status`, so the hidden slot metadata must be sent in the
 * same keyed shape.
 */
export async function savePtmAttendance(
  rows: PtmStudentSlot[],
  entries: PtmAttendanceEntry[]
): Promise<string> {
  const selected = entries.filter((entry) => entry.status !== "");
  const byId = new Map(rows.map((row) => [row.studentId, row]));

  const attendedStatus: Record<string, string> = {};
  const attendedRemarks: Record<string, string> = {};
  const timeSlotId: Record<string, number> = {};
  const ptmDate: Record<string, string> = {};
  const timeSlot: Record<string, string> = {};
  const stdDiv: Record<string, string> = {};
  const mobile: Record<string, string> = {};
  const title: Record<string, string> = {};

  for (const entry of selected) {
    const row = byId.get(entry.studentId);
    if (!row) continue;
    const key = String(entry.studentId);
    attendedStatus[key] = entry.status;
    attendedRemarks[key] = entry.remarks;
    timeSlotId[key] = row.timeSlotId;
    ptmDate[key] = row.ptmDate;
    timeSlot[key] = row.timeSlot;
    stdDiv[key] = row.stdDiv;
    mobile[key] = row.mobile;
    title[key] = row.title;
  }

  const payload = await legacyRequest(STATUS_PATH, {
    method: "POST",
    body: {
      students: selected.map((entry) => entry.studentId),
      attened_status: attendedStatus,
      attened_remarks: attendedRemarks,
      ptm_time_slot_id: timeSlotId,
      PTM_DATE: ptmDate,
      TIME_SLOT: timeSlot,
      std_div: stdDiv,
      mobile,
      title,
    },
  });
  return messageFrom(payload, "PTM attendance saved successfully.");
}

export async function loadPtmReport(filter: {
  fromDate: string;
  toDate: string;
  gradeId: string;
  standardId: string;
  divisionId: string;
}): Promise<PtmReportRow[]> {
  const payload = await legacyRequest(REPORT_PATH, {
    query: {
      // ptmReport() only runs the query when `Search` is present.
      Search: 1,
      from_date: filter.fromDate,
      to_date: filter.toDate,
      grade: filter.gradeId,
      standard: filter.standardId,
      division: filter.divisionId,
    },
  });

  return recordArray(payload.details).map((record) => ({
    id: readNumber(record.ID ?? record.id),
    studentName: readString(record.student_name).replace(/\s+/g, " ").trim(),
    standard: readString(record.standard).trim(),
    division: readString(record.division).trim(),
    mobile: readString(record.mobile).trim(),
    slotTitle: readString(record.slot_title).trim(),
    ptmDate: readString(record.DATE),
    fromTime: readString(record.from_time),
    toTime: readString(record.to_time),
    confirmStatus: readString(record.CONFIRM_STATUS).trim(),
    attendedStatus: readString(record.PTM_ATTENDED_STATUS).trim(),
    attendedRemarks: readString(record.PTM_ATTENDED_REMARKS).trim(),
  }));
}
