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
 * taught and has explored the interactive part of (practice is optional and does not hold a tick back). Selecting a concept goes to the slide that
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
              const complete = status.complete;
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

export interface OutlineDrawerProps extends OutlinePanelProps {
  onClose: () => void;
}

/**
 * The outline as a drawer: closed during the lesson so the slide has the whole screen, opened from the header.
 * It is the one part of the player that may scroll, because it is a list the learner opened.
 */
export function OutlineDrawer({ onClose, ...panel }: OutlineDrawerProps) {
  return (
    <div className="fixed inset-0 z-[310] flex" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div
        role="dialog"
        aria-label="Outline"
        aria-modal="true"
        onKeyDown={(event) => event.key === 'Escape' && onClose()}
        className="flex h-full w-[min(22rem,90vw)] flex-col bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <p className="text-sm font-semibold text-slate-900">Outline</p>
          <button
            type="button"
            onClick={onClose}
            autoFocus
            className="rounded-lg px-2 py-1 text-sm text-slate-700 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600"
          >
            Close
          </button>
        </div>
        <div className="overflow-y-auto p-4">
          <OutlinePanel {...panel} />
        </div>
      </div>
      <div className="flex-1 bg-slate-900/40" aria-hidden="true" />
    </div>
  );
}
