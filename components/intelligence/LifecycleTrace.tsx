'use client';

import { useState } from 'react';
import { Ban, Check, ChevronDown, Circle, Clock, Minus } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { StageStatus, TraceStage } from '@/lib/intelligence/types';

/**
 * The twelve-stage lifecycle, as it actually executed for one question.
 *
 * The governing rule here is that **a stage which did not run has to say why**. A
 * pipeline view that only shows the stages that fired teaches nobody how the pipeline
 * works, and — worse — it reads as a dead system: the two most important stages on a
 * risk scan are Human Approval (waiting) and Action (gated behind it), and both are
 * meaningful precisely because they have not happened yet.
 *
 * So `summary` is used when the stage has something to report, and `note` is used when
 * it does not. A stage that renders blank is a bug, not an empty state, and this
 * component surfaces that loudly rather than showing an inviting gap.
 */

const STATUS: Record<
  StageStatus,
  { label: string; dot: string; text: string; row: string; Icon: typeof Check }
> = {
  ran: {
    label: 'Ran',
    dot: 'bg-emerald-600 text-white',
    text: 'text-emerald-700',
    row: 'border-emerald-200 bg-emerald-50/40',
    Icon: Check,
  },
  pending: {
    label: 'Waiting',
    dot: 'bg-amber-500 text-white',
    text: 'text-amber-700',
    row: 'border-amber-200 bg-amber-50/50',
    Icon: Clock,
  },
  blocked: {
    label: 'Refused',
    dot: 'bg-red-600 text-white',
    text: 'text-red-700',
    row: 'border-red-200 bg-red-50/40',
    Icon: Ban,
  },
  skipped: {
    label: 'Skipped',
    dot: 'bg-slate-300 text-slate-700',
    text: 'text-slate-600',
    row: 'border-slate-200 bg-white',
    Icon: Minus,
  },
  not_reached: {
    label: 'Not reached',
    dot: 'bg-slate-100 text-slate-400',
    text: 'text-slate-500',
    row: 'border-dashed border-slate-200 bg-slate-50/60',
    Icon: Circle,
  },
};

const ORDER: StageStatus[] = ['ran', 'pending', 'blocked', 'skipped', 'not_reached'];

export function LifecycleTrace({
  stages,
  counts,
  durationMs,
  className,
}: {
  stages: TraceStage[];
  counts?: Partial<Record<StageStatus, number>>;
  durationMs?: number | null;
  className?: string;
}) {
  if (!stages?.length) return null;

  const tally = counts ?? {};
  const reached = stages.filter((s) => s.status === 'ran').length;

  return (
    <div className={cn('rounded-xl border border-slate-200 bg-white', className)}>
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-slate-100 px-4 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          Lifecycle
        </p>
        <p className="text-[11px] tabular-nums text-slate-500">
          {reached} of {stages.length} stages completed
        </p>
        <div className="ml-auto flex flex-wrap items-center gap-3">
          {ORDER.filter((s) => tally[s]).map((s) => (
            <span key={s} className="flex items-center gap-1.5 text-[10px] text-slate-500">
              <span className={cn('size-2 rounded-full', STATUS[s].dot)} aria-hidden />
              {STATUS[s].label} {tally[s]}
            </span>
          ))}
          {durationMs != null ? (
            <span className="text-[10px] tabular-nums text-slate-400">{durationMs} ms</span>
          ) : null}
        </div>
      </div>

      <ol className="divide-y divide-slate-100">
        {stages.map((stage) => (
          <StageRow key={stage.key} stage={stage} />
        ))}
      </ol>
    </div>
  );
}

function StageRow({ stage }: { stage: TraceStage }) {
  const [open, setOpen] = useState(false);
  const meta = STATUS[stage.status] ?? STATUS.not_reached;
  const { Icon } = meta;

  // The summary speaks when the stage did something; the note speaks when it did not.
  // Neither is a fallback for the other — showing "not reached" with no reason is the
  // failure this whole view exists to prevent.
  const said = stage.summary?.trim() || stage.note?.trim() || '';
  const isReason = !stage.summary?.trim() && Boolean(stage.note?.trim());

  const rows = stage.records as { table?: string; ids?: Array<number | string> };
  const verify = stage.verify as { api?: string; sql?: string };
  const hasDetail =
    Boolean(stage.component) ||
    Boolean(rows?.table) ||
    Boolean(verify?.api || verify?.sql) ||
    Object.keys(stage.data || {}).length > 0;

  return (
    <li className={cn('border-l-2', meta.row.split(' ')[0])}>
      <button
        type="button"
        onClick={() => hasDetail && setOpen((v) => !v)}
        aria-expanded={hasDetail ? open : undefined}
        disabled={!hasDetail}
        className={cn(
          'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors',
          hasDetail && 'hover:bg-slate-50 focus-visible:bg-slate-50',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-[-2px]'
        )}
      >
        <span
          className={cn('mt-0.5 flex size-5 flex-none items-center justify-center rounded-full', meta.dot)}
          aria-hidden
        >
          <Icon className="size-3" strokeWidth={3} />
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-mono text-[11px] tabular-nums text-slate-400">
              {String(stage.order).padStart(2, '0')}
            </span>
            <span className="text-sm font-semibold text-slate-900">{stage.layer}</span>
            <span className={cn('text-[10px] font-semibold uppercase tracking-wide', meta.text)}>
              {meta.label}
            </span>
            {stage.duration_ms != null ? (
              <span className="text-[10px] tabular-nums text-slate-400">{stage.duration_ms} ms</span>
            ) : null}
          </span>

          {said ? (
            <span
              className={cn(
                'mt-1 block text-[13px] leading-5',
                isReason ? 'italic text-slate-500' : 'text-slate-700'
              )}
            >
              {said}
            </span>
          ) : (
            <span className="mt-1 block text-[13px] italic text-red-600">
              This stage reported neither a summary nor a reason.
            </span>
          )}
        </span>

        {hasDetail ? (
          <ChevronDown
            className={cn('mt-1 size-4 flex-none text-slate-400 transition-transform', open && 'rotate-180')}
            aria-hidden
          />
        ) : null}
      </button>

      {open && hasDetail ? (
        <div className="space-y-3 border-t border-slate-100 bg-slate-50/70 px-4 py-3 pl-12">
          <Detail label="Component">
            <code className="break-all font-mono text-[11px] text-slate-700">{stage.component}</code>
          </Detail>

          {stage.surface ? <Detail label="Where a user sees this">{stage.surface}</Detail> : null}

          {rows?.table ? (
            <Detail label="Rows touched">
              <code className="font-mono text-[11px] text-slate-700">
                {rows.table}
                {rows.ids?.length ? ` #${rows.ids.join(', #')}` : ''}
              </code>
            </Detail>
          ) : null}

          {verify?.api || verify?.sql ? (
            <Detail label="Check it yourself">
              <div className="space-y-1">
                {verify.api ? (
                  <code className="block break-all rounded bg-white px-2 py-1 font-mono text-[11px] text-slate-700 ring-1 ring-slate-200">
                    {verify.api}
                  </code>
                ) : null}
                {verify.sql ? (
                  <code className="block break-all rounded bg-white px-2 py-1 font-mono text-[11px] text-slate-700 ring-1 ring-slate-200">
                    {verify.sql}
                  </code>
                ) : null}
              </div>
            </Detail>
          ) : null}

          {Object.keys(stage.data || {}).length > 0 ? (
            <Detail label="Payload">
              <pre className="max-h-64 overflow-auto rounded bg-white p-2 font-mono text-[11px] leading-4 text-slate-600 ring-1 ring-slate-200">
                {JSON.stringify(stage.data, null, 2)}
              </pre>
            </Detail>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <div className="mt-0.5 text-[12px] text-slate-600">{children}</div>
    </div>
  );
}
