'use client';

import { getApiBaseUrl, type FeesSession } from '@/app/fees/_lib/fees-api';

/**
 * Client for the Teach/Learn category navigation feed.
 *
 * Backend: next_lms_erp/app/Http/Controllers/api/TeachLearnMenuCategoryApiController.php
 * Proxy:   app/api/teach-learn/menu-categories/route.ts
 *
 * The categories are a Teach/Learn-page presentation layer over the existing
 * rows in fees_menu_categories and fees_menu_category_items. The backend
 * decides membership and order and applies status, tenant provisioning and
 * menu rights, so this module renders whatever comes back without re-filtering.
 *
 * The session reader (`getFeesSession`/`FeesSession`) is generic despite the
 * name — it reads the same browser-storage session every module uses — so it
 * is reused here rather than duplicated. See app/fees/_lib/fees-api.ts.
 */

export type TeachLearnCategoryItem = {
  /** tblmenumaster.id of the existing menu — unchanged, never duplicated. */
  id: number;
  label: string;
  moduleName?: string;
  /** The existing menu's `link`, resolved to a route by mapApiLinkToRoute. */
  link: string;
};

export type TeachLearnCategory = {
  key: string;
  label: string;
  description: string;
  /** The category's own page, e.g. /teach-learn/master-setup. Configured per row. */
  route: string;
  items: TeachLearnCategoryItem[];
};

const MENU_CATEGORIES_PATH = '/api/teach-learn/menu-categories';

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

function readCategories(payload: unknown): TeachLearnCategory[] {
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

  return raw.flatMap((entry): TeachLearnCategory[] => {
    if (!entry || typeof entry !== 'object') return [];
    const record = entry as Record<string, unknown>;
    const key = typeof record.key === 'string' ? record.key : '';
    const label = typeof record.label === 'string' ? record.label : '';
    if (!key || !label) return [];

    const items = Array.isArray(record.items)
      ? record.items.flatMap((item): TeachLearnCategoryItem[] => {
          if (!item || typeof item !== 'object') return [];
          const itemRecord = item as Record<string, unknown>;
          const itemLabel = typeof itemRecord.label === 'string' ? itemRecord.label : '';
          if (!itemLabel) return [];
          const moduleName = typeof itemRecord.module_name === 'string'
            ? itemRecord.module_name.trim().toLowerCase()
            : '';
          if (moduleName && moduleName !== 'teach_learn' && moduleName !== 'teach/learn') return [];

          return [
            {
              id: Number(itemRecord.id) || 0,
              label: itemLabel,
              ...(moduleName ? { moduleName } : {}),
              link: typeof itemRecord.link === 'string' ? itemRecord.link : '',
            },
          ];
        })
      : [];

    return [
      {
        key,
        label,
        description: typeof record.description === 'string' ? record.description : '',
        route: typeof record.route === 'string' ? record.route : '',
        items,
      },
    ];
  });
}

export async function fetchTeachLearnMenuCategories(
  session: FeesSession,
  signal?: AbortSignal
): Promise<TeachLearnCategory[]> {
  const response = await fetch(MENU_CATEGORIES_PATH, {
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
    throw new Error('The teach/learn category navigation returned an unexpected response.');
  }

  if (!response.ok) {
    const message = (payload as Record<string, unknown>)?.message;
    throw new Error(
      typeof message === 'string' && message
        ? message
        : 'Unable to load the teach/learn category navigation.'
    );
  }

  return readCategories(payload);
}
