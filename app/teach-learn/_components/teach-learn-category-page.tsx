'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertCircle, Loader2, type LucideIcon } from 'lucide-react';

import { mapApiLinkToRoute } from '@/app/data/routeMapper';
import { PageFrame, PageHeader } from '@/app/fees/_components/fees-shared';
import { getFeesSession, type FeesSession } from '@/app/fees/_lib/fees-api';
import {
  fetchTeachLearnMenuCategories,
  type TeachLearnCategory,
  type TeachLearnCategoryItem,
} from '@/app/teach-learn/_lib/teach-learn-menu-categories-api';
import {
  TeachLearnScreenOutlet,
  isEmbeddableTeachLearnScreen,
} from '@/app/teach-learn/_lib/teach-learn-screen-registry';

/**
 * One Teach/Learn category's page — the body behind a category tab in the
 * Teach/Learn level-3 bar. Mirrors app/fees/_components/fees-category-page.tsx.
 *
 * Each category has its own route (/teach-learn/master-setup, …) and renders
 * through this one component; the page files under
 * app/teach-learn/<category>/page.tsx differ only by `categoryKey`.
 *
 * The category's menus are its tabs, and the selected tab's screen renders
 * underneath — the user stays on the category page instead of navigating away.
 *
 * The selection lives in `?tab=<id>` so it survives a refresh, can be linked,
 * and responds to the browser's back button.
 *
 * A menu whose route is not yet embeddable remains inside this workspace and
 * shows the unavailable-screen state instead of navigating away.
 *
 * Labels, links, permissions and status for menu tabs all come from the menu
 * rows themselves, served by /api/teach-learn/menu-categories with rights and
 * status already applied.
 *
 * PageFrame/PageHeader are generic layout primitives that happen to live
 * under app/fees/_components — reused here rather than duplicated.
 */

export type TeachLearnStaticScreen = {
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

function menuTab(item: TeachLearnCategoryItem): Tab {
  const route = mapApiLinkToRoute(item.link);

  return {
    kind: 'menu',
    id: String(item.id),
    label: item.label,
    route,
    embeddable: isEmbeddableTeachLearnScreen(route),
  };
}

export function TeachLearnCategoryPage({
  categoryKey,
  staticScreens = [],
}: {
  categoryKey: string;
  staticScreens?: TeachLearnStaticScreen[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedTab = searchParams?.get(TAB_PARAM) ?? null;

  const [session, setSession] = useState<FeesSession | null>(null);
  const [category, setCategory] = useState<TeachLearnCategory | null>(null);
  const [state, setState] = useState<LoadState>('loading');
  const [error, setError] = useState('');

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
      setError('No active session found. Sign in again to load this Teach/Learn category.');
      return;
    }

    const controller = new AbortController();

    void (async () => {
      setState('loading');
      setError('');
      try {
        const categories = await fetchTeachLearnMenuCategories(session, controller.signal);
        if (controller.signal.aborted) return;

        setCategory(categories.find((entry) => entry.key === categoryKey) ?? null);
        setState('ready');
      } catch (caught) {
        if (controller.signal.aborted) return;
        setError(caught instanceof Error ? caught.message : 'Unable to load this Teach/Learn category.');
        setState('error');
      }
    })();

    return () => controller.abort();
  }, [session, categoryKey]);

  const tabs = useMemo<Tab[]>(() => {
    const staticTabs = staticScreens.map<Tab>((entry) => ({ kind: 'static', ...entry }));
    return [...staticTabs, ...(category?.items ?? []).map(menuTab)];
  }, [staticScreens, category]);

  /**
   * The open tab: the one named in the URL when it is still on this page,
   * otherwise the first tab that can render inline — so the page opens showing
   * real content rather than an empty frame.
   */
  const activeTab = useMemo<Tab | null>(() => {
    if (tabs.length === 0) return null;

    if (requestedTab) {
      const requested = tabs.find((tab) => tab.id === requestedTab);
      if (requested) return requested;
    }

    return tabs.find((tab) => tab.kind === 'static' || tab.embeddable) ?? null;
  }, [tabs, requestedTab]);

  const selectTab = useCallback(
    (tab: Tab) => {
      const params = new URLSearchParams(searchParams?.toString() ?? '');
      params.set(TAB_PARAM, tab.id);
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [router, searchParams]
  );

  return (
    <PageFrame>
      <PageHeader title={category?.label ?? 'Teach/Learn'} description={category?.description || undefined} />

      {state === 'loading' && tabs.length === 0 ? (
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-6 text-sm text-slate-500 shadow-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading screens…
        </div>
      ) : null}

      {state === 'error' ? (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error || 'Unable to load this Teach/Learn category.'}</span>
        </div>
      ) : null}

      {state === 'ready' && !category && tabs.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-6 text-sm text-slate-500 shadow-sm">
          This Teach/Learn category is not configured.
        </div>
      ) : null}

      {state === 'ready' && category && tabs.length === 0 ? (
        // Most categories start empty by design — no such Teach/Learn screens
        // exist yet, and none are invented.
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
              const disabled = tab.kind === 'menu' && (!tab.route || tab.route === '#');
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
          ) : activeTab?.embeddable ? (
            // The screen brings its own PageFrame, so it is mounted directly
            // rather than wrapped in another panel.
            <TeachLearnScreenOutlet route={activeTab.route} />
          ) : (
            <div className="rounded-lg border border-slate-200 bg-white px-4 py-8 text-center shadow-sm">
              <p className="text-sm font-medium text-slate-700">
                {activeTab ? activeTab.label : 'Select a screen'}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                {activeTab
                  ? 'This screen opens in its own page rather than here.'
                  : 'Choose a tab above to open it here.'}
              </p>
            </div>
          )}
        </>
      ) : null}
    </PageFrame>
  );
}
