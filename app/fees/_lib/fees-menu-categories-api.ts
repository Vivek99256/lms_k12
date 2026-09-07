'use client';

import { getApiBaseUrl, type FeesSession } from '@/app/fees/_lib/fees-api';

/**
 * Client for the Fees category navigation feed.
 *
 * Backend: next_lms_erp/app/Http/Controllers/api/FeesMenuCategoryApiController.php
 * Proxy:   app/api/fees/menu-categories/route.ts
 *
 * The seven categories are a Fees-page presentation layer over the module's
 * *existing* menus — they are not tblmenumaster rows and introduce no new menu
 * level. The backend decides membership and order and applies all three
 * visibility rules (status = 1, tenant provisioning, and the caller's menu
 * rights), so this module renders whatever comes back without re-filtering.
 */

export type FeesCategoryItem = {
  /** tblmenumaster.id of the existing menu — unchanged, never duplicated. */
  id: number;
  label: string;
  /** The existing menu's `link`, resolved to a route by mapApiLinkToRoute. */
  link: string;
};

export type FeesCategory = {
  key: string;
  label: string;
  description: string;
  /** The category's own page, e.g. /fees/master-setup. Configured per row. */
  route: string;
  items: FeesCategoryItem[];
};

const MENU_CATEGORIES_PATH = '/api/fees/menu-categories';

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

function readCategories(payload: unknown): FeesCategory[] {
  if (!payload || typeof payload !== 'object') return [];

  const root = payload as Record<string, unknown>;
  const data = (root.data ?? root) as Record<string, unknown>;
  const raw = data?.categories;
  if (!Array.isArray(raw)) return [];

  return raw.flatMap((entry): FeesCategory[] => {
    if (!entry || typeof entry !== 'object') return [];
    const record = entry as Record<string, unknown>;
    const key = typeof record.key === 'string' ? record.key : '';
    const label = typeof record.label === 'string' ? record.label : '';
    if (!key || !label) return [];

    const items = Array.isArray(record.items)
      ? record.items.flatMap((item): FeesCategoryItem[] => {
          if (!item || typeof item !== 'object') return [];
          const itemRecord = item as Record<string, unknown>;
          const itemLabel = typeof itemRecord.label === 'string' ? itemRecord.label : '';
          if (!itemLabel) return [];

          return [
            {
              id: Number(itemRecord.id) || 0,
              label: itemLabel,
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

export async function fetchFeesMenuCategories(
  session: FeesSession,
  signal?: AbortSignal
): Promise<FeesCategory[]> {
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
    throw new Error('The fees category navigation returned an unexpected response.');
  }

  if (!response.ok) {
    const message = (payload as Record<string, unknown>)?.message;
    throw new Error(
      typeof message === 'string' && message
        ? message
        : 'Unable to load the fees category navigation.'
    );
  }

  return readCategories(payload);
}
