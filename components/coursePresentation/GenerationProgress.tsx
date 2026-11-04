'use client';

import { useEffect, useState } from 'react';

import type { CpRun } from '@/lib/coursePresentation/api';
import { estimateText, formatDuration, liveElapsed, queueMessage, stageSentence } from '@/lib/coursePresentation/progress';
import { cn } from '@/lib/utils';

const MARK: Record<string, string> = { done: 'Done', current: 'In progress', pending: 'Waiting', failed: 'Stopped here' };

/**
 * How a queued or running generation is getting on: the real stage, a bar that counts finished stages (never a clock), the
 * time spent, and a time estimate only when the server has earlier runs to base one on. It shows what the server recorded and
 * nothing more; the status text is announced by the panel (one polite live region), not by this list.
 *
 * `receivedAt` is when the run was last read from the server, so the elapsed time keeps counting between reads.
 */
export function GenerationProgress({ run, noun, receivedAt, offline }: { run: CpRun; noun: string; receivedAt: number; offline: boolean }) {
  const info = run.progress_info;
  const processing = info?.lifecycle === 'processing';

  // One tick a second, and only while it is really running; stopped on unmount and when the run is no longer processing.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!processing) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [processing]);

  // A server that predates progress reporting: the state alone, as before.
  if (!info) {
    return (
      <div data-testid="cp-progress" className="mt-2">
        <p className="font-medium">{run.state === 'queued' ? 'Waiting to start…' : `Generating the ${noun}…`}</p>
      </div>
    );
  }

  const queued = info.lifecycle === 'queued';
  const elapsed = liveElapsed(info, receivedAt, now);
  const total = info.stages.length;
  const doneCount = info.stages.filter((s) => s.status === 'done').length;
  const heading = queued ? `The ${noun} request is queued` : info.lifecycle === 'saving' ? `Saving the ${noun}…` : `Generating the ${noun}…`;

  return (
    <div data-testid="cp-progress" data-lifecycle={info.lifecycle} data-stage={info.stage} className="mt-2">
      <p className="font-medium">{heading}</p>
      {queued && (
        <p data-testid="cp-queue-message" className="mt-1 rounded-md bg-slate-50 px-3 py-2 text-slate-700">
          {queueMessage(info)}
        </p>
      )}
      {offline && (
        <p role="alert" data-testid="cp-offline" className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-amber-900">
          Can&apos;t reach the server to update this. The {noun} is not affected; trying again.
        </p>
      )}

      {!queued && (
        <>
          <div
            role="progressbar"
            aria-label={`${noun} generation progress`}
            aria-valuemin={0}
            aria-valuemax={100}
            {...(info.percent !== null && info.lifecycle !== 'saving' ? { 'aria-valuenow': info.percent } : {})}
            aria-valuetext={info.lifecycle === 'saving' ? 'Saving' : `${stageSentence(info)}; ${doneCount} of ${total} stages finished`}
            className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200"
          >
            <div
              className={cn('h-full rounded-full bg-indigo-600 transition-[width] duration-500 motion-reduce:transition-none', info.lifecycle === 'saving' && 'w-full animate-pulse motion-reduce:animate-none')}
              style={info.lifecycle === 'saving' ? undefined : { width: `${info.percent ?? 0}%` }}
            />
          </div>
          <p data-testid="cp-percent" className="mt-1 text-xs text-slate-600">
            {info.lifecycle === 'saving' ? 'Saving to the chapter…' : `${info.percent ?? 0}% · ${doneCount} of ${total} stages finished`}
          </p>
          <p className="mt-1 flex flex-wrap gap-x-4 text-xs text-slate-600">
            {elapsed !== null && <span data-testid="cp-elapsed">Elapsed: {formatDuration(elapsed)}</span>}
            {processing && <span data-testid="cp-estimate">{estimateText(info)}</span>}
          </p>
        </>
      )}

      <ol data-testid="cp-stages" className="mt-2 space-y-1 pl-0 text-xs">
        {info.stages.map((s) => (
          <li key={s.key} data-status={s.status} aria-current={s.status === 'current' ? 'step' : undefined} className={cn('flex items-baseline gap-2 list-none', s.status === 'pending' ? 'text-slate-500' : 'text-slate-800')}>
            <span className="w-24 shrink-0 font-medium">{MARK[s.status]}</span>
            <span>
              {s.label}
              {s.status === 'current' && <span className="block text-slate-600">{s.description}</span>}
            </span>
          </li>
        ))}
      </ol>

      {run.progress.length > 0 && !queued && (
        <details className="mt-2 text-xs text-slate-600">
          <summary className="cursor-pointer">Latest activity</summary>
          <ul className="mt-1 space-y-0.5">
            {run.progress.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </details>
      )}
      <p className="mt-2 text-xs text-slate-500">You can close this window. The {noun} keeps being made, and its status is here when you come back.</p>
    </div>
  );
}
