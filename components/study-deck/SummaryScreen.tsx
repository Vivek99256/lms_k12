'use client';

import { CheckCircle2, Circle, RotateCcw } from 'lucide-react';

import { outlineOf } from '@/lib/study-deck/deck';
import { conceptStatus, deckTotals, type DeckProgress } from '@/lib/study-deck/progress';
import type { StudyDeck } from '@/lib/study-deck/types';
import { Eyebrow, useStage } from './stage-ui';

export interface SummaryScreenProps {
  deck: StudyDeck;
  progress: DeckProgress;
  /** Keys of the activities that could actually be played, so an unplayable one is not held against the learner. */
  playable: ReadonlySet<string>;
  onRestart: () => void;
  onReview: (n: number) => void;
}

/**
 * The end of the lesson, on one screen: what was covered, topic by topic, with a tick against each idea the learner
 * explored, and a way back to any of them.
 *
 * Interactive parts are shown as explored, not scored. Written practice answers are never marked right or wrong:
 * nothing in this platform marks prose, and a screen that pretended otherwise would be teaching the wrong lesson.
 */
export function SummaryScreen({ deck, progress, playable, onRestart, onReview }: SummaryScreenProps) {
  const { portrait } = useStage();
  const totals = deckTotals(deck, progress, playable);

  return (
    <section aria-labelledby="summary-title" className="flex h-full min-h-0 flex-col gap-[0.9em] p-[1.4em]">
      <header className="flex flex-wrap items-end justify-between gap-[0.8em]">
        <div className="space-y-[0.3em]">
          <Eyebrow>Chapter finished</Eyebrow>
          <h2 id="summary-title" tabIndex={-1} className={`font-semibold leading-tight tracking-tight text-slate-900 outline-none ${portrait ? 'text-[1.4em]' : 'text-[1.9em]'}`}>
            {deck.chapter.name}
          </h2>
          <p className="text-[0.85em] text-slate-700">
            You opened {totals.visited} of {totals.slides} slides
            {totals.interactions > 0 ? ` and explored ${totals.explored} of ${totals.interactions} interactive parts` : ''}
            {totals.practice > 0 ? `. You tried ${totals.practiceDone} of ${totals.practice} optional practice questions` : ''}
            {totals.marked > 0 ? `, getting ${totals.correct} of ${totals.marked} marked answers right` : ''}.
          </p>
        </div>
        <button
          type="button"
          onClick={onRestart}
          className="inline-flex items-center gap-[0.5em] rounded-[0.7em] border border-slate-300 bg-white px-[1em] py-[0.45em] text-[0.8em] font-medium text-slate-800 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600"
        >
          <RotateCcw className="h-[1.1em] w-[1.1em]" aria-hidden="true" />
          Start again
        </button>
      </header>

      <div className={`grid min-h-0 flex-1 auto-rows-fr gap-[0.6em] ${portrait ? 'grid-cols-1' : 'grid-cols-4'}`}>
        {outlineOf(deck).map((topic) => (
          <div key={topic.topicId} className="flex min-h-0 flex-col gap-[0.2em] overflow-hidden rounded-[0.8em] border border-slate-200 bg-slate-50 p-[0.6em]">
            <h3 className="text-[0.72em] font-semibold leading-tight text-slate-900">{topic.name}</h3>
            <ul className="space-y-[0.1em]">
              {topic.concepts.map(({ concept, taughtOn }) => {
                const s = conceptStatus(deck, progress, concept.id);

                return (
                  <li key={concept.id} className="flex items-center gap-[0.4em] text-[0.6em] leading-tight text-slate-800">
                    {s.complete ? (
                      <CheckCircle2 className="h-[1.2em] w-[1.2em] shrink-0 text-emerald-600" aria-label="Explored" />
                    ) : (
                      <Circle className="h-[1.2em] w-[1.2em] shrink-0 text-slate-400" aria-label="Not finished" />
                    )}
                    <span className="flex-1">{concept.name}</span>
                    {taughtOn[0] !== undefined ? (
                      <button
                        type="button"
                        onClick={() => onReview(taughtOn[0])}
                        className="text-indigo-700 underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600"
                      >
                        Review
                      </button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
