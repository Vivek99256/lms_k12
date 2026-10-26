'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';

import { VocabularyClassPlayer } from '@/components/vocabulary-class/VocabularyClassPlayer';
import { loadVocabularyClass, type LoadedVocabularyClass } from '@/lib/vocabulary-class/api';

type State = { phase: 'loading' } | { phase: 'error'; message: string } | { phase: 'ready'; loaded: LoadedVocabularyClass };

/**
 * A chapter's Vocabulary Class: /student/vocabulary-class/<chapterId>?content=<content_master.id>.
 *
 * The deck is read from the stored document; nothing is generated when this opens.
 */
export default function VocabularyClassPage() {
  const params = useParams<{ chapterId: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const chapterId = Number(params?.chapterId ?? NaN);
  const contentParam = Number(search?.get('content') ?? NaN);
  const contentId = Number.isFinite(contentParam) && contentParam > 0 ? contentParam : null;
  const [state, setState] = useState<State>({ phase: 'loading' });
  const [attempt, setAttempt] = useState(0);

  const invalid = !Number.isFinite(chapterId) || chapterId <= 0;

  // State is only set after an await, never synchronously in the effect body; a retry resets it in its handler.
  useEffect(() => {
    if (invalid) return;
    const controller = new AbortController();
    (async () => {
      try {
        const loaded = await loadVocabularyClass(chapterId, { contentId, signal: controller.signal });
        if (!controller.signal.aborted) setState({ phase: 'ready', loaded });
      } catch (error) {
        if (controller.signal.aborted) return;
        setState({ phase: 'error', message: error instanceof Error ? error.message : 'Something went wrong loading this vocabulary class.' });
      }
    })();
    return () => controller.abort();
  }, [invalid, chapterId, contentId, attempt]);

  if (invalid) {
    return (
      <div role="alert" className="mx-auto max-w-xl px-4 py-16 text-slate-800">
        That is not a chapter.
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6">
      <div className="mx-auto mb-4 w-full max-w-5xl">
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to classroom resources
        </button>
      </div>

      {state.phase === 'loading' ? (
        <div role="status" className="mx-auto flex max-w-xl items-center gap-3 py-16 text-slate-700">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
          Loading the vocabulary class…
        </div>
      ) : null}

      {state.phase === 'error' ? (
        <div role="alert" className="mx-auto max-w-xl space-y-3 py-16">
          <p className="text-lg font-semibold text-slate-900">We couldn’t open this vocabulary class</p>
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
      ) : null}

      {state.phase === 'ready' ? (
        <>
          <VocabularyClassPlayer deck={state.loaded.deck} chapterId={chapterId} />
        </>
      ) : null}
    </main>
  );
}
