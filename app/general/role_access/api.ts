import {
  appendCommonParams,
  buildSessionContext,
  createAuthHeaders,
  normalizeApiStatus,
  readNumber,
  readString,
  type ApiEnvelope,
} from "@/lib/erp-client";

/**
 * Roles & Access client.
 *
 * Talks to `api/role-access/*` (RoleAccessApiController). Only an Admin may use any of it; the
 * server answers 403 with a plain message otherwise, which is shown as is.
 */

/** The four web rights, plus the Dashboard and Mobile flags that sit on the same row. */
export type Rights = {
  view: boolean;
  add: boolean;
  edit: boolean;
  delete: boolean;
  dashboard: boolean;
  mobile: boolean;
};
export type RightKey = keyof Rights;

export type Role = {
  id: number;
  name: string;
  description: string;
  menusGranted: number;
  menusAssignable: number;
  users: number;
  /** An Admin role: changing it affects every admin, so a change must be confirmed. */
  protected: boolean;
};

export type MenuItem = {
  menuId: number;
  name: string;
  link: string;
  type: string;
  rights: Rights;
  /** How many modules list this menu; above 1 means a change here applies everywhere it appears. */
  inModules: number;
  // Effective access only.
  visible?: boolean;
  source?: "role" | "individual" | "both" | "none";
  issue?: string | null;
};

export type ModuleTab = { key: string; label: string; items: MenuItem[] };

export type ModuleNode = {
  key: string;
  label: string;
  /** The sidebar group the module sits under (People & Competency, Enterprise Brain ...). */
  group: string;
  moduleMenuId: number | null;
  moduleMenu: { rights: Rights } | null;
  tabs: ModuleTab[];
};

export type RoleModules = {
  role: { id: number; name: string; protected: boolean };
  modules: ModuleNode[];
};

export type RightsChange = { menu_id: number } & Rights;

export type SaveResult = {
  batchId: string;
  changed: number;
  autoGranted: Array<{ menuId: number; name: string }>;
  rejected: Array<{ menuId: number; name?: string; reason: string }>;
  message: string;
};

export type CopyMode = "replace" | "merge";

export type CopyDiff = { menuId: number; name: string; before: Rights; after: Rights };

export type CopyPreview = {
  target: { id: number; name: string };
  source: { id: number; name: string };
  mode: CopyMode;
  differences: number;
  granting: number;
  revoking: number;
  notAssignable: number;
  changes: CopyDiff[];
};

export type UserHit = { id: number; name: string; email: string; roleId: number; role: string };

export type EffectiveAccess = {
  user: { id: number; name: string; email: string; role: string; roleId: number; active: boolean };
  stats: { menus: number; visible: number; hidden: number; viaIndividual: number };
  modules: ModuleNode[];
};

export type CoverageMenu = { menuId: number; name: string; module: string };

export type HistoryBatch = {
  batchId: string;
  at: string;
  actor: string;
  roleId: number;
  role: string;
  menus: number;
  kind: "manual" | "copy" | "undo";
  note: string;
  undoable: boolean;
};

export type HistoryEntry = {
  menuId: number;
  name: string;
  before: Rights;
  after: Rights;
  source: string;
  undone: boolean;
};

export type UndoResult = {
  reverted: number;
  skipped: Array<{ menuId: number; name: string; reason: string }>;
  message: string;
};

type RecordValue = Record<string, unknown>;

function isRecord(value: unknown): value is RecordValue {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function records(value: unknown): RecordValue[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function rights(value: unknown): Rights {
  const row = isRecord(value) ? value : {};
  return {
    view: Boolean(row.view),
    add: Boolean(row.add),
    edit: Boolean(row.edit),
    delete: Boolean(row.delete),
    dashboard: Boolean(row.dashboard),
    mobile: Boolean(row.mobile),
  };
}

async function request(
  path: string,
  init?: RequestInit,
  query?: Record<string, string | number | undefined>
): Promise<{ data: RecordValue; message: string }> {
  const session = buildSessionContext();
  if (!session.token || !session.subInstituteId || !session.userId) {
    throw new Error("Your login session is incomplete.");
  }

  const params = new URLSearchParams();
  appendCommonParams(params, session);
  params.set("user_id", session.userId);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }

  const response = await fetch(`/api/proxy?path=${encodeURIComponent(`api/${path}`)}&${params.toString()}`, {
    cache: "no-store",
    ...init,
    headers: {
      ...createAuthHeaders(session, init?.body ? "application/json" : undefined),
      ...init?.headers,
    },
  });

  const payload: unknown = await response.json().catch(() => null);
  const message = isRecord(payload) ? readString(payload.message) : "";
  if (!response.ok || (isRecord(payload) && ["0", "2"].includes(normalizeApiStatus(payload as ApiEnvelope)))) {
    throw new Error(message || "Couldn't complete that request. Try again.");
  }

  return { data: isRecord(payload) && isRecord(payload.data) ? payload.data : {}, message };
}

function post(path: string, values: RecordValue) {
  const session = buildSessionContext();
  return request(path, {
    method: "POST",
    body: JSON.stringify({
      ...values,
      type: "API",
      sub_institute_id: Number(session.subInstituteId),
      user_id: Number(session.userId),
      syear: Number(session.syear),
    }),
  });
}

function menuItem(row: RecordValue): MenuItem {
  const source = readString(row.source);
  return {
    menuId: readNumber(row.menuId),
    name: readString(row.name).trim(),
    link: readString(row.link),
    type: readString(row.type),
    rights: rights(row.rights),
    inModules: Math.max(1, readNumber(row.inModules)),
    visible: typeof row.visible === "boolean" ? row.visible : undefined,
    source: source === "role" || source === "individual" || source === "both" || source === "none" ? source : undefined,
    issue: typeof row.issue === "string" ? row.issue : null,
  };
}

function moduleNode(row: RecordValue): ModuleNode {
  return {
    key: readString(row.key),
    label: readString(row.label).trim(),
    group: readString(row.group).trim(),
    moduleMenuId: row.moduleMenuId == null ? null : readNumber(row.moduleMenuId),
    moduleMenu: isRecord(row.moduleMenu) ? { rights: rights(row.moduleMenu.rights) } : null,
    tabs: records(row.tabs).map((tab) => ({
      key: readString(tab.key),
      label: readString(tab.label).trim(),
      items: records(tab.items).map(menuItem),
    })),
  };
}

export async function loadRoles(): Promise<Role[]> {
  const { data } = await request("role-access/roles");
  return records(data.roles).map((row) => ({
    id: readNumber(row.id),
    name: readString(row.name).trim(),
    description: readString(row.description),
    menusGranted: readNumber(row.menusGranted),
    menusAssignable: readNumber(row.menusAssignable),
    users: readNumber(row.users),
    protected: Boolean(row.protected),
  }));
}

export async function loadRoleModules(roleId: number): Promise<RoleModules> {
  const { data } = await request(`role-access/roles/${roleId}/modules`);
  const role = isRecord(data.role) ? data.role : {};
  return {
    role: { id: readNumber(role.id), name: readString(role.name).trim(), protected: Boolean(role.protected) },
    modules: records(data.modules).map(moduleNode),
  };
}

export async function saveRoleRights(
  roleId: number,
  changes: RightsChange[],
  note?: string,
  confirmAdmin = false
): Promise<SaveResult> {
  const { data, message } = await post(`role-access/roles/${roleId}/rights`, {
    changes,
    note: note || undefined,
    confirm_admin: confirmAdmin,
  });
  return saveResult(data, message);
}

function saveResult(data: RecordValue, message: string): SaveResult {
  return {
    batchId: readString(data.batchId),
    changed: readNumber(data.changed),
    autoGranted: records(data.autoGranted).map((row) => ({ menuId: readNumber(row.menuId), name: readString(row.name) })),
    rejected: records(data.rejected).map((row) => ({
      menuId: readNumber(row.menuId),
      name: readString(row.name) || undefined,
      reason: readString(row.reason),
    })),
    message,
  };
}

function copyPreview(data: RecordValue): CopyPreview {
  const target = isRecord(data.target) ? data.target : {};
  const source = isRecord(data.source) ? data.source : {};
  return {
    target: { id: readNumber(target.id), name: readString(target.name) },
    source: { id: readNumber(source.id), name: readString(source.name) },
    mode: readString(data.mode) === "merge" ? "merge" : "replace",
    differences: readNumber(data.differences),
    granting: readNumber(data.granting),
    revoking: readNumber(data.revoking),
    notAssignable: readNumber(data.notAssignable),
    changes: records(data.changes).map((row) => ({
      menuId: readNumber(row.menuId),
      name: readString(row.name).trim(),
      before: rights(isRecord(row.before) ? row.before.rights : null),
      after: rights(isRecord(row.after) ? row.after.rights : null),
    })),
  };
}

export async function previewCopy(roleId: number, sourceId: number, mode: CopyMode): Promise<CopyPreview> {
  const { data } = await post(`role-access/roles/${roleId}/copy/preview`, { source_profile_id: sourceId, mode });
  return copyPreview(data);
}

export async function applyCopy(
  roleId: number,
  sourceId: number,
  mode: CopyMode,
  confirmAdmin = false
): Promise<{ preview: CopyPreview; result: SaveResult }> {
  const { data, message } = await post(`role-access/roles/${roleId}/copy/apply`, {
    source_profile_id: sourceId,
    mode,
    confirm_admin: confirmAdmin,
  });
  return { preview: copyPreview(data), result: saveResult(data, message) };
}

export async function searchUsers(term: string): Promise<UserHit[]> {
  const { data } = await request("role-access/users", undefined, { q: term.trim() });
  return records(data.users).map((row) => ({
    id: readNumber(row.id),
    name: readString(row.name).trim(),
    email: readString(row.email),
    roleId: readNumber(row.roleId),
    role: readString(row.role).trim(),
  }));
}

export async function loadEffective(userId: number): Promise<EffectiveAccess> {
  const { data } = await request(`role-access/users/${userId}/effective`);
  const user = isRecord(data.user) ? data.user : {};
  const stats = isRecord(data.stats) ? data.stats : {};
  return {
    user: {
      id: readNumber(user.id),
      name: readString(user.name).trim(),
      email: readString(user.email),
      role: readString(user.role).trim(),
      roleId: readNumber(user.roleId),
      active: Boolean(user.active),
    },
    stats: {
      menus: readNumber(stats.menus),
      visible: readNumber(stats.visible),
      hidden: readNumber(stats.hidden),
      viaIndividual: readNumber(stats.viaIndividual),
    },
    modules: records(data.modules).map(moduleNode),
  };
}

export async function loadCoverage(): Promise<{ count: number; menus: CoverageMenu[] }> {
  const { data } = await request("role-access/coverage");
  return {
    count: readNumber(data.count),
    menus: records(data.menus).map((row) => ({
      menuId: readNumber(row.menuId),
      name: readString(row.name).trim(),
      module: readString(row.module).trim(),
    })),
  };
}

export async function loadHistory(roleId?: number): Promise<HistoryBatch[]> {
  const { data } = await request("role-access/history", undefined, { profile_id: roleId || undefined, limit: 50 });
  return records(data.batches).map((row) => {
    const kind = readString(row.kind);
    return {
      batchId: readString(row.batchId),
      at: readString(row.at),
      actor: readString(row.actor),
      roleId: readNumber(row.roleId),
      role: readString(row.role).trim(),
      menus: readNumber(row.menus),
      kind: kind === "copy" || kind === "undo" ? kind : "manual",
      note: readString(row.note),
      undoable: Boolean(row.undoable),
    };
  });
}

export async function loadHistoryDetail(batchId: string): Promise<HistoryEntry[]> {
  const { data } = await request(`role-access/history/${encodeURIComponent(batchId)}`);
  return records(data.entries).map((row) => ({
    menuId: readNumber(row.menuId),
    name: readString(row.name).trim(),
    before: rights(isRecord(row.before) ? row.before.rights : null),
    after: rights(isRecord(row.after) ? row.after.rights : null),
    source: readString(row.source),
    undone: Boolean(row.undone),
  }));
}

export async function undoBatch(batchId: string, confirmAdmin = false): Promise<UndoResult> {
  const { data, message } = await post(`role-access/history/${encodeURIComponent(batchId)}/undo`, {
    confirm_admin: confirmAdmin,
  });
  return {
    reverted: readNumber(data.reverted),
    skipped: records(data.skipped).map((row) => ({
      menuId: readNumber(row.menuId),
      name: readString(row.name),
      reason: readString(row.reason),
    })),
    message,
  };
}
