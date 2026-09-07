import {
  appendCommonParams,
  buildSessionContext,
  createAuthHeaders,
  type ApiEnvelope,
} from '@/lib/erp-client';
import type {
  ClusterItem, CourseItem, EmployerItem, InstituteItem, OccupationMainSection, ResultItem, SelectedFilters,
  SideMenuSection,
} from './types';

const KEYS = ['data', 'result', 'results', 'records', 'list', 'career', 'question'];

function messageFrom(payload: unknown, fallback: string) {
  if (payload && typeof payload === 'object') {
    const message = (payload as Record<string, unknown>).message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return fallback;
}

export function recordsFrom<T = unknown>(payload: unknown): T[] {
  if (Array.isArray(payload)) {
    return payload.filter((item): item is T => Boolean(item && typeof item === 'object'));
  }
  if (!payload || typeof payload !== 'object') return [];
  const value = payload as Record<string, unknown>;
  for (const key of KEYS) {
    const rows = recordsFrom<T>(value[key]);
    if (rows.length) return rows;
  }
  return [];
}

export async function careerExplorerRequest<T = unknown>(
  endpoint: string,
  params: Record<string, string | number | undefined> = {},
  options: RequestInit = {}
): Promise<T> {
  const session = buildSessionContext();
  const search = new URLSearchParams();
  appendCommonParams(search, session);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && String(value).trim()) search.set(key, String(value));
  });
  const path = `/api/proxy?path=${encodeURIComponent(endpoint)}&${search.toString()}`;
  let response: Response;
  try {
    response = await fetch(path, {
      cache: 'no-store',
      ...options,
      headers: {
        ...createAuthHeaders(
          session,
          options.body instanceof FormData ? undefined : 'application/json'
        ),
        ...options.headers,
      },
    });
  } catch {
    throw new Error('The career explorer service could not be reached. Check your connection and try again.');
  }
  const text = await response.text();
  let payload: unknown = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    throw new Error('The career explorer service returned an unreadable response.');
  }
  const envelope = payload as ApiEnvelope;
  if (!response.ok || ['0', '2'].includes(String(envelope.status ?? envelope.status_code ?? ''))) {
    throw new Error(messageFrom(payload, `Request failed (HTTP ${response.status}).`));
  }
  return payload as T;
}

export async function loadClusters(): Promise<ClusterItem[]> {
  return recordsFrom<ClusterItem>(await careerExplorerRequest('careerCluster'));
}

export async function loadSideMenu(): Promise<SideMenuSection[]> {
  return recordsFrom<SideMenuSection>(await careerExplorerRequest('careerExplore'));
}

/**
 * `filters` maps element_type -> selected element_ids, mirroring the source
 * app's EduSideMenu behaviour (comma-joined ids per type as query params).
 */
export async function loadFilteredResults(filters: SelectedFilters): Promise<ResultItem[]> {
  const params: Record<string, string> = {};
  Object.entries(filters).forEach(([type, ids]) => {
    if (ids.length) params[type] = ids.join(',');
  });
  return recordsFrom<ResultItem>(await careerExplorerRequest('careerExploreResult', params));
}

export async function searchCareers(title: string): Promise<ResultItem[]> {
  return recordsFrom<ResultItem>(await careerExplorerRequest('allOccupation', { title }));
}

export type ExpertAdviceResponse = { title?: string; data?: Array<Record<string, unknown>> };
export type ExploreSectorResponse = { title?: string; image?: string; data?: Array<{ key?: string; value?: string; html?: string }> };

export async function loadExpertAdvice(title: string): Promise<ExpertAdviceResponse> {
  return careerExplorerRequest<ExpertAdviceResponse>('ExpertAdvice', { title });
}

export async function loadExploreSector(title: string): Promise<ExploreSectorResponse> {
  return careerExplorerRequest<ExploreSectorResponse>('ExploreSector', { title });
}
export async function loadInstitutes(): Promise<InstituteItem[]> {
  return recordsFrom<InstituteItem>(await careerExplorerRequest('getInstituteData'));
}

export async function loadCourses(): Promise<CourseItem[]> {
  return recordsFrom<CourseItem>(await careerExplorerRequest('getCourseData'));
}

export async function loadEmployers(): Promise<EmployerItem[]> {
  return recordsFrom<EmployerItem>(await careerExplorerRequest('getEmployerData'));
}

export async function loadOccupationDetails(onetsocCode: string): Promise<OccupationMainSection[]> {
  return recordsFrom<OccupationMainSection>(
    await careerExplorerRequest('OccupationDetails', { onetsoc_code: onetsocCode })
  );
}
