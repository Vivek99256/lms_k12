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
import { toIsoDate, todayIso } from "./dates";

/**
 * Visitor management.
 *
 * Laravel source of truth:
 * `App\Http\Controllers\visitor_management\visitor_masterController` (writes)
 * and `App\Http\Controllers\api\adminapiController` (reads).
 *
 * Reads deliberately use the `adminapi` endpoints rather than the Blade-era
 * ones, because `routes/adminapi.php` is registered without the `web`
 * middleware group — those routes are JWT-guarded, stateless and CSRF-free,
 * whereas `index()` / `show_visitor_report_data()` read the institute from the
 * Laravel session:
 *   POST get_adminVisitorListAPI  -> register for a date range
 *   POST get_adminStudentList     -> student dropdown
 *   POST get_adminTeacherList     -> staff dropdown fallback
 *
 * Writes still go to the resource route, which is the only implementation:
 *   POST   visitor_management/add_visitor_master        -> store()
 *   PUT    visitor_management/add_visitor_master/{id}   -> update()
 *   DELETE visitor_management/add_visitor_master/{id}   -> destroy()
 *
 * `GET visitor_management/add_visitor_master/create` is NOT used: it builds a
 * stdClass and passes it to `is_mobile()`, whose `type=API` branch does
 * `isset($data["status_code"])`. Array access on a stdClass is a fatal
 * "Cannot use object of type stdClass as array" on PHP 8, so that endpoint
 * cannot serve an API caller at all. See `visitorTypeSourceMissing` below.
 */

const BASE_PATH = "visitor_management/add_visitor_master";
const REGISTER_PATH = "get_adminVisitorListAPI";
const STUDENT_LIST_PATH = "get_adminStudentList";
const TEACHER_LIST_PATH = "get_adminTeacherList";
const STAFF_BOOTSTRAP_PATH = "api/user-reports/bootstrap";

/** The three radio options in the Blade form. `pickUp` drives the OTP flow. */
export const APPOINTMENT_TYPES = [
  { value: "Direct", label: "Direct" },
  { value: "Prior", label: "Prior" },
  { value: "pickUp", label: "Pick-up student" },
] as const;

export type AppointmentType = (typeof APPOINTMENT_TYPES)[number]["value"];

export type VisitorRecord = {
  id: number;
  appointmentType: string;
  visitorType: string;
  visitorTypeName: string;
  name: string;
  contact: string;
  email: string;
  comingFrom: string;
  toMeet: string;
  staffName: string;
  relation: string;
  purpose: string;
  visitorIdCard: string;
  photo: string;
  meetDate: string;
  inTime: string;
  outTime: string;
  createdBy: string;
  /** True while the visitor has no check-out time. */
  stillInside: boolean;
};

export type NamedOption = {
  id: number;
  name: string;
};

export type VisitorStudentOption = NamedOption & {
  enrollmentNo: string;
  mobile: string;
};

export type VisitorFormSources = {
  visitorTypes: NamedOption[];
  staff: NamedOption[];
  students: VisitorStudentOption[];
  /**
   * True when no visitor type could be resolved. The ERP has no endpoint that
   * lists the `visitor_type` master, so the options below are derived from
   * types already seen in the register; a brand-new institute yields none.
   */
  visitorTypeSourceMissing: boolean;
};

export type VisitorInput = {
  appointmentType: AppointmentType;
  visitorType: string;
  name: string;
  contact: string;
  email: string;
  comingFrom: string;
  toMeet: string;
  relation: string;
  purpose: string;
  visitorIdCard: string;
  meetDate: string;
  inTime: string;
  photo: File | null;
};

function mapVisitor(record: UnknownRecord): VisitorRecord {
  const outTime = readString(record.out_time).trim();
  return {
    id: readNumber(record.id),
    appointmentType: readString(record.appointment_type),
    visitorType: readString(record.visitor_type),
    visitorTypeName: readString(record.visitor_type_name),
    name: readString(record.name).trim(),
    contact: readString(record.contact).trim(),
    email: readString(record.email).trim(),
    comingFrom: readString(record.coming_from).trim(),
    toMeet: readString(record.to_meet),
    staffName: readString(record.staff_name).replace(/\s+/g, " ").trim(),
    relation: readString(record.relation).trim(),
    purpose: readString(record.purpose).trim(),
    visitorIdCard: readString(record.visitor_idcard).trim(),
    photo: readString(record.visitor_photo ?? record.photo).trim(),
    meetDate: readString(record.meet_date),
    inTime: readString(record.in_time),
    outTime,
    createdBy: readString(record.created_by).replace(/\s+/g, " ").trim(),
    stillInside: !outTime,
  };
}

/**
 * Register for a date range. `get_adminVisitorListAPI` answers an empty range
 * with `status: 0` + "No Record", which is a normal empty result, not an error.
 */
export async function loadVisitorRegister(
  fromDate: string,
  toDate: string
): Promise<VisitorRecord[]> {
  const session = requireSession();
  const payload = await legacyRequest(REGISTER_PATH, {
    method: "POST",
    session,
    tolerateStatusZero: true,
    body: { from_date: fromDate, to_date: toDate },
  });
  return recordArray(payload.data).map(mapVisitor);
}

export function loadTodaysVisitors(): Promise<VisitorRecord[]> {
  const today = todayIso();
  return loadVisitorRegister(today, today);
}

export async function loadStudentOptions(): Promise<VisitorStudentOption[]> {
  const session = requireSession();
  const payload = await legacyRequest(STUDENT_LIST_PATH, {
    method: "POST",
    session,
    tolerateStatusZero: true,
    body: {},
  });
  return recordArray(payload.data)
    .map((record) => ({
      id: readNumber(record.id),
      name: readString(record.student_name).replace(/\s+/g, " ").trim(),
      enrollmentNo: readString(record.enrollment_no).trim(),
      mobile: readString(record.mobile).trim(),
    }))
    .filter((option) => option.id > 0 && option.name)
    .sort((left, right) => left.name.localeCompare(right.name));
}

/**
 * Staff for the "to meet" dropdown. The Blade form lists every active user of
 * the institute; the closest stateless equivalents are the user-report
 * bootstrap (all users, but gated on `user_report.index` view rights) and the
 * admin teacher list (no rights gate, teachers only). Prefer the former and
 * fall back to the latter so a front-desk profile still gets a usable list.
 */
async function loadStaffOptions(): Promise<NamedOption[]> {
  const session = requireSession();

  try {
    const payload = await legacyRequest(STAFF_BOOTSTRAP_PATH, { session });
    const data = isRecord(payload.data) ? payload.data : {};
    const employees = recordArray(data.employees)
      .map((record) => ({
        id: readNumber(record.id),
        name: readString(record.name).replace(/\s+/g, " ").replace(/\s*-\s*/g, " ").trim(),
      }))
      .filter((option) => option.id > 0 && option.name);
    if (employees.length > 0) return employees;
  } catch {
    // No user-report rights — fall through to the teacher list.
  }

  const payload = await legacyRequest(TEACHER_LIST_PATH, {
    method: "POST",
    session,
    tolerateStatusZero: true,
    body: {},
  });
  return recordArray(payload.data)
    .map((record) => ({
      id: readNumber(record.id),
      name: readString(record.user_full_name).replace(/\s+/g, " ").trim(),
    }))
    .filter((option) => option.id > 0 && option.name)
    .sort((left, right) => left.name.localeCompare(right.name));
}

/**
 * Visitor types actually in use, read back from the register. This is a stand-in
 * for the `visitor_type` master, which has no API of its own — see the module
 * note above.
 */
async function loadVisitorTypes(): Promise<NamedOption[]> {
  const today = new Date();
  const twoYearsAgo = new Date(today.getFullYear() - 2, today.getMonth(), today.getDate());
  const register = await loadVisitorRegister(toIsoDate(twoYearsAgo), toIsoDate(today));

  const byId = new Map<number, string>();
  for (const visitor of register) {
    const id = Number(visitor.visitorType);
    if (!Number.isFinite(id) || id <= 0) continue;
    const name = visitor.visitorTypeName.trim();
    if (name && !byId.has(id)) byId.set(id, name);
  }
  return Array.from(byId, ([id, name]) => ({ id, name })).sort((left, right) =>
    left.name.localeCompare(right.name)
  );
}

export async function loadVisitorFormSources(): Promise<VisitorFormSources> {
  const [students, staff, visitorTypes] = await Promise.all([
    loadStudentOptions(),
    loadStaffOptions(),
    loadVisitorTypes().catch(() => [] as NamedOption[]),
  ]);

  return {
    students,
    staff,
    visitorTypes,
    visitorTypeSourceMissing: visitorTypes.length === 0,
  };
}

/**
 * Check-in. `store()` accepts `type=API` and reads the institute from the
 * request, so only the multipart photo needs the file proxy.
 */
export async function createVisitor(input: VisitorInput): Promise<string> {
  const formData = new FormData();
  formData.append("appointment_type", input.appointmentType);
  formData.append("visitor_type", input.visitorType);
  formData.append("name", input.name);
  formData.append("contact", input.contact);
  formData.append("email", input.email);
  formData.append("coming_from", input.comingFrom);
  formData.append("to_meet", input.toMeet);
  formData.append("relation", input.relation);
  formData.append("purpose", input.purpose);
  formData.append("visitor_idcard", input.visitorIdCard);
  // Direct visits are stamped server-side with today's date and the current time.
  if (input.appointmentType !== "Direct") {
    formData.append("meet_date", input.meetDate);
    formData.append("in_time", input.inTime);
  }
  if (input.photo) formData.append("visitor_photo", input.photo);

  const payload = await legacyUpload(BASE_PATH, formData);
  return messageFrom(payload, "Visitor details added successfully.");
}

/**
 * Check-out / edit. `update()` stamps `out_time` only when `hid_out_time` is
 * absent, and sends the exit SMS only the first time `exit_msg_sent` is null.
 */
export async function updateVisitor(
  id: number,
  input: VisitorInput,
  existing: VisitorRecord
): Promise<string> {
  const formData = new FormData();
  formData.append("_method", "PUT");
  formData.append("appointment_type", input.appointmentType);
  formData.append("visitor_type", input.visitorType);
  formData.append("name", input.name);
  formData.append("contact", input.contact);
  formData.append("email", input.email);
  formData.append("coming_from", input.comingFrom);
  formData.append("to_meet", input.toMeet);
  formData.append("relation", input.relation);
  formData.append("purpose", input.purpose);
  formData.append("visitor_idcard", input.visitorIdCard);
  if (existing.outTime) formData.append("hid_out_time", existing.outTime);
  if (existing.photo) formData.append("hid_photo", existing.photo);
  if (input.photo) formData.append("visitor_photo", input.photo);

  const payload = await legacyUpload(`${BASE_PATH}/${id}`, formData, { _method: "PUT" });
  return messageFrom(payload, "Visitor updated successfully.");
}

export async function deleteVisitor(id: number): Promise<string> {
  const payload = await legacyRequest(`${BASE_PATH}/${id}`, {
    method: "POST",
    // Laravel's method override reads `_method` from the query string.
    query: { _method: "DELETE" },
    body: { _method: "DELETE" },
  });
  return messageFrom(payload, "Visitor deleted successfully.");
}

export function loadVisitorReport(fromDate: string, toDate: string): Promise<VisitorRecord[]> {
  return loadVisitorRegister(fromDate, toDate);
}
