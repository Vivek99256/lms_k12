'use client';

import { getApiBaseUrl, type FeesSession } from '@/app/fees/_lib/fees-api';

/**
 * Client for the module category navigation feed — the one every module uses.
 *
 * Backend: next_lms_erp/app/Http/Controllers/api/ModuleMenuCategoryApiController.php
 * Proxy:   app/api/modules/menu-categories/route.ts
 *
 * The categories are a presentation grouping over each module's EXISTING
 * tblmenumaster menus: Onboarding, Process Builder, Master Setup, Operations,
 * Reports, Intelligence, Help Guide/Support, Communication, AI Stack (Fees adds
 * Workflow, Scheduler and Audit Trail). The backend decides membership and
 * order and applies status, tenant provisioning and menu rights, so this module
 * renders whatever comes back without re-filtering.
 *
 * The session reader (`getFeesSession`/`FeesSession`) is generic despite the
 * name — it reads the same browser-storage session every module uses — so it is
 * reused here rather than duplicated. See app/fees/_lib/fees-api.ts.
 */

export type ModuleCategoryItem = {
  /** tblmenumaster.id of the existing menu — unchanged, never duplicated. */
  id: number;
  label: string;
  /** The existing menu's `link`, resolved to a route by mapApiLinkToRoute. */
  link: string;
};

export type ModuleCategory = {
  key: string;
  label: string;
  description: string;
  /** The category's own page, e.g. /modules/student/operations. Configured per row. */
  route: string;
  items: ModuleCategoryItem[];
};

/** A configured module: its slug, the level-2 menu row it is, and that row's name and link. */
export type ModuleDirectoryEntry = {
  moduleName: string;
  level2MenuId: number;
  label: string;
  /** The level-2 menu's legacy `link`. Read by the Intelligence matcher. */
  link: string;
};

export type ModuleCategoriesResponse = {
  /** Every configured module. Present on every response, including the directory-only one. */
  modules: ModuleDirectoryEntry[];
  /** The module asked about, or null when none was asked for or none matched. */
  module: ModuleDirectoryEntry | null;
  categories: ModuleCategory[];
};

const MENU_CATEGORIES_PATH = '/api/modules/menu-categories';

function buildHeaders(session: FeesSession) {
  const headers = new Headers();
  headers.set('Accept', 'application/json');
  headers.set('X-Requested-With', 'XMLHttpRequest');
  headers.set('x-laravel-base-url', getApiBaseUrl(session));
  if (session.token) headers.set('x-laravel-token', session.token);
  if (session.subInstituteId) headers.set('x-sub-institute-id', session.subInstituteId);
  if (session.userId) headers.set('x-user-id', session.userId);
  if (session.userProfileId) headers.set('x-user-profile-id', session.userProfileId);
  if (session.userProfileName) headers.set('x-user-profile-name', session.userProfileName);
  if (session.clientId) headers.set('x-client-id', session.clientId);
  return headers;
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function readDirectory(value: unknown): ModuleDirectoryEntry[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((entry): ModuleDirectoryEntry[] => {
    if (!entry || typeof entry !== 'object') return [];
    const record = entry as Record<string, unknown>;
    const moduleName = readString(record.module_name).trim();
    const level2MenuId = Number(record.level2_menu_id) || 0;
    if (!moduleName || !level2MenuId) return [];
    return [
      {
        moduleName,
        level2MenuId,
        label: readString(record.label).trim(),
        link: readString(record.link).trim(),
      },
    ];
  });
}

function readEntry(value: unknown): ModuleDirectoryEntry | null {
  return readDirectory(value == null ? [] : [value])[0] ?? null;
}

function readCategories(value: unknown): ModuleCategory[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((entry): ModuleCategory[] => {
    if (!entry || typeof entry !== 'object') return [];
    const record = entry as Record<string, unknown>;
    const key = readString(record.key);
    const label = readString(record.label);
    if (!key || !label) return [];

    const items = Array.isArray(record.items)
      ? record.items.flatMap((item): ModuleCategoryItem[] => {
          if (!item || typeof item !== 'object') return [];
          const itemRecord = item as Record<string, unknown>;
          const itemLabel = readString(itemRecord.label);
          if (!itemLabel) return [];
          return [
            {
              id: Number(itemRecord.id) || 0,
              label: itemLabel,
              link: readString(itemRecord.link),
            },
          ];
        })
      : [];

    return [
      {
        key,
        label,
        description: readString(record.description),
        route: readString(record.route),
        items,
      },
    ];
  });
}

function readResponse(payload: unknown): ModuleCategoriesResponse {
  const root = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
  const data = root.data && typeof root.data === 'object' ? (root.data as Record<string, unknown>) : root;

  return {
    modules: readDirectory(data.modules),
    module: readEntry(data.module),
    categories: readCategories(data.categories),
  };
}

/**
 * One module's categories, or — with neither identifier — the module directory
 * alone.
 *
 * `moduleName` is the slug in `/modules/<slug>/...`; `level2MenuId` is the
 * tblmenumaster row the shell has selected. The shell knows only the second and
 * a category page knows only the first, which is why both are accepted.
 */
export async function fetchModuleMenuCategories(
  session: FeesSession,
  target: { moduleName?: string; level2MenuId?: number | string },
  signal?: AbortSignal
): Promise<ModuleCategoriesResponse> {
  const query = new URLSearchParams();
  if (target.moduleName) query.set('module_name', target.moduleName);
  else if (target.level2MenuId) query.set('level2_menu_id', String(target.level2MenuId));

  const suffix = query.toString();
  const response = await fetch(suffix ? `${MENU_CATEGORIES_PATH}?${suffix}` : MENU_CATEGORIES_PATH, {
    method: 'GET',
    headers: buildHeaders(session),
    cache: 'no-store',
    signal,
  });

  const text = await response.text();
  let payload: unknown;
  try {
    payload = JSON.parse(text) as unknown;
  } catch {
    throw new Error('The module category navigation returned an unexpected response.');
  }

  if (!response.ok) {
    const message = (payload as Record<string, unknown>)?.message;
    throw new Error(
      typeof message === 'string' && message
        ? message
        : 'Unable to load the module category navigation.'
    );
  }

  return readResponse(payload);
}
