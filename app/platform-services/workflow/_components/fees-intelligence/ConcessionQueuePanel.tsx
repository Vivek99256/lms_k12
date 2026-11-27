'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, AlertTriangle, CheckCircle2 } from 'lucide-react';

import {
  actOnConcessionRequest,
  fetchConcessionRequests,
  PlatformApiError,
  type WorkflowRun,
} from '@/lib/platform/client';
import type { ConcessionRequestRow, FeesConcessionQueue } from '@/lib/platform/types';

import { Card, ErrorState, LoadingState, Note, Pill } from '../../../_components/shell';
import { WorkflowRunCard } from '../WorkflowRunCard';

/**
 * The Concession / Refund Queue, drilled down.
 *
 * Pending items render through the shared `WorkflowRunCard`, the same card
 * `workflow/runs/page.tsx` uses for every other approval point — but wired to
 * `/api/platform/fees/concession-requests/{id}/{action}` rather than the generic
 * `/api/platform/workflow/runs/{id}/{action}`, because concessions and
 * refunds run through Fees' own endpoint, not the platform one.
 *
 * `ConcessionRequestRow` (what that endpoint returns) carries `current_step`
 * but not the full step ladder `WorkflowRunCard` was built to render — the
 * live contract this screen was built against does not expose per-step
 * approver detail for a concession/refund row the way the generic run list
 * does. `toRunStub` fills in a single honest placeholder step named by its
 * step number rather than inventing approver names the API never sent, so
 * the card still renders its real purpose (status, comment box, approve/
 * reject) without fabricating detail it does not have.
 */

function inr(amount: number): string {
  return '₹' + Math.round(amount).toLocaleString('en-IN');
}

/** Same ₹5,000 / ₹25,000 boundaries the Escalation Rule card uses. */
type RiskTier = 'high' | 'medium' | 'low';

function riskTier(amount: number): RiskTier {
  if (amount > 25000) return 'high';
  if (amount > 5000) return 'medium';
  return 'low';
}

const RISK_TONE: Record<RiskTier, 'red' | 'amber' | 'green'> = { high: 'red', medium: 'amber', low: 'green' };
const RISK_LABEL: Record<RiskTier, string> = { high: 'High', medium: 'Medium', low: 'Low' };
const RISK_ICON: Record<RiskTier, typeof AlertTriangle> = { high: AlertTriangle, medium: AlertCircle, low: CheckCircle2 };

function RiskPill({ amount }: { amount: number | null }) {
  if (amount === null) return null;
  const tier = riskTier(amount);
  const Icon = RISK_ICON[tier];
  return (
    <span className="animate-in zoom-in-75 fade-in-0 [--tw-animation-duration:250ms] inline-flex">
      <Pill tone={RISK_TONE[tier]}>
        <Icon size={11} className="shrink-0" />
        {RISK_LABEL[tier]} risk
      </Pill>
    </span>
  );
}

function toRunStub(row: ConcessionRequestRow): WorkflowRun {
  return {
    id: row.run_id,
    flow_key: row.flow_key,
    entity_type: row.kind,
    entity_id: String(row.student_id),
    title: row.title ?? `${row.student_name ?? `Student #${row.student_id}`} — ${row.kind}${row.amount != null ? ` (${inr(row.amount)})` : ''}`,
    status: (row.status === 'approved' || row.status === 'rejected' || row.status === 'returned' ? row.status : 'pending'),
    current_step: row.current_step,
    requested_by_name: row.student_name,
    is_sample: false,
    created_at: row.created_at,
    completed_at: null,
    steps: [
      {
        id: row.run_id,
        order: row.current_step,
        name: `Step ${row.current_step}`,
        approver_type: 'role',
        approver: '',
        status: 'pending',
        assignee_user_id: null,
        acted_by_name: null,
        acted_at: null,
        comment: null,
        due_at: null,
        escalated_at: null,
        allow_delegate: false,
        require_comment: false,
      },
    ],
  };
}

export interface ConcessionQueuePanelProps {
  summary: FeesConcessionQueue;
  refreshToken: number;
  onRefresh: () => void;
}

export function ConcessionQueuePanel({ summary, refreshToken, onRefresh }: ConcessionQueuePanelProps) {
  const [pending, setPending] = useState<ConcessionRequestRow[] | null>(null);
  const [approved, setApproved] = useState<ConcessionRequestRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<number, string>>({});
  const [busyId, setBusyId] = useState<number | null>(null);
  const [note, setNote] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  const load = useCallback(() => {
    setError(null);
    Promise.all([fetchConcessionRequests({ state: 'pending' }), fetchConcessionRequests({ state: 'approved_pending_application' })])
      .then(([pendingRows, approvedRows]) => {
        setPending(pendingRows);
        setApproved(approvedRows);
      })
      .catch((cause: unknown) => {
        setError(cause instanceof PlatformApiError ? cause.message : "Couldn't load the concession/refund queue. Try again.");
      });
  }, [refreshToken]);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (row: ConcessionRequestRow, action: 'approve' | 'reject') => {
    setBusyId(row.run_id);
    setNote(null);
    try {
      await actOnConcessionRequest(row.run_id, action, { comment: comments[row.run_id] ?? '' });
      setNote({ tone: 'ok', text: action === 'approve' ? 'Step approved.' : 'Request rejected.' });
      load();
      onRefresh();
    } catch (cause) {
      setNote({ tone: 'error', text: cause instanceof PlatformApiError ? cause.message : "Couldn't save the decision. Try again." });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      {note && <Note tone={note.tone} text={note.text} onDismiss={() => setNote(null)} />}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Pending — concession" value={summary.pending_by_flow.concession} />
        <Stat label="Pending — refund" value={summary.pending_by_flow.refund} />
        <Stat label="Need Trustee sign-off" value={summary.escalated_to_trustee} tone={summary.escalated_to_trustee > 0 ? 'amber' : undefined} />
        <Stat label="Closed (30d)" value={summary.closed_30d} />
      </div>

      {(!summary.chain_active.concession || !summary.chain_active.refund) && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {!summary.chain_active.concession && <p>No active Fee concession chain — concession requests cannot be submitted until one is activated in Approval Workflows.</p>}
          {!summary.chain_active.refund && <p>No active Fee refund chain — refund requests cannot be submitted until one is activated in Approval Workflows.</p>}
        </div>
      )}

      <section>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Pending approval</h4>
        {error ? (
          <ErrorState message={error} onRetry={load} />
        ) : pending === null ? (
          <LoadingState label="Loading pending requests" />
        ) : pending.length === 0 ? (
          <Card className="px-4 py-6 text-center text-sm text-slate-600">Nothing pending right now.</Card>
        ) : (
          <div className="space-y-2">
            {pending.map((row) => (
              <WorkflowRunCard
                key={row.run_id}
                run={toRunStub(row)}
                busy={busyId === row.run_id}
                comment={comments[row.run_id] ?? ''}
                onComment={(text) => setComments((all) => ({ ...all, [row.run_id]: text }))}
                onAct={(action) => void act(row, action)}
                extra={
                  row.amount != null ? (
                    <p className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                      Amount: {inr(row.amount)} <RiskPill amount={row.amount} />
                    </p>
                  ) : undefined
                }
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Approved, awaiting application · {summary.approved_awaiting.count} ({inr(summary.approved_awaiting.amount)})
        </h4>
        {approved === null ? (
          <LoadingState label="Loading approved requests" />
        ) : approved.length === 0 ? (
          <Card className="px-4 py-6 text-center text-sm text-slate-600">Nothing waiting to be applied.</Card>
        ) : (
          <ul className="space-y-1.5">
            {approved.map((row) => (
              <li key={row.run_id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
                <div>
                  <p className="font-medium text-slate-900">{row.student_name ?? `Student #${row.student_id}`}</p>
                  <p className="flex items-center gap-2 text-xs text-slate-500">
                    {row.kind} · {row.amount != null ? inr(row.amount) : '—'} · #{row.run_id}
                    <RiskPill amount={row.amount} />
                  </p>
                </div>
                {row.grant_id != null &&
                  (row.kind === 'concession' ? (
                    <Link href={`/fees/collect/${row.student_id}?grant=${row.grant_id}`} className="text-xs font-medium text-indigo-600 hover:text-indigo-800">
                      Apply on Fees Collect
                    </Link>
                  ) : (
                    <Link href={`/fees/cancel-refund?tab=refund&grant=${row.grant_id}`} className="text-xs font-medium text-indigo-600 hover:text-indigo-800">
                      Pay out refund
                    </Link>
                  ))}
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-xs text-slate-500">
        {summary.applied_this_year.count} applied this year ({inr(summary.applied_this_year.amount)}).
      </p>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: 'amber' }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`mt-0.5 text-lg font-semibold ${tone === 'amber' ? 'text-amber-600' : 'text-slate-900'}`}>{value}</p>
    </div>
  );
}
