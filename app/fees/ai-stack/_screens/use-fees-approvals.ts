'use client';

import { useCallback, useEffect, useState } from 'react';

import { getWorkflowRun, listPendingApprovals, listWorkflowRuns, resolveApproval } from '@/lib/intelligence/client';
import type { PendingApproval } from '@/lib/intelligence/types';
import type { WorkflowRunDetail } from '@/lib/intelligence/workspace';
import { readModuleWorkspaceSession } from '@/lib/module-ai/module-ai-stack';

/**
 * Every Fees approval, read from the database through the existing approval API.
 *
 *   pending  GET  /api/ai/approvals/pending          (workflow_approvals, status = pending)
 *   decided  GET  /api/ai/workflow-runs[/{id}]       (the same rows once decided)
 *   decide   POST /api/ai/approvals/{id}/resolve
 *
 * Shared by the Automations queue and the chatbot's Actions tab so both show one
 * answer. Nothing is cached or kept locally: a decided item leaves `pending` and
 * enters `history` only because the database says so after the reload.
 *
 * The backend decides who sees what: pending approvals are limited to the signed-in
 * user, their role, or unassigned ones. This hook does not widen that.
 */

/** The workflow "Review pending fees" starts (backend: FeesAgent::WORKFLOW_KEY). */
export const FEES_WORKFLOW_KEY = 'fees_collection';

export type Decision = 'approved' | 'rejected';

/** One decided approval, read from workflow_approvals through its run. */
export type FeesApprovalHistoryEntry = {
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

export function useFeesApprovals() {
  const [pending, setPending] = useState<PendingApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [history, setHistory] = useState<FeesApprovalHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [deciding, setDeciding] = useState<number | null>(null);
  const [flash, setFlash] = useState('');

  const loadPending = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const result = await listPendingApprovals(readModuleWorkspaceSession(), 100);
      setPending((result.approvals ?? []).filter((row) => row.workflow_key === FEES_WORKFLOW_KEY));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The approval queue could not be read.');
    } finally {
      setLoading(false);
    }
  }, []);

  // History is read, not kept: every row is a decided workflow_approvals record,
  // reached through its run so the status and the run stay one connected record.
  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    const session = readModuleWorkspaceSession();

    try {
      const list = await listWorkflowRuns(session, { workflowKey: FEES_WORKFLOW_KEY, limit: HISTORY_RUN_LIMIT });
      const details = await Promise.allSettled((list.runs ?? []).map((run) => getWorkflowRun(session, Number(run.id))));

      const entries: FeesApprovalHistoryEntry[] = [];
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
            workflowKey: String(run.workflow_key ?? FEES_WORKFLOW_KEY),
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
  }, []);

  const reload = useCallback(async () => {
    await Promise.all([loadPending(), loadHistory()]);
  }, [loadPending, loadHistory]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const decide = useCallback(
    async (approval: PendingApproval, decision: Decision) => {
      setDeciding(approval.id);
      setError('');

      try {
        const summary = await resolveApproval(readModuleWorkspaceSession(), approval.id, decision);
        setFlash(
          `Approval #${approval.id} ${decision}. Process status: ${humanizeKey(summary.status)}. It now shows under Approved / decided.`,
        );
        // Re-read from the database so the item moves only because its status changed.
        await reload();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'The decision could not be recorded.');
      } finally {
        setDeciding(null);
      }
    },
    [reload],
  );

  return { pending, history, loading, historyLoading, error, flash, deciding, reload, decide };
}
