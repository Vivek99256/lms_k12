import {
  appendCommonParams,
  buildSessionContext,
  createAuthHeaders,
  normalizeApiStatus,
  readNumber,
  readString,
  type ApiEnvelope,
} from "@/lib/erp-client";

export type PermissionSet = { view: boolean; add: boolean; edit: boolean; delete: boolean; admin: boolean };
export type Option = { id: number; name: string };
export type UserProfile = Option & { parentId: number; description: string; sortOrder: number; status: number };
export type UserRecord = {
  id: number; userName: string; nameSuffix: string; firstName: string; middleName: string; lastName: string;
  email: string; mobile: string; gender: string; birthdate: string; address: string; city: string; state: string;
  pincode: string; userProfileId: number; profileName: string; joinYear: string; totalLecture: number | null;
  subjectIds: number[]; jobtitleId: number | null; departmentId: number | null; employeeNo: string;
  qualification: string; occupation: string; status: number;
};
export type UserBootstrap = {
  profiles: UserProfile[]; subjects: Option[]; departments: Option[]; jobTitles: Option[]; employees: Option[];
  nameSuffixes: string[]; newEmployeeNo: string;
};
export type UserForm = Omit<UserRecord, "id" | "profileName" | "status"> & { password: string };
export type ReportField = { id: number; group: string; name: string; label: string };
export type ReportColumn = { key: string; label: string };

type RecordValue = Record<string, unknown>;
const isRecord = (value: unknown): value is RecordValue => Boolean(value && typeof value === "object" && !Array.isArray(value));
const records = (value: unknown) => Array.isArray(value) ? value.filter(isRecord) : [];
const message = (value: unknown, fallback: string) => isRecord(value) ? readString(value.message) || fallback : fallback;

async function request(path: string, init?: RequestInit): Promise<RecordValue> {
  const session = buildSessionContext();
  if (!session.token || !session.subInstituteId || !session.userId) throw new Error("Your login session is incomplete.");
  const params = new URLSearchParams();
  appendCommonParams(params, session);
  params.set("user_id", session.userId);
  const response = await fetch(`/api/proxy?path=${encodeURIComponent(`api/${path}`)}&${params}`, {
    cache: "no-store", ...init,
    headers: { ...createAuthHeaders(session, init?.body ? "application/json" : undefined), ...init?.headers },
  });
  const payload: unknown = await response.json();
  if (!response.ok || (isRecord(payload) && ["0", "2"].includes(normalizeApiStatus(payload as ApiEnvelope)))) {
    throw new Error(message(payload, `Request failed (${response.status}).`));
  }
  return isRecord(payload) ? payload : {};
}

function body(values: RecordValue) {
  const session = buildSessionContext();
  return JSON.stringify({ ...values, type: "API", sub_institute_id: Number(session.subInstituteId), user_id: Number(session.userId), syear: Number(session.syear) });
}
const option = (row: RecordValue): Option => ({ id: readNumber(row.id), name: readString(row.name) });
const profile = (row: RecordValue): UserProfile => ({ ...option(row), parentId: readNumber(row.parent_id), description: readString(row.description), sortOrder: readNumber(row.sort_order), status: readNumber(row.status) });
const permissions = (value: unknown): PermissionSet => {
  const row = isRecord(value) ? value : {};
  return { view: Boolean(row.view), add: Boolean(row.add), edit: Boolean(row.edit), delete: Boolean(row.delete), admin: Boolean(row.admin) };
};
const user = (row: RecordValue): UserRecord => ({
  id: readNumber(row.id), userName: readString(row.user_name), nameSuffix: readString(row.name_suffix), firstName: readString(row.first_name),
  middleName: readString(row.middle_name), lastName: readString(row.last_name), email: readString(row.email), mobile: readString(row.mobile),
  gender: readString(row.gender), birthdate: readString(row.birthdate), address: readString(row.address), city: readString(row.city),
  state: readString(row.state), pincode: readString(row.pincode), userProfileId: readNumber(row.user_profile_id),
  profileName: readString(row.profile_name), joinYear: readString(row.join_year), totalLecture: row.total_lecture == null ? null : readNumber(row.total_lecture),
  subjectIds: readString(row.subject_ids).split(",").map(Number).filter(Boolean), jobtitleId: row.jobtitle_id == null ? null : readNumber(row.jobtitle_id),
  departmentId: row.department_id == null ? null : readNumber(row.department_id), employeeNo: readString(row.employee_no),
  qualification: readString(row.qualification), occupation: readString(row.occupation), status: readNumber(row.status),
});
function bootstrap(value: unknown): UserBootstrap {
  const row = isRecord(value) ? value : {};
  return {
    profiles: records(row.profiles).map(profile), subjects: records(row.subjects).map(option), departments: records(row.departments).map(option),
    jobTitles: records(row.job_titles).map(option), employees: records(row.employees).map(option),
    nameSuffixes: Array.isArray(row.name_suffixes) ? row.name_suffixes.map(readString) : [], newEmployeeNo: readString(row.new_employee_no),
  };
}

export async function loadUsers() {
  const payload = await request("users"); const data = isRecord(payload.data) ? payload.data : {};
  return { users: records(data.users).map(user), bootstrap: bootstrap(data.bootstrap), permissions: permissions(data.permissions) };
}
export async function saveUser(values: UserForm, id?: number) {
  const payload = await request(id ? `users/${id}` : "users", { method: "POST", body: body({
    name_suffix: values.nameSuffix, first_name: values.firstName, middle_name: values.middleName, last_name: values.lastName,
    user_name: values.userName, email: values.email, mobile: values.mobile, gender: values.gender, birthdate: values.birthdate,
    address: values.address, city: values.city, state: values.state, pincode: values.pincode, user_profile_id: values.userProfileId,
    join_year: values.joinYear, password: values.password || undefined, subject_ids: values.subjectIds, total_lecture: values.totalLecture,
    jobtitle_id: values.jobtitleId, department_id: values.departmentId, employee_no: values.employeeNo,
    qualification: values.qualification, occupation: values.occupation,
  }) });
  return message(payload, "User saved successfully.");
}
export async function deactivateUser(id: number) {
  const payload = await request(`users/${id}/deactivate`, { method: "POST", body: body({}) });
  return message(payload, "User deactivated successfully.");
}
export async function loadProfiles() {
  const payload = await request("user-profiles"); const data = isRecord(payload.data) ? payload.data : {};
  return { profiles: records(data.profiles).map(profile), permissions: permissions(data.permissions) };
}
export async function saveProfile(values: Omit<UserProfile, "id" | "status">, id?: number) {
  const payload = await request(id ? `user-profiles/${id}` : "user-profiles", { method: "POST", body: body({ name: values.name, description: values.description, parent_id: values.parentId, sort_order: values.sortOrder }) });
  return message(payload, "User profile saved successfully.");
}
export async function deleteProfile(id: number) {
  const payload = await request(`user-profiles/${id}/delete`, { method: "POST", body: body({}) });
  return message(payload, "User profile deleted successfully.");
}
export async function loadReportBootstrap() {
  const payload = await request("user-reports/bootstrap"); const data = isRecord(payload.data) ? payload.data : {};
  return {
    fields: records(data.fields).map((row) => ({ id: readNumber(row.id), group: readString(row.column_header), name: readString(row.field_name), label: readString(row.field_label) })),
    profiles: records(data.profiles).map(option), employees: records(data.employees).map(option), permissions: permissions(data.permissions),
  };
}
export async function runUserReport(values: { fieldIds: number[]; profileIds: number[]; employeeIds: number[]; status: number }) {
  const payload = await request("user-reports/search", { method: "POST", body: body({ field_ids: values.fieldIds, profile_ids: values.profileIds, employee_ids: values.employeeIds, status: values.status }) });
  const data = isRecord(payload.data) ? payload.data : {};
  return { columns: records(data.headers).map((row) => ({ key: readString(row.key), label: readString(row.label) })), rows: records(data.rows) };
}
