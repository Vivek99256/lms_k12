'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  GitBranch,
  History,
  Layers,
  Loader2,
  Play,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  X,
} from 'lucide-react';

import { brainFetch, tenantPath } from '@/lib/brain/api';
import type { ModuleWorkflowsResponse, ModuleWorkflowItem, SectionCopy } from '../contract';
import { Surface, Unavailable } from '../primitives';

export function CrossModuleWorkflowSection({
  module,
  copy,
}: {
  module: string;
  copy?: SectionCopy;
}) {
  const [data, setData] = useState<ModuleWorkflowsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTrigger, setActiveTrigger] = useState<ModuleWorkflowItem | null>(null);
  const [triggering, setTriggering] = useState(false);
  const [triggerNote, setTriggerNote] = useState('');
  const [triggerMessage, setTriggerMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await brainFetch<ModuleWorkflowsResponse | { data: ModuleWorkflowsResponse }>(
        tenantPath(`/${module}/workflows`)
      );
      const payload = 'data' in response ? response.data : response;
      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load module workflows.');
    } finally {
      setLoading(false);
    }
  }, [module]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleStartWorkflow = (workflow: ModuleWorkflowItem) => {
    setActiveTrigger(workflow);
    setTriggerNote('');
    setTriggerMessage(null);
  };

  const handleConfirmTrigger = async () => {
    if (!activeTrigger) return;
    setTriggering(true);
    setTriggerMessage(null);

    try {
      const response = await brainFetch<{ status: string; data: { message: string; run_reference: string } }>(
        tenantPath(`/${module}/workflows/${encodeURIComponent(activeTrigger.key)}/trigger`),
        {
          method: 'POST',
          body: JSON.stringify({
            note: triggerNote.trim() || `Manual initiation from ${module} Intelligence screen`,
          }),
        }
      );

      const msg = response?.data?.message || 'Workflow run initiated successfully.';
      setTriggerMessage({ type: 'success', text: msg });
      // Refresh execution history
      void loadData();
    } catch (err) {
      setTriggerMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to initiate workflow.',
      });
    } finally {
      setTriggering(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-10 text-[13px] text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin text-[color:var(--intel-accent)]" />
        Reading cross-module workflow definitions and approval chains…
      </div>
    );
  }

  if (error && !data) {
    return (
      <Surface className="space-y-3 px-4 py-4">
        <div className="flex items-start gap-2 text-red-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
          <div>
            <p className="text-[13px] font-semibold">Failed to load cross-module workflows</p>
            <p className="mt-0.5 text-[12.5px] text-slate-600">{error}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={loadData}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[12.5px] font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Retry
        </button>
      </Surface>
    );
  }

  if (!data || data.workflows.length === 0) {
    return (
      <Unavailable
        title="No workflows declared for this module"
        reason={`There are currently no multi-module automated workflows registered for ${data?.module_label ?? module}.`}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header and Summary */}
      <Surface className="relative overflow-hidden p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-[color:var(--intel-accent)]">
              <GitBranch className="h-3.5 w-3.5" />
              {copy?.eyebrow ?? 'Execution'}
            </span>
            <h2 className="mt-1 text-[20px] font-bold tracking-tight text-slate-950">
              {copy?.title ?? 'Cross-Module Workflow'}
            </h2>
            <p className="mt-1 text-[13px] leading-5 text-slate-600">
              {copy?.description ??
                'Execute real multi-module workflows, enforce hierarchical approval gates, and track execution outcomes.'}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 px-4 py-2 text-right">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Available Flows</p>
              <p className="text-[16px] font-bold text-slate-900">{data.available_workflows_count}</p>
            </div>
            <button
              type="button"
              onClick={loadData}
              title="Refresh workflows"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </Surface>

      {/* Available Workflows Grid */}
      <div className="space-y-4">
        {data.workflows.map((wf) => (
          <WorkflowCard key={wf.key} workflow={wf} onTrigger={() => handleStartWorkflow(wf)} />
        ))}
      </div>

      {/* Recent Execution Runs History */}
      {data.recent_runs.length > 0 ? (
        <Surface className="p-5">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <History className="h-4 w-4 text-slate-500" />
            <h3 className="text-[14px] font-bold text-slate-900">Recent Workflow Executions</h3>
          </div>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-[12.5px]">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400">
                  <th className="pb-2 font-semibold uppercase tracking-wider">Run Reference</th>
                  <th className="pb-2 font-semibold uppercase tracking-wider">Workflow</th>
                  <th className="pb-2 font-semibold uppercase tracking-wider">Current Stage</th>
                  <th className="pb-2 font-semibold uppercase tracking-wider">Initiated By</th>
                  <th className="pb-2 font-semibold uppercase tracking-wider">Status</th>
                  <th className="pb-2 font-semibold uppercase tracking-wider">Started</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {data.recent_runs.map((run) => (
                  <tr key={run.id}>
                    <td className="py-2.5 font-mono text-[11.5px] font-bold text-slate-900">{run.run_reference}</td>
                    <td className="py-2.5 font-medium">{run.workflow_key}</td>
                    <td className="py-2.5 text-slate-600">{run.current_step ?? '—'}</td>
                    <td className="py-2.5 text-slate-600">{run.initiated_by}</td>
                    <td className="py-2.5">
                      <StatusBadge status={run.status} />
                    </td>
                    <td className="py-2.5 text-slate-500">{run.started_at ? new Date(run.started_at).toLocaleString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Surface>
      ) : null}

      {/* Confirmation & Trigger Modal */}
      {activeTrigger ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div className="flex items-center gap-2">
                <GitBranch className="h-4 w-4 text-[color:var(--intel-accent)]" />
                <h3 className="text-[15px] font-bold text-slate-900">Initiate Workflow</h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveTrigger(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Target Process</p>
                <p className="mt-0.5 text-[16px] font-bold text-slate-900">{activeTrigger.label}</p>
                <p className="mt-1 text-[13px] text-slate-600">{activeTrigger.description}</p>
              </div>

              {/* Safety Warning */}
              <div className="flex items-start gap-2.5 rounded-xl border border-blue-100 bg-blue-50/70 p-3 text-[12.5px] leading-5 text-blue-900">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                <span>
                  This workflow enforces verified approval gates across{' '}
                  <strong className="font-semibold">{activeTrigger.involved_modules.join(', ')}</strong>. No
                  irreversible action will execute without explicit sign-off from designated approvers.
                </span>
              </div>

              {/* Required Approvers Summary */}
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2">
                  Approval Gates ({activeTrigger.steps.length} stages)
                </p>
                <ol className="space-y-1.5">
                  {activeTrigger.steps.map((st) => (
                    <li key={st.step_number} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-[12.5px]">
                      <span className="font-medium text-slate-800">
                        {st.step_number}. {st.name}
                      </span>
                      <span className="text-slate-500 text-[11.5px]">
                        Approver: <strong className="text-slate-700">{st.approver}</strong> (SLA {st.sla_hours}h)
                      </span>
                    </li>
                  ))}
                </ol>
              </div>

              {/* Optional Operator Note */}
              <div>
                <label className="block text-[11.5px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  Initiation Context / Note (Optional)
                </label>
                <textarea
                  rows={2}
                  value={triggerNote}
                  onChange={(e) => setTriggerNote(e.target.value)}
                  placeholder="e.g. Initiated due to fee arrears threshold review..."
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-[13px] text-slate-900 outline-none transition focus:border-[color:var(--intel-accent)] focus:ring-2 focus:ring-[color:var(--intel-accent)]/20"
                />
              </div>

              {/* Result Notification */}
              {triggerMessage ? (
                <div
                  className={`flex items-start gap-2 rounded-xl p-3 text-[12.5px] font-medium ${
                    triggerMessage.type === 'success'
                      ? 'border border-emerald-200 bg-emerald-50 text-emerald-800'
                      : 'border border-red-200 bg-red-50 text-red-800'
                  }`}
                >
                  {triggerMessage.type === 'success' ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  ) : (
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                  )}
                  <span>{triggerMessage.text}</span>
                </div>
              ) : null}
            </div>

            <div className="flex items-center justify-end gap-2.5 border-t border-slate-100 bg-slate-50/50 px-5 py-3.5">
              <button
                type="button"
                onClick={() => setActiveTrigger(null)}
                className="rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-[13px] font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Close
              </button>

              {!triggerMessage || triggerMessage.type === 'error' ? (
                <button
                  type="button"
                  disabled={triggering}
                  onClick={handleConfirmTrigger}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[color:var(--intel-accent)] px-4 py-1.5 text-[13px] font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-50"
                >
                  {triggering ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-3.5 w-3.5 fill-current" />}
                  {triggering ? 'Initiating…' : 'Confirm & Start Workflow'}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function WorkflowCard({
  workflow,
  onTrigger,
}: {
  workflow: ModuleWorkflowItem;
  onTrigger: () => void;
}) {
  return (
    <Surface className="overflow-hidden border border-slate-200/90 p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[11px] font-bold text-slate-400">{workflow.key}</span>
            <span className="rounded bg-slate-100 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider text-slate-600">
              Subject: {workflow.subject}
            </span>
          </div>

          <h3 className="mt-1 text-[16px] font-bold text-slate-900">{workflow.label}</h3>
          <p className="mt-1 text-[13px] text-slate-600">{workflow.description}</p>
        </div>

        <button
          type="button"
          onClick={onTrigger}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[color:var(--intel-accent)] px-3.5 py-2 text-[12.5px] font-semibold text-white shadow-sm transition hover:opacity-90"
        >
          <Play className="h-3.5 w-3.5 fill-current" />
          Start Workflow
        </button>
      </div>

      {/* Involved Modules Badges */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          Involved Modules:
        </span>
        {workflow.involved_modules.map((m) => (
          <span
            key={m}
            className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700 capitalize"
          >
            <Layers className="h-2.5 w-2.5 text-slate-400" />
            {m}
          </span>
        ))}
      </div>

      {/* Step Pipeline Visualization */}
      <div className="mt-4 border-t border-slate-100 pt-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2.5">
          Execution & Approval Sequence ({workflow.steps.length} Steps)
        </p>

        <div className="flex flex-wrap items-center gap-2">
          {workflow.steps.map((step, idx) => (
            <div key={step.step_number} className="flex items-center gap-2">
              <div className="flex items-center gap-2 rounded-xl border border-slate-200/80 bg-slate-50/80 px-3 py-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[11px] font-bold text-slate-700">
                  {step.step_number}
                </span>
                <div className="min-w-0">
                  <p className="text-[12.5px] font-semibold text-slate-900 leading-tight">{step.name}</p>
                  <p className="text-[11px] text-slate-500 leading-tight mt-0.5">
                    {step.approver} · <Clock className="inline h-2.5 w-2.5" /> {step.sla_hours}h
                  </p>
                </div>
              </div>

              {idx < workflow.steps.length - 1 ? (
                <ArrowRight className="h-3.5 w-3.5 text-slate-300 shrink-0" />
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </Surface>
  );
}

function StatusBadge({ status }: { status: string }) {
  const norm = status.toLowerCase();
  if (norm === 'completed') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
        <CheckCircle2 className="h-3 w-3 text-emerald-600" />
        Completed
      </span>
    );
  }
  if (norm === 'awaiting_approval' || norm === 'pending') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-800">
        <UserCheck className="h-3 w-3 text-blue-600" />
        Awaiting Approval
      </span>
    );
  }
  if (norm === 'rejected' || norm === 'failed') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-800">
        <AlertCircle className="h-3 w-3 text-red-600" />
        {norm}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700 capitalize">
      {status}
    </span>
  );
}

