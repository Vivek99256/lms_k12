'use client';

import { useEffect, useMemo, useState } from 'react';

import type { Level3Item } from '@/app/data/menuItems';
import { getFeesSession, type FeesSession } from '@/app/fees/_lib/fees-api';
import {
  fetchFeesMenuCategories,
  type FeesCategory,
} from '@/app/fees/_lib/fees-menu-categories-api';

/**
 * The Fees module's level-3 navigation: the seven Fees categories, and nothing
 * else.
 *
 *   FEES   [Onboarding] [Master Setup] [Transactional Data] [Reports] …
 *
 * Each category links to its own page (/fees/master-setup, …), and that page
 * renders the category's existing Fees menus as its own horizontal tab bar. The
 * level-3 bar therefore never changes shape — it stays the category list while
 * the user moves between category pages and the screens inside them.
 *
 * Two rules this hook exists to guarantee:
 *
 *  1. The old Fees level-3 menus (Fees Collect, Fees Cancel/Refund, …) must
 *     never appear in this bar, not even for one frame while the categories are
 *     loading. That is why it returns a placeholder rather than null the moment
 *     the context is Fees: returning null would let DashboardShell fall through
 *     to the default menu-driven resolution, which is exactly the old list.
 *     Loading -> categories, or loading -> error. Never old menus.
 *  2. Nothing global changes. DashboardShell consults this hook the same way it
 *     already consults newPalLevel3Items(), and it returns null for every
 *     non-Fees context, so other modules keep the untouched default behaviour
 *     and never trigger the fetch.
 *
 * The categories, their order, their page route and their membership are all
 * database rows (`fees_menu_categories` / `fees_menu_category_items`), served
 * with status and rights already applied — see
 * next_lms_erp/app/Http/Controllers/api/FeesMenuCategoryApiController.php.
 * Nothing about them is hardcoded here.
 */

export type FeesLevel3Nav = {
  parentLabel: string;
  items: Level3Item[];
};

type LoadState = 'idle' | 'loading' | 'ready' | 'error';

function normalizeLabel(label: string | null | undefined) {
  return (label ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function normalizePath(route: string | null | undefined) {
  const value = (route ?? '').trim().toLowerCase();
  if (!value) return '';
  const [path] = value.split('?');
  return path.replace(/\/+$/, '') || '/';
}

/**
 * True when the level-3 bar being rendered belongs to Fees.
 *
 * Either the user picked the "Fees" level-2 menu, or they are on a Fees route
 * (a refresh or a deep link, where no level-2 selection has been made yet).
 *
 * A route test alone is deliberately not enough to claim the bar: "Fee
 * documents" lives at /document-templates, which is also Document Templates'
 * own module, and hijacking that module's navigation is exactly the kind of
 * cross-module change this must not make.
 */
function isFeesContext(selectedLevel2Label: string | null | undefined, pathname: string) {
  if (normalizeLabel(selectedLevel2Label) === 'fees') return true;

  const path = normalizePath(pathname);
  return path === '/fees' || path.startsWith('/fees/');
}

/** A non-navigating tab: getNavigationRoute() returns null for href '#'. */
function inertItem(id: string, label: string): Level3Item {
  return { id, label, href: '#' };
}

export function useFeesLevel3Nav({
  selectedLevel2Label,
  pathname,
}: {
  selectedLevel2Label: string | null | undefined;
  pathname: string;
}): FeesLevel3Nav | null {
  const active = isFeesContext(selectedLevel2Label, pathname);

  const [session, setSession] = useState<FeesSession | null>(null);
  const [categories, setCategories] = useState<FeesCategory[]>([]);
  const [state, setState] = useState<LoadState>('idle');

  // Session lives in browser storage, so it can only be read after mount.
  useEffect(() => {
    if (!active || session) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSession(getFeesSession());
  }, [active, session]);

  useEffect(() => {
    if (!active) return;

    if (!session) {
      // Still reading storage — hold the bar in its loading state rather than
      // letting it resolve to anything else.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState('loading');
      return;
    }

    if (!session.subInstituteId || !session.userId) {
      setState('error');
      return;
    }

    const controller = new AbortController();

    void (async () => {
      setState('loading');
      try {
        const result = await fetchFeesMenuCategories(session, controller.signal);
        if (controller.signal.aborted) return;
        setCategories(result);
        setState('ready');
      } catch {
        if (controller.signal.aborted) return;
        setCategories([]);
        setState('error');
      }
    })();

    return () => controller.abort();
  }, [active, session]);

  return useMemo(() => {
    if (!active) return null;

    if (state === 'error') {
      return {
        parentLabel: 'Fees',
        items: [inertItem('fees-categories-error', 'Fees navigation unavailable')],
      };
    }

    // 'idle' and 'loading' both render the placeholder, and so does a ready
    // response that produced nothing — any of those falling through to null
    // would put the old level-3 menu list back on screen.
    if (state !== 'ready' || categories.length === 0) {
      return {
        parentLabel: 'Fees',
        items: [inertItem('fees-categories-loading', 'Loading…')],
      };
    }

    return {
      parentLabel: 'Fees',
      items: categories.map<Level3Item>((category) => ({
        id: `fees-category-${category.key}`,
        label: category.label,
        // Configured per category row, so the bar links wherever the data says.
        href: category.route || `/fees/${category.key}`,
      })),
    };
  }, [active, state, categories]);
}
