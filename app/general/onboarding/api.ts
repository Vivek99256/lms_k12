import { buildSessionContext, readString } from "@/lib/erp-client";
import { legacyRequest } from "@/lib/erp-legacy";
import { API_BASE_URL } from "@/app/components/utils/api_url";
import { mapApiLinkToRoute } from "@/app/data/routeMapper";

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function toRecord(value: unknown): UnknownRecord {
  return isRecord(value) ? value : {};
}

function toArray(value: unknown): UnknownRecord[] {
  if (Array.isArray(value)) return value.filter(isRecord);
  if (isRecord(value)) return Object.values(value).filter(isRecord);
  return [];
}

function getRoute(link: string): string {
  const mapped = mapApiLinkToRoute(link);
  if (mapped !== "#") return mapped;
  if (link.includes("/") && !link.includes(".index")) return `/${link.replace(/^\/+/, "")}`;
  return "#";
}

export type OnboardingAccount = {
  accountNumber: string;
  createdAt: string;
  schoolName: string;
  userName: string;
  mobile: string;
  email: string;
  firstName: string;
  lastName: string;
};

export type OnboardingMenuCard = {
  menuTitle: string;
  parentMenuId: number;
};

export type OnboardingMenuEntry = {
  id: number;
  name: string;
  link: string;
  route: string;
  databaseTable: string;
  helpText: string;
  complete: boolean;
};

export type OnboardingModule = {
  menuTitle: string;
  parentMenuId: number;
  master: OnboardingMenuEntry[];
  entry: OnboardingMenuEntry[];
  report: OnboardingMenuEntry[];
};

export type OnboardingRoleMap = Record<string, Record<string, string>>;
export type OnboardingRequirementMap = Record<string, Record<string, string>>;

export type FeesOnboardingData = {
  months: Array<{ id: string; label: string; header?: string }>;
  titleOptions: Array<{ id: string; label: string }>;
  receiptHeads: Array<{ id: string; label: string }>;
  breakoffMonths: Array<{ id: string; label: string }>;
  importTables: Array<{ tableName: string; displayName: string }>;
};

export type OnboardingData = {
  account: OnboardingAccount;
  menuCards: OnboardingMenuCard[];
  modules: OnboardingModule[];
  roles: OnboardingRoleMap;
  requirements: OnboardingRequirementMap;
  fees: FeesOnboardingData;
  sessionBaseUrl: string;
  source: "legacy" | "fallback";
};

function buildAccount(payload: UnknownRecord): OnboardingAccount {
  const school = toRecord(payload.schooldata);
  const user = toRecord(payload.userdata);
  const sessionUser = toRecord(
    typeof window === "undefined"
      ? {}
      : JSON.parse(localStorage.getItem("userData") || "{}")
  );
  const userId = readString(user.id ?? sessionUser.user_id ?? sessionUser.id).trim();
  return {
    accountNumber: userId ? userId.padStart(5, "0") : "",
    createdAt: readString(school.created_at ?? sessionUser.created_at).trim(),
    schoolName: readString(school.SchoolName ?? school.school_name ?? sessionUser.school_name).trim(),
    userName: readString(user.user_name ?? sessionUser.user_name ?? sessionUser.username).trim(),
    mobile: readString(user.mobile ?? sessionUser.mobile).trim(),
    email: readString(user.email ?? sessionUser.email).trim(),
    firstName: readString(user.first_name ?? sessionUser.first_name).trim(),
    lastName: readString(user.last_name ?? sessionUser.last_name).trim(),
  };
}

function completionMap(payload: UnknownRecord): Record<string, boolean> {
  const result: Record<string, boolean> = {};
  Object.entries(toRecord(payload.table_name)).forEach(([key, value]) => {
    result[key] = String(value) === "1" || value === true;
  });
  return result;
}

function buildEntries(
  value: unknown,
  completeByTable: Record<string, boolean>
): OnboardingMenuEntry[] {
  return toArray(value).map((entry) => {
    const link = readString(entry.link).trim();
    const databaseTable = readString(entry.database_table).trim();
    return {
      id: Number(entry.id ?? 0),
      name: readString(entry.name).trim(),
      link,
      route: link ? getRoute(link) : "#",
      databaseTable,
      helpText: readString(entry.text).trim(),
      complete: Boolean(databaseTable && completeByTable[databaseTable]),
    };
  });
}

function buildRoles(payload: UnknownRecord): OnboardingRoleMap {
  const roles: OnboardingRoleMap = {};
  Object.entries(toRecord(payload.roles)).forEach(([moduleName, moduleValue]) => {
    const moduleRoles: Record<string, string> = {};
    Object.entries(toRecord(moduleValue)).forEach(([profileName, roleValue]) => {
      moduleRoles[profileName] = readString(toRecord(roleValue).text);
    });
    roles[moduleName] = moduleRoles;
  });
  return roles;
}

function buildRequirements(payload: UnknownRecord): OnboardingRequirementMap {
  const requirements: OnboardingRequirementMap = {};
  Object.entries(toRecord(payload.requirements)).forEach(([moduleName, moduleValue]) => {
    const moduleRequirements: Record<string, string> = {};
    Object.entries(toRecord(moduleValue)).forEach(([key, value]) => {
      moduleRequirements[key] = readString(toRecord(value).requirements);
    });
    requirements[moduleName] = moduleRequirements;
  });
  return requirements;
}

function feesData(payload: UnknownRecord): FeesOnboardingData {
  const feesMonthHeader = toRecord(payload.feesMonthHeader);
  const mapYearData = toRecord(toRecord(payload.map_year).data);
  const titleData = toRecord(toRecord(payload.feesTitle).data);
  const breakoffData = toRecord(toRecord(payload.feesBreakoff).data);
  const existingHeaders = new Map<string, string>();
  toArray(feesMonthHeader.month_header).forEach((item) => {
    existingHeaders.set(readString(item.month_id), readString(item.header));
  });
  return {
    months: Object.entries(toRecord(mapYearData.ddMonth)).map(([id, label]) => ({
      id,
      label: readString(label),
      header: existingHeaders.get(id),
    })),
    titleOptions: Object.entries(toRecord(titleData.ddTtitle)).map(([id, label]) => ({
      id,
      label: readString(label),
    })),
    receiptHeads: toArray(toRecord(payload.feesReceiptBook).feeHeadList).map((item) => ({
      id: readString(item.id),
      label: readString(item.display_name),
    })),
    breakoffMonths: Object.entries(toRecord(breakoffData.ddMonth)).map(([id, label]) => ({
      id,
      label: readString(label),
    })),
    importTables: toArray(payload.importData).map((item) => ({
      tableName: readString(item.table_name),
      displayName: readString(item.display_table_name || item.table_name),
    })),
  };
}

type MenuContextPayload = {
  sub_institute_id: number;
  user_id: number;
  user_profile_name: string;
  user_profile_id: number;
  client_id: number;
};

type MenuRightsResponse = {
  status?: number | string;
  message?: string;
  data?: {
    "level 1"?: unknown;
    "level 2"?: unknown;
    "level 3"?: unknown;
  };
  "level 1"?: unknown;
  "level 2"?: unknown;
  "level 3"?: unknown;
};

type MenuItemRecord = {
  id: number;
  name: string;
  menu_title: string;
  parent_menu_id: number;
  menu_type: string;
  link: string;
  database_table: string;
  text: string;
  status: number;
};

function buildModulesFromPayload(
  payload: UnknownRecord,
  completeByTable: Record<string, boolean>
): { menuCards: OnboardingMenuCard[]; modules: OnboardingModule[] } {
  const cards = toArray(payload.head)
    .map((item) => ({
      menuTitle: readString(item.menu_title).trim(),
      parentMenuId: Number(item.parent_menu_id ?? 0),
    }))
    .filter((item) => item.menuTitle);

  const master = toRecord(payload.groupwisemenuMaster);
  const entry = toRecord(payload.groupwisesubmenuMaster);
  const report = toRecord(payload.groupwiseSubsubmenuMaster);

  const modules = cards.map((card) => ({
    menuTitle: card.menuTitle,
    parentMenuId: card.parentMenuId,
    master: buildEntries(master[card.menuTitle], completeByTable),
    entry: buildEntries(entry[card.menuTitle], completeByTable),
    report: buildEntries(report[card.menuTitle], completeByTable),
  }));

  return { menuCards: cards, modules };
}

function readNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getValueFromObject(obj: unknown, keys: string[]): unknown {
  if (!obj || typeof obj !== "object") return undefined;
  const record = obj as Record<string, unknown>;
  for (const key of keys) {
    if (record[key] != null && record[key] !== "") return record[key];
  }
  for (const value of Object.values(record)) {
    if (value && typeof value === "object") {
      const nested = getValueFromObject(value, keys);
      if (nested != null && nested !== "") return nested;
    }
  }
  return undefined;
}

function getStoredMenuContext(): MenuContextPayload | null {
  if (typeof window === "undefined") return null;
  for (const key of ["menuContext", "sessionData", "sessiondata", "userData", "user_data", "session"]) {
    const stored = localStorage.getItem(key);
    if (!stored) continue;
    try {
      const parsed = JSON.parse(stored) as unknown;
      const context = {
        sub_institute_id: readNumber(getValueFromObject(parsed, ["sub_institute_id", "subInstituteId", "id"])),
        user_id: readNumber(getValueFromObject(parsed, ["user_id", "userId", "id"])),
        user_profile_name: readString(getValueFromObject(parsed, ["user_profile_name", "userProfileName", "profile_name"])).trim() || "ADMIN",
        user_profile_id: readNumber(getValueFromObject(parsed, ["user_profile_id", "userProfileId", "profile_id"])),
        client_id: readNumber(getValueFromObject(parsed, ["client_id", "clientId"])),
      };
      if (context.sub_institute_id && context.user_id) return context;
    } catch {
      continue;
    }
  }
  return null;
}

function normalizeLevel(value: unknown): UnknownRecord[] {
  if (Array.isArray(value)) return value.filter(isRecord);
  if (!isRecord(value)) return [];
  return Object.values(value).filter(isRecord);
}

function flattenGroup(value: unknown): UnknownRecord[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(isRecord);
  if (isRecord(value) && "id" in value && "name" in value) return [value];
  if (!isRecord(value)) return [];
  const results: UnknownRecord[] = [];
  Object.values(value).forEach((entry) => {
    results.push(...flattenGroup(entry));
  });
  return results;
}

function toMenuItem(value: UnknownRecord): MenuItemRecord {
  return {
    id: readNumber(value.id),
    name: readString(value.name).trim(),
    menu_title: readString(value.menu_title ?? value.site_map_name).trim(),
    parent_menu_id: readNumber(value.parent_menu_id),
    menu_type: readString(value.menu_type).trim().toUpperCase(),
    link: readString(value.link).trim(),
    database_table: readString(value.database_table).trim(),
    text: readString(value.text).trim(),
    status: readNumber(value.status),
  };
}

async function loadFallbackOnboarding(): Promise<OnboardingData> {
  try {
    const payload = await legacyRequest("setup-institute-details");
    const completeByTable = completionMap(payload);
    const { menuCards, modules } = buildModulesFromPayload(payload, completeByTable);

    return {
      account: buildAccount(payload),
      menuCards,
      modules,
      roles: buildRoles(payload),
      requirements: buildRequirements(payload),
      fees: {
        months: [],
        titleOptions: [],
        receiptHeads: [],
        breakoffMonths: [],
        importTables: [],
      },
      sessionBaseUrl: buildSessionContext().baseUrl.replace(/\/$/, ""),
      source: "fallback",
    };
  } catch {
    // Fall through to the rights-based fallback below.
  }

  const session = buildSessionContext();
  const context = getStoredMenuContext();
  if (!context) {
    throw new Error("Menu session data is missing.");
  }

  const response = await fetch(`${API_BASE_URL}/api/menu-rights`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "API",
      sub_institute_id: context.sub_institute_id,
      user_id: context.user_id,
      user_profile_name: context.user_profile_name,
      user_profile_id: context.user_profile_id,
      client_id: context.client_id,
    }),
    cache: "no-store",
  });
  const payload = (await response.json()) as MenuRightsResponse;
  if (!response.ok) {
    throw new Error(payload.message || "Menu rights could not be loaded.");
  }

  const rawLevel1 = payload.data?.["level 1"] ?? payload["level 1"];
  const rawLevel2 = payload.data?.["level 2"] ?? payload["level 2"];
  const rawLevel3 = payload.data?.["level 3"] ?? payload["level 3"];

  const level1 = normalizeLevel(rawLevel1).map(toMenuItem).filter((item) => item.status === 1);
  const level2 = flattenGroup(rawLevel2).map(toMenuItem).filter((item) => item.status === 1);
  const level3 = flattenGroup(rawLevel3).map(toMenuItem).filter((item) => item.status === 1);

  const cards = level1
    .map((item) => ({
      menuTitle: item.name || item.menu_title,
      parentMenuId: item.id,
    }))
    .filter((item) => item.menuTitle);

  const buildList = (items: MenuItemRecord[]) =>
    items
      .filter((item) => item.link !== "javascript:void(0);" && item.link !== "")
      .map((item) => ({
        id: item.id,
        name: item.name,
        link: item.link,
        route: getRoute(item.link),
        databaseTable: item.database_table,
        helpText: item.text,
        complete: false,
      }));

  const modules = cards.map((card) => ({
    menuTitle: card.menuTitle,
    parentMenuId: card.parentMenuId,
    master: buildList(level2.filter((item) => item.menu_title === card.menuTitle && item.menu_type === "MASTER")),
    entry: buildList(
      [...level2, ...level3].filter((item) => item.menu_title === card.menuTitle && item.menu_type === "ENTRY")
    ),
    report: buildList(
      [...level2, ...level3].filter((item) => item.menu_title === card.menuTitle && item.menu_type === "REPORT")
    ),
  }));

  return {
    account: buildAccount({}),
    menuCards: cards,
    modules,
    roles: {},
    requirements: {},
    fees: {
      months: [],
      titleOptions: [],
      receiptHeads: [],
      breakoffMonths: [],
      importTables: [],
    },
    sessionBaseUrl: session.baseUrl.replace(/\/$/, ""),
    source: "fallback",
  };
}

export async function loadOnboarding(): Promise<OnboardingData> {
  try {
    const payload = await legacyRequest("Onboarding");
    const completeByTable = completionMap(payload);
    const { menuCards, modules } = buildModulesFromPayload(payload, completeByTable);

    return {
      account: buildAccount(payload),
      menuCards,
      modules,
      roles: buildRoles(payload),
      requirements: buildRequirements(payload),
      fees: feesData(payload),
      sessionBaseUrl: buildSessionContext().baseUrl.replace(/\/$/, ""),
      source: "legacy",
    };
  } catch {
    return loadFallbackOnboarding();
  }
}
