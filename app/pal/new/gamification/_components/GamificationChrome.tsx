'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  AlertTriangle,
  Award,
  ClipboardCheck,
  Compass,
  Flame,
  Inbox,
  LayoutGrid,
  Loader2,
  RefreshCw,
  Swords,
  Trophy,
  Users,
  type LucideIcon,
} from 'lucide-react';

/**
 * New PAL → Gamification — shared page chrome.
 *
 * Gamification is a sibling of Framework, Content Model, Unified Learning Units,
 * Pedagogy Engine and Administration in the New PAL sub-nav (DashboardShell's
 * `augmentPalLevel3Items`), and wears the same shapes as the rest of New PAL —
 * the 28px panels, hairline slate borders and quiet shadows.
 *
 * It deliberately does NOT reuse the Pedagogy Engine / Administration violet
 * hero. This module is about a learner's own journey rather than a control
 * plane, so its hero is a warm amber-to-slate band carrying the one thing that
 * matters here: where the learner stands on the Stream → Mountain → Sky rail.
 * That rail is the module's signature element and appears nowhere else.
 *
 * The sub-nav above the page is rendered by DashboardShell for every `/pal*`
 * route; the tab bar below navigates WITHIN Gamification.
 */

export function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-full px-4 py-5 sm:px-6">
      <div className="mx-auto w-full max-w-[1800px] space-y-5">{children}</div>
    </div>
  );
}

/**
 * Every non-ready state renders one of these. A blank gamification screen is
 * indistinguishable from a broken one — and worse, a learner reads "nothing
 * here" as "nothing you did counted".
 */
export function StatusPanel({
  kind,
  title,
  message,
  onRetry,
  retrying,
  children,
}: {
  kind: 'loading' | 'error' | 'empty';
  title: string;
  message: string;
  onRetry?: () => void;
  retrying?: boolean;
  children?: React.ReactNode;
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
            kind === 'error' ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'
          }`}
        >
          {icon}
        </div>
        <h2 className="mt-5 text-xl font-bold text-slate-900">{title}</h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">{message}</p>
        {children ? <div className="mt-5">{children}</div> : null}
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

// --- tabs ------------------------------------------------------------------

export interface GamificationTab {
  key: string;
  label: string;
  href: string;
  icon: LucideIcon;
}

export const GAMIFICATION_TABS: GamificationTab[] = [
  { key: 'overview', label: 'Overview', href: '/pal/new/gamification', icon: LayoutGrid },
  { key: 'personal-best', label: 'Personal best', href: '/pal/new/gamification/personal-best', icon: Trophy },
  { key: 'streaks', label: 'Streaks', href: '/pal/new/gamification/streaks', icon: Flame },
  { key: 'badges', label: 'Badges', href: '/pal/new/gamification/badges', icon: Award },
  { key: 'team-challenges', label: 'Team challenges', href: '/pal/new/gamification/team-challenges', icon: Users },
  { key: 'career-quest', label: 'Career quest', href: '/pal/new/gamification/career-quest', icon: Compass },
  { key: 'challenge-mode', label: 'Challenge mode', href: '/pal/new/gamification/challenge-mode', icon: Swords },
  {
    key: 'session-summary',
    label: 'Session summary',
    href: '/pal/new/gamification/session-summary',
    icon: ClipboardCheck,
  },
];

export function GamificationTabs() {
  const pathname = (usePathname() || '').toLowerCase().replace(/\/$/, '');

  return (
    <nav className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-slate-200 bg-white p-1.5">
      {GAMIFICATION_TABS.map((tab) => {
        const Icon = tab.icon;
        const active =
          tab.href === '/pal/new/gamification'
            ? pathname === '/pal/new/gamification'
            : pathname.startsWith(tab.href);

        return (
          <Link
            key={tab.key}
            href={tab.href}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition ${
              active
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Icon className="h-4 w-4" />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

// --- hero ------------------------------------------------------------------

export interface HeroTier {
  key: string;
  label: string;
  count: number;
  minMastery: number;
}

/**
 * The module hero.
 *
 * The tier rail is the point: a learner sees the three levels and how many of
 * their concepts sit on each. There is no ceiling and no comparison — the rail
 * is the same shape for everyone, which is precisely why it is safe to show.
 */
export function QuestHero({
  title,
  subtitle,
  learnerName,
  gradeLabel,
  tiers,
  metrics,
  onRefresh,
  refreshing,
  right,
}: {
  title: string;
  subtitle?: string;
  learnerName?: string | null;
  gradeLabel?: string | null;
  tiers?: HeroTier[];
  metrics?: { label: string; value: string; hint?: string }[];
  onRefresh?: () => void;
  refreshing?: boolean;
  right?: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-[28px] bg-[linear-gradient(120deg,#0f172a_0%,#1e293b_38%,#78350f_100%)] shadow-sm">
      <div className="px-6 py-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-300/90">
              <span>New PAL</span>
              <span aria-hidden="true">/</span>
              <span>Gamification</span>
            </div>

            <div className="mt-3 flex items-start gap-4">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-amber-400/15 text-amber-300 ring-1 ring-amber-300/30">
                <Trophy className="h-7 w-7" />
              </span>
              <div className="min-w-0">
                <h1 className="text-2xl font-bold text-white">{title}</h1>
                {subtitle ? (
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">{subtitle}</p>
                ) : null}
                {learnerName ? (
                  <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[12px] font-medium text-slate-100 ring-1 ring-white/15">
                    {learnerName}
                    {gradeLabel ? <span className="text-slate-400">· {gradeLabel}</span> : null}
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {right}
            {onRefresh ? (
              <button
                type="button"
                onClick={onRefresh}
                disabled={refreshing}
                className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-white/10 px-3 text-xs font-medium text-slate-100 ring-1 ring-white/15 transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            ) : null}
          </div>
        </div>

        {tiers && tiers.length > 0 ? <TierRail tiers={tiers} /> : null}

        {metrics && metrics.length > 0 ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {metrics.map((metric) => (
              <div
                key={metric.label}
                className="rounded-2xl bg-white/[0.07] px-4 py-3 ring-1 ring-white/10 backdrop-blur"
              >
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-200/80">
                  {metric.label}
                </p>
                <p className="mt-1 text-2xl font-bold tracking-tight text-white">{metric.value}</p>
                {metric.hint ? <p className="mt-1 text-[11px] text-slate-400">{metric.hint}</p> : null}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

/** Stream → Mountain → Sky, with the learner's own concept counts on each step. */
function TierRail({ tiers }: { tiers: HeroTier[] }) {
  const total = tiers.reduce((sum, tier) => sum + tier.count, 0);

  return (
    <div className="mt-6 rounded-2xl bg-white/[0.05] p-4 ring-1 ring-white/10">
      <div className="flex items-end gap-2">
        {tiers.map((tier, index) => {
          const share = total > 0 ? Math.round((tier.count / total) * 100) : 0;
          const heights = ['h-8', 'h-12', 'h-16'];
          const tones = ['bg-slate-400/60', 'bg-emerald-400/70', 'bg-sky-400/70'];

          return (
            <div key={tier.key} className="flex-1">
              <div className="flex items-end justify-between gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-300">
                  {tier.label}
                </span>
                <span className="text-lg font-bold text-white">{tier.count}</span>
              </div>
              <div className={`mt-2 rounded-t-lg ${heights[index] ?? 'h-8'} relative overflow-hidden bg-white/10`}>
                <div
                  className={`absolute inset-x-0 bottom-0 ${tones[index] ?? 'bg-slate-400/60'}`}
                  style={{ height: `${total > 0 ? Math.max(share, tier.count > 0 ? 12 : 0) : 0}%` }}
                />
              </div>
              <p className="mt-1.5 text-[10px] text-slate-400">
                mastery ≥ {tier.minMastery.toFixed(2)}
              </p>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-[11px] text-slate-400">
        Every concept starts at Stream. The rail has no ceiling and no comparison to anyone else.
      </p>
    </div>
  );
}

// --- building blocks -------------------------------------------------------

export function SectionCard({
  title,
  description,
  action,
  children,
  tone = 'default',
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  tone?: 'default' | 'muted';
}) {
  return (
    <section
      className={`rounded-[24px] border border-slate-200 p-5 shadow-[0_8px_18px_rgba(15,23,42,0.04)] ${
        tone === 'muted' ? 'bg-slate-50/60' : 'bg-white'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold text-slate-900">{title}</h2>
          {description ? <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p> : null}
        </div>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** A circular progress indicator — used for skill and challenge progress. */
export function ProgressRing({
  percent,
  label,
  sublabel,
  size = 116,
  tone = 'amber',
}: {
  percent: number;
  label: string;
  sublabel?: string;
  size?: number;
  tone?: 'amber' | 'emerald' | 'sky' | 'slate';
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  const stroke = 9;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;

  const strokeTone = {
    amber: 'stroke-amber-500',
    emerald: 'stroke-emerald-500',
    sky: 'stroke-sky-500',
    slate: 'stroke-slate-400',
  }[tone];

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            className="stroke-slate-100"
            strokeWidth={stroke}
            fill="none"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            className={strokeTone}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            fill="none"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-bold text-slate-900">{label}</span>
          {sublabel ? <span className="text-[10px] text-slate-500">{sublabel}</span> : null}
        </div>
      </div>
    </div>
  );
}

export function StatTile({
  label,
  value,
  hint,
  icon,
  tone = 'default',
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: React.ReactNode;
  tone?: 'default' | 'good' | 'warn' | 'muted';
}) {
  const valueTone = {
    default: 'text-slate-900',
    good: 'text-emerald-600',
    warn: 'text-amber-600',
    muted: 'text-slate-400',
  }[tone];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_6px_14px_rgba(15,23,42,0.04)]">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[12px] font-medium text-slate-500">{label}</p>
        {icon ? (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
            {icon}
          </span>
        ) : null}
      </div>
      <p className={`mt-2 text-[26px] font-bold leading-none ${valueTone}`}>{value}</p>
      {hint ? <p className="mt-2 text-[11px] leading-4 text-slate-500">{hint}</p> : null}
    </div>
  );
}

/**
 * A genuine empty state. Never a fake record — the spec is explicit that a
 * placeholder is worse than nothing, and a child reads a fake badge as a lie.
 */
export function EmptyState({ title, message, icon }: { title: string; message: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 px-5 py-10 text-center">
      <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-slate-400 ring-1 ring-slate-200">
        {icon ?? <Inbox className="h-5 w-5" />}
      </div>
      <p className="mt-3 text-sm font-semibold text-slate-700">{title}</p>
      <p className="mx-auto mt-1.5 max-w-md text-xs leading-5 text-slate-500">{message}</p>
    </div>
  );
}

/** A quiet strip naming where the numbers on a screen came from. */
export function SourceNote({ tables, extra }: { tables: string[]; extra?: string }) {
  if (tables.length === 0 && !extra) return null;

  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-400">
      <span className="font-medium uppercase tracking-wider">Measured from</span>
      {tables.map((table) => (
        <span key={table} className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-500">
          {table}
        </span>
      ))}
      {extra ? <span>{extra}</span> : null}
    </p>
  );
}

/**
 * The §9 governance note. Shown because the rule is a feature, not fine print:
 * a student who knows classmates cannot see their data behaves differently
 * from one who assumes they can.
 */
export function PrivacyNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-600">
      {children}
    </div>
  );
}

export function Pill({ label, tone = 'slate' }: { label: string; tone?: 'slate' | 'amber' | 'emerald' | 'sky' | 'rose' }) {
  const tones = {
    slate: 'bg-slate-100 text-slate-600 ring-slate-200',
    amber: 'bg-amber-50 text-amber-700 ring-amber-200',
    emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    sky: 'bg-sky-50 text-sky-700 ring-sky-200',
    rose: 'bg-rose-50 text-rose-700 ring-rose-200',
  };

  return (
    <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ${tones[tone]}`}>{label}</span>
  );
}
