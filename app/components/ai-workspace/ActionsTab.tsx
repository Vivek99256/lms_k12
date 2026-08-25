'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, CircleDashed, CircleDot, Loader2, X, XCircle } from 'lucide-react';

import {
  approveRecommendation,
  rejectRecommendation,
  resolveApproval,
} from '@/lib/intelligence/client';
import {
  fetchWorkflowStatus,
  startWorkspaceWorkflow,
  type PendingRecommendationSummary,
  type PlannedStep,
  type WorkflowRunDetail,
  type WorkspaceContext,
  type WorkspaceSession,
  type WorkspaceSuggestion,
} from '@/lib/intelligence/workspace';
import { cn } from '@/lib/utils';

import { SuggestionButton, TabEmptyState, TabError, TabSection } from './WorkspaceChrome';

/**
 * The "Actions" tab — the human approval gate and the workflow progress view.
 *
 * Two things live here because they are two halves of one idea. A recommendation is
 * something the system wants to do; a workflow run is what happened after a person
 * said yes. Putting them on separate screens would hide the causal link that makes
 * the approval meaningful.
 *
 * Approving is never implicit. The buttons are plain, the consequence is stated, and
 * the decision is recorded against the signed-in user by the backend — this component
 * only carries the click.
 */
export function ActionsTab({
  session,
  context,
  suggestions,
  pendingRecommendations,
  route,
  acceptedDraft,
  onDismissDraft,
  onChanged,
}: {
  session: WorkspaceSession;
  context: WorkspaceContext | null;
  suggestions: WorkspaceSuggestion[];
  pendingRecommendations: PendingRecommendationSummary[];
  route: string;
  /** Content the user accepted in Create, carried across for this approval. */
  acceptedDraft?: string | null;
  onDismissDraft?: () => void;
  onChanged?: () => void;
}) {
  const [runs, setRuns] = useState<WorkflowRunDetail[]>([]);
  const [loadingRuns, setLoadingRuns] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadRuns = useCallback(async () => {
    if (!context?.entity_type || context.entity_id == null) {
      setRuns([]);

      return;
    }

    setLoadingRuns(true);

    try {
      const result = await fetchWorkflowStatus(session, {
        route,
        entity_type: context.entity_type,
        entity_id: context.entity_id,
      });

      setRuns(result.runs);
    } catch {
      // Progress is supplementary; failing to load it must not hide the approvals
      // above, which are the part that needs a person.
      setRuns([]);
    } finally {
      setLoadingRuns(false);
    }
  }, [session, route, context?.entity_type, context?.entity_id]);

  useEffect(() => {
    void loadRuns();
  }, [loadRuns]);

  async function decide(id: number, decision: 'approve' | 'reject') {
    setBusyId(id);
    setError(null);
    setNotice(null);

    try {
      if (decision === 'approve') {
        const result = await approveRecommendation(
          { token: session.token, baseUrl: session.baseUrl, instituteId: session.instituteId },
          id,
          {
            startWorkflow: true,
            // Recorded on the decision, so the audit shows the teacher approved
            // the content they had actually read.
            ...(acceptedDraft
              ? { modifications: { activity_content: acceptedDraft, source: 'reviewed_in_workspace' } }
              : {}),
          }
        );

        onDismissDraft?.();

        setNotice(
          result.workflow?.status === 'awaiting_approval'
            ? 'Approved. The process has started and is waiting at its next step.'
            : 'Approved. The process has started.'
        );
      } else {
        await rejectRecommendation(
          { token: session.token, baseUrl: session.baseUrl, instituteId: session.instituteId },
          id
        );
        setNotice('Rejected. Nothing was created.');
      }

      await loadRuns();
      onChanged?.();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The decision could not be recorded.');
    } finally {
      setBusyId(null);
    }
  }

  async function start(suggestion: WorkspaceSuggestion) {
    if (!suggestion.action_ref) return;

    setBusyKey(suggestion.key);
    setError(null);
    setNotice(null);

    try {
      const result = await startWorkspaceWorkflow(session, suggestion.action_ref, {
        route,
        entity_type: context?.entity_type ?? null,
        entity_id: context?.entity_id ?? null,
      });

      setNotice(result.message);
      await loadRuns();
      onChanged?.();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The process could not be started.');
    } finally {
      setBusyKey(null);
    }
  }

  // A workflow that begins by approving a recommendation is not startable from here,
  // and saying so is clearer than showing a button that refuses.
  const startable = suggestions.filter((item) => item.trigger_type !== 'recommendation_approved');

  const nothingToShow =
    pendingRecommendations.length === 0 && runs.length === 0 && startable.length === 0;

  if (nothingToShow && !loadingRuns) {
    return (
      <TabEmptyState message="Nothing needs a decision here, and no process is running for this record." />
    );
  }

  return (
    <div className="space-y-4">
      {error ? <TabError message={error} /> : null}

      {notice ? (
        <p className="rounded-2xl border border-emerald-200 bg-emerald-50/70 px-3.5 py-2.5 text-xs leading-5 text-emerald-800">
          {notice}
        </p>
      ) : null}

      {acceptedDraft ? (
        <TabSection title="Content you accepted">
          <div className="rounded-2xl border border-[#0D6EFD]/25 bg-blue-50/50 p-3.5">
            <p className="max-h-32 overflow-y-auto whitespace-pre-wrap text-[11px] leading-5 text-gray-700">
              {acceptedDraft}
            </p>
            <div className="mt-2 flex items-center justify-between gap-2 border-t border-[#0D6EFD]/15 pt-2">
              <p className="text-[10px] text-gray-600">
                This will be attached when you approve below.
              </p>
              <button
                type="button"
                onClick={onDismissDraft}
                className="rounded-xl px-2 py-1 text-[10px] font-semibold text-gray-500 transition-colors hover:bg-white hover:text-gray-800"
              >
                Remove
              </button>
            </div>
          </div>
        </TabSection>
      ) : null}

      {pendingRecommendations.length > 0 ? (
        <TabSection title="Needs your approval">
          <div className="space-y-2">
            {pendingRecommendations.map((recommendation) => (
              <div
                key={recommendation.id}
                className="rounded-2xl border border-amber-200 bg-amber-50/50 p-3.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs font-semibold text-gray-900">{recommendation.title}</p>
                  <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                    {recommendation.risk_level} risk
                  </span>
                </div>

                <p className="mt-1 font-mono text-[10px] text-gray-500">
                  {recommendation.reference}
                </p>

                <p className="mt-2 text-[11px] leading-5 text-gray-600">
                  Approving records your decision and starts the process. Nothing happens until you do.
                </p>

                <div className="mt-2.5 flex items-center gap-2">
                  <button
                    type="button"
                    disabled={busyId !== null}
                    onClick={() => void decide(recommendation.id, 'approve')}
                    className="inline-flex items-center gap-1 rounded-xl bg-[#0D6EFD] px-3 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-[#0b5ed7] disabled:opacity-60"
                  >
                    {busyId === recommendation.id ? (
                      <Loader2 className="size-3 animate-spin" aria-hidden />
                    ) : (
                      <Check className="size-3" aria-hidden />
                    )}
                    Approve
                  </button>
                  <button
                    type="button"
                    disabled={busyId !== null}
                    onClick={() => void decide(recommendation.id, 'reject')}
                    className="inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-[11px] font-semibold text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 disabled:opacity-60"
                  >
                    <X className="size-3" aria-hidden />
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </TabSection>
      ) : null}

      {startable.length > 0 ? (
        <TabSection title="Start a process">
          <div className="flex flex-col gap-1.5">
            {startable.map((suggestion) => (
              <SuggestionButton
                key={suggestion.key}
                label={suggestion.label}
                description={suggestion.description}
                busy={busyKey === suggestion.key}
                disabled={busyKey !== null}
                onClick={() => void start(suggestion)}
              />
            ))}
          </div>
        </TabSection>
      ) : null}

      {loadingRuns ? (
        <p className="flex items-center gap-2 px-1 text-[11px] text-gray-500">
          <Loader2 className="size-3 animate-spin" aria-hidden />
          Checking progress…
        </p>
      ) : null}

      {runs.map((run) => (
        <WorkflowProgress key={run.id} run={run} session={session} onResolved={loadRuns} />
      ))}
    </div>
  );
}

/**
 * Step-by-step progress for one workflow run.
 *
 * Every step of the pinned version is listed, not just the ones that have run — a
 * progress view that only shows the past does not tell you what is coming. Completed
 * steps are ticked, the current step is marked, and the rest are shown waiting.
 */
function WorkflowProgress({
  run,
  session,
  onResolved,
}: {
  run: WorkflowRunDetail;
  session: WorkspaceSession;
  onResolved: () => void | Promise<void>;
}) {
  const { completed, total } = run.progress;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);

  // The step the workflow is parked on. Until someone answers it the run cannot
  // reach its action step, so nothing is created — this is the last gate in the
  // pipeline, and it previously had no control anywhere in the product.
  const pending = run.approvals.find((approval) => approval.status === 'pending');

  async function decideStep(decision: 'approved' | 'rejected') {
    if (!pending) return;

    setResolving(true);
    setResolveError(null);

    try {
      await resolveApproval(
        { token: session.token, baseUrl: session.baseUrl, instituteId: session.instituteId },
        pending.id,
        decision
      );
      await onResolved();
    } catch (error) {
      setResolveError(
        error instanceof Error ? error.message : 'That approval could not be resolved.'
      );
    } finally {
      setResolving(false);
    }
  }

  return (
    <TabSection title="Progress">
      <div className="rounded-2xl border border-gray-200/80 bg-white p-3.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-gray-900">
              {humanize(run.workflow_key)}
            </p>
            <p className="mt-0.5 font-mono text-[10px] text-gray-500">{run.reference}</p>
          </div>
          <StatusPill status={run.status} />
        </div>

        <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-gray-100">
          <div
            className="h-full rounded-full bg-[#0D6EFD] transition-all"
            style={{ width: `${percent}%` }}
          />
        </div>
        <p className="mt-1 text-[10px] text-gray-500">
          {completed} of {total} steps complete
        </p>

        <ol className="mt-3 space-y-2 border-t border-gray-100 pt-3">
          {run.planned_steps.map((step) => (
            <StepRow key={step.key} step={step} />
          ))}
        </ol>

        {pending ? (
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50/70 p-2.5">
            <p className="text-[11px] font-medium text-amber-900">
              Waiting on you{pending.step_key ? `: ${humanize(pending.step_key)}` : ''}
            </p>
            <p className="mt-0.5 text-[10px] leading-snug text-amber-800">
              The remaining steps cannot run until this is answered.
            </p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                disabled={resolving}
                onClick={() => void decideStep('approved')}
                className="rounded-lg bg-amber-600 px-2.5 py-1.5 text-[11px] font-medium text-white transition-colors hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {resolving ? 'Working…' : 'Approve step'}
              </button>
              <button
                type="button"
                disabled={resolving}
                onClick={() => void decideStep('rejected')}
                className="rounded-lg border border-amber-300 bg-white px-2.5 py-1.5 text-[11px] font-medium text-amber-800 transition-colors hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Reject
              </button>
            </div>
            {resolveError ? (
              <p className="mt-1.5 text-[10px] text-red-700">{resolveError}</p>
            ) : null}
          </div>
        ) : null}

        {run.error_message ? (
          <p className="mt-2.5 rounded-xl bg-red-50 px-2.5 py-2 text-[11px] leading-5 text-red-700">
            {run.error_message}
          </p>
        ) : null}
      </div>
    </TabSection>
  );
}

function StepRow({ step }: { step: PlannedStep }) {
  const done = step.status === 'completed';
  const failed = step.status === 'failed' || step.status === 'rejected';
  const waiting = step.status === 'awaiting_approval' || step.is_current;

  return (
    <li className="flex items-start gap-2.5">
      <span className="mt-0.5 shrink-0">
        {done ? (
          <Check className="size-3.5 text-emerald-600" aria-hidden />
        ) : failed ? (
          <XCircle className="size-3.5 text-red-600" aria-hidden />
        ) : waiting ? (
          <CircleDot className="size-3.5 text-[#0D6EFD]" aria-hidden />
        ) : (
          <CircleDashed className="size-3.5 text-gray-300" aria-hidden />
        )}
      </span>

      <span className="min-w-0 flex-1">
        <span
          className={cn(
            'block text-[11px] leading-5',
            done && 'text-gray-500 line-through decoration-gray-300',
            failed && 'font-medium text-red-700',
            waiting && 'font-semibold text-gray-900',
            !done && !failed && !waiting && 'text-gray-400'
          )}
        >
          {step.label}
        </span>

        {step.status === 'awaiting_approval' ? (
          <span className="mt-0.5 block text-[10px] font-medium text-amber-700">
            Waiting for approval
          </span>
        ) : step.error_message ? (
          <span className="mt-0.5 block text-[10px] text-red-600">{step.error_message}</span>
        ) : step.status === 'skipped' ? (
          <span className="mt-0.5 block text-[10px] text-gray-400">Skipped</span>
        ) : null}
      </span>
    </li>
  );
}

function StatusPill({ status }: { status: string }) {
  const tone =
    status === 'completed'
      ? 'bg-emerald-50 text-emerald-700'
      : status === 'failed' || status === 'rejected'
        ? 'bg-red-50 text-red-700'
        : status === 'awaiting_approval'
          ? 'bg-amber-50 text-amber-700'
          : 'bg-blue-50 text-[#0D6EFD]';

  return (
    <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold', tone)}>
      {humanize(status)}
    </span>
  );
}

function humanize(value: string) {
  const spaced = value.replace(/[_-]/g, ' ').trim();

  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
