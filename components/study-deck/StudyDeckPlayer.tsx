'use client';

import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type CSSProperties } from 'react';
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
import { THEMES, themeOf, themeVars } from '@/lib/study-deck/theme';
import type { StudyDeck } from '@/lib/study-deck/types';
import { ImageEditButton, ImageEditingProvider, type ImageEditing } from './ImageEditing';
import { OutlineDrawer } from './OutlinePanel';
import { slidePlays } from '@/lib/study-document/play';
import { PracticeDialog } from './PracticeDialog';
import { SlideView } from './SlideView';
import { FitCanvas, MemoryContext, motion, SlideStage } from './stage-ui';
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
  /** Open on this slide instead of where the learner left off (a link from the PDF names one). Ignored if the deck has no such slide. */
  startSlide?: number | null;
  /**
   * Editing mode, offered only while a teacher reviews a draft: a Change image button on every slide with a picture. The player itself
   * stays read-only; it only reports which slide the teacher wants to change, and the caller opens the editor.
   */
  imageEditing?: Omit<ImageEditing, 'slide'> | null;
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
export function StudyDeckPlayer({ deck, bank, assetBase, userKey, storage = null, startSlide = null, imageEditing = null }: StudyDeckPlayerProps) {
  const router = useRouter();
  const chapterId = deck.chapter.id;
  const storeKey = progressKey(userKey, chapterId);
  // A link that names a slide (the PDF links each activity to its slide) opens there instead of where the learner left off.
  const [progress, dispatch] = useReducer(progressReducer, undefined, () => {
    const saved = loadProgress(storage, storeKey, chapterId);

    return startSlide !== null && deck.slides.some((s) => s.n === startSlide) ? progressReducer(saved, { type: 'goto', n: startSlide }) : saved;
  });
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
  // The lesson wears the colours of the topic on screen: the chrome around the slide follows it.
  const theme = finished ? THEMES.brand : themeOf(deck, slide);

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
    'inline-flex items-center gap-1.5 rounded-xl px-5 py-2 text-sm font-semibold shadow-sm transition active:scale-[0.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sd-accent';

  return (
    <ImageEditingProvider value={imageEditing ? { ...imageEditing, slide: slide.n } : null}>
    <section
      aria-label="Study lesson"
      data-sd-theme={theme.key}
      className="fixed inset-0 z-[200] flex h-dvh flex-col overflow-hidden bg-sd-soft/60 transition-colors"
      style={{ ...themeVars(theme), backgroundColor: theme.softer } as CSSProperties}
    >
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-sd-line bg-white px-3">
        <button type="button" onClick={exit} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sd-accent">
          <X className="h-4 w-4" aria-hidden="true" />
          Exit
        </button>
        <p className="min-w-0 flex-1 truncate text-sm font-semibold text-sd-strong">{deck.chapter.name}</p>
        <p className="shrink-0 text-xs font-medium text-slate-700">{finished ? 'Finished' : `Slide ${slide.n} of ${deck.slides.length}`}</p>
        {!finished ? <ImageEditButton target={{ slide: slide.n }} /> : null}
        {!finished && (slide.activities.length > 0 || slidePlays(deck.concepts, slide).length > 0) ? (
          <button
            type="button"
            onClick={() => setPracticeOpen(true)}
            aria-label="Practice"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-800 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sd-accent"
          >
            <Dumbbell className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Practice</span>
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => setOutlineOpen(true)}
          aria-label="Outline"
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-800 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sd-accent"
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
        className="h-1.5 shrink-0 bg-sd-soft"
      >
        <div className="h-full rounded-r-full bg-sd-accent transition-[width] duration-500" style={{ width: `${totals.percent}%` }} />
      </div>

      <div ref={stageRef} className="flex min-h-0 flex-1 flex-col">
        <FitCanvas resetKey={`${slide.n}:${stepIndex}:${finished}`}>
          <MemoryContext.Provider value={memory}>
          <div key={`${slide.n}:${stepIndex}:${finished}`} className={`h-full ${direction === 'back' ? motion.enterPrev : motion.enterNext}`}>
          {finished ? (
            <SlideStage theme={THEMES.brand}>
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
            </SlideStage>
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
              onNext={forward}
            />
          )}
          </div>
          </MemoryContext.Provider>
        </FitCanvas>
      </div>

      <footer className="grid h-16 shrink-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-t border-sd-line bg-white px-3">
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
            <p role="status" className="line-clamp-2 text-xs font-medium leading-tight text-sd-strong sm:text-sm">
              {hint}
            </p>
          ) : (
            <div className="flex items-center justify-center gap-2" aria-label={`Screen ${stepIndex + 1} of ${steps.length}`}>
              {steps.length > 1 && !finished
                ? steps.map((_, i) => <span key={i} aria-hidden="true" className={`h-2 w-2 rounded-full ${i === stepIndex ? 'bg-sd-accent' : 'bg-slate-300'}`} />)
                : null}
              <span className="truncate text-xs text-slate-600">{finished ? 'Well done' : `${totals.percent}% complete`}</span>
            </div>
          )}
        </div>

        {finished ? (
          <button type="button" onClick={exit} className={`${nav} bg-sd-accent text-white hover:bg-sd-strong`}>
            Exit lesson
          </button>
        ) : (
          <button
            type="button"
            onClick={forward}
            className={`${nav} ${hint ? 'border border-sd-line bg-white text-sd-strong hover:bg-sd-softer' : 'bg-sd-accent text-white hover:bg-sd-strong'}`}
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
    </ImageEditingProvider>
  );
}
