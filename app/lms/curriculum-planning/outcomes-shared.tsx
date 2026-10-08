// Small presentational helpers shared across the Outcomes & Delivery tab's
// three panels (Overview / LO & LI analysis / Student analysis) and its
// detail drawer.
//
// IMPORTANT: this intentionally does NOT use <StatusBadge variant="success"|
// "warning">. Those two variants reference `--success`/`--warning` CSS
// variables that app/globals.css never defines (only `--destructive` and
// `--primary` are real tokens here - confirmed by grepping globals.css) - the
// very trap shared.tsx's own comment on 'Coming Soon'/'Pilot' already warns
// about for this exact file's neighbours. Every status pill here instead
// uses a literal hex class, exactly like this folder's existing
// chapterStatusClassName/subjectProgressStatusClassName maps.

import { useEffect, useState } from 'react';
import type {
  AchievementStatus,
  AchievementTier,
  AssessedStatus,
  DeliveredStatus,
  GapCategory,
  HealthStatus,
} from './outcomes-types';

export type Tone = 'green' | 'blue' | 'purple' | 'amber' | 'red' | 'teal' | 'indigo' | 'pink' | 'gray';

/** Real content_master.file_type values -> a friendlier display label. Unknown types fall back to the raw key. */
export const RESOURCE_TYPE_LABEL: Record<string, string> = {
  pdf: 'PDF',
  link: 'Link / video',
  jpg: 'Image',
  png: 'Image',
  h5p: 'H5P interactive',
  ppt: 'Presentation',
  pptx: 'Presentation',
  other: 'Other',
};

const TONE_CLASS: Record<Tone, string> = {
  green: 'bg-[#def4d2] text-[#3f7b2b]',
  blue: 'bg-[#dcecff] text-[#1761a7]',
  purple: 'bg-[#e8e4fb] text-[#473aa5]',
  amber: 'bg-[#fae8c7] text-[#6f470c]',
  red: 'bg-[#fae0d4] text-[#8a331a]',
  teal: 'bg-[#d1f3ef] text-[#0d6c62]',
  indigo: 'bg-[#e3e0fc] text-[#3730a3]',
  pink: 'bg-[#f7dce8] text-[#8b2549]',
  gray: 'bg-[#e3e1de] text-[#706b64]',
};

/** Hex accents matching TONE_CLASS, for places that need a raw color rather than a bg/text pair (SVG strokes, left-border accents, icon badges). */
const TONE_HEX: Record<Tone, string> = {
  green: '#1aa179',
  blue: '#2f7dd9',
  purple: '#7468d9',
  amber: '#b87916',
  red: '#d45628',
  teal: '#0d9488',
  indigo: '#4f46e5',
  pink: '#c6377d',
  gray: '#9a958e',
};

/** A rotation for list items that each need a visually distinct color (resource types, mastery bands) without any inherent tone meaning. */
const ROTATION: Tone[] = ['blue', 'teal', 'purple', 'amber', 'pink', 'indigo', 'green', 'red'];
export function toneAt(index: number): Tone {
  return ROTATION[index % ROTATION.length];
}

export function Pill({ tone, children, className = '' }: { tone: Tone; children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ${TONE_CLASS[tone]} ${className}`}>
      {children}
    </span>
  );
}

export function formatAchievementValue(value: number | null): string {
  return value === null ? 'Data not available' : `${value}%`;
}

export function achievementTierLabel(tier: AchievementTier): string {
  switch (tier) {
    case 'pal_verified':
      return 'PAL-verified';
    case 'exam_based':
      return 'Exam-based';
    case 'unavailable':
      return 'No evidence yet';
    default:
      return 'Not applicable';
  }
}

export function achievementTone(tier: AchievementTier): Tone {
  switch (tier) {
    case 'pal_verified':
      return 'purple';
    case 'exam_based':
      return 'blue';
    case 'unavailable':
      return 'gray';
    default:
      return 'gray';
  }
}

/**
 * Good / Average / Needs attention - a dot (or, for "needs attention", a
 * rotated-square diamond) plus a text label, matching the reference LO
 * Mastery report's own status convention exactly rather than a filled pill,
 * so the status reads as a signal light, not another colored badge
 * competing with the Delivered/Assessed/Gap pills next to it.
 */
const STATUS_CONFIG: Record<AchievementStatus, { label: string; dotClass: string; textClass: string; diamond?: boolean }> = {
  good: { label: 'Good', dotClass: 'bg-[#1aa179]', textClass: 'text-[#1aa179]' },
  average: { label: 'Average', dotClass: 'bg-[#b87916]', textClass: 'text-[#b87916]' },
  needs_attention: { label: 'Needs attention', dotClass: 'bg-[#d45628]', textClass: 'text-[#d45628]', diamond: true },
};

export function statusTone(status: AchievementStatus | null): Tone {
  if (status === 'good') return 'green';
  if (status === 'average') return 'amber';
  if (status === 'needs_attention') return 'red';
  return 'gray';
}

export function StatusDot({ status }: { status: AchievementStatus | null }) {
  if (status === null) {
    return <span className="text-xs text-[#a09a93]">—</span>;
  }

  const cfg = STATUS_CONFIG[status];

  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-medium ${cfg.textClass}`}>
      <span className={`inline-block h-2.5 w-2.5 shrink-0 ${cfg.diamond ? 'rotate-45 rounded-[2px]' : 'rounded-full'} ${cfg.dotClass}`} />
      {cfg.label}
    </span>
  );
}

export function deliveryStatusTone(status: string): Tone {
  if (status === 'Done') return 'green';
  if (status === 'In progress') return 'blue';
  return 'gray';
}

export const DELIVERED_LABEL: Record<DeliveredStatus, string> = {
  delivered: 'Delivered',
  in_progress: 'In progress',
  not_started: 'Not started',
  not_applicable: 'N/A',
};

export const DELIVERED_TONE: Record<DeliveredStatus, Tone> = {
  delivered: 'green',
  in_progress: 'blue',
  not_started: 'gray',
  not_applicable: 'gray',
};

export const ASSESSED_LABEL: Record<AssessedStatus, string> = {
  assessed: 'Assessed',
  not_assessed: 'Not assessed',
  not_applicable: 'N/A',
};

export const ASSESSED_TONE: Record<AssessedStatus, Tone> = {
  assessed: 'green',
  not_assessed: 'amber',
  not_applicable: 'gray',
};

export const GAP_LABEL: Record<GapCategory, string> = {
  delivery_gap: 'Delivery gap',
  assessment_gap: 'Assessment gap',
  learning_gap: 'Learning gap',
  none: 'On track',
  not_applicable: 'N/A',
};

export const GAP_TONE: Record<GapCategory, Tone> = {
  delivery_gap: 'amber',
  assessment_gap: 'amber',
  learning_gap: 'red',
  none: 'green',
  not_applicable: 'gray',
};

export const HEALTH_LABEL: Record<HealthStatus, string> = {
  on_track: 'Curriculum Health: Good',
  needs_attention: 'Curriculum Health: Needs Attention',
  at_risk: 'Curriculum Health: Critical',
};

export const HEALTH_TONE: Record<HealthStatus, Tone> = {
  on_track: 'green',
  needs_attention: 'amber',
  at_risk: 'red',
};

/**
 * A single labelled horizontal bar, e.g. "Delivered ███████░░░ 92". An
 * optional `threshold` (0-100) draws a thin target-line tick over the
 * track, e.g. at the Good/Needs-attention cut point, so the bar reads
 * against a goal rather than just as a bare percentage.
 */
export function TrackBar({
  label,
  value,
  max,
  tone = 'blue',
  valueLabel,
  threshold,
}: {
  label: string;
  value: number;
  max: number;
  tone?: Tone;
  valueLabel?: string;
  threshold?: number;
}) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  const [animatedPct, setAnimatedPct] = useState(0);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setAnimatedPct(pct));
    return () => cancelAnimationFrame(frame);
  }, [pct]);

  return (
    <div
      className="grid items-center gap-2.5"
      style={{ gridTemplateColumns: label ? 'minmax(84px,140px) 1fr minmax(48px,auto)' : '1fr minmax(48px,auto)' }}
    >
      {label ? <span className="truncate text-sm text-[#3c3833]">{label}</span> : null}
      <span className="relative h-3.5">
        <span className="absolute inset-0 overflow-hidden rounded-full bg-[#efeeec]">
          <span
            className="block h-full rounded-full bg-gradient-to-r transition-[width] duration-700 ease-out"
            style={{ width: `${animatedPct}%`, backgroundImage: `linear-gradient(90deg, ${TONE_HEX[tone]}cc, ${TONE_HEX[tone]})` }}
          />
        </span>
        {threshold !== undefined ? (
          <span className="absolute -top-0.5 -bottom-0.5 w-px bg-[#5c574f]/50" style={{ left: `${Math.min(100, Math.max(0, threshold))}%` }} />
        ) : null}
      </span>
      <span className="whitespace-nowrap text-right text-sm font-medium tabular-nums text-[#2d2924]">{valueLabel ?? value}</span>
    </div>
  );
}

/** A compact SVG donut for one achieved-vs-total split. */
export function Donut({ achieved, total, size = 128, tone = 'green' }: { achieved: number; total: number; size?: number; tone?: Tone }) {
  const pct = total > 0 ? (achieved / total) * 100 : 0;
  const r = 44;
  const c = 2 * Math.PI * r;
  const gradientId = `donut-grad-${tone}`;
  const [animatedPct, setAnimatedPct] = useState(0);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setAnimatedPct(pct));
    return () => cancelAnimationFrame(frame);
  }, [pct]);

  return (
    <svg viewBox="0 0 120 120" width={size} height={size} role="img" aria-label={`${Math.round(pct)} percent achieved`}>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={TONE_HEX[tone]} stopOpacity={0.75} />
          <stop offset="100%" stopColor={TONE_HEX[tone]} />
        </linearGradient>
      </defs>
      <circle cx="60" cy="60" r={r} fill="none" stroke="#eef0ee" strokeWidth="14" />
      <circle
        cx="60"
        cy="60"
        r={r}
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth="14"
        strokeDasharray={`${(c * animatedPct) / 100} ${c}`}
        strokeLinecap="round"
        transform="rotate(-90 60 60)"
        className="transition-[stroke-dasharray] duration-700 ease-out"
      />
      <text x="60" y="57" textAnchor="middle" fontSize="22" fontWeight="700" fill="#24211d">
        {Math.round(animatedPct)}%
      </text>
      <text x="60" y="75" textAnchor="middle" fontSize="10" fill="#9a958e">
        Achieved
      </text>
    </svg>
  );
}

/** A KPI tile with a colored icon badge and a left accent bar - richer than the plain StatCard, used where a KPI's meaning benefits from a color identity (Delivered = blue, Achieved = green, etc). */
export function KpiTile({
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>;
  label: string;
  value: string | number;
  hint?: string;
  tone: Tone;
}) {
  return (
    <div className="relative overflow-hidden rounded-lg border border-[#e5e1da] bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <span className="absolute inset-y-0 left-0 w-1" style={{ backgroundColor: TONE_HEX[tone] }} />
      <div className="flex items-start justify-between gap-2 pl-1.5">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-[#77716b]">{label}</p>
          <p className="mt-1 text-[28px] font-bold leading-none tabular-nums text-[#1f1d19]">{value}</p>
          {hint ? <p className="mt-1.5 truncate text-xs text-[#9a958e]">{hint}</p> : null}
        </div>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: `${TONE_HEX[tone]}1f` }}>
          <Icon size={18} className="shrink-0" style={{ color: TONE_HEX[tone] }} />
        </span>
      </div>
    </div>
  );
}
