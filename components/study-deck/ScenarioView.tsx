'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { ArrowRight, CheckCircle2, Compass, RotateCcw, Undo2 } from 'lucide-react';

import {
  advance,
  choiceOf,
  choose,
  initialScenario,
  nodeOf,
  pathTaken,
  restart,
  scenarioProgress,
  type ScenarioState,
} from '@/lib/study-deck/interactions';
import type { ScenarioInteraction } from '@/lib/study-deck/types';
import { Tag, useRememberedReducer, useStage } from './stage-ui';

export interface ScenarioViewProps {
  interaction: ScenarioInteraction;
  done: boolean;
  /** Called once, the first time a path reaches its end. */
  onDone: () => void;
  /** The slide's title and explanation, drawn beside the situation. */
  lead: ReactNode;
  /** Where this screen's state is kept for the session. */
  memoryKey: string;
}

type Action = { type: 'choose'; id: string } | { type: 'again' } | { type: 'next' } | { type: 'restart' };

/**
 * A branching scenario as a full-screen decision: the situation on one side and, on the other, large decision cards.
 * Choosing one moves to a consequence screen (what happens, and why); from there the learner goes on to the next
 * decision, or to what to take from it. They can step back to try a different choice and start over to compare paths.
 *
 * Nothing is scored. A choice is described as sound or not the best choice, because the point is to see why.
 */
export function ScenarioView({ interaction, done, onDone, lead, memoryKey }: ScenarioViewProps) {
  const { portrait } = useStage();
  const [state, dispatch] = useRememberedReducer(memoryKey, (s: ScenarioState, a: Action) => {
    switch (a.type) {
      case 'choose':
        return choose(interaction, s, a.id);
      case 'again':
        return { ...s, chosen: null, path: s.path.filter((step) => step.nodeId !== s.nodeId) };
      case 'next':
        return advance(interaction, s);
      case 'restart':
        return restart(interaction, s);
    }
  }, () => initialScenario(interaction));

  const node = nodeOf(interaction, state.nodeId);
  const picked = choiceOf(node, state.chosen);
  const progress = scenarioProgress(interaction, state, done);
  const reported = useRef(done);
  const heading = useRef<HTMLHeadingElement>(null);
  const position = interaction.nodes.findIndex((n) => n.id === state.nodeId) + 1;
  const first = useRef(true);

  useEffect(() => {
    if (state.ended && !reported.current) {
      reported.current = true;
      onDone();
    }
  }, [state.ended, onDone]);

  // Move to the new decision or the conclusion, so a keyboard or screen-reader user lands on it.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    heading.current?.focus({ preventScroll: true });
  }, [state.nodeId, state.ended, state.chosen]);

  const button = 'inline-flex items-center gap-[0.4em] rounded-[0.7em] px-[1em] py-[0.5em] text-[0.8em] font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600';

  return (
    <section
      aria-label="What would you do?"
      className={`grid h-full min-h-0 gap-[1.2em] p-[1.4em] ${portrait ? 'grid-rows-[auto_minmax(0,1fr)]' : 'grid-cols-[minmax(0,4.6fr)_minmax(0,7.4fr)]'}`}
    >
      <div className="flex min-h-0 min-w-0 flex-col justify-center gap-[0.9em]">
        {lead}
        <div className="space-y-[0.5em]">
          <div className="flex flex-wrap items-center gap-[0.6em]">
            <Tag>
              <Compass className="h-[1em] w-[1em]" aria-hidden="true" />
              What would you do?
            </Tag>
            <span className="text-[0.7em] text-slate-600">
              {state.ended ? 'You reached the end of this path' : interaction.nodes.length > 1 ? `Decision ${position} of ${interaction.nodes.length}` : 'One decision'}
            </span>
            {progress.done ? (
              <span className="inline-flex items-center gap-[0.3em] text-[0.7em] font-medium text-emerald-700">
                <CheckCircle2 className="h-[1.1em] w-[1.1em]" aria-hidden="true" />
                Explored
              </span>
            ) : null}
          </div>
          <p className="rounded-[0.8em] bg-slate-50 p-[0.8em] text-[0.95em] leading-snug text-slate-800">{interaction.situation}</p>
        </div>
      </div>

      <div className="flex min-h-0 min-w-0 flex-col justify-center gap-[0.8em]">
        {state.ended ? (
          <div className="space-y-[0.8em]">
            <h3 ref={heading} tabIndex={-1} className="text-[1.3em] font-semibold text-slate-900 outline-none">
              What to take from this
            </h3>
            <p className="rounded-[0.9em] border border-emerald-200 bg-emerald-50 p-[1em] text-[1.1em] leading-snug text-emerald-950">{interaction.conclusion}</p>
            <ol className="space-y-[0.25em] text-[0.8em] text-slate-700" aria-label="The path you took">
              {pathTaken(interaction, state).map(({ node: n, choice }) => (
                <li key={n.id}>
                  <span className="font-medium">{n.prompt}</span> <span aria-hidden="true">→</span> {choice.text}
                </li>
              ))}
            </ol>
            <div className="flex items-center gap-[0.8em]">
              <button type="button" onClick={() => dispatch({ type: 'restart' })} className={`${button} border border-slate-300 bg-white text-slate-800 hover:bg-slate-50`}>
                <RotateCcw className="h-[1.1em] w-[1.1em]" aria-hidden="true" />
                Try a different path
              </button>
              <span className="text-[0.7em] text-slate-600">
                You have tried {progress.triedChoices} of {progress.totalChoices} choices.
              </span>
            </div>
          </div>
        ) : node && picked ? (
          <div className="space-y-[0.7em]" aria-live="polite">
            <h3 ref={heading} tabIndex={-1} className="text-[1.15em] font-semibold text-slate-900 outline-none">
              {node.prompt}
            </h3>
            <p className="rounded-[0.7em] border border-slate-200 bg-slate-50 px-[0.9em] py-[0.5em] text-[0.95em] text-slate-800">
              <span className="text-[0.7em] font-semibold uppercase tracking-wider text-slate-500">You chose </span>
              <br />
              {picked.text}
            </p>
            <div className={`space-y-[0.5em] rounded-[0.9em] border p-[1em] ${picked.sound ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
              <p className={`text-[0.7em] font-semibold uppercase tracking-wider ${picked.sound ? 'text-emerald-900' : 'text-amber-900'}`}>
                {picked.sound ? 'A sound choice' : 'Not the best choice'}
              </p>
              <p className={`text-[1.05em] leading-snug ${picked.sound ? 'text-emerald-950' : 'text-amber-950'}`}>
                <span className="font-semibold">What happens: </span>
                {picked.outcome}
              </p>
              <p className={`text-[1.05em] leading-snug ${picked.sound ? 'text-emerald-950' : 'text-amber-950'}`}>
                <span className="font-semibold">Why: </span>
                {picked.why}
              </p>
            </div>
            <div className="flex flex-wrap gap-[0.6em]">
              <button type="button" onClick={() => dispatch({ type: 'again' })} className={`${button} border border-slate-300 bg-white text-slate-800 hover:bg-slate-50`}>
                <Undo2 className="h-[1.1em] w-[1.1em]" aria-hidden="true" />
                Try a different choice
              </button>
              <button type="button" onClick={() => dispatch({ type: 'next' })} className={`${button} bg-indigo-600 text-white hover:bg-indigo-700`}>
                {picked.next ? 'Next decision' : 'See what to take from this'}
                <ArrowRight className="h-[1.1em] w-[1.1em]" aria-hidden="true" />
              </button>
            </div>
          </div>
        ) : node ? (
          <div className="space-y-[0.8em]">
            <h3 ref={heading} tabIndex={-1} className="text-[1.45em] font-semibold leading-tight text-slate-900 outline-none">
              {node.prompt}
            </h3>
            <ul className="space-y-[0.6em]" aria-label="Your choices">
              {node.choices.map((choice) => (
                <li key={choice.id}>
                  <button
                    type="button"
                    onClick={() => dispatch({ type: 'choose', id: choice.id })}
                    aria-pressed={state.chosen === choice.id}
                    className="flex min-h-[3.6em] w-full items-center gap-[0.8em] rounded-[0.9em] border-2 border-slate-300 bg-white px-[1.1em] py-[0.7em] text-left text-[1.05em] leading-snug text-slate-900 shadow-sm transition hover:border-indigo-500 hover:bg-indigo-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                  >
                    <span aria-hidden="true" className="h-[1.1em] w-[1.1em] shrink-0 rounded-full border-2 border-slate-400" />
                    {choice.text}
                  </button>
                </li>
              ))}
            </ul>
            <p className="text-[0.75em] text-slate-600">Choose what you would do. You will see what happens and why.</p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
