'use client';

import { useEffect, useMemo, useState } from 'react';

import type { Level3Item } from '@/app/data/menuItems';
import {
  fetchModuleCategoryRegistry,
  fetchModuleMenuCategories,
  type ModuleCategory,
  type ModuleRegistryEntry,
} from '@/app/_lib/module-categories-api';
import { getFeesSession, type FeesSession } from '@/app/fees/_lib/fees-api';

/**
 * Any module's level-3 navigation: its category tabs, and nothing else.
 *
 *   FEES        [Onboarding] [Master Setup] [Operations] [Reports] …
 *   INVENTORY   [Onboarding] [Master Setup] [Operations] [Reports] …
 *
 * Each category links to its own page, and that page renders the category's
 * existing menus as its own horizontal tab bar. The level-3 bar therefore
 * never changes shape — it stays the category list while the user moves
 * between category pages and the screens inside them.
 *
 * This replaces app/fees/_lib/use-fees-level3-nav.ts and
 * app/teach-learn/_lib/use-teach-learn-level3-nav.ts, which were the same
 * ~190 lines twice over with the module's name substituted. Fees and
 * Teach/Learn now resolve through here like every other module; nothing about
 * their bars changes, because their categories were always database rows and
 * this reads the same rows.
 *
 * Two rules it exists to guarantee, carried over verbatim from the Fees hook:
 *
 *  1. A module that has a category bar must never show its *old* flat level-3
 *     menu list, not even for one frame while the categories load. That is why
 *     an active module returns a placeholder rather than null: returning null
 *     lets DashboardShell fall through to the default menu-driven resolution,
 *     which is exactly that old list.
 *  2. A module with no bar is untouched. The hook returns null for it, so it
 *     keeps the default behaviour and never triggers a fetch.
 *
 * Which modules have a bar, their categories, order, route and membership are
 * all database rows (`fees_menu_categories` / `fees_menu_category_items`),
 * served with status and rights already applied — see
 * next_lms_erp/app/Http/Controllers/api/ModuleMenuCategoryApiController.php.
 * Nothing about them is hardcoded here, including the module list itself.
 */

export type ModuleLevel3Nav = {
  parentLabel: string;
  items: Level3Item[];
  /**
   * Every module keeps its own Master Setup category inside the bar, so the
   * global blue Master button would be redundant beside it.
   */
  hideMaster?: boolean;
};

export type ModuleLevel3NavResult = {
  /** The bar for the current context, or null when this context has none. */
  navigation: ModuleLevel3Nav | null;
  /**
   * Category count per level-2 menu label, for the sidebar's "does this menu
   * have anything under it" indicator. Keyed by normalized label because that
   * is what the sidebar has to hand at render time.
   *
   * Two level-2 menus share the name "Task Management" and therefore share a
   * key. Both carry the same ten categories, so the number is right either
   * way; if that ever stops being true the indicator is the only thing
   * affected, never which bar is shown — that resolves by menu id.
   */
  level2Counts: Record<string, number>;
};

type LoadState = 'idle' | 'loading' | 'ready' | 'error';

/**
 * The registry is the same answer for every consumer and changes only when
 * someone seeds a module, so it is fetched once per session rather than once
 * per hook instance — the shell mounts this hook on every navigation.
 *
 * Keyed by tenant + user because the endpoint is session-scoped; a different
 * login must not read the previous one's answer. A failure clears the cache so
 * the next mount retries instead of caching the error forever.
 */
let registryCacheKey = '';
let registryCache: Promise<ModuleRegistryEntry[]> | null = null;

function loadRegistry(session: FeesSession): Promise<ModuleRegistryEntry[]> {
  const key = `${session.subInstituteId}:${session.userId}`;

  if (registryCacheKey !== key || !registryCache) {
    registryCacheKey = key;
    registryCache = fetchModuleCategoryRegistry(session).catch((error: unknown) => {
      if (registryCacheKey === key) registryCache = null;
      throw error;
    });
  }

  return registryCache;
}

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
 * Which module's bar is being drawn, or null when the current context has no
 * category bar at all.
 *
 * The level-2 menu id is the first and best answer: it is what the user
 * actually selected, and it is unambiguous. Menu *labels* are not — two active
 * level-2 menus are both named "Task Management" — which is why the id is
 * matched rather than the label the two old hooks compared against.
 *
 * The route fallback covers a refresh or a deep link, where no level-2
 * selection has been made yet. An exact category-route match wins over a
 * prefix match on the module's base, so Teach/Learn's /onboarding/lms and
 * /general/add_process resolve to Teach/Learn while a longer, more specific
 * base still beats a shorter one elsewhere.
 */
function resolveModule(
  registry: ModuleRegistryEntry[],
  selectedLevel2Id: number | string | null | undefined,
  pathname: string
): ModuleRegistryEntry | null {
  const level2Id = Number(selectedLevel2Id);

  if (Number.isFinite(level2Id) && level2Id > 0) {
    const byId = registry.find((entry) => entry.level2MenuId === level2Id);
    if (byId) return byId;
  }

  const path = normalizePath(pathname);
  if (!path || path === '/') return null;

  const exact = registry.find((entry) => entry.routes.some((route) => normalizePath(route) === path));
  if (exact) return exact;

  let best: ModuleRegistryEntry | null = null;
  let bestLength = 0;

  for (const entry of registry) {
    const base = normalizePath(entry.baseRoute);
    if (!base || base === '/') continue;
    if (path !== base && !path.startsWith(`${base}/`)) continue;
    if (base.length <= bestLength) continue;

    best = entry;
    bestLength = base.length;
  }

  return best;
}

/** A non-navigating tab: getNavigationRoute() returns null for href '#'. */
function inertItem(id: string, label: string): Level3Item {
  return { id, label, href: '#' };
}

export function useModuleLevel3Nav({
  selectedLevel2Id,
  pathname,
}: {
  selectedLevel2Id: number | string | null | undefined;
  pathname: string;
}): ModuleLevel3NavResult {
  const [session, setSession] = useState<FeesSession | null>(null);
  const [registry, setRegistry] = useState<ModuleRegistryEntry[]>([]);
  const [registryState, setRegistryState] = useState<LoadState>('idle');
  const [categories, setCategories] = useState<ModuleCategory[]>([]);
  const [state, setState] = useState<LoadState>('idle');

  // Session lives in browser storage, so it can only be read after mount.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSession(getFeesSession());
  }, []);

  useEffect(() => {
    if (!session?.subInstituteId || !session.userId) return;

    // No synchronous 'loading' set here: `activeModule` only resolves once the
    // state is 'ready', so 'idle' and 'loading' are indistinguishable to every
    // consumer, and setting it in the effect body would only cost a render.
    let cancelled = false;

    void loadRegistry(session)
      .then((entries) => {
        if (cancelled) return;
        setRegistry(entries);
        setRegistryState('ready');
      })
      .catch(() => {
        if (cancelled) return;
        setRegistry([]);
        setRegistryState('error');
      });

    return () => {
      cancelled = true;
    };
  }, [session]);

  const activeModule = useMemo(
    () => (registryState === 'ready' ? resolveModule(registry, selectedLevel2Id, pathname) : null),
    [registry, registryState, selectedLevel2Id, pathname]
  );

  useEffect(() => {
    if (!session || !activeModule) return;

    const controller = new AbortController();

    void (async () => {
      setState('loading');
      try {
        const result = await fetchModuleMenuCategories(
          session,
          { moduleName: activeModule.moduleName, level2MenuId: activeModule.level2MenuId },
          controller.signal
        );
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
  }, [session, activeModule]);

  const level2Counts = useMemo(() => {
    const counts: Record<string, number> = {};

    for (const entry of registry) {
      const key = normalizeLabel(entry.label);
      if (!key || entry.categoryCount <= 0) continue;
      counts[key] = entry.categoryCount;
    }

    return counts;
  }, [registry]);

  const navigation = useMemo<ModuleLevel3Nav | null>(() => {
    // The registry has not answered yet, so whether this context even has a
    // bar is still unknown. Returning null here is correct rather than
    // cautious: a module with no bar must keep its normal level-3 menu, and
    // holding every module in a placeholder until the registry lands would
    // blank the level-3 bar app-wide on every cold load.
    if (!activeModule) return null;

    const parentLabel = activeModule.label || activeModule.moduleName;

    if (state === 'error') {
      return {
        parentLabel,
        items: [inertItem(`${activeModule.moduleName}-categories-error`, 'Navigation unavailable')],
        hideMaster: true,
      };
    }

    // 'idle' and 'loading' both render the placeholder, and so does a ready
    // response that produced nothing — any of those falling through to null
    // would put the module's old level-3 menu list back on screen.
    if (state !== 'ready' || categories.length === 0) {
      return {
        parentLabel,
        items: [inertItem(`${activeModule.moduleName}-categories-loading`, 'Loading…')],
        hideMaster: true,
      };
    }

    return {
      parentLabel,
      items: categories.map<Level3Item>((category) => ({
        id: `${activeModule.moduleName}-category-${category.key}`,
        label: category.label,
        // `route` is configured per row and is already correct for every
        // seeded module, including the two that predate the /modules/<slug>
        // convention. The fallback only covers a row seeded without one.
        href: category.route || `/modules/${activeModule.moduleName}/${category.key}`,
      })),
      hideMaster: true,
    };
  }, [activeModule, state, categories]);

  return useMemo(() => ({ navigation, level2Counts }), [navigation, level2Counts]);
}
