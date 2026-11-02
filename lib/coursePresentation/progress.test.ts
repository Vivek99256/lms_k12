import assert from 'node:assert/strict';
import test from 'node:test';

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { GenerationPanel } from '../../components/coursePresentation/GenerationPanel';
import { CoursePresentationApiError, type CpFit, type CpProgressInfo, type CpRun } from './api';
import { startRunPoller } from './poller';
import { announcement, canRetry, estimateText, finishedOutcome, formatDuration, liveElapsed, nextPollDelay, queueMessage, shouldPoll, stageSentence } from './progress';

const KEYS = ['queued', 'prepare', 'content', 'images', 'interact', 'validate', 'verify', 'ready'];
const LABELS: Record<string, string> = {
  queued: 'Request accepted',
  prepare: 'Preparing chapter content',
  content: 'Generating content',
  images: 'Planning and resolving images',
  interact: 'Choosing interactions',
  validate: 'Validating the presentation',
  verify: 'Final verification',
  ready: 'Ready for review',
};

/** The server's description of a run at a stage: stages before it are done, it is current, the rest wait. */
const info = (stage: string, over: Partial<CpProgressInfo> = {}): CpProgressInfo => {
  const at = KEYS.indexOf(stage);
  return {
    lifecycle: 'processing',
    stage,
    stages: KEYS.map((key, i) => ({ key, label: LABELS[key], description: `${key} description`, status: i < at ? 'done' : i === at ? 'current' : 'pending', at: null })),
    percent: Math.floor((100 * at) / KEYS.length),
    percent_basis: 'stages',
    started_at: '2026-10-26T17:00:00+05:30',
    finished_at: null,
    elapsed_seconds: 120,
    duration_seconds: null,
    estimate: { available: false },
    saving: false,
    queue: null,
    failure: null,
    ...over,
  };
};

const RUN = 'ra426fa8762b0';
const run = (state: CpRun['state'], progress_info: CpProgressInfo | undefined, over: Partial<CpRun> = {}): CpRun =>
  ({
    run: RUN,
    state,
    method: 'inquiry_based',
    format: 'interactive_slides',
    created_at: '2026-10-26T16:46:50+05:30',
    progress: [],
    error: null,
    report: null,
    outline: null,
    images: null,
    stored: null,
    progress_info,
    ...over,
  }) as unknown as CpRun;

const queued = (over: Partial<CpProgressInfo> = {}) => run('queued', info('queued', { lifecycle: 'queued', percent: 0, started_at: null, elapsed_seconds: null, queue: { waiting_seconds: 5, worker: 'active' }, ...over }));

const panel = (initialRun: CpRun | null) =>
  renderToStaticMarkup(
    createElement(GenerationPanel, {
      chapterId: 8592,
      pedagogy: 'inquiry_based',
      format: 'interactive_slides',
      fit: { viewer_type: 'study_deck', generation_supported: true, generation_blockers: [] } as unknown as CpFit,
      initialRun,
      onOpenPresentation: () => {},
    }),
  );

// ---------------------------------------------------------------------------------------------------------------------
// Words and rules

test('durations read as seconds, minutes and hours', () => {
  assert.equal(formatDuration(45), '45 s');
  assert.equal(formatDuration(7 * 60), '7 min');
  assert.equal(formatDuration(65 * 60), '1 h 5 min');
  assert.equal(formatDuration(3 * 3600), '3 h');
});

test('there is no time estimate until the server has one: it says it is calculating', () => {
  assert.equal(estimateText(info('content')), 'Calculating estimated time…');
});

test('an estimate is a range, an exhausted one says it is taking longer, and nothing is promised', () => {
  const range = info('content', { estimate: { available: true, min_seconds: 400, max_seconds: 600, samples: 4 } });
  assert.equal(estimateText(range), 'About 7–10 min remaining (estimate)');
  assert.equal(estimateText(info('content', { estimate: { available: true, min_seconds: 30, max_seconds: 50 } })), 'Less than a minute remaining (estimate)');
  assert.equal(estimateText(info('content', { estimate: { available: true, overdue: true, min_seconds: 0, max_seconds: 0 } })), 'Taking longer than usual. Still working.');
});

test('elapsed time keeps counting between readings only while the run is processing', () => {
  const running = info('content', { elapsed_seconds: 100 });
  assert.equal(liveElapsed(running, 1_000, 31_000), 130);
  assert.equal(liveElapsed(info('ready', { lifecycle: 'completed', elapsed_seconds: 900 }), 1_000, 99_000), 900, 'a finished run stops counting');
  assert.equal(liveElapsed(info('queued', { lifecycle: 'queued', elapsed_seconds: null }), 0, 9_000), null, 'a queued run has no elapsed time');
});

test('a queued run says whether a worker is there and never claims it has started', () => {
  const notDetected = (waiting: number) => queued({ queue: { waiting_seconds: waiting, worker: 'not_detected' } }).progress_info as CpProgressInfo;
  assert.match(queueMessage(notDetected(5)), /waiting for a background worker/);
  const longWait = queueMessage(notDetected(16 * 60));
  assert.match(longWait, /no background worker has picked it up/);
  assert.match(longWait, /16 min/);
  assert.match(longWait, /administrator/);
  assert.match(queueMessage(queued({ queue: { waiting_seconds: 3, worker: 'busy' } }).progress_info as CpProgressInfo), /another generation/);
  assert.doesNotMatch(longWait, /generating|running/i);
});

test('the stage sentence names the real position', () => {
  assert.equal(stageSentence(info('content')), 'Step 3 of 8: Generating content');
});

// ---------------------------------------------------------------------------------------------------------------------
// Polling rules

test('only a run being made, or saved, is polled', () => {
  assert.equal(shouldPoll(queued()), true);
  assert.equal(shouldPoll(run('running', info('content'))), true);
  assert.equal(shouldPoll(run('ready', info('ready', { lifecycle: 'completed' }))), false);
  assert.equal(shouldPoll(run('ready', info('ready', { lifecycle: 'saving', saving: true }))), true);
  for (const state of ['stored', 'failed', 'discarded'] as const) assert.equal(shouldPoll(run(state, undefined)), false, state);
  assert.equal(shouldPoll(null), false);
});

test('polling slows while waiting, backs off after failures, slows in a hidden tab and stops when finished', () => {
  const r = run('running', info('content'));
  assert.equal(nextPollDelay(r, 0, false), 4000);
  assert.equal(nextPollDelay(queued(), 0, false), 5000);
  assert.equal(nextPollDelay(r, 2, false), 16000);
  assert.equal(nextPollDelay(r, 9, false), 30000, 'never slower than 30 s');
  assert.equal(nextPollDelay(r, 0, true), 15000);
  assert.equal(nextPollDelay(run('stored', undefined), 0, false), null);
});

test('the teacher is told once, at the moment a run being made finishes or fails', () => {
  const running = run('running', info('content'));
  assert.equal(finishedOutcome(queued(), running), null);
  assert.equal(finishedOutcome(running, run('ready', info('ready', { lifecycle: 'completed' }))), 'completed');
  assert.equal(finishedOutcome(run('ready', info('ready')), run('stored', undefined)), 'completed', 'approval is the second moment');
  assert.equal(finishedOutcome(running, run('failed', undefined)), 'failed');
  assert.equal(finishedOutcome(run('ready', undefined), run('ready', undefined)), null, 'a repeated reading says nothing');
  assert.equal(finishedOutcome(null, run('ready', undefined)), null, 'a run first seen finished (page refresh) is not news');
  assert.equal(finishedOutcome(running, { ...run('ready', undefined), run: 'r000000000000' }), null, 'another run is never reported as this one');
});

test('a run is announced to assistive technology by its stage, not by every reading', () => {
  assert.equal(announcement(queued(), 'presentation'), 'The presentation request is queued.');
  assert.equal(announcement(run('running', info('images')), 'presentation'), 'Generating the presentation. Step 4 of 8: Planning and resolving images');
  assert.equal(announcement(run('stored', undefined), 'presentation'), 'The presentation was created successfully.');
});

test('a failure is retried only when the server says trying again may help, and never by itself', () => {
  const failed = (retryable: boolean) => run('failed', info('images', { lifecycle: 'failed', percent: null, failure: { kind: 'quota', retryable, hint: 'x' } }));
  assert.equal(canRetry(failed(true)), true);
  assert.equal(canRetry(failed(false)), false);
  assert.equal(canRetry(run('running', info('content'))), false);
});

// ---------------------------------------------------------------------------------------------------------------------
// The poller: cleanup, one request at a time, network failure

const fakeTimers = () => {
  const pending = new Map<number, { fn: () => void; ms: number }>();
  let id = 0;
  return {
    pending,
    timers: { set: (fn: () => void, ms: number) => (pending.set(++id, { fn, ms }), id), clear: (i: unknown) => void pending.delete(i as number) },
    fire: async () => {
      const [k, t] = [...pending.entries()][0];
      pending.delete(k);
      t.fn();
      await new Promise((r) => setImmediate(r));
    },
  };
};

test('the poller follows a run to its end and then stops asking', async () => {
  const t = fakeTimers();
  const seen: CpRun[] = [];
  const answers = [run('running', info('content')), run('ready', info('ready', { lifecycle: 'completed' }))];
  let requests = 0;
  startRunPoller({ initial: queued(), load: async () => answers[requests++], onRun: (r) => seen.push(r), onOffline: () => {}, onFatal: () => assert.fail('no fatal'), timers: t.timers });

  assert.equal(t.pending.size, 1);
  await t.fire();
  assert.equal(seen.at(-1)?.state, 'running');
  assert.equal(t.pending.size, 1, 'still being made: asks again');
  await t.fire();
  assert.equal(seen.at(-1)?.state, 'ready');
  assert.equal(t.pending.size, 0, 'finished: no further timer, no further request');
  assert.equal(requests, 2);
});

test('stopping cancels the timer and the request in flight', async () => {
  const t = fakeTimers();
  let aborted = false;
  const poller = startRunPoller({
    initial: queued(),
    load: (signal) => new Promise((_, reject) => signal.addEventListener('abort', () => ((aborted = true), reject(Object.assign(new Error('x'), { name: 'AbortError' }))))),
    onRun: () => assert.fail('nothing arrives after stop'),
    onOffline: () => assert.fail('an abort is not a network failure'),
    onFatal: () => assert.fail('an abort is not fatal'),
    timers: t.timers,
  });
  await t.fire();
  poller.stop();
  await new Promise((r) => setImmediate(r));
  assert.equal(aborted, true);
  assert.equal(t.pending.size, 0);
  poller.stop();
});

test('network failures back off and say so after two; the run is untouched and polling carries on', async () => {
  const t = fakeTimers();
  const offline: boolean[] = [];
  let calls = 0;
  startRunPoller({
    initial: run('running', info('content')),
    load: async () => {
      calls += 1;
      if (calls <= 2) throw new TypeError('Failed to fetch');
      return run('running', info('images'));
    },
    onRun: () => {},
    onOffline: (o) => offline.push(o),
    onFatal: () => assert.fail('a lost connection is not fatal'),
    timers: t.timers,
  });
  await t.fire();
  assert.deepEqual(offline, [], 'one failure is not yet news');
  assert.equal([...t.pending.values()][0].ms, 8000, 'backing off');
  await t.fire();
  assert.deepEqual(offline, [true]);
  assert.equal([...t.pending.values()][0].ms, 16000);
  await t.fire();
  assert.deepEqual(offline, [true, false], 'the next answer clears it');
});

test('a refusal from the server (session over, run gone) stops polling', async () => {
  const t = fakeTimers();
  const fatal: unknown[] = [];
  startRunPoller({
    initial: queued(),
    load: async () => {
      throw new CoursePresentationApiError('That draft was not found.', 404);
    },
    onRun: () => {},
    onOffline: () => {},
    onFatal: (e) => fatal.push(e),
    timers: t.timers,
  });
  await t.fire();
  assert.equal(fatal.length, 1);
  assert.equal(t.pending.size, 0);
});

// ---------------------------------------------------------------------------------------------------------------------
// What the panel shows

test('a queued run no longer says only "Waiting to start": it shows the request, the worker and the stages', () => {
  const html = panel(queued({ queue: { waiting_seconds: 16 * 60, worker: 'not_detected' } }));
  assert.doesNotMatch(html, /Waiting to start/);
  assert.match(html, /request is queued/);
  assert.match(html, /no background worker has picked it up yet/);
  assert.match(html, /data-lifecycle="queued"/);
  assert.match(html, /Request accepted/);
  assert.doesNotMatch(html, /role="progressbar"/, 'no bar before anything has started');
});

test('a running run shows the real stage, a bar of finished stages, the elapsed time and that no estimate exists yet', () => {
  const html = panel(run('running', info('images', { elapsed_seconds: 190 }), { progress: ['images   slide 3: drawn diagram'] }));
  assert.match(html, /role="progressbar"/);
  assert.match(html, /aria-valuenow="37"/);
  assert.match(html, /3 of 8 stages finished/);
  assert.match(html, /Elapsed: 3 min/);
  assert.match(html, /Calculating estimated time…/);
  assert.match(html, /aria-current="step"/);
  assert.match(html, /data-status="done"[^>]*>[\s\S]*?Request accepted/);
  assert.match(html, /Step 4 of 8: Planning and resolving images/, 'announced by the stage');
  assert.match(html, /You can close this window/);
});

test('a running run with history shows a range, never a single promised time', () => {
  const html = panel(run('running', info('content', { estimate: { available: true, min_seconds: 400, max_seconds: 600, samples: 5 } })));
  assert.match(html, /About 7–10 min remaining \(estimate\)/);
  assert.doesNotMatch(html, /Calculating/);
});

test('a finished draft says it was created, how long it took, and opens the draft of THIS run', () => {
  const html = panel(run('ready', info('ready', { lifecycle: 'completed', percent: 100, duration_seconds: 754 })));
  assert.match(html, /Draft created successfully/);
  assert.match(html, /Generated in 13 min/);
  assert.match(html, new RegExp(`href="/student/study-deck/8592\\?draft=${RUN}"`));
  assert.doesNotMatch(html, /role="progressbar"/);
});

test('a stored presentation says "Presentation created successfully" and the button opens its own deep link', () => {
  const html = panel(run('stored', info('ready', { lifecycle: 'completed', percent: 100, duration_seconds: 600 }), { stored: { deep_link: '/student/study-deck/8592?content=61700', images: { referenced: 3, linked: 3 } } }));
  assert.match(html, /Presentation created successfully/);
  assert.match(html, /Generated in 10 min/);
  assert.match(html, /View presentation/);
});

test('a run being saved shows saving, not an approve button', () => {
  const html = panel(run('ready', info('ready', { lifecycle: 'saving', saving: true, percent: 100 })));
  assert.match(html, /Saving the presentation/);
  assert.doesNotMatch(html, /cp-approve/);
});

test('a failure shows what happened, the kind, a hint, how long it ran, and a retry only when it can help', () => {
  const failure = { kind: 'quota' as const, retryable: true, hint: 'The AI model is at its usage limit. Try again later.' };
  const html = panel(run('failed', info('content', { lifecycle: 'failed', percent: null, duration_seconds: 300, failure }), { error: 'Gemini daily quota exhausted' }));
  assert.match(html, /could not be created/);
  assert.match(html, /Gemini daily quota exhausted/);
  assert.match(html, /data-failure-kind="quota"/);
  assert.match(html, /usage limit/);
  assert.match(html, /ran for 5 min/);
  assert.match(html, /data-testid="cp-retry"/);
  assert.match(html, /Discard and start over/);

  const permanent = panel(run('failed', info('validate', { lifecycle: 'failed', percent: null, failure: { kind: 'validation', retryable: false, hint: 'x' } }), { error: 'The generated deck did not pass validation: x' }));
  assert.doesNotMatch(permanent, /cp-retry/);
});

test('a run made for another teaching method is no run here', () => {
  const html = panel(run('running', info('content'), { method: 'experiential' }));
  assert.match(html, /data-run-state="none"/);
  assert.doesNotMatch(html, /cp-progress/);
});

test('a server that predates progress reporting still shows its state', () => {
  const html = panel(run('running', undefined));
  assert.match(html, /Generating the presentation…/);
});
