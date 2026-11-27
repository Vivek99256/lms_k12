'use client';

import { useCallback, useEffect, useState } from 'react';

import { actOnWorkflowRun, fetchWorkflowRuns, PlatformApiError, type WorkflowRun } from '@/lib/platform/client';

import { Card, ErrorState, LoadingState, Note, PlainShell, RefreshButton } from '../../_components/shell';
import { WorkflowRunCard } from '../_components/WorkflowRunCard';

/**
 * Platform services -> Approval requests.
 *
 * The runs the workflow engine is executing: one row per request, one step at a
 * time. Approving or rejecting calls the engine; the server decides who may.
 */

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
        runs.map((run) => (
          <WorkflowRunCard
            key={run.id}
            run={run}
            busy={busy === run.id}
            comment={comments[run.id] ?? ''}
            onComment={(text) => setComments((all) => ({ ...all, [run.id]: text }))}
            onAct={(action) => void act(run, action)}
          />
        ))
      )}
    </PlainShell>
  );
}
