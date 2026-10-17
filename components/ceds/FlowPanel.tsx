'use client';

import Link from 'next/link';
import { useState, type ReactNode, type MutableRefObject } from 'react';

import { Badge } from '@/components/ui/badge';
import {
  linkLabel,
  minutesText,
  parseMinutes,
  periodFrom,
  plannedTotal,
  resourceHref,
  resourceKindLabel,
  teacherLedExplanation,
  TEACHER_LED_LABEL,
  type FlowPhase,
  type FlowResource,
} from '@/lib/ceds/flow';
import type { FlowPlan, FlowState } from '@/components/ceds/useFlowPlan';
import { cn } from '@/lib/utils';

/**
 * A teaching method's lesson flow for one topic: phases in order, suggested timings the teacher can change,
 * and the stored slides, activities, notes and labs that verifiably support each phase. Presentational:
 * it shows what the server returned and sends the teacher's edits back through the callbacks. Nothing is
 * shortened, reordered or changed to fit a phase; a resource longer than its phase only gets a warning.
 */
export function FlowPanel({
  panelRef,
  plan,
  chapterId,
  flowState,
  draft,
  openAction,
  onMinutes,
  onResetTimings,
  onPeriod,
  onChangeMethod,
  onClose,
}: {
  panelRef?: MutableRefObject<HTMLElement | null>;
  plan: FlowPlan;
  chapterId: number;
  flowState: FlowState;
  draft: string[];
  /** The control that opens the resource itself (a link on the planner page, a button in the Classroom Resource list). */
  openAction: ReactNode;
  onMinutes: (index: number, value: string) => void;
  onResetTimings: () => void;
  onPeriod: (period: number) => void;
  onChangeMethod: () => void;
  onClose: () => void;
}) {
  const [periodText, setPeriodText] = useState(String(plan.period));
  const flow = flowState.phase === 'ready' ? flowState.data.flow : null;
  const topic = flowState.phase === 'ready' ? flowState.data.topic : undefined;
  const planned = plannedTotal(draft.map((d) => parseMinutes(d) ?? 0));

  return (
    <section ref={panelRef} aria-labelledby="flow-heading" className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-indigo-700">Lesson flow</p>
          <h2 id="flow-heading" className="text-lg font-semibold">
            {flow ? flow.pedagogy_label : plan.pedagogy} · {topic?.name ?? `Topic ${plan.topicId}`}
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {openAction}
          <button type="button" onClick={onChangeMethod} className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Change method
          </button>
          <button type="button" onClick={onClose} className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Close
          </button>
        </div>
      </div>

      {flowState.phase === 'loading' && <p role="status" className="mt-3 text-sm text-slate-600">Building the lesson flow…</p>}
      {flowState.phase === 'error' && <p role="alert" className="mt-3 text-sm text-red-800">{flowState.message}</p>}

      {flow && (
        <>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
            <label htmlFor="flow-period" className="font-medium">Period</label>
            <input
              id="flow-period"
              inputMode="numeric"
              value={periodText}
              onChange={(e) => {
                setPeriodText(e.target.value);
                const p = periodFrom(e.target.value);
                if (p !== null) onPeriod(p);
              }}
              className="w-20 rounded-md border border-slate-300 bg-white px-2 py-1"
              aria-label="Period length in minutes"
            />
            <span className={cn('text-sm', planned === plan.period ? 'text-slate-600' : 'font-medium text-amber-800')}>
              Planned {planned} of {plan.period} min
            </span>
            <button type="button" onClick={onResetTimings} className="text-xs font-medium text-indigo-700 underline-offset-2 hover:underline">
              Reset to suggested timings
            </button>
          </div>

          {flow.warnings.map((w, i) => (
            <p key={i} role="alert" className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">{w.message}</p>
          ))}

          <ol className="mt-3 space-y-3">
            {flow.phases.map((phase, i) => (
              <PhaseRow key={phase.index} phase={phase} chapterId={chapterId} value={draft[i] ?? String(phase.minutes)} onChange={(v) => onMinutes(i, v)} />
            ))}
          </ol>

          <p className="mt-3 text-xs text-slate-600">
            Stored resources are shown exactly as they are stored. Nothing is shortened, reordered, regenerated or changed to fit a phase;
            where a resource is longer than its phase you will see a warning.
          </p>
        </>
      )}
    </section>
  );
}

function PhaseRow({ phase, chapterId, value, onChange }: { phase: FlowPhase; chapterId: number; value: string; onChange: (value: string) => void }) {
  const invalid = parseMinutes(value) === null;
  return (
    <li className="rounded-lg border border-slate-200 bg-white p-3" data-phase={phase.name}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-xs font-semibold text-white">{phase.index}</span>
        <h3 className="text-base font-semibold">{phase.name}</h3>
        {phase.outside_period ? (
          <span className="text-xs text-slate-500">Before the lesson, outside the period</span>
        ) : (
          <label className="ml-auto flex items-center gap-1.5 text-sm">
            <span className="sr-only">Minutes for {phase.name}</span>
            <input
              inputMode="numeric"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              aria-label={`Minutes for ${phase.name}`}
              aria-invalid={invalid}
              className={cn('w-16 rounded-md border px-2 py-1 text-right', invalid ? 'border-red-400' : 'border-slate-300')}
            />
            <span className="text-slate-600">min</span>
            {phase.minutes !== phase.suggested_minutes && <span className="text-xs text-slate-500">(suggested {phase.suggested_minutes})</span>}
          </label>
        )}
      </div>

      {phase.warnings.map((w, i) => (
        <p key={i} role="alert" className="mt-2 rounded-md bg-amber-50 px-3 py-1.5 text-sm text-amber-900">⚠ {w.message}</p>
      ))}

      {phase.teacher_led ? (
        <p className="mt-2 text-sm text-slate-600">
          <span className="font-medium text-slate-800">{TEACHER_LED_LABEL}.</span> {teacherLedExplanation(phase.teacher_led_reason)}
        </p>
      ) : (
        <ul className="mt-2 divide-y divide-slate-100 border-t border-slate-100">
          {phase.resources.map((r, i) => (
            <ResourceRow key={`${r.type}-${i}`} resource={r} chapterId={chapterId} />
          ))}
        </ul>
      )}
    </li>
  );
}

function ResourceRow({ resource, chapterId }: { resource: FlowResource; chapterId: number }) {
  const href = resourceHref(resource, chapterId);
  return (
    <li className="flex flex-wrap items-center gap-2 py-1.5 text-sm">
      <span className="text-xs font-medium text-slate-600">{resourceKindLabel(resource)}</span>
      <span className="min-w-0 flex-1 truncate">{resource.title}</span>
      {resource.type === 'slide' && resource.scope === 'chapter' && <span className="text-xs text-slate-500">Chapter hook, not specific to this topic</span>}
      {resource.type === 'activity' && resource.grouping && <span className="text-xs text-slate-500">{resource.grouping}</span>}
      {minutesText(resource.stored_minutes) && <span className="text-xs text-slate-500">{minutesText(resource.stored_minutes)}</span>}
      {resource.review_label && <Badge variant="warning">{resource.review_label}</Badge>}
      {href ? (
        <Link href={href} className="font-medium text-indigo-700 underline-offset-2 hover:underline">
          {linkLabel(resource)}
        </Link>
      ) : (
        resource.type === 'lab' && <span className="text-xs text-slate-500">Open from the chapter’s Prayogshala tab</span>
      )}
    </li>
  );
}
