'use client';

/**
 * Presentation layer for the AI question generator.
 *
 * The generation API (`POST /api/intelligence/questions/generate`) is a single
 * request/response call - it does not stream. What this file does is make the
 * pipeline behind that call *legible*: which grounding signals the server
 * actually feeds DeepSeek, in what order the stages run, and what the run really
 * cost once it returns. Nothing here changes the request payload.
 *
 * Stage list mirrors `App\Services\QuestionGenerationService::generate()`:
 *   loadConceptSlice -> buildConceptSlice -> buildQuota -> buildDedupCorpus
 *   -> callDeepSeek (batched) -> validateRows -> persist
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  CircleDashed,
  Loader2,
  ShieldCheck,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ *
 * Grounding signals
 * ------------------------------------------------------------------ */

export type GroundingState = 'rich' | 'thin' | 'missing' | 'server';

export interface GroundingSource {
  id: string;
  label: string;
  /** What this signal contributes to the generated items. */
  role: string;
  icon: LucideIcon;
  /** Real values pulled from the concept's intelligence; may be empty. */
  items: string[];
  state: GroundingState;
  /** Shown instead of a count for signals only the server can measure. */
  note?: string;
}

const STATE_STYLES: Record<GroundingState, { pill: string; label: string }> = {
  rich: { pill: 'bg-emerald-50 text-emerald-700 ring-emerald-200', label: 'grounded' },
  thin: { pill: 'bg-amber-50 text-amber-700 ring-amber-200', label: 'thin' },
  missing: { pill: 'bg-slate-100 text-slate-500 ring-slate-200', label: 'not extracted' },
  server: { pill: 'bg-indigo-50 text-indigo-700 ring-indigo-200', label: 'server-side' },
};

function SignalRow({ source }: { source: GroundingSource }) {
  const [open, setOpen] = useState(false);
  const styles = STATE_STYLES[source.state];
  const Icon = source.icon;
  const expandable = source.items.length > 0;

  return (
    <li className="group rounded-[10px] border border-slate-200/80 bg-white transition-colors hover:border-slate-300">
      <button
        type="button"
        onClick={() => expandable && setOpen((value) => !value)}
        aria-expanded={expandable ? open : undefined}
        className={cn(
          'flex w-full items-start gap-3 px-3 py-2.5 text-left',
          expandable ? 'cursor-pointer' : 'cursor-default'
        )}
      >
        <span
          className={cn(
            'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px]',
            source.state === 'missing'
              ? 'bg-slate-100 text-slate-400'
              : 'bg-slate-50 text-[#4f46e5]'
          )}
        >
          <Icon size={15} />
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-[13px] font-semibold text-slate-900">{source.label}</span>
            <span
              className={cn(
                'rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ring-1 ring-inset',
                styles.pill
              )}
            >
              {source.note ?? `${source.items.length} ${styles.label}`}
            </span>
          </span>
          <span className="mt-0.5 block text-[12px] leading-[18px] text-slate-500">
            {source.role}
          </span>

          {open && expandable ? (
            <span className="mt-2 block space-y-1.5">
              {source.items.slice(0, 6).map((item, index) => (
                <span
                  key={`${source.id}-${index}`}
                  className="block rounded-[7px] bg-slate-50 px-2.5 py-1.5 text-[12px] leading-[18px] text-slate-600"
                >
                  {item}
                </span>
              ))}
              {source.items.length > 6 ? (
                <span className="block px-1 text-[11px] font-medium text-slate-400">
                  +{source.items.length - 6} more fed to the model
                </span>
              ) : null}
            </span>
          ) : null}
        </span>

        {expandable ? (
          <span className="mt-1 shrink-0 text-[11px] font-semibold text-slate-400 group-hover:text-slate-600">
            {open ? 'Hide' : 'View'}
          </span>
        ) : null}
      </button>
    </li>
  );
}

export function GroundingPanel({
  sources,
  coverageLabel,
  blueprint,
  footnote,
}: {
  sources: GroundingSource[];
  coverageLabel: string;
  blueprint: Array<{ level: string; count: number; difficulty: string }>;
  footnote: string;
}) {
  const measurable = sources.filter((source) => source.state !== 'server');
  const present = measurable.filter((source) => source.state !== 'missing').length;
  const pct = measurable.length > 0 ? Math.round((present / measurable.length) * 100) : 0;
  const allocated = blueprint.reduce((sum, row) => sum + row.count, 0);

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="rounded-[12px] border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              What the model is given
            </p>
            <p className="mt-1 text-[13px] leading-[19px] text-slate-600">
              Items are written against this concept&apos;s extracted intelligence, not a free-form
              prompt.
            </p>
          </div>
          <span
            className={cn(
              'flex h-11 w-11 shrink-0 items-center justify-center rounded-full border text-[13px] font-bold',
              pct >= 60
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : pct > 0
                  ? 'border-amber-200 bg-amber-50 text-amber-700'
                  : 'border-slate-200 bg-slate-50 text-slate-500'
            )}
          >
            {pct}%
          </span>
        </div>

        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#4f46e5] to-[#8b5cf6] transition-[width] duration-700"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="mt-2 text-[12px] font-medium text-slate-500">{coverageLabel}</p>
      </div>

      <ul className="space-y-2">
        {sources.map((source) => (
          <SignalRow key={source.id} source={source} />
        ))}
      </ul>

      {allocated > 0 ? (
        <div className="rounded-[12px] border border-slate-200 bg-white p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            Planned Bloom spread
          </p>
          <div className="mt-3 space-y-2">
            {blueprint
              .filter((row) => row.count > 0)
              .map((row) => (
                <div key={row.level} className="flex items-center gap-3">
                  <span className="w-[74px] shrink-0 text-[12px] font-medium text-slate-700">
                    {row.level}
                  </span>
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <span
                      className="block h-full rounded-full bg-[#a5b4fc] transition-[width] duration-500"
                      style={{ width: `${Math.round((row.count / allocated) * 100)}%` }}
                    />
                  </span>
                  <span className="w-[70px] shrink-0 text-right text-[11px] font-semibold text-slate-500">
                    {row.count} &middot; {row.difficulty}
                  </span>
                </div>
              ))}
          </div>
        </div>
      ) : null}

      <p className="mt-auto flex items-start gap-2 rounded-[10px] bg-slate-50 px-3 py-2.5 text-[11px] leading-[17px] text-slate-500">
        <ShieldCheck size={14} className="mt-px shrink-0 text-slate-400" />
        <span>{footnote}</span>
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Pipeline stream
 * ------------------------------------------------------------------ */

export type StreamPhase = 'idle' | 'running' | 'success' | 'error';

interface Stage {
  id: string;
  label: string;
  detail: string;
  /** Approx. ms this stage holds the spotlight before the next one lights up. */
  hold: number;
}

/** Stages up to (and including) the model call. */
const PRE_STAGES: Stage[] = [
  {
    id: 'resolve',
    label: 'Resolving concept',
    detail: 'Concept pinned to its chapter, subject and standard; tenant ownership verified.',
    hold: 450,
  },
  {
    id: 'slice',
    label: 'Assembling concept slice',
    detail:
      'Knowledge, abilities, competencies, misconceptions, prerequisites and outcomes pulled from the chapter extraction.',
    hold: 700,
  },
  {
    id: 'quota',
    label: 'Building Bloom x DOK blueprint',
    detail:
      'Bloom levels weighted from the concept intelligence, DOK clamped to the levels it supports.',
    hold: 550,
  },
  {
    id: 'dedup',
    label: 'Loading duplicate guard',
    detail: 'Existing stems for this concept loaded so new items must be semantically distinct.',
    hold: 600,
  },
  {
    id: 'author',
    label: 'DeepSeek authoring items',
    detail: 'Column-shaped rows written against the slice, one batch at a time.',
    hold: Number.POSITIVE_INFINITY,
  },
];

/** Stages that only resolve once the response lands. */
const POST_STAGES: Stage[] = [
  {
    id: 'validate',
    label: 'Validating rows',
    detail: 'Every row checked against the question-bank schema before anything is written.',
    hold: 380,
  },
  {
    id: 'persist',
    label: 'Saving to question bank',
    detail: 'Questions, answers and Bloom/DOK mappings inserted in one transaction.',
    hold: 380,
  },
];

const ALL_STAGES = [...PRE_STAGES, ...POST_STAGES];
const AUTHOR_INDEX = PRE_STAGES.length - 1;

function formatElapsed(ms: number) {
  const seconds = ms / 1000;
  return seconds < 10 ? `${seconds.toFixed(1)}s` : `${Math.round(seconds)}s`;
}

function StageRow({
  stage,
  state,
  elapsedLabel,
}: {
  stage: Stage;
  state: 'pending' | 'active' | 'done' | 'failed';
  elapsedLabel?: string;
}) {
  return (
    <li
      className={cn(
        'flex gap-3 rounded-[10px] px-3 py-2.5 transition-colors duration-300',
        state === 'active' && 'bg-indigo-50/70',
        state === 'failed' && 'bg-rose-50/70'
      )}
    >
      <span className="mt-0.5 shrink-0">
        {state === 'done' ? (
          <CheckCircle2 size={16} className="text-emerald-600" />
        ) : state === 'active' ? (
          <Loader2 size={16} className="animate-spin text-[#4f46e5]" />
        ) : state === 'failed' ? (
          <XCircle size={16} className="text-rose-600" />
        ) : (
          <CircleDashed size={16} className="text-slate-300" />
        )}
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span
            className={cn(
              'text-[13px] font-semibold transition-colors',
              state === 'pending' ? 'text-slate-400' : 'text-slate-900'
            )}
          >
            {stage.label}
          </span>
          {elapsedLabel ? (
            <span className="shrink-0 font-mono text-[11px] font-medium text-slate-400">
              {elapsedLabel}
            </span>
          ) : null}
        </span>
        <span
          className={cn(
            'mt-0.5 block text-[12px] leading-[18px] transition-colors',
            state === 'pending' ? 'text-slate-400' : 'text-slate-500'
          )}
        >
          {stage.detail}
        </span>
      </span>
    </li>
  );
}

/**
 * Caller must give this a `key` that changes per run (see `runId` on the page):
 * the stage cursor is seeded at mount rather than reset inside an effect, so a
 * second run has to remount to start from the top.
 */
export function PipelineStream({
  phase,
  errorMessage,
  batchLabel,
}: {
  phase: StreamPhase;
  errorMessage?: string;
  /** e.g. "12 MCQ items" - shown beside the elapsed clock. */
  batchLabel: string;
}) {
  const [index, setIndex] = useState(() => (phase === 'running' ? 0 : -1));
  const [elapsed, setElapsed] = useState(0);
  // Stamped by the effect below, not at render: Date.now() is impure.
  const startedAt = useRef(0);

  // Advance the pre-model stages on their own cadence, then park on the model
  // call until the request resolves.
  useEffect(() => {
    if (phase !== 'running') return;

    startedAt.current = Date.now();

    const timers: ReturnType<typeof setTimeout>[] = [];
    let offset = 0;
    PRE_STAGES.slice(0, AUTHOR_INDEX).forEach((stage, stageIndex) => {
      offset += stage.hold;
      timers.push(setTimeout(() => setIndex(stageIndex + 1), offset));
    });

    const tick = setInterval(() => setElapsed(Date.now() - startedAt.current), 100);

    return () => {
      timers.forEach(clearTimeout);
      clearInterval(tick);
    };
  }, [phase]);

  // The response landed: walk the validate/persist stages out so the run reads as
  // finished rather than snapping from "authoring" straight to done.
  useEffect(() => {
    if (phase !== 'success') return;

    const timers: ReturnType<typeof setTimeout>[] = [];
    let offset = 0;
    POST_STAGES.forEach((stage, stageIndex) => {
      offset += stage.hold;
      timers.push(setTimeout(() => setIndex(AUTHOR_INDEX + 1 + stageIndex), offset));
    });
    timers.push(setTimeout(() => setIndex(ALL_STAGES.length), offset + 300));

    return () => timers.forEach(clearTimeout);
  }, [phase]);

  if (phase === 'idle') return null;

  const visible = phase === 'error' ? ALL_STAGES.slice(0, Math.max(index + 1, 1)) : ALL_STAGES;

  return (
    <div className="overflow-hidden rounded-[12px] border border-slate-200 bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            {phase === 'running' ? (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#4f46e5] opacity-75" />
            ) : null}
            <span
              className={cn(
                'relative inline-flex h-2 w-2 rounded-full',
                phase === 'error'
                  ? 'bg-rose-500'
                  : phase === 'success'
                    ? 'bg-emerald-500'
                    : 'bg-[#4f46e5]'
              )}
            />
          </span>
          <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-slate-600">
            {phase === 'running' ? 'Generating' : phase === 'error' ? 'Run failed' : 'Run complete'}
          </p>
        </div>
        <span className="font-mono text-[11px] font-medium text-slate-500">
          {formatElapsed(elapsed)} &middot; {batchLabel}
        </span>
      </div>

      <ul className="space-y-0.5 p-2">
        {visible.map((stage, stageIndex) => {
          const state =
            phase === 'error' && stageIndex === index
              ? 'failed'
              : stageIndex < index
                ? 'done'
                : stageIndex === index
                  ? 'active'
                  : 'pending';

          return (
            <StageRow
              key={stage.id}
              stage={stage}
              state={state}
              elapsedLabel={
                stageIndex === AUTHOR_INDEX && state === 'active'
                  ? formatElapsed(elapsed)
                  : undefined
              }
            />
          );
        })}
      </ul>

      {phase === 'error' && errorMessage ? (
        <p className="border-t border-rose-100 bg-rose-50/60 px-4 py-3 text-[12px] font-medium leading-[18px] text-rose-700">
          {errorMessage}
        </p>
      ) : null}

      {phase === 'running' ? (
        <p className="border-t border-slate-100 px-4 py-2.5 text-[11px] leading-[16px] text-slate-400">
          Stage order is fixed by the server pipeline. The API answers once the whole run finishes, so
          progress here is indicative until the results arrive.
        </p>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Run telemetry - every number below comes back in the API response.
 * ------------------------------------------------------------------ */

export interface RunTelemetry {
  requested?: number;
  generated?: number;
  inserted?: number;
  skippedDuplicate?: number;
  skippedInvalid?: number;
  model?: string;
  batches?: number;
  inputTokens?: number;
  outputTokens?: number;
}

export function RunTelemetryStrip({ telemetry }: { telemetry: RunTelemetry }) {
  const tiles = useMemo(() => {
    const out: Array<{ label: string; value: string }> = [];

    if (telemetry.inserted != null) {
      out.push({
        label: 'Saved',
        value:
          telemetry.requested != null
            ? `${telemetry.inserted} / ${telemetry.requested}`
            : String(telemetry.inserted),
      });
    }
    if (telemetry.model) out.push({ label: 'Model', value: telemetry.model });
    if (telemetry.batches != null) out.push({ label: 'Batches', value: String(telemetry.batches) });
    if (telemetry.inputTokens != null || telemetry.outputTokens != null) {
      out.push({
        label: 'Tokens',
        value: ((telemetry.inputTokens ?? 0) + (telemetry.outputTokens ?? 0)).toLocaleString(),
      });
    }
    if (telemetry.skippedDuplicate) {
      out.push({ label: 'Duplicates dropped', value: String(telemetry.skippedDuplicate) });
    }
    if (telemetry.skippedInvalid) {
      out.push({ label: 'Invalid dropped', value: String(telemetry.skippedInvalid) });
    }

    return out;
  }, [telemetry]);

  if (tiles.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {tiles.map((tile) => (
        <div key={tile.label} className="rounded-[9px] border border-slate-200 bg-white px-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
            {tile.label}
          </p>
          <p className="mt-0.5 truncate text-[14px] font-bold text-slate-900">{tile.value}</p>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Progressive reveal for the returned items
 * ------------------------------------------------------------------ */

/**
 * Reveal already-received items one at a time. The data is real and complete by
 * the time this runs - the stagger only keeps the result readable as it lands.
 */
export function useStaggeredReveal(
  total: number,
  active: boolean,
  /** Changes per run so a previous run's progress is never reused. */
  runToken: string | number = 0,
  stepMs = 220
) {
  const [progress, setProgress] = useState({ key: '', count: 0 });
  const key = `${runToken}:${total}`;

  useEffect(() => {
    if (!active || total === 0) return;

    let current = 1;
    const timer = setInterval(() => {
      current += 1;
      setProgress({ key, count: current });
      if (current >= total) clearInterval(timer);
    }, stepMs);

    return () => clearInterval(timer);
  }, [key, active, total, stepMs]);

  if (!active || total === 0) return 0;
  // A stale run's count must not leak into the next one, so anything not keyed
  // to the current run starts back at the first item.
  return progress.key === key ? Math.min(Math.max(progress.count, 1), total) : 1;
}
