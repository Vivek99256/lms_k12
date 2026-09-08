'use client';

import React, { useCallback, useState } from 'react';
import { RefreshCw, ShieldCheck } from 'lucide-react';
import {
  completeExecution,
  decideRecommendation,
  fetchAutomation,
  fetchRecommendations,
  type BrainRecommendation,
  type BrainRow,
} from '@/lib/brain/api';
import { useBrainResource } from '../_components/useBrainResource';
import { Card, DataTable, ErrorState, LoadingState, MetricTiles, HeroHeader } from '../_components/primitives';
import { ConfidenceMeter } from '../_components/charts';

/**
 * Automation: the executable half of the loop, and the gate in front of it.
 *
 * NOTHING HERE RUNS ITSELF, AND THE SCREEN SAYS SO RATHER THAN IMPLYING
 * OTHERWISE. Every ESO ships at trust level "suggest" and lists "human" as its
 * only permitted executor class, because no executor in this installation has an
 * execution history to justify more. So this page is where a person approves a
 * recommendation, and where they report back on what actually happened.
 *
 * THE REPORT-BACK IS WHAT CLOSES THE LOOP. An outcome row is the only way the
 * Brain ever finds out whether a family of recommendation works in this
 * organization; without it the engine proposes forever and never learns. That is
 * why "record outcome" sits next to the execution rather than being an
 * afterthought on another screen.
 */
export default function AutomationPage() {
  const automation = useBrainResource(fetchAutomation, []);
  const recommendations = useBrainResource(() => fetchRecommendations({ status: 'pending' }), []);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const refreshBoth = useCallback(async () => {
    await Promise.all([automation.refresh(), recommendations.refresh()]);
  }, [automation, recommendations]);

  const decide = useCallback(
    async (rec: BrainRecommendation, status: 'approved' | 'rejected') => {
      const rationale = window.prompt(
        `${status === 'approved' ? 'Approve' : 'Reject'} — why? This is recorded against your LMS user as the decision rationale.`,
        status === 'approved' ? 'Confirmed against the source records; proceeding.' : 'Not a priority this term.',
      );
      if (!rationale?.trim()) return;

      setBusy(rec.id);
      setNote(null);
      try {
        const result = await decideRecommendation(rec.id, status, rationale.trim());
        setNote(
          result.executionId
            ? `Decision recorded and execution ${result.executionId.slice(0, 8)} queued. Report the outcome once the work is done.`
            : `Decision recorded (${result.status}).`,
        );
        await refreshBoth();
      } catch (cause) {
        setNote(cause instanceof Error ? cause.message : 'The decision could not be recorded.');
      } finally {
        setBusy(null);
      }
    },
    [refreshBoth],
  );

  const complete = useCallback(
    async (execution: BrainRow) => {
      const result = window.prompt('Outcome — type success, partial or failed:', 'success');
      if (!result || !['success', 'partial', 'failed'].includes(result.trim())) return;
      const feedback = window.prompt('What actually happened? (recorded as the outcome feedback)', '') ?? '';

      setBusy(String(execution.id));
      setNote(null);
      try {
        await completeExecution(String(execution.id), result.trim(), feedback);
        setNote('Outcome recorded — the loop is closed for this decision.');
        await refreshBoth();
      } catch (cause) {
        setNote(cause instanceof Error ? cause.message : 'The outcome could not be recorded.');
      } finally {
        setBusy(null);
      }
    },
    [refreshBoth],
  );

  if (automation.loading && !automation.data) return <LoadingState label="Reading automation" />;
  if (automation.error && !automation.data) return <ErrorState message={automation.error} onRetry={automation.refresh} />;
  if (!automation.data) return null;

  const data = automation.data;
  const pending = recommendations.data?.data ?? [];

  return (
    <div className="p-6">
      <HeroHeader
        breadcrumb="Enterprise Brain · Automation"
        title="Automation"
        description="Standard operations derived from the approved remedies, the policy that governs them, and the decisions and outcomes recorded against them."
        actions={
          <button
            type="button"
            onClick={refreshBoth}
            disabled={automation.refreshing || recommendations.refreshing}
            className="flex items-center gap-2 rounded-xl border border-slate-600 bg-slate-800 px-3 py-2 text-xs font-bold text-slate-300 transition-colors hover:border-slate-500 hover:text-white disabled:opacity-60"
          >
            <RefreshCw size={14} className={(automation.refreshing || recommendations.refreshing) ? 'animate-spin' : ''} />
            Refresh
          </button>
        }
      />

      <MetricTiles metrics={data.metrics} />

      {note && <div className="mb-5 rounded-xl border border-indigo-200 bg-indigo-50/70 px-4 py-3 text-sm text-indigo-900">{note}</div>}

      {data.policies.map((policy) => (
        <Card key={String(policy.id)} className="mb-6 border-emerald-200/70 bg-emerald-50/30 p-5">
          <div className="flex items-start gap-3">
            <ShieldCheck size={18} className="mt-0.5 shrink-0 text-emerald-600" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900">{String(policy.name)}</p>
              <p className="text-xs text-slate-500">
                Scope <span className="font-mono">{String(policy.scope)}</span> · executors{' '}
                {(policy.allowed_executor_classes as string[] | undefined)?.join(', ') || '—'} · trust levels{' '}
                {(policy.trust_levels as string[] | undefined)?.join(', ') || '—'}
              </p>
              <ul className="mt-2 space-y-1">
                {((policy.rules as string[] | undefined) ?? []).map((rule) => (
                  <li key={rule} className="text-xs leading-relaxed text-slate-600">
                    • {rule}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      ))}

      <h2 className="mb-3 text-sm font-semibold tracking-tight text-slate-800">
        Recommendations awaiting a decision <span className="font-normal text-slate-400">({pending.length})</span>
      </h2>
      <div className="mb-8 space-y-3">
        {pending.map((rec) => (
          <Card key={rec.id} className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-indigo-700">
                    {rec.category}
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{rec.priority} priority</span>
                  {rec.eso_code && <span className="font-mono text-[10px] text-slate-400">{rec.eso_code}</span>}
                  <ConfidenceMeter value={rec.confidence} />
                </div>
                <p className="mt-2 text-sm font-medium text-slate-900">{rec.title}</p>
                <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-slate-500">{rec.description}</p>
                {rec.impact && <p className="mt-1.5 text-[11px] text-slate-400">Impact: {rec.impact}</p>}
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  disabled={busy === rec.id}
                  onClick={() => decide(rec, 'approved')}
                  className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  Approve
                </button>
                <button
                  type="button"
                  disabled={busy === rec.id}
                  onClick={() => decide(rec, 'rejected')}
                  className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-600 hover:border-gray-300 disabled:opacity-60"
                >
                  Reject
                </button>
              </div>
            </div>
          </Card>
        ))}
        {!pending.length && (
          <Card className="p-8">
            <p className="text-sm text-slate-400">
              Nothing awaiting a decision. Recommendations appear here once the Intelligence Loop has reasoned over a signal.
            </p>
          </Card>
        )}
      </div>

      <h2 className="mb-3 text-sm font-semibold tracking-tight text-slate-800">
        Executions <span className="font-normal text-slate-400">({data.executions.length})</span>
      </h2>
      <Card className="mb-8 overflow-hidden">
        <DataTable
          columns={[
            { key: 'status', label: 'Status' },
            { key: 'executor_type', label: 'Executor' },
            { key: 'executed_by', label: 'By' },
            { key: 'created_date', label: 'Authorised' },
            { key: 'completed_date', label: 'Completed' },
          ]}
          rows={data.executions}
          emptyMessage="No executions. One is queued when a recommendation with an ESO is approved."
          onRowClick={(row) => {
            if (String(row.status) === 'queued') complete(row);
          }}
        />
        {data.executions.some((row) => String(row.status) === 'queued') && (
          <p className="border-t border-gray-100 px-4 py-2.5 text-[11px] text-slate-400">
            Select a queued execution to record its outcome.
          </p>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 text-sm font-semibold tracking-tight text-slate-800">
            Decisions <span className="font-normal text-slate-400">({data.decisions.length})</span>
          </h2>
          <Card className="overflow-hidden">
            <DataTable
              columns={[
                { key: 'status', label: 'Status' },
                { key: 'decided_by_name', label: 'Decided by' },
                { key: 'rationale', label: 'Rationale' },
                { key: 'created_date', label: 'When' },
              ]}
              rows={data.decisions}
              emptyMessage="No decisions recorded yet."
            />
          </Card>
        </div>
        <div>
          <h2 className="mb-3 text-sm font-semibold tracking-tight text-slate-800">
            Outcomes <span className="font-normal text-slate-400">({data.outcomes.length})</span>
          </h2>
          <Card className="overflow-hidden">
            <DataTable
              columns={[
                { key: 'result', label: 'Result' },
                { key: 'feedback', label: 'Feedback' },
                { key: 'confidence', label: 'Confidence' },
                { key: 'created_date', label: 'When' },
              ]}
              rows={data.outcomes}
              emptyMessage="No outcomes yet — record one against a queued execution to close the loop."
            />
          </Card>
        </div>
      </div>

      <h2 className="mb-3 mt-8 text-sm font-semibold tracking-tight text-slate-800">
        Standard operations <span className="font-normal text-slate-400">({data.esos.length})</span>
      </h2>
      <Card className="overflow-hidden">
        <DataTable
          columns={[
            { key: 'eso_code', label: 'Code' },
            { key: 'name', label: 'Operation' },
            { key: 'objective', label: 'Objective' },
            { key: 'trust_level', label: 'Trust level' },
            { key: 'provenance', label: 'Provenance' },
            { key: 'status', label: 'Status' },
          ]}
          rows={data.esos}
          emptyMessage="No standard operations defined."
          maxHeight="32rem"
        />
      </Card>
    </div>
  );
}
