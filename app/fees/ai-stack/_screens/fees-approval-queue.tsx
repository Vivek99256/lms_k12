'use client';

import { useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, Gavel, Loader2, XCircle } from 'lucide-react';

import type { PendingApproval } from '@/lib/intelligence/types';

import { humanizeKey as humanize, useFeesApprovals } from './use-fees-approvals';

/**
 * Fees → AI Stack → Automations → "Waiting for a person".
 *
 * Where a Fees workflow that paused for sign-off (the chatbot's "Waiting for staff
 * approval") is actually decided. It is the same queue the Attendance, Admissions
 * and Student Automations tabs already carry, over the same two calls:
 *
 *   GET  /api/ai/approvals/pending           listPendingApprovals
 *   POST /api/ai/approvals/{id}/resolve      resolveApproval
 *
 * Nothing here decides who may approve: the backend returns only approvals assigned
 * to the signed-in user, to their role, or to nobody in particular, and refuses a
 * decision on one that is resolved or expired. This view only shows and forwards.
 *
 * The chatbot links here with `?run=<id>` (or `?approval=<id>`); that row is
 * highlighted and scrolled into view so the user lands on the item, not a page of them.
 */

export function FeesApprovalQueue() {
  const params = useSearchParams();
  const targetRun = params?.get('run') ?? null;
  const targetApproval = params?.get('approval') ?? null;

  const { pending: approvals, history, loading, historyLoading, error, flash, deciding, reload: load, decide } =
    useFeesApprovals();
  const highlightRef = useRef<HTMLLIElement | null>(null);

  const visible = approvals;
  const isTarget = (row: PendingApproval) =>
    (targetApproval !== null && String(row.id) === targetApproval) ||
    (targetRun !== null && String(row.run_id) === targetRun);
  // With no id in the link, the oldest waiting item is the one to look at first.
  const hasExplicitTarget = targetRun !== null || targetApproval !== null;
  const highlightId = visible.find(isTarget)?.id ?? (hasExplicitTarget ? null : visible[0]?.id ?? null);

  useEffect(() => {
    if (highlightId !== null) highlightRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [highlightId, loading]);

  return (
    <section
      id="fees-approvals"
      className="rounded-lg border border-slate-200 bg-white px-5 py-5 shadow-sm"
      aria-label="Fees approvals waiting for a person"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-semibold text-slate-950">
          <Gavel className="size-4" aria-hidden />
          Waiting for a person ({approvals.length})
        </h2>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          Refresh
        </button>
      </div>
      <p className="mt-1 text-sm text-slate-600">
        Fees processes that paused for a sign-off. Approving lets the process continue; rejecting closes it and
        nothing further runs. Each decision is recorded against you.
      </p>

      {flash ? (
        <p className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
          {flash}
        </p>
      ) : null}

      {error ? (
        <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">{error}</p>
      ) : null}

      {loading ? (
        <p className="mt-3 flex items-center gap-2 text-xs text-slate-500">
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
          Loading approvals…
        </p>
      ) : visible.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">
          No Fees approval is waiting for you. If one was started by someone else, it is shown only to the person
          or role it was assigned to.
        </p>
      ) : (
        <ul className="mt-3 space-y-3">
          {visible.map((approval) => {
            const highlighted = approval.id === highlightId;

            return (
              <li
                key={approval.id}
                ref={highlighted ? highlightRef : undefined}
                className={
                  highlighted
                    ? 'rounded-lg border-2 border-amber-400 bg-amber-50 px-4 py-3 shadow-[0_0_0_4px_rgba(251,191,36,0.25)]'
                    : 'rounded-lg border border-amber-200 bg-amber-50/60 px-4 py-3'
                }
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 text-sm text-slate-900">
                    {highlighted ? (
                      <p className="mb-1 inline-block rounded-full bg-amber-500 px-2 py-0.5 text-[11px] font-semibold text-white">
                        This is the approval waiting for you
                      </p>
                    ) : null}
                    <p className="font-semibold">
                      {humanize(approval.workflow_key)}
                      {approval.step_key ? ` — ${humanize(approval.step_key)}` : ''}
                    </p>
                    <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs text-slate-700">
                      <dt className="text-slate-500">Approval</dt>
                      <dd>#{approval.id} (run #{approval.run_id})</dd>
                      <dt className="text-slate-500">About</dt>
                      <dd>
                        {approval.subject_entity_key
                          ? `${humanize(approval.subject_entity_key)} #${approval.subject_id}`
                          : 'The whole school (no single student selected)'}
                      </dd>
                      <dt className="text-slate-500">Who can approve</dt>
                      <dd>
                        {approval.assigned_to
                          ? `User #${approval.assigned_to}`
                          : approval.approver_role
                            ? `Role: ${approval.approver_role}`
                            : 'Anyone with access to Fees approvals'}
                      </dd>
                      {approval.created_at ? (
                        <>
                          <dt className="text-slate-500">Waiting since</dt>
                          <dd>{new Date(approval.created_at).toLocaleString()}</dd>
                        </>
                      ) : null}
                      {approval.expires_at ? (
                        <>
                          <dt className="text-slate-500">Expires</dt>
                          <dd>{new Date(approval.expires_at).toLocaleString()}</dd>
                        </>
                      ) : null}
                    </dl>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        disabled={deciding === approval.id}
                        onClick={() => void decide(approval, 'approved')}
                        className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                      >
                        <CheckCircle2 className="size-3.5" aria-hidden />
                        Approve
                      </button>
                      <button
                        type="button"
                        disabled={deciding === approval.id}
                        onClick={() => void decide(approval, 'rejected')}
                        className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                      >
                        <XCircle className="size-3.5" aria-hidden />
                        Reject
                      </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
