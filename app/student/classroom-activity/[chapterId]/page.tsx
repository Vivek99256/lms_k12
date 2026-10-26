'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';

import { ClassroomActivityPlayer } from '@/components/classroom-activity/ClassroomActivityPlayer';
import { parseClassroomActivity, type ClassroomActivity } from '@/lib/classroom-activity/activity';
import { loadClassroomActivity } from '@/lib/classroom-activity/api';
import { getRequestContext } from '@/app/course-master/page';

type State =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'ready'; activity: ClassroomActivity; contentId: number | string; userId: number | null; preview: boolean };

/** A review copy: a reviewed bundle served from public/classroom-activity/<key>.json, used before an activity is stored. */
const REVIEW_KEY = /^[a-z0-9][a-z0-9-]{0,60}$/;

/**
 * A chapter's interactive Classroom Activity: /student/classroom-activity/<chapterId>?content=<content_master.id>.
 *
 * The activity is read from the stored document; nothing is generated when this opens, and nothing a learner types is sent
 * anywhere. `?source=pilot&key=<key>` opens a review copy from a file instead, for checking an activity before it is stored.
 */
export default function ClassroomActivityPage() {
  const params = useParams<{ chapterId: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const chapterId = Number(params?.chapterId ?? NaN);
  const contentParam = Number(search?.get('content') ?? NaN);
  const contentId = Number.isFinite(contentParam) && contentParam > 0 ? contentParam : null;
  const reviewKey = search?.get('source') === 'pilot' ? (search.get('key') ?? '') : null;
  const [state, setState] = useState<State>({ phase: 'loading' });
  const [attempt, setAttempt] = useState(0);

  const invalid = !Number.isFinite(chapterId) || chapterId <= 0 || (reviewKey === null && contentId === null) || (reviewKey !== null && !REVIEW_KEY.test(reviewKey));

  // State is only set after an await, never synchronously in the effect body; a retry resets it in its handler.
  useEffect(() => {
    if (invalid) return;
    const controller = new AbortController();
    const userId = Number(getRequestContext()?.user_id ?? 0) || null;
    (async () => {
      try {
        if (reviewKey !== null) {
          const res = await fetch(`/classroom-activity/${reviewKey}.json`, { signal: controller.signal });
          if (!res.ok) throw new Error('There is no review copy of this activity.');
          const activity = parseClassroomActivity(await res.json());
          if (!controller.signal.aborted) setState({ phase: 'ready', activity, contentId: `review-${reviewKey}`, userId, preview: true });
          return;
        }
        const loaded = await loadClassroomActivity(chapterId, contentId as number, { signal: controller.signal });
        if (!controller.signal.aborted) setState({ phase: 'ready', activity: loaded.activity, contentId: loaded.contentId, userId, preview: false });
      } catch (error) {
        if (controller.signal.aborted) return;
        setState({ phase: 'error', message: error instanceof Error ? error.message : 'Something went wrong loading this activity.' });
      }
    })();
    return () => controller.abort();
  }, [invalid, chapterId, contentId, reviewKey, attempt]);

  if (invalid) {
    return (
      <div role="alert" className="mx-auto max-w-xl px-4 py-16 text-slate-800">
        That is not an activity link.
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6">
      <div className="mx-auto mb-4 w-full max-w-5xl print:hidden">
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-semibold text-slate-800 hover:bg-slate-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to classroom resources
        </button>
      </div>

      {state.phase === 'loading' ? (
        <div role="status" className="mx-auto flex max-w-xl items-center gap-3 py-16 text-slate-800">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
          Loading the activity…
        </div>
      ) : null}

      {state.phase === 'error' ? (
        <div role="alert" className="mx-auto max-w-xl space-y-3 py-16">
          <p className="text-lg font-semibold text-slate-900">We couldn’t open this activity</p>
          <p className="text-base text-slate-800">{state.message}</p>
          <button
            type="button"
            onClick={() => {
              setState({ phase: 'loading' });
              setAttempt((n) => n + 1);
            }}
            className="min-h-11 rounded-lg bg-emerald-800 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800"
          >
            Try again
          </button>
        </div>
      ) : null}

      {state.phase === 'ready' ? <ClassroomActivityPlayer activity={state.activity} contentId={state.contentId} userId={state.userId} preview={state.preview} /> : null}
    </main>
  );
}
