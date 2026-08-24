'use client';

import Link from 'next/link';
import {
  AlertTriangle,
  Bot,
  Compass,
  Database,
  Gauge,
  GitBranch,
  GraduationCap,
  Inbox,
  Layers,
  Loader2,
  Mountain,
  Radar,
  RefreshCw,
  SlidersHorizontal,
  type LucideIcon,
} from 'lucide-react';

/**
 * New PAL → Administration — shared page chrome.
 *
 * Administration is a sibling of Framework, Content Model, Unified Learning
 * Units and Pedagogy Engine in the New PAL sub-nav (DashboardShell's
 * `augmentPalLevel3Items`), so it wears the same clothes as the Pedagogy
 * Engine: the violet gradient hero, the translucent metric tiles, and a
 * centred status panel for every non-ready state.
 *
 * The sub-nav itself is NOT rendered here — DashboardShell already renders it
 * above the page for every `/pal*` route. Rendering a second one inside the
 * page would duplicate it.
 */

/** The API names an icon per subsystem; this is the only place that binds it to a glyph. */
export const SUBSYSTEM_ICONS: Record<string, LucideIcon> = {
  layers: Layers,
  repeat: RefreshCw,
  gauge: Gauge,
  graduation: GraduationCap,
  mountain: Mountain,
  graph: GitBranch,
  bot: Bot,
  radar: Radar,
  compass: Compass,
};

export function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-full px-4 py-5 sm:px-6">
      <div className="mx-auto w-full max-w-[1800px] space-y-6">{children}</div>
    </div>
  );
}

/**
 * Every non-ready state renders one of these — there is no code path that
 * leaves the page blank. A blank Administration screen is indistinguishable
 * from a broken one, which is exactly the wrong signal for a control plane.
 */
export function StatusPanel({
  kind,
  title,
  message,
  onRetry,
  retrying,
}: {
  kind: 'loading' | 'error' | 'empty';
  title: string;
  message: string;
  onRetry?: () => void;
  retrying?: boolean;
}) {
  const icon =
    kind === 'loading' ? (
      <Loader2 className="h-8 w-8 animate-spin" />
    ) : kind === 'error' ? (
      <AlertTriangle className="h-8 w-8" />
    ) : (
      <Inbox className="h-8 w-8" />
    );

  return (
    <section className="rounded-[28px] border border-slate-200 bg-white px-6 py-14 shadow-sm">
      <div className="mx-auto max-w-2xl text-center">
        <div
          className={`mx-auto flex h-16 w-16 items-center justify-center rounded-3xl ${
            kind === 'error' ? 'bg-rose-50 text-rose-600' : 'bg-violet-50 text-violet-600'
          }`}
        >
          {icon}
        </div>
        <h2 className="mt-5 text-xl font-bold text-slate-900">{title}</h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">{message}</p>
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            disabled={retrying}
            className="mt-6 inline-flex h-10 items-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {retrying ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Retry
          </button>
        ) : null}
      </div>
    </section>
  );
}

export function HeroMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/10 px-4 py-3 ring-1 ring-white/15 backdrop-blur">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-200">{label}</p>
      <p className="mt-1 text-2xl font-bold tracking-tight text-white">{value}</p>
    </div>
  );
}

/**
 * The violet hero. `metrics` fills the right-hand tile grid; `chips` runs under
 * the title; `source` gets the monospace database strip the Pedagogy Engine
 * uses to name where its data came from.
 */
export function Hero({
  breadcrumb,
  icon: Icon = SlidersHorizontal,
  title,
  description,
  badge,
  chips,
  metrics,
  source,
  onRefresh,
  refreshing,
}: {
  breadcrumb: string[];
  icon?: LucideIcon;
  title: string;
  description?: string;
  badge?: string | null;
  chips?: React.ReactNode;
  metrics: { label: string; value: string }[];
  source?: string | null;
  onRefresh?: () => void;
  refreshing?: boolean;
}) {
  return (
    <section className="overflow-hidden rounded-[28px] bg-[linear-gradient(135deg,#2e1065_0%,#4c1d95_45%,#1e1b4b_100%)] shadow-sm">
      <div className="grid gap-6 px-6 py-7 lg:grid-cols-[minmax(0,1.5fr)_minmax(300px,0.8fr)]">
        <div className="min-w-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-violet-300">
              {breadcrumb.map((crumb, index) => (
                <span key={crumb} className="flex items-center gap-3">
                  {index > 0 ? <span aria-hidden="true">/</span> : null}
                  <span>{crumb}</span>
                </span>
              ))}
            </div>
            {onRefresh ? (
              <button
                type="button"
                onClick={onRefresh}
                disabled={refreshing}
                className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-xl bg-white/10 px-3 text-xs font-medium text-violet-100 ring-1 ring-white/15 transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60 lg:hidden"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            ) : null}
          </div>

          <div className="mt-3 flex items-start gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-white ring-1 ring-white/20">
              <Icon className="h-7 w-7" />
            </span>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-white">{title}</h1>
              {description ? (
                <p className="mt-2 max-w-3xl text-sm leading-6 text-violet-100/90">{description}</p>
              ) : null}
              {badge ? (
                <span className="mt-3 inline-flex rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-medium text-violet-100 ring-1 ring-white/15">
                  {badge}
                </span>
              ) : null}
            </div>
          </div>

          {chips ? <div className="mt-5 flex flex-wrap gap-2">{chips}</div> : null}
        </div>

        <div className="grid grid-cols-2 gap-3 self-start">
          {metrics.map((metric) => (
            <HeroMetric key={metric.label} label={metric.label} value={metric.value} />
          ))}
          {source ? (
            <div className="col-span-2 flex items-center gap-2 rounded-2xl bg-white/10 px-4 py-3 text-xs text-violet-100 ring-1 ring-white/15">
              <Database className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate font-mono">{source}</span>
            </div>
          ) : null}
          {onRefresh ? (
            <button
              type="button"
              onClick={onRefresh}
              disabled={refreshing}
              className="col-span-2 hidden h-10 items-center justify-center gap-2 rounded-2xl bg-white/10 text-xs font-medium text-violet-100 ring-1 ring-white/15 transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60 lg:flex"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}

/** A hero chip. `active` gets the solid white treatment the Pedagogy Engine uses. */
export function HeroChip({
  href,
  children,
  active,
}: {
  href?: string;
  children: React.ReactNode;
  active?: boolean;
}) {
  const className = `rounded-full px-3 py-1 text-xs font-medium transition ${
    active
      ? 'bg-white text-violet-900'
      : 'bg-white/10 text-violet-100 ring-1 ring-white/15 hover:bg-white/20'
  }`;

  return href ? (
    <Link href={href} className={className}>
      {children}
    </Link>
  ) : (
    <span className={className}>{children}</span>
  );
}
