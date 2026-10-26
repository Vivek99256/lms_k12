'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ArrowLeft, ArrowRight, Check, CheckCircle2, ClipboardCopy, Clock, FlaskConical, Printer, RotateCcw, ShieldAlert } from 'lucide-react';

import { blockById, type ActivityBlock, type ClassroomActivity, type CompareBlock, type ReportBlock, type StepUse, type TableBlock } from '@/lib/classroom-activity/activity';
import {
  blockStarted,
  checkKey,
  clearProgress,
  emptyProgress,
  finish,
  fillTokens,
  go,
  loadProgress,
  materialKey,
  reflectionKey,
  reportSections,
  saveProgress,
  setValue,
  statusOf,
  summaryText,
  toggleStep,
  type ActivityProgress,
} from '@/lib/classroom-activity/progress';
import { CompareBlockView, NotesBlockView, ReportBlockView, StepTimer, TableBlockView, TableInsight } from './blocks';

const BUTTON = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800 disabled:cursor-not-allowed disabled:opacity-50';
const PRIMARY = `${BUTTON} bg-emerald-800 text-white hover:bg-emerald-900`;
const SECONDARY = `${BUTTON} border border-slate-400 bg-white text-slate-900 hover:bg-slate-100`;
const CARD = 'rounded-2xl border border-slate-300 bg-white p-4 shadow-sm sm:p-5';

interface Props {
  activity: ClassroomActivity;
  /** The content_master row the activity came from; what its saved work is filed under. */
  contentId: number | string;
  userId: number | string | null;
  /** Review copies shown from a file are not stored anywhere, so they say so. */
  preview?: boolean;
}

/**
 * One interactive Classroom Activity.
 *
 * Introduction (purpose, objectives, materials, safety), then the task card's own steps one at a time with Back and Next,
 * each step marked done by the learner, the worksheet shown at the step that asks for it, and a review page that lists
 * what was done and recorded. It adds no content of its own: the steps, worksheets and prompts are the document's, and the
 * numbers and words in the worksheets are only ever what the learner types.
 *
 * What a learner enters stays in this browser (see lib/classroom-activity/progress.ts). The screen says so, and says when
 * the browser could not keep it, instead of implying it was sent to a teacher.
 */
export function ClassroomActivityPlayer({ activity, contentId, userId, preview = false }: Props) {
  const [progress, setProgress] = useState<ActivityProgress>(() => loadProgress(activity, contentId, userId));
  const [kept, setKept] = useState<boolean | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const first = useRef(true);
  // The newest progress, and whether the learner has changed anything since this screen opened.
  const latest = useRef(progress);
  const changed = useRef(false);
  useEffect(() => {
    latest.current = progress;
  }, [progress]);

  const update = (fn: (p: ActivityProgress) => ActivityProgress) => {
    changed.current = true;
    setProgress(fn);
  };
  const onValue = (key: string, value: string) => update((p) => setValue(p, key, value));

  // Keep the work: a short pause after the last keystroke, not a write per letter.
  useEffect(() => {
    if (!changed.current) return;
    const id = window.setTimeout(() => setKept(saveProgress(progress, contentId, userId)), 250);
    return () => window.clearTimeout(id);
  }, [progress, contentId, userId]);

  // The pause must never lose work: leaving the screen (Back, a link, closing the tab) writes what is waiting.
  useEffect(() => {
    const flush = () => {
      if (changed.current) saveProgress(latest.current, contentId, userId);
    };
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, [contentId, userId]);

  // After moving between parts, put the reader at the new heading (not on the first render).
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [progress.stage, progress.stepIndex]);

  const status = statusOf(activity, progress);
  const percent = Math.round((status.stepsDone / status.totalSteps) * 100);
  const blocks = useMemo(() => new Map(activity.blocks.map((b) => [b.id, b])), [activity]);

  return (
    <section aria-labelledby="ca-title" className="mx-auto w-full max-w-5xl space-y-4 text-slate-900">
      <header className={CARD}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <p className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide text-emerald-900">
              <FlaskConical className="h-4 w-4" aria-hidden="true" /> Classroom activity
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-950" data-testid="activity-code">
                {activity.code}
              </span>
            </p>
            <h1 id="ca-title" className="text-xl font-semibold leading-snug sm:text-2xl">
              {activity.title}
            </h1>
          </div>
          <StatusChip state={status.state} />
        </div>
        <div className="mt-3">
          <div className="flex items-center justify-between text-sm text-slate-800">
            <span>
              {status.stepsDone} of {status.totalSteps} steps done
            </span>
            <span className="tabular-nums">{percent}%</span>
          </div>
          <div role="progressbar" aria-label="Steps done" aria-valuemin={0} aria-valuemax={status.totalSteps} aria-valuenow={status.stepsDone} className="mt-1 h-2 overflow-hidden rounded-full bg-slate-200">
            <div className="h-full rounded-full bg-emerald-700 transition-[width] motion-reduce:transition-none" style={{ width: `${percent}%` }} />
          </div>
        </div>
        <nav aria-label="Parts of the activity" className="mt-3 flex flex-wrap gap-2 print:hidden">
          {(['intro', 'steps', 'review'] as const).map((stage) => (
            <button
              key={stage}
              type="button"
              onClick={() => update((p) => go(p, stage))}
              aria-current={progress.stage === stage ? 'step' : undefined}
              className={`${BUTTON} ${progress.stage === stage ? 'bg-slate-900 text-white' : 'border border-slate-400 bg-white text-slate-900 hover:bg-slate-100'}`}
            >
              {stage === 'intro' ? 'Introduction' : stage === 'steps' ? 'Steps' : 'Review'}
            </button>
          ))}
        </nav>
      </header>

      {progress.stage === 'intro' ? (
        <Intro activity={activity} progress={progress} headingRef={headingRef} onValue={onValue} onStart={() => update((p) => go(p, 'steps', p.stepIndex))} />
      ) : progress.stage === 'steps' ? (
        <Steps activity={activity} blocks={blocks} progress={progress} headingRef={headingRef} onValue={onValue} onToggle={(id) => update((p) => toggleStep(p, id))} onGo={(i) => update((p) => go(p, 'steps', i))} onReview={() => update((p) => go(p, 'review'))} onBack={() => update((p) => go(p, 'intro'))} />
      ) : (
        <Review
          activity={activity}
          progress={progress}
          headingRef={headingRef}
          onGoToStep={(i) => update((p) => go(p, 'steps', i))}
          onFinish={() => update((p) => finish(p))}
          onRestart={() => {
            if (!window.confirm('Start again? This clears what you recorded in this activity on this device.')) return;
            // Nothing is waiting to be written after this: the cleared state is the saved state.
            changed.current = false;
            clearProgress(contentId, userId);
            setProgress(emptyProgress());
          }}
        />
      )}

      <p role="status" className="text-xs text-slate-700 print:hidden" data-testid="save-note">
        {preview
          ? 'This is a review copy, not a stored activity. What you type stays on this screen and in this browser only.'
          : kept === false
            ? 'This browser could not keep your work. It will be lost when you close this page.'
            : 'What you type is saved in this browser only. It is not sent to your teacher or school.'}
      </p>
    </section>
  );
}

function StatusChip({ state }: { state: 'not_started' | 'in_progress' | 'completed' }) {
  if (state === 'completed') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-950">
        <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Completed
      </span>
    );
  }
  return <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-800">{state === 'in_progress' ? 'In progress' : 'Not started'}</span>;
}

// ---------------------------------------------------------------------------
// Introduction
// ---------------------------------------------------------------------------

function Intro({ activity, progress, headingRef, onValue, onStart }: { activity: ClassroomActivity; progress: ActivityProgress; headingRef: React.RefObject<HTMLHeadingElement | null>; onValue: (key: string, value: string) => void; onStart: () => void }) {
  const { intro } = activity;
  const checked = (key: string) => progress.values[key] === '1';
  const started = progress.stepsDone.length > 0 || progress.stepIndex > 0;

  return (
    <div className="space-y-4">
      <div className={`${CARD} space-y-4`}>
        <h2 ref={headingRef} tabIndex={-1} className="text-lg font-semibold outline-none">
          About this activity
        </h2>
        <p className="text-base leading-relaxed">{intro.purpose}</p>

        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700">What you will learn</h3>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-base">
            {intro.objectives.map((o, i) => (
              <li key={i}>{o.text}</li>
            ))}
          </ul>
        </div>

        {intro.duration?.minutes || intro.duration?.note ? (
          <p className="flex items-start gap-2 text-sm text-slate-900">
            <Clock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{intro.duration.minutes ? `About ${intro.duration.minutes} minutes. ` : ''}{intro.duration.note}</span>
          </p>
        ) : null}
      </div>

      {intro.materials.length > 0 ? (
        <div className={CARD}>
          <h3 className="text-base font-semibold">What you need</h3>
          <p className="text-sm text-slate-700">Tick each thing when you have it.</p>
          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
            {intro.materials.map((m, i) => (
              <li key={i} className="flex items-start gap-3">
                <input id={`ca-material-${i}`} type="checkbox" checked={checked(materialKey(i))} onChange={(e) => onValue(materialKey(i), e.target.checked ? '1' : '')} className="mt-1 h-5 w-5 accent-emerald-800" />
                <label htmlFor={`ca-material-${i}`} className="text-base">
                  {m.text}
                </label>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {intro.safety.length > 0 ? (
        <div className="rounded-2xl border-2 border-amber-600 bg-amber-50 p-4 sm:p-5" data-testid="safety">
          <h3 className="flex items-center gap-2 text-base font-semibold text-amber-950">
            <ShieldAlert className="h-5 w-5" aria-hidden="true" /> Stay safe
          </h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-base text-amber-950">
            {intro.safety.map((s, i) => (
              <li key={i}>{s.text}</li>
            ))}
          </ul>
          {intro.safety.some((s) => s.origin === 'platform') ? <p className="mt-2 text-xs text-amber-950">These safety notes were added by the platform. The task card itself does not list any.</p> : null}
          <div className="mt-3 flex items-start gap-3">
            <input id="ca-safety" type="checkbox" checked={checked(checkKey('safety'))} onChange={(e) => onValue(checkKey('safety'), e.target.checked ? '1' : '')} className="mt-1 h-5 w-5 accent-emerald-800" />
            <label htmlFor="ca-safety" className="text-base font-medium text-amber-950">
              I have read this and I will do the activity with my teacher.
            </label>
          </div>
        </div>
      ) : null}

      {activity.references && Object.keys(activity.references).length > 0 ? (
        <p className="text-xs text-slate-700">
          From the textbook: {Object.entries(activity.references).map(([k, v]) => `${k.replace(/_/g, ' ')} ${v}`).join(' · ')}
        </p>
      ) : null}

      <div className="flex justify-end print:hidden">
        <button type="button" onClick={onStart} className={PRIMARY}>
          {started ? 'Continue the activity' : 'Start the activity'} <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Steps
// ---------------------------------------------------------------------------

function Steps({
  activity,
  blocks,
  progress,
  headingRef,
  onValue,
  onToggle,
  onGo,
  onReview,
  onBack,
}: {
  activity: ClassroomActivity;
  blocks: Map<string, ActivityBlock>;
  progress: ActivityProgress;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  onValue: (key: string, value: string) => void;
  onToggle: (id: string) => void;
  onGo: (index: number) => void;
  onReview: () => void;
  onBack: () => void;
}) {
  const index = progress.stepIndex;
  const step = activity.steps[index];
  const done = new Set(progress.stepsDone);
  const last = index === activity.steps.length - 1;
  const reflections = activity.reflection.filter((r) => r.step === step.n);
  const expectedBlock = activity.expected?.requires ? blocks.get(activity.expected.requires) : undefined;
  const showExpected = activity.expected && activity.expected.step === step.n && (!expectedBlock || blockStarted(expectedBlock, progress.values));

  const stepList = (
    <ol className="space-y-1.5">
      {activity.steps.map((s, i) => (
        <li key={s.id}>
          <button
            type="button"
            onClick={() => onGo(i)}
            aria-current={i === index ? 'step' : undefined}
            aria-label={`Step ${s.n}${done.has(s.id) ? ', done' : ''}: ${s.text}`}
            className={`flex w-full items-start gap-2 rounded-lg border px-3 py-2 text-left text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-emerald-800 ${i === index ? 'border-emerald-800 bg-emerald-50 font-semibold' : 'border-slate-300 bg-white hover:bg-slate-50'}`}
          >
            <span aria-hidden="true" className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${done.has(s.id) ? 'bg-emerald-800 text-white' : 'bg-slate-200 text-slate-900'}`}>
              {done.has(s.id) ? <Check className="h-3.5 w-3.5" /> : s.n}
            </span>
            <span className="line-clamp-2 min-w-0 flex-1">{s.text}</span>
          </button>
        </li>
      ))}
    </ol>
  );

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[16rem_minmax(0,1fr)]">
      <nav aria-label="Steps" className="min-w-0 print:hidden">
        {/* On a phone the list would push the step itself far down the page, so it folds away; beside the step on a wide screen. */}
        <details className="rounded-lg border border-slate-300 bg-white lg:hidden">
          <summary className="min-h-11 cursor-pointer px-3 py-2.5 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-800">
            All steps ({progress.stepsDone.length} of {activity.steps.length} done)
          </summary>
          <div className="p-2">{stepList}</div>
        </details>
        <div className="hidden lg:block">{stepList}</div>
      </nav>

      <div className="min-w-0 space-y-4">
        <div className={`${CARD} space-y-4`}>
          <div>
            <p className="text-sm font-semibold text-emerald-900">
              Step {step.n} of {activity.steps.length}
            </p>
            <h2 ref={headingRef} tabIndex={-1} className="mt-1 text-lg font-semibold leading-snug outline-none sm:text-xl" data-testid="step-text">
              {step.text}
            </h2>
            {step.items?.length ? (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-base">
                {step.items.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            ) : null}
          </div>

          {step.timer ? <StepTimer key={step.id} seconds={step.timer.seconds} label={step.timer.label} /> : null}

          {(step.uses ?? []).map((use, i) => (
            <UsedBlock key={i} activity={activity} use={use} values={progress.values} onValue={onValue} insight={activity.expected?.step === step.n} />
          ))}

          {reflections.map((r) => (
            <div key={r.id} className="space-y-1">
              <label htmlFor={`ca-reflect-${r.id}`} className="block text-sm font-semibold">
                {r.prompt === step.text ? 'Your answer' : r.prompt}
              </label>
              <textarea
                id={`ca-reflect-${r.id}`}
                rows={4}
                value={progress.values[reflectionKey(r.id)] ?? ''}
                onChange={(e) => onValue(reflectionKey(r.id), e.target.value)}
                className="w-full rounded-lg border border-slate-400 bg-white px-3 py-2 text-base text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700 sm:text-sm"
              />
            </div>
          ))}

          {showExpected && activity.expected ? (
            <div className="rounded-xl border border-emerald-600 bg-emerald-50 p-3 text-emerald-950" data-testid="expected">
              <p className="font-semibold">{activity.expected.heading ?? 'What to notice'}</p>
              <p className="mt-1 text-sm">{activity.expected.text}</p>
            </div>
          ) : null}

          <div className="flex items-start gap-3 border-t border-slate-200 pt-3">
            <input id={`ca-done-${step.id}`} type="checkbox" checked={done.has(step.id)} onChange={() => onToggle(step.id)} className="mt-1 h-5 w-5 accent-emerald-800" />
            <label htmlFor={`ca-done-${step.id}`} className="text-base font-medium">
              I have done this step
            </label>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
          <button type="button" onClick={() => (index === 0 ? onBack() : onGo(index - 1))} className={SECONDARY}>
            <ArrowLeft className="h-4 w-4" aria-hidden="true" /> {index === 0 ? 'Introduction' : 'Back'}
          </button>
          {last ? (
            <button type="button" onClick={onReview} className={PRIMARY}>
              Review my work <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          ) : (
            <button type="button" onClick={() => onGo(index + 1)} className={PRIMARY}>
              Next <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** The worksheet (or the part of it) a step asks for. */
function UsedBlock({ activity, use, values, onValue, insight, readOnly = false }: { activity: ClassroomActivity; use: StepUse; values: Readonly<Record<string, string>>; onValue: (key: string, value: string) => void; insight?: boolean; readOnly?: boolean }) {
  const block = blockById(activity, use.block);
  if (!block) return null;
  const locked = readOnly || use.readOnly === true;

  if (block.kind === 'table') {
    return (
      <div className="space-y-2">
        <TableBlockView block={block} use={use} values={values} onChange={onValue} readOnly={locked} />
        {insight ? <TableInsight block={block} values={values} /> : null}
      </div>
    );
  }
  if (block.kind === 'compare') return <CompareBlockView block={block} use={use} values={values} onChange={onValue} readOnly={locked} />;
  if (block.kind === 'notes') return <NotesBlockView block={block} values={values} onChange={onValue} readOnly={locked} />;
  const from = blockById(activity, block.names_from);
  return from?.kind === 'compare' ? <ReportBlockView block={block} from={from} values={values} onChange={onValue} /> : null;
}

// ---------------------------------------------------------------------------
// Review
// ---------------------------------------------------------------------------

function Review({ activity, progress, headingRef, onGoToStep, onFinish, onRestart }: { activity: ClassroomActivity; progress: ActivityProgress; headingRef: React.RefObject<HTMLHeadingElement | null>; onGoToStep: (index: number) => void; onFinish: () => void; onRestart: () => void }) {
  const done = new Set(progress.stepsDone);
  const notDone = activity.steps.filter((s) => !done.has(s.id));
  const [copied, setCopied] = useState<'yes' | 'no' | null>(null);
  const text = summaryText(activity, progress);
  const finished = progress.completedAt !== null;

  const stepUsing = (blockId: string): number => Math.max(0, activity.steps.findIndex((s) => (s.uses ?? []).some((u) => u.block === blockId)));

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied('yes');
    } catch {
      setCopied('no');
    }
  };

  return (
    <div className="space-y-4">
      <div className={`${CARD} space-y-3`}>
        <h2 ref={headingRef} tabIndex={-1} className="text-lg font-semibold outline-none">
          Review your work
        </h2>
        <p className="text-base">
          {activity.steps.length - notDone.length} of {activity.steps.length} steps marked done.
        </p>
        {notDone.length > 0 ? (
          <div className="rounded-xl border border-amber-600 bg-amber-50 p-3 text-amber-950" data-testid="steps-not-done">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <AlertTriangle className="h-4 w-4" aria-hidden="true" /> Not marked done yet
            </p>
            <ul className="mt-1 space-y-1 text-sm">
              {notDone.map((s) => (
                <li key={s.id}>
                  <button type="button" onClick={() => onGoToStep(s.n - 1)} className="text-left font-medium underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-900 print:no-underline">
                    Step {s.n}: {s.text}
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs">You can still finish. These steps will be listed as not done.</p>
          </div>
        ) : null}
      </div>

      {activity.blocks.map((block) => (
        <ReviewBlock key={block.id} activity={activity} block={block} values={progress.values} onEdit={() => onGoToStep(stepUsing(block.id))} />
      ))}

      {activity.reflection.length > 0 ? (
        <div className={`${CARD} space-y-3`}>
          <h3 className="text-base font-semibold">Your discussion answers</h3>
          {activity.reflection.map((r) => (
            <div key={r.id}>
              <p className="text-sm font-medium text-slate-800">{r.prompt}</p>
              <p className="mt-1 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-base">{(progress.values[reflectionKey(r.id)] ?? '').trim() || <span className="text-slate-700">Not answered</span>}</p>
            </div>
          ))}
        </div>
      ) : null}

      <div className={`${CARD} space-y-3 print:hidden`}>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={copy} className={SECONDARY}>
            <ClipboardCopy className="h-4 w-4" aria-hidden="true" /> Copy my summary
          </button>
          <button type="button" onClick={() => window.print()} className={SECONDARY}>
            <Printer className="h-4 w-4" aria-hidden="true" /> Print
          </button>
          {finished ? (
            <button type="button" onClick={onRestart} className={SECONDARY}>
              <RotateCcw className="h-4 w-4" aria-hidden="true" /> Start again
            </button>
          ) : (
            <button type="button" onClick={onFinish} className={PRIMARY}>
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Finish activity
            </button>
          )}
        </div>
        <p role="status" className="text-sm" data-testid="finish-note">
          {copied === 'yes' ? 'Copied. You can paste it into a document.' : copied === 'no' ? 'Your browser would not copy it. Open the summary below and select the text.' : ''}
          {finished ? ' Activity finished. It shows as completed on this device only.' : ''}
        </p>
        <details>
          <summary className="cursor-pointer text-sm font-semibold">Show my summary as text</summary>
          <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm">{text}</pre>
        </details>
      </div>
    </div>
  );
}

function ReviewBlock({ activity, block, values, onEdit }: { activity: ClassroomActivity; block: ActivityBlock; values: Readonly<Record<string, string>>; onEdit: () => void }) {
  const ignore = () => undefined;
  const edit = (
    <button type="button" onClick={onEdit} className="text-sm font-semibold text-emerald-900 underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-800 print:hidden">
      Go back and edit
    </button>
  );

  if (block.kind === 'table') {
    return (
      <div className={`${CARD} space-y-2`}>
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-base font-semibold">{block.title}</h3>
          {edit}
        </div>
        <TableBlockView block={block as TableBlock} values={values} onChange={ignore} readOnly />
        <TableInsight block={block} values={values} />
      </div>
    );
  }
  if (block.kind === 'compare') {
    return (
      <div className={`${CARD} space-y-2`}>
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-base font-semibold">{block.title}</h3>
          {edit}
        </div>
        <CompareBlockView block={block as CompareBlock} use={{ block: block.id }} values={values} onChange={ignore} readOnly />
      </div>
    );
  }
  if (block.kind === 'notes') {
    const text = (values[`${block.id}/note`] ?? '').trim();
    return (
      <div className={`${CARD} space-y-2`}>
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-base font-semibold">{block.label}</h3>
          {edit}
        </div>
        <p className="whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-base">{text || <span className="text-slate-700">Nothing written</span>}</p>
        {activity.expected && activity.expected.requires === block.id && text ? (
          <div className="rounded-xl border border-emerald-600 bg-emerald-50 p-3 text-emerald-950">
            <p className="font-semibold">{activity.expected.heading ?? 'What to notice'}</p>
            <p className="mt-1 text-sm">{activity.expected.text}</p>
          </div>
        ) : null}
      </div>
    );
  }
  const from = blockById(activity, block.names_from) as CompareBlock;
  const report = block as ReportBlock;
  const fill = (t: string) => fillTokens(t, report, from, values);
  return (
    <div className={`${CARD} space-y-3`}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-base font-semibold">{fill(report.title_template)}</h3>
        {edit}
      </div>
      {reportSections(report, values).map((s) => {
        const section = report.sections.find((x) => x.id === s.id)!;
        return (
          <div key={s.id}>
            <p className="text-sm font-semibold">{fill(section.label)}</p>
            {s.entries.length ? (
              <ol className="mt-1 list-decimal space-y-1 pl-6 text-base">
                {s.entries.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ol>
            ) : (
              <p className="mt-1 text-sm text-slate-700">Nothing written</p>
            )}
            {!s.ok ? (
              <p className="mt-1 text-xs font-medium text-amber-950">
                The task card asks for {section.min === section.max ? section.min : `${section.min}–${section.max}`}; you wrote {s.count}.
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
