'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { GenerationProgress } from '@/components/coursePresentation/GenerationProgress';
import {
  approveCpDraft,
  discardCpDraft,
  fetchCpStatus,
  generateCpPresentation,
  type CpFit,
  type CpRun,
} from '@/lib/coursePresentation/api';
import { startRunPoller, type CpWatch } from '@/lib/coursePresentation/poller';
import { draftAddress } from '@/lib/coursePresentation/previewAddress';
import { announcement, canRetry, finishedOutcome, formatDuration, shouldPoll, type Outcome } from '@/lib/coursePresentation/progress';
import { coverageSentence, runForChoice } from '@/lib/coursePresentation/runChoice';
import { resolveViewer } from '@/lib/coursePresentation/viewer';
import { cn } from '@/lib/utils';

/**
 * Generate, review and open one Course Presentation draft (interactive slides only).
 *
 * Generate starts a background draft that spends a model call; nothing is stored until the teacher has looked at the
 * draft and approves it, and an approved draft opens in the study-deck viewer through the link the server built from
 * the stored row. Every rule (who may generate, what blocks it, duplicates) is the server's; this panel only shows the
 * server's answer and asks it to act.
 *
 * Mount it with a `key` for the pair of choices, so a different pair starts from its own run.
 */
/** Where the time of a finished run went, as the server recorded it. */
function TimingsDetails({ timings }: { timings: NonNullable<NonNullable<CpRun['progress_info']>['timings']> }) {
  const rows = Object.entries(timings.stages).filter(([, s]) => s.seconds !== null);
  const missed = timings.within_target === false && timings.target_seconds !== null;
  return (
    <details data-testid="cp-timings" className="mt-2 text-xs text-slate-600">
      <summary className="cursor-pointer">
        Where the time went
        {timings.total_seconds !== null ? ` (${formatDuration(timings.total_seconds)} in total${missed ? `, target ${formatDuration(timings.target_seconds as number)} not met` : ''})` : ''}
      </summary>
      <ul className="mt-1 space-y-0.5">
        {timings.queue_wait_seconds !== null && <li>Waiting for a worker: {formatDuration(timings.queue_wait_seconds)}</li>}
        {rows.map(([key, s]) => (
          <li key={key}>
            {key}: {formatDuration(s.seconds as number)}
          </li>
        ))}
      </ul>
    </details>
  );
}

export function GenerationPanel({
  chapterId,
  pedagogy,
  format,
  fit,
  initialRun,
  onOpenPresentation,
  onRunFinished,
  onLiveChange,
}: {
  chapterId: number;
  pedagogy: string;
  format: string;
  fit: CpFit;
  initialRun: CpRun | null;
  onOpenPresentation: (deepLink: string) => void;
  /** Told once when a run this screen was following finishes (draft ready, stored) or fails, so the page can refresh and say so. */
  onRunFinished?: (run: CpRun, outcome: Exclude<Outcome, null>) => void;
  /** Told which run is being made (null when none), so closing the window can hand it to the page to keep watching. */
  onLiveChange?: (watch: CpWatch | null) => void;
}) {
  // Only a run made for exactly THIS teaching method and format is ever shown or acted on; a run of another choice is no run here.
  const [run, setRun] = useState<CpRun | null>(() => runForChoice(initialRun, pedagogy, format));
  const [receivedAt, setReceivedAt] = useState(() => Date.now());
  const [offline, setOffline] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [reviewed, setReviewed] = useState(false);
  // The story lesson is the same draft, review and approval; only the words differ, and it is stored beside the presentation.
  const story = format === 'branching_scenario';
  const noun = story ? 'story lesson' : 'presentation';

  // The newest run, readable from timers and handlers without waiting for a render.
  const latest = useRef<CpRun | null>(run);
  // A click is answered once even if a second one lands before the first render has disabled the button.
  const working = useRef(false);
  const onFinished = useRef(onRunFinished);
  useEffect(() => {
    onFinished.current = onRunFinished;
  });

  /** Every new reading of the run goes through here: it keeps the ref, the clock and the one-time completion notice in step. */
  const commit = useCallback((next: CpRun | null) => {
    const outcome = finishedOutcome(latest.current, next);
    latest.current = next;
    setRun(next);
    setReceivedAt(Date.now());
    if (outcome && next) onFinished.current?.(next, outcome);
  }, []);

  const runId = run?.run ?? '';
  // Poll only for a run that is being made (or saved): never for a finished, failed or absent one.
  const pollKey = shouldPoll(run) ? runId : '';

  useEffect(() => {
    onLiveChange?.(run && (run.state === 'queued' || run.state === 'running') ? { chapterId, run: run.run, pedagogy, format } : null);
    // Reported when the live run changes, not on every reading of it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pollKey, run?.state]);

  // While a draft is being made, ask the server how it is getting on; stop for good when it is done, or when the window closes.
  useEffect(() => {
    if (!pollKey) return;
    const poller = startRunPoller({
      initial: latest.current,
      load: async (signal) => runForChoice((await fetchCpStatus(chapterId, { run: pollKey, pedagogy, format }, signal)).run, pedagogy, format),
      onRun: commit,
      onOffline: setOffline,
      onFatal: (e) => setError(e instanceof Error ? e.message : 'Something went wrong.'),
      isHidden: () => typeof document !== 'undefined' && document.hidden,
    });
    const onVisible = () => {
      if (!document.hidden) poller.wake();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      poller.stop();
      setOffline(false);
    };
  }, [pollKey, chapterId, pedagogy, format, commit]);

  const act = async (work: () => Promise<void>) => {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    setError('');
    try {
      await work();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      working.current = false;
      setBusy(false);
    }
  };

  const generate = () => act(async () => commit((await generateCpPresentation(chapterId, pedagogy, format)).run));
  // Approve and discard name the choice on screen; the server refuses a draft made for another one.
  const approve = () => act(async () => commit((await approveCpDraft(chapterId, runId, pedagogy, format)).run));
  /** The server refused to discard: the screen may be out of date (another window, or the run already ended), so it is refreshed from the server. */
  const refreshAfterRefused = async () => {
    try {
      commit(runForChoice((await fetchCpStatus(chapterId, { run: runId, pedagogy, format })).run, pedagogy, format));
    } catch {
      /* the error already shown stands */
    }
  };
  const discard = () =>
    act(async () => {
      try {
        await discardCpDraft(chapterId, runId, pedagogy, format);
      } catch (e) {
        await refreshAfterRefused();
        throw e;
      }
      commit(null);
      setReviewed(false);
    });
  // Try again is one deliberate click: drop the failed run, then start ONE new run for the same choice. Nothing retries by itself.
  const retry = () =>
    act(async () => {
      try {
        await discardCpDraft(chapterId, runId, pedagogy, format);
      } catch (e) {
        await refreshAfterRefused();
        throw e;
      }
      setReviewed(false);
      commit((await generateCpPresentation(chapterId, pedagogy, format)).run);
    });

  // Said once per change of stage, never per poll.
  const spoken = run ? announcement(run, noun) : '';
  const took = run?.progress_info?.duration_seconds;

  // The viewer is chosen by what the server says this format opens in AND what the stored item really is.
  const route = run?.state === 'stored' ? resolveViewer(fit.viewer_type, { deepLink: run.stored?.deep_link ?? null }) : null;

  return (
    <section data-testid="cp-generation" data-run-state={run?.state ?? 'none'} className="mt-4 rounded-md border border-slate-200 px-3 py-3 text-sm">
      <h3 className="font-semibold">Create</h3>
      {error && (
        <p role="alert" className="mt-2 rounded-md bg-red-50 px-3 py-2 text-red-800">
          {error}
        </p>
      )}

      {run === null && (
        <>
          <p className="mt-1 text-slate-600">
            Creating starts a draft in the background, shaped by the teaching method you chose. It uses the AI model and can take a while. Nothing is stored or shown to students until you have reviewed the draft and approved it.
          </p>
          {!fit.generation_supported && (
            <ul data-testid="cp-blockers" className="mt-2 list-disc space-y-0.5 pl-5 text-slate-700">
              {fit.generation_blockers.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          )}
          <button
            type="button"
            data-testid="cp-generate"
            disabled={!fit.generation_supported || busy}
            onClick={generate}
            className={cn('mt-3 rounded-md px-3 py-1.5 font-medium', fit.generation_supported && !busy ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'cursor-not-allowed bg-slate-200 text-slate-500')}
          >
            {busy ? 'Starting…' : 'Create'}
          </button>
        </>
      )}

      {/* One polite live region for the whole panel: it changes only when the stage or the outcome changes, so polling is silent. */}
      <p className="sr-only" role="status" aria-live="polite" data-testid="cp-announce">
        {spoken}
      </p>

      {run && (run.state === 'queued' || run.state === 'running' || (run.state === 'ready' && run.progress_info?.saving)) && (
        <GenerationProgress run={run} noun={noun} receivedAt={receivedAt} offline={offline} />
      )}

      {run?.state === 'failed' && (
        <div className="mt-2">
          <p role="alert" data-testid="cp-failed" data-failure-kind={run.progress_info?.failure?.kind ?? 'unknown'} className="rounded-md bg-amber-50 px-3 py-2 text-amber-900">
            <span className="font-medium">The {noun} could not be created.</span>{' '}
            {run.error || 'The draft could not be completed. The generation service did not provide a reason.'}
            {run.progress_info?.failure?.hint && <span className="mt-1 block">{run.progress_info.failure.hint}</span>}
            {took ? <span className="mt-1 block text-xs">It ran for {formatDuration(took)} before stopping. Nothing was stored.</span> : null}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {canRetry(run) && (
              <button type="button" data-testid="cp-retry" disabled={busy || !fit.generation_supported} onClick={retry} className={cn('rounded-md px-3 py-1.5 font-medium', busy || !fit.generation_supported ? 'cursor-not-allowed bg-slate-200 text-slate-500' : 'bg-indigo-600 text-white hover:bg-indigo-700')}>
                {busy ? 'Starting…' : 'Try again'}
              </button>
            )}
            <button type="button" disabled={busy} onClick={discard} className="rounded-md border border-slate-300 px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50">
              Discard and start over
            </button>
          </div>
        </div>
      )}

      {run?.state === 'ready' && !run.progress_info?.saving && (
        <div className="mt-2">
          <p className="rounded-md bg-emerald-50 px-3 py-2 text-emerald-900" role="status" data-testid="cp-draft-ready">
            <span className="font-medium">{story ? 'Story lesson draft created successfully.' : 'Draft created successfully.'}</span>{took ? ` Generated in ${formatDuration(took)}.` : ''}{' '}
            It is ready for your review. It passed validation, and it follows the teaching method you chose.
            {run.report && (
              <>
                {' '}
                {run.report.slides} slides, {run.report.interactive_slides} with an interaction
                {run.report.warnings > 0 ? `; ${run.report.warnings} note(s) for the reviewer` : ''}.
              </>
            )}
          </p>
          {run.progress_info?.timings && <TimingsDetails timings={run.progress_info.timings} />}
          {(() => {
            const cover = coverageSentence(run.coverage, run.report?.concepts ?? null);
            return (
              <p data-testid="cp-draft-coverage" data-verified={cover.verified ? 'yes' : 'no'} className={cn('mt-2', cover.verified ? 'text-slate-700' : 'rounded-md bg-amber-50 px-3 py-2 text-amber-900')}>
                {cover.text}
              </p>
            );
          })()}
          {run.images && (
            <p data-testid="cp-draft-images" className="mt-2 text-slate-700">
              Pictures: {run.images.referenced} placed ({run.images.diagrams} drawn diagram{run.images.diagrams === 1 ? '' : 's'}, {run.images.photographs} photograph{run.images.photographs === 1 ? '' : 's'}); all {run.images.resolved} can be read from the library.
              {run.images.photographs_not_found.length > 0 &&
                ` ${run.images.photographs_not_found.length} planned photograph(s) were not found; those slides use a drawn diagram or teach without a picture.`}
            </p>
          )}
          {run.outline && (
            <details className="mt-2">
              <summary className="cursor-pointer font-medium">{story ? 'Story outline' : 'Slide outline'}</summary>
              <ol className="mt-1 max-h-48 list-decimal space-y-0.5 overflow-y-auto pl-6 text-slate-700">
                {run.outline.map((s) => (
                  <li key={s.n} value={s.n}>
                    {s.title} <span className="text-xs text-slate-500">({s.type.replace(/_/g, ' ')})</span>
                  </li>
                ))}
              </ol>
            </details>
          )}
          <p className="mt-2">
            <a data-testid="cp-open-draft" href={draftAddress(chapterId, run.run)} target="_blank" rel="noreferrer" className="font-medium text-indigo-700 underline">
              {story ? 'Play the story draft in the study-deck player' : 'Open the draft in the study-deck player'}
            </a>{' '}
            <span className="text-slate-600">(opens a review copy; nothing is stored)</span>
          </p>
          <label className="mt-3 flex items-start gap-2">
            <input type="checkbox" checked={reviewed} onChange={(e) => setReviewed(e.target.checked)} className="mt-1" />
            <span>
              {story
                ? 'I have reviewed this story lesson and approve storing it for this chapter. It is stored as its own Interactive item, beside the Classroom Presentation, and does not replace it.'
                : 'I have reviewed this draft and approve storing it as the Course Presentation for this chapter.'}
            </span>
          </label>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              data-testid="cp-approve"
              disabled={!reviewed || busy}
              onClick={approve}
              className={cn('rounded-md px-3 py-1.5 font-medium', reviewed && !busy ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'cursor-not-allowed bg-slate-200 text-slate-500')}
            >
              {busy ? 'Working…' : 'Approve and store'}
            </button>
            <button type="button" disabled={busy} onClick={discard} className="rounded-md border border-slate-300 px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50">
              Discard draft
            </button>
          </div>
        </div>
      )}

      {run?.state === 'stored' && (
        <div className="mt-2">
          <p role="status" data-testid="cp-stored" className="rounded-md bg-emerald-50 px-3 py-2 text-emerald-900">
            <span className="font-medium">{story ? 'Story lesson created successfully.' : 'Presentation created successfully.'}</span>{took ? ` Generated in ${formatDuration(took)}.` : ''}{' '}
            {story ? 'The story lesson is stored for this chapter, beside the Classroom Presentation.' : 'The presentation is stored for this chapter.'}
            {run.stored?.images && run.stored.images.linked === run.stored.images.referenced && ` All ${run.stored.images.referenced} pictures are linked to it.`}
          </p>
          {run.stored?.images && run.stored.images.linked !== run.stored.images.referenced && (
            <p role="alert" data-testid="cp-unlinked" className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-amber-900">
              {run.stored.images.referenced - run.stored.images.linked} of {run.stored.images.referenced} pictures are not linked to the stored presentation. Ask an administrator to check them before the library is cleaned up.
            </p>
          )}
          {route?.ok ? (
            <button
              type="button"
              data-testid="cp-open"
              onClick={() => run.stored?.deep_link && onOpenPresentation(run.stored.deep_link)}
              className="mt-2 rounded-md bg-indigo-600 px-3 py-1.5 font-medium text-white hover:bg-indigo-700"
            >
              {story ? 'View story lesson' : 'View presentation'}
            </button>
          ) : (
            <p role="alert" className="mt-2 text-amber-900">
              {route?.reason ?? 'It cannot be opened from here.'}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
