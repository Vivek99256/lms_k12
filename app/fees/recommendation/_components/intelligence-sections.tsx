'use client';

import { useState } from 'react';
import { Loader2, Pause, Play, RefreshCw } from 'lucide-react';

import { NoData, SeverityChip, SeverityRail, resolveTone } from '@/components/intelligence/module/primitives';
import type { FeesAgentState, FeesNextBestActionPick } from '@/app/fees/recommendation/_lib/fees-recommendation-api';
import {
  runFeesAgentNow,
  setFeesAgentInterval,
  startFeesAgentMonitoring,
  stopFeesAgentMonitoring,
} from '@/app/fees/recommendation/_lib/fees-recommendation-api';

/**
 * Recommendation Intelligence's "top pick" — a single ranked action for one
 * subject, not a list of findings, so it gets its own small card rather than
 * `FeesRecommendationCardView` (built for the honesty-ladder finding shape).
 * Still follows the same rule: an honest "nothing to recommend" reason when
 * `topPick` is null, never a placeholder.
 */
export function NextBestActionCard({
  available,
  reason,
  topPick,
}: {
  available: boolean;
  reason: string | null;
  topPick: FeesNextBestActionPick | null;
}) {
  if (!available || !topPick) {
    return (
      <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <SeverityRail tone="low" />
        <div className="pl-4">
          <NoData bare detail="No next action to show" reason={reason} hint={null} />
        </div>
      </div>
    );
  }

  const tone = resolveTone(topPick.risk_level);

  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <SeverityRail tone={tone} />
      <div className="py-4 pl-5 pr-4">
        <div className="flex flex-wrap items-center gap-2">
          {topPick.risk_level ? <SeverityChip tone={tone}>{topPick.risk_level}</SeverityChip> : null}
          <span className="text-[12px] text-slate-500">
            {topPick.source === 'recommendation' ? 'Governed recommendation' : 'Open case (no recommendation yet)'}
          </span>
        </div>

        <h3 className="mt-2 text-[15.5px] font-bold leading-snug text-slate-900">{topPick.title}</h3>

        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-4">
          {topPick.confidence !== null ? (
            <div className="rounded-lg bg-slate-50 px-3 py-2">
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Confidence</dt>
              <dd className="mt-0.5 text-[14px] font-bold tabular-nums text-slate-900">{topPick.confidence.toFixed(2)}</dd>
            </div>
          ) : null}
          {topPick.evidence_ids.length > 0 ? (
            <div className="rounded-lg bg-slate-50 px-3 py-2">
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Evidence cited</dt>
              <dd className="mt-0.5 text-[14px] font-bold tabular-nums text-slate-900">{topPick.evidence_ids.length}</dd>
            </div>
          ) : null}
          {topPick.workflow_key ? (
            <div className="rounded-lg bg-slate-50 px-3 py-2">
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Workflow</dt>
              <dd className="mt-0.5 text-[13px] font-bold text-slate-900">{topPick.workflow_key}</dd>
            </div>
          ) : null}
          <div className="rounded-lg bg-slate-50 px-3 py-2">
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Status</dt>
            <dd className="mt-0.5 text-[13px] font-bold text-slate-900">{topPick.status}</dd>
          </div>
        </dl>

        {topPick.evidence_records && topPick.evidence_records.length > 0 ? (
          <ul className="mt-3 space-y-1 text-[12.5px] leading-5 text-slate-600">
            {topPick.evidence_records.map((record) => (
              <li key={record.id} className="flex items-start gap-1.5">
                <span>·</span>
                <span>
                  {record.summary}
                  {!record.verified ? <span className="ml-1.5 text-amber-600">(not verified)</span> : null}
                </span>
              </li>
            ))}
          </ul>
        ) : null}

        {topPick.requires_approval ? (
          <p className="mt-3 text-[12px] text-slate-500">Requires human approval before anything executes.</p>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Agentic Intelligence's operational state and controls — start/stop
 * continuous monitoring, run a sweep now, and change the interval, all
 * against the real `/api/ai/fees/agent/*` routes (FeesAgentController).
 * Those routes are admin-only on the backend (AdministratorCheck); a
 * non-admin caller sees the backend's own refusal message rather than a
 * silently disabled button, since the frontend has no reliable way to know
 * in advance whether this specific caller is a true administrator.
 */
export function AgenticStatusCard({
  agentState,
  pendingApprovalsCount,
  onStateChange,
}: {
  agentState: FeesAgentState;
  pendingApprovalsCount: number;
  /** Called with the fresh state after a control action succeeds, so the parent screen can update without a full page refetch. */
  onStateChange?: (next: FeesAgentState) => void;
}) {
  const [busy, setBusy] = useState<'start' | 'stop' | 'run' | 'interval' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [intervalInput, setIntervalInput] = useState(String(agentState.interval_seconds));

  const tone = agentState.is_active ? 'positive' : 'low';

  const run = async (action: 'start' | 'stop' | 'run' | 'interval', task: () => Promise<{ state: FeesAgentState }>) => {
    setBusy(action);
    setError(null);
    try {
      const { state } = await task();
      onStateChange?.(state);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The request failed.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <SeverityRail tone={tone} />
      <div className="py-4 pl-5 pr-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <SeverityChip tone={tone}>{agentState.is_active ? 'active' : 'paused'}</SeverityChip>
            <span className="text-[12px] text-slate-500">k12_fees + k12_fees_predictive</span>
          </div>

          <div className="flex items-center gap-2">
            {agentState.is_active ? (
              <button
                type="button"
                onClick={() => void run('stop', stopFeesAgentMonitoring)}
                disabled={busy !== null}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[12.5px] font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
              >
                {busy === 'stop' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Pause className="h-3.5 w-3.5" />}
                Stop
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void run('start', () => startFeesAgentMonitoring(Number(intervalInput) || agentState.interval_seconds))}
                disabled={busy !== null}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[color:var(--intel-accent)] px-3 py-1.5 text-[12.5px] font-semibold text-white transition disabled:opacity-60"
              >
                {busy === 'start' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                Start
              </button>
            )}
            <button
              type="button"
              onClick={() => void run('run', runFeesAgentNow)}
              disabled={busy !== null}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[12.5px] font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
            >
              {busy === 'run' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Run now
            </button>
          </div>
        </div>

        <h3 className="mt-2 text-[15.5px] font-bold leading-snug text-slate-900">
          Continuous Fees agent monitoring
        </h3>

        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-3 lg:grid-cols-4">
          <div className="rounded-lg bg-slate-50 px-3 py-2">
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Interval</dt>
            <dd className="mt-1 flex items-center gap-1.5">
              <input
                type="number"
                min={60}
                max={86400}
                value={intervalInput}
                onChange={(event) => setIntervalInput(event.target.value)}
                className="h-7 w-20 rounded-md border border-slate-200 px-2 text-[13px] font-bold tabular-nums text-slate-900 outline-none focus:border-[color:var(--intel-accent)]"
              />
              <span className="text-[11px] text-slate-500">sec</span>
              <button
                type="button"
                onClick={() => void run('interval', () => setFeesAgentInterval(Number(intervalInput) || agentState.interval_seconds))}
                disabled={busy !== null}
                className="rounded-md border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                {busy === 'interval' ? '…' : 'Set'}
              </button>
            </dd>
          </div>
          <div className="rounded-lg bg-slate-50 px-3 py-2">
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Last run</dt>
            <dd className="mt-0.5 text-[13px] font-bold text-slate-900">{agentState.last_run_time ?? 'Never'}</dd>
          </div>
          <div className="rounded-lg bg-slate-50 px-3 py-2">
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Next scheduled run</dt>
            <dd className="mt-0.5 text-[13px] font-bold text-slate-900">{agentState.next_scheduled_run ?? '—'}</dd>
          </div>
          <div className="rounded-lg bg-slate-50 px-3 py-2">
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Students with arrears</dt>
            <dd className="mt-0.5 text-[14px] font-bold tabular-nums text-slate-900">{agentState.counts.students_with_arrears}</dd>
          </div>
          <div className="rounded-lg bg-slate-50 px-3 py-2">
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Worsening trend</dt>
            <dd className="mt-0.5 text-[14px] font-bold tabular-nums text-slate-900">{agentState.counts.students_with_worsening_trend}</dd>
          </div>
          <div className="rounded-lg bg-slate-50 px-3 py-2">
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Recommendations drafted</dt>
            <dd className="mt-0.5 text-[14px] font-bold tabular-nums text-slate-900">{agentState.counts.recommendations_drafted}</dd>
          </div>
          <div className="rounded-lg bg-slate-50 px-3 py-2">
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Pending approvals</dt>
            <dd className="mt-0.5 text-[14px] font-bold tabular-nums text-slate-900">{pendingApprovalsCount}</dd>
          </div>
        </dl>

        {error ? (
          <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-800">{error}</p>
        ) : null}

        <p className="mt-3 text-[12px] text-slate-500">
          Every recommendation these agents draft stays human-approved — nothing here executes unattended. Starting,
          stopping, running now, and changing the interval require administrator access.
        </p>
      </div>
    </div>
  );
}
