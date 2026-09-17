'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { AlertCircle, Loader2, type LucideIcon } from 'lucide-react';

import { mapApiLinkToRoute } from '@/app/data/routeMapper';
import { PageFrame, PageHeader } from '@/app/fees/_components/fees-shared';
import { getFeesSession, type FeesSession } from '@/app/fees/_lib/fees-api';
import {
  fetchModuleMenuCategories,
  type ModuleCategory,
  type ModuleCategoryItem,
} from '@/app/_lib/module-categories-api';
import { getModuleScreenRegistry } from '@/app/_lib/module-screen-registry';

/**
 * One category's page — the body behind a category tab in a module's level-3
 * bar, for any module.
 *
 * This replaces app/fees/_components/fees-category-page.tsx and
 * app/teach-learn/_components/teach-learn-category-page.tsx, which were the
 * same component twice with the module's name substituted.
 *
 * The category's menus are its tabs, and the selected tab's screen renders
 * underneath — the user stays on the category page instead of navigating away.
 *
 * The selection lives in `?tab=<id>` so it survives a refresh, can be linked,
 * and responds to the browser's back button.
 *
 * A tab opens its screen here, below the tab strip, and the first tab opens by
 * default so the category never lands on an empty frame. That is the whole
 * point of a category page: the user stays put and moves between screens with
 * one click.
 *
 * The screen is the existing page component itself, mounted from the module
 * screen registry, so nothing is reimplemented — the tab and the standalone
 * route render one module.
 *
 * A menu with no mountable page behind it cannot open here. Those tabs render
 * disabled, because there is nothing to show and nowhere to send the user: the
 * 54 seeded menus that point at legacy Laravel route names have no page in this
 * app at all, so navigating to one is a 404 rather than a fallback.
 *
 * Labels, links, permissions and status all come from the menu rows
 * themselves, served with rights and status already applied.
 *
 * PageFrame/PageHeader are generic layout primitives that happen to live under
 * app/fees/_components — reused here rather than duplicated.
 */

export type ModuleStaticScreen = {
  id: string;
  label: string;
  icon?: LucideIcon;
  render: () => ReactNode;
};

type Tab =
  | { kind: 'static'; id: string; label: string; icon?: LucideIcon; render: () => ReactNode }
  | { kind: 'menu'; id: string; label: string; route: string; embeddable: boolean };

type LoadState = 'loading' | 'ready' | 'error';

const TAB_PARAM = 'tab';

type MenuTab = Extract<Tab, { kind: 'menu' }>;

/**
 * Whether a mapped route actually goes anywhere in this app.
 *
 * mapApiLinkToRoute() has no "unknown" answer: given a Laravel route name it
 * does not recognise, it falls through to prepending a slash, so
 * 'add_cast.index' comes back as '/add_cast.index'. That is not a route — no
 * page exists for it and never did — and 54 of the 326 menus seeded into
 * category bars are in this state, mostly legacy screens never rebuilt in
 * Next.
 *
 * A dot in the final segment is what gives them away: no real route segment in
 * this app contains one, while every unmapped Laravel route name ends in
 * '.index' or a sibling action. Detecting them means a tab for a screen that
 * does not exist is shown disabled rather than navigating the user into a 404.
 */
function isResolvedRoute(route: string): boolean {
  if (!route || route === '#') return false;

  const lastSegment = route.split('?')[0].split('/').pop() ?? '';

  return !lastSegment.includes('.');
}

/** A tab that has a page of its own and no inline screen to render here. */
function opensInOwnPage(tab: Tab): tab is MenuTab {
  return tab.kind === 'menu' && !tab.embeddable && isResolvedRoute(tab.route);
}

function normalizePath(route: string | null | undefined) {
  const value = (route ?? '').trim().toLowerCase();
  if (!value) return '';
  const [path] = value.split('?');

  return path.replace(/\/+$/, '') || '/';
}

/**
 * The category this page is showing: the one whose key matches, or failing
 * that, the one whose configured route is this very route.
 *
 * WHY THE SECOND LOOKUP EXISTS. A category's key is a database value and its
 * label is written by hand, so the two can disagree with the route — Fees
 * ships a "Schedular" tab that navigates to /fees/scheduler. Matching the
 * route as well means the page shows that category's real label and
 * description instead of falling back to a bare heading over a spelling
 * difference nobody can see. The key is still tried first, so nothing about
 * the existing pages moves.
 */
function findCategory(
  categories: ModuleCategory[],
  moduleName: string,
  categoryKey: string,
  pathname: string | null
): ModuleCategory | null {
  const byKey = categories.find((entry) => entry.key === categoryKey);
  if (byKey) return byKey;

  const here = normalizePath(pathname);
  if (!here) return null;

  return (
    categories.find(
      (entry) => normalizePath(entry.route || `/modules/${moduleName}/${entry.key}`) === here
    ) ?? null
  );
}

export function ModuleCategoryPage({
  moduleName,
  categoryKey,
  staticScreens = [],
  staticScreensPlacement = 'before',
}: {
  moduleName: string;
  categoryKey: string;
  staticScreens?: ModuleStaticScreen[];
  /**
   * Where static tabs sit relative to the database menus.
   *
   * 'before' by default so a static scaffold for a category with no real
   * screens yet is what the user lands on. A category that already has
   * database menus needs 'after': the first renderable tab is the one the page
   * opens on, so a static tab placed first would quietly take over the
   * category's landing screen.
   */
  staticScreensPlacement?: 'before' | 'after';
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const requestedTab = searchParams?.get(TAB_PARAM) ?? null;

  const [session, setSession] = useState<FeesSession | null>(null);
  const [category, setCategory] = useState<ModuleCategory | null>(null);
  const [state, setState] = useState<LoadState>('loading');
  const [error, setError] = useState('');

  const screenRegistry = useMemo(() => getModuleScreenRegistry(moduleName), [moduleName]);

  // Session lives in browser storage, so it can only be read after mount.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSession(getFeesSession());
  }, []);

  useEffect(() => {
    if (!session) return;

    if (!session.subInstituteId || !session.userId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState('error');
      setError('No active session found. Sign in again to load this category.');
      return;
    }

    const controller = new AbortController();

    void (async () => {
      setState('loading');
      setError('');
      try {
        const categories = await fetchModuleMenuCategories(session, { moduleName }, controller.signal);
        if (controller.signal.aborted) return;

        setCategory(findCategory(categories, moduleName, categoryKey, pathname));
        setState('ready');
      } catch (caught) {
        if (controller.signal.aborted) return;
        setError(caught instanceof Error ? caught.message : 'Unable to load this category.');
        setState('error');
      }
    })();

    return () => controller.abort();
  }, [session, moduleName, categoryKey, pathname]);

  const tabs = useMemo<Tab[]>(() => {
    const staticTabs = staticScreens.map<Tab>((entry) => ({ kind: 'static', ...entry }));

    const menuTabs = (category?.items ?? []).map<Tab>((item: ModuleCategoryItem) => {
      const route = mapApiLinkToRoute(item.link);

      return {
        kind: 'menu',
        id: String(item.id),
        label: item.label,
        route,
        embeddable: screenRegistry.isEmbeddable(route),
      };
    });

    return staticScreensPlacement === 'after'
      ? [...menuTabs, ...staticTabs]
      : [...staticTabs, ...menuTabs];
  }, [staticScreens, staticScreensPlacement, category, screenRegistry]);

  /**
   * The open tab, which can only ever be one that actually renders something
   * here: a static screen or an embeddable menu screen.
   *
   * A tab that opens in its own page is deliberately never the active tab. It
   * used to be able to become one, and the result was a dead end — the body
   * showed "This screen opens in its own page rather than here" and the user
   * had to click a second time to get anywhere. A tab click should go where the
   * tab says it goes, so those now navigate on click (see selectTab) and there
   * is nothing left for them to be active for. That also applies to a `?tab=`
   * pointing at one, which is what the old links wrote into browser history.
   */
  const activeTab = useMemo<Tab | null>(() => {
    if (tabs.length === 0) return null;

    const renderable = tabs.filter((tab) => tab.kind === 'static' || tab.embeddable);

    if (requestedTab) {
      const requested = renderable.find((tab) => tab.id === requestedTab);
      if (requested) return requested;
    }

    return renderable[0] ?? null;
  }, [tabs, requestedTab]);

  const selectTab = useCallback(
    (tab: Tab) => {
      // Screens that live on their own page are opened, not selected. Anything
      // else is a real in-page tab and is recorded in the URL so the choice
      // survives a refresh and answers the back button.
      if (opensInOwnPage(tab)) {
        router.push(tab.route);
        return;
      }

      const params = new URLSearchParams(searchParams?.toString() ?? '');
      params.set(TAB_PARAM, tab.id);
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [router, searchParams]
  );

  const Outlet = screenRegistry.Outlet;

  return (
    <PageFrame>
      <PageHeader title={category?.label ?? ''} description={category?.description || undefined} />

      {state === 'loading' && tabs.length === 0 ? (
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-6 text-sm text-slate-500 shadow-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading screens…
        </div>
      ) : null}

      {state === 'error' ? (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error || 'Unable to load this category.'}</span>
        </div>
      ) : null}

      {state === 'ready' && !category && tabs.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-6 text-sm text-slate-500 shadow-sm">
          This category is not configured.
        </div>
      ) : null}

      {state === 'ready' && category && tabs.length === 0 ? (
        // Most categories start empty by design — no such screens exist for
        // this module yet, and none are invented.
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-8 text-center shadow-sm">
          <p className="text-sm font-medium text-slate-700">No screens available yet</p>
          <p className="mt-1 text-sm text-slate-500">
            {`There are no ${category.label} screens available for your account.`}
          </p>
        </div>
      ) : null}

      {tabs.length > 0 ? (
        <>
          <div className="flex flex-wrap items-center gap-5 overflow-x-auto border-b border-[#D9E3F1]">
            {tabs.map((tab) => {
              // A menu tab is clickable only if it leads somewhere: an inline
              // screen, or a route this app actually serves.
              const disabled = tab.kind === 'menu' && !tab.embeddable && !isResolvedRoute(tab.route);
              const isActive = activeTab?.id === tab.id;
              const Icon = tab.kind === 'static' ? tab.icon : undefined;

              return (
                <button
                  key={tab.id}
                  type="button"
                  disabled={disabled}
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => selectTab(tab)}
                  className={`-mb-px inline-flex shrink-0 items-center gap-2 border-b-2 pb-2 text-[14px] font-semibold transition disabled:cursor-not-allowed disabled:text-[#94A3B8] disabled:hover:text-[#94A3B8] ${
                    isActive
                      ? 'border-[#5846EA] text-[#5846EA]'
                      : 'border-transparent text-[#5F7087] hover:text-[#334155]'
                  }`}
                >
                  {Icon ? <Icon size={16} /> : null}
                  {tab.label}
                  {Icon && isActive ? <span className="h-1.5 w-1.5 rounded-full bg-[#5846EA]" /> : null}
                </button>
              );
            })}
          </div>

          {activeTab?.kind === 'static' ? (
            activeTab.render()
          ) : activeTab?.embeddable && Outlet ? (
            // The screen brings its own PageFrame, so it is mounted directly
            // rather than wrapped in another panel.
            <Outlet route={activeTab.route} />
          ) : (
            /*
             * No tab renders inline in this category — every screen it holds
             * opens on its own page. There is nothing to show below the tabs,
             * so this says only that, and the tabs above are the way out. It
             * must not name a screen or offer a button: a tab click already
             * goes straight to the screen, and anything here that looked like
             * a second step would be the dead end this replaced.
             */
            <div className="rounded-lg border border-slate-200 bg-white px-4 py-8 text-center shadow-sm">
              <p className="text-sm text-slate-500">Choose a screen above to open it.</p>
            </div>
          )}
        </>
      ) : null}
    </PageFrame>
  );
}
