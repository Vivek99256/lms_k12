'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Loader2 } from 'lucide-react';

import { mapApiLinkToRoute } from '@/app/data/routeMapper';
import { PageFrame, PageHeader } from '@/app/fees/_components/fees-shared';
import { getFeesSession, type FeesSession } from '@/app/fees/_lib/fees-api';
import {
  fetchModuleMenuCategories,
  type ModuleCategoriesResponse,
  type ModuleCategory,
} from '@/app/modules/_lib/module-menu-categories-api';

/**
 * One module category's page — the body behind a category tab in the module's
 * level-3 bar. The general case of app/fees/_components/fees-category-page.tsx
 * and its Teach/Learn twin.
 *
 * ── WHY THE MENUS ARE LINKS HERE AND TABS THERE ─────────────────────────────
 *
 * Fees and Teach/Learn each keep a registry naming which of their screens can
 * be mounted inside a category page, so a tab there renders the screen inline.
 * No such registry exists for the other 62 modules, and inventing one would
 * mean deciding, screen by screen, which of several hundred existing pages is
 * safe to mount under a different path — every wrong guess being a screen that
 * stops working.
 *
 * So a menu here opens at its own existing route, exactly as it does from the
 * sidebar today. The category page groups the module's screens and names where
 * each one lives; it never becomes the only way to reach one. Nothing that
 * worked before this page existed works differently now.
 *
 * `staticScreens` are the exception — content this page owns, rendered inline.
 * `/modules/<slug>/intelligence` uses it for the module's Intelligence screen.
 *
 * Labels, links, membership, order and rights all come from the menu rows
 * themselves, served by /api/modules/menu-categories with status, tenant
 * provisioning and menu rights already applied.
 */

export type ModuleStaticScreen = {
  id: string;
  label: string;
  render: () => ReactNode;
};

type LoadState = 'loading' | 'ready' | 'error';

export function ModuleCategoryPage({
  moduleSlug,
  categoryKey,
  staticScreens = [],
  /** Rendered instead of the "no screens" notice when the category has none. */
  emptyFallback,
}: {
  moduleSlug: string;
  categoryKey: string;
  staticScreens?: ModuleStaticScreen[];
  emptyFallback?: ReactNode;
}) {
  const router = useRouter();

  const [session, setSession] = useState<FeesSession | null>(null);
  const [response, setResponse] = useState<ModuleCategoriesResponse | null>(null);
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
      setError('No active session found. Sign in again to load this module.');
      return;
    }

    const controller = new AbortController();

    void (async () => {
      setState('loading');
      setError('');
      try {
        const result = await fetchModuleMenuCategories(session, { moduleName: moduleSlug }, controller.signal);
        if (controller.signal.aborted) return;
        setResponse(result);
        setState('ready');
      } catch (caught) {
        if (controller.signal.aborted) return;
        setError(caught instanceof Error ? caught.message : 'Unable to load this module.');
        setState('error');
      }
    })();

    return () => controller.abort();
  }, [session, moduleSlug]);

  const category = useMemo<ModuleCategory | null>(
    () => response?.categories.find((entry) => entry.key === categoryKey) ?? null,
    [response, categoryKey],
  );

  const moduleLabel = response?.module?.label || moduleSlug;
  const title = category ? `${moduleLabel} — ${category.label}` : moduleLabel;

  const screens = useMemo(
    () =>
      (category?.items ?? []).map((item) => ({
        id: String(item.id),
        label: item.label,
        route: mapApiLinkToRoute(item.link),
      })),
    [category],
  );

  return (
    <PageFrame>
      <PageHeader title={title} description={category?.description || undefined} />

      {state === 'loading' ? (
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-6 text-sm text-slate-500 shadow-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading screens…
        </div>
      ) : null}

      {state === 'error' ? (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error || 'Unable to load this module.'}</span>
        </div>
      ) : null}

      {state === 'ready' && !response?.module ? (
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-6 text-sm text-slate-500 shadow-sm">
          {`No module is configured under "${moduleSlug}".`}
        </div>
      ) : null}

      {state === 'ready' && response?.module && !category ? (
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-6 text-sm text-slate-500 shadow-sm">
          {`${moduleLabel} has no "${categoryKey}" category configured.`}
        </div>
      ) : null}

      {staticScreens.length > 0 ? (
        <div className="space-y-4">
          {staticScreens.map((screen) => (
            <div key={screen.id}>{screen.render()}</div>
          ))}
        </div>
      ) : null}

      {screens.length > 0 ? (
        <section className="rounded-lg border border-slate-200 bg-white px-4 py-4 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            {category?.label ?? 'Screens'}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-5 border-b border-[#D9E3F1]">
            {screens.map((screen) => {
              const disabled = !screen.route || screen.route === '#';

              return (
                <button
                  key={screen.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => router.push(screen.route)}
                  className="-mb-px inline-flex shrink-0 items-center gap-2 border-b-2 border-transparent pb-2 text-[14px] font-semibold text-[#5F7087] transition hover:text-[#334155] disabled:cursor-not-allowed disabled:text-[#94A3B8] disabled:hover:text-[#94A3B8]"
                >
                  {screen.label}
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-sm text-slate-500">Choose a screen to open it.</p>
        </section>
      ) : null}

      {state === 'ready' && category && screens.length === 0 && staticScreens.length === 0
        ? emptyFallback ?? (
            <div className="rounded-lg border border-slate-200 bg-white px-4 py-8 text-center shadow-sm">
              <p className="text-sm font-medium text-slate-700">No screens available yet</p>
              <p className="mt-1 text-sm text-slate-500">
                {`There are no ${category.label} screens available for your account in ${moduleLabel}.`}
              </p>
            </div>
          )
        : null}
    </PageFrame>
  );
}
