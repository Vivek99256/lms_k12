'use client';

import { useMemo, useState } from 'react';
import { ArrowRight, CheckCircle2, Compass, Lightbulb, RotateCcw } from 'lucide-react';

import { activityKey } from '@/lib/study-deck/deck';
import { partLabel } from '@/lib/study-document/document';
import {
  HINT_LEVELS,
  HINT_PLAYS,
  JOURNEYS,
  SOLO_PLAYS,
  playKeysOf,
  SOLO_LEVELS,
  UNIT_LEARN_BLOCKS,
  blockKeys,
  diagnosticOf,
  diagnosticSummary,
  exitVerdict,
  missKey,
  okKey,
  questionKeys,
  recommendedUnits,
  share,
  type RemedialStage,
} from '@/lib/study-document/journey';
import { guidedOf, readinessRule } from '@/lib/study-document/online';
import type { BodyPart, ClinicPart, ExitPart, GapsPart, IndependentPart, RemedialUnitPart } from '@/lib/study-document/types';
import { ENTER, JourneyFrame, NextButton, type FrameStep } from './JourneyFrame';
import { PartPanel } from './PartPanel';
import { Plays } from './PlayGame';
import type { ShellProps } from './RevisionNotebook';

/**
 * A remedial class as a guided journey: Diagnose, Learn, Get hints, Practise, Master.
 *
 * The diagnostic's own questions decide where the learner is sent: a question answered wrongly recommends the unit the document
 * names for it (`if_missed`), and the Learn step lists those units first. Practice is the unit's own guided questions, with a
 * hint to hand for levels 1 and 2 and none for level 3. The exit check is judged by the document's own rule. Nothing here is
 * invented: a stage with nothing in this document says so.
 */
export function RemedialJourney({ doc, parts, bank, done, notes, dispatch }: ShellProps) {
  const journey = JOURNEYS.remedial;
  const units = useMemo(() => parts.filter((p): p is RemedialUnitPart => p.type === 'unit'), [parts]);
  const diagnostic = diagnosticOf(doc);
  const gaps = parts.find((p): p is GapsPart => p.type === 'gaps') ?? null;
  const clinic = parts.find((p): p is ClinicPart => p.type === 'clinic') ?? null;
  const independent = parts.find((p): p is IndependentPart => p.type === 'independent') ?? null;
  const exit = parts.find((p): p is ExitPart => p.type === 'exit') ?? null;
  const teacher = parts.find((p) => p.type === 'teacher') ?? null;

  const recommended = useMemo(() => recommendedUnits(doc, done), [doc, done]);
  const summary = diagnosticSummary(doc, done);

  const [stage, setStage] = useState<RemedialStage>(diagnostic ? 'diagnose' : 'learn');
  const [unitN, setUnitN] = useState<number | null>(units[0]?.n ?? null);
  const unit = units.find((u) => u.n === unitN) ?? units[0] ?? null;
  const open = (n: number) => {
    if (units.some((u) => u.n === n)) {
      setUnitN(n);
      setStage('learn');
    } else if (teacher && teacher.n === n) setStage('master');
  };

  // What each step asks, as keys, so a step is done when its keys are and the whole journey has a progress bar.
  const keys: Record<RemedialStage, string[]> = {
    diagnose: diagnostic ? questionKeys(diagnostic) : [],
    learn: units.flatMap((u) => UNIT_LEARN_BLOCKS.flatMap((b) => blockKeys(u, b))).concat(clinic ? blockKeys(clinic, 'mistakes') : []),
    hints: units.flatMap((u) => [...questionKeys(u, HINT_LEVELS), ...playKeysOf(doc, u, HINT_PLAYS)]),
    practise: units.flatMap((u) => [...questionKeys(u, SOLO_LEVELS), ...playKeysOf(doc, u, SOLO_PLAYS)]).concat(independent ? questionKeys(independent) : []),
    master: exit ? questionKeys(exit) : [],
  };
  const finished = (s: RemedialStage) => keys[s].filter((k) => done.has(k)).length;
  const all = Object.values(keys).flat();
  const percent = share({ done: all.filter((k) => done.has(k)).length, total: all.length });
  const verdict = exit ? exitVerdict(doc, exit, done) : null;

  const steps: FrameStep[] = journey.workflow.map((w) => {
    const id = w.id as RemedialStage;
    const total = keys[id].length;

    return {
      id,
      label: w.label,
      does: w.does,
      state: id === stage ? 'current' : total > 0 && finished(id) === total ? 'done' : 'todo',
      count: total > 0 ? `${finished(id)}/${total}` : undefined,
    };
  });
  const label = (id: RemedialStage | null) => journey.workflow.find((w) => w.id === id)?.label ?? '';

  const hasGuided = unit ? guidedOf(unit).some((g) => HINT_LEVELS.includes(g.level)) : false;
  const hasHintPlay = unit ? playKeysOf(doc, unit, HINT_PLAYS).length > 0 : false;
  const hasSoloPlay = unit ? playKeysOf(doc, unit, SOLO_PLAYS).length > 0 : false;
  const hasSolo = unit ? questionKeys(unit, SOLO_LEVELS).length > 0 : false;

  return (
    <JourneyFrame journey={journey} progress={percent} progressLabel={`Journey progress · ${all.filter((k) => done.has(k)).length} of ${all.length} tasks`} steps={steps} onStep={(id) => setStage(id as RemedialStage)} testId="remedial-journey">
      <div className="h-full min-h-0 overflow-y-auto p-3 sm:p-5" data-testid="journey-page">
        <div key={`${stage}-${unit?.n ?? ''}`} className={`mx-auto max-w-4xl space-y-4 ${ENTER}`}>
          {stage === 'diagnose' ? (
            diagnostic ? (
              <>
                <StageHeading eyebrow="Step 1 · Diagnose" title="Find out what to work on" text={diagnostic.content.intro} />
                {diagnostic.content.scoring ? <p className="text-sm text-slate-700">{diagnostic.content.scoring}</p> : null}
                <PartPanel doc={doc} part={diagnostic as BodyPart} bank={bank} done={done} notes={notes} dispatch={dispatch} onOpenPart={open} blocks={['questions']} bare />
                <Recommendation units={units} recommended={recommended} answered={summary.answered} total={summary.total} missed={summary.missed} onOpen={open} />
                {gaps ? (
                  <details className="rounded-2xl border border-sd-line bg-white p-4">
                    <summary className="cursor-pointer text-sm font-semibold text-sd-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-sd-accent">Where you may find this chapter hard</summary>
                    <div className="mt-3">
                      <PartPanel doc={doc} part={gaps as BodyPart} bank={bank} done={done} notes={notes} dispatch={dispatch} onOpenPart={open} />
                    </div>
                  </details>
                ) : null}
              </>
            ) : (
              <Empty text="This class has no diagnostic questions, so start with Learn." />
            )
          ) : stage === 'learn' ? (
            <>
              <StageHeading eyebrow="Step 2 · Learn" title="Learn it one step at a time" text="Pick a unit. Read the simple explanation, open each step, then look at the worked example." />
              <UnitPicker doc={doc} units={units} current={unit} recommended={recommended} done={done} onPick={setUnitN} />
              {unit ? (
                <>
                  <h3 className="text-lg font-semibold text-slate-900">{unit.title}</h3>
                  {unit.content.simple_explanation ? <p className="max-w-3xl rounded-xl border border-sd-line bg-white p-3 text-sm leading-relaxed text-slate-900">{unit.content.simple_explanation}</p> : null}
                  <PartPanel key={unit.n} doc={doc} part={unit} bank={bank} done={done} notes={notes} dispatch={dispatch} onOpenPart={open} blocks={UNIT_LEARN_BLOCKS} bare />
                </>
              ) : (
                <Empty text="This class has no units." />
              )}
              {clinic ? (
                <details className="rounded-2xl border border-sd-line bg-white p-4">
                  <summary className="cursor-pointer text-sm font-semibold text-sd-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-sd-accent">Ideas to judge: do you agree with these?</summary>
                  <div className="mt-3">
                    <PartPanel doc={doc} part={clinic as BodyPart} bank={bank} done={done} notes={notes} dispatch={dispatch} onOpenPart={open} blocks={['mistakes']} bare />
                  </div>
                </details>
              ) : null}
              <Footer>
                <NextButton label={`Next: ${label('hints')}`} onClick={() => setStage('hints')} />
              </Footer>
            </>
          ) : stage === 'hints' ? (
            <>
              <StageHeading eyebrow="Step 3 · Get hints" title="Practise with help to hand" text="Level 1 gives the most help and level 2 less. Open the hint if you are stuck; check your answer to see why." />
              <UnitPicker doc={doc} units={units} current={unit} recommended={recommended} done={done} onPick={setUnitN} />
              {unit && hasHintPlay ? <Plays key={`${unit.n}-hp`} doc={doc} part={unit} kinds={HINT_PLAYS} done={done} dispatch={dispatch} hints /> : null}
              {unit && hasGuided ? (
                <PartPanel key={`${unit.n}-h`} doc={doc} part={unit} bank={bank} done={done} notes={notes} dispatch={dispatch} onOpenPart={open} blocks={['questions']} levels={HINT_LEVELS} bare />
              ) : !hasHintPlay ? (
                <Empty text="This unit has no guided question in the question bank yet, so there is nothing to practise with a hint here. Go on to Practise, or pick another unit." />
              ) : null}
              <Footer>
                <NextButton label={`Next: ${label('practise')}`} onClick={() => setStage('practise')} />
              </Footer>
            </>
          ) : stage === 'practise' ? (
            <>
              <StageHeading eyebrow="Step 4 · Practise" title="Now on your own" text="No hints here. Answer, then read why." />
              <UnitPicker doc={doc} units={units} current={unit} recommended={recommended} done={done} onPick={setUnitN} />
              {unit && hasSoloPlay ? <Plays key={`${unit.n}-sp`} doc={doc} part={unit} kinds={SOLO_PLAYS} done={done} dispatch={dispatch} /> : null}
              {unit && hasSolo ? <PartPanel key={`${unit.n}-s`} doc={doc} part={unit} bank={bank} done={done} notes={notes} dispatch={dispatch} onOpenPart={open} blocks={['questions']} levels={SOLO_LEVELS} bare /> : !hasSoloPlay ? <Empty text="This unit has no independent question of its own. Try the mixed practice below." /> : null}
              {independent && independent.activities.length > 0 ? (
                <section className="space-y-3" aria-label="Mixed practice">
                  <h3 className="text-lg font-semibold text-slate-900">Mixed practice</h3>
                  <p className="text-sm text-slate-700">{independent.content.intro}</p>
                  <PartPanel doc={doc} part={independent as BodyPart} bank={bank} done={done} notes={notes} dispatch={dispatch} onOpenPart={open} blocks={['questions']} bare />
                </section>
              ) : null}
              <Footer>
                <NextButton label={`Next: ${label('master')}`} onClick={() => setStage('master')} />
              </Footer>
            </>
          ) : (
            <>
              <StageHeading eyebrow="Step 5 · Master" title="Exit check" text={exit?.content.intro ?? ''} />
              {exit ? (
                <>
                  <PartPanel doc={doc} part={exit as BodyPart} bank={bank} done={done} notes={notes} dispatch={dispatch} onOpenPart={open} blocks={['criteria', 'questions']} bare />
                  <ExitResult
                    verdict={verdict}
                    rule={readinessRule(exit)}
                    unmarked={exit.activities.map((_, i) => activityKey(exit, i)).flatMap((key, i) => (done.has(key) && !done.has(okKey(key)) && !done.has(missKey(key)) ? [{ key, number: i + 1 }] : []))}
                    dispatch={dispatch}
                    onOpen={open}
                    onRetry={() => setStage('learn')}
                  />
                </>
              ) : (
                <Empty text="This class has no exit check." />
              )}
              {teacher ? (
                <details className="rounded-2xl border border-sd-line bg-white p-4">
                  <summary className="cursor-pointer text-sm font-semibold text-sd-strong">Teacher guide</summary>
                  <div className="mt-3">
                    <PartPanel doc={doc} part={teacher} bank={bank} done={done} notes={notes} dispatch={dispatch} onOpenPart={open} />
                  </div>
                </details>
              ) : null}
            </>
          )}
        </div>
      </div>
    </JourneyFrame>
  );
}

function StageHeading({ eyebrow, title, text }: { eyebrow: string; title: string; text?: string }) {
  return (
    <header className="space-y-1">
      <p className="text-xs font-bold uppercase tracking-wider text-sd-strong">{eyebrow}</p>
      <h2 className="text-xl font-semibold tracking-tight text-slate-900">{title}</h2>
      {text ? <p className="max-w-3xl text-sm leading-relaxed text-slate-800">{text}</p> : null}
    </header>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-xl border border-sd-line bg-white p-4 text-sm text-slate-800">{text}</p>;
}

function Footer({ children }: { children: React.ReactNode }) {
  return <div className="flex justify-end border-t border-sd-line pt-3">{children}</div>;
}

/** The units, with the ones the diagnostic recommended marked and the finished ones ticked. */
function UnitPicker({ doc, units, current, recommended, done, onPick }: { doc: ShellProps['doc']; units: RemedialUnitPart[]; current: RemedialUnitPart | null; recommended: number[]; done: ReadonlySet<string>; onPick: (n: number) => void }) {
  if (units.length === 0) return null;
  const ordered = [...units].sort((a, b) => Number(recommended.includes(b.n)) - Number(recommended.includes(a.n)) || a.n - b.n);

  return (
    <div role="group" aria-label="Units" className="flex flex-wrap gap-2">
      {ordered.map((u) => {
        const keys = [...UNIT_LEARN_BLOCKS.flatMap((b) => blockKeys(u, b)), ...questionKeys(u)];
        const complete = keys.length > 0 && keys.every((k) => done.has(k));
        const active = current?.n === u.n;

        return (
          <button
            key={u.n}
            type="button"
            aria-pressed={active}
            onClick={() => onPick(u.n)}
            className={`flex items-center gap-2 rounded-xl border px-3 py-1.5 text-left text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sd-accent motion-reduce:transition-none ${
              active ? 'border-sd-accent bg-sd-accent text-white' : 'border-sd-line bg-white text-slate-900 hover:bg-sd-softer'
            }`}
          >
            <span>{partLabel(doc, u)}</span>
            {recommended.includes(u.n) ? <span className={`rounded-full px-1.5 py-0.5 text-[0.7rem] font-bold ${active ? 'bg-white text-sd-strong' : 'bg-amber-100 text-amber-900'}`}>Recommended</span> : null}
            {complete ? <CheckCircle2 className="h-4 w-4" aria-label="Finished" /> : null}
          </button>
        );
      })}
    </div>
  );
}

/** What the diagnostic found, and where to go. */
function Recommendation({ units, recommended, answered, total, missed, onOpen }: { units: RemedialUnitPart[]; recommended: number[]; answered: number; total: number; missed: number; onOpen: (n: number) => void }) {
  if (answered === 0) return null;
  const complete = answered >= total;
  const byN = new Map(units.map((u) => [u.n, u]));

  return (
    <section aria-label="What to do next" className={`space-y-2 rounded-2xl border p-4 ${ENTER} ${missed === 0 && complete ? 'border-emerald-300 bg-emerald-50' : 'border-amber-300 bg-amber-50'}`} data-testid="diagnostic-result">
      <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
        <Compass className="h-4 w-4" aria-hidden="true" />
        {answered} of {total} answered{answered > 0 ? ` · ${missed} to work on` : ''}
      </p>
      {recommended.length > 0 ? (
        <>
          <p className="text-sm text-slate-900">Based on your answers, start with:</p>
          <ul className="flex flex-wrap gap-2">
            {recommended.map((n) => (
              <li key={n}>
                <button
                  type="button"
                  onClick={() => onOpen(n)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500 bg-white px-2.5 py-1 text-sm font-semibold text-amber-950 hover:bg-amber-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-700"
                >
                  <Lightbulb className="h-4 w-4" aria-hidden="true" />
                  {byN.get(n)?.title ?? `Unit ${n}`}
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : complete && missed === 0 ? (
        <p className="text-sm text-emerald-950">You got every marked question right. You can go straight to Practise or take the exit check.</p>
      ) : missed > 0 ? (
        <p className="text-sm text-slate-900">The document does not name a unit for the questions you missed, so choose a unit in Learn.</p>
      ) : (
        <p className="text-sm text-slate-900">Answer the rest to see where to start.</p>
      )}
    </section>
  );
}

/** The exit check's verdict, by the document's own rule. A written answer is not marked, so it is said, not counted. */
function ExitResult({
  verdict,
  rule,
  unmarked,
  dispatch,
  onOpen,
  onRetry,
}: {
  verdict: ReturnType<typeof exitVerdict> | null;
  rule: string | null;
  unmarked: Array<{ key: string; number: number }>;
  dispatch: ShellProps['dispatch'];
  onOpen: (n: number) => void;
  onRetry: () => void;
}) {
  if (!verdict || verdict.answered === 0) return rule ? <p className="text-sm text-slate-800">{rule}</p> : null;

  return (
    <section aria-label="Exit check result" className={`space-y-2 rounded-2xl border p-4 ${ENTER} ${verdict.ready === true ? 'border-emerald-300 bg-emerald-50' : 'border-amber-300 bg-amber-50'}`} data-testid="exit-result">
      <p className="text-sm font-semibold text-slate-900">
        {verdict.answered} of {verdict.total} answered · {verdict.right} right
      </p>
      {rule ? <p className="text-sm text-slate-800">{rule}</p> : null}
      {unmarked.length > 0 ? (
        <div className="space-y-2 rounded-xl border border-slate-300 bg-white p-3" data-testid="self-check">
          <p className="text-sm font-semibold text-slate-900">Check your written answers yourself</p>
          <p className="text-sm text-slate-800">Nothing here marks a written answer. Compare yours with the model answer, then say honestly how it went. This is your own check, not a mark.</p>
          <ul className="space-y-1.5">
            {unmarked.map((u) => (
              <li key={u.key} className="flex flex-wrap items-center gap-2 text-sm text-slate-900">
                <span className="font-medium">Question {u.number}</span>
                <button
                  type="button"
                  onClick={() => {
                    dispatch({ type: 'done', key: okKey(u.key) });
                    dispatch({ type: 'undone', key: missKey(u.key) });
                  }}
                  className="rounded-lg border border-emerald-500 bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-950 hover:bg-emerald-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700"
                >
                  Mine matched
                </button>
                <button
                  type="button"
                  onClick={() => {
                    dispatch({ type: 'done', key: missKey(u.key) });
                    dispatch({ type: 'undone', key: okKey(u.key) });
                  }}
                  className="rounded-lg border border-amber-500 bg-amber-50 px-2.5 py-1 font-semibold text-amber-950 hover:bg-amber-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-700"
                >
                  Not yet
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {verdict.ready === true ? <p className="text-sm font-semibold text-emerald-950">You are ready. You can now do this on your own.</p> : null}
      {verdict.ready === false ? (
        <>
          <p className="text-sm font-semibold text-amber-950">Not ready yet. Go back to these units, then try again.</p>
          <div className="flex flex-wrap gap-2">
            {verdict.revisit.map((p) => (
              <button key={p.part} type="button" onClick={() => onOpen(p.part)} className="rounded-lg border border-amber-500 bg-white px-2.5 py-1 text-sm font-semibold text-amber-950 hover:bg-amber-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-700">
                {p.label}
              </button>
            ))}
            <button type="button" onClick={onRetry} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-400 bg-white px-2.5 py-1 text-sm font-semibold text-slate-900 hover:bg-slate-50">
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              Back to Learn
            </button>
          </div>
        </>
      ) : null}
    </section>
  );
}
