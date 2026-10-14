'use client';

import { useCallback, useEffect, useState } from 'react';

import { actOnWorkflowRun, fetchWorkflowRuns, PlatformApiError, type WorkflowRun } from '@/lib/platform/client';

import { Card, ErrorState, formatWhen, LoadingState, Note, Pill, PlainShell, RefreshButton, SampleBadge } from '../../_components/shell';

/**
 * Platform services -> Approval requests.
 *
 * The runs the workflow engine is executing: one row per request, one step at a
 * time. Approving or rejecting calls the engine; the server decides who may.
 */

const RUN_TONE = { pending: 'amber', approved: 'green', rejected: 'red', returned: 'red' } as const;
const STEP_TONE = { waiting: 'gray', pending: 'amber', approved: 'green', rejected: 'red', skipped: 'gray', escalated: 'blue' } as const;

export default function WorkflowRunsPage() {
  const [runs, setRuns] = useState<WorkflowRun[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [comments, setComments] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState<number | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setRuns(await fetchWorkflowRuns());
    } catch (reason) {
      setError(reason instanceof PlatformApiError ? reason.message : 'Approval requests could not be loaded.');
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  async function act(run: WorkflowRun, action: 'approve' | 'reject') {
    setBusy(run.id);
    setNote(null);
    try {
      await actOnWorkflowRun(run.id, action, { comment: comments[run.id] ?? '' });
      setNote({ tone: 'ok', text: action === 'approve' ? 'Step approved.' : 'Request rejected.' });
      await load();
    } catch (reason) {
      setNote({ tone: 'error', text: reason instanceof PlatformApiError ? reason.message : 'The decision could not be saved.' });
    } finally {
      setBusy(null);
    }
  }

  return (
    <PlainShell
      title="Approval requests"
      description="Requests moving through an approval chain. Each request waits on one step at a time."
      actions={<RefreshButton onClick={() => void load()} busy={runs === null && !error} />}
    >
      {note && <Note tone={note.tone} text={note.text} onDismiss={() => setNote(null)} />}
      {error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : runs === null ? (
        <LoadingState label="Loading approval requests" />
      ) : runs.length === 0 ? (
        <Card className="p-6 text-sm text-slate-600">No approval requests yet.</Card>
      ) : (
        runs.map((run) => {
          const current = run.steps.find((step) => step.status === 'pending');
          return (
            <Card key={run.id} className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-slate-900">{run.title ?? `${run.entity_type} ${run.entity_id}`}</p>
                  <p className="text-xs text-slate-500">
                    {run.flow_key} · requested by {run.requested_by_name ?? 'unknown'} · {formatWhen(run.created_at)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <SampleBadge show={run.is_sample} />
                  <Pill tone={RUN_TONE[run.status]}>{run.status}</Pill>
                </div>
              </div>

              <ol className="mt-3 space-y-1.5">
                {run.steps.map((step) => (
                  <li key={step.id} className="flex flex-wrap items-center gap-2 text-sm text-slate-700">
                    <span className="w-5 text-xs text-slate-400">{step.order}.</span>
                    <span>{step.name}</span>
                    <Pill tone={STEP_TONE[step.status]}>{step.status}</Pill>
                    {step.acted_by_name && (
                      <span className="text-xs text-slate-500">
                        {step.acted_by_name}, {formatWhen(step.acted_at)}
                      </span>
                    )}
                    {step.comment && <span className="text-xs text-slate-500">&ldquo;{step.comment}&rdquo;</span>}
                    {step.status === 'pending' && step.due_at && <span className="text-xs text-slate-500">due {formatWhen(step.due_at)}</span>}
                  </li>
                ))}
              </ol>

              {run.status === 'pending' && current && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <input
                    value={comments[run.id] ?? ''}
                    onChange={(event) => setComments((all) => ({ ...all, [run.id]: event.target.value }))}
                    placeholder={current.require_comment ? 'Comment (required)' : 'Comment (optional)'}
                    className="min-w-[220px] flex-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm"
                    aria-label={`Comment for ${current.name}`}
                  />
                  <button
                    type="button"
                    disabled={busy === run.id}
                    onClick={() => void act(run, 'approve')}
                    className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    disabled={busy === run.id}
                    onClick={() => void act(run, 'reject')}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              )}
            </Card>
          );
        })
      )}
    </PlainShell>
  );
}
