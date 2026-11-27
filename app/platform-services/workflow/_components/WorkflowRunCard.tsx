'use client';

import type { ReactNode } from 'react';

import type { WorkflowRun } from '@/lib/platform/client';

import { Card, Pill, SampleBadge, formatWhen } from '../../_components/shell';

/**
 * One approval run, with its step ladder and the approve/reject control for
 * whichever step is currently pending.
 *
 * EXTRACTED FROM `workflow/runs/page.tsx` rather than rebuilt, so the Fees
 * concession/refund queue gets the exact same approve/reject experience an
 * administrator already knows from the generic Approval requests screen —
 * down to the tone colours and the "comment required" placeholder — instead
 * of a second, slightly different approval widget. `onAct` is left to the
 * caller rather than calling `actOnWorkflowRun` directly, because the
 * concession/refund queue acts through its own endpoint
 * (`/api/platform/fees/concession-requests/{id}/{action}`), not the generic
 * `/api/platform/workflow/runs/{id}/{action}` this card was built against.
 */

const RUN_TONE = { pending: 'amber', approved: 'green', rejected: 'red', returned: 'red' } as const;
const STEP_TONE = { waiting: 'gray', pending: 'amber', approved: 'green', rejected: 'red', skipped: 'gray', escalated: 'blue' } as const;

export interface WorkflowRunCardProps {
  run: WorkflowRun;
  /** True while this run's own action is in flight — disables both buttons, not every card on the screen. */
  busy: boolean;
  comment: string;
  onComment: (text: string) => void;
  onAct: (action: 'approve' | 'reject') => void;
  /** Extra content rendered under the header, before the step ladder — e.g. an amount this card's caller knows about that the generic run shape does not carry. */
  extra?: ReactNode;
}

export function WorkflowRunCard({ run, busy, comment, onComment, onAct, extra }: WorkflowRunCardProps) {
  const current = run.steps.find((step) => step.status === 'pending');

  return (
    <Card className="p-4">
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

      {extra}

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
            value={comment}
            onChange={(event) => onComment(event.target.value)}
            placeholder={current.require_comment ? 'Comment (required)' : 'Comment (optional)'}
            className="min-w-[220px] flex-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm"
            aria-label={`Comment for ${current.name}`}
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => onAct('approve')}
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            Approve
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onAct('reject')}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Reject
          </button>
        </div>
      )}
    </Card>
  );
}
