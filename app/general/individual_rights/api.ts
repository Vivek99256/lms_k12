import {
  appendCommonParams,
  buildSessionContext,
  createAuthHeaders,
  normalizeApiStatus,
  readNumber,
  readString,
  type ApiEnvelope,
} from "@/lib/erp-client";

export type IndividualRightsPermissionSet = {
  view: boolean;
  add: boolean;
  edit: boolean;
  delete: boolean;
  admin: boolean;
};

export type IndividualRightsProfile = {
  id: number;
  name: string;
  status: number;
  sortOrder: number;
};

export type IndividualRightsUser = {
  id: number;
  userName: string;
};

export type IndividualRightsSummaryRecord = {
  id: number;
  profileId: number;
  profileName: string;
  userId: number;
  userName: string;
  menuId: number;
  menuName: string;
  canView: boolean;
  canAdd: boolean;
  canEdit: boolean;
  canDelete: boolean;
};

export type IndividualRightsMatrixRow = {
  menuId: number;
  name: string;
  level: 1 | 2 | 3;
  menuType: string;
};

export type IndividualRightsSelection = {
  view: boolean;
  add: boolean;
  edit: boolean;
  delete: boolean;
};

export type IndividualRightsMatrixState = {
  rows: IndividualRightsMatrixRow[];
  selected: Record<number, IndividualRightsSelection>;
};

type RecordValue = Record<string, unknown>;

function isRecord(value: unknown): value is RecordValue {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function records(value: unknown): RecordValue[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function message(value: unknown, fallback: string): string {
  return isRecord(value) ? readString(value.message) || fallback : fallback;
}

function permissions(value: unknown): IndividualRightsPermissionSet {
  const row = isRecord(value) ? value : {};
  return {
    view: Boolean(row.view),
    add: Boolean(row.add),
    edit: Boolean(row.edit),
    delete: Boolean(row.delete),
    admin: Boolean(row.admin),
  };
}

async function request(path: string, init?: RequestInit): Promise<RecordValue> {
  const session = buildSessionContext();
  if (!session.token || !session.subInstituteId || !session.userId) {
    throw new Error("Your login session is incomplete.");
  }

  const params = new URLSearchParams();
  appendCommonParams(params, session);
  params.set("user_id", session.userId);

  const response = await fetch(`/api/proxy?path=${encodeURIComponent(`api/${path}`)}&${params.toString()}`, {
    cache: "no-store",
    ...init,
    headers: {
      ...createAuthHeaders(session, init?.body ? "application/json" : undefined),
      ...init?.headers,
    },
  });

  const payload: unknown = await response.json();
  if (!response.ok || (isRecord(payload) && ["0", "2"].includes(normalizeApiStatus(payload as ApiEnvelope)))) {
    throw new Error(message(payload, `Request failed (${response.status}).`));
  }

  return isRecord(payload) ? payload : {};
}

function body(values: RecordValue) {
  const session = buildSessionContext();
  return JSON.stringify({
    ...values,
    type: "API",
    sub_institute_id: Number(session.subInstituteId),
    user_id: Number(session.userId),
    syear: Number(session.syear),
  });
}

function profile(row: RecordValue): IndividualRightsProfile {
  return {
    id: readNumber(row.id),
    name: readString(row.name).trim(),
    status: readNumber(row.status),
    sortOrder: readNumber(row.sort_order),
  };
}

function user(row: RecordValue): IndividualRightsUser {
  return {
    id: readNumber(row.id),
    userName: readString(row.user_name).trim(),
  };
}

function summaryRecord(row: RecordValue): IndividualRightsSummaryRecord {
  return {
    id: readNumber(row.id),
    profileId: readNumber(row.profile_id),
    profileName: readString(row.profile_name).trim(),
    userId: readNumber(row.user_id),
    userName: readString(row.user_name).trim(),
    menuId: readNumber(row.menu_id),
    menuName: readString(row.menu_name).trim(),
    canView: readNumber(row.can_view) === 1,
    canAdd: readNumber(row.can_add) === 1,
    canEdit: readNumber(row.can_edit) === 1,
    canDelete: readNumber(row.can_delete) === 1,
  };
}

function matrixRow(row: RecordValue): IndividualRightsMatrixRow {
  const level = readNumber(row.level);
  return {
    menuId: readNumber(row.menu_id),
    name: readString(row.name).trim(),
    level: level === 2 || level === 3 ? level : 1,
    menuType: readString(row.menu_type).trim(),
  };
}

function selectionMap(value: unknown): Record<number, IndividualRightsSelection> {
  if (!isRecord(value)) return {};

  const mapped: Record<number, IndividualRightsSelection> = {};
  for (const [menuId, raw] of Object.entries(value)) {
    const id = Number(menuId);
    const row = isRecord(raw) ? raw : {};
    if (!Number.isFinite(id) || id <= 0) continue;
    mapped[id] = {
      view: Boolean(row.view),
      add: Boolean(row.add),
      edit: Boolean(row.edit),
      delete: Boolean(row.delete),
    };
  }
  return mapped;
}

export async function loadIndividualRightsDashboard(): Promise<{
  profiles: IndividualRightsProfile[];
  summary: IndividualRightsSummaryRecord[];
  permissions: IndividualRightsPermissionSet;
}> {
  const payload = await request("individual-rights");
  const data = isRecord(payload.data) ? payload.data : {};
  return {
    profiles: records(data.profiles).map(profile),
    summary: records(data.summary).map(summaryRecord),
    permissions: permissions(data.permissions),
  };
}

export async function loadIndividualRightsUsers(profileId: number): Promise<{
  users: IndividualRightsUser[];
  rows: IndividualRightsMatrixRow[];
}> {
  const payload = await request(`individual-rights/${profileId}/users`);
  const data = isRecord(payload.data) ? payload.data : {};
  return {
    users: records(data.users).map(user),
    rows: records(data.rows).map(matrixRow),
  };
}

export async function loadIndividualRightsMatrix(
  profileId: number,
  userId: number
): Promise<IndividualRightsMatrixState> {
  const payload = await request(`individual-rights/${profileId}/${userId}/matrix`);
  const data = isRecord(payload.data) ? payload.data : {};
  return {
    rows: records(data.rows).map(matrixRow),
    selected: selectionMap(data.selected),
  };
}

export async function saveIndividualRights(
  profileId: number,
  userId: number,
  selected: IndividualRightsMatrixState["selected"]
): Promise<string> {
  const payload = await request("individual-rights", {
    method: "POST",
    body: body({
      profile_id: profileId,
      user_id: userId,
      selected,
    }),
  });

  return message(payload, "Individual rights saved successfully.");
}
