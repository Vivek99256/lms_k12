'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

import { readH5pContext, type H5pContext } from '../../../data/h5p';
import type { QuestionBankApiQuestion } from '@/app/course-master/data/chapters';
import {
  buildPlayable,
  fetchQuestionWithChapter,
  type PlayableActivity,
} from '../../../data/question-bank-library';
import { EmptyState, InlineBanner } from '../../../components/shared';
import { PlayerSkeleton } from '../../../components/game';
import { RuntimePlayer, runtimeLibraryName } from '../../components/runtime-player';

/**
 * A question bank question, played full screen.
 *
 * WHAT THIS ROUTE IS FOR. The library's preview is a panel over the table,
 * which is right for checking a question and moving on. This is the same
 * activity with the table out of the way -- a link a teacher can open in a
 * second tab, share with a colleague or project onto a board.
 *
 * IT STILL WRITES NOTHING. The question is fetched, the row is built in memory
 * and the player renders it. Reloading this page rebuilds it; closing the tab
 * disposes of it. There is no draft behind the URL, which is why the URL names
 * the QUESTION and not an activity.
 *
 * THE CHAPTER IS IN THE QUERY STRING because `/api/lms-question-bank` is
 * chapter-scoped: there is no fetch-one-question endpoint, so the chapter is
 * what is asked for and the question is picked out of the response. A case
 * study stem needs its sub-parts from that same response anyway.
 */

function RuntimePlayerPageContent() {
  const params = useParams<{ questionId: string }>();
  const searchParams = useSearchParams();

  const questionId = Number(params?.questionId ?? 0);
  const ctx: H5pContext = useMemo(
    () => readH5pContext(new URLSearchParams(searchParams?.toString())),
    [searchParams]
  );

  const [activity, setActivity] = useState<PlayableActivity | null>(null);
  const [question, setQuestion] = useState<QuestionBankApiQuestion | null>(null);
  const [chapter, setChapter] = useState<QuestionBankApiQuestion[]>([]);
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();

    queueMicrotask(() => {
      if (controller.signal.aborted) return;

      const chapterId = Number(ctx.chapter_id);
      if (!chapterId || !questionId) {
        setError('This link is missing the chapter or the question it should open.');
        setLoading(false);
        return;
      }

      fetchQuestionWithChapter(chapterId, questionId, controller.signal)
        .then(({ question, chapter }) => {
          if (controller.signal.aborted) return;

          if (!question) {
            setError(`Question ${questionId} is not in this chapter.`);
            return;
          }

          const built = buildPlayable(question, chapter, ctx, ctx.chapter_name);
          if (!built.ok || !built.activity) {
            setError(built.reason ?? 'This question cannot be played.');
            return;
          }

          setActivity(built.activity);
          setQuestion(question);
          setChapter(chapter);
          setTitle(built.mapping?.label ?? '');
        })
        .catch((err: unknown) => {
          if (!controller.signal.aborted) {
            setError(err instanceof Error ? err.message : 'Could not load this question.');
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    });

    return () => controller.abort();
  }, [ctx, questionId]);

  const backHref = `/h5p/question-bank-library?${searchParams?.toString() ?? ''}`;

  return (
    <div className="p-4 sm:p-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <Link
            href={backHref}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to the question bank library
          </Link>

          {activity ? (
            <span className="inline-flex items-center gap-2 text-[11px] text-slate-500">
              <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-600">{title}</span>
              <span className="font-mono">{runtimeLibraryName(activity)}</span>
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700">
                Live preview &mdash; nothing saved
              </span>
            </span>
          ) : null}
        </div>

        {loading ? (
          <PlayerSkeleton lines={3} label="Building the activity" />
        ) : error ? (
          <InlineBanner kind="error" message={error} />
        ) : activity && question ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
            <RuntimePlayer question={question} chapter={chapter} embedded={false} />
          </div>
        ) : (
          <EmptyState title="Nothing to play" hint="This question could not be turned into an activity." />
        )}
      </div>
    </div>
  );
}

export default function RuntimePlayerPage() {
  return (
    <Suspense fallback={<PlayerSkeleton lines={3} label="Loading activity" />}>
      <RuntimePlayerPageContent />
    </Suspense>
  );
}
