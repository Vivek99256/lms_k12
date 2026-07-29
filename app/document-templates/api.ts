import {
  appendCommonParams,
  buildSessionContext,
  createAuthHeaders,
  normalizeApiStatus,
  readString,
  type SessionContext,
} from '@/lib/erp-client';

/**
 * Document Templates data layer (api\DocumentTemplateApiController).
 *
 *   GET  /api/document-templates                       → list (no content)
 *   GET  /api/document-templates/{id}                  → one template + content
 *   POST /api/document-templates                       → create
 *   POST /api/document-templates/{id}                  → update (snapshots previous version)
 *   POST /api/document-templates/{id}/delete           → delete
 *   POST /api/document-templates/{id}/duplicate        → copy
 *   GET  /api/document-templates/{id}/versions         → version history
 *   POST /api/document-templates/{id}/restore/{v}      → roll back
 *   GET  /api/document-templates/merge-fields          → {{token}} catalog
 *   GET  /api/document-templates/merge-data            → resolved values for a student
 *   GET  /api/document-templates/preview-students      → student picker
 *
 * Mutations are POST (not PUT/DELETE) to match the convention the other Next
 * facing endpoints in this backend already use.
 */

export type TemplateCategory =
  | 'certificate'
  | 'id_card'
  | 'fees'
  | 'admission'
  | 'exam'
  | 'circular'
  | 'general';

export type TemplateStatus = 'draft' | 'published' | 'archived';

export interface TemplateSummary {
  id: number;
  name: string;
  category: TemplateCategory;
  description: string;
  status: TemplateStatus;
  version: number;
  updatedAt: string;
}

export interface TemplateDetail extends TemplateSummary {
  /** Craft.js serialized document. */
  content: string;
}

export interface TemplateVersionSummary {
  id: number;
  version: number;
  name: string;
  createdAt: string;
}

export interface MergeFieldGroup {
  key: string;
  label: string;
  fields: { token: string; label: string }[];
}

export interface PreviewStudent {
  id: number;
  name: string;
  admissionId: string;
  rollNo: string;
  standard: string;
  division: string;
}

export interface TemplateInput {
  name: string;
  category: TemplateCategory;
  description?: string;
  content: string;
  status?: TemplateStatus;
}

// ---------------------------------------------------------------------------
// Plumbing
// ---------------------------------------------------------------------------

function requireSession(): SessionContext {
  const session = buildSessionContext();
  if (!session.baseUrl) throw new Error('Session data is missing. Please sign in again.');
  return session;
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function toArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function readNumberId(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function readJson(res: Response, fallback: string): Promise<unknown> {
  const text = (await res.text()).trim();
  if (!text) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error(`${fallback} (HTTP ${res.status}).`);
  }
}

/** Unwrap the {status_code, message, data} envelope, raising the server's message. */
async function unwrap(res: Response, fallback: string): Promise<Record<string, unknown>> {
  // A 404 here means the route itself is absent — i.e. the ERP server is running
  // a build without the Document Templates API — not that a record is missing.
  // Say so plainly; "HTTP 404" alone sends people hunting for the wrong bug.
  if (res.status === 404) {
    throw new Error(
      'The Document Templates API is not available on this ERP server yet. ' +
        'Deploy the latest backend (routes/api.php + DocumentTemplateApiController) and run its migrations.'
    );
  }

  const raw = toRecord(await readJson(res, fallback));
  const status = normalizeApiStatus(raw);
  const message = readString(raw.message);

  if (!res.ok || (status !== '' && status !== '1')) {
    throw new Error(message || `${fallback} (HTTP ${res.status}).`);
  }

  return toRecord(raw.data);
}

function buildUrl(session: SessionContext, path: string): URL {
  const url = new URL(`${session.baseUrl}/api/document-templates${path}`);
  appendCommonParams(url.searchParams, session);
  if (session.userId) url.searchParams.set('user_id', session.userId);
  return url;
}

function jsonBody(session: SessionContext, payload: Record<string, unknown>): string {
  return JSON.stringify({
    type: 'API',
    sub_institute_id: session.subInstituteId,
    syear: session.syear,
    user_id: session.userId,
    ...payload,
  });
}

async function get(path: string, signal?: AbortSignal, params?: Record<string, string>) {
  const session = requireSession();
  const url = buildUrl(session, path);
  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (value) url.searchParams.set(key, value);
  });

  const res = await fetch(url.toString(), {
    headers: { ...createAuthHeaders(session), 'X-Requested-With': 'XMLHttpRequest' },
    signal,
  });
  return unwrap(res, 'Failed to load document templates');
}

async function post(path: string, payload: Record<string, unknown>, fallback: string) {
  const session = requireSession();
  const res = await fetch(buildUrl(session, path).toString(), {
    method: 'POST',
    headers: {
      ...createAuthHeaders(session, 'application/json'),
      'X-Requested-With': 'XMLHttpRequest',
    },
    body: jsonBody(session, payload),
  });
  return unwrap(res, fallback);
}

// ---------------------------------------------------------------------------
// Mapping
// ---------------------------------------------------------------------------

function mapSummary(entry: unknown): TemplateSummary {
  const row = toRecord(entry);
  return {
    id: readNumberId(row.id),
    name: readString(row.name),
    category: (readString(row.category) || 'general') as TemplateCategory,
    description: readString(row.description),
    status: (readString(row.status) || 'draft') as TemplateStatus,
    version: readNumberId(row.version),
    updatedAt: readString(row.updated_at),
  };
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

export async function fetchTemplates(
  filters: { category?: string; status?: string; q?: string } = {},
  signal?: AbortSignal
): Promise<{ templates: TemplateSummary[]; categories: Record<string, string> }> {
  const data = await get('', signal, {
    category: filters.category ?? '',
    status: filters.status ?? '',
    q: filters.q ?? '',
  });

  return {
    templates: toArray(data.templates).map(mapSummary),
    categories: toRecord(data.categories) as Record<string, string>,
  };
}

export async function fetchTemplate(id: string | number, signal?: AbortSignal): Promise<TemplateDetail> {
  const data = await get(`/${encodeURIComponent(String(id))}`, signal);
  const row = toRecord(data.template);
  return { ...mapSummary(row), content: readString(row.content) };
}

export async function createTemplate(input: TemplateInput): Promise<TemplateDetail> {
  const data = await post(
    '',
    {
      name: input.name,
      category: input.category,
      description: input.description ?? '',
      content: input.content,
      status: input.status ?? 'draft',
    },
    'Failed to save the template'
  );
  const row = toRecord(data.template);
  return { ...mapSummary(row), content: readString(row.content) };
}

export async function updateTemplate(
  id: string | number,
  input: TemplateInput
): Promise<TemplateDetail> {
  const data = await post(
    `/${encodeURIComponent(String(id))}`,
    {
      name: input.name,
      category: input.category,
      description: input.description ?? '',
      content: input.content,
      status: input.status ?? 'draft',
    },
    'Failed to update the template'
  );
  const row = toRecord(data.template);
  return { ...mapSummary(row), content: readString(row.content) };
}

export async function deleteTemplate(id: string | number): Promise<void> {
  await post(`/${encodeURIComponent(String(id))}/delete`, {}, 'Failed to delete the template');
}

export async function duplicateTemplate(id: string | number): Promise<TemplateSummary> {
  const data = await post(
    `/${encodeURIComponent(String(id))}/duplicate`,
    {},
    'Failed to duplicate the template'
  );
  return mapSummary(toRecord(data.template));
}

// ---------------------------------------------------------------------------
// Versions
// ---------------------------------------------------------------------------

export async function fetchVersions(
  id: string | number,
  signal?: AbortSignal
): Promise<{ versions: TemplateVersionSummary[]; currentVersion: number }> {
  const data = await get(`/${encodeURIComponent(String(id))}/versions`, signal);

  return {
    versions: toArray(data.versions).map((entry) => {
      const row = toRecord(entry);
      return {
        id: readNumberId(row.id),
        version: readNumberId(row.version),
        name: readString(row.name),
        createdAt: readString(row.created_at),
      };
    }),
    currentVersion: readNumberId(data.current_version),
  };
}

export async function restoreVersion(
  id: string | number,
  version: number
): Promise<TemplateDetail> {
  const data = await post(
    `/${encodeURIComponent(String(id))}/restore/${version}`,
    {},
    'Failed to restore that version'
  );
  const row = toRecord(data.template);
  return { ...mapSummary(row), content: readString(row.content) };
}

// ---------------------------------------------------------------------------
// Merge fields
// ---------------------------------------------------------------------------

export async function fetchMergeFields(signal?: AbortSignal): Promise<MergeFieldGroup[]> {
  const data = await get('/merge-fields', signal);

  return toArray(data.groups).map((entry) => {
    const group = toRecord(entry);
    return {
      key: readString(group.key),
      label: readString(group.label),
      fields: toArray(group.fields).map((field) => {
        const row = toRecord(field);
        return { token: readString(row.token), label: readString(row.label) };
      }),
    };
  });
}

/** Resolved {{token}} → value map. Pass a student to fill the student/guardian groups. */
export async function fetchMergeData(
  options: { studentId?: string; referenceNo?: string } = {},
  signal?: AbortSignal
): Promise<Record<string, string>> {
  const data = await get('/merge-data', signal, {
    student_id: options.studentId ?? '',
    reference_no: options.referenceNo ?? '',
  });

  const values = toRecord(data.values);
  return Object.fromEntries(
    Object.entries(values).map(([token, value]) => [token, readString(value)])
  );
}

export async function searchPreviewStudents(
  query: string,
  signal?: AbortSignal
): Promise<PreviewStudent[]> {
  const data = await get('/preview-students', signal, { q: query });

  return toArray(data.students).map((entry) => {
    const row = toRecord(entry);
    return {
      id: readNumberId(row.id),
      name: readString(row.name),
      admissionId: readString(row.admission_id),
      rollNo: readString(row.roll_no),
      standard: readString(row.standard_name),
      division: readString(row.division_name),
    };
  });
}
