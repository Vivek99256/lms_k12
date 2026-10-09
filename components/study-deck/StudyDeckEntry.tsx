'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Sparkles } from 'lucide-react';

import { loadStudyDeck } from '@/app/student/study-deck/data';

export interface StudyDeckEntryProps {
  chapterId: number | null;
}

/**
 * The way in from a student's chapter page to the interactive study lesson.
 *
 * It appears ONLY when a stored study deck exists for the chapter: it asks the same read endpoint the
 * lesson uses and stays hidden on a 404 or any failure, so a chapter without a deck shows nothing
 * rather than a link to an error. Nothing is written.
 */
export function StudyDeckEntry({ chapterId }: StudyDeckEntryProps) {
  // Keyed by chapter: a result for the chapter that was selected before is never shown for the next.
  const [found, setFound] = useState<{ chapterId: number; title: string; concepts: number } | null>(null);

  useEffect(() => {
    if (!chapterId || !Number.isFinite(chapterId)) return;
    const controller = new AbortController();

    loadStudyDeck(chapterId, { pilot: false, signal: controller.signal })
      .then(({ deck }) => {
        if (!controller.signal.aborted) {
          setFound({ chapterId, title: deck.chapter.name, concepts: Object.keys(deck.concepts).length });
        }
      })
      .catch(() => {
        // No deck, or it could not be read: show nothing.
      });

    return () => controller.abort();
  }, [chapterId]);

  if (!found || found.chapterId !== chapterId) return null;

  return (
    <section
      aria-label="Interactive study lesson"
      className="mt-6 flex flex-col gap-4 rounded-2xl border border-indigo-200 bg-indigo-50/70 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 rounded-xl bg-indigo-600 p-2 text-white" aria-hidden="true">
          <Sparkles size={18} />
        </span>
        <div>
          <h3 className="text-base font-semibold text-slate-900">Study lesson</h3>
          <p className="mt-0.5 text-sm text-slate-700">
            Learn {found.concepts} ideas one at a time: explore diagrams, work through short scenarios and talk each idea over, at your own pace.
          </p>
        </div>
      </div>
      <Link
        href={`/student/study-deck/${found.chapterId}`}
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
      >
        Start lesson
        <ArrowRight size={16} aria-hidden="true" />
      </Link>
    </section>
  );
}
