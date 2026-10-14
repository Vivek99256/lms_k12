'use client';

import { useCallback, useEffect, useState } from 'react';

import { getWorkflowRun, listPendingApprovals, listWorkflowRuns, resolveApproval } from '@/lib/intelligence/client';
import type { PendingApproval } from '@/lib/intelligence/types';
import type { WorkflowRunDetail } from '@/lib/intelligence/workspace';
import { readModuleWorkspaceSession } from '@/lib/module-ai/module-ai-stack';

/**
 * One module's approvals, read from the database through the existing approval API.
 *
 * This is `useFeesApprovals` with the workflow made a parameter, so a module's Automations
 * tab shows and decides approvals exactly the way Fees does. Fees keeps its own hook and is
 * not changed by this file.
 *
 *   pending  GET  /api/ai/approvals/pending          (workflow_approvals, status = pending)
 *   decided  GET  /api/ai/workflow-runs[/{id}]       (the same rows once decided)
 *   decide   POST /api/ai/approvals/{id}/resolve
 *
 * Nothing is cached or kept locally: a decided item leaves `pending` and enters `history`
 * only because the database says so after the reload. The backend decides who sees what —
 * pending approvals are limited to the signed-in user, their role, or unassigned ones — and
 * this hook does not widen that. Only approvals of THIS module's workflow are shown, so a
 * module never lists, and can never decide, another module's.
 */

export type Decision = 'approved' | 'rejected';

/** One decided approval, read from workflow_approvals through its run. */
export type ModuleApprovalHistoryEntry = {
  approvalId: number;
  runId: number;
  reference: string;
  workflowKey: string;
  stepKey: string | null;
  status: string;
  comment: string | null;
  decidedAt: string | null;
  runStatus: string;
  subject: string | null;
};

/** How many recent runs the history reads. One request each, so it is bounded. */
const HISTORY_RUN_LIMIT = 50;

export function humanizeKey(value: string) {
  return value.replace(/[_-]/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function useModuleApprovals(workflowKey: string, onChanged?: () => void) {
  const [pending, setPending] = useState<PendingApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [history, setHistory] = useState<ModuleApprovalHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [deciding, setDeciding] = useState<number | null>(null);
  const [flash, setFlash] = useState('');

  const loadPending = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const result = await listPendingApprovals(readModuleWorkspaceSession(), 100);
      setPending((result.approvals ?? []).filter((row) => row.workflow_key === workflowKey));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The approval queue could not be read.');
    } finally {
      setLoading(false);
    }
  }, [workflowKey]);

  // History is read, not kept: every row is a decided workflow_approvals record, reached
  // through its run so the status and the run stay one connected record.
  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    const session = readModuleWorkspaceSession();

    try {
      const list = await listWorkflowRuns(session, { workflowKey, limit: HISTORY_RUN_LIMIT });
      const details = await Promise.allSettled((list.runs ?? []).map((run) => getWorkflowRun(session, Number(run.id))));

      const entries: ModuleApprovalHistoryEntry[] = [];
      for (const outcome of details) {
        if (outcome.status !== 'fulfilled') continue;
        const run = outcome.value.run as unknown as WorkflowRunDetail & { approvals?: Array<Record<string, unknown>> };

        for (const approval of run.approvals ?? []) {
          const status = String(approval.status ?? '');
          if (status === 'pending') continue;

          entries.push({
            approvalId: Number(approval.id),
            runId: Number(run.id),
            reference: String(run.reference ?? ''),
            workflowKey: String(run.workflow_key ?? workflowKey),
            stepKey: (approval.step_key as string | null) ?? null,
            status,
            comment: (approval.comment as string | null) ?? null,
            decidedAt: (approval.decided_at as string | null) ?? null,
            runStatus: String(run.status ?? ''),
            subject: run.subject_entity_key ? `${run.subject_entity_key} #${run.subject_id}` : null,
          });
        }
      }

      entries.sort((a, b) => String(b.decidedAt ?? '').localeCompare(String(a.decidedAt ?? '')));
      setHistory(entries);
    } catch {
      // History is supplementary; the pending list is what needs a person.
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [workflowKey]);

  const reload = useCallback(async () => {
    await Promise.all([loadPending(), loadHistory()]);
  }, [loadPending, loadHistory]);

  useEffect(() => {
    // Both loads set their own loading flag as their first act; this effect only starts them.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
  }, [reload]);

  const decide = useCallback(
    async (approval: PendingApproval, decision: Decision) => {
      setDeciding(approval.id);
      setError('');

      try {
        const summary = await resolveApproval(readModuleWorkspaceSession(), approval.id, decision);
        setFlash(
          `Approval #${approval.id} ${decision}. Process status: ${humanizeKey(summary.status)}. It now shows under Approval history.`,
        );
        // Re-read from the database so the item moves only because its status changed.
        await reload();
        onChanged?.();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'The decision could not be recorded.');
      } finally {
        setDeciding(null);
      }
    },
    [reload, onChanged],
  );

  return { pending, history, loading, historyLoading, error, flash, deciding, reload, decide };
}
