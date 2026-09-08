'use client';

import React, { useState } from 'react';
import { ChevronDown, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { Card, cellText, humaniseKey } from './primitives';

/**
 * The one card the whole Brain speaks through.
 *
 * IT ANSWERS SEVEN QUESTIONS IN A FIXED ORDER, so a reader learns the shape once
 * and can then skim any screen: what is happening, by how much, why it matters,
 * how we know, why it is happening, what to do, and who does it.
 *
 * PROGRESSIVE DISCLOSURE IS THE POINT. Collapsed, the card is a headline, a
 * metric and one sentence — readable in about three seconds. The cause, the full
 * evidence and the technical detail are one click away. Showing everything at
 * once is what turned the previous screens into a database dump.
 *
 * NOTHING TECHNICAL SURFACES BY DEFAULT. Rule keys, classifications and table
 * names live behind "Technical detail", for whoever is debugging rather than
 * whoever is running the school.
 */

export interface IntelligenceCardModel {
  id?: string;
  severity?: string;
  severityLabel?: string;
  title: string;
  headline?: {
    value: string;
    label: string;
    change: number | null;
    changeLabel: string | null;
    direction: string;
  } | null;
  whatHappened?: string;
  whyItMatters?: string | null;
  evidence?: Array<{ label: string; value: string; note?: string }>;
  likelyCause?: string | null;
  causeConfirmed?: boolean;
  recommendation?: string | null;
  owner?: string;
  priority?: string;
  confidence?: { band: string; value: number };
  affected?: { count: number | null; total: number | null; unit: string | null };
  technical?: Record<string, unknown>;
}

const SEVERITY_STYLES: Record<string, { chip: string; rail: string }> = {
  critical: { chip: 'bg-rose-50 text-rose-700 ring-rose-200', rail: 'bg-rose-500' },
  high: { chip: 'bg-orange-50 text-orange-700 ring-orange-200', rail: 'bg-orange-500' },
  medium: { chip: 'bg-amber-50 text-amber-700 ring-amber-200', rail: 'bg-amber-400' },
  low: { chip: 'bg-slate-100 text-slate-600 ring-slate-200', rail: 'bg-slate-300' },
};

export function SeverityChip({ severity, label }: { severity?: string; label?: string }) {
  const tone = SEVERITY_STYLES[(severity || 'low').toLowerCase()] ?? SEVERITY_STYLES.low;

  return (
    <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ring-inset ${tone.chip}`}>
      {label || severity || 'Low'}
    </span>
  );
}

/** Confidence as a word. The number is available on hover, never as the label. */
export function ConfidenceChip({ band, value }: { band?: string; value?: number }) {
  if (!band) return null;

  const tone =
    band === 'High'
      ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
      : band === 'Medium'
        ? 'bg-sky-50 text-sky-700 ring-sky-200'
        : 'bg-slate-100 text-slate-500 ring-slate-200';

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${tone}`}
      title={value !== undefined ? `Computed from the supporting evidence (${value.toFixed(2)})` : undefined}
    >
      {band} confidence
    </span>
  );
}

/**
 * A movement, shown with its direction.
 *
 * `goodDirection` exists because down is not always bad: attendance falling is a
 * problem, outstanding fees falling is a win. Colouring both red would train the
 * reader to ignore the colour.
 */
export function Delta({
  change,
  label,
  unit = 'pts',
  goodDirection = 'up',
}: {
  change: number | null | undefined;
  label?: string | null;
  unit?: string;
  goodDirection?: 'up' | 'down';
}) {
  if (change === null || change === undefined || Number.isNaN(change)) {
    return label ? <span className="text-xs text-slate-400">{label}</span> : null;
  }

  const flat = Math.abs(change) < 0.05;
  const good = goodDirection === 'up' ? change > 0 : change < 0;
  const tone = flat ? 'text-slate-400' : good ? 'text-emerald-600' : 'text-rose-600';
  const Icon = flat ? Minus : change > 0 ? TrendingUp : TrendingDown;

  return (
    <span className={`inline-flex items-baseline gap-1 text-xs font-semibold ${tone}`}>
      <Icon size={13} className="translate-y-0.5" />
      <span className="tabular-nums">
        {change > 0 ? '+' : ''}
        {Number(change.toFixed(1))}
        {unit}
      </span>
      {label && <span className="font-normal text-slate-400">{label}</span>}
    </span>
  );
}

/** The labelled figures behind a finding — the answer to "how do you know?". */
export function EvidenceStrip({ evidence }: { evidence?: Array<{ label: string; value: string; note?: string }> }) {
  if (!evidence?.length) return null;

  return (
    <div className="flex flex-wrap gap-x-6 gap-y-3">
      {evidence.map((item, index) => (
        <div key={`${item.label}-${index}`} className="min-w-[5.5rem]">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{item.label}</p>
          <p className="mt-0.5 text-sm font-semibold tabular-nums text-slate-900">{item.value}</p>
          {item.note && <p className="text-[11px] text-slate-400">{item.note}</p>}
        </div>
      ))}
    </div>
  );
}

export function IntelligenceCard({
  model,
  defaultOpen = false,
  onAction,
  actionLabel,
  footer,
}: {
  model: IntelligenceCardModel;
  defaultOpen?: boolean;
  onAction?: () => void;
  actionLabel?: string;
  footer?: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [showTechnical, setShowTechnical] = useState(false);
  const rail = SEVERITY_STYLES[(model.severity || 'low').toLowerCase()]?.rail ?? SEVERITY_STYLES.low.rail;

  return (
    <Card className="overflow-hidden">
      <div className="flex">
        {/* A severity rail rather than a coloured card: the finding stays legible,
            and severity is still readable from across a room. */}
        <div className={`w-1 shrink-0 ${rail}`} aria-hidden />

        <div className="min-w-0 flex-1 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="mb-1.5 flex flex-wrap items-center gap-2">
                <SeverityChip severity={model.severity} label={model.severityLabel} />
                {model.priority && (
                  <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                    {model.priority} priority
                  </span>
                )}
                <ConfidenceChip band={model.confidence?.band} value={model.confidence?.value} />
              </div>
              <h3 className="text-[15px] font-semibold leading-snug text-slate-900">{model.title}</h3>
              {model.whatHappened && <p className="mt-1 text-sm leading-relaxed text-slate-600">{model.whatHappened}</p>}
            </div>

            {model.headline && (
              <div className="shrink-0 text-right">
                <p className="text-2xl font-semibold tabular-nums leading-none text-slate-900">{model.headline.value}</p>
                <p className="mt-1 text-[11px] text-slate-400">{model.headline.label}</p>
                <div className="mt-1">
                  <Delta change={model.headline.change} label={model.headline.changeLabel} />
                </div>
              </div>
            )}
          </div>

          {model.whyItMatters && (
            <p className="mt-3 border-l-2 border-slate-200 pl-3 text-sm leading-relaxed text-slate-500">
              <span className="font-semibold text-slate-600">Why it matters. </span>
              {model.whyItMatters}
            </p>
          )}

          {open && (
            <div className="mt-4 space-y-4 border-t border-gray-100 pt-4">
              {model.evidence?.length ? (
                <div>
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">Evidence</p>
                  <EvidenceStrip evidence={model.evidence} />
                </div>
              ) : null}

              <div>
                <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-gray-400">Likely cause</p>
                <p className="text-sm leading-relaxed text-slate-600">
                  {model.likelyCause ?? 'The cause has not been confirmed. The finding is recorded with its evidence and is waiting on a human review.'}
                </p>
              </div>

              {model.recommendation && (
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-gray-400">Recommended action</p>
                  <p className="text-sm font-medium leading-relaxed text-slate-800">{model.recommendation}</p>
                  {model.owner && (
                    <p className="mt-2 text-[11px] text-slate-500">
                      Owner: <span className="font-semibold text-slate-700">{model.owner}</span>
                    </p>
                  )}
                </div>
              )}

              {model.technical && (
                <div>
                  <button
                    type="button"
                    onClick={() => setShowTechnical((value) => !value)}
                    className="text-[11px] font-semibold text-slate-400 underline-offset-2 hover:text-slate-600 hover:underline"
                  >
                    {showTechnical ? 'Hide technical detail' : 'Technical detail'}
                  </button>
                  {showTechnical && (
                    <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 rounded-lg bg-slate-50 p-3 sm:grid-cols-3">
                      {Object.entries(model.technical).map(([key, value]) => (
                        <div key={key} className="min-w-0">
                          <dt className="text-[10px] uppercase tracking-wide text-slate-400">{humaniseKey(key)}</dt>
                          <dd className="truncate font-mono text-[11px] text-slate-600" title={cellText(value)}>
                            {cellText(value) || '—'}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </div>
              )}

              {footer}
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setOpen((value) => !value)}
              className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
            >
              {open ? 'Hide evidence' : 'View evidence'}
              <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
            {onAction && (
              <button
                type="button"
                onClick={onAction}
                className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-700"
              >
                {actionLabel ?? 'Take action'}
              </button>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

/**
 * A health dimension, with its working shown.
 *
 * The formula is always one click away, because a score whose derivation is
 * hidden is a score nobody should act on — and this is the screen most likely to
 * be quoted in a meeting.
 */
export function HealthDial({
  dimension,
}: {
  dimension: {
    key: string;
    label: string;
    available: boolean;
    score: number | null;
    band: string | null;
    headline: string | null;
    change: number | null;
    changeLabel: string | null;
    why: string;
    formula: string | null;
    drivers: Array<{ label: string; value: string }>;
    action: string | null;
  };
}) {
  const [open, setOpen] = useState(false);

  const bandTone =
    {
      Good: 'text-emerald-600',
      Watch: 'text-amber-600',
      'At risk': 'text-orange-600',
      Critical: 'text-rose-600',
    }[dimension.band ?? ''] ?? 'text-slate-400';

  const barTone =
    {
      Good: 'bg-emerald-500',
      Watch: 'bg-amber-400',
      'At risk': 'bg-orange-500',
      Critical: 'bg-rose-500',
    }[dimension.band ?? ''] ?? 'bg-slate-200';

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">{dimension.label}</p>
          {dimension.available ? (
            <p className="mt-1 flex items-baseline gap-2">
              <span className="text-3xl font-semibold tabular-nums text-slate-900">{dimension.score}</span>
              <span className="text-xs text-slate-400">/ 100</span>
              <span className={`text-xs font-bold ${bandTone}`}>{dimension.band}</span>
            </p>
          ) : (
            <p className="mt-1 text-sm font-semibold text-slate-400">Not scored</p>
          )}
        </div>
        {dimension.available && dimension.headline && (
          <div className="shrink-0 text-right">
            <p className="text-sm font-semibold tabular-nums text-slate-700">{dimension.headline}</p>
            <Delta change={dimension.change} label={dimension.changeLabel} />
          </div>
        )}
      </div>

      {dimension.available && (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div className={`h-full rounded-full ${barTone}`} style={{ width: `${Math.max(dimension.score ?? 0, 2)}%` }} />
        </div>
      )}

      <p className="mt-3 text-xs leading-relaxed text-slate-500">{dimension.why}</p>

      {dimension.action && (
        <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs font-medium leading-relaxed text-slate-700">
          {dimension.action}
        </p>
      )}

      {(dimension.drivers?.length || dimension.formula) && (
        <>
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="mt-3 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800"
          >
            {open ? 'Hide how this is calculated' : 'How is this calculated?'}
          </button>
          {open && (
            <div className="mt-2 space-y-3 rounded-lg bg-slate-50 p-3">
              {dimension.formula && <p className="text-[11px] leading-relaxed text-slate-600">{dimension.formula}</p>}
              {dimension.drivers?.length ? (
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                  {dimension.drivers.map((driver) => (
                    <div key={driver.label}>
                      <dt className="text-[10px] uppercase tracking-wide text-slate-400">{driver.label}</dt>
                      <dd className="text-xs font-semibold tabular-nums text-slate-700">{driver.value}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
            </div>
          )}
        </>
      )}
    </Card>
  );
}
