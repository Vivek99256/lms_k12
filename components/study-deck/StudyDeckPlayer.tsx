'use client';

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Menu } from 'lucide-react';

import type { BankQuestion } from '@/lib/h5p/question-bank-h5p-map';
import { activityKey, resolveActivity } from '@/lib/study-deck/deck';
import {
  deckTotals,
  loadProgress,
  progressKey,
  progressReducer,
  saveProgress,
  slideStatus,
  type ResultInput,
  type StorageLike,
} from '@/lib/study-deck/progress';
import type { StudyDeck } from '@/lib/study-deck/types';
import { OutlinePanel } from './OutlinePanel';
import { SlideView } from './SlideView';
import { SummaryScreen } from './SummaryScreen';

export interface StudyDeckPlayerProps {
  deck: StudyDeck;
  /** The chapter's question-bank rows. Only the ones the deck names are used. */
  bank: BankQuestion[];
  /** Where relative image paths are served from; null when the deck's images are absolute URLs. */
  assetBase: string | null;
  /** Identifies the learner so progress is kept per learner. */
  userKey: string;
  storage?: StorageLike | null;
}

/**
 * The student's study experience for a chapter, rendered natively.
 *
 * It does not open the PPTX. It walks the deck slide by slide - explanation, picture, example,
 * common mistake, connected concepts, then interactive activities - and each activity is the
 * existing shared `QuestionPlayer` asked as the H5P target the deck chose, reading the real
 * question-bank row. Answers are marked and explained by that player. Nothing is written to
 * the database: progress lives in this browser (see lib/study-deck/progress.ts).
 */
export function StudyDeckPlayer({ deck, bank, assetBase, userKey, storage = null }: StudyDeckPlayerProps) {
  const chapterId = deck.chapter.id;
  const storeKey = progressKey(userKey, chapterId);
  const [progress, dispatch] = useReducer(progressReducer, undefined, () => loadProgress(storage, storeKey, chapterId));
  const [finished, setFinished] = useState(false);
  const [outlineOpen, setOutlineOpen] = useState(false);
  const lessonRef = useRef<HTMLElement>(null);
  const firstView = useRef(true);

  const bankMap = useMemo(() => new Map(bank.map((q) => [Number(q.id), q])), [bank]);

  // Which activities can really be played, so an unplayable one never blocks a slide or the totals.
  const playable = useMemo(() => {
    const keys = new Set<string>();
    deck.slides.forEach((slide) =>
      slide.activities.forEach((activity, index) => {
        if (resolveActivity(activity, bankMap).ok) keys.add(activityKey(slide, index));
      })
    );
    return keys;
  }, [deck, bankMap]);

  const lastIndex = deck.slides.length - 1;
  const index = Math.min(Math.max(progress.current - 1, 0), lastIndex);
  const slide = deck.slides[index];

  // Opening a slide marks it visited. The reducer ignores a repeat.
  useEffect(() => {
    if (!finished && !progress.visited.includes(slide.n)) {
      dispatch({ type: 'goto', n: slide.n });
    }
  }, [finished, slide.n, progress.visited]);

  useEffect(() => {
    saveProgress(storage, storeKey, progress);
  }, [storage, storeKey, progress]);

  // A new slide (or the summary) starts at its top. The app shell scrolls its own content area, not the
  // window, so `window.scrollTo` does nothing here: without this, pressing Continue at the bottom of one slide
  // opened the next one scrolled down with its title out of sight.
  useEffect(() => {
    if (firstView.current) {
      firstView.current = false;
      return;
    }
    lessonRef.current?.scrollIntoView({ block: 'start' });
  }, [finished, index]);

  const goto = useCallback((n: number) => {
    setFinished(false);
    setOutlineOpen(false);
    dispatch({ type: 'goto', n });
  }, []);

  const onResult = useCallback((key: string, result: ResultInput, conceptId: number | null, questionId: number | null) => {
    dispatch({ type: 'result', key, result, conceptId, questionId });
  }, []);

  const totals = deckTotals(deck, progress, playable);
  const status = slideStatus(slide, progress, playable);
  const next = deck.slides[index + 1];

  return (
    <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 lg:grid-cols-[18rem_1fr]">
      <aside className="lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
        <button
          type="button"
          onClick={() => setOutlineOpen((open) => !open)}
          aria-expanded={outlineOpen}
          className="mb-3 inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 lg:hidden"
        >
          <Menu className="h-4 w-4" aria-hidden="true" />
          Chapter outline
        </button>
        <div className={`${outlineOpen ? 'block' : 'hidden'} rounded-2xl border border-slate-200 bg-white p-4 lg:block`}>
          <OutlinePanel deck={deck} progress={progress} currentSlide={finished ? -1 : slide.n} onGoto={goto} />
        </div>
      </aside>

      <section ref={lessonRef} aria-label="Study lesson" className="min-w-0 scroll-mt-4 space-y-5">
        <div>
          <div className="mb-1 flex items-center justify-between text-xs text-slate-600">
            <span>
              {finished ? 'Finished' : `Slide ${slide.n} of ${deck.slides.length}`}
            </span>
            <span>{totals.percent}% complete</span>
          </div>
          <div
            role="progressbar"
            aria-label="Chapter progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={totals.percent}
            className="h-2 overflow-hidden rounded-full bg-slate-200"
          >
            <div className="h-full rounded-full bg-indigo-600 transition-[width]" style={{ width: `${totals.percent}%` }} />
          </div>
        </div>

        {finished ? (
          <SummaryScreen
            deck={deck}
            progress={progress}
            playable={playable}
            onRestart={() => {
              dispatch({ type: 'reset' });
              setFinished(false);
            }}
            onReview={goto}
          />
        ) : (
          <>
            <SlideView
              key={slide.n}
              deck={deck}
              slide={slide}
              bank={bankMap}
              progress={progress}
              assetBase={assetBase}
              onResult={onResult}
              onGoto={goto}
            />

            <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
              <button
                type="button"
                disabled={index === 0}
                onClick={() => goto(slide.n - 1)}
                className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                Back
              </button>

              <p className="order-last w-full text-center text-xs text-slate-600 sm:order-none sm:w-auto">
                {status.total > status.done
                  ? `${status.total - status.done} ${status.total - status.done === 1 ? 'activity' : 'activities'} still to try on this slide`
                  : next
                    ? `Next: ${next.title}`
                    : 'This is the last slide'}
              </p>

              <button
                type="button"
                onClick={() => (index === lastIndex ? setFinished(true) : goto(slide.n + 1))}
                className="inline-flex items-center gap-1 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
              >
                {index === lastIndex ? 'Finish' : 'Continue'}
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </footer>
          </>
        )}

        <p className="text-xs text-slate-500">
          Your place and progress are saved in this browser. Your answers are also recorded as learning activity, as in other practice activities.
        </p>
      </section>
    </div>
  );
}
