'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { ArrowLeft, CheckCircle2, Clock, Drama, Eye, FlaskConical, HelpCircle, MessagesSquare, PenLine, Puzzle, Users, type LucideIcon } from 'lucide-react';

import { ActivityCard } from '@/components/study-deck/ActivityCard';
import { VisualFigure } from '@/components/study-deck/VisualFigure';
import { resolvePart } from '@/lib/study-document/document';
import {
  ACTIVITY_STEPS,
  JOURNEYS,
  activityStatus,
  activityStepKey,
  activitySteps,
  interactionStepOf,
  materialKey,
  missKey,
  okKey,
  performKey,
  pickKey,
  resultActions,
  retryActions,
  share,
  slotNoteKey,
  slotsOf,
  type ActivityStep,
} from '@/lib/study-document/journey';
import { discussionOf, interactionDoneKey, reflectionOf } from '@/lib/study-document/online';
import type { ActivityPart } from '@/lib/study-document/types';
import { Chip, ENTER, JourneyFrame, NextButton, type FrameStep } from './JourneyFrame';
import { InteractionStage } from './InteractionStage';
import { Plays } from './PlayGame';
import type { ShellProps } from './RevisionNotebook';

/** How each kind of activity looks and what it asks of the learner. The words are general: the activity's own text carries the subject. */
const FORMATS: Record<string, { label: string; icon: LucideIcon; tint: string; predict: string; record: string; recordHint: string }> = {
  inquiry: { label: 'Experiment', icon: FlaskConical, tint: 'bg-emerald-100 text-emerald-950 border-emerald-300', predict: 'What do you think will happen, and why?', record: 'What did you observe?', recordHint: 'Write what you saw and any numbers you measured.' },
  problem_solving: { label: 'Problem solving', icon: Puzzle, tint: 'bg-sky-100 text-sky-950 border-sky-300', predict: 'What is your first idea for solving it?', record: 'What was your solution?', recordHint: 'Write your answer and the steps you took.' },
  discussion: { label: 'Discussion', icon: MessagesSquare, tint: 'bg-rose-100 text-rose-950 border-rose-300', predict: 'What do you think before the talk starts?', record: 'What did your group agree on?', recordHint: 'Write the main points.' },
  quiz: { label: 'Quiz', icon: HelpCircle, tint: 'bg-amber-100 text-amber-950 border-amber-300', predict: 'Which ones do you expect to find hardest?', record: 'How did it go?', recordHint: 'Write your score and what you missed.' },
  role_play: { label: 'Role play', icon: Drama, tint: 'bg-fuchsia-100 text-fuchsia-950 border-fuchsia-300', predict: 'What do you think your role has to do?', record: 'What did you notice?', recordHint: 'Write what your role did and what you learned from the others.' },
  reflection: { label: 'Reflection', icon: PenLine, tint: 'bg-indigo-100 text-indigo-950 border-indigo-300', predict: 'What do you already feel sure about?', record: 'What is your answer?', recordHint: 'Write it in your own words.' },
};
const FALLBACK_FORMAT = { label: 'Activity', icon: PenLine, tint: 'bg-slate-100 text-slate-900 border-slate-300', predict: 'What do you think will happen?', record: 'What did you notice?', recordHint: 'Write it in your own words.' };
const formatOf = (part: ActivityPart) => FORMATS[part.content.format] ?? { ...FALLBACK_FORMAT, label: part.content.format.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()) || FALLBACK_FORMAT.label };

const GROUPING: Record<string, string> = { individual: 'On your own', pair: 'In pairs', group: 'In a group', whole_class: 'Whole class' };
const groupingOf = (part: ActivityPart) => GROUPING[part.content.grouping] ?? part.content.grouping.replace(/_/g, ' ');

/** "Students will explain X" -> "Explain X": what the learner is working towards, in the learner's voice. */
const goal = (text: string) => text.trim().replace(/^students (will|should|are able to|can)\s+/i, '').replace(/^./, (c) => c.toUpperCase());

/** Whether an activity is done on the bench rather than on screen: the screen then guides and records, it does not replace it. */
const isPhysical = (part: ActivityPart) => part.content.format === 'inquiry' || part.content.format === 'role_play';

const STEP_LABEL: Record<ActivityStep, string> = { predict: 'Predict', perform: 'Perform', record: 'Record', discuss: 'Discuss' };

/**
 * Classroom activities as a workspace: a board of activity cards, and for the one that is opened, Predict, Perform, Record,
 * Discuss. It adds no content. The materials, steps, objectives, expected outcomes, questions and interactions are the
 * activity's own; this lays them out as a sequence the learner works through, keeps what they predict and record, and shows
 * the expected result only once they have written their own.
 *
 * A physical experiment is not done on the screen: the screen says so, lists what to gather, and then waits for the learner
 * to come back with what they saw.
 */
export function ActivityWorkspace({ doc, parts, bank, done, notes, dispatch, audience }: ShellProps) {
  const journey = JOURNEYS.activities;
  const activities = useMemo(() => parts.filter((p): p is ActivityPart => p.type === 'activity'), [parts]);
  const [openN, setOpenN] = useState<number | null>(null);
  const [step, setStep] = useState<ActivityStep>('predict');
  const current = activities.find((a) => a.n === openN) ?? null;

  const finished = activities.filter((a) => activityStatus(a, done).status === 'done').length;
  const stepsDone = activities.reduce((n, a) => n + activityStatus(a, done).steps, 0);
  const percent = share({ done: stepsDone, total: activities.length * ACTIVITY_STEPS.length });

  const openActivity = (n: number) => {
    const part = activities.find((a) => a.n === n);
    if (!part) return;
    const states = activitySteps(part, done);
    setOpenN(n);
    // Continue where the learner left off: the first step that is not finished.
    setStep(ACTIVITY_STEPS.find((s) => !states[s]) ?? 'predict');
  };

  const states = current ? activitySteps(current, done) : null;
  const steps: FrameStep[] = [
    { id: 'choose', label: 'Choose', does: 'Pick an activity', state: current ? 'done' : 'current', count: `${finished}/${activities.length}` },
    ...ACTIVITY_STEPS.map((s): FrameStep => {
      const w = journey.workflow.find((x) => x.id === s);

      return { id: s, label: STEP_LABEL[s], does: w?.does ?? '', state: !current ? 'todo' : s === step ? 'current' : states?.[s] ? 'done' : 'todo', disabled: !current };
    }),
  ];

  const mark = (part: ActivityPart, s: ActivityStep) => dispatch({ type: 'done', key: activityStepKey(part, s) });
  const goNext = (part: ActivityPart, from: ActivityStep) => {
    mark(part, from);
    const at = ACTIVITY_STEPS.indexOf(from);
    if (at < ACTIVITY_STEPS.length - 1) setStep(ACTIVITY_STEPS[at + 1]);
  };

  return (
    <JourneyFrame
      journey={journey}
      progress={percent}
      progressLabel={`${finished} of ${activities.length} activities done`}
      steps={steps}
      onStep={(id) => {
        if (id === 'choose') setOpenN(null);
        else setStep(id as ActivityStep);
      }}
      testId="activity-workspace"
    >
      <div className="h-full min-h-0 overflow-y-auto p-3 sm:p-5" data-testid="workspace-page">
        {current ? (
          <div key={`${current.n}-${step}`} className={`mx-auto max-w-4xl space-y-4 ${ENTER}`}>
            <ActivityHeader part={current} done={done} onBack={() => setOpenN(null)} />
            {step === 'predict' ? (
              <PredictStep part={current} bank={bank} done={done} notes={notes} dispatch={dispatch} onNext={() => goNext(current, 'predict')} />
            ) : step === 'perform' ? (
              <PerformStep part={current} done={done} dispatch={dispatch} audience={audience} onNext={() => setStep('record')} complete={states?.perform ?? false} />
            ) : step === 'record' ? (
              <RecordStep part={current} done={done} notes={notes} dispatch={dispatch} onSave={() => mark(current, 'record')} onNext={() => setStep('discuss')} />
            ) : (
              <DiscussStep
                part={current}
                bank={bank}
                done={done}
                notes={notes}
                dispatch={dispatch}
                doc={doc}
                onFinish={() => mark(current, 'discuss')}
                next={activities[activities.findIndex((a) => a.n === current.n) + 1] ?? null}
                onOpenNext={openActivity}
                onBoard={() => setOpenN(null)}
              />
            )}
          </div>
        ) : (
          <Board activities={activities} done={done} totalMinutes={activities.reduce((n, a) => n + a.content.minutes, 0)} onOpen={openActivity} />
        )}
      </div>
    </JourneyFrame>
  );
}

// ---------------------------------------------------------------------------
// The board
// ---------------------------------------------------------------------------

function Board({ activities, done, totalMinutes, onOpen }: { activities: ActivityPart[]; done: ReadonlySet<string>; totalMinutes: number; onOpen: (n: number) => void }) {
  return (
    <div className={`mx-auto max-w-5xl space-y-4 ${ENTER}`}>
      <header className="space-y-1">
        <p className="text-xs font-bold uppercase tracking-wider text-sd-strong">Step 1 · Choose</p>
        <h2 className="text-xl font-semibold tracking-tight text-slate-900">Choose an activity</h2>
        <p className="text-sm text-slate-800">
          {activities.length} activities · about {totalMinutes} minutes in all. Each one has four steps: predict, perform, record, discuss.
        </p>
      </header>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="activity-board">
        {activities.map((a) => {
          const format = formatOf(a);
          const Icon = format.icon;
          const status = activityStatus(a, done);
          const goals = a.content.objectives.map((o) => goal(o.text)).filter(Boolean);

          return (
            <li key={a.n}>
              <button
                type="button"
                onClick={() => onOpen(a.n)}
                aria-label={`${a.title}. ${format.label}, ${a.content.minutes} minutes. ${status.status === 'done' ? 'Done' : status.status === 'in_progress' ? 'In progress' : 'Not started'}.`}
                className="group flex h-full w-full flex-col gap-2 rounded-2xl border-2 border-sd-line bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-sd-accent hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sd-accent motion-reduce:transition-none motion-reduce:hover:translate-y-0"
              >
                <span className="flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-bold ${format.tint}`}>
                    <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                    {format.label}
                  </span>
                  <span className="ml-auto text-xs font-semibold tabular-nums text-slate-700">#{a.n}</span>
                </span>
                <span className="text-base font-semibold leading-snug text-slate-900">{a.title}</span>
                <span className="flex flex-wrap gap-x-3 gap-y-1 text-xs font-medium text-slate-800">
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                    {a.content.minutes} min
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" aria-hidden="true" />
                    {groupingOf(a)}
                  </span>
                </span>
                {goals.length > 0 ? (
                  <span className="block text-sm text-slate-800">
                    <span className="block text-xs font-bold uppercase tracking-wider text-sd-strong">You will</span>
                    <span className="block">{goals[0]}</span>
                    {goals.length > 1 ? <span className="block text-xs text-slate-700">and {goals.length - 1} more</span> : null}
                  </span>
                ) : null}
                <span className="mt-auto flex items-center justify-between gap-2 pt-1">
                  <span className="flex gap-1" aria-hidden="true">
                    {ACTIVITY_STEPS.map((s) => (
                      <span key={s} className={`h-1.5 w-6 rounded-full ${activitySteps(a, done)[s] ? 'bg-sd-accent' : 'bg-sd-soft'}`} />
                    ))}
                  </span>
                  {status.status === 'done' ? (
                    <Chip tone="good">
                      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                      Done
                    </Chip>
                  ) : (
                    <span className="text-sm font-semibold text-sd-strong group-hover:underline">{status.status === 'in_progress' ? `Continue (${status.steps}/${status.of})` : 'Start'}</span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ActivityHeader({ part, done, onBack }: { part: ActivityPart; done: ReadonlySet<string>; onBack: () => void }) {
  const format = formatOf(part);
  const Icon = format.icon;
  const status = activityStatus(part, done);

  return (
    <header className="space-y-2">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-sm font-semibold text-sd-strong hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sd-accent">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        All activities
      </button>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-bold ${format.tint}`}>
          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
          {format.label}
        </span>
        <Chip tone="plain">
          <Clock className="h-3 w-3" aria-hidden="true" />
          {part.content.minutes} min
        </Chip>
        <Chip tone="plain">
          <Users className="h-3 w-3" aria-hidden="true" />
          {groupingOf(part)}
        </Chip>
        {status.status === 'done' ? <Chip tone="good">Done</Chip> : null}
      </div>
      <h2 className="text-xl font-semibold tracking-tight text-slate-900">{part.title}</h2>
    </header>
  );
}

function Card({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="space-y-3 rounded-2xl border border-sd-line bg-white p-4 shadow-sm sm:p-5" aria-label={title}>
      <header>
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        {hint ? <p className="mt-0.5 text-sm text-slate-700">{hint}</p> : null}
      </header>
      {children}
    </section>
  );
}

function Write({ id, label, hint, value, onChange, rows = 3 }: { id: string; label: string; hint?: string; value: string; onChange: (text: string) => void; rows?: number }) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium text-slate-900">
        {label}
      </label>
      {hint ? <p className="text-xs text-slate-700">{hint}</p> : null}
      <textarea id={id} rows={rows} value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-sm text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sd-accent" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Predict
// ---------------------------------------------------------------------------

type StepProps = {
  part: ActivityPart;
  done: ReadonlySet<string>;
  notes: Readonly<Record<string, string>>;
  dispatch: ShellProps['dispatch'];
};

function PredictStep({ part, notes, done, dispatch, onNext }: StepProps & { bank: ShellProps['bank']; onNext: () => void }) {
  const format = formatOf(part);
  const slots = slotsOf(part);
  const m = part.content.misconception;
  const written = slots.some((s) => (notes[slotNoteKey(part, 'predict', s.id)] ?? '').trim());
  // A wrong idea and the correction, offered as two statements to choose between. Which comes first alternates with the activity.
  const options = m && m.wrong_idea.trim() && m.correction.trim() ? (part.n % 2 === 0 ? [m.correction, m.wrong_idea] : [m.wrong_idea, m.correction]) : null;
  const picked = done.has(okKey(pickKey(part))) || done.has(missKey(pickKey(part)));
  const [choice, setChoice] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <Card title="What this is about">
        <p className="text-sm leading-relaxed text-slate-900">{part.content.focus}</p>
      </Card>

      {options && m ? (
        <Card title="Which one do you think is true?" hint="Choose a statement. You will be told straight away.">
          <div role="group" aria-label="Choose a statement" className="grid gap-2 sm:grid-cols-2">
            {options.map((text) => {
              const isRight = text === m.correction;
              const shown = picked || choice !== null;

              return (
                <button
                  key={text}
                  type="button"
                  disabled={shown}
                  onClick={() => {
                    setChoice(text);
                    dispatch({ type: 'done', key: isRight ? okKey(pickKey(part)) : missKey(pickKey(part)) });
                  }}
                  className={`rounded-xl border-2 p-3 text-left text-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sd-accent motion-reduce:transition-none ${
                    shown && choice === text ? (isRight ? 'border-emerald-500 bg-emerald-50 text-emerald-950' : 'border-amber-500 bg-amber-50 text-amber-950') : 'border-sd-line bg-white text-slate-900 hover:border-sd-accent'
                  } disabled:cursor-default`}
                >
                  {text}
                </button>
              );
            })}
          </div>
          {choice !== null || picked ? (
            <p role="status" className={`rounded-xl border p-3 text-sm ${(choice ?? '') === m.correction || done.has(okKey(pickKey(part))) ? 'border-emerald-300 bg-emerald-50 text-emerald-950' : 'border-amber-300 bg-amber-50 text-amber-950'}`}>
              {(choice ?? '') === m.correction || done.has(okKey(pickKey(part))) ? 'Yes. ' : 'Not quite. '}
              What is true: {m.correction}
            </p>
          ) : null}
        </Card>
      ) : null}

      <Card title="Make your prediction" hint="Write it before you start. You will compare it with what you see.">
        {slots.map((s) => (
          <Write
            key={s.id}
            id={`predict-${part.n}-${s.id}`}
            label={s.label ? `${s.label}: what do you think will happen?` : format.predict}
            value={notes[slotNoteKey(part, 'predict', s.id)] ?? ''}
            onChange={(text) => dispatch({ type: 'note', key: slotNoteKey(part, 'predict', s.id), text })}
          />
        ))}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-slate-700">What you write stays in this browser. It is not sent anywhere.</p>
          <NextButton label={done.has(activityStepKey(part, 'predict')) ? 'Next: Perform' : 'Lock in my prediction'} onClick={onNext} disabled={!written} />
        </div>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Perform
// ---------------------------------------------------------------------------

function PerformStep({ part, done, dispatch, audience, onNext, complete }: Pick<StepProps, 'part' | 'done' | 'dispatch'> & { audience: ShellProps['audience']; onNext: () => void; complete: boolean }) {
  const steps = part.content.student_steps.filter((t) => t.trim());
  const doing = part.interaction && interactionStepOf(part) === 'perform' ? part.interaction : null;
  const c = part.content;

  return (
    <div className="space-y-4">
      {isPhysical(part) ? (
        <p role="note" className="flex items-start gap-2 rounded-2xl border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-950">
          <FlaskConical className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            <span className="font-semibold">{c.format === 'role_play' ? 'You act this out with your group. ' : 'You do this with your teacher and your group, not on the screen. '}</span>
            Gather what you need, follow the steps, and come back to write down what you see.
          </span>
        </p>
      ) : null}

      {c.materials.length > 0 ? (
        <Card title="Gather these" hint="Tick each one when you have it.">
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {c.materials.map((text, i) => (
              <li key={i} className="flex items-start gap-3">
                <input id={`mat-${part.n}-${i}`} type="checkbox" checked={done.has(materialKey(part, i))} onChange={() => dispatch({ type: 'toggle', key: materialKey(part, i) })} className="mt-1 h-4 w-4 accent-purple-700" />
                <label htmlFor={`mat-${part.n}-${i}`} className="text-sm text-slate-900">
                  {text}
                </label>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {c.setup ? <p className="rounded-xl border border-sd-line bg-white p-3 text-sm text-slate-900">{c.setup}</p> : null}

      {steps.length > 0 ? (
        <Card title="What you do" hint="Tick each step when it is done.">
          <ol className="space-y-2">
            {steps.map((text, i) => (
              <li key={i} className="flex items-start gap-3">
                <input id={`do-${part.n}-${i}`} type="checkbox" checked={done.has(performKey(part, i))} onChange={() => dispatch({ type: 'toggle', key: performKey(part, i) })} className="mt-1 h-4 w-4 accent-purple-700" />
                <label htmlFor={`do-${part.n}-${i}`} className="text-sm text-slate-900">
                  <span className="mr-1.5 font-bold text-sd-strong">{i + 1}.</span>
                  {text}
                </label>
              </li>
            ))}
          </ol>
        </Card>
      ) : null}

      {part.image && part.interaction?.kind !== 'hotspots' ? <VisualFigure image={part.image} assetBase={null} /> : null}

      {doing ? (
        <InteractionStage
          interaction={doing}
          image={part.image}
          eyebrow="Do it"
          title={part.title}
          done={done.has(interactionDoneKey(part))}
          onDone={() => dispatch({ type: 'done', key: interactionDoneKey(part) })}
          memoryKey={`act${part.n}:ix`}
        />
      ) : null}

      {audience === 'teacher' && (c.teacher_steps.length > 0 || c.assessment.length > 0 || c.differentiation) ? (
        <details className="rounded-2xl border border-slate-300 bg-white p-4">
          <summary className="cursor-pointer text-sm font-semibold text-slate-900">For the teacher</summary>
          <div className="mt-3 space-y-3 text-sm text-slate-900">
            {c.teacher_steps.length > 0 ? (
              <ol className="list-decimal space-y-1 pl-5">
                {c.teacher_steps.map((t, i) => (
                  <li key={i}>
                    <span className="font-semibold">{t.minutes} min.</span> {t.text}
                  </li>
                ))}
              </ol>
            ) : null}
            {c.assessment.length > 0 ? (
              <ul className="list-disc space-y-1 pl-5">
                {c.assessment.map((a, i) => (
                  <li key={i}>
                    <span className="font-semibold">{a.criterion}.</span> {a.evidence}
                  </li>
                ))}
              </ul>
            ) : null}
            {c.differentiation ? (
              <p>
                <span className="font-semibold">Support:</span> {c.differentiation.support} <span className="font-semibold">Extension:</span> {c.differentiation.extension}
              </p>
            ) : null}
          </div>
        </details>
      ) : null}

      <div className="flex items-center justify-between gap-2 border-t border-sd-line pt-3">
        <p role="status" className="text-sm text-slate-800">
          {complete ? 'All done. Now write down what you saw.' : steps.length > 0 || doing ? 'Finish every step to move on.' : ''}
        </p>
        <NextButton label="Next: Record" onClick={onNext} disabled={!complete} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Record
// ---------------------------------------------------------------------------

function RecordStep({ part, done, notes, dispatch, onSave, onNext }: StepProps & { onSave: () => void; onNext: () => void }) {
  const format = formatOf(part);
  const slots = slotsOf(part);
  const written = slots.some((s) => (notes[slotNoteKey(part, 'observe', s.id)] ?? '').trim());
  const saved = done.has(activityStepKey(part, 'record'));
  const outcomes = part.content.expected_outcomes.filter((t) => t.trim());

  return (
    <div className="space-y-4">
      <Card title={format.record} hint={format.recordHint}>
        {slots.map((s) => {
          const predicted = (notes[slotNoteKey(part, 'predict', s.id)] ?? '').trim();

          return (
            <div key={s.id} className="space-y-1.5">
              {predicted ? (
                <p className="rounded-lg bg-sd-softer px-2.5 py-1.5 text-sm text-slate-900">
                  <span className="font-semibold text-sd-strong">You predicted{s.label ? ` for ${s.label.toLowerCase()}` : ''}: </span>
                  {predicted}
                </p>
              ) : null}
              <Write
                id={`observe-${part.n}-${s.id}`}
                label={s.label ? `${s.label}: what did you observe?` : format.record}
                value={notes[slotNoteKey(part, 'observe', s.id)] ?? ''}
                onChange={(text) => dispatch({ type: 'note', key: slotNoteKey(part, 'observe', s.id), text })}
              />
            </div>
          );
        })}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-slate-700">What you write stays in this browser. It is not sent anywhere.</p>
          {/* Saving keeps the learner here: what was expected appears below, to be compared before moving on. */}
          <NextButton label={saved ? 'Next: Discuss' : 'Save and compare'} onClick={saved ? onNext : onSave} disabled={!written} />
        </div>
      </Card>

      {saved && outcomes.length > 0 ? (
        <section aria-label="What was expected" className={`space-y-2 rounded-2xl border border-emerald-300 bg-emerald-50 p-4 ${ENTER}`} data-testid="expected-outcomes">
          <h3 className="flex items-center gap-2 text-base font-semibold text-emerald-950">
            <Eye className="h-4 w-4" aria-hidden="true" />
            What was expected
          </h3>
          <ul className="list-disc space-y-1 pl-5 text-sm text-emerald-950">
            {outcomes.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
          <p className="text-sm text-emerald-950">Does this match what you saw? If not, that is worth talking about next.</p>
        </section>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Discuss
// ---------------------------------------------------------------------------

function DiscussStep({
  part,
  doc,
  bank,
  done,
  notes,
  dispatch,
  onFinish,
  next,
  onOpenNext,
  onBoard,
}: StepProps & { doc: ShellProps['doc']; bank: ShellProps['bank']; onFinish: () => void; next: ActivityPart | null; onOpenNext: (n: number) => void; onBoard: () => void }) {
  const explaining = part.interaction && interactionStepOf(part) === 'discuss' ? part.interaction : null;
  const questions = useMemo(() => resolvePart(part, bank), [part, bank]);
  const discussion = discussionOf(part);
  const reflection = reflectionOf(part);
  const finished = done.has(activityStepKey(part, 'discuss'));
  const report = (key: string, result: { correct: boolean | null }) => resultActions(key, result.correct !== null, result.correct === true).forEach(dispatch);
  const conceptName = (id: number | null) => (id !== null ? doc.concepts[String(id)]?.name ?? null : null);
  const goals = part.content.objectives.map((o) => goal(o.text)).filter(Boolean);

  return (
    <div className="space-y-4">
      {explaining ? (
        <InteractionStage
          interaction={explaining}
          image={part.image}
          eyebrow="Explain it"
          title={part.title}
          done={done.has(interactionDoneKey(part))}
          onDone={() => dispatch({ type: 'done', key: interactionDoneKey(part) })}
          memoryKey={`act${part.n}:ix`}
        />
      ) : null}

      {discussion.length > 0 ? (
        <Card title="Talk about it" hint="Discuss first. Then open a possible answer to compare.">
          <ul className="space-y-3">
            {discussion.map((d) => (
              <li key={d.id} className="rounded-xl border border-sd-line p-3">
                <p className="text-sm font-medium text-slate-900">{d.prompt}</p>
                <details className="mt-2">
                  <summary className="inline-flex cursor-pointer items-center gap-1.5 text-sm font-medium text-sd-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-sd-accent">
                    <Eye className="h-4 w-4" aria-hidden="true" />
                    Show a possible answer
                  </summary>
                  <p className="mt-2 rounded-lg bg-emerald-50 p-2.5 text-sm text-emerald-950">{d.answer}</p>
                </details>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Plays doc={doc} part={part} done={done} dispatch={dispatch} hints />

      {questions.length > 0 ? (
        <Card title="Check your thinking" hint="Answer, then read why.">
          <div className="space-y-3">
            {questions.map((q) => (
              <ActivityCard key={q.key} resolved={q.resolved} activityKey={q.key} done={done.has(q.key)} connects={conceptName(q.resolved.activity.connects_concept)} onResult={report} onRetry={(key) => retryActions(key).forEach(dispatch)} />
            ))}
          </div>
        </Card>
      ) : null}

      {reflection.length > 0 ? (
        <Card title="Reflect" hint="What you write stays in this browser. It is not sent anywhere.">
          <div className="space-y-3">
            {reflection.map((r) => (
              <Write key={r.id} id={`reflect-${part.n}-${r.id}`} label={r.prompt} value={notes[`${part.n}:${r.id}`] ?? ''} onChange={(text) => dispatch({ type: 'note', key: `${part.n}:${r.id}`, text })} />
            ))}
          </div>
        </Card>
      ) : null}

      {goals.length > 0 ? (
        <Card title="What you set out to do">
          <ul className="list-disc space-y-1 pl-5 text-sm text-slate-900">
            {goals.map((g, i) => (
              <li key={i}>{g}</li>
            ))}
          </ul>
        </Card>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-sd-line pt-3">
        {finished ? (
          <p role="status" className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-900">
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            Activity complete
          </p>
        ) : (
          <p className="text-sm text-slate-800">Finish when you have talked it through.</p>
        )}
        <div className="flex flex-wrap gap-2">
          {finished ? (
            <>
              <button type="button" onClick={onBoard} className="rounded-xl border border-sd-accent bg-white px-3 py-2 text-sm font-semibold text-sd-strong hover:bg-sd-softer focus-visible:outline focus-visible:outline-2 focus-visible:outline-sd-accent">
                All activities
              </button>
              {next ? <NextButton label={`Next: ${next.title}`} onClick={() => onOpenNext(next.n)} /> : null}
            </>
          ) : (
            <NextButton label="Finish activity" onClick={onFinish} />
          )}
        </div>
      </div>
    </div>
  );
}
