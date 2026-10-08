'use client';

import { CheckCircle2, Circle } from 'lucide-react';

import { conceptStatus, type DeckProgress } from '@/lib/study-deck/progress';
import { outlineOf } from '@/lib/study-deck/deck';
import type { StudyDeck } from '@/lib/study-deck/types';

export interface OutlinePanelProps {
  deck: StudyDeck;
  progress: DeckProgress;
  /** The slide the learner is on, to highlight the concept being taught. */
  currentSlide: number;
  onGoto: (n: number) => void;
}

/**
 * Chapter -> topic -> concept, with a tick against every concept the learner has been
 * taught and finished the activities for. Selecting a concept goes to the slide that
 * explains it.
 */
export function OutlinePanel({ deck, progress, currentSlide, onGoto }: OutlinePanelProps) {
  const topics = outlineOf(deck);

  return (
    <nav aria-label="Chapter outline" className="space-y-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{deck.chapter.name}</p>
      {topics.map((topic) => (
        <div key={topic.topicId}>
          <p className="text-sm font-semibold text-slate-900">{topic.name}</p>
          <ul className="mt-1 space-y-0.5">
            {topic.concepts.map(({ concept, taughtOn }) => {
              const status = conceptStatus(deck, progress, concept.id);
              const complete = status.taught && status.done === status.activities;
              const here = taughtOn.includes(currentSlide);
              const target = taughtOn[0];

              return (
                <li key={concept.id}>
                  <button
                    type="button"
                    disabled={target === undefined}
                    aria-current={here ? 'step' : undefined}
                    onClick={() => target !== undefined && onGoto(target)}
                    className={`flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600 ${
                      here ? 'bg-indigo-50 font-medium text-indigo-900' : 'text-slate-700 hover:bg-slate-100'
                    } disabled:cursor-not-allowed disabled:opacity-50`}
                  >
                    {complete ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-label="Completed" />
                    ) : (
                      <Circle className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-label={status.taught ? 'Taught' : 'Not started'} />
                    )}
                    <span>{concept.name}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
