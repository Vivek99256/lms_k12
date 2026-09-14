'use client';

import { buildSessionContext, createAuthHeaders } from '@/lib/erp-client';

/**
 * Browser client for the Document module's read API.
 *
 * TALKS TO LARAVEL DIRECTLY, like lib/platform/client.ts. A Next proxy earns its
 * place when the server must add something the browser may not hold — a service
 * credential, a signature. Here it would add nothing: the bearer token the
 * browser already has is exactly what `api.session` wants, and a hop that only
 * forwards a header is a hop that can fail on its own.
 *
 * THERE ARE NO WRITE FUNCTIONS IN THIS FILE, and that is the point. The Document
 * module reads; uploading, editing and deleting a document stays with the module
 * that owns it. Every row carries `moduleRoute` so the UI can send the user
 * there instead of growing a second way to do the same thing.
 *
 * NO TENANT IS SENT. The endpoint reads sub_institute_id off the verified JWT
 * and ignores anything a query string says about it, so there is no institute
 * parameter here and no way for this client to name another school.
 */

export class DocumentsApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'DocumentsApiError';
    this.status = status;
  }
}

export interface DocumentSourceSummary {
  key: string;
  label: string;
  count: number;
  route: string | null;
  /**
   * Whether this source's table has an academic-year column. Five of the
   * thirteen do not, so their counts are the same for every year — a property
   * of those tables, not of the filter.
   */
  yearScoped: boolean;
}

export interface DocumentDomain {
  key: string;
  label: string;
  icon: string;
  description: string;
  total: number;
  /** True when at least one source in this domain responds to the year. */
  yearScoped: boolean;
  sources: DocumentSourceSummary[];
}

export interface DocumentsOverview {
  domains: DocumentDomain[];
  total: number;
  /** Sources whose table is absent from this database — shown, not hidden. */
  unavailableSources: string[];
  syear: string | null;
}

export interface DocumentRow {
  id: string | number | null;
  title: string;
  fileName: string;
  extension: string;
  status: string | null;
  ownerId: string | number | null;
  createdAt: string | null;
  /** The same URL the owning module builds. May be null for a row with no file. */
  url: string | null;
  moduleRoute: string | null;
  sourceKey?: string;
  sourceLabel?: string;
}

export interface DocumentPage {
  source: { key: string; label: string; domain: string | null; route: string | null };
  rows: DocumentRow[];
  pagination: { page: number; perPage: number; total: number; pages: number };
}

type Envelope = { status_code?: number; message?: string; data?: unknown };

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : value == null ? '' : String(value);
}

async function call<T>(path: string, params?: Record<string, string | undefined>): Promise<T> {
  const session = buildSessionContext();

  if (!session.baseUrl) {
    throw new DocumentsApiError('The ERP host is not configured for this session. Sign in again.', 0);
  }

  const search = new URLSearchParams();
  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== '') search.set(key, value);
  });

  const query = search.toString();
  const response = await fetch(
    `${session.baseUrl}/api/documents${path}${query ? `?${query}` : ''}`,
    { headers: createAuthHeaders(session), cache: 'no-store' },
  );

  const payload = (await response.json().catch(() => null)) as Envelope | null;

  // Both halves matter: a 200 carrying status_code 0 is still a refusal, and
  // this API uses that shape for anything the caller can act on.
  if (!response.ok || payload?.status_code === 0) {
    const message = payload?.message?.trim()
      ? payload.message
      : `The request failed (${response.status}).`;
    throw new DocumentsApiError(message, response.status);
  }

  return (payload?.data ?? {}) as T;
}

function mapRow(value: unknown): DocumentRow {
  const row = asRecord(value);

  return {
    id: (row.id as string | number | null) ?? null,
    title: str(row.title) || 'Untitled document',
    fileName: str(row.file_name),
    extension: str(row.extension),
    status: row.status == null ? null : str(row.status),
    ownerId: (row.owner_id as string | number | null) ?? null,
    createdAt: row.created_at == null ? null : str(row.created_at),
    url: row.url == null || str(row.url) === '' ? null : str(row.url),
    moduleRoute: row.module_route == null ? null : str(row.module_route),
    sourceKey: row.source_key == null ? undefined : str(row.source_key),
    sourceLabel: row.source_label == null ? undefined : str(row.source_label),
  };
}

/** The dashboard payload: domains, their sources, and each source's count. */
export async function fetchOverview(syear?: string): Promise<DocumentsOverview> {
  const data = asRecord(await call<unknown>('/sources', { syear }));

  return {
    domains: (Array.isArray(data.domains) ? data.domains : []).map((entry) => {
      const domain = asRecord(entry);
      return {
        key: str(domain.key),
        label: str(domain.label),
        icon: str(domain.icon) || 'file-text',
        description: str(domain.description),
        total: Number(domain.total) || 0,
        yearScoped: domain.year_scoped === true,
        sources: (Array.isArray(domain.sources) ? domain.sources : []).map((item) => {
          const source = asRecord(item);
          return {
            key: str(source.key),
            label: str(source.label),
            count: Number(source.count) || 0,
            route: source.route == null ? null : str(source.route),
            yearScoped: source.year_scoped === true,
          };
        }),
      };
    }),
    total: Number(data.total) || 0,
    unavailableSources: (Array.isArray(data.unavailable_sources) ? data.unavailable_sources : []).map(str),
    syear: data.syear == null ? null : str(data.syear),
  };
}

/** One source's rows. */
export async function fetchSource(options: {
  source: string;
  search?: string;
  page?: number;
  perPage?: number;
  syear?: string;
}): Promise<DocumentPage> {
  const data = asRecord(
    await call<unknown>('', {
      source: options.source,
      search: options.search,
      page: options.page ? String(options.page) : undefined,
      per_page: options.perPage ? String(options.perPage) : undefined,
      syear: options.syear,
    }),
  );

  const source = asRecord(data.source);
  const pagination = asRecord(data.pagination);

  return {
    source: {
      key: str(source.key),
      label: str(source.label),
      domain: source.domain == null ? null : str(source.domain),
      route: source.route == null ? null : str(source.route),
    },
    rows: (Array.isArray(data.rows) ? data.rows : []).map(mapRow),
    pagination: {
      page: Number(pagination.page) || 1,
      perPage: Number(pagination.per_page) || 25,
      total: Number(pagination.total) || 0,
      pages: Number(pagination.pages) || 1,
    },
  };
}

/** Newest documents across every source. */
export async function fetchRecent(limit = 10, syear?: string): Promise<DocumentRow[]> {
  const data = asRecord(await call<unknown>('/recent', { limit: String(limit), syear }));

  return (Array.isArray(data.rows) ? data.rows : []).map(mapRow);
}
