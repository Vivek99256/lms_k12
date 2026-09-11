'use client';

import { useEffect, useMemo, useState } from 'react';

import type { Level3Item } from '@/app/data/menuItems';
import { getFeesSession, type FeesSession } from '@/app/fees/_lib/fees-api';
import {
  fetchTeachLearnMenuCategories,
  type TeachLearnCategory,
} from '@/app/teach-learn/_lib/teach-learn-menu-categories-api';

/**
 * The Teach/Learn module's level-3 navigation: its category tabs, and nothing
 * else — the same pattern as app/fees/_lib/use-fees-level3-nav.ts.
 *
 *   TEACH/LEARN   [Onboarding] [Process Builder] [Master Setup] [Operations] …
 *
 * Each category links to its own page (/teach-learn/master-setup, …), and
 * that page renders the category's existing Teach/Learn menus as its own
 * horizontal tab bar. The level-3 bar therefore never changes shape — it
 * stays the category list while the user moves between category pages and
 * the screens inside them.
 *
 * Two rules this hook exists to guarantee (mirroring Fees):
 *
 *  1. The plain Teach/Learn level-3 menu (whatever tblmenumaster currently
 *     returns as its direct children) must never appear in this bar, not even
 *     for one frame while the categories are loading. That is why it returns
 *     a placeholder rather than null the moment the context is Teach/Learn:
 *     returning null would let DashboardShell fall through to the default
 *     menu-driven resolution, which is exactly that flat list.
 *  2. Nothing global changes. DashboardShell consults this hook the same way
 *     it already consults useFeesLevel3Nav(), and it returns null for every
 *     non-Teach/Learn context, so other modules keep the untouched default
 *     behaviour and never trigger the fetch.
 *
 * The categories, their order, their page route and their membership are all
 * database rows (`fees_menu_categories` / `fees_menu_category_items`, scoped
 * to module_name = 'teach_learn'), served with status and rights already
 * applied — see
 * next_lms_erp/app/Http/Controllers/api/TeachLearnMenuCategoryApiController.php.
 * Nothing about them is hardcoded here.
 */

export type TeachLearnLevel3Nav = {
  parentLabel: string;
  items: Level3Item[];
  categoryCount: number;
  /** Teach/Learn has no LMS master-menu rights, so its sub-header must not show Master. */
  hideMaster?: boolean;
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
 * True when the level-3 bar being rendered belongs to Teach/Learn.
 *
 * Either the user picked the "Teach/Learn" level-2 menu, or they are on a
 * Teach/Learn route (a refresh or a deep link, where no level-2 selection has
 * been made yet).
 */
function isTeachLearnContext(selectedLevel2Label: string | null | undefined, pathname: string) {
  const path = normalizePath(pathname);
  if (path === '/fees' || path.startsWith('/fees/')) return false;
  if (normalizeLabel(selectedLevel2Label) === 'teach/learn') return true;

  return path === '/teach-learn' || path.startsWith('/teach-learn/');
}

/** A non-navigating tab: getNavigationRoute() returns null for href '#'. */
function inertItem(id: string, label: string): Level3Item {
  return { id, label, href: '#' };
}

export function useTeachLearnLevel3Nav({
  selectedLevel2Label,
  pathname,
}: {
  selectedLevel2Label: string | null | undefined;
  pathname: string;
}): TeachLearnLevel3Nav | null {
  const active = isTeachLearnContext(selectedLevel2Label, pathname);

  const [session, setSession] = useState<FeesSession | null>(null);
  const [categories, setCategories] = useState<TeachLearnCategory[]>([]);
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
        const result = await fetchTeachLearnMenuCategories(session, controller.signal);
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
        parentLabel: 'Teach/Learn',
        items: [inertItem('teach-learn-categories-error', 'Teach/Learn navigation unavailable')],
        categoryCount: 0,
        hideMaster: true,
      };
    }

    // 'idle' and 'loading' render the placeholder. A completed empty response
    // is a real result and must not look like a request that is still running.
    if (state !== 'ready') {
      return {
        parentLabel: 'Teach/Learn',
        items: [inertItem('teach-learn-categories-loading', 'Loading…')],
        categoryCount: 0,
        hideMaster: true,
      };
    }

    if (categories.length === 0) {
      return {
        parentLabel: 'Teach/Learn',
        items: [inertItem('teach-learn-categories-empty', 'No categories available')],
        categoryCount: 0,
        hideMaster: true,
      };
    }

    return {
      parentLabel: 'Teach/Learn',
      items: categories.map<Level3Item>((category) => ({
        id: `teach-learn-category-${category.key}`,
        label: category.label,
        // The dedicated Teach/Learn endpoint returns this module's route.
        href: category.route || `/teach-learn/${category.key}`,
      })),
      categoryCount: categories.length,
      hideMaster: true,
    };
  }, [active, state, categories]);
}
