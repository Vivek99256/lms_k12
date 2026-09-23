'use client';

import { useEffect, useMemo, useState } from 'react';

import type { Level3Item } from '@/app/data/menuItems';
import { getFeesSession, type FeesSession } from '@/app/fees/_lib/fees-api';
import {
  fetchModuleMenuCategories,
  type ModuleCategoriesResponse,
} from '@/app/modules/_lib/module-menu-categories-api';
import { moduleCategoryItems, moduleSlugFromPathname } from '@/app/modules/_lib/module-routes';

/**
 * Every module's level-3 navigation: its own categories, in its own order.
 *
 *   STUDENT  [Onboarding] [Process Builder] [Master Setup] [Operations]
 *            [Reports] [Intelligence] [Help Guide/Support] [Communication] [AI Stack]
 *
 * ── WHAT THIS RESTORES ──────────────────────────────────────────────────────
 *
 * `fees_menu_categories` already carried this bar for 64 modules, each row
 * naming its own `/modules/<slug>/<category>` route and the level-2 menu row
 * the module IS. Only Fees and Teach/Learn could read it, because those two are
 * the only modules with a controller and a hook of their own — so every other
 * module showed the flat level-3 menu list instead of its categories. This hook
 * is the general case of the two that already exist.
 *
 * ── WHAT IT WILL NOT DO ─────────────────────────────────────────────────────
 *
 * It returns null, and the module keeps the navigation it has today, when:
 *
 *  - Fees or Teach/Learn already claimed the bar (`disabled`). Those modules
 *    have their own hooks, their own category pages and their own routes, and
 *    are deliberately untouched.
 *  - The module has no category rows. An unconfigured module is not a broken
 *    one; it keeps its flat menu.
 *  - The categories have not arrived yet, or the request failed. Unlike the
 *    Fees hook — which holds a placeholder because its old menus must never
 *    reappear — a module here has nothing to hide: showing its existing level-3
 *    list until the categories land means a slow or unavailable nav feed costs
 *    a category bar, never a working module.
 *
 * Responses are cached per module for the life of the page, so moving between
 * a module's screens does not refetch its bar and does not flicker.
 */

export type ModuleLevel3Nav = {
  parentLabel: string;
  items: Level3Item[];
};

/** Keyed by module slug, or by `#<level2 menu id>` when that is all the caller knows. */
const cache = new Map<string, ModuleCategoriesResponse>();

export function useModuleLevel3Nav({
  selectedLevel2Id,
  selectedLevel2Label,
  pathname,
  disabled = false,
}: {
  /** `tblmenumaster.id` of the level-2 menu the shell has selected, if any. */
  selectedLevel2Id?: number | string;
  selectedLevel2Label?: string | null;
  pathname: string;
  /** True when another module's own hook already owns the bar. */
  disabled?: boolean;
}): ModuleLevel3Nav | null {
  const slugFromPath = moduleSlugFromPathname(pathname);
  const level2Id = Number(selectedLevel2Id) || 0;

  // The URL wins: a person standing on /modules/student/reports is in Student,
  // whatever the shell last had selected.
  const target = useMemo(
    () => (slugFromPath ? { moduleName: slugFromPath } : level2Id ? { level2MenuId: level2Id } : null),
    [slugFromPath, level2Id],
  );
  const cacheKey = slugFromPath || (level2Id ? `#${level2Id}` : '');
  const active = !disabled && Boolean(target);

  const [session, setSession] = useState<FeesSession | null>(null);
  const [response, setResponse] = useState<ModuleCategoriesResponse | null>(
    () => (cacheKey ? cache.get(cacheKey) ?? null : null),
  );

  // Session lives in browser storage, so it can only be read after mount.
  useEffect(() => {
    if (!active || session) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSession(getFeesSession());
  }, [active, session]);

  useEffect(() => {
    if (!active || !target || !cacheKey) return;

    const cached = cache.get(cacheKey);
    if (cached) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResponse(cached);
      return;
    }

    setResponse(null);
    if (!session?.subInstituteId || !session.userId) return;

    const controller = new AbortController();

    void (async () => {
      try {
        const result = await fetchModuleMenuCategories(session, target, controller.signal);
        if (controller.signal.aborted) return;
        cache.set(cacheKey, result);
        // A module resolved by menu id is also cached under its own slug, so
        // the same bar is reused when the user then walks into /modules/<slug>.
        if (result.module?.moduleName) cache.set(result.module.moduleName, result);
        setResponse(result);
      } catch {
        // Left unset on purpose: the module keeps its existing navigation.
        if (controller.signal.aborted) return;
      }
    })();

    return () => controller.abort();
  }, [active, target, cacheKey, session]);

  return useMemo(() => {
    if (!active || !response?.module) return null;

    const items: Level3Item[] = moduleCategoryItems(response);
    if (items.length === 0) return null;

    return {
      parentLabel: response.module.label || selectedLevel2Label || response.module.moduleName,
      items,
    };
  }, [active, response, selectedLevel2Label]);
}
