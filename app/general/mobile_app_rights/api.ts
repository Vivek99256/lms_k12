import {
  appendCommonParams,
  buildSessionContext,
  createAuthHeaders,
  normalizeApiStatus,
  readNumber,
  readString,
  type ApiEnvelope,
} from "@/lib/erp-client";

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

export type MobileAppRightsPermissionSet = {
  view: boolean;
  add: boolean;
  edit: boolean;
  delete: boolean;
  admin: boolean;
};

export type MobileAppRightsProfile = {
  id: number;
  name: string;
  status: number;
  sortOrder: number;
};

export type MobileConfigProfile = "Admin" | "Teacher" | "Student";

export type MobileRightsRow = {
  id: number;
  userProfileName: string;
  mainTitle: string;
  menuType: string;
  mainTitleColorCode: string;
  mainTitleBackgroundImage: string;
  subTitleOfMain: string;
  subTitleIcon: string;
  subTitleApi: string;
  subTitleApiParam: string;
  mainSortOrder: number;
  subTitleSortOrder: number;
  screenName: string;
  status: string;
};

export type MobileRenderType = "native" | "webview" | "native_dynamic";
export type MobileOpenMode = "in_app" | "external";
export type MobilePageSource = "external" | "custom";

export type MobileConfigRecord = {
  id: number;
  userProfileName: string;
  mainTitle: string;
  mainTitleColorCode: string;
  mainTitleBackgroundImage: string;
  mainSortOrder: number;
  subTitleOfMain: string;
  subTitleIcon: string;
  subTitleSortOrder: number;
  status: string;
  screenName: string;
  renderType: MobileRenderType;
  webUrl: string;
  openMode: MobileOpenMode;
  pageSource: MobilePageSource;
  customPageId: number | null;
};

export type MobileConfigUpdateInput = {
  profileName: MobileConfigProfile;
  mainTitle: string;
  mainTitleColorCode: string;
  mainTitleBackgroundImage: string;
  mainSortOrder: number;
  subTitleOfMain: string;
  subTitleIcon: string;
  subTitleSortOrder: number;
  status: "Yes" | "No";
  renderType: MobileRenderType;
  webUrl: string;
  openMode: MobileOpenMode;
  pageSource: MobilePageSource;
  customPageId: number | null;
};

function permissionSet(value: unknown): MobileAppRightsPermissionSet {
  const row = isRecord(value) ? value : {};
  return {
    view: Boolean(row.view),
    add: Boolean(row.add),
    edit: Boolean(row.edit),
    delete: Boolean(row.delete),
    admin: Boolean(row.admin),
  };
}

function profile(row: RecordValue): MobileAppRightsProfile {
  return {
    id: readNumber(row.id),
    name: readString(row.name).trim(),
    status: readNumber(row.status),
    sortOrder: readNumber(row.sort_order),
  };
}

function configProfile(value: unknown): MobileConfigProfile[] {
  return Array.isArray(value)
    ? value
        .map((entry) => readString(entry).trim())
        .filter((entry): entry is MobileConfigProfile => ["Admin", "Teacher", "Student"].includes(entry))
    : [];
}

function rightsRow(row: RecordValue): MobileRightsRow {
  return {
    id: readNumber(row.id),
    userProfileName: readString(row.user_profile_name).trim(),
    mainTitle: readString(row.main_title).trim(),
    menuType: readString(row.menu_type).trim(),
    mainTitleColorCode: readString(row.main_title_color_code).trim(),
    mainTitleBackgroundImage: readString(row.main_title_background_image).trim(),
    subTitleOfMain: readString(row.sub_title_of_main).trim(),
    subTitleIcon: readString(row.sub_title_icon).trim(),
    subTitleApi: readString(row.sub_title_api).trim(),
    subTitleApiParam: readString(row.sub_title_api_param).trim(),
    mainSortOrder: readNumber(row.main_sort_order),
    subTitleSortOrder: readNumber(row.sub_title_sort_order),
    screenName: readString(row.screen_name).trim(),
    status: readString(row.status).trim(),
  };
}

function renderType(value: unknown): MobileRenderType {
  const normalized = readString(value).trim();
  return normalized === "webview" || normalized === "native_dynamic" ? normalized : "native";
}

function pageSource(value: unknown): MobilePageSource {
  return readString(value).trim() === "custom" ? "custom" : "external";
}

function configRecord(row: RecordValue): MobileConfigRecord {
  return {
    id: readNumber(row.id),
    userProfileName: readString(row.user_profile_name).trim(),
    mainTitle: readString(row.main_title).trim(),
    mainTitleColorCode: readString(row.main_title_color_code).trim(),
    mainTitleBackgroundImage: readString(row.main_title_background_image).trim(),
    mainSortOrder: readNumber(row.main_sort_order),
    subTitleOfMain: readString(row.sub_title_of_main).trim(),
    subTitleIcon: readString(row.sub_title_icon).trim(),
    subTitleSortOrder: readNumber(row.sub_title_sort_order),
    status: readString(row.status).trim(),
    screenName: readString(row.screen_name).trim(),
    renderType: renderType(row.render_type),
    webUrl: readString(row.web_url).trim(),
    openMode: readString(row.open_mode).trim() === "external" ? "external" : "in_app",
    pageSource: pageSource(row.page_source),
    customPageId: row.custom_page_id ? readNumber(row.custom_page_id) : null,
  };
}

export async function loadMobileAppRightsBootstrap(): Promise<{
  profiles: MobileAppRightsProfile[];
  configProfiles: MobileConfigProfile[];
  permissions: MobileAppRightsPermissionSet;
}> {
  const payload = await request("mobile-app-rights/bootstrap");
  const data = isRecord(payload.data) ? payload.data : {};
  return {
    profiles: records(data.profiles).map(profile),
    configProfiles: configProfile(data.config_profiles),
    permissions: permissionSet(data.permissions),
  };
}

export async function loadMobileRights(profileId: number): Promise<{
  rows: MobileRightsRow[];
  selected: string[];
}> {
  const payload = await request(`mobile-app-rights/${profileId}/rights`);
  const data = isRecord(payload.data) ? payload.data : {};
  return {
    rows: records(data.rows).map(rightsRow),
    selected: Array.isArray(data.selected)
      ? data.selected.map((entry) => readString(entry).trim()).filter(Boolean)
      : [],
  };
}

export async function saveMobileRights(profileId: number, selected: Record<string, boolean>): Promise<string> {
  const payload = await request("mobile-app-rights/rights", {
    method: "POST",
    body: body({
      profile_id: profileId,
      selected,
    }),
  });
  return message(payload, "Mobile App Menu Rights Added Successfully");
}

export async function loadMobileConfig(profileName: MobileConfigProfile, includeInactive: boolean): Promise<MobileConfigRecord[]> {
  const query = new URLSearchParams({
    profile_name: profileName,
    include_inactive: includeInactive ? "1" : "0",
  });
  const payload = await request(`mobile-app-rights/config?${query.toString()}`);
  const data = isRecord(payload.data) ? payload.data : {};
  return records(data.records).map(configRecord);
}

export async function updateMobileConfig(id: number, input: MobileConfigUpdateInput): Promise<string> {
  const payload = await request(`mobile-app-rights/config/${id}`, {
    method: "POST",
    body: body({
      profile_name: input.profileName,
      main_title: input.mainTitle,
      main_title_color_code: input.mainTitleColorCode,
      main_title_background_image: input.mainTitleBackgroundImage,
      main_sort_order: input.mainSortOrder,
      sub_title_of_main: input.subTitleOfMain,
      sub_title_icon: input.subTitleIcon,
      sub_title_sort_order: input.subTitleSortOrder,
      status: input.status,
      render_type: input.renderType,
      web_url: input.webUrl,
      open_mode: input.openMode,
      page_source: input.pageSource,
      custom_page_id: input.customPageId,
    }),
  });
  return message(payload, "Mobile App Menu Rights Updated Successfully");
}

// Unlike updateMobileConfig, which only ever edits a screen_name row that
// already exists, this creates a brand-new home screen icon -- needed
// because the ~46 rows this module manages were seeded once, in 2020, and
// a menu like "Admission Enquiry" that was never among them otherwise has
// no row to attach a Custom Mobile Page to.
export async function createMobileConfig(input: MobileConfigUpdateInput): Promise<{ message: string; id: number }> {
  const payload = await request("mobile-app-rights/config", {
    method: "POST",
    body: body({
      profile_name: input.profileName,
      main_title: input.mainTitle,
      main_title_color_code: input.mainTitleColorCode,
      main_title_background_image: input.mainTitleBackgroundImage,
      main_sort_order: input.mainSortOrder,
      sub_title_of_main: input.subTitleOfMain,
      sub_title_icon: input.subTitleIcon,
      sub_title_sort_order: input.subTitleSortOrder,
      status: input.status,
      render_type: input.renderType,
      web_url: input.webUrl,
      open_mode: input.openMode,
      page_source: input.pageSource,
      custom_page_id: input.customPageId,
    }),
  });
  const data = isRecord(payload.data) ? payload.data : {};
  return { message: message(payload, "Mobile app menu item created successfully."), id: readNumber(data.id) };
}
