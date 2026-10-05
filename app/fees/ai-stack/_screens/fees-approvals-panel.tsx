'use client';

import { CheckCircle2, Loader2, XCircle } from 'lucide-react';

import { cn } from '@/lib/utils';

import { humanizeKey as humanize, useFeesApprovals } from './use-fees-approvals';

/**
 * Every Fees approval, inside the chatbot's Actions tab.
 *
 * Two lists, both read from the approval records through useFeesApprovals:
 *   - Waiting for approval — every pending Fees approval the signed-in user may see,
 *     each with Approve / Reject (the same resolve call the Automations queue uses).
 *   - Approved / decided — decided ones stay here with their real status.
 *
 * Nothing is listed unless a record exists; there is no placeholder data.
 */
export function FeesApprovalsPanel() {
  const { pending, history, loading, historyLoading, error, flash, deciding, decide } = useFeesApprovals();

  return (
    <div className="space-y-4">
      {flash ? (
        <p className="rounded-2xl border border-emerald-200 bg-emerald-50/70 px-3.5 py-2.5 text-xs leading-5 text-emerald-800">
          {flash}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-2xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs leading-5 text-red-700">
          {error}
        </p>
      ) : null}

      <section>
        <h3 className="px-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
          Waiting for approval ({pending.length})
        </h3>

        {loading ? (
          <p className="mt-2 flex items-center gap-2 px-1 text-[11px] text-gray-500">
            <Loader2 className="size-3 animate-spin" aria-hidden />
            Checking approvals…
          </p>
        ) : pending.length === 0 ? (
          <p className="mt-2 px-1 text-[11px] leading-5 text-gray-500">
            No Fees action is waiting for you. Approvals assigned to another person or role are shown only to them.
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {pending.map((approval) => (
              <li key={approval.id} className="rounded-2xl border border-amber-200 bg-amber-50/70 p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 text-xs font-semibold text-gray-900">
                    {humanize(approval.workflow_key)}
                    {approval.step_key ? ` — ${humanize(approval.step_key)}` : ''}
                  </p>
                  <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                    Waiting for approval
                  </span>
                </div>
                <p className="mt-1 text-[10px] leading-4 text-gray-600">
                  Approval #{approval.id} · run #{approval.run_id}
                  {approval.subject_entity_key
                    ? ` · ${humanize(approval.subject_entity_key)} #${approval.subject_id}`
                    : ' · whole school'}
                  {approval.approver_role ? ` · role: ${approval.approver_role}` : ''}
                  {approval.created_at ? ` · since ${new Date(approval.created_at).toLocaleString()}` : ''}
                </p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    disabled={deciding === approval.id}
                    onClick={() => void decide(approval, 'approved')}
                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[11px] font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    <CheckCircle2 className="size-3" aria-hidden />
                    {deciding === approval.id ? 'Working…' : 'Approve'}
                  </button>
                  <button
                    type="button"
                    disabled={deciding === approval.id}
                    onClick={() => void decide(approval, 'rejected')}
                    className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-[11px] font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    <XCircle className="size-3" aria-hidden />
                    Reject
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="px-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
          Approved / decided ({history.length})
        </h3>

        {historyLoading ? null : history.length === 0 ? (
          <p className="mt-2 px-1 text-[11px] leading-5 text-gray-500">No Fees approval has been decided yet.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {history.map((entry) => {
              const approved = entry.status === 'approved';
              const rejected = entry.status === 'rejected';

              return (
                <li
                  key={entry.approvalId}
                  className={cn(
                    'rounded-2xl border p-3',
                    approved && 'border-emerald-200 bg-emerald-50/60',
                    rejected && 'border-red-200 bg-red-50/60',
                    !approved && !rejected && 'border-gray-200 bg-gray-50'
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 text-xs font-semibold text-gray-900">
                      {humanize(entry.workflowKey)}
                      {entry.stepKey ? ` — ${humanize(entry.stepKey)}` : ''}
                    </p>
                    <span
                      className={cn(
                        'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold text-white',
                        approved && 'bg-emerald-600',
                        rejected && 'bg-red-600',
                        !approved && !rejected && 'bg-gray-500'
                      )}
                    >
                      {humanize(entry.status)}
                    </span>
                  </div>
                  <p className="mt-1 text-[10px] leading-4 text-gray-600">
                    Approval #{entry.approvalId} · {entry.reference || `run #${entry.runId}`} · process{' '}
                    {humanize(entry.runStatus)}
                    {entry.subject ? ` · ${humanize(entry.subject)}` : ''}
                    {entry.decidedAt ? ` · ${new Date(entry.decidedAt).toLocaleString()}` : ''}
                  </p>
                  {entry.comment ? <p className="mt-0.5 text-[10px] italic text-gray-600">“{entry.comment}”</p> : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
