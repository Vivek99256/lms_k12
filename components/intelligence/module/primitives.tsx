'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { Inbox } from 'lucide-react';

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

/**
 * The semantic palette, and it is the ONLY place colour carries meaning.
 *
 * Pinned to the enterprise ramp so every Intelligence screen says the same
 * thing with the same hue: danger #DC2626 (red-600), warning #D97706
 * (amber-600), success #16A34A (green-600), info #2563EB (blue-600), neutral
 * #64748B (slate-500). Dots and rails sit on the 600 step so they read at 6px;
 * chips stay on the 50/200 steps so a row of them never shouts.
 *
 * A module's own accent is separate and lives on `--intel-accent`. That is
 * identity, not meaning — it colours navigation and never a status.
 */
const TONES: Record<Tone, { chip: string; dot: string; rail: string }> = {
  critical: { chip: 'bg-red-50 text-red-800 ring-red-200', dot: 'bg-red-600', rail: 'bg-red-600' },
  high: { chip: 'bg-red-50 text-red-800 ring-red-200', dot: 'bg-red-600', rail: 'bg-red-600' },
  medium: { chip: 'bg-amber-50 text-amber-900 ring-amber-200', dot: 'bg-amber-600', rail: 'bg-amber-600' },
  low: { chip: 'bg-slate-100 text-slate-700 ring-slate-200', dot: 'bg-slate-400', rail: 'bg-slate-300' },
  positive: { chip: 'bg-green-50 text-green-800 ring-green-200', dot: 'bg-green-600', rail: 'bg-green-600' },
  info: { chip: 'bg-blue-50 text-blue-800 ring-blue-200', dot: 'bg-blue-600', rail: 'bg-blue-600' },
  neutral: { chip: 'bg-slate-100 text-slate-700 ring-slate-200', dot: 'bg-slate-400', rail: 'bg-slate-300' },
};

/**
 * What a caller may legally pass as a tone.
 *
 * DELIBERATELY WIDER THAN `Tone`. The value crosses an HTTP boundary from PHP,
 * so TypeScript cannot vouch for it: twenty-two Brain controllers compute their
 * metric tones with expressions like `$x > 0 ? 'warning' : 'positive'`, and
 * thirty-nine of those branches end in a bare `null`. Declaring the parameter
 * as `Tone` did not make any of that untrue — it only moved the failure from a
 * type error to `TONES[tone].rail` throwing at render, which is what took the
 * People & Competency screens down.
 */
export type ToneInput = Tone | (string & {}) | null | undefined;

/**
 * Vocabulary the backend uses that this palette does not name.
 *
 * `warning` and `attention` both mean "a person should look at this", which is
 * exactly what `medium` renders — amber, with its word beside it. Mapping them
 * keeps the signal the controller intended instead of flattening it to grey.
 */
const TONE_ALIASES: Record<string, Tone> = {
  warning: 'medium',
  attention: 'medium',
  danger: 'high',
  error: 'high',
  success: 'positive',
  ok: 'positive',
};

/**
 * Any input to a renderable tone. TOTAL BY CONSTRUCTION — it cannot throw.
 *
 * An unrecognised tone degrades to `neutral`, because a metric drawn without
 * emphasis is a far smaller defect than a screen that will not render at all.
 */
export function resolveTone(tone: ToneInput): Tone {
  if (!tone) return 'neutral';

  const key = String(tone).trim().toLowerCase();
  if (Object.prototype.hasOwnProperty.call(TONES, key)) return key as Tone;

  return TONE_ALIASES[key] ?? 'neutral';
}

export function toneFor(severity: string | null | undefined): Tone {
  return resolveTone(severity);
}

/** Maps an outcome/result word — 'success' or 'resolved', 'partial' or 'partially_resolved', etc. */
export function toneForResult(result: string | null | undefined): Tone {
  const key = (result || '').toLowerCase();
  if (key === 'success' || key === 'resolved') return 'positive';
  if (key === 'partial' || key === 'partially_resolved') return 'medium';
  if (key === 'failed' || key === 'not_reached') return 'high';
  return 'neutral';
}

export function SeverityChip({ tone, children }: { tone: ToneInput; children: ReactNode }) {
  const styles = TONES[resolveTone(tone)];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${styles.chip}`}
    >
      <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${styles.dot}`} />
      {children}
    </span>
  );
}

export function SeverityRail({ tone }: { tone: ToneInput }) {
  return (
    <span aria-hidden className={`absolute inset-y-0 left-0 w-1 rounded-l-xl ${TONES[resolveTone(tone)].rail}`} />
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
/**
 * Why this institute-year has nothing to show, supplied once by the screen.
 *
 * WITHOUT THIS, EVERY SECTION WOULD SAY "no data" AND NONE WOULD SAY WHY. When
 * coverage is unavailable the individual blocks arrive empty with no reason of
 * their own — the reason lives on `coverage`. Threading it through a context
 * rather than through nine sets of props means a section that has its own,
 * better reason still wins, and one that has none still explains itself.
 */
const NoDataReasonContext = createContext<string | null>(null);

export function NoDataReasonProvider({
  reason,
  children,
}: {
  reason: string | null;
  children: ReactNode;
}) {
  return <NoDataReasonContext.Provider value={reason}>{children}</NoDataReasonContext.Provider>;
}

/**
 * The one empty state for every Intelligence section.
 *
 * ── DATA CAN BE EMPTY; THE INTELLIGENCE UI MUST NOT BE ──────────────────────
 *
 * A section with no rows still renders its heading, its place in the section
 * nav, and this block. It is deliberately NOT an error treatment: a tenant that
 * has not entered marks yet has done nothing wrong, and red would say it had.
 *
 * IT STILL CARRIES THE REASON. "No Data Available" alone is a dead end; the
 * line beneath it is the backend's own words — "No marks have been entered for
 * academic year 2022" — which is what tells a reader whether to change the year,
 * import data, or look somewhere else.
 */
export function NoData({
  detail,
  reason,
  hint = 'Insights appear here as soon as these records exist.',
  bare = false,
}: {
  /** What specifically is missing, e.g. "Nothing to break down for this year". */
  detail?: string | null;
  /** Why, in the backend's words. Falls back to the screen-level coverage reason. */
  reason?: string | null;
  hint?: string | null;
  /**
   * Drop the surrounding surface because a card already encloses this.
   *
   * A bordered box inside a bordered box is the single most common way an empty
   * state starts looking like a broken one — it doubles the border, doubles the
   * padding, and leaves a hollow rectangle floating in the middle of a panel.
   */
  bare?: boolean;
}) {
  const fallback = useContext(NoDataReasonContext);
  const why = reason ?? fallback;

  if (bare) {
    return (
      <div className="px-2 py-6">
        <div className="mx-auto flex max-w-md flex-col items-center text-center">
          <span
            aria-hidden
            className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400"
          >
            <Inbox className="h-5 w-5" />
          </span>
          <p className="text-[14px] font-bold leading-5 text-slate-800">No Data Available</p>
          {detail ? <p className="mt-1.5 text-[13px] leading-5 text-slate-600">{detail}</p> : null}
          {why ? <p className="mt-1 text-[12.5px] leading-5 text-slate-500">{why}</p> : null}
          {hint ? <p className="mt-2.5 text-[12px] leading-4 text-slate-400">{hint}</p> : null}
        </div>
      </div>
    );
  }

  return (
    <Surface className="px-6 py-9">
      <div className="mx-auto flex max-w-md flex-col items-center text-center">
        <span
          aria-hidden
          className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400"
        >
          <Inbox className="h-5 w-5" />
        </span>
        <p className="text-[14px] font-bold leading-5 text-slate-800">No Data Available</p>
        {detail ? <p className="mt-1.5 text-[13px] leading-5 text-slate-600">{detail}</p> : null}
        {why ? <p className="mt-1 text-[12.5px] leading-5 text-slate-500">{why}</p> : null}
        {hint ? <p className="mt-2.5 text-[12px] leading-4 text-slate-400">{hint}</p> : null}
      </div>
    </Surface>
  );
}

/**
 * Kept as the name every section already calls, now rendering the shared empty
 * state. Changing it here rather than at ten call sites is what stops the
 * sections drifting into ten slightly different ways of saying "nothing yet".
 */
export function Unavailable({ title, reason }: { title: string; reason?: string | null }) {
  return <NoData detail={title} reason={reason} />;
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
  tone,
  emphasis = false,
  onClick,
  actionLabel,
}: {
  label: string;
  value: string;
  hint?: string | null;
  tone?: ToneInput;
  emphasis?: boolean;
  onClick?: () => void;
  actionLabel?: string;
}) {
  // Resolved ONCE here rather than defaulted in the signature: a default only
  // applies to `undefined`, and the backend sends an explicit `null` on
  // thirty-nine metric branches — which would sail past the default and draw a
  // grey rail the controller never asked for.
  const resolvedTone = resolveTone(tone);

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
        {resolvedTone !== 'neutral' ? <SeverityRail tone={resolvedTone} /> : null}
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
      {resolvedTone !== 'neutral' ? <SeverityRail tone={resolvedTone} /> : null}
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
