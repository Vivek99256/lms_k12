'use client';

import { useState, type CSSProperties } from 'react';
import { AlertCircle, Loader2, RefreshCw } from 'lucide-react';

import { useBrainResource } from '@/app/enterprise-brain/_components/useBrainResource';
import { Section, Surface } from '@/components/intelligence/module/primitives';
import {
  approvePalRecommendation,
  deferPalRecommendation,
  fetchPalRecommendationIntelligence,
  rejectPalRecommendation,
  runPalAgent,
  toDisplayCard,
  type PalRecommendationIntelligencePayload,
} from '@/app/pal/recommendation/_lib/pal-recommendation-api';
import { PalRecommendationCardView } from '@/app/pal/recommendation/_components/pal-recommendation-card';
import {
  GenericAgentStatusCard,
  GenericNextBestActionCard,
} from '@/app/_components/recommendation-intelligence/intelligence-sections';

/** Teach/Learn's own accent for this panel — same CSS-variable mechanism every Intelligence screen uses, distinct from Fees' violet (#5846EA). */
const PAL_ACCENT = '#0D9488';

/**
 * Teach/Learn → Recommendation.
 *
 * Mirrors `FeesRecommendationScreen`'s composition, minus the academic-year
 * requirement: PAL is not academic-year-scoped (see
 * `PalRecommendationIntelligenceController::resolveSyear` — only the reused
 * Fees academic-correlation card inside Cross-Module Intelligence needs a
 * syear at all, and it reports its own reason when none resolves). Every
 * card here is read straight from Neo4j (the coherence map) or SQL
 * (`ai_signals` / `PredictiveInterventionEngine`) by the backend — no card
 * is ever synthesized client-side.
 *
 * `useBrainResource` is reused as-is, same reasoning as Fees: it already
 * handles the loading/error/refresh lifecycle this panel needs, despite
 * keying its internal refetch on the header's academic year, which this
 * payload does not use at all.
 */
export function PalRecommendationScreen() {
  const { data, error, loading, refreshing, refresh } = useBrainResource<PalRecommendationIntelligencePayload>(
    async () => fetchPalRecommendationIntelligence(),
    [],
  );

  // Local to this screen's Agentic section only — neither GenericAgentStatusCard
  // nor its props carry an error slot, since approve/reject/defer/run are plain
  // fire-and-forget callbacks from its point of view.
  const [busyId, setBusyId] = useState<string | number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const style = { '--intel-accent': PAL_ACCENT, '--intel-accent-glow': `${PAL_ACCENT}1A` } as CSSProperties;

  const handleRunAgent = async (agentKey: string) => {
    setBusyId(agentKey);
    setActionError(null);
    try {
      await runPalAgent(agentKey);
      refresh();
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'The agent run failed.');
    } finally {
      setBusyId(null);
    }
  };

  const handleDecision = async (id: number, action: 'approve' | 'reject' | 'defer') => {
    setBusyId(id);
    setActionError(null);
    try {
      if (action === 'approve') await approvePalRecommendation(id);
      else if (action === 'reject') await rejectPalRecommendation(id);
      else await deferPalRecommendation(id);
      refresh();
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'The decision failed.');
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <div style={style} className="flex items-center gap-2 px-1 py-16 text-[13px] text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Reading the PAL coherence graph…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={style} className="px-1 py-6">
        <Surface className="flex items-start gap-3 px-4 py-4">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
          <div>
            <p className="text-[13px] font-semibold text-slate-800">PAL recommendations couldn’t be loaded</p>
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
          <h1 className="mt-1 text-[24px] font-bold leading-tight tracking-tight text-slate-950">
            Teach/Learn — PAL recommendation intelligence
          </h1>
          <p className="mt-1 max-w-2xl text-[12.5px] leading-5 text-slate-500">
            Cross-Module, Graph Reasoning and Predictive cards are real graph/signal findings or an honest reason why
            one isn’t available yet — never a guess.
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

      <Section
        eyebrow="Capability 1"
        title="Cross-Module Intelligence"
        description="PAL's weak-mastery cohort correlated against attendance and admissions enquiries, plus the Fees side's own fee+academic correlation reused verbatim — a second module's data, not just PAL's own."
      >
        {data.capabilities.cross_module.available ? (
          <ul className="space-y-3">
            {data.capabilities.cross_module.cards.map((card) => (
              <li key={card.id}>
                <PalRecommendationCardView card={toDisplayCard(card)} />
              </li>
            ))}
          </ul>
        ) : (
          <Surface className="px-4 py-4">
            <p className="text-[13px] text-slate-600">{data.capabilities.cross_module.reason}</p>
          </Surface>
        )}
      </Section>

      <Section
        eyebrow="Capability 2"
        title="Graph Reasoning Intelligence"
        description="Multi-hop reasoning over the Set Coherence Map — prerequisite closures walked in Neo4j, never a single direct edge presented as reasoning."
      >
        {data.capabilities.graph_reasoning.available ? (
          <ul className="space-y-3">
            {data.capabilities.graph_reasoning.cards.map((card) => (
              <li key={card.id}>
                <PalRecommendationCardView card={toDisplayCard(card)} />
              </li>
            ))}
          </ul>
        ) : (
          <Surface className="px-4 py-4">
            <p className="text-[13px] text-slate-600">{data.capabilities.graph_reasoning.reason}</p>
          </Surface>
        )}
      </Section>

      <Section
        eyebrow="Capability 3"
        title="Predictive Intelligence"
        description="Compounding-gap signals already flowing from the governed pal_coherence_risk agent, plus the intervention engine's disengagement/failure/burnout risk for a named learner — projected forward, never a fabricated low-risk score."
      >
        {data.capabilities.predictive.cards.length > 0 ? (
          <ul className="space-y-3">
            {data.capabilities.predictive.cards.map((card) => (
              <li key={card.id}>
                <PalRecommendationCardView card={toDisplayCard(card)} />
              </li>
            ))}
          </ul>
        ) : (
          <Surface className="px-4 py-4">
            <p className="text-[13px] text-slate-600">{data.capabilities.predictive.reason}</p>
          </Surface>
        )}
      </Section>

      <Section
        eyebrow="Capability 4"
        title="Recommendation Intelligence"
        description="The single most relevant next action — ranked over already-governed PAL recommendations and open cases, falling back to a clearly-labeled real-time coherence-map suggestion only when nothing governed exists yet."
      >
        <GenericNextBestActionCard
          available={data.capabilities.recommendation.available}
          reason={data.capabilities.recommendation.reason}
          topPick={data.capabilities.recommendation.top_pick}
        />
      </Section>

      <Section
        eyebrow="Capability 5"
        title="Agentic Intelligence"
        description="The PAL agent roster and the human approval queue behind it — every recommendation these agents draft still waits for a person to decide."
      >
        <div className="space-y-3">
          {actionError ? (
            <Surface className="px-4 py-3">
              <p className="text-[12.5px] text-red-700">{actionError}</p>
            </Surface>
          ) : null}
          <GenericAgentStatusCard
            agents={data.capabilities.agentic.agent_state}
            pendingRecommendations={data.capabilities.agentic.pending_recommendations}
            executionNote={data.capabilities.agentic.execution_note}
            onRunAgent={(agentKey) => void handleRunAgent(agentKey)}
            onApprove={(id) => void handleDecision(id, 'approve')}
            onReject={(id) => void handleDecision(id, 'reject')}
            onDefer={(id) => void handleDecision(id, 'defer')}
            busyId={busyId}
          />
        </div>
      </Section>

      <footer className="border-t border-slate-100 pt-3 text-[11.5px] leading-5 text-slate-400">
        Generated {data.generated_at}
      </footer>
    </div>
  );
}
