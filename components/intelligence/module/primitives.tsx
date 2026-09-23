'use client';

import type { ReactNode } from 'react';

import type { Tone } from './payload';

/**
 * Presentation primitives shared by every module's Intelligence screen.
 *
 * Hoisted from `app/fees/intelligence/_components/fees-intelligence-primitives.tsx`,
 * which said of itself: "Kept local to this screen rather than added to
 * components/ui: every one of these encodes a rule about how INTELLIGENCE is
 * presented — an unknown is shown as an em dash and never as zero, a severity
 * carries a word as well as a colour — and those rules would be wrong on a
 * general-purpose card."
 *
 * That reasoning was right, and it is exactly why these belong HERE rather than
 * in `components/ui`: this directory is the intelligence layer, so the rules
 * hold for everything in it. What has changed is only the scope — Fees was the
 * first module to need them, not the only one.
 *
 * TWO THINGS WERE GENERALISED IN THE MOVE, AND NOTHING ELSE:
 *
 *  - the accent is `--intel-accent` instead of a literal #5846EA, so a module
 *    with its own colour does not have to fork a component to get it. Fees
 *    passes #5846EA and looks identical.
 *  - formatting moved to `./format`, where the unit travels with the value,
 *    because Result renders students and Attendance renders sessions.
 *
 * The original file is untouched and the Fees screen still imports from it.
 */

/* ---------------------------------------------------------------- severity */

/* ---------------------------------------------------------------- severity */

export function normalizeTone(tone: unknown): Tone {
  if (typeof tone !== 'string') return 'neutral';
  const key = tone.toLowerCase().trim();
  if (
    key === 'critical' ||
    key === 'high' ||
    key === 'medium' ||
    key === 'low' ||
    key === 'positive' ||
    key === 'info' ||
    key === 'neutral' ||
    key === 'warning' ||
    key === 'attention' ||
    key === 'good'
  ) {
    return key as Tone;
  }
  return 'neutral';
}

const TONES: Record<Tone, { chip: string; dot: string; rail: string }> = {
  critical: { chip: 'bg-red-50 text-red-800 ring-red-200', dot: 'bg-red-500', rail: 'bg-red-500' },
  high: { chip: 'bg-red-50 text-red-800 ring-red-200', dot: 'bg-red-500', rail: 'bg-red-500' },
  medium: { chip: 'bg-amber-50 text-amber-900 ring-amber-200', dot: 'bg-amber-500', rail: 'bg-amber-500' },
  warning: { chip: 'bg-amber-50 text-amber-900 ring-amber-200', dot: 'bg-amber-500', rail: 'bg-amber-500' },
  attention: { chip: 'bg-amber-50 text-amber-900 ring-amber-200', dot: 'bg-amber-500', rail: 'bg-amber-500' },
  low: { chip: 'bg-slate-100 text-slate-700 ring-slate-200', dot: 'bg-slate-400', rail: 'bg-slate-300' },
  positive: { chip: 'bg-emerald-50 text-emerald-800 ring-emerald-200', dot: 'bg-emerald-500', rail: 'bg-emerald-500' },
  good: { chip: 'bg-emerald-50 text-emerald-800 ring-emerald-200', dot: 'bg-emerald-500', rail: 'bg-emerald-500' },
  info: { chip: 'bg-indigo-50 text-indigo-800 ring-indigo-200', dot: 'bg-indigo-500', rail: 'bg-indigo-500' },
  neutral: { chip: 'bg-slate-100 text-slate-700 ring-slate-200', dot: 'bg-slate-400', rail: 'bg-slate-300' },
};

export function toneFor(severity: string | null | undefined): Tone {
  const key = (severity || '').toLowerCase().trim();
  if (key === 'critical' || key === 'high') return key;
  if (key === 'medium' || key === 'warning' || key === 'attention') return 'medium';
  if (key === 'low') return 'low';
  if (key === 'positive' || key === 'good') return 'positive';
  if (key === 'info') return 'info';
  return 'neutral';
}

/** Tone for an outcome word, so "success" and "failed" never rely on colour alone. */
export function toneForResult(result: string | null | undefined): Tone {
  const key = (result || '').toLowerCase().trim();
  if (key === 'success' || key === 'resolved' || key === 'positive' || key === 'good') return 'positive';
  if (key === 'partial' || key === 'partially_resolved' || key === 'warning' || key === 'attention') return 'medium';
  if (key === 'failed' || key === 'not_reached' || key === 'critical' || key === 'high') return 'high';
  return 'neutral';
}

export function SeverityChip({ tone, children }: { tone: Tone | string | null | undefined; children: ReactNode }) {
  const safeTone = normalizeTone(tone);
  const styles = TONES[safeTone] ?? TONES.neutral;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${styles.chip}`}
    >
      <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${styles.dot}`} />
      {children}
    </span>
  );
}

export function SeverityRail({ tone }: { tone: Tone | string | null | undefined }) {
  const safeTone = normalizeTone(tone);
  const styles = TONES[safeTone] ?? TONES.neutral;
  return <span aria-hidden className={`absolute inset-y-0 left-0 w-1 rounded-l-xl ${styles.rail}`} />;
}

/** Confidence, always with its word — "High", never a bare 0.85. */
export function ConfidencePill({ band, value }: { band?: string | null; value?: number | null }) {
  const safeBand = band && typeof band === 'string' ? band : 'Medium';
  const safeValue = typeof value === 'number' && !Number.isNaN(value) ? value : null;
  const tone: Tone =
    safeBand.toLowerCase() === 'high'
      ? 'positive'
      : safeBand.toLowerCase() === 'low'
      ? 'low'
      : 'medium';
  const styles = TONES[normalizeTone(tone)] ?? TONES.medium;

  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] text-slate-600">
      <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${styles.dot}`} />
      <span className="font-semibold text-slate-700">{safeBand}</span>
      {safeValue !== null ? (
        <span className="tabular-nums text-slate-400">({safeValue.toFixed(2)})</span>
      ) : null}
    </span>
  );
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
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[color:var(--intel-accent)]">
              {eyebrow}
            </p>
          ) : null}
          <h2 className="mt-1 text-[17px] font-bold leading-tight text-slate-900">{title}</h2>
          {description ? (
            <p className="mt-1 max-w-3xl text-[13px] leading-5 text-slate-600">{description}</p>
          ) : null}
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

/**
 * A note explaining why something is absent.
 *
 * It always carries the backend's own reason rather than a generic "no data".
 * THE FALLBACK IS DELIBERATELY VAGUE — if a module reaches it, that is a bug in
 * that module's coverage reporting, and a vague sentence is easier to notice
 * than a confident wrong one.
 */
export function Unavailable({ title, reason }: { title: string; reason?: string | null }) {
  return (
    <Surface className="px-4 py-6">
      <p className="text-[13px] font-semibold text-slate-700">{title}</p>
      <p className="mt-1 max-w-2xl text-[13px] leading-5 text-slate-500">
        {reason ?? 'This module did not say why these records are unavailable.'}
      </p>
    </Surface>
  );
}

/* ------------------------------------------------------------ metric tiles */

/**
 * One analytics figure.
 *
 * `onClick` turns the tile into a drill-down. A tile that cannot be drilled
 * into stays a plain div rather than an unresponsive button, so nothing on this
 * screen looks clickable and then does nothing.
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
  tone?: Tone | string | null;
  emphasis?: boolean;
  onClick?: () => void;
  actionLabel?: string;
}) {
  const safeTone = normalizeTone(tone);
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
        <p className="mt-2 text-[12px] font-semibold text-[color:var(--intel-accent)]">
          {actionLabel ?? 'View detail'} →
        </p>
      ) : null}
    </>
  );

  const shell =
    'relative overflow-hidden rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-left shadow-[0_1px_2px_rgba(15,23,42,0.04)]';

  if (!onClick) {
    return (
      <div className={shell}>
        {safeTone !== 'neutral' ? <SeverityRail tone={safeTone} /> : null}
        {body}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`${shell} transition hover:border-[color:var(--intel-accent)]/40 hover:shadow-[0_2px_10px_var(--intel-accent-glow)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--intel-accent)]`}
    >
      {safeTone !== 'neutral' ? <SeverityRail tone={safeTone} /> : null}
      {body}
    </button>
  );
}

/* ----------------------------------------------------------- evidence grid */

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

/* ------------------------------------------------------------------ buttons */

export function AccentButton({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-2 rounded-lg bg-[color:var(--intel-accent)] px-3 py-1.5 text-[13px] font-semibold text-white transition hover:brightness-95 disabled:opacity-60"
    >
      {children}
    </button>
  );
}
