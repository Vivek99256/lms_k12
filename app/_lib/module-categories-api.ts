'use client';

import { getApiBaseUrl, type FeesSession } from '@/app/fees/_lib/fees-api';

/**
 * Client for the module category-navigation feed — the one Fees and
 * Teach/Learn each had a copy of, now serving every module.
 *
 * Backend: next_lms_erp/app/Http/Controllers/api/ModuleMenuCategoryApiController.php
 * Proxy:   app/api/modules/menu-categories/route.ts (and /registry)
 *
 * The categories are a presentation layer over each module's *existing* menus.
 * They are not tblmenumaster rows and introduce no new menu level. The backend
 * decides membership and order and applies all three visibility rules
 * (status = 1, tenant provisioning, and the caller's menu rights), so nothing
 * here re-filters what comes back.
 *
 * The session reader (`getFeesSession`/`FeesSession`) is generic despite the
 * name — it reads the same browser-storage session every module uses — so it
 * is reused rather than duplicated. See app/fees/_lib/fees-api.ts.
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
  /** The category's own page, e.g. /modules/inventory/reports. Configured per row. */
  route: string;
  /**
   * Set on the Onboarding category only: the onboarding journey this module
   * shows, from `onboarding_module.module_key`.
   *
   * Onboarding is not a set of menus to group — it is the journey that already
   * lives in the onboarding module — so the Onboarding category is empty
   * everywhere and this key is what tells the category page which journey to
   * render. Empty means the bar has no single journey (a bar that collects
   * screens from several modules), and the page points at the onboarding index
   * instead of guessing one.
   */
  onboardingModuleKey: string;
  /**
   * Set on the Workflow and Schedular categories: the
   * `config/platform_services.php` module whose approval points and scheduled
   * tasks this bar configures.
   *
   * Both are the same kind of category as Onboarding — a console that already
   * exists centrally, reached from inside the module — so the key says which
   * module to pin it to. One key serves both, because both read one registry.
   * Empty means the registry declares no such module, and the page says so
   * instead of showing a neighbouring module's records.
   */
  platformModuleKey: string;
  /**
   * Set on the Audit Trail category only: the `access_log_route.module`
   * prefixes this module's screens write.
   *
   * A list, not a key, because that column holds the first path segment of the
   * URL that was opened and one bar's screens can sit under several — the Exam
   * bar logs under both 'exam' and 'result'. Empty means this module's screens
   * never reach the middleware that writes the log.
   */
  auditModuleKeys: string[];
  items: ModuleCategoryItem[];
};

/** One row of the registry: a module that has a category bar. */
export type ModuleRegistryEntry = {
  /** The module slug, e.g. 'inventory', 'fees', 'teach_learn'. */
  moduleName: string;
  /**
   * The level-2 tblmenumaster.id this module's bar belongs to. The only
   * unambiguous way to match the user's menu selection to a module — labels
   * are not unique ("Task Management" exists twice).
   */
  level2MenuId: number | null;
  /** The level-2 menu's own name, for display. */
  label: string;
  /**
   * How many active categories this module's bar has.
   *
   * The sidebar uses it to decide whether a level-2 menu has anything below
   * it, overriding the raw child count from the menu tree — Teach/Learn has
   * two level-3 menus but ten categories, and it is the categories the user
   * will actually see.
   */
  categoryCount: number;
  /**
   * Dominant prefix of this module's category routes, e.g. '/fees' or
   * '/modules/inventory'. Used to recognise a deep link as belonging to the
   * module on a cold load, before any level-2 selection exists.
   */
  baseRoute: string;
  /**
   * Every one of this module's category routes, normalized.
   *
   * Needed alongside `baseRoute` because a module's routes need not share a
   * prefix — Teach/Learn points Onboarding at /onboarding/lms and Process
   * Builder at /general/add_process, which prefix matching alone would miss.
   */
  routes: string[];
};

const MENU_CATEGORIES_PATH = '/api/modules/menu-categories';
const REGISTRY_PATH = '/api/modules/menu-categories/registry';

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

/**
 * The payload envelope has varied between these endpoints ({data: {categories}},
 * {data: [...]}, {categories}), so all three are accepted rather than assuming
 * one and returning an empty bar when it is another.
 */
function readCategories(payload: unknown): ModuleCategory[] {
  if (!payload || typeof payload !== 'object') return [];

  const root = payload as Record<string, unknown>;
  const data = root.data;
  const raw = Array.isArray(data)
    ? data
    : Array.isArray(root.categories)
      ? root.categories
      : data && typeof data === 'object'
        ? (data as Record<string, unknown>).categories
        : undefined;
  if (!Array.isArray(raw)) return [];

  return raw.flatMap((entry): ModuleCategory[] => {
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
        onboardingModuleKey: readString(record.onboarding_module_key),
        platformModuleKey: readString(record.platform_module_key),
        auditModuleKeys: Array.isArray(record.audit_module_keys)
          ? record.audit_module_keys.map(readString).filter((key) => key !== '')
          : [],
        items,
      },
    ];
  });
}

function readRegistry(payload: unknown): ModuleRegistryEntry[] {
  if (!payload || typeof payload !== 'object') return [];

  const root = payload as Record<string, unknown>;
  const data = root.data;
  const raw = Array.isArray(data)
    ? data
    : data && typeof data === 'object'
      ? (data as Record<string, unknown>).modules
      : undefined;
  if (!Array.isArray(raw)) return [];

  return raw.flatMap((entry): ModuleRegistryEntry[] => {
    if (!entry || typeof entry !== 'object') return [];
    const record = entry as Record<string, unknown>;
    const moduleName = readString(record.module_name);
    if (!moduleName) return [];

    const level2MenuId = Number(record.level2_menu_id);

    return [
      {
        moduleName,
        level2MenuId: Number.isFinite(level2MenuId) && level2MenuId > 0 ? level2MenuId : null,
        label: readString(record.label),
        categoryCount: Number(record.category_count) || 0,
        baseRoute: readString(record.base_route),
        routes: Array.isArray(record.routes)
          ? record.routes.map(readString).filter((route) => route !== '')
          : [],
      },
    ];
  });
}

async function readJson(response: Response, what: string): Promise<unknown> {
  const text = await response.text();

  let payload: unknown;
  try {
    payload = JSON.parse(text) as unknown;
  } catch {
    throw new Error(`The ${what} returned an unexpected response.`);
  }

  if (!response.ok) {
    const message = (payload as Record<string, unknown>)?.message;
    throw new Error(typeof message === 'string' && message ? message : `Unable to load the ${what}.`);
  }

  return payload;
}

export async function fetchModuleMenuCategories(
  session: FeesSession,
  module: { moduleName?: string; level2MenuId?: number | null },
  signal?: AbortSignal
): Promise<ModuleCategory[]> {
  const params = new URLSearchParams();
  if (module.level2MenuId) params.set('level2_menu_id', String(module.level2MenuId));
  if (module.moduleName) params.set('module_name', module.moduleName);

  const response = await fetch(`${MENU_CATEGORIES_PATH}?${params.toString()}`, {
    method: 'GET',
    headers: buildHeaders(session),
    cache: 'no-store',
    signal,
  });

  return readCategories(await readJson(response, 'module category navigation'));
}

export async function fetchModuleCategoryRegistry(
  session: FeesSession,
  signal?: AbortSignal
): Promise<ModuleRegistryEntry[]> {
  const response = await fetch(REGISTRY_PATH, {
    method: 'GET',
    headers: buildHeaders(session),
    cache: 'no-store',
    signal,
  });

  return readRegistry(await readJson(response, 'module category registry'));
}
