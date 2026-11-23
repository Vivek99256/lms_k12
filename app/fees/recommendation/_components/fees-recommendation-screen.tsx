'use client';

import type { CSSProperties } from 'react';
import { AlertCircle, Loader2, RefreshCw } from 'lucide-react';

import { useBrainResource } from '@/app/enterprise-brain/_components/useBrainResource';
import { readGraphSession } from '@/app/_components/graph/graph-session';
import { Section, Surface } from '@/components/intelligence/module/primitives';
import {
  fetchFeesRecommendations,
  fetchFeesRecommendationIntelligence,
  toDisplayCard,
  type FeesRecommendationIntelligencePayload,
  type FeesRecommendationPayload,
} from '@/app/fees/recommendation/_lib/fees-recommendation-api';
import { ModuleApprovalQueue } from '@/app/_components/ai-stack/module-approval-queue';
import { FeesRecommendationCardView } from './recommendation-card';
import { AgenticStatusCard, NextBestActionCard } from './intelligence-sections';

/** The Fees module's own accent — same literal every other Fees screen uses. */
const FEES_ACCENT = '#5846EA';

/**
 * Fees → Recommendation.
 *
 * Every card on this screen is read straight from Neo4j by
 * `FeesGraphRecommendationController` — no SQL fallback, and no card is ever
 * synthesized client-side. A card that cannot be honestly answered from the
 * graph renders the shared "No Data Available" treatment with the backend's
 * own numeric reason, never a guess — see `FeesRecommendationCardView`.
 *
 * `useBrainResource` is reused as-is: it already keys the fetch on the
 * header's selected academic year and refetches on change, which this panel
 * needs exactly as much as every Brain screen does, despite this panel
 * having nothing to do with the Brain's SQL pipeline.
 */
interface FeesRecommendationScreenData {
  legacy: FeesRecommendationPayload;
  intelligence: FeesRecommendationIntelligencePayload;
}

export function FeesRecommendationScreen() {
  const { data, error, loading, refreshing, refresh, setData } = useBrainResource<FeesRecommendationScreenData>(async () => {
    const session = readGraphSession();
    const syear = session.academicYear ? String(session.academicYear) : '';

    if (!syear) {
      throw new Error('No academic year is selected.');
    }

    const [legacy, intelligence] = await Promise.all([
      fetchFeesRecommendations(syear),
      fetchFeesRecommendationIntelligence(syear),
    ]);

    return { legacy, intelligence };
  }, []);

  const style = { '--intel-accent': FEES_ACCENT, '--intel-accent-glow': `${FEES_ACCENT}1A` } as CSSProperties;

  if (loading) {
    return (
      <div style={style} className="flex items-center gap-2 px-1 py-16 text-[13px] text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Reading the fee graph…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={style} className="px-1 py-6">
        <Surface className="flex items-start gap-3 px-4 py-4">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
          <div>
            <p className="text-[13px] font-semibold text-slate-800">Fees recommendations couldn’t be loaded</p>
            <p className="mt-1 text-[13px] leading-5 text-slate-600">{error || 'The request returned nothing.'}</p>
            <div className="mt-3">
              <button
                type="button"
                onClick={refresh}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-[13px] font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                <RefreshCw className="h-4 w-4" />
                Try again
              </button>
            </div>
          </div>
        </Surface>
      </div>
    );
  }

  return (
    <div style={style} className="space-y-6 px-1 pb-12">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-[color:var(--intel-accent)]">
            Recommendation
          </p>
          <h1 className="mt-1 text-[24px] font-bold leading-tight tracking-tight text-slate-950">
            Fees —  intelligence capabilities
          </h1>
          <p className="mt-1 max-w-2xl text-[12.5px] leading-5 text-slate-500">
            Academic year {data.legacy.syear} · Cross-Module, Graph Reasoning and Predictive cards are real graph/
            signal findings or an honest reason why one isn’t available yet — never a guess.
          </p>
        </div>
        <button
          type="button"
          onClick={refresh}
          disabled={refreshing}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-[13px] font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
        >
          {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refresh
        </button>
      </header>

      {(() => {
        const coverageCard = data.legacy.cards.find((card) => card.id === 'fees.platform_coverage');
        return coverageCard ? <FeesRecommendationCardView card={toDisplayCard(coverageCard)} /> : null;
      })()}

      <Section
        eyebrow="Capability 1"
        title="Cross-Module Intelligence"
        description="Fees correlated against attendance, admissions enquiries and PAL engagement/mastery — a second module's data, not just Fees' own."
      >
        {data.intelligence.capabilities.cross_module.available ? (
          <ul className="space-y-3">
            {data.intelligence.capabilities.cross_module.cards.map((card) => (
              <li key={card.id}>
                <FeesRecommendationCardView card={toDisplayCard(card)} />
              </li>
            ))}
          </ul>
        ) : (
          <Surface className="px-4 py-4">
            <p className="text-[13px] text-slate-600">{data.intelligence.capabilities.cross_module.reason}</p>
          </Surface>
        )}
      </Section>

      <Section
        eyebrow="Capability 2"
        title="Graph Reasoning"
        description="Relationships discovered by walking/aggregating the graph — never a single direct edge."
      >
        {data.intelligence.capabilities.graph_reasoning.available ? (
          <ul className="space-y-3">
            {data.intelligence.capabilities.graph_reasoning.cards.map((card) => (
              <li key={card.id}>
                <FeesRecommendationCardView card={toDisplayCard(card)} />
              </li>
            ))}
          </ul>
        ) : (
          <Surface className="px-4 py-4">
            <p className="text-[13px] text-slate-600">{data.intelligence.capabilities.graph_reasoning.reason}</p>
          </Surface>
        )}
      </Section>

      <Section
        eyebrow="Capability 3"
        title="Predictive Intelligence"
        description="Students whose fee balance is trending worse across recorded sweeps — projected forward, not guessed."
      >
        {data.intelligence.capabilities.predictive.cards.length > 0 ? (
          <ul className="space-y-3">
            {data.intelligence.capabilities.predictive.cards.map((card) => (
              <li key={card.id}>
                <FeesRecommendationCardView card={toDisplayCard(card)} />
              </li>
            ))}
          </ul>
        ) : (
          <Surface className="px-4 py-4">
            <p className="text-[13px] text-slate-600">
              No worsening fee-payment trend has been recorded yet. This needs at least two sweeps of the
              k12_fees_predictive agent before a trend can be computed.
            </p>
          </Surface>
        )}
      </Section>

      <Section
        eyebrow="Capability 4"
        title="Recommendation Intelligence"
        description="The single most relevant next action — ranked over already-governed recommendations and cases, for one subject at a time."
      >
        <NextBestActionCard
          available={data.intelligence.capabilities.recommendation.available}
          reason={data.intelligence.capabilities.recommendation.reason}
          topPick={data.intelligence.capabilities.recommendation.top_pick}
        />
      </Section>

      <Section
        eyebrow="Capability 5"
        title="Agentic Intelligence"
        description="Operational state of the two governed Fees agents — every recommendation they draft still waits for human approval."
      >
        <AgenticStatusCard
          agentState={data.intelligence.capabilities.agentic.agent_state}
          pendingApprovalsCount={data.intelligence.capabilities.agentic.pending_approvals_count}
          onStateChange={(nextState) => {
            setData((current) =>
              current
                ? {
                    ...current,
                    intelligence: {
                      ...current.intelligence,
                      capabilities: {
                        ...current.intelligence.capabilities,
                        agentic: { ...current.intelligence.capabilities.agentic, agent_state: nextState },
                      },
                    },
                  }
                : current,
            );
          }}
        />
      </Section>

      <Section
        eyebrow="Human approval"
        title="Waiting for a person"
        description="Every recommendation FeesAgent/FeesPredictiveAgent drafts pauses here until an administrator decides — reusing the same approval queue every other module's Automations tab already uses, not a Fees-specific copy."
      >
        <div className="space-y-4">
          <ModuleApprovalQueue moduleLabel="Fees collection" workflowKey="fees_collection" onChanged={refresh} />
          <ModuleApprovalQueue moduleLabel="Fees proactive outreach" workflowKey="fees_proactive_outreach" onChanged={refresh} />
        </div>
      </Section>

      <footer className="border-t border-slate-100 pt-3 text-[11.5px] leading-5 text-slate-400">
        Generated {data.intelligence.generated_at}
      </footer>
    </div>
  );
}
