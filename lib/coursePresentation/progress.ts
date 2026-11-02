import type { CpProgressInfo, CpRun } from './api';

/**
 * Words and timing rules for the generation progress screen. Pure, so each rule is tested without a browser. Nothing here
 * invents progress: it only phrases what the server recorded, and it never promises a finish time.
 */

/** "45 s", "7 min", "1 h 5 min". */
export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s} s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest === 0 ? `${h} h` : `${h} h ${rest} min`;
}

/** The time left, as a range. Until the server has enough earlier runs to justify one, it says it is still calculating. */
export function estimateText(info: CpProgressInfo): string {
  const e = info.estimate;
  if (!e.available) return 'Calculating estimated time…';
  if (e.overdue) return 'Taking longer than usual. Still working.';
  const min = e.min_seconds ?? 0;
  const max = e.max_seconds ?? 0;
  if (max < 60) return 'Less than a minute remaining (estimate)';
  const a = Math.max(1, Math.round(min / 60));
  const b = Math.max(a, Math.round(max / 60));
  return a === b ? `About ${a} min remaining (estimate)` : `About ${a}–${b} min remaining (estimate)`;
}

/** Elapsed seconds now: the server's count when it was fetched plus the time since, only while it is really running. */
export function liveElapsed(info: CpProgressInfo, fetchedAtMs: number, nowMs: number): number | null {
  if (info.elapsed_seconds === null) return null;
  if (info.lifecycle !== 'processing') return info.elapsed_seconds;
  return info.elapsed_seconds + Math.max(0, Math.floor((nowMs - fetchedAtMs) / 1000));
}

/** Why a queued run has not started, in plain words. */
export function queueMessage(info: CpProgressInfo): string {
  const q = info.queue;
  const waited = q?.waiting_seconds != null ? ` Waiting for ${formatDuration(q.waiting_seconds)}.` : '';
  switch (q?.worker) {
    case 'busy':
      return `Your request is saved and is next in line: the background worker is finishing another generation.${waited}`;
    case 'active':
      return `Your request is saved. A background worker is running and will pick it up shortly.${waited}`;
    case 'not_detected':
      // Only a long wait is called a problem; a worker that was only just asked has not had time to answer.
      return (q.waiting_seconds ?? 0) >= 30
        ? `Your request is saved, but no background worker has picked it up yet.${waited} It will start as soon as the worker runs. If this keeps waiting, ask an administrator to start the queue worker.`
        : 'Your request is saved and waiting for a background worker to pick it up.';
    default:
      return `Your request is saved and waiting to start.${waited}`;
  }
}

/** True while the screen should keep asking the server. A finished, failed or discarded run is never polled. */
export function shouldPoll(run: CpRun | null): boolean {
  if (!run) return false;
  return run.state === 'queued' || run.state === 'running' || (run.state === 'ready' && run.progress_info?.saving === true);
}

/**
 * Milliseconds until the next status request. Quick while something is changing, slower while it waits, backing off after
 * failures (up to 30 s), and slow while the tab is hidden. Null when nothing needs asking.
 */
export function nextPollDelay(run: CpRun | null, failures: number, hidden: boolean): number | null {
  if (!shouldPoll(run)) return null;
  const base = run?.state === 'queued' ? 5000 : run?.progress_info?.saving ? 2000 : 4000;
  const backedOff = Math.min(30000, base * 2 ** Math.min(failures, 5));
  return hidden ? Math.max(backedOff, 15000) : backedOff;
}

/** After this many failed requests in a row the screen tells the teacher the connection is the problem (the run itself is unaffected). */
export const OFFLINE_AFTER_FAILURES = 2;

export type Outcome = 'completed' | 'failed' | null;

/** A run that was being made when last seen and is now finished or failed: the moment to tell the teacher. */
export function finishedOutcome(before: CpRun | null, after: CpRun | null): Outcome {
  if (!before || !after || before.run !== after.run) return null;
  const wasLive = before.state === 'queued' || before.state === 'running';
  if (wasLive && (after.state === 'ready' || after.state === 'stored')) return 'completed';
  if (before.state === 'ready' && after.state === 'stored') return 'completed';
  if ((wasLive || before.state === 'ready') && after.state === 'failed') return 'failed';
  return null;
}

/** The position in the pipeline, for a screen reader and the heading: "Step 3 of 7: Generating content". */
export function stageSentence(info: CpProgressInfo): string {
  const stages = info.stages;
  const i = stages.findIndex((s) => s.status === 'current');
  if (i < 0) return '';
  return `Step ${i + 1} of ${stages.length}: ${stages[i].label}`;
}

/** What is announced to assistive technology; changes only when the stage or lifecycle changes, so polling is silent. */
export function announcement(run: CpRun, noun: string): string {
  const info = run.progress_info;
  if (run.state === 'queued') return `The ${noun} request is queued.`;
  if (run.state === 'running') return `Generating the ${noun}. ${info ? stageSentence(info) : ''}`.trim();
  if (info?.lifecycle === 'saving') return `Saving the ${noun}.`;
  if (run.state === 'ready') return `The ${noun} draft is ready for your review.`;
  if (run.state === 'stored') return `The ${noun} was created successfully.`;
  if (run.state === 'failed') return `Generating the ${noun} failed.`;
  return '';
}

/** Can the screen offer "Try again" (discard this run and start one new run for the same choice)? */
export function canRetry(run: CpRun | null): boolean {
  return run?.state === 'failed' && (run.progress_info?.failure?.retryable ?? true);
}
