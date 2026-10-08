'use client';

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, Dumbbell, List, X } from 'lucide-react';

import type { BankQuestion } from '@/lib/h5p/question-bank-h5p-map';
import { activityKey, resolveActivity } from '@/lib/study-deck/deck';
import { exampleKey, interactionKey } from '@/lib/study-deck/interactions';
import {
  deckTotals,
  loadProgress,
  progressKey,
  progressReducer,
  saveProgress,
  type ResultInput,
  type StorageLike,
} from '@/lib/study-deck/progress';
import { nextPosition, pendingHint, previousPosition, stepsOf } from '@/lib/study-deck/stage';
import type { StudyDeck } from '@/lib/study-deck/types';
import { OutlineDrawer } from './OutlinePanel';
import { PracticeDialog } from './PracticeDialog';
import { SlideView } from './SlideView';
import { FitCanvas, MemoryContext, motion } from './stage-ui';
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
 * The student's study lesson for a chapter, as a presentation.
 *
 * It fills the screen: a slim header, the slide, and a footer with Previous and Continue that are always in view.
 * Nothing on the page scrolls. A slide is shown one screen at a time - the teaching screen with its large visual and
 * any hotspots, scenario or cards, then the worked example, then the question for the class - and the outline and the
 * optional practice open over the lesson on request instead of taking space from it.
 *
 * It does not open the PPTX. Nothing is written to the database by the lesson itself: progress lives in this browser
 * (see lib/study-deck/progress.ts), and the practice questions are the existing shared players.
 */
export function StudyDeckPlayer({ deck, bank, assetBase, userKey, storage = null }: StudyDeckPlayerProps) {
  const router = useRouter();
  const chapterId = deck.chapter.id;
  const storeKey = progressKey(userKey, chapterId);
  const [progress, dispatch] = useReducer(progressReducer, undefined, () => loadProgress(storage, storeKey, chapterId));
  const [finished, setFinished] = useState(false);
  const [step, setStep] = useState(0);
  const [outlineOpen, setOutlineOpen] = useState(false);
  const [practiceOpen, setPracticeOpen] = useState(false);
  // Which way the learner is travelling, so the next screen arrives from that side.
  const [direction, setDirection] = useState<'next' | 'back'>('next');
  const stageRef = useRef<HTMLDivElement>(null);
  // What the learner has opened on each screen, kept while the lesson is open.
  const [memory] = useState(() => new Map<string, unknown>());

  const bankMap = useMemo(() => new Map(bank.map((q) => [Number(q.id), q])), [bank]);

  // Which practice activities can really be played, so an unplayable one never counts in the totals.
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
  const steps = stepsOf(slide);
  const stepIndex = Math.min(step, steps.length - 1);

  // Opening a slide marks it visited. The reducer ignores a repeat.
  useEffect(() => {
    if (!finished && !progress.visited.includes(slide.n)) {
      dispatch({ type: 'goto', n: slide.n });
    }
  }, [finished, slide.n, progress.visited]);

  useEffect(() => {
    saveProgress(storage, storeKey, progress);
  }, [storage, storeKey, progress]);

  // A new screen takes focus so a keyboard or screen-reader user lands on it.
  useEffect(() => {
    stageRef.current?.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true });
  }, [slide.n, stepIndex, finished]);

  const goto = useCallback((n: number) => {
    setDirection('next');
    setFinished(false);
    setOutlineOpen(false);
    setStep(0);
    dispatch({ type: 'goto', n });
  }, []);

  const onResult = useCallback((key: string, result: ResultInput, conceptId: number | null, questionId: number | null) => {
    dispatch({ type: 'result', key, result, conceptId, questionId });
  }, []);

  const stepKind = steps[stepIndex];
  const exploredDone = Boolean(progress.activities[(stepKind === 'example' ? exampleKey : interactionKey)(slide)]?.done);
  const hint = finished ? null : pendingHint(slide, stepKind, exploredDone);
  const totals = deckTotals(deck, progress, playable);

  const forward = useCallback(() => {
    if (finished) return;
    setDirection('next');
    const next = nextPosition(deck, { n: slide.n, step: stepIndex });
    if (!next) {
      setFinished(true);
      return;
    }
    if (next.n !== slide.n) dispatch({ type: 'goto', n: next.n });
    setStep(next.step);
  }, [deck, finished, slide.n, stepIndex]);

  const back = useCallback(() => {
    setDirection('back');
    if (finished) {
      setFinished(false);
      setStep(stepsOf(deck.slides[lastIndex]).length - 1);
      return;
    }
    const before = previousPosition(deck, { n: slide.n, step: stepIndex });
    if (!before) return;
    if (before.n !== slide.n) dispatch({ type: 'goto', n: before.n });
    setStep(before.step);
  }, [deck, finished, lastIndex, slide.n, stepIndex]);

  const exit = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) router.back();
    else router.push('/student');
  };

  // Arrow keys move through the lesson, unless the learner is typing or a window is open over it.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (outlineOpen || practiceOpen) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
      if (event.key === 'ArrowRight') forward();
      if (event.key === 'ArrowLeft') back();
    };
    window.addEventListener('keydown', onKey);

    return () => window.removeEventListener('keydown', onKey);
  }, [forward, back, outlineOpen, practiceOpen]);

  const atStart = !finished && index === 0 && stepIndex === 0;
  const last = !finished && nextPosition(deck, { n: slide.n, step: stepIndex }) === null;
  const nav =
    'inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600';

  return (
    <section aria-label="Study lesson" className="fixed inset-0 z-[200] flex h-dvh flex-col overflow-hidden bg-slate-100">
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-3">
        <button type="button" onClick={exit} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600">
          <X className="h-4 w-4" aria-hidden="true" />
          Exit
        </button>
        <p className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">{deck.chapter.name}</p>
        <p className="shrink-0 text-xs text-slate-600">{finished ? 'Finished' : `Slide ${slide.n} of ${deck.slides.length}`}</p>
        {!finished && slide.activities.length > 0 ? (
          <button
            type="button"
            onClick={() => setPracticeOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-800 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600"
          >
            <Dumbbell className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Practice</span>
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => setOutlineOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-800 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600"
        >
          <List className="h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline">Outline</span>
        </button>
      </header>
      <div
        role="progressbar"
        aria-label="Chapter progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={totals.percent}
        className="h-1 shrink-0 bg-slate-200"
      >
        <div className="h-full bg-indigo-600 transition-[width]" style={{ width: `${totals.percent}%` }} />
      </div>

      <div ref={stageRef} className="flex min-h-0 flex-1 flex-col">
        <FitCanvas resetKey={`${slide.n}:${stepIndex}:${finished}`}>
          <MemoryContext.Provider value={memory}>
          <div key={`${slide.n}:${stepIndex}:${finished}`} className={`h-full ${direction === 'back' ? motion.enterPrev : motion.enterNext}`}>
          {finished ? (
            <SummaryScreen
              deck={deck}
              progress={progress}
              playable={playable}
              onRestart={() => {
                dispatch({ type: 'reset' });
                memory.clear();
                setFinished(false);
                setStep(0);
              }}
              onReview={goto}
            />
          ) : (
            <SlideView
              key={`${slide.n}:${stepIndex}`}
              deck={deck}
              slide={slide}
              step={steps[stepIndex]}
              progress={progress}
              assetBase={assetBase}
              onResult={onResult}
              onGoto={goto}
            />
          )}
          </div>
          </MemoryContext.Provider>
        </FitCanvas>
      </div>

      <footer className="grid h-16 shrink-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-t border-slate-200 bg-white px-3">
        <button
          type="button"
          onClick={back}
          disabled={atStart}
          className={`${nav} border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40`}
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          Previous
        </button>

        <div className="min-w-0 text-center">
          {hint ? (
            <p role="status" className="line-clamp-2 text-xs font-medium leading-tight text-indigo-800 sm:text-sm">
              {hint}
            </p>
          ) : (
            <div className="flex items-center justify-center gap-2" aria-label={`Screen ${stepIndex + 1} of ${steps.length}`}>
              {steps.length > 1 && !finished
                ? steps.map((_, i) => <span key={i} aria-hidden="true" className={`h-2 w-2 rounded-full ${i === stepIndex ? 'bg-indigo-600' : 'bg-slate-300'}`} />)
                : null}
              <span className="truncate text-xs text-slate-600">{finished ? 'Well done' : `${totals.percent}% complete`}</span>
            </div>
          )}
        </div>

        {finished ? (
          <button type="button" onClick={exit} className={`${nav} bg-indigo-600 text-white hover:bg-indigo-700`}>
            Exit lesson
          </button>
        ) : (
          <button
            type="button"
            onClick={forward}
            className={`${nav} ${hint ? 'border border-indigo-300 bg-white text-indigo-800 hover:bg-indigo-50' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
          >
            {last ? 'Finish' : 'Continue'}
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </footer>

      {outlineOpen ? <OutlineDrawer deck={deck} progress={progress} currentSlide={finished ? -1 : slide.n} onGoto={goto} onClose={() => setOutlineOpen(false)} /> : null}
      {practiceOpen ? (
        <PracticeDialog deck={deck} slide={slide} bank={bankMap} progress={progress} onResult={onResult} onClose={() => setPracticeOpen(false)} />
      ) : null}
    </section>
  );
}
