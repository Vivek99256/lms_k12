'use client';

import { useCallback, useMemo, useState, type CSSProperties } from 'react';
import { AlertCircle, Brain, Loader2, RefreshCw } from 'lucide-react';

import { useBrainResource } from '@/app/enterprise-brain/_components/useBrainResource';

import type { ModuleIntelligenceContract, SectionKey } from './contract';
import { timestamp } from './format';
import { AccentButton, NoDataReasonProvider, Surface } from './primitives';
import { IntelligenceSectionNav, SECTION_NAV_LABELS } from './section-nav';
import {
  BreakdownsSection,
  CrossModuleWorkflowSection,
  DataQualitySection,
  DecisionsSection,
  FindingsSection,
  LearningSection,
  ModuleIntegrationSection,
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
 * section falls back to the backend's own `reason`, so a year with no records
 * says why rather than rendering eight confident zeroes.
 *
 * DATA CAN BE EMPTY; THE INTELLIGENCE UI MUST NOT BE. `coverage.available` used
 * to gate the whole screen down to one card, which also took away the section
 * nav, Module Integration and Cross-Module Workflow. Now the nav and the
 * selected section always render, and an empty block shows the shared No Data
 * state carrying the coverage reason.
 *
 * THE ACADEMIC YEAR IS THE HEADER'S. `useBrainResource` puts the selected year
 * in its cache key and drops the previous payload when the key changes, so
 * switching 2025 → 2024 cannot leave one year's figures under another year's
 * heading.
 */
export function ModuleIntelligence({ contract }: { contract: ModuleIntelligenceContract }) {
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState('');
  /**
   * Which section is on screen. `null` means "not chosen yet", which resolves to
   * the contract's first section — a module cannot open on a section it does not
   * declare, and switching modules cannot strand the selection on a key the new
   * contract has never heard of.
   */
  const [openSection, setOpenSection] = useState<SectionKey | null>(null);

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

  /** The tabs: this module's own sections, labelled by what they already are. */
  const navSections = useMemo(
    () =>
      contract.sections.map((section) => ({
        key: section.key,
        label: SECTION_NAV_LABELS[section.key] ?? section.copy.title,
      })),
    [contract],
  );

  const activeKey =
    openSection && contract.sections.some((section) => section.key === openSection)
      ? openSection
      : contract.sections[0]?.key;

  /**
   * The module's own name, without the product word.
   *
   * Contracts label themselves "Fees Intelligence", "Result Intelligence" and
   * so on, which is right for a tab but wrong for a heading that already sits
   * under an Intelligence context chip. Stripping the suffix here means no
   * contract has to change and none can forget.
   */
  const moduleName = contract.label.replace(/\s*intelligence\s*$/i, '').trim() || contract.label;

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
        {/*
          * THE MODULE IS THE HEADING; "INTELLIGENCE" IS THE CONTEXT.
          *
          * This block used to read: a `Fees Intelligence` eyebrow, then an <h1>
          * of the ORGANISATION name, then the year. Three problems came with it.
          * The page already carries an <h1> of "Intelligence" from the category
          * bar, so there were two <h1>s. The word "Intelligence" appeared four
          * times on one screen. And the module's own name — the one thing a
          * reader needs within a second — was the smallest text on the page,
          * while the largest was the tenant's name, which never changes as you
          * move between modules and so identifies nothing.
          *
          * Now: a quiet context chip, the MODULE as the heading, and the
          * organisation demoted into the meta line beside the year it belongs
          * with. It is the page's only `h1`: the category's duplicate heading is
          * suppressed for this workspace (see module-category-page).
          */}
        <div className="min-w-0">
          <p className="inline-flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.14em] text-[color:var(--intel-accent)]">
            <Brain className="h-3.5 w-3.5" />
            Intelligence
          </p>
          <h1 className="mt-1 truncate text-[24px] font-bold leading-tight tracking-tight text-slate-950">
            {moduleName}
          </h1>
          <p className="mt-1 text-[12.5px] leading-5 text-slate-500">
            {[
              data.organization,
              data.academicYear?.syear ? `Academic year ${data.academicYear.syear}` : null,
              data.freshness?.positionLabel,
              data.freshness?.findingsRefreshedAt
                ? `findings ${timestamp(data.freshness.findingsRefreshedAt)}`
                : 'findings not computed yet',
            ]
              .filter(Boolean)
              .join(' · ')}
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

      {/*
        * ── L0 COVERAGE NO LONGER GATES THE SCREEN ──────────────────────────
        *
        * This used to short-circuit to a single "no data" card, which took the
        * section nav and every section down with it. A tenant that has not
        * entered marks yet would see a blank product rather than an Intelligence
        * screen that happened to be empty — and could not open Module
        * Integration or Cross-Module Workflow at all, even when those had
        * something to show.
        *
        * DATA CAN BE EMPTY; THE INTELLIGENCE UI MUST NOT BE. The nav and the
        * selected section always render. The coverage reason is handed to the
        * sections through NoDataReasonProvider, so each empty block explains
        * itself in the backend's own words instead of saying nothing.
        */}
      <NoDataReasonProvider
        reason={data.coverage?.available ? null : (data.coverage?.reason ?? contract.emptyState.fallbackReason)}
      >
        <>
          {/* --------------------------------------------- the section switcher */}
          <IntelligenceSectionNav
            label={contract.label}
            accent={contract.accent}
            sections={navSections}
            activeKey={activeKey ?? ''}
            onSelect={(key) => setOpenSection(key as SectionKey)}
          />

          {contract.sections
            .filter((section) => section.key === activeKey)
            .map((section) => {
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
            case 'integration':
              return (
                <ModuleIntegrationSection
                  key={section.key}
                  module={contract.key}
                  copy={section.copy}
                />
              );
            case 'workflow':
              return (
                <CrossModuleWorkflowSection
                  key={section.key}
                  module={contract.key}
                  copy={section.copy}
                />
              );
            default:
              return null;
          }
            })}
        </>
      </NoDataReasonProvider>

      {/* ------------------------------------------------------------ footer */}
      <footer className="border-t border-slate-100 pt-3 text-[11.5px] leading-5 text-slate-400">
        One row here is {contract.grain}. Source: {data.source}
        {data.execution?.note ? ` · ${data.execution.note}` : ''}
      </footer>
    </div>
  );
}
