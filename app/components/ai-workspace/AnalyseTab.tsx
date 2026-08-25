'use client';

import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';

import {
  generateForContext,
  runWorkspaceAgent,
  type AgentRunOutcome,
  type WorkspaceContext,
  type WorkspaceSession,
  type WorkspaceSuggestion,
} from '@/lib/intelligence/workspace';
import type { GenerationOutcome } from '@/lib/intelligence/types';

import { GeneratedTag, SuggestionButton, TabEmptyState, TabError, TabSection } from './WorkspaceChrome';

/**
 * The "Analyse" tab — Agentic AI, in language a teacher can act on.
 *
 * An agent here does the multi-step work: pulls assessment, attendance and assignment
 * data, raises signals, gathers evidence, opens a case, explains it and drafts a
 * recommendation. What it does not do is act. The panel says so explicitly after every
 * run, because the difference between "found and proposed" and "did" is the whole
 * safety story.
 *
 * Anything the agent drafts appears in the Actions tab awaiting a decision.
 */
export function AnalyseTab({
  session,
  context,
  suggestions,
  route,
  onSeeActions,
  onGenerate,
  onCompleted,
}: {
  session: WorkspaceSession;
  context: WorkspaceContext | null;
  suggestions: WorkspaceSuggestion[];
  route: string;
  onSeeActions?: () => void;
  /** Jump to Create with a template preselected — §27's "Generate Intervention". */
  onGenerate?: (templateKey: string) => void;
  /** Lets the panel move the stage strip on once a run has written its rows. */
  onCompleted?: () => void;
}) {
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<AgentRunOutcome | null>(null);
  // A page-type analysis is prose about what is on screen, not an agent run with
  // signals and cases behind it, so it is held and rendered separately.
  const [analysis, setAnalysis] = useState<GenerationOutcome | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(suggestion: WorkspaceSuggestion) {
    if (!suggestion.action_ref) return;

    setBusyKey(suggestion.key);
    setError(null);
    setOutcome(null);
    setAnalysis(null);

    try {
      /*
       * Two kinds of action land in this tab.
       *
       * `analyse` is the page-type action: one shared template rendered against
       * whatever the page reported. That is what makes analysis available on every
       * dashboard, report and list rather than only where an agent happens to be
       * registered. It reads and interprets; it writes nothing.
       *
       * `run_agent` is a registered agent — the multi-step path that raises signals,
       * opens a case and drafts a recommendation for the Actions tab.
       */
      if (suggestion.action_type === 'analyse') {
        setAnalysis(
          await generateForContext(session, {
            route,
            template_key: suggestion.action_ref,
            entity_type: context?.entity_type ?? null,
            entity_id: context?.entity_id ?? null,
          })
        );

        return;
      }

      const result = await runWorkspaceAgent(session, suggestion.action_ref, {
        route,
        entity_type: context?.entity_type ?? null,
        entity_id: context?.entity_id ?? null,
      });

      setOutcome(result);
      // Signals, evidence, the case and any recommendation are now on disk, so the
      // stage strip has moved.
      onCompleted?.();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The analysis could not be completed.');
    } finally {
      setBusyKey(null);
    }
  }

  if (suggestions.length === 0) {
    return (
      <TabEmptyState message="There is nothing to analyse here yet — analysis works from the records or figures on the page." />
    );
  }

  const findings = Array.isArray(outcome?.result?.cases) ? outcome.result.cases : [];

  return (
    <div className="space-y-4">
      <TabSection title="Analyse">
        <div className="flex flex-col gap-1.5">
          {suggestions.map((suggestion) => (
            <SuggestionButton
              key={suggestion.key}
              label={suggestion.label}
              description={suggestion.description}
              busy={busyKey === suggestion.key}
              disabled={busyKey !== null}
              badge={
                suggestion.may_execute ? undefined : (
                  <span
                    className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700"
                    title="This can review and suggest, but cannot change anything on its own."
                  >
                    <ShieldCheck className="size-2.5" aria-hidden />
                    Suggests only
                  </span>
                )
              }
              onClick={() => void run(suggestion)}
            />
          ))}
        </div>
      </TabSection>

      {error ? <TabError message={error} /> : null}

      {/*
        A page-type analysis. Badged as a draft for the same reason generated content
        is badged everywhere else in the panel: this is the model's reading of the data
        on screen, not a recorded fact, and the two must never look alike.
      */}
      {analysis ? (
        <TabSection title="Analysis">
          <div className="rounded-2xl border border-gray-200/80 bg-white p-3.5">
            <div className="mb-2 flex items-start justify-between gap-2">
              <p className="text-[11px] font-medium text-gray-500">
                Based on what is currently on this page
              </p>
              <GeneratedTag />
            </div>
            <p className="whitespace-pre-wrap text-xs leading-6 text-gray-700">
              {typeof analysis.content === 'string'
                ? analysis.content
                : JSON.stringify(analysis.content, null, 2)}
            </p>
          </div>
        </TabSection>
      ) : null}

      {outcome ? (
        <TabSection title="Result">
          <div className="space-y-2">
            <div className="rounded-2xl border border-gray-200/80 bg-white p-3.5">
              <p className="text-xs leading-6 text-gray-700">{outcome.summary}</p>

              <dl className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1 border-t border-gray-100 pt-2.5 text-[11px]">
                <Counter label="Signals found" value={outcome.counters.signals_detected} />
                <Counter label="Evidence gathered" value={outcome.counters.evidence_collected} />
                <Counter label="Cases opened" value={outcome.counters.cases_opened} />
                <Counter label="Suggestions drafted" value={outcome.counters.recommendations_drafted} />
              </dl>
            </div>

            {findings.slice(0, 6).map((finding, index) => (
              <FindingCard
                key={index}
                finding={finding as Record<string, unknown>}
                onGenerate={onGenerate}
              />
            ))}

            {outcome.counters.recommendations_drafted > 0 ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-3">
                <p className="text-[11px] leading-5 text-amber-900">
                  <strong className="font-semibold">Nothing has been done yet.</strong>{' '}
                  {outcome.counters.recommendations_drafted} suggestion
                  {outcome.counters.recommendations_drafted === 1 ? '' : 's'} need your approval before
                  anything happens.
                </p>
                {onSeeActions ? (
                  <button
                    type="button"
                    onClick={onSeeActions}
                    className="mt-2 rounded-xl bg-[#0D6EFD] px-3 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-[#0b5ed7]"
                  >
                    Review in Actions
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        </TabSection>
      ) : null}
    </div>
  );
}

function Counter({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-gray-500">{label}</dt>
      <dd className="font-semibold tabular-nums text-gray-900">{value}</dd>
    </div>
  );
}

/**
 * One student the agent flagged, with the reason it gave. The explanation is the
 * agent's grounded narrative — if governance refused it, that refusal is shown
 * instead of a confident sentence with nothing behind it.
 */
function FindingCard({
  finding,
  onGenerate,
}: {
  finding: Record<string, unknown>;
  onGenerate?: (templateKey: string) => void;
}) {
  const explanation = finding.explanation as
    | { narrative?: string; governance_passed?: boolean; reason_refused?: string | null }
    | undefined;
  const recommendation = finding.recommendation as { title?: string } | null | undefined;
  const severity = String(finding.severity ?? 'low');

  return (
    <div className="rounded-2xl border border-gray-200/80 bg-white p-3.5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold text-gray-900">
          {String(finding.student_name ?? 'Student')}
        </p>
        <span
          className={
            severity === 'critical' || severity === 'high'
              ? 'shrink-0 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-700'
              : 'shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700'
          }
        >
          {severity}
        </span>
      </div>

      {explanation?.governance_passed === false ? (
        <p className="mt-1.5 text-[11px] leading-5 text-amber-800">
          {explanation.reason_refused ||
            'The reason could not be backed by verified evidence, so it is not shown.'}
        </p>
      ) : explanation?.narrative ? (
        <p className="mt-1.5 text-[11px] leading-5 text-gray-600">{explanation.narrative}</p>
      ) : null}

      {recommendation?.title ? (
        <div className="mt-2 border-t border-gray-100 pt-2">
          <p className="text-[11px] text-gray-500">
            Proposed: <span className="font-medium text-gray-700">{recommendation.title}</span>
          </p>

          {/*
            §27's chaining step: draft the content for the proposal before anyone is
            asked to approve it, so the decision is about something concrete.
          */}
          {onGenerate ? (
            <button
              type="button"
              onClick={() => onGenerate('k12.intervention_activity')}
              className="mt-2 rounded-xl border border-[#0D6EFD]/25 bg-white px-2.5 py-1 text-[11px] font-semibold text-[#0D6EFD] transition-colors hover:bg-blue-50"
            >
              Generate intervention content
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
