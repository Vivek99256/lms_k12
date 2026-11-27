'use client';

import type { RegistryOption, WorkflowStep } from '@/lib/platform/types';

/**
 * The chain as a readable ladder — the shape somebody checks at a glance.
 *
 * Its own module rather than living inside `WorkflowConsole.tsx`: Fees
 * Intelligence's `EscalationReportPanel` renders the same ladder for a chain
 * it reads over the wire, and `WorkflowConsole.tsx` itself imports
 * `EscalationReportPanel` — importing `StepLadder` back out of
 * `WorkflowConsole.tsx` would make the two modules import each other.
 */
export function StepLadder({ steps, approverTypes }: { steps: WorkflowStep[]; approverTypes: RegistryOption[] }) {
  if (!steps.length) {
    return <p className="mt-1.5 text-xs text-amber-700">No steps — this chain would approve everything it touched.</p>;
  }

  const labelFor = (step: WorkflowStep) => {
    const type = approverTypes.find((option) => option.key === step.approver_type);
    return step.approver || type?.label || step.approver_type;
  };

  return (
    <ol className="mt-2 flex flex-wrap items-center gap-1.5">
      {steps.map((step, index) => (
        <li key={step.id} className="flex items-center gap-1.5">
          {index > 0 && <span className="text-slate-300">→</span>}
          <span className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-700">
            <span className="font-medium">{step.name}</span>
            <span className="text-slate-500"> · {labelFor(step)}</span>
            {step.sla_hours > 0 && <span className="text-slate-400"> · {step.sla_hours}h</span>}
          </span>
        </li>
      ))}
    </ol>
  );
}
