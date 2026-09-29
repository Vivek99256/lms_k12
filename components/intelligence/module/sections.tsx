'use client';

import { useState, type ReactNode } from 'react';
import { Check, ChevronDown, Loader2, RefreshCw, X } from 'lucide-react';

import type { ModuleIntelligenceActions, SectionCopy } from './contract';
import { formatValue, percent, timestamp } from './format';
import {
  AccentButton,
  ConfidencePill,
  EvidenceGrid,
  MetricTile,
  Section,
  SeverityChip,
  SeverityRail,
  Surface,
  NoData,
  Unavailable,
  toneFor,
  toneForResult,
} from './primitives';
import type {
  Breakdown,
  DataQuality,
  DecisionTrailEntry,
  Finding,
  Learning,
  MetricGroup,
  ModuleIntelligencePayload,
  Priority,
  Recommendation,
  RuleStatus,
  SummaryBlock,
} from './payload';

/**
 * The eight standard sections, rendered from the canonical payload.
 *
 * Every one of these is the Fees screen's version of that section with the fee
 * nouns removed. Where Fees hard-codes "₹38.3L in play", this reads
 * `finding.impact.display` and `finding.impact.label`, so Result can say
 * "34 students affected" through the same component.
 *
 * NOTHING HERE INVENTS A NUMBER. Every figure is either a value the backend
 * sent or a string the backend composed. The only arithmetic in this file is
 * the width of a bar, which is presentation.
 */

/* ============================================================== 0. summary */

export function SummarySection({
  copy,
  summary,
  metrics,
}: {
  copy: SectionCopy;
  summary: SummaryBlock;
  metrics: MetricGroup['metrics'];
}) {
  // A screen whose summary has nothing to say still renders the summary. Returning
  // null here was what made a data-poor tenant look like a half-built product:
  // the section nav pointed at "Summary" and selecting it produced nothing at all.
  if (!summary?.available) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white px-5 py-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[color:var(--intel-accent)]">
          {copy.eyebrow}
        </p>
        <h2 className="mt-1.5 text-[17px] font-bold leading-snug tracking-tight text-slate-950">{copy.title}</h2>
        {/* `bare`: the summary panel around this is already a card. */}
        <NoData bare reason={summary?.reason} />
      </section>
    );
  }

  const sentences = summary.sentences ?? [];

  return (
    <section className="rounded-xl border border-slate-200 bg-white px-5 py-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[color:var(--intel-accent)]">
        {copy.eyebrow}
      </p>
      {summary.headline ? (
        <h2 className="mt-1.5 text-[19px] font-bold leading-snug tracking-tight text-slate-950">{summary.headline}</h2>
      ) : null}

      {/* Six is the practical maximum before the strip stops being scannable. */}
      {(metrics ?? []).length > 0 ? (
        <div className="mt-4 grid grid-cols-2 gap-3 border-y border-slate-100 py-3.5 sm:grid-cols-3 lg:grid-cols-6">
          {(metrics ?? []).slice(0, 6).map((metric) => (
            <div key={metric.key}>
              <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{metric.label}</span>
              <p className="mt-0.5 text-[15px] font-bold tabular-nums text-slate-900">
                {metric.display ?? formatValue(metric.value, metric.format, metric.currency)}
              </p>
            </div>
          ))}
        </div>
      ) : null}

      <ul className="mt-3.5 space-y-1.5">
        {sentences.map((sentence, index) => (
          <li key={index} className="flex gap-2.5 text-[13.5px] leading-6 text-slate-700">
            <span aria-hidden className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-slate-400" />
            <span>{sentence}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ============================================================= 1. position */

export function PositionSection({
  copy,
  position,
  extras,
}: {
  copy: SectionCopy;
  position: MetricGroup | null;
  extras?: ReactNode;
}) {
  return (
    <Section eyebrow={copy.eyebrow} title={copy.title} description={copy.description}>
      {!position?.available || (position.metrics ?? []).length === 0 ? (
        <Unavailable title="Position unavailable for this year" reason={position?.reason} />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {position.metrics.map((metric, index) => (
            <MetricTile
              key={metric.key}
              label={metric.label}
              value={metric.display ?? formatValue(metric.value, metric.format, metric.currency)}
              hint={metric.hint}
              tone={metric.tone}
              emphasis={index === 0}
            />
          ))}
        </div>
      )}
      {extras}
    </Section>
  );
}

/* =========================================================== 2. breakdowns */

/**
 * One slice of the module, as a table with the magnitude drawn inline.
 *
 * A BAR AND A NUMBER, NOT A CHART LIBRARY. The bar is a div whose width is a
 * share of the largest row — it needs no runtime, degrades to a readable table
 * when printed, and cannot misrepresent a scale it does not have. Modules that
 * genuinely need a plotted series attach it as an extra card.
 */
function BreakdownTable({ breakdown }: { breakdown: Breakdown }) {
  const columns = breakdown.columns ?? [];
  const rows = breakdown.rows ?? [];

  const primary = breakdown.primaryColumn
    ? columns.find((column) => column.key === breakdown.primaryColumn)
    : null;

  const maxValue = primary
    ? rows.reduce((max, row) => {
        const value = row.values?.[primary.key];
        return value !== null && value !== undefined && Number.isFinite(value) ? Math.max(max, Math.abs(value)) : max;
      }, 0)
    : 0;

  return (
    <Surface className="overflow-hidden">
      <div className="border-b border-slate-100 px-4 py-3">
        <p className="text-[13.5px] font-bold text-slate-900">{breakdown.label}</p>
        {breakdown.description ? (
          <p className="mt-0.5 text-[12px] leading-4 text-slate-500">{breakdown.description}</p>
        ) : null}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/60">
              <th className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                {rows.length} rows
              </th>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className="px-4 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500"
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const primaryValue = primary ? row.values?.[primary.key] : null;
              const share =
                primary && maxValue > 0 && primaryValue !== null && primaryValue !== undefined
                  ? Math.abs(primaryValue) / maxValue
                  : 0;

              return (
                <tr key={row.key} className="border-b border-slate-50 last:border-0">
                  <td className="px-4 py-2.5">
                    <p className="text-[13px] font-semibold text-slate-800">{row.label}</p>
                    {row.note ? <p className="mt-0.5 text-[11.5px] text-slate-500">{row.note}</p> : null}
                    {primary ? (
                      <div aria-hidden className="mt-1.5 h-1 w-full max-w-[220px] rounded-full bg-slate-100">
                        <div
                          className="h-1 rounded-full bg-[color:var(--intel-accent)]"
                          style={{ width: `${Math.round(share * 100)}%` }}
                        />
                      </div>
                    ) : null}
                  </td>
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className="whitespace-nowrap px-4 py-2.5 text-right text-[13px] font-semibold tabular-nums text-slate-900"
                    >
                      {formatValue(row.values?.[column.key] ?? null, column.format, column.currency)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Surface>
  );
}

export function BreakdownsSection({
  copy,
  breakdowns,
  extras,
}: {
  copy: SectionCopy;
  breakdowns: Breakdown[];
  extras?: ReactNode;
}) {
  return (
    <Section eyebrow={copy.eyebrow} title={copy.title} description={copy.description}>
      {(breakdowns ?? []).length === 0 ? (
        <Unavailable title="Nothing to break down for this year" reason={null} />
      ) : (
        <div className="space-y-3">
          {breakdowns.map((breakdown) =>
            breakdown.available && (breakdown.rows ?? []).length > 0 ? (
              <BreakdownTable key={breakdown.key} breakdown={breakdown} />
            ) : (
              <Unavailable key={breakdown.key} title={breakdown.label} reason={breakdown.reason} />
            ),
          )}
        </div>
      )}
      {extras}
    </Section>
  );
}

/* ============================================================= 3. findings */

function FindingCard({ finding }: { finding: Finding }) {
  const [open, setOpen] = useState(false);
  const tone = toneFor(finding.severity);
  const evidence = finding.evidence ?? [];

  return (
    <Surface className="relative overflow-hidden">
      <SeverityRail tone={tone} />
      <div className="py-4 pl-5 pr-4">
        <div className="flex flex-wrap items-center gap-2">
          <SeverityChip tone={tone}>{finding.severityLabel ?? finding.severity ?? 'Notice'}</SeverityChip>
          <ConfidencePill band={finding.confidence?.band} value={finding.confidence?.value} />
          {finding.impact ? (
            <span className="text-[12px] text-slate-500">
              <span className="font-semibold text-slate-700">{finding.impact.display}</span> {finding.impact.label}
            </span>
          ) : null}
        </div>

        <h3 className="mt-2 text-[15.5px] font-bold leading-snug text-slate-900">{finding.title}</h3>
        <p className="mt-1.5 text-[13.5px] leading-6 text-slate-700">{finding.whatHappened}</p>

        {finding.whyItMatters ? (
          <div className="mt-3 rounded-lg border-l-2 border-[color:var(--intel-accent)]/40 bg-slate-50 px-3 py-2">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Why it matters</p>
            <p className="mt-0.5 text-[13px] leading-5 text-slate-700">{finding.whyItMatters}</p>
          </div>
        ) : null}

        {evidence.length > 0 ? (
          <div className="mt-3">
            <button
              type="button"
              onClick={() => setOpen((value) => !value)}
              className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-slate-600 hover:text-slate-900"
            >
              <ChevronDown className={`h-3.5 w-3.5 transition ${open ? 'rotate-180' : ''}`} />
              {open ? 'Hide' : 'Show'} the {evidence.length} figures behind this
            </button>
            {open ? (
              <div className="mt-2.5">
                <EvidenceGrid points={evidence} />
              </div>
            ) : null}
          </div>
        ) : null}

        {/* A cause the engine has NOT confirmed is labelled as a candidate, in
            words. Presenting a hypothesis as a conclusion is the fastest way to
            lose a reader's trust in every other finding on the page. */}
        {finding.likelyCause ? (
          <p className="mt-3 text-[12.5px] leading-5 text-slate-600">
            <span className="font-semibold text-slate-700">
              {finding.causeConfirmed ? 'Confirmed cause: ' : 'Possible cause, not confirmed: '}
            </span>
            {finding.likelyCause}
          </p>
        ) : null}
      </div>
    </Surface>
  );
}

/**
 * Which checks ran, and which fired.
 *
 * MAKES SILENCE READABLE: without this, "two findings" looks identical whether
 * the other checks passed or never ran.
 */
function RuleStatusPanel({ ruleStatus }: { ruleStatus: RuleStatus[] }) {
  const raised = ruleStatus.filter((rule) => rule.raised).length;
  const checked = ruleStatus.filter((rule) => rule.checked).length;

  return (
    <Surface className="mt-3 px-4 py-3">
      <p className="text-[12px] font-semibold text-slate-700">
        {checked} of {ruleStatus.length} checks ran against this year’s records · {raised} raised a finding
      </p>
      <ul className="mt-2 flex flex-wrap gap-1.5">
        {ruleStatus.map((rule) => (
          <li
            key={rule.key}
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11.5px] ring-1 ring-inset ${
              rule.raised
                ? 'bg-amber-50 text-amber-900 ring-amber-200'
                : rule.checked
                  ? 'bg-slate-50 text-slate-600 ring-slate-200'
                  : 'bg-white text-slate-400 ring-slate-200'
            }`}
          >
            {rule.label}
            <span className="font-semibold">{rule.raised ? 'raised' : rule.checked ? 'clear' : 'not run'}</span>
          </li>
        ))}
      </ul>
    </Surface>
  );
}

export function FindingsSection({
  copy,
  findings,
  ruleStatus,
  freshness,
  onRecompute,
  running,
  extras,
}: {
  copy: SectionCopy;
  findings: Finding[];
  ruleStatus: RuleStatus[];
  freshness: ModuleIntelligencePayload['freshness'];
  onRecompute?: () => void;
  running: boolean;
  extras?: ReactNode;
}) {
  const raised = findings ?? [];
  const rules = ruleStatus ?? [];

  return (
    <Section eyebrow={copy.eyebrow} title={copy.title} description={copy.description}>
      {raised.length === 0 ? (
        <Surface className="px-4 py-6">
          <p className="text-[13px] font-semibold text-slate-700">
            {freshness.findingsRefreshedAt
              ? 'Nothing met the evidence threshold for this year'
              : 'Findings have not been computed for this year yet'}
          </p>
          <p className="mt-1 max-w-2xl text-[13px] leading-5 text-slate-500">
            {freshness.findingsRefreshedAt
              ? 'Every check below ran against this year’s records and none found enough evidence to raise a finding.'
              : 'Run the analysis to evaluate this year’s records against the checks below.'}
          </p>
          {!freshness.findingsRefreshedAt && onRecompute ? (
            <div className="mt-3">
              <AccentButton onClick={onRecompute} disabled={running}>
                {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Analyse this year
              </AccentButton>
            </div>
          ) : null}
        </Surface>
      ) : (
        <ul className="space-y-3">
          {raised.map((finding) => (
            <li key={finding.id}>
              <FindingCard finding={finding} />
            </li>
          ))}
        </ul>
      )}

      {rules.length > 0 ? <RuleStatusPanel ruleStatus={rules} /> : null}
      {extras}
    </Section>
  );
}

/* =========================================================== 4. priorities */

export function PrioritiesSection({
  copy,
  priorities,
  extras,
}: {
  copy: SectionCopy;
  priorities: Priority[];
  extras?: ReactNode;
}) {
  return (
    <Section eyebrow={copy.eyebrow} title={copy.title} description={copy.description}>
      {(priorities ?? []).length === 0 ? (
        <Unavailable
          title="Nothing is flagged for attention this year"
          reason="No finding reached the severity or evidence threshold that puts it in front of a person."
        />
      ) : (
        <ul className="space-y-3">
          {priorities.map((priority) => {
            const tone = toneFor(priority.severity);
            return (
              <li key={priority.id}>
                <Surface className="relative overflow-hidden">
                  <SeverityRail tone={tone} />
                  <div className="py-4 pl-5 pr-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <SeverityChip tone={tone}>{priority.severityLabel ?? priority.severity ?? 'Notice'}</SeverityChip>
                      <ConfidencePill band={priority.confidence?.band} value={priority.confidence?.value} />
                      {priority.impact ? (
                        <span className="text-[12px] text-slate-500">
                          <span className="font-semibold text-slate-700">{priority.impact.display}</span>{' '}
                          {priority.impact.label}
                        </span>
                      ) : null}
                      <span className="text-[12px] text-slate-500">Owner: {priority.owner}</span>
                    </div>

                    <h3 className="mt-2 text-[15.5px] font-bold leading-snug text-slate-900">{priority.title}</h3>
                    <p className="mt-1.5 text-[13.5px] leading-6 text-slate-700">{priority.whatHappened}</p>

                    {priority.nextStep ? (
                      <p className="mt-2.5 text-[13px] leading-5 text-slate-700">
                        <span className="font-semibold">Next step: </span>
                        {priority.nextStep}
                      </p>
                    ) : null}

                    {(priority.evidence ?? []).length > 0 ? (
                      <div className="mt-3">
                        <EvidenceGrid points={priority.evidence ?? []} />
                      </div>
                    ) : null}
                  </div>
                </Surface>
              </li>
            );
          })}
        </ul>
      )}
      {extras}
    </Section>
  );
}

/* ====================================================== 5. recommendations */

function RecommendationCard({
  recommendation,
  onDecide,
}: {
  recommendation: Recommendation;
  onDecide?: ModuleIntelligenceActions['decide'];
}) {
  const [rationale, setRationale] = useState('');
  const [pending, setPending] = useState<'approved' | 'rejected' | null>(null);
  const [error, setError] = useState('');

  const decide = async (verdict: 'approved' | 'rejected') => {
    if (!onDecide) return;
    setPending(verdict);
    setError('');
    try {
      await onDecide(recommendation.id, verdict, rationale);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The decision could not be recorded.');
    } finally {
      setPending(null);
    }
  };

  return (
    <Surface className="px-4 py-4">
      <div className="flex flex-wrap items-center gap-2">
        <SeverityChip tone={toneFor(recommendation.priority)}>{recommendation.priority ?? 'Medium'}</SeverityChip>
        <ConfidencePill band={recommendation.confidence?.band} value={recommendation.confidence?.value} />
        <span className="text-[12px] text-slate-500">{recommendation.category}</span>
        {!recommendation.actionable ? (
          <span className="text-[12px] font-semibold text-slate-500">Review only — nothing executable attached</span>
        ) : null}
      </div>

      <h3 className="mt-2 text-[15px] font-bold leading-snug text-slate-900">{recommendation.title}</h3>
      <p className="mt-1.5 text-[13.5px] leading-6 text-slate-700">{recommendation.description}</p>

      <p className="mt-2 text-[12.5px] text-slate-500">
        In response to: <span className="font-semibold text-slate-700">{recommendation.finding.title}</span>
      </p>

      {recommendation.expectedImpact ? (
        <p className="mt-1.5 text-[12.5px] text-slate-600">
          <span className="font-semibold text-slate-700">Expected: </span>
          {recommendation.expectedImpact.wording}
          <span className="text-slate-400"> · basis: {recommendation.expectedImpact.basis}</span>
        </p>
      ) : null}

      {recommendation.decision ? (
        <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2">
          <p className="text-[12px] font-semibold text-slate-700">
            {recommendation.decision.status} by {recommendation.decision.decidedBy}
            {timestamp(recommendation.decision.decidedAt) ? ` · ${timestamp(recommendation.decision.decidedAt)}` : ''}
          </p>
          {recommendation.decision.rationale ? (
            <p className="mt-0.5 text-[12.5px] leading-5 text-slate-600">{recommendation.decision.rationale}</p>
          ) : null}
        </div>
      ) : onDecide ? (
        <div className="mt-3 space-y-2">
          {/* The rationale is required, and that is deliberate: a decision with
              no reason recorded is worthless to the person reading the ledger
              next year, which is the whole point of keeping one. */}
          <textarea
            value={rationale}
            onChange={(event) => setRationale(event.target.value)}
            rows={2}
            placeholder="Why are you approving or rejecting this? Recorded against your name."
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px] text-slate-800 outline-none focus:border-[color:var(--intel-accent)]"
          />
          <div className="flex flex-wrap items-center gap-2">
            <AccentButton onClick={() => void decide('approved')} disabled={!rationale.trim() || pending !== null}>
              {pending === 'approved' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Approve
            </AccentButton>
            <button
              type="button"
              onClick={() => void decide('rejected')}
              disabled={!rationale.trim() || pending !== null}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-[13px] font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
            >
              {pending === 'rejected' ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
              Reject
            </button>
            {!rationale.trim() ? (
              <span className="text-[12px] text-slate-500">A reason is required before either action.</span>
            ) : null}
          </div>
          {error ? <p className="text-[12.5px] text-red-700">{error}</p> : null}
        </div>
      ) : null}
    </Surface>
  );
}

export function RecommendationsSection({
  copy,
  recommendations,
  onDecide,
  extras,
}: {
  copy: SectionCopy;
  recommendations: Recommendation[];
  onDecide?: ModuleIntelligenceActions['decide'];
  extras?: ReactNode;
}) {
  return (
    <Section eyebrow={copy.eyebrow} title={copy.title} description={copy.description}>
      {(recommendations ?? []).length === 0 ? (
        <Unavailable
          title="No recommendations for this year"
          reason="A recommendation is only raised from a finding, and no finding this year has reached one."
        />
      ) : (
        <ul className="space-y-3">
          {recommendations.map((recommendation) => (
            <li key={recommendation.id}>
              <RecommendationCard recommendation={recommendation} onDecide={onDecide} />
            </li>
          ))}
        </ul>
      )}
      {extras}
    </Section>
  );
}

/* ============================================================ 6. decisions */

const OUTCOME_WORDING: Record<DecisionTrailEntry['outcomeState'], string> = {
  resolved: 'Resolved',
  partially_resolved: 'Partly resolved',
  not_reached: 'Did not reach the intended result',
  undetermined: 'Outcome recorded but not measured',
  awaiting_outcome: 'Carried out, waiting for someone to report back',
  no_action_queued: 'Approved, nothing queued yet',
};

/**
 * An outcome word this build does not know.
 *
 * THE FALLBACK SAYS SO RATHER THAN GUESSING. A backend that adds a seventh
 * outcome state must not be able to crash the ledger, and it must not be
 * silently relabelled as one of the six either — "Resolved" against an entry
 * that was not resolved is a worse failure than an unfamiliar word.
 */
function outcomeWording(state: DecisionTrailEntry['outcomeState']): string {
  return OUTCOME_WORDING[state] ?? 'Outcome state not recognised by this screen';
}

export function DecisionsSection({
  copy,
  decisionTrail,
  extras,
}: {
  copy: SectionCopy;
  decisionTrail: DecisionTrailEntry[];
  extras?: ReactNode;
}) {
  return (
    <Section eyebrow={copy.eyebrow} title={copy.title} description={copy.description}>
      {(decisionTrail ?? []).length === 0 ? (
        <Unavailable
          title="No decision has been recorded for this year"
          reason="Approving a recommendation above writes the first entry here."
        />
      ) : (
        <ul className="space-y-3">
          {decisionTrail.map((entry) => (
            <li key={entry.decisionId}>
              <Surface className="px-4 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <SeverityChip tone={toneForResult(entry.outcome?.result ?? entry.outcomeState)}>
                    {outcomeWording(entry.outcomeState)}
                  </SeverityChip>
                  <span className="text-[12px] text-slate-500">
                    {entry.status} by {entry.decidedBy}
                    {timestamp(entry.decidedAt) ? ` · ${timestamp(entry.decidedAt)}` : ''}
                  </span>
                </div>

                <h3 className="mt-2 text-[14.5px] font-bold text-slate-900">{entry.recommendation.title}</h3>
                <p className="mt-1 text-[12.5px] text-slate-500">In response to: {entry.finding}</p>

                {entry.rationale ? (
                  <p className="mt-2 text-[13px] leading-5 text-slate-700">
                    <span className="font-semibold">Rationale: </span>
                    {entry.rationale}
                  </p>
                ) : null}

                {entry.execution ? (
                  <p className="mt-2 text-[12.5px] leading-5 text-slate-600">
                    <span className="font-semibold text-slate-700">Carried out: </span>
                    {entry.execution.action} · {entry.execution.owner} · {entry.execution.status}
                  </p>
                ) : null}

                {entry.outcome ? (
                  <div className="mt-2.5 rounded-lg bg-slate-50 px-3 py-2">
                    <p className="text-[12.5px] leading-5 text-slate-700">
                      <span className="font-semibold">What happened: </span>
                      {entry.outcome.feedback}
                    </p>
                    {/* Measured figures are optional, and their absence is
                        stated rather than filled with a zero — a zero would
                        make the ledger claim the action moved nothing. */}
                    {entry.outcome.measured ? (
                      <p className="mt-1 text-[12px] tabular-nums text-slate-600">
                        {entry.outcome.measured.basis}: {entry.outcome.measured.before} →{' '}
                        {entry.outcome.measured.after} ({entry.outcome.measured.change >= 0 ? '+' : ''}
                        {entry.outcome.measured.change})
                      </p>
                    ) : (
                      <p className="mt-1 text-[12px] text-slate-500">Nobody recorded a measured before/after.</p>
                    )}
                  </div>
                ) : null}
              </Surface>
            </li>
          ))}
        </ul>
      )}
      {extras}
    </Section>
  );
}

/* ========================================================= 7. data quality */

export function DataQualitySection({
  copy,
  dataQuality,
  extras,
}: {
  copy: SectionCopy;
  dataQuality: DataQuality;
  extras?: ReactNode;
}) {
  return (
    <Section eyebrow={copy.eyebrow} title={copy.title} description={copy.description}>
      {!dataQuality?.available || (dataQuality.checks ?? []).length === 0 ? (
        <Unavailable title="Record checks are unavailable" reason={dataQuality?.reason} />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {dataQuality.checks.map((check) => (
            <Surface key={check.key} className="relative overflow-hidden px-4 py-3.5">
              {check.state === 'attention' ? <SeverityRail tone="medium" /> : null}
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{check.label}</p>
                <SeverityChip tone={check.state === 'attention' ? 'medium' : 'positive'}>
                  {check.state === 'attention' ? 'Review' : 'Clear'}
                </SeverityChip>
              </div>
              <p className="mt-1.5 text-[20px] font-bold tabular-nums leading-7 text-slate-900">
                {formatValue(check.value, check.format)}
                {check.secondary ? (
                  <span className="ml-2 text-[13px] font-semibold text-slate-500">
                    {formatValue(check.secondary.value, check.secondary.format, check.secondary.currency)}
                  </span>
                ) : null}
              </p>
              {check.sharePercent !== null && check.sharePercent !== undefined ? (
                <p className="mt-0.5 text-[12px] text-slate-500">
                  {percent(check.sharePercent)} {check.shareLabel ?? 'of the total'}
                </p>
              ) : null}
              <p className="mt-1.5 text-[12px] leading-4 text-slate-500">{check.note}</p>
            </Surface>
          ))}
        </div>
      )}
      {extras}
    </Section>
  );
}

/* ============================================================= 8. learning */

export function LearningSection({
  copy,
  learning,
  extras,
}: {
  copy: SectionCopy;
  learning: Learning;
  extras?: ReactNode;
}) {
  return (
    <Section eyebrow={copy.eyebrow} title={copy.title} description={copy.description}>
      {!learning?.available || (learning.entries ?? []).length === 0 ? (
        <Unavailable title="Nothing learnt yet" reason={learning?.reason} />
      ) : (
        <ul className="space-y-3">
          {learning.entries.map((entry, index) => (
            <li key={`${entry.recordedAt}-${index}`}>
              <Surface className="px-4 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <SeverityChip tone={toneForResult(entry.result)}>{entry.result}</SeverityChip>
                  <span className="text-[12px] text-slate-500">
                    {entry.syear ? `Academic year ${entry.syear}` : 'Year not recorded'}
                    {entry.appliesToThisYear ? ' · this year' : ''}
                  </span>
                </div>
                <h3 className="mt-2 text-[14.5px] font-bold text-slate-900">{entry.action}</h3>
                <p className="mt-1 text-[12.5px] text-slate-500">In response to: {entry.finding}</p>
                {entry.feedback ? (
                  <p className="mt-2 text-[13px] leading-5 text-slate-700">
                    <span className="font-semibold">What happened: </span>
                    {entry.feedback}
                  </p>
                ) : null}
              </Surface>
            </li>
          ))}
        </ul>
      )}
      {extras}
    </Section>
  );
}

/* ======================================================= 9. & 10. integration & workflow */

export { ModuleIntegrationSection } from './sections/ModuleIntegrationSection';
export { CrossModuleWorkflowSection } from './sections/CrossModuleWorkflowSection';

