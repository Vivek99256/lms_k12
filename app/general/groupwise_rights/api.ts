import {
  appendCommonParams,
  buildSessionContext,
  createAuthHeaders,
  normalizeApiStatus,
  readNumber,
  readString,
  type ApiEnvelope,
} from "@/lib/erp-client";

export type GroupwisePermissionSet = {
  view: boolean;
  add: boolean;
  edit: boolean;
  delete: boolean;
  admin: boolean;
};

export type GroupwiseProfile = {
  id: number;
  name: string;
  status: number;
  sortOrder: number;
};

export type GroupwiseSummaryRecord = {
  id: number;
  profileId: number;
  profileName: string;
  menuId: number;
  menuName: string;
  canView: boolean;
  canAdd: boolean;
  canEdit: boolean;
  canDelete: boolean;
  dashboardRight: boolean;
};

export type GroupwiseMatrixRow = {
  menuId: number;
  name: string;
  level: 1 | 2 | 3;
  menuType: string;
};

export type GroupwiseMatrixSelection = {
  view: boolean;
  add: boolean;
  edit: boolean;
  delete: boolean;
  dashboardRight: boolean;
};

export type GroupwiseMatrixState = {
  rows: GroupwiseMatrixRow[];
  selected: Record<number, GroupwiseMatrixSelection>;
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

function permissionSet(value: unknown): GroupwisePermissionSet {
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

function profile(row: RecordValue): GroupwiseProfile {
  return {
    id: readNumber(row.id),
    name: readString(row.name).trim(),
    status: readNumber(row.status),
    sortOrder: readNumber(row.sort_order),
  };
}

function summaryRecord(row: RecordValue): GroupwiseSummaryRecord {
  return {
    id: readNumber(row.id),
    profileId: readNumber(row.profile_id),
    profileName: readString(row.profile_name).trim(),
    menuId: readNumber(row.menu_id),
    menuName: readString(row.menu_name).trim(),
    canView: readNumber(row.can_view) === 1,
    canAdd: readNumber(row.can_add) === 1,
    canEdit: readNumber(row.can_edit) === 1,
    canDelete: readNumber(row.can_delete) === 1,
    dashboardRight: readNumber(row.dashboard_right) === 1,
  };
}

function matrixRow(row: RecordValue): GroupwiseMatrixRow {
  const level = readNumber(row.level);
  return {
    menuId: readNumber(row.menu_id),
    name: readString(row.name).trim(),
    level: level === 2 || level === 3 ? level : 1,
    menuType: readString(row.menu_type).trim(),
  };
}

function selectionMap(value: unknown): Record<number, GroupwiseMatrixSelection> {
  if (!isRecord(value)) return {};

  const mapped: Record<number, GroupwiseMatrixSelection> = {};
  for (const [menuId, raw] of Object.entries(value)) {
    const id = Number(menuId);
    const row = isRecord(raw) ? raw : {};
    if (!Number.isFinite(id) || id <= 0) continue;
    mapped[id] = {
      view: Boolean(row.view),
      add: Boolean(row.add),
      edit: Boolean(row.edit),
      delete: Boolean(row.delete),
      dashboardRight: Boolean(row.dashboardRight),
    };
  }
  return mapped;
}

export async function loadGroupwiseDashboard(): Promise<{
  profiles: GroupwiseProfile[];
  summary: GroupwiseSummaryRecord[];
  permissions: GroupwisePermissionSet;
}> {
  const payload = await request("groupwise-rights");
  const data = isRecord(payload.data) ? payload.data : {};
  return {
    profiles: records(data.profiles).map(profile),
    summary: records(data.summary).map(summaryRecord),
    permissions: permissionSet(data.permissions),
  };
}

export async function loadGroupwiseMatrix(profileId: number): Promise<GroupwiseMatrixState> {
  const payload = await request(`groupwise-rights/${profileId}/matrix`);
  const data = isRecord(payload.data) ? payload.data : {};
  return {
    rows: records(data.rows).map(matrixRow),
    selected: selectionMap(data.selected),
  };
}

export async function saveGroupwiseRights(
  profileId: number,
  selected: GroupwiseMatrixState["selected"]
): Promise<string> {
  const payload = await request("groupwise-rights", {
    method: "POST",
    body: body({
      profile_id: profileId,
      selected,
    }),
  });

  return message(payload, "Groupwise rights saved successfully.");
}
