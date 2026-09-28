import {
  appendCommonParams,
  buildSessionContext,
  createAuthHeaders,
  normalizeApiStatus,
  readNumber,
  readString,
  type ApiEnvelope,
} from '@/lib/erp-client';
import type { MobileHttpMethod, MobileListRowControl, MobileListSubmitKey, MobilePageLayout } from '@/components/mobile-page-builder/shared/layoutTypes';

/**
 * Client for MobilePageBuilderAdminApiController
 * (next_lms_erp/app/Http/Controllers/api/MobilePageBuilderAdminApiController.php,
 * routes/mobile_page_builder.php: prefix api/mobile-page-builder). Same
 * request/response shape and /api/proxy routing as the sibling
 * native_dynamic_pages and mobile_app_rights modules.
 */

type RecordValue = Record<string, unknown>;

function isRecord(value: unknown): value is RecordValue {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
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
    throw new Error('Your login session is incomplete.');
  }

  const params = new URLSearchParams();
  appendCommonParams(params, session);

  const response = await fetch(`/api/proxy?path=${encodeURIComponent(`api/mobile-page-builder/${path}`)}&${params.toString()}`, {
    cache: 'no-store',
    ...init,
    headers: {
      ...createAuthHeaders(session, init?.body ? 'application/json' : undefined),
      ...init?.headers,
    },
  });

  const payload: unknown = await response.json();
  if (!response.ok || (isRecord(payload) && ['0', '2'].includes(normalizeApiStatus(payload as ApiEnvelope)))) {
    throw new Error(message(payload, `Request failed (${response.status}).`));
  }

  return isRecord(payload) ? payload : {};
}

function body(values: RecordValue) {
  return JSON.stringify(values);
}

export type MobilePageStatus = 'draft' | 'published' | 'inactive';

export type MobilePageSummary = {
  id: number;
  name: string;
  slug: string;
  description: string;
  status: MobilePageStatus;
  draft: { versionNumber: number; updatedOn: string } | null;
  published: { versionNumber: number; publishedAt: string } | null;
  createdOn: string;
  updatedOn: string;
};

export type MobilePageDetail = MobilePageSummary & {
  layout: MobilePageLayout;
};

function pageStatus(value: unknown): MobilePageStatus {
  const normalized = readString(value).trim();
  return normalized === 'published' || normalized === 'inactive' ? normalized : 'draft';
}

function draftSummary(value: unknown): MobilePageSummary['draft'] {
  if (!isRecord(value)) return null;
  return { versionNumber: readNumber(value.versionNumber), updatedOn: readString(value.updatedOn) };
}

function publishedSummary(value: unknown): MobilePageSummary['published'] {
  if (!isRecord(value)) return null;
  return { versionNumber: readNumber(value.versionNumber), publishedAt: readString(value.publishedAt) };
}

function pageSummary(row: RecordValue): MobilePageSummary {
  return {
    id: readNumber(row.id),
    name: readString(row.name),
    slug: readString(row.slug),
    description: readString(row.description),
    status: pageStatus(row.status),
    draft: draftSummary(row.draft),
    published: publishedSummary(row.published),
    createdOn: readString(row.createdOn),
    updatedOn: readString(row.updatedOn),
  };
}

export async function loadPages(): Promise<MobilePageSummary[]> {
  const payload = await request('pages');
  return records(payload.data).map(pageSummary);
}

export async function createPage(input: { name: string; slug?: string; description?: string }): Promise<MobilePageSummary> {
  const payload = await request('pages', {
    method: 'POST',
    body: body({ name: input.name, slug: input.slug || undefined, description: input.description || undefined }),
  });
  return pageSummary(isRecord(payload.data) ? payload.data : {});
}

export async function loadPage(id: number): Promise<MobilePageDetail> {
  const payload = await request(`pages/${id}`);
  const data = isRecord(payload.data) ? payload.data : {};
  return {
    ...pageSummary(data),
    layout: (data.layout as MobilePageLayout) ?? { page: { name: '', width: 375, height: 812, background: { type: 'color', color: '#FFFFFF' } }, components: [] },
  };
}

export async function updatePageMeta(
  id: number,
  input: { name: string; slug: string; description?: string; status?: MobilePageStatus }
): Promise<MobilePageSummary> {
  const payload = await request(`pages/${id}`, {
    method: 'POST',
    body: body({ name: input.name, slug: input.slug, description: input.description || '', status: input.status }),
  });
  return pageSummary(isRecord(payload.data) ? payload.data : {});
}

export async function saveDraft(id: number, layout: MobilePageLayout): Promise<string> {
  const payload = await request(`pages/${id}/draft`, {
    method: 'POST',
    body: body({ layout }),
  });
  return message(payload, 'Draft saved.');
}

export async function publishPage(id: number): Promise<{ message: string; page: MobilePageSummary }> {
  const payload = await request(`pages/${id}/publish`, { method: 'POST' });
  return { message: message(payload, 'Page published.'), page: pageSummary(isRecord(payload.data) ? payload.data : {}) };
}

export type MobilePageVersion = { id: number; versionNumber: number; status: string; createdOn: string; publishedAt: string | null };

export async function loadVersions(id: number): Promise<MobilePageVersion[]> {
  const payload = await request(`pages/${id}/versions`);
  return records(payload.data).map((row) => ({
    id: readNumber(row.id),
    versionNumber: readNumber(row.version_number),
    status: readString(row.status),
    createdOn: readString(row.created_on),
    publishedAt: row.published_at ? readString(row.published_at) : null,
  }));
}

export async function deactivatePage(id: number): Promise<string> {
  const payload = await request(`pages/${id}`, { method: 'DELETE' });
  return message(payload, 'Page deactivated.');
}

export async function uploadPageAsset(id: number, file: File): Promise<string> {
  const session = buildSessionContext();
  if (!session.token || !session.subInstituteId || !session.userId) {
    throw new Error('Your login session is incomplete.');
  }

  const params = new URLSearchParams();
  appendCommonParams(params, session);

  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(
    `/api/proxy-file?path=${encodeURIComponent(`api/mobile-page-builder/pages/${id}/assets`)}&${params.toString()}`,
    {
      method: 'POST',
      body: formData,
      headers: createAuthHeaders(session),
    }
  );

  const payload: unknown = await response.json();
  if (!response.ok || (isRecord(payload) && ['0', '2'].includes(normalizeApiStatus(payload as ApiEnvelope)))) {
    throw new Error(message(payload, `Upload failed (${response.status}).`));
  }

  const data = isRecord(payload) && isRecord(payload.data) ? payload.data : {};
  return readString(data.url);
}

// -- "Select Existing Page" (MobileFormFieldRegistry.php) --------------------

export type MobileSourcePageSummary = { key: string; label: string };

export type MobileSourceField = {
  key: string;
  label: string;
  inputType: 'text' | 'number' | 'email' | 'password' | 'date' | 'select';
  required: boolean;
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
  optionsSource?: { endpoint: string; path?: string };
};

export type MobileSourceFormPage = {
  type: 'form';
  key: string;
  label: string;
  submit: { method: MobileHttpMethod; endpoint: string; successMessage?: string };
  fields: MobileSourceField[];
  /** Which field's value is the record id -- substituted into `submit.endpoint` (e.g. "…/{{id}}") and excluded from the submit body, since the real endpoint expects it in the URL only. Absent for create-style pages like Add Student. */
  idField?: string;
};

export type MobileSourceListConfig = {
  title?: string;
  searchFields: MobileSourceField[];
  searchAction: { method: MobileHttpMethod; endpoint: string };
  searchBody?: Record<string, string>;
  itemsPath?: string;
  itemIdField: string;
  itemLabelField: string;
  itemSubLabelField?: string;
  rowControl: MobileListRowControl;
  submitAction: {
    method: MobileHttpMethod;
    endpoint: string;
    rowKeys: MobileListSubmitKey[];
    extraBody?: Record<string, string>;
    successMessage?: string;
    onSuccess?: { type: 'reload' | 'navigate' | 'goBack' };
  };
};

/** A page that opens straight into a repeating search-then-rows flow (e.g. Mark Attendance) rather than a fixed field list -- see MobileFormFieldRegistry.php's class doc. */
export type MobileSourceListPage = {
  type: 'list';
  key: string;
  label: string;
  list: MobileSourceListConfig;
};

export type MobileSourcePageDetail = MobileSourceFormPage | MobileSourceListPage;

function sourceField(row: RecordValue): MobileSourceField {
  return {
    key: readString(row.key),
    label: readString(row.label),
    inputType: (readString(row.inputType) || 'text') as MobileSourceField['inputType'],
    required: Boolean(row.required),
    placeholder: readString(row.placeholder) || undefined,
    options: Array.isArray(row.options)
      ? row.options.filter(isRecord).map((option) => ({ value: readString(option.value), label: readString(option.label) }))
      : undefined,
    optionsSource: isRecord(row.optionsSource)
      ? { endpoint: readString(row.optionsSource.endpoint), path: readString(row.optionsSource.path) || undefined }
      : undefined,
  };
}

function httpTarget(value: unknown): { method: MobileHttpMethod; endpoint: string } {
  const row = isRecord(value) ? value : {};
  return { method: (readString(row.method) || 'POST') as MobileHttpMethod, endpoint: readString(row.endpoint) };
}

export async function loadSourcePages(): Promise<MobileSourcePageSummary[]> {
  const payload = await request('source-pages');
  return records(payload.data).map((row) => ({ key: readString(row.key), label: readString(row.label) }));
}

export async function loadSourcePage(key: string): Promise<MobileSourcePageDetail> {
  const payload = await request(`source-pages/${encodeURIComponent(key)}`);
  const data = isRecord(payload.data) ? payload.data : {};

  if (readString(data.type) === 'list') {
    const list = isRecord(data.list) ? data.list : {};
    return {
      type: 'list',
      key: readString(data.key),
      label: readString(data.label),
      list: {
        title: readString(list.title) || undefined,
        searchFields: records(list.searchFields).map(sourceField),
        searchAction: httpTarget(list.searchAction),
        searchBody: isRecord(list.searchBody) ? (list.searchBody as Record<string, string>) : undefined,
        itemsPath: readString(list.itemsPath) || undefined,
        itemIdField: readString(list.itemIdField) || 'id',
        itemLabelField: readString(list.itemLabelField) || 'name',
        itemSubLabelField: readString(list.itemSubLabelField) || undefined,
        rowControl: (isRecord(list.rowControl) ? list.rowControl : { type: 'toggle', trueLabel: 'Yes', trueValue: '1', falseLabel: 'No', falseValue: '0' }) as MobileListRowControl,
        submitAction: {
          ...httpTarget(list.submitAction),
          rowKeys: isRecord(list.submitAction) && Array.isArray(list.submitAction.rowKeys) ? (list.submitAction.rowKeys as MobileListSubmitKey[]) : [],
          extraBody: isRecord(list.submitAction) && isRecord(list.submitAction.extraBody) ? (list.submitAction.extraBody as Record<string, string>) : undefined,
          successMessage: isRecord(list.submitAction) ? readString(list.submitAction.successMessage) || undefined : undefined,
          onSuccess: isRecord(list.submitAction) && isRecord(list.submitAction.onSuccess) ? (list.submitAction.onSuccess as { type: 'reload' | 'navigate' | 'goBack' }) : undefined,
        },
      },
    };
  }

  return {
    type: 'form',
    key: readString(data.key),
    label: readString(data.label),
    submit: isRecord(data.submit)
      ? { method: (readString(data.submit.method) || 'POST') as MobileHttpMethod, endpoint: readString(data.submit.endpoint), successMessage: readString(data.submit.successMessage) || undefined }
      : { method: 'POST', endpoint: '' },
    fields: records(data.fields).map(sourceField),
    idField: readString(data.idField) || undefined,
  };
}

// -- "Browse all my pages" (every real page on the tenant's sidebar) --------

export type MobileMenuPage = {
  id: number;
  name: string;
  section: string;
  /** Set when MobileFormFieldRegistry has this page's fields traced -- selecting it auto-imports via loadSourcePage(sourceKey), same as the hand-picked cards. Null -> selecting it creates a blank page named after this menu item. */
  sourceKey: string | null;
};

export async function loadMenuPages(): Promise<MobileMenuPage[]> {
  const payload = await request('menu-pages');
  return records(payload.data).map((row) => ({
    id: readNumber(row.id),
    name: readString(row.name),
    section: readString(row.section) || 'Other',
    sourceKey: row.sourceKey ? readString(row.sourceKey) : null,
  }));
}
