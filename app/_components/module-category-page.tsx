'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { AlertCircle, Brain, CalendarClock, GitBranch, Loader2, ScrollText, type LucideIcon } from 'lucide-react';

import Link from 'next/link';

import { mapApiLinkToRoute } from '@/app/data/routeMapper';
import { ModuleAuditTrail } from '@/app/_components/module-audit-trail';
import { ModuleIntelligence } from '@/app/_components/module-intelligence';
import {
  intelligenceEntryFor,
  ModuleIntelligenceContractScreen,
} from '@/app/_components/module-intelligence-contract';
import { AddProcessPage } from '@/app/general/add_process/AddProcessPage';
import { ModuleJourney } from '@/app/general/onboarding/_components/ModuleJourney';
import { SchedulerConsole } from '@/app/platform-services/scheduler/_components/SchedulerConsole';
import { WorkflowConsole } from '@/app/platform-services/workflow/_components/WorkflowConsole';
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

/**
 * The one category that is a screen rather than a group of menus.
 *
 * Every module's bar carries an Onboarding category and every one of them is
 * empty, because onboarding is not a set of menus — it is the journey that
 * already lives in the onboarding module. Fees solved this by hand with a page
 * that renders one hardcoded journey key; this is the general form of that, so
 * Onboarding opens the same screen in every module's bar and which journey it
 * shows is the category row's `onboarding_module_key` rather than a route
 * somebody has to write.
 */
const ONBOARDING_CATEGORY_KEY = 'onboarding';

/** Where Onboarding sends a bar that owns no single journey. */
const ONBOARDING_INDEX_ROUTE = '/general/onboarding';

/**
 * Process Builder: the SOP converter, which is one screen for every module.
 *
 * Converting an SOP into a Process, Workflow and Tasks is the same act
 * everywhere, and the screen already exists at /general/add_process. Fees
 * reached it by rendering the component with its own module named; every bar
 * now does, because no bar has a single real menu in this category — all 64 are
 * empty — so there is nothing for a tab strip to hold.
 */
const PROCESS_BUILDER_CATEGORY_KEY = 'process-builder';

/**
 * The converter's module keys are its own (`lib/process/module-registry.ts`),
 * not the platform registry's, and only two modules are registered. The one
 * spelling that differs is mapped here; anything the converter does not know
 * falls back to its first registered module, which is what
 * /general/add_process has always opened on.
 */
const SOP_MODULE_ALIASES: Record<string, string> = { lms: 'lms-pal' };

/**
 * The third console-like category: the module's own slice of the access log.
 *
 * Unlike Workflow and Schedular it has no central screen to pin — it is the
 * User Log report narrowed to this module — so what the row carries is the set
 * of log prefixes the module's screens write rather than a registry key.
 */
const AUDIT_CATEGORY_KEY = 'audit-trail';

/** Where a bar whose screens never reach the access log is sent instead. */
const USER_LOG_ROUTE = '/user_log';

/**
 * Intelligence: the Brain's loop, narrowed to this module.
 *
 * The tenant-wide loop is the Enterprise Brain's screen and answers its
 * question; a module's tab shows only the signals attributed to that module's
 * rules. Which module is the row's `platform_module_key` — the same key the
 * Workflow and Schedular consoles pin to, so one module means one thing
 * throughout.
 *
 * A tab rather than a page takeover: eight bars carry a real Intelligence menu
 * ("Fees Prediction"), and those follow this one.
 */
const INTELLIGENCE_CATEGORY_KEY = 'intelligence';

/**
 * The categories that are a console rather than a group of menus.
 *
 * Approvals and scheduled tasks are both configured centrally — one registry of
 * modules and components, one set of endpoints — and these categories are the
 * way into that from inside a module. Fees did each of them by hand, with the
 * module key written into a Fees-only file; every module's bar now carries both
 * categories, and which module the console pins to is the row's
 * `platform_module_key`, one mapping shared by the two.
 *
 * They are supplied as a tab rather than replacing the page, the way Onboarding
 * does, because these categories can also hold real menus from the tree — the
 * console is the first tab and those follow it.
 *
 * `schedular` is the category key as the menu data spells it. The Fees route is
 * /fees/scheduler, which findCategory resolves by route; every other module's
 * URL segment is the key itself.
 */
const PLATFORM_CONSOLES: Record<
  string,
  {
    /** The tab, named for what it lists rather than for the service. */
    id: string;
    label: string;
    icon: LucideIcon;
    title: string;
    description: string;
    /** The central screen, for a bar with no module in the registry. */
    route: string;
    routeLabel: string;
    /** What that bar is told, in its own terms. */
    emptyTitle: string;
    emptyBody: string;
    render: (moduleKey: string, title: string, description: string) => ReactNode;
  }
> = {
  workflow: {
    id: 'workflow-approvals',
    label: 'Approvals',
    icon: GitBranch,
    title: 'Approval workflows',
    description:
      'Every action in this module that can pause for a sign-off, and the approval chain each one runs through at this institute.',
    route: '/platform-services/workflow',
    routeLabel: 'Open Platform services → Workflow',
    emptyTitle: 'No approval points for this menu',
    emptyBody:
      'Nothing in this module declares an action that pauses for a sign-off, so there is no chain to configure here.',
    render: (moduleKey, title, description) => (
      <WorkflowConsole embedded module={moduleKey} title={title} description={description} />
    ),
  },
  schedular: {
    id: 'scheduler-tasks',
    label: 'Scheduled tasks',
    icon: CalendarClock,
    title: 'Scheduled tasks',
    description:
      'Recurring activity in this module: when each task runs, whether it is switched on, and when it last did.',
    route: '/platform-services/scheduler',
    routeLabel: 'Open Platform services → Scheduler',
    emptyTitle: 'No scheduled tasks for this menu',
    emptyBody:
      'Nothing in this module declares a task that runs on a schedule, so there is nothing to time here.',
    render: (moduleKey, title, description) => (
      <SchedulerConsole embedded module={moduleKey} title={title} description={description} />
    ),
  },
};

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
 * A module's name for display, from its slug.
 *
 * The bar's real label lives on the level-2 menu, which the category feed does
 * not carry — it answers "what are this module's categories", not "what is this
 * module called". Deriving it is enough for the few places that name the module
 * in a sentence, and it is predictable: 'front-desk' reads "Front Desk",
 * 'teach_learn' reads "Teach Learn". A trailing id, which disambiguates two
 * bars that share a name ('task-management-551'), is dropped rather than read
 * aloud.
 */
function moduleLabel(moduleName: string): string {
  return moduleName
    .split(/[-_]/)
    .filter((part) => part !== '' && !/^\d+$/.test(part))
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
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
  onboardingModuleKey = '',
  platformModuleKey = '',
  auditModuleKeys,
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
  /**
   * The onboarding journey to fall back on when the category row carries no
   * `onboarding_module_key`.
   *
   * Only the two routes that predate that column pass it — Fees and
   * Teach/Learn each shipped a page hardcoding their journey — so an
   * installation that has not yet run the mapping migration keeps the screen it
   * has today instead of losing it. Every other module reads the key from the
   * row and passes nothing here.
   */
  onboardingModuleKey?: string;
  /**
   * The platform-services module to pin the Workflow or Schedular console to
   * when the category row carries no `platform_module_key`. Passed only by the
   * two Fees routes that hardcoded 'fees' before the column existed; every
   * other module reads it from the row.
   */
  platformModuleKey?: string;
  /**
   * The access-log prefixes to narrow the Audit Trail to when the category row
   * carries none. Passed only by /fees/audit-trail, which hardcoded 'fees'
   * before the column existed; every other module reads them from the row.
   */
  auditModuleKeys?: string[];
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

  /**
   * The console tab for a Workflow or Schedular category, built here so every
   * module's copy of those categories shows the same screen without a file per
   * module.
   *
   * With no module key the console is not shown pinned to something else and
   * not shown unpinned either — an unpinned console inside a module bar lists
   * every other module's points or tasks, which is noise, and the module rail
   * that would narrow it is deliberately not drawn in embedded mode. The tab
   * says what is true and offers the central screen.
   */
  const consoleScreens = useMemo<ModuleStaticScreen[]>(() => {
    const spec = PLATFORM_CONSOLES[categoryKey] ?? PLATFORM_CONSOLES[category?.key ?? ''];

    if (!spec) return [];

    const pinned = category?.platformModuleKey || platformModuleKey;

    return [
      {
        id: spec.id,
        label: spec.label,
        icon: spec.icon,
        render: () =>
          pinned ? (
            spec.render(pinned, spec.title, spec.description)
          ) : (
            <div className="rounded-lg border border-slate-200 bg-white px-4 py-8 text-center shadow-sm">
              <p className="text-sm font-medium text-slate-700">{spec.emptyTitle}</p>
              <p className="mt-1 text-sm text-slate-500">{spec.emptyBody}</p>
              <Link
                href={spec.route}
                className="mt-3 inline-flex items-center text-sm font-semibold text-[#5846EA] hover:underline"
              >
                {spec.routeLabel}
              </Link>
            </div>
          ),
      },
    ];
  }, [categoryKey, category, platformModuleKey]);

  /**
   * The Audit Trail tab, for any module.
   *
   * With no prefixes the trail is not rendered empty: an empty table reads as
   * "nobody used this module", when the truth is that this module's screens
   * live only in this app and never pass through the Laravel middleware that
   * writes the log. The tab says that and offers the full User Log report.
   */
  const auditScreens = useMemo<ModuleStaticScreen[]>(() => {
    if (categoryKey !== AUDIT_CATEGORY_KEY && category?.key !== AUDIT_CATEGORY_KEY) {
      return [];
    }

    const keys = category?.auditModuleKeys?.length ? category.auditModuleKeys : auditModuleKeys ?? [];
    // The module's own name, which the level-2 menu supplies through the
    // category's label only for the bar itself; 'Audit Trail' is the category,
    // so the module name comes from the page's own module slug when the row
    // cannot name it.
    const label = moduleLabel(moduleName);

    return [
      {
        id: 'audit-trail',
        label: 'Activity',
        icon: ScrollText,
        render: () =>
          keys.length > 0 ? (
            <ModuleAuditTrail moduleKeys={keys} label={label} />
          ) : (
            <div className="rounded-lg border border-slate-200 bg-white px-4 py-8 text-center shadow-sm">
              <p className="text-sm font-medium text-slate-700">No activity is logged for this menu</p>
              <p className="mt-1 text-sm text-slate-500">
                This module&apos;s screens do not pass through the access log, so there is nothing
                to show here rather than nothing having happened.
              </p>
              <Link
                href={USER_LOG_ROUTE}
                className="mt-3 inline-flex items-center text-sm font-semibold text-[#5846EA] hover:underline"
              >
                Open the User Log report
              </Link>
            </div>
          ),
      },
    ];
  }, [categoryKey, category, auditModuleKeys, moduleName]);

  /**
   * The Intelligence tab, for any module that has not brought its own.
   *
   * Fees passes its native workspace through `staticScreens`, and that view is
   * a superset of this one — fee coverage, the decision loop and the fee
   * records behind it — so a module that supplies its own screens is left
   * alone rather than given two Intelligence tabs to choose between.
   */
  const intelligenceScreens = useMemo<ModuleStaticScreen[]>(() => {
    const isIntelligence =
      categoryKey === INTELLIGENCE_CATEGORY_KEY || category?.key === INTELLIGENCE_CATEGORY_KEY;

    if (!isIntelligence || staticScreens.length > 0) return [];

    const pinned = category?.platformModuleKey || platformModuleKey;
    const label = moduleLabel(moduleName);

    /*
     * THE MODULE'S OWN CONTRACT WINS OVER THE GENERIC LOOP VIEW.
     *
     * `ModuleIntelligence` below shows the Brain's signals filtered to this
     * module — the same shape every module gets. A module that has a registered
     * contract has something strictly richer: its own coverage, position,
     * breakdowns, findings, Module Integration and Cross-Module Workflow, read
     * from its own tables. Preferring the contract is what makes those twenty-one
     * screens reachable from the bar at all; without it they exist and nothing
     * opens them.
     *
     * The level-3 routes are passed so the matcher can recognise a module by its
     * route family when the label alone is ambiguous.
     */
    const level3Hrefs = (category?.items ?? []).map((item: ModuleCategoryItem) =>
      mapApiLinkToRoute(item.link),
    );
    const contractEntry = intelligenceEntryFor(moduleName, label, level3Hrefs);

    return [
      {
        id: 'module-intelligence',
        label: 'Intelligence',
        icon: Brain,
        render: () =>
          contractEntry?.loadContract ? (
            <ModuleIntelligenceContractScreen
              moduleSlug={moduleName}
              label={label}
              hrefs={level3Hrefs}
            />
          ) : pinned ? (
            <ModuleIntelligence moduleKey={pinned} fallbackLabel={label} />
          ) : (
            <div className="rounded-lg border border-slate-200 bg-white px-4 py-8 text-center shadow-sm">
              <p className="text-sm font-medium text-slate-700">
                The Brain does not watch this menu
              </p>
              <p className="mt-1 text-sm text-slate-500">
                This bar has no module in the platform registry, so no intelligence rule is
                attributed to it — which is not the same as it having no problems.
              </p>
              <Link
                href="/enterprise-brain/intelligence-loop"
                className="mt-3 inline-flex items-center text-sm font-semibold text-[#5846EA] hover:underline"
              >
                Open the Enterprise Brain
              </Link>
            </div>
          ),
      },
    ];
  }, [categoryKey, category, staticScreens, platformModuleKey, moduleName]);

  const tabs = useMemo<Tab[]>(() => {
    const staticTabs = [
      ...consoleScreens,
      ...auditScreens,
      ...intelligenceScreens,
      ...staticScreens,
    ].map<Tab>((entry) => ({
      kind: 'static',
      ...entry,
    }));

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
  }, [
    consoleScreens,
    auditScreens,
    intelligenceScreens,
    staticScreens,
    staticScreensPlacement,
    category,
    screenRegistry,
  ]);

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

  // Process Builder is a screen, not a tab strip, for the same reason as
  // Onboarding: the category holds no menus in any module, and the screen it
  // shows is one screen for the whole ERP. It brings its own page frame and
  // heading, so nothing is drawn around it.
  if (
    categoryKey === PROCESS_BUILDER_CATEGORY_KEY ||
    category?.key === PROCESS_BUILDER_CATEGORY_KEY
  ) {
    const scope = category?.platformModuleKey || platformModuleKey || moduleName;

    // The name matters as much as the key: a module the converter's registry
    // does not know is offered under the name the menu uses for it, so Student
    // → Process Builder opens on Student instead of falling back to whichever
    // module happens to be registered first.
    return (
      <AddProcessPage
        defaultModuleKey={SOP_MODULE_ALIASES[scope] ?? scope}
        defaultModuleName={moduleLabel(moduleName)}
      />
    );
  }

  // Onboarding is a screen, not a tab strip, so it answers before any of the
  // tab rendering below. No PageHeader: the journey brings its own heading and
  // the category bar above is where the user came from.
  if (categoryKey === ONBOARDING_CATEGORY_KEY || category?.key === ONBOARDING_CATEGORY_KEY) {
    const journeyKey = category?.onboardingModuleKey || onboardingModuleKey;

    if (state === 'error') {
      return (
        <PageFrame>
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error || 'Unable to load this category.'}</span>
          </div>
        </PageFrame>
      );
    }

    if (state === 'loading') {
      return (
        <PageFrame>
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-6 text-sm text-slate-500 shadow-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading onboarding…
          </div>
        </PageFrame>
      );
    }

    if (journeyKey) {
      return (
        <PageFrame>
          <ModuleJourney moduleKey={journeyKey} />
        </PageFrame>
      );
    }

    // A bar that groups screens from several modules owns no journey of its
    // own. Saying so and offering the index beats showing one of the others.
    return (
      <PageFrame>
        <PageHeader
          title={category?.label || 'Onboarding'}
          description={category?.description || undefined}
        />
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-8 text-center shadow-sm">
          <p className="text-sm font-medium text-slate-700">No onboarding journey for this menu</p>
          <p className="mt-1 text-sm text-slate-500">
            This menu collects screens from more than one module, so it has no journey of its own.
          </p>
          <Link
            href={ONBOARDING_INDEX_ROUTE}
            className="mt-3 inline-flex items-center text-sm font-semibold text-[#5846EA] hover:underline"
          >
            Open onboarding
          </Link>
        </div>
      </PageFrame>
    );
  }

  /*
   * The Intelligence workspace brings its own header — a context chip, the
   * MODULE name, then the organisation and year — so the category's generic
   * "Intelligence / Predictive and analytical views over <module> data" above it
   * was a second <h1> saying the product name a second time, directly above the
   * module name it duplicates. Suppressed for this category only, exactly as
   * Onboarding already does a few lines above for the same reason.
   */
  const intelligenceWorkspace =
    (categoryKey === INTELLIGENCE_CATEGORY_KEY || category?.key === INTELLIGENCE_CATEGORY_KEY) &&
    activeTab?.kind === 'static';

  return (
    <PageFrame>
      {intelligenceWorkspace ? null : (
        <PageHeader title={category?.label ?? ''} description={category?.description || undefined} />
      )}

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
          {/*
            * A ONE-TAB STRIP IS NOT NAVIGATION. Fees' Intelligence category has a
            * single static screen, so the bar rendered one lone tab reading
            * "Fees Intelligence" directly above a heading that already says Fees
            * — pure chrome with nothing to switch to. It reappears the moment a
            * second screen exists.
            */}
          <div
            className={`flex flex-wrap items-center gap-5 overflow-x-auto border-b border-[#D9E3F1] ${
              tabs.length < 2 ? 'hidden' : ''
            }`}
          >
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
