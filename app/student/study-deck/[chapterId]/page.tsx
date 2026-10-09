'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';

import { StudyDeckPlayer } from '@/components/study-deck/StudyDeckPlayer';
import { startSlideOf } from '@/lib/study-deck/stage';
import type { BankQuestion } from '@/lib/h5p/question-bank-h5p-map';
import { learnerKey, loadBank, loadStudyDeck, PILOT_NOTE, type LoadedDeck } from '../data';

type State =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'ready'; loaded: LoadedDeck; bank: BankQuestion[] };

/**
 * The student's study deck for one chapter: /student/study-deck/<chapterId>.
 *
 * Add `?source=pilot` to read the local review copy instead of the stored deck.
 */
export default function StudyDeckPage() {
  const params = useParams<{ chapterId: string }>();
  const search = useSearchParams();
  const chapterId = Number(params?.chapterId ?? NaN);
  const pilot = search?.get('source') === 'pilot';
  // The Classroom Resource list opens a specific content item: /student/study-deck/<chapter>?content=<content_master.id>.
  const contentParam = Number(search?.get('content') ?? NaN);
  const contentId = Number.isFinite(contentParam) && contentParam > 0 ? contentParam : null;
  // ...and `&slide=<n>` opens that slide (the PDF links each activity to its slide this way).
  const slideParam = search?.get('slide') ?? null;
  const [state, setState] = useState<State>({ phase: 'loading' });
  const [attempt, setAttempt] = useState(0);

  const invalid = !Number.isFinite(chapterId) || chapterId <= 0;

  // State is only set after an await, never synchronously in the effect body; a retry resets it in its handler.
  useEffect(() => {
    if (invalid) return;
    const controller = new AbortController();
    const { signal } = controller;

    (async () => {
      try {
        const loaded = await loadStudyDeck(chapterId, { pilot, contentId, signal });
        const bank = await loadBank(chapterId, signal);
        if (!signal.aborted) setState({ phase: 'ready', loaded, bank });
      } catch (error) {
        if (signal.aborted) return;
        setState({ phase: 'error', message: error instanceof Error ? error.message : 'Something went wrong loading this chapter.' });
      }
    })();

    return () => controller.abort();
  }, [invalid, chapterId, pilot, contentId, attempt]);

  if (invalid) {
    return (
      <div role="alert" className="mx-auto max-w-xl px-4 py-16 text-slate-800">
        That is not a chapter.
      </div>
    );
  }

  if (state.phase === 'loading') {
    return (
      <div role="status" className="mx-auto flex max-w-xl items-center gap-3 px-4 py-16 text-slate-700">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
        Loading your study deck…
      </div>
    );
  }

  if (state.phase === 'error') {
    return (
      <div role="alert" className="mx-auto max-w-xl space-y-3 px-4 py-16">
        <p className="text-lg font-semibold text-slate-900">We couldn’t open this study deck</p>
        <p className="text-base text-slate-700">{state.message}</p>
        <button
          type="button"
          onClick={() => {
            setState({ phase: 'loading' });
            setAttempt((n) => n + 1);
          }}
          className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <>
      {state.loaded.source === 'pilot' ? (
        <p role="note" className="bg-amber-50 px-4 py-2 text-center text-sm text-amber-900">
          {PILOT_NOTE}
        </p>
      ) : null}
      <StudyDeckPlayer
        deck={state.loaded.deck}
        bank={state.bank}
        assetBase={state.loaded.assetBase}
        userKey={learnerKey()}
        startSlide={startSlideOf(slideParam, state.loaded.deck)}
        storage={typeof window !== 'undefined' ? window.localStorage : null}
      />
    </>
  );
}
