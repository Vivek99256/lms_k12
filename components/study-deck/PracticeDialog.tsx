'use client';

import { useEffect, useMemo, useRef } from 'react';
import { X } from 'lucide-react';

import { activityKey, resolveActivity, type ResolvedActivity } from '@/lib/study-deck/deck';
import type { ResultInput } from '@/lib/study-deck/progress';
import type { DeckProgress } from '@/lib/study-deck/progress';
import type { BankQuestion } from '@/lib/h5p/question-bank-h5p-map';
import type { DeckSlide, StudyDeck } from '@/lib/study-deck/types';
import { ActivityCard } from './ActivityCard';

export interface PracticeDialogProps {
  deck: StudyDeck;
  slide: DeckSlide;
  bank: ReadonlyMap<number, BankQuestion>;
  progress: DeckProgress;
  onResult: (key: string, result: ResultInput, conceptId: number | null, questionId: number | null) => void;
  onClose: () => void;
}

/**
 * Optional practice, opened on request over the lesson.
 *
 * The lesson is a presentation; a question-bank question is not part of it. A learner who wants to check themselves
 * opens this, and it holds the existing native question player. Nothing about the slide changes behind it, and it is
 * the one place where content may scroll, because it is a window the learner opened, not the lesson.
 */
export function PracticeDialog({ deck, slide, bank, progress, onResult, onClose }: PracticeDialogProps) {
  const panel = useRef<HTMLDivElement>(null);
  const resolved: ResolvedActivity[] = useMemo(() => slide.activities.map((activity) => resolveActivity(activity, bank)), [slide, bank]);
  const nameOf = (id: number | null) => (id !== null ? deck.concepts[String(id)]?.name ?? null : null);

  useEffect(() => {
    panel.current?.focus({ preventScroll: true });
  }, []);

  return (
    <div className="fixed inset-0 z-[320] flex items-center justify-center bg-slate-900/50 p-3" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label="Optional practice"
        tabIndex={-1}
        onKeyDown={(event) => event.key === 'Escape' && onClose()}
        className="flex max-h-[90dvh] w-[min(52rem,96vw)] flex-col rounded-2xl bg-white shadow-2xl outline-none"
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div>
            <p className="text-base font-semibold text-slate-900">Practice</p>
            <p className="text-xs text-slate-600">Optional. This does not change your lesson progress.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close practice"
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <div className="space-y-3 overflow-y-auto p-4">
          {resolved.map((r, index) => {
            const key = activityKey(slide, index);

            return (
              <ActivityCard
                key={`${key}-${r.activity.question_id ?? 'authored'}`}
                resolved={r}
                activityKey={key}
                done={Boolean(progress.activities[key]?.done)}
                connects={nameOf(r.activity.connects_concept)}
                onResult={onResult}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
