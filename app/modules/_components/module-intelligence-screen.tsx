'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState, type ComponentType } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';

import { mapApiLinkToRoute } from '@/app/data/routeMapper';
import { PageFrame, PageHeader } from '@/app/fees/_components/fees-shared';
import { getFeesSession, type FeesSession } from '@/app/fees/_lib/fees-api';
import {
  fetchModuleMenuCategories,
  type ModuleCategoriesResponse,
} from '@/app/modules/_lib/module-menu-categories-api';
import { ModuleIntelligence } from '@/components/intelligence/module';
import type { ModuleIntelligenceContract } from '@/components/intelligence/module/contract';
import {
  resolveIntelligenceModuleForMenu,
  type RegisteredIntelligenceModule,
} from '@/components/intelligence/module/registry';

/**
 * The canonical Intelligence screen: what `/modules/<slug>/intelligence`
 * renders, for every module.
 *
 * ── HOW A SLUG BECOMES A SCREEN ─────────────────────────────────────────────
 *
 * NOTHING IS REBUILT HERE, AND NOTHING IS PICKED BY NAME. The slug names a
 * module in `fees_menu_categories`; that row names the level-2 `tblmenumaster`
 * row the module IS; and the registry's own matcher — the very function the
 * sidebar uses to decide which modules get an Intelligence item — reads that
 * row's label, its legacy link and the module's own screen routes and says
 * which registered Intelligence it is. So the menu item and this route cannot
 * disagree about which screen a module gets: they ask the same question of the
 * same data.
 *
 * Two modules already had an Intelligence screen of their own before this route
 * existed, and those screens are MOUNTED, not reimplemented — see
 * BESPOKE_INTELLIGENCE_SCREENS below.
 *
 * ── WHAT IT REFUSES TO DO ───────────────────────────────────────────────────
 *
 * A module the registry does not recognise gets a stated absence, not an empty
 * dashboard: no contract means nothing has been reconciled for that module, and
 * rendering a frame of em dashes would look like a module with no data rather
 * than a module with no Intelligence.
 */

/**
 * Modules whose Intelligence screen predates the shared renderer.
 *
 * Fees is the one: the reference implementation, with its own charts, workspace
 * tabs and primitives. Pointing at its page module is what makes
 * `/modules/fees/intelligence` and `/fees/intelligence` one screen rather than
 * two that drift.
 *
 * TEACH/LEARN USED TO BE LISTED HERE AND IS NOT ANY MORE, which is half of why
 * it showed no Intelligence. Its entry pointed at
 * `/app/teach-learn/intelligence/page` — one of its ten category pages, holding
 * a tab bar over whatever level-3 menus a tenant had filed under "Intelligence"
 * and no intelligence of its own. Because this map is consulted BEFORE the
 * registry, that override also meant the matcher never ran for the module, so
 * adding a contract alone would not have reached the screen. It now resolves
 * through the registry like every other module.
 *
 * A component cannot come out of a database, which is why this map is code;
 * every other module resolves through the registry with nothing listed here.
 */
const BESPOKE_INTELLIGENCE_SCREENS: Record<string, ComponentType> = {
  fees: dynamic(() => import('@/app/fees/intelligence/page'), { ssr: false }),
};

type LoadState = 'loading' | 'ready' | 'error';

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-8 text-center shadow-sm">
      <p className="text-sm font-medium text-slate-700">{title}</p>
      <p className="mt-1 text-sm text-slate-500">{body}</p>
    </div>
  );
}

export function ModuleIntelligenceScreen({ moduleSlug }: { moduleSlug: string }) {
  const Bespoke = BESPOKE_INTELLIGENCE_SCREENS[moduleSlug];

  const [session, setSession] = useState<FeesSession | null>(null);
  const [response, setResponse] = useState<ModuleCategoriesResponse | null>(null);
  const [state, setState] = useState<LoadState>('loading');
  const [error, setError] = useState('');
  const [contract, setContract] = useState<ModuleIntelligenceContract | null>(null);

  // Session lives in browser storage, so it can only be read after mount.
  useEffect(() => {
    if (Bespoke) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSession(getFeesSession());
  }, [Bespoke]);

  useEffect(() => {
    if (Bespoke || !session) return;

    if (!session.subInstituteId || !session.userId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState('error');
      setError('No active session found. Sign in again to open this module.');
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
        setError(caught instanceof Error ? caught.message : 'Unable to identify this module.');
        setState('error');
      }
    })();

    return () => controller.abort();
  }, [Bespoke, session, moduleSlug]);

  /**
   * Which registered Intelligence this module is, decided by the registry's own
   * matcher over the module's menu label, its legacy link and every route its
   * screens resolve to — the same three inputs buildMenuTree() passes.
   */
  const registered = useMemo<RegisteredIntelligenceModule | undefined>(() => {
    if (!response?.module) return undefined;

    const hrefs = response.categories.flatMap((category) =>
      category.items.map((item) => mapApiLinkToRoute(item.link)),
    );

    return resolveIntelligenceModuleForMenu(response.module.label, response.module.link, hrefs);
  }, [response]);

  useEffect(() => {
    if (!registered?.loadContract) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setContract(null);
      return;
    }

    let cancelled = false;
    void (async () => {
      const loaded = await registered.loadContract!();
      if (!cancelled) setContract(loaded);
    })();

    return () => {
      cancelled = true;
    };
  }, [registered]);

  if (Bespoke) return <Bespoke />;

  if (state === 'loading') {
    return (
      <PageFrame>
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-6 text-sm text-slate-500 shadow-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading Intelligence…
        </div>
      </PageFrame>
    );
  }

  if (state === 'error') {
    return (
      <PageFrame>
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error || 'Unable to identify this module.'}</span>
        </div>
      </PageFrame>
    );
  }

  const moduleLabel = response?.module?.label || moduleSlug;

  if (!response?.module) {
    return (
      <PageFrame>
        <PageHeader title="Intelligence" />
        <Notice
          title="No such module"
          body={`No module is configured under "${moduleSlug}", so there is nothing to analyse.`}
        />
      </PageFrame>
    );
  }

  if (!registered) {
    return (
      <PageFrame>
        <PageHeader title={`${moduleLabel} — Intelligence`} />
        <Notice
          title="No Intelligence for this module yet"
          body={`${moduleLabel} has no Intelligence contract. Nothing is shown rather than an empty dashboard, because no figures for this module have been reconciled against the records they would come from.`}
        />
      </PageFrame>
    );
  }

  if (!contract) {
    return (
      <PageFrame>
        <PageHeader title={`${moduleLabel} — Intelligence`} />
        {registered.loadContract ? (
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-6 text-sm text-slate-500 shadow-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            {`Loading ${registered.label}…`}
          </div>
        ) : (
          <Notice
            title={`${registered.label} is not routed yet`}
            body={registered.note ?? 'This module is registered but has no contract to render.'}
          />
        )}
      </PageFrame>
    );
  }

  return <ModuleIntelligence contract={contract} />;
}
