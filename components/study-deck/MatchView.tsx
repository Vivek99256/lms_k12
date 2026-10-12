'use client';

import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { CheckCircle2, Link2 } from 'lucide-react';

import { INTERACTION_HEADING, initialMatch, matchProgress, pickMeaning, pickTerm, shuffled, type MatchState } from '@/lib/study-deck/interactions';
import type { MatchInteraction } from '@/lib/study-deck/types';
import { CompletedSlot, motion, Tag, useRememberedReducer, useStage } from './stage-ui';

export interface MatchViewProps {
  interaction: MatchInteraction;
  done: boolean;
  /** Called once, when every pair has been matched. */
  onDone: () => void;
  lead: ReactNode;
  /** Where this screen's state is kept for the session. */
  memoryKey: string;
}

type Action = { type: 'term'; id: string } | { type: 'meaning'; id: string };

/**
 * Pair each term with its meaning: pick a term, then the meaning that fits. A pair that fits locks in; one that does
 * not simply says "not that one" and lets the learner try again. Nothing counts the misses against them.
 */
export function MatchView({ interaction, done, onDone, lead, memoryKey }: MatchViewProps) {
  const { portrait } = useStage();
  const [state, dispatch] = useRememberedReducer(memoryKey, (s: MatchState, a: Action) => (a.type === 'term' ? pickTerm(s, a.id) : pickMeaning(s, a.id)), initialMatch);
  const progress = matchProgress(interaction, state);
  const finished = progress.done || done;
  const reported = useRef(done);
  const meanings = useMemo(() => shuffled(interaction.pairs), [interaction.pairs]);

  useEffect(() => {
    if (progress.done && !reported.current) {
      reported.current = true;
      onDone();
    }
  }, [progress.done, onDone]);

  const matched = (id: string) => state.matched.includes(id) || done;

  return (
    <section aria-label="Match" className={`grid h-full min-h-0 gap-[1.2em] p-[1.4em] ${portrait ? 'grid-rows-[auto_minmax(0,1fr)]' : 'grid-cols-[minmax(0,4.2fr)_minmax(0,7.8fr)]'}`}>
      <div className="flex min-h-0 min-w-0 flex-col justify-center gap-[0.9em]">
        {lead}
        <div className="space-y-[0.4em]">
          <div className="flex flex-wrap items-center gap-[0.6em]">
            <Tag>
              <Link2 className="h-[1em] w-[1em]" aria-hidden="true" />
              {INTERACTION_HEADING.match}
            </Tag>
            <span role="status" className="text-[0.72em] font-medium text-slate-600">
              {finished ? 'All matched' : `Matched ${progress.opened} / ${progress.total}`}
            </span>
          </div>
          <p className="text-[0.75em] text-slate-600">{interaction.intro}</p>
          <p aria-live="polite" className="min-h-[1.2em] text-[0.8em] text-amber-800">
            {state.last === 'miss' ? 'Not that one. Try another meaning.' : ''}
          </p>
        </div>
        <CompletedSlot show={finished}>{interaction.wrapup}</CompletedSlot>
      </div>

      <div className="grid min-h-0 grid-cols-2 content-center gap-[0.9em]">
        <ul aria-label="Terms" className="grid auto-rows-fr gap-[0.6em]">
          {interaction.pairs.map((pair) => {
            const isMatched = matched(pair.id);
            const picked = state.picked === pair.id;

            return (
              <li key={pair.id}>
                <button
                  type="button"
                  disabled={isMatched}
                  aria-pressed={picked}
                  onClick={() => dispatch({ type: 'term', id: pair.id })}
                  className={`flex h-full min-h-[3.2em] w-full items-center gap-[0.5em] rounded-[0.9em] border-2 px-[0.9em] py-[0.5em] text-left text-[1.05em] font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 ${
                    isMatched ? 'border-emerald-400 bg-emerald-50 text-emerald-950' : picked ? 'border-indigo-600 bg-indigo-600 text-white shadow-md' : 'border-slate-300 bg-white text-slate-900 hover:border-indigo-400'
                  }`}
                >
                  {isMatched ? <CheckCircle2 className="h-[1.1em] w-[1.1em] shrink-0 text-emerald-600" aria-label="Matched" /> : null}
                  {pair.term}
                </button>
              </li>
            );
          })}
        </ul>
        <ul aria-label="Meanings" className="grid auto-rows-fr gap-[0.6em]">
          {meanings.map((pair) => {
            const isMatched = matched(pair.id);

            return (
              <li key={pair.id}>
                <button
                  type="button"
                  disabled={isMatched || state.picked === null}
                  onClick={() => dispatch({ type: 'meaning', id: pair.id })}
                  className={`flex h-full min-h-[3.2em] w-full items-center rounded-[0.9em] border-2 px-[0.9em] py-[0.5em] text-left text-[0.9em] leading-snug transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 ${
                    isMatched ? `border-emerald-400 bg-emerald-50 text-emerald-950 ${motion.settle}` : state.picked !== null ? 'border-indigo-200 bg-white text-slate-900 hover:border-indigo-500 hover:bg-indigo-50' : 'border-slate-200 bg-slate-50 text-slate-600'
                  }`}
                >
                  {pair.meaning}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
