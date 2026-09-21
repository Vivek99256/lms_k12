'use client';

import { useCallback, useMemo, useState, type CSSProperties } from 'react';
import { AlertCircle, Brain, Loader2, RefreshCw } from 'lucide-react';

import { useBrainResource } from '@/app/enterprise-brain/_components/useBrainResource';

import type { ModuleIntelligenceContract, SectionKey } from './contract';
import { timestamp } from './format';
import { AccentButton, Surface, Unavailable } from './primitives';
import {
  BreakdownsSection,
  DataQualitySection,
  DecisionsSection,
  FindingsSection,
  LearningSection,
  PositionSection,
  PrioritiesSection,
  RecommendationsSection,
  SummarySection,
} from './sections';

/**
 * The one Intelligence screen, rendered from a module's contract.
 *
 * ── WHAT THIS REPLACES ──────────────────────────────────────────────────────
 *
 * The alternative was forty copies of `fees-intelligence-screen.tsx`. This is
 * the same screen with the fee nouns moved into data, so adding Result
 * Intelligence is a contract file and a three-line route, not 3,600 lines of
 * React that will drift from the other thirty-nine the first time anyone
 * changes a severity colour.
 *
 * ── WHAT IT REFUSES TO DO ───────────────────────────────────────────────────
 *
 * IT NEVER RENDERS A FIGURE THE BACKEND DID NOT SEND. There is no client-side
 * aggregation here, no "total" computed from rows, no derived rate. If a number
 * should appear, the endpoint that knows the grain computes it. The only
 * arithmetic in this whole directory is the width of a bar.
 *
 * IT NEVER SHOWS A SECTION AS EMPTY WHEN IT IS ACTUALLY UNCHECKED. Every
 * section falls back to the backend's own `reason`, and `coverage.available`
 * gates the entire screen — so a year with no records says why, rather than
 * rendering eight confident zeroes.
 *
 * THE ACADEMIC YEAR IS THE HEADER'S. `useBrainResource` puts the selected year
 * in its cache key and drops the previous payload when the key changes, so
 * switching 2025 → 2024 cannot leave one year's figures under another year's
 * heading.
 */
export function ModuleIntelligence({ contract }: { contract: ModuleIntelligenceContract }) {
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState('');

  const { data, error, loading, refreshing, refresh } = useBrainResource(
    () => contract.load(),
    [contract.key],
  );

  const recompute = useCallback(async () => {
    if (!contract.actions?.run) return;
    setRunning(true);
    setRunError('');
    try {
      await contract.actions.run();
      refresh();
    } catch (err) {
      setRunError(err instanceof Error ? err.message : 'The analysis could not be run.');
    } finally {
      setRunning(false);
    }
  }, [contract, refresh]);

  const decide = useMemo(() => {
    const handler = contract.actions?.decide;
    if (!handler) return undefined;
    return async (recommendationId: string, verdict: 'approved' | 'rejected', rationale: string) => {
      await handler(recommendationId, verdict, rationale);
      refresh();
    };
  }, [contract, refresh]);

  /** Extra cards, grouped by the section they hang off. */
  const extrasBySection = useMemo(() => {
    const grouped = new Map<SectionKey, ModuleIntelligenceContract['extraCards']>();
    for (const card of contract.extraCards ?? []) {
      const existing = grouped.get(card.section) ?? [];
      grouped.set(card.section, [...existing, card]);
    }
    return grouped;
  }, [contract]);

  const style = {
    '--intel-accent': contract.accent,
    '--intel-accent-glow': `${contract.accent}1A`,
  } as CSSProperties;

  if (loading) {
    return (
      <div style={style} className="flex items-center gap-2 px-1 py-16 text-[13px] text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Reading this year’s {contract.nouns.plural}…
      </div>
    );
  }

  // An error is SURFACED, never swallowed into an empty result: a screen showing
  // "no rows" when the request actually failed is the single worst outcome here,
  // because it looks like an answer.
  if (error || !data) {
    return (
      <div style={style} className="px-1 py-6">
        <Surface className="flex items-start gap-3 px-4 py-4">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
          <div>
            <p className="text-[13px] font-semibold text-slate-800">{contract.label} could not be loaded</p>
            <p className="mt-1 text-[13px] leading-5 text-slate-600">{error || 'The request returned nothing.'}</p>
            <div className="mt-3">
              <AccentButton onClick={refresh}>
                <RefreshCw className="h-4 w-4" />
                Try again
              </AccentButton>
            </div>
          </div>
        </Surface>
      </div>
    );
  }

  const renderExtras = (section: SectionKey) => {
    const cards = extrasBySection.get(section);
    if (!cards || cards.length === 0) return null;
    return (
      <div className="space-y-3">
        {cards.map((card) => (
          <div key={card.key}>{card.render(data.extras ?? {}, data)}</div>
        ))}
      </div>
    );
  };

  // `?.metrics?.` on both hops: a module whose endpoint predates the canonical
  // shape can send `position` without `metrics`, and a summary strip is not
  // worth taking the whole screen down for.
  const summaryMetrics = contract.summaryMetrics
    ? contract.summaryMetrics
        .map((key) => data.position?.metrics?.find((metric) => metric.key === key))
        .filter((metric): metric is NonNullable<typeof metric> => Boolean(metric))
    : (data.position?.metrics ?? []).slice(0, 6);

  return (
    <div style={style} className="space-y-6 px-1 pb-12">
      {/* ------------------------------------------------------------ header */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[color:var(--intel-accent)]">
            <Brain className="h-3.5 w-3.5" />
            {contract.label}
          </p>
          <h1 className="mt-1 text-[22px] font-bold leading-tight tracking-tight text-slate-950">
            {data.organization}
          </h1>
          <p className="mt-1 text-[12.5px] leading-5 text-slate-500">
            Academic year {data.academicYear?.syear ?? 'not selected'} · {data.freshness?.positionLabel}
            {data.freshness?.findingsRefreshedAt
              ? ` · findings ${timestamp(data.freshness.findingsRefreshedAt)}`
              : ' · findings not computed yet'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={refresh}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-[13px] font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
          >
            {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </button>
          {/* A module whose rules are not registered in IntelligencePipeline has
              nothing to run, so the button is absent rather than offering an
              action that silently does nothing. */}
          {contract.actions?.run ? (
            <AccentButton onClick={() => void recompute()} disabled={running}>
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
              Analyse this year
            </AccentButton>
          ) : null}
        </div>
      </header>

      {runError ? (
        <Surface className="flex items-start gap-3 px-4 py-3">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
          <p className="text-[13px] leading-5 text-slate-700">{runError}</p>
        </Surface>
      ) : null}

      {/* ---------------------------------------------- L0: the coverage gate */}
      {!data.coverage?.available ? (
        <Unavailable
          title={contract.emptyState.title}
          reason={data.coverage?.reason ?? contract.emptyState.fallbackReason}
        />
      ) : (
        contract.sections.map((section) => {
          const extras = renderExtras(section.key);

          switch (section.key) {
            case 'summary':
              return (
                <SummarySection
                  key={section.key}
                  copy={section.copy}
                  summary={data.summary}
                  metrics={summaryMetrics}
                />
              );
            case 'position':
              return (
                <PositionSection key={section.key} copy={section.copy} position={data.position} extras={extras} />
              );
            case 'breakdowns':
              return (
                <BreakdownsSection
                  key={section.key}
                  copy={section.copy}
                  breakdowns={data.breakdowns}
                  extras={extras}
                />
              );
            case 'findings':
              return (
                <FindingsSection
                  key={section.key}
                  copy={section.copy}
                  findings={data.findings}
                  ruleStatus={data.ruleStatus}
                  freshness={data.freshness}
                  onRecompute={contract.actions?.run ? () => void recompute() : undefined}
                  running={running}
                  extras={extras}
                />
              );
            case 'priorities':
              return (
                <PrioritiesSection key={section.key} copy={section.copy} priorities={data.priorities} extras={extras} />
              );
            case 'recommendations':
              return (
                <RecommendationsSection
                  key={section.key}
                  copy={section.copy}
                  recommendations={data.recommendations}
                  onDecide={decide}
                  extras={extras}
                />
              );
            case 'decisions':
              return (
                <DecisionsSection
                  key={section.key}
                  copy={section.copy}
                  decisionTrail={data.decisionTrail}
                  extras={extras}
                />
              );
            case 'dataQuality':
              return (
                <DataQualitySection
                  key={section.key}
                  copy={section.copy}
                  dataQuality={data.dataQuality}
                  extras={extras}
                />
              );
            case 'learning':
              return <LearningSection key={section.key} copy={section.copy} learning={data.learning} extras={extras} />;
            default:
              return null;
          }
        })
      )}

      {/* ------------------------------------------------------------ footer */}
      <footer className="border-t border-slate-100 pt-3 text-[11.5px] leading-5 text-slate-400">
        One row here is {contract.grain}. Source: {data.source}
        {data.execution?.note ? ` · ${data.execution.note}` : ''}
      </footer>
    </div>
  );
}
