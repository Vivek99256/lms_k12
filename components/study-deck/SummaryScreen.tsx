'use client';

import { RotateCcw } from 'lucide-react';

import { outlineOf } from '@/lib/study-deck/deck';
import { conceptStatus, deckTotals, type DeckProgress } from '@/lib/study-deck/progress';
import type { StudyDeck } from '@/lib/study-deck/types';

export interface SummaryScreenProps {
  deck: StudyDeck;
  progress: DeckProgress;
  /** Keys of the activities that could actually be played, so an unplayable one is not held against the learner. */
  playable: ReadonlySet<string>;
  onRestart: () => void;
  onReview: (n: number) => void;
}

/**
 * What the learner did, concept by concept.
 *
 * Written answers are shown as "written", never as right or wrong: nothing in this platform
 * marks prose, and a screen that pretended otherwise would be teaching the wrong lesson.
 */
export function SummaryScreen({ deck, progress, playable, onRestart, onReview }: SummaryScreenProps) {
  const totals = deckTotals(deck, progress, playable);

  return (
    <section aria-labelledby="summary-title" className="space-y-5">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wider text-indigo-700">Chapter finished</p>
        <h2 id="summary-title" className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
          {deck.chapter.name}
        </h2>
        <p className="mt-1 text-base text-slate-700">
          You opened {totals.visited} of {totals.slides} slides and finished {totals.done} of {totals.activities} activities
          {totals.marked > 0 ? `, getting ${totals.correct} of ${totals.marked} marked answers right` : ''}.
        </p>
      </header>

      <div className="space-y-4">
        {outlineOf(deck).map((topic) => (
          <div key={topic.topicId} className="rounded-2xl border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-slate-900">{topic.name}</h3>
            <ul className="mt-2 divide-y divide-slate-100">
              {topic.concepts.map(({ concept, taughtOn }) => {
                const s = conceptStatus(deck, progress, concept.id);
                const detail =
                  s.activities === 0
                    ? 'Explained'
                    : `${s.done} of ${s.activities} done${s.correct ? `, ${s.correct} right` : ''}${s.unmarked ? `, ${s.unmarked} written` : ''}`;

                return (
                  <li key={concept.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span className="text-slate-800">{concept.name}</span>
                    <span className="flex items-center gap-3">
                      <span className="text-slate-600">{detail}</span>
                      {taughtOn[0] !== undefined ? (
                        <button
                          type="button"
                          onClick={() => onReview(taughtOn[0])}
                          className="text-indigo-700 underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600"
                        >
                          Review
                        </button>
                      ) : null}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={onRestart}
        className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600"
      >
        <RotateCcw className="h-4 w-4" aria-hidden="true" />
        Start again
      </button>
    </section>
  );
}
