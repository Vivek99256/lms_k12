'use client';

import React from 'react';
import { type LucideIcon } from 'lucide-react';

type Tone = 'default' | 'positive' | 'warning' | 'critical';

const ICON_TONE: Record<Tone, string> = {
  default: 'bg-indigo-50 text-[#4F46E5]',
  positive: 'bg-emerald-50 text-emerald-700',
  warning: 'bg-amber-50 text-amber-700',
  critical: 'bg-red-50 text-red-700',
};

/**
 * Compact KPI tile: label, one figure, an optional one-line `hint` underneath.
 * With `href` the whole tile is a link to the screen behind the number.
 */
export function StatCard({
  label,
  value,
  icon: Icon,
  tone = 'default',
  hint,
  href,
  children,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  tone?: Tone;
  hint?: React.ReactNode;
  href?: string;
  /** Extra content under the figure — e.g. a small distribution bar. */
  children?: React.ReactNode;
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-slate-500">{label}</div>
          <div className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 tabular-nums">{value}</div>
        </div>
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${ICON_TONE[tone]}`}>
          <Icon size={18} strokeWidth={1.75} aria-hidden />
        </div>
      </div>
      {children}
      {hint && <div className="mt-2 truncate text-xs text-slate-500">{hint}</div>}
    </>
  );

  const className = 'block rounded-xl border border-slate-200 bg-white p-4 shadow-sm';

  if (href) {
    return (
      <a
        href={href}
        className={`${className} outline-none transition-colors hover:border-slate-300 hover:bg-slate-50/60 focus-visible:ring-2 focus-visible:ring-[#4F46E5]/40`}
      >
        {body}
      </a>
    );
  }

  return <div className={className}>{body}</div>;
}

/** Small inline figure for a secondary "at a glance" strip — lighter than a StatCard. */
export function MiniStat({
  label,
  value,
  icon: Icon,
  tone = 'default',
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  tone?: Tone;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3 px-4 py-3">
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${ICON_TONE[tone]}`}>
        <Icon size={16} strokeWidth={1.75} aria-hidden />
      </div>
      <div className="min-w-0">
        <div className="text-lg font-semibold leading-tight text-slate-900 tabular-nums">{value}</div>
        <div className="truncate text-xs text-slate-500" title={label}>
          {label}
        </div>
      </div>
    </div>
  );
}

export function SectionPanel({
  title,
  description,
  action,
  children,
  className = '',
  flush = false,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  /** Body runs edge to edge (tables, lists with their own row padding). */
  flush?: boolean;
}) {
  return (
    <section className={`rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}>
      <div className="flex items-start justify-between gap-4 px-5 pt-4">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
        </div>
        {action}
      </div>
      <div className={flush ? 'pt-3 pb-2' : 'px-5 pt-4 pb-5'}>{children}</div>
    </section>
  );
}

export function EmptyState({ message, icon: Icon }: { message: string; icon?: LucideIcon }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
      {Icon && <Icon size={20} strokeWidth={1.5} className="text-slate-400" aria-hidden />}
      {message}
    </div>
  );
}

export function QuickActionLink({ href, label, icon: Icon }: { href: string; label: string; icon: LucideIcon }) {
  return (
    <a
      href={href}
      className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 outline-none transition-colors hover:border-[#4F46E5]/30 hover:bg-indigo-50/60 hover:text-[#4F46E5] focus-visible:ring-2 focus-visible:ring-[#4F46E5]/40"
    >
      <Icon size={18} strokeWidth={1.75} aria-hidden />
      {label}
    </a>
  );
}

/** Icon-over-label shortcut tile for the quick-actions grid. */
export function QuickActionTile({ label, icon: Icon, onClick }: { label: string; icon: LucideIcon; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex min-h-[76px] flex-col items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-3 text-center text-xs font-medium text-slate-700 outline-none transition-colors hover:border-[#4F46E5]/30 hover:bg-indigo-50/60 hover:text-[#4F46E5] focus-visible:ring-2 focus-visible:ring-[#4F46E5]/40 active:scale-[0.97] motion-reduce:active:scale-100"
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-50 text-slate-600 transition-colors group-hover:bg-white group-hover:text-[#4F46E5]">
        <Icon size={18} strokeWidth={1.75} aria-hidden />
      </span>
      <span className="leading-tight">{label}</span>
    </button>
  );
}

/**
 * One horizontal bar split into labelled parts (e.g. present / absent / not marked).
 * Each part's meaning is carried by the legend text, never by colour alone.
 */
export function SegmentBar({
  segments,
  label,
}: {
  segments: Array<{ label: string; value: number; className: string }>;
  label: string;
}) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  if (total === 0) return null;

  return (
    <div className="mt-3">
      <div className="flex h-1.5 gap-0.5 overflow-hidden rounded-full bg-slate-100" role="img" aria-label={label}>
        {segments
          .filter((s) => s.value > 0)
          .map((s) => (
            <div key={s.label} className={`h-full ${s.className}`} style={{ width: `${(s.value / total) * 100}%` }} />
          ))}
      </div>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading dashboard">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-[104px] animate-pulse rounded-xl border border-slate-200 bg-white" />
        ))}
      </div>
      <div className="h-16 animate-pulse rounded-xl border border-slate-200 bg-white" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="h-72 animate-pulse rounded-xl border border-slate-200 bg-white lg:col-span-2" />
        <div className="h-72 animate-pulse rounded-xl border border-slate-200 bg-white" />
      </div>
    </div>
  );
}

export function DashboardError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
      <p className="text-sm text-red-700">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 rounded-lg border border-red-300 bg-white px-4 py-1.5 text-sm font-medium text-red-700 outline-none hover:bg-red-100 focus-visible:ring-2 focus-visible:ring-red-400/50"
      >
        Try again
      </button>
    </div>
  );
}
