'use client';

import React from 'react';
import { type LucideIcon } from 'lucide-react';
import {
  ACCENTS, BOX_SHAPES, ICON_SHAPES, type Accent, type BoxShape, type IconShape,
} from '@/app/dashboard/_components/dashboard-accents';

type Tone = 'default' | 'positive' | 'warning' | 'critical';

const ICON_TONE: Record<Tone, string> = {
  default: 'bg-indigo-50 text-[#4F46E5]',
  positive: 'bg-emerald-50 text-emerald-700',
  warning: 'bg-amber-50 text-amber-700',
  critical: 'bg-red-50 text-red-700',
};

/** Hover lift shared by interactive colourful cards; collapses under reduced motion. */
const LIFT = 'transition-[transform,box-shadow,border-color] duration-200 ease-out hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:hover:translate-y-0';

/**
 * Card styles for the colourful variant:
 *  - gradient: tint fading to white, coloured border
 *  - tinted:   flat tint, coloured border
 *  - bordered: white with a coloured border
 *  - strip:    white with a coloured accent strip along the top
 */
export type CardVariant = 'gradient' | 'tinted' | 'bordered' | 'strip';

function cardSurface(accent: Accent, variant: CardVariant) {
  const a = ACCENTS[accent];
  if (variant === 'gradient') return `border ${a.cardGradient}`;
  if (variant === 'tinted') return `border ${a.card}`;
  if (variant === 'bordered') return `border-2 bg-white ${a.border}`;
  return `border bg-white border-slate-200`;
}

/**
 * Compact KPI tile: label, one figure, an optional one-line `hint` underneath.
 * With `href` the whole tile is a link to the screen behind the number.
 * Pass `accent` (and optionally `variant` / `shape` / `iconShape`) for the colourful style;
 * without it the tile keeps the neutral style other dashboards use.
 */
export function StatCard({
  label,
  value,
  icon: Icon,
  tone = 'default',
  hint,
  href,
  children,
  accent,
  variant = 'gradient',
  shape = 'soft',
  iconShape = 'squircle',
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  tone?: Tone;
  hint?: React.ReactNode;
  href?: string;
  /** Extra content under the figure — e.g. a small distribution bar. */
  children?: React.ReactNode;
  accent?: Accent;
  variant?: CardVariant;
  shape?: BoxShape;
  iconShape?: IconShape;
}) {
  if (accent) {
    const a = ACCENTS[accent];
    const body = (
      <>
        {variant === 'strip' && <span className={`absolute inset-x-0 top-0 h-1 ${a.strip}`} aria-hidden />}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className={`truncate text-xs font-semibold uppercase tracking-wider ${a.muted}`}>{label}</div>
            <div className={`mt-1.5 text-[1.65rem] font-bold leading-none tracking-tight tabular-nums ${a.value}`}>{value}</div>
          </div>
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center ${ICON_SHAPES[iconShape]} ${a.iconSolid}`}>
            <Icon size={20} strokeWidth={2} aria-hidden />
          </div>
        </div>
        {children}
        {hint && (
          <div className="mt-3">
            <span className={`inline-flex max-w-full items-center truncate rounded-full px-2.5 py-0.5 text-xs font-medium ${a.chip}`}>{hint}</span>
          </div>
        )}
      </>
    );
    const className = `relative block overflow-hidden p-4 shadow-sm ${BOX_SHAPES[shape]} ${cardSurface(accent, variant)} ${LIFT} ${a.hover}`;

    if (href) {
      return (
        <a href={href} className={`${className} outline-none focus-visible:ring-2 ${a.ring}`}>
          {body}
        </a>
      );
    }
    return <div className={className}>{body}</div>;
  }

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

/**
 * Small figure for the "at a glance" strip: a white inner box with a coloured accent
 * strip on its left edge and a soft coloured icon.
 */
export function MiniStat({
  label,
  value,
  icon: Icon,
  tone = 'default',
  accent,
  iconShape = 'squircle',
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  tone?: Tone;
  accent?: Accent;
  iconShape?: IconShape;
}) {
  if (accent) {
    const a = ACCENTS[accent];
    return (
      <div className={`relative flex min-w-0 items-center gap-3 overflow-hidden rounded-xl border bg-white py-3 pl-4 pr-3 shadow-sm ${a.border} ${LIFT} ${a.hover}`}>
        <span className={`absolute inset-y-0 left-0 w-1 ${a.strip}`} aria-hidden />
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center ${ICON_SHAPES[iconShape]} ${a.iconSoft}`}>
          <Icon size={18} strokeWidth={2} aria-hidden />
        </div>
        <div className="min-w-0">
          <div className={`text-lg font-bold leading-tight tabular-nums ${a.value}`}>{value}</div>
          <div className={`truncate text-xs font-medium ${a.muted}`} title={label}>
            {label}
          </div>
        </div>
      </div>
    );
  }

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

/**
 * Titled section. With `accent`, the header becomes a coloured band (outer colour)
 * over a white body (inner colour), with a gradient icon tile beside the title.
 */
export function SectionPanel({
  title,
  description,
  action,
  children,
  className = '',
  flush = false,
  accent,
  icon: Icon,
  shape = 'soft',
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  /** Body runs edge to edge (tables, lists with their own row padding). */
  flush?: boolean;
  accent?: Accent;
  icon?: LucideIcon;
  shape?: BoxShape;
}) {
  if (accent) {
    const a = ACCENTS[accent];
    return (
      <section className={`overflow-hidden border bg-white shadow-sm transition-shadow duration-200 hover:shadow-md ${BOX_SHAPES[shape]} ${a.border} ${className}`}>
        <div className={`flex items-center justify-between gap-3 border-b px-5 py-3 ${a.band}`}>
          <div className="flex min-w-0 items-center gap-3">
            {Icon && (
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${a.iconSolid}`}>
                <Icon size={16} strokeWidth={2} aria-hidden />
              </span>
            )}
            <div className="min-w-0">
              <h2 className={`truncate text-sm font-semibold ${a.label}`}>{title}</h2>
              {description && <p className={`truncate text-xs ${a.muted}`}>{description}</p>}
            </div>
          </div>
          {action}
        </div>
        <div className={flush ? 'pb-2' : 'p-5'}>{children}</div>
      </section>
    );
  }

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

export function EmptyState({ message, icon: Icon, accent }: { message: string; icon?: LucideIcon; accent?: Accent }) {
  const tint = accent ? `${ACCENTS[accent].card} ${ACCENTS[accent].muted}` : 'border-slate-200 bg-slate-50 text-slate-500';
  return (
    <div className={`flex flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-6 text-center text-sm ${tint}`}>
      {Icon && <Icon size={20} strokeWidth={1.5} className="opacity-70" aria-hidden />}
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

/** Icon-over-label shortcut tile for the quick-actions grid, tinted in its section's colour. */
export function QuickActionTile({
  label,
  icon: Icon,
  onClick,
  accent = 'indigo',
  iconShape = 'squircle',
}: {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  accent?: Accent;
  iconShape?: IconShape;
}) {
  const a = ACCENTS[accent];
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-[84px] flex-col items-center justify-center gap-2 rounded-xl border px-2 py-3 text-center text-xs font-semibold outline-none focus-visible:ring-2 active:scale-[0.97] motion-reduce:active:scale-100 ${a.card} ${a.label} ${a.ring} ${LIFT} ${a.hover}`}
    >
      <span className={`flex h-9 w-9 items-center justify-center ${ICON_SHAPES[iconShape]} ${a.iconSolid}`}>
        <Icon size={18} strokeWidth={2} aria-hidden />
      </span>
      <span className="leading-tight">{label}</span>
    </button>
  );
}

/**
 * One horizontal bar split into labelled parts (e.g. present / absent / not marked),
 * with an optional legend of colour dot + label + count, so meaning never rests on colour alone.
 */
export function SegmentBar({
  segments,
  label,
  legend = false,
}: {
  /** `className` colours the bar segment, `dot` the legend dot (defaults to `className`). */
  segments: Array<{ label: string; value: number; className: string; dot?: string }>;
  label: string;
  legend?: boolean;
}) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  if (total === 0) return null;

  return (
    <div className="mt-3">
      <div className="flex h-2 gap-0.5 overflow-hidden rounded-full bg-white/80 ring-1 ring-black/5" role="img" aria-label={label}>
        {segments
          .filter((s) => s.value > 0)
          .map((s) => (
            <div key={s.label} className={`h-full ${s.className}`} style={{ width: `${(s.value / total) * 100}%` }} />
          ))}
      </div>
      {legend && (
        <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600">
          {segments.map((s) => (
            <li key={s.label} className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${s.dot ?? s.className}`} aria-hidden />
              {s.label} <span className="font-semibold text-slate-800 tabular-nums">{s.value.toLocaleString('en-IN')}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading dashboard">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {['bg-indigo-50', 'bg-emerald-50', 'bg-teal-50', 'bg-sky-50'].map((tint, i) => (
          <div key={i} className={`h-[118px] animate-pulse rounded-2xl border border-slate-200 ${tint}`} />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-xl border border-slate-200 bg-white" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="h-72 animate-pulse rounded-2xl border border-slate-200 bg-white lg:col-span-2" />
        <div className="h-72 animate-pulse rounded-2xl border border-slate-200 bg-white" />
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
