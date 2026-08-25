'use client';

import { Check, ChevronRight, CircleDashed, CircleDot } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { Capability, FlowState, FlowStage } from '@/lib/intelligence/workspace';

/**
 * The intelligence chain for the record on screen, and the one thing to do next.
 *
 * Signal → Evidence → Case → Explain → Recommend → Decision → Action → Outcome.
 *
 * Every stage carries what was actually captured — "3 signals detected", "11 verified
 * items", "CASE-2026-000042 · high" — read from the rows, not from a status column.
 * That is the answer to "is the data being captured correctly": if a stage is ticked,
 * the rows behind it exist and the strip says how many.
 *
 * Only the current stage offers an action, and only one. This is what keeps the panel
 * from presenting five capabilities for every question: before a case exists the
 * answer is "analyse", after approval it is "track", and neither moment offers the
 * other's button.
 */
export function FlowStrip({
  flow,
  onAct,
  className,
}: {
  flow: FlowState;
  onAct?: (capability: Capability, action: FlowState['next']) => void;
  className?: string;
}) {
  // A flow describes one record. On a list page there is nothing to describe.
  if (!flow?.applicable || flow.stages.length === 0) {
    return null;
  }

  const completed = flow.stages.filter((stage) => stage.status === 'complete').length;
  const total = flow.stages.length;

  return (
    <div className={cn('rounded-2xl border border-gray-200/80 bg-white p-3.5', className)}>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
          Progress
        </p>
        <p className="text-[10px] tabular-nums text-gray-500">
          {completed} of {total}
        </p>
      </div>

      <ol className="mt-2.5 space-y-1.5">
        {flow.stages.map((stage) => (
          <StageRow key={stage.key} stage={stage} />
        ))}
      </ol>

      {flow.next ? (
        <div className="mt-3 border-t border-gray-100 pt-3">
          <p className="text-[11px] leading-5 text-gray-600">{flow.next.hint}</p>
          <button
            type="button"
            onClick={() => onAct?.(flow.next!.capability, flow.next)}
            className="mt-2 inline-flex items-center gap-1 rounded-xl bg-[#0D6EFD] px-3 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-[#0b5ed7]"
          >
            {flow.next.label}
            <ChevronRight className="size-3" aria-hidden />
          </button>

          {flow.next.requires_approval ? (
            <p className="mt-1.5 text-[10px] font-medium text-amber-700">
              Approval required — nothing runs until a person decides.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function StageRow({ stage }: { stage: FlowStage }) {
  const complete = stage.status === 'complete';
  const current = stage.status === 'current';

  return (
    <li className="flex items-start gap-2">
      <span className="mt-0.5 shrink-0">
        {complete ? (
          <Check className="size-3.5 text-emerald-600" aria-hidden />
        ) : current ? (
          <CircleDot className="size-3.5 text-[#0D6EFD]" aria-hidden />
        ) : (
          <CircleDashed className="size-3.5 text-gray-300" aria-hidden />
        )}
      </span>

      <span className="min-w-0 flex-1">
        <span
          className={cn(
            'block text-[11px] leading-4',
            complete && 'text-gray-700',
            current && 'font-semibold text-gray-900',
            !complete && !current && 'text-gray-400'
          )}
        >
          {stage.label}
        </span>
        {/* What was captured here — the check that the data really landed. */}
        <span
          className={cn(
            'block text-[10px] leading-4',
            complete ? 'text-gray-500' : current ? 'text-[#0D6EFD]' : 'text-gray-400'
          )}
        >
          {stage.summary}
        </span>
      </span>
    </li>
  );
}
