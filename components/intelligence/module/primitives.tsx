'use client';

import type { ReactNode } from 'react';

/**
 * Presentation primitives shared by every Intelligence screen.
 *
 * The generalised form of `app/fees/intelligence/_components/fees-intelligence-primitives.tsx`
 * — same rules (an unknown is an em dash, never a zero; a severity always
 * carries a word beside its colour), same visual language, with the one hard
 * requirement a shared component adds: no hard-coded accent. Fees kept
 * #5846EA; every colour that used to be that literal now reads
 * `var(--intel-accent)`, set once per screen by `ModuleIntelligence` /
 * `IntelligenceSectionNav` so this file never has to know which module it is
 * rendering.
 */

/* ---------------------------------------------------------------- severity */

export type Tone = 'critical' | 'high' | 'medium' | 'low' | 'positive' | 'neutral' | 'info';

const TONES: Record<Tone, { chip: string; dot: string; rail: string }> = {
  critical: { chip: 'bg-red-50 text-red-800 ring-red-200', dot: 'bg-red-500', rail: 'bg-red-500' },
  high: { chip: 'bg-red-50 text-red-800 ring-red-200', dot: 'bg-red-500', rail: 'bg-red-500' },
  medium: { chip: 'bg-amber-50 text-amber-900 ring-amber-200', dot: 'bg-amber-500', rail: 'bg-amber-500' },
  low: { chip: 'bg-slate-100 text-slate-700 ring-slate-200', dot: 'bg-slate-400', rail: 'bg-slate-300' },
  positive: { chip: 'bg-emerald-50 text-emerald-800 ring-emerald-200', dot: 'bg-emerald-500', rail: 'bg-emerald-500' },
  info: { chip: 'bg-indigo-50 text-indigo-800 ring-indigo-200', dot: 'bg-indigo-500', rail: 'bg-indigo-500' },
  neutral: { chip: 'bg-slate-100 text-slate-700 ring-slate-200', dot: 'bg-slate-400', rail: 'bg-slate-300' },
};

export function toneFor(severity: string | null | undefined): Tone {
  const key = (severity || '').toLowerCase();
  if (key === 'critical' || key === 'high' || key === 'medium' || key === 'low') return key;
  return 'neutral';
}

/** Maps an outcome/result word — 'success' or 'resolved', 'partial' or 'partially_resolved', etc. */
export function toneForResult(result: string | null | undefined): Tone {
  const key = (result || '').toLowerCase();
  if (key === 'success' || key === 'resolved') return 'positive';
  if (key === 'partial' || key === 'partially_resolved') return 'medium';
  if (key === 'failed' || key === 'not_reached') return 'high';
  return 'neutral';
}

export function SeverityChip({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${TONES[tone].chip}`}
    >
      <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${TONES[tone].dot}`} />
      {children}
    </span>
  );
}

export function SeverityRail({ tone }: { tone: Tone }) {
  return <span aria-hidden className={`absolute inset-y-0 left-0 w-1 rounded-l-xl ${TONES[tone].rail}`} />;
}

/* ------------------------------------------------------------------ layout */

export function Section({
  id,
  eyebrow,
  title,
  description,
  action,
  children,
}: {
  id?: string;
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          {eyebrow ? (
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[color:var(--intel-accent)]">{eyebrow}</p>
          ) : null}
          <h2 className="mt-1 text-[17px] font-bold leading-tight text-slate-900">{title}</h2>
          {description ? <p className="mt-1 max-w-3xl text-[13px] leading-5 text-slate-600">{description}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Surface({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] ${className}`}>
      {children}
    </div>
  );
}

/** A note explaining why something is absent — always the backend's own reason, never a generic "no data". */
export function Unavailable({ title, reason }: { title: string; reason?: string | null }) {
  return (
    <Surface className="px-4 py-6">
      <p className="text-[13px] font-semibold text-slate-700">{title}</p>
      {reason ? <p className="mt-1 max-w-2xl text-[13px] leading-5 text-slate-500">{reason}</p> : null}
    </Surface>
  );
}

/* ------------------------------------------------------------------ actions */

export function AccentButton({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-2 rounded-lg bg-[color:var(--intel-accent)] px-3.5 py-1.5 text-[13px] font-semibold text-white shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------ metric tiles */

/**
 * One analytics figure. `onClick` turns the tile into a drill-down; a tile
 * that cannot be drilled into stays a plain div rather than an unresponsive
 * button, so nothing on this screen looks clickable and then does nothing.
 */
export function MetricTile({
  label,
  value,
  hint,
  tone = 'neutral',
  emphasis = false,
  onClick,
  actionLabel,
}: {
  label: string;
  value: string;
  hint?: string | null;
  tone?: Tone;
  emphasis?: boolean;
  onClick?: () => void;
  actionLabel?: string;
}) {
  const body = (
    <>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p
        className={`mt-1.5 font-bold tabular-nums tracking-tight text-slate-900 ${
          emphasis ? 'text-[26px] leading-8' : 'text-[20px] leading-7'
        }`}
      >
        {value}
      </p>
      {hint ? <p className="mt-1 text-[12px] leading-4 text-slate-500">{hint}</p> : null}
      {onClick ? (
        <p className="mt-2 text-[12px] font-semibold text-[color:var(--intel-accent)]">{actionLabel ?? 'View detail'} →</p>
      ) : null}
    </>
  );

  const shell = `relative overflow-hidden rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-left shadow-[0_1px_2px_rgba(15,23,42,0.04)]`;

  if (!onClick) {
    return (
      <div className={shell}>
        {tone !== 'neutral' ? <SeverityRail tone={tone} /> : null}
        {body}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`${shell} transition hover:border-[color:var(--intel-accent)]/40 hover:shadow-[0_2px_10px_rgba(15,23,42,0.08)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--intel-accent)]`}
    >
      {tone !== 'neutral' ? <SeverityRail tone={tone} /> : null}
      {body}
    </button>
  );
}

/* ------------------------------------------------------------ evidence list */

/** The figures a finding rests on, shown as label/value pairs. */
export function EvidenceGrid({ points }: { points: Array<{ label: string; value: string; note?: string | null }> }) {
  if (points.length === 0) return null;

  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-3 lg:grid-cols-4">
      {points.map((point, index) => (
        <div key={`${point.label}-${index}`} className="rounded-lg bg-slate-50 px-3 py-2">
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{point.label}</dt>
          <dd className="mt-0.5 text-[14px] font-bold tabular-nums text-slate-900">{point.value}</dd>
          {point.note ? <dd className="mt-0.5 text-[11px] leading-4 text-slate-500">{point.note}</dd> : null}
        </div>
      ))}
    </dl>
  );
}

/** Confidence, always with its word — "High", never a bare 0.85. Absent entirely when the payload sent none. */
export function ConfidencePill({ band, value }: { band?: string | null; value?: number | null }) {
  if (!band) return null;

  const tone: Tone = band === 'High' ? 'positive' : band === 'Medium' ? 'medium' : 'low';

  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] text-slate-600">
      <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${TONES[tone].dot}`} />
      <span className="font-semibold text-slate-700">{band}</span>
      {typeof value === 'number' ? <span className="tabular-nums text-slate-400">({value.toFixed(2)})</span> : null}
    </span>
  );
}
