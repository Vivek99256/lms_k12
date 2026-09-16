'use client';

import type { ReactNode } from 'react';

/**
 * Presentation primitives for the Fees Intelligence screen.
 *
 * Kept local to this screen rather than added to components/ui: every one of
 * these encodes a rule about how INTELLIGENCE is presented — an unknown is
 * shown as an em dash and never as zero, a severity carries a word as well as a
 * colour — and those rules would be wrong on a general-purpose card. Nothing
 * here changes any shared component, so no other screen moves.
 *
 * The visual language is the Fees module's own: white surfaces, hairline slate
 * borders, 8px radii, the indigo #5846EA accent already used by the Fees
 * category tabs. No gradients beyond one restrained hero wash, no glass.
 */

/* ------------------------------------------------------------- formatting */

const inrCompact = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 1 });
const inrFull = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

/**
 * Indian money at a glance: ₹38.3L, ₹1.2Cr, ₹42,101.
 *
 * Matches App\Brain\Intelligence\Narrative::money() on the backend, so a figure
 * rendered from a payload string and the same figure rendered from a number
 * read identically on one screen.
 */
export function money(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || !Number.isFinite(amount)) return '—';
  if (Math.abs(amount) >= 10000000) return `₹${inrCompact.format(amount / 10000000)}Cr`;
  if (Math.abs(amount) >= 100000) return `₹${inrCompact.format(amount / 100000)}L`;
  return inrFull.format(amount);
}

/** Exact rupees, for tooltips and drill-downs where the rounded form is not enough. */
export function moneyExact(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || !Number.isFinite(amount)) return '—';
  return inrFull.format(amount);
}

/**
 * A percentage, or an em dash.
 *
 * NULL IS NOT ZERO. A collection rate over no demand is undefined; rendering it
 * as "0%" would report catastrophic performance where there is simply no
 * denominator, and that single substitution is the most common way an honest
 * pipeline turns into a misleading dashboard.
 */
export function percent(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return `${value >= 10 ? Math.round(value) : Number(value.toFixed(digits))}%`;
}

export function count(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('en-IN').format(value);
}

/* ---------------------------------------------------------------- severity */

export type Tone = 'critical' | 'high' | 'medium' | 'low' | 'positive' | 'neutral' | 'info';

/**
 * Colour is never the only carrier — every tone below ships with a word beside
 * it at the call site, and red is reserved for genuine risk.
 */
const TONES: Record<Tone, { chip: string; dot: string; rail: string }> = {
  critical: { chip: 'bg-red-50 text-red-800 ring-red-200', dot: 'bg-red-500', rail: 'bg-red-500' },
  high: { chip: 'bg-red-50 text-red-800 ring-red-200', dot: 'bg-red-500', rail: 'bg-red-500' },
  medium: { chip: 'bg-amber-50 text-amber-900 ring-amber-200', dot: 'bg-amber-500', rail: 'bg-amber-500' },
  low: { chip: 'bg-slate-100 text-slate-700 ring-slate-200', dot: 'bg-slate-400', rail: 'bg-slate-300' },
  positive: { chip: 'bg-emerald-50 text-emerald-800 ring-emerald-200', dot: 'bg-emerald-500', rail: 'bg-emerald-500' },
  info: { chip: 'bg-indigo-50 text-indigo-800 ring-indigo-200', dot: 'bg-indigo-500', rail: 'bg-indigo-500' },
  neutral: { chip: 'bg-slate-100 text-slate-700 ring-slate-200', dot: 'bg-slate-400', rail: 'bg-slate-300' },
};

export function toneFor(severity: string): Tone {
  const key = (severity || '').toLowerCase();
  if (key === 'critical' || key === 'high' || key === 'medium' || key === 'low') return key;
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
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#5846EA]">{eyebrow}</p>
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

/**
 * A note explaining why something is absent.
 *
 * Used everywhere a section has nothing to show, and it always carries the
 * backend's own reason rather than a generic "no data" — "no students are
 * enrolled for this year" and "collection has not been recorded" are different
 * problems with different answers.
 */
export function Unavailable({ title, reason }: { title: string; reason?: string | null }) {
  return (
    <Surface className="px-4 py-6">
      <p className="text-[13px] font-semibold text-slate-700">{title}</p>
      {reason ? <p className="mt-1 max-w-2xl text-[13px] leading-5 text-slate-500">{reason}</p> : null}
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
        <p className="mt-2 text-[12px] font-semibold text-[#5846EA]">{actionLabel ?? 'View detail'} →</p>
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
      className={`${shell} transition hover:border-[#C7C0F7] hover:shadow-[0_2px_10px_rgba(88,70,234,0.10)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5846EA]`}
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

/** Confidence, always with its word — "High", never a bare 0.85. */
export function ConfidencePill({ band, value }: { band: string; value: number }) {
  const tone: Tone = band === 'High' ? 'positive' : band === 'Medium' ? 'medium' : 'low';

  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] text-slate-600">
      <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${TONES[tone].dot}`} />
      <span className="font-semibold text-slate-700">{band}</span>
      <span className="tabular-nums text-slate-400">({value.toFixed(2)})</span>
    </span>
  );
}
