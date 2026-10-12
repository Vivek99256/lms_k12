'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { getSubjectAndChapters, type SubjectWithChapters } from '../../../../data/chapters';
import { LessonPlanView } from './LessonPlanView';
import { fetchLessonPlan, legacyLessonPlanFormUrl, type LessonPlanData } from './lessonPlanApi';

function firstParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

function LoadingState() {
  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-6 px-4 py-6 sm:px-6 lg:px-8" aria-busy="true" aria-label="Loading lesson plan">
      <Skeleton className="h-5 w-72" />
      <Skeleton className="h-10 w-64" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <Skeleton key={item} className="h-16 rounded-xl" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <Skeleton className="hidden h-64 rounded-xl lg:block" />
        <div className="space-y-6">
          <Skeleton className="h-72 rounded-2xl" />
          <Skeleton className="h-72 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}

export default function LessonPlanChapterPage() {
  const router = useRouter();
  const params = useParams();
  const courseId = firstParam(params?.courseId);
  const chapterId = firstParam(params?.chapterId);

  // Same course id convention as the Chapters screen: "<subjectId>-<standardId>".
  const [subjectId, standardId = ''] = courseId.split('-', 2);

  const [reloadKey, setReloadKey] = useState(0);
  const invalidLink = !subjectId || !standardId || !chapterId;
  const requestKey = `${subjectId}|${standardId}|${chapterId}|${reloadKey}`;
  const [result, setResult] = useState<{ key: string; plan: LessonPlanData | null; error: string }>({
    key: '',
    plan: null,
    error: '',
  });
  const [course, setCourse] = useState<SubjectWithChapters | null>(null);

  useEffect(() => {
    if (invalidLink) return;
    const controller = new AbortController();
    fetchLessonPlan({ standardId, subjectId, chapterId }, controller.signal)
      .then((data) => setResult({ key: requestKey, plan: data, error: '' }))
      .catch((cause: unknown) => {
        if ((cause as Error)?.name === 'AbortError') return;
        setResult({
          key: requestKey,
          plan: null,
          error: cause instanceof Error ? cause.message : "Couldn't load the lesson plan. Try again.",
        });
      });
    return () => controller.abort();
  }, [invalidLink, subjectId, standardId, chapterId, requestKey]);

  const settled = result.key === requestKey;
  const plan = settled ? result.plan : null;
  const loading = !invalidLink && !settled;
  const error = invalidLink ? 'This lesson plan link is incomplete.' : settled ? result.error : '';

  // Chapter list: powers the chapter switcher and supplies names when no plan exists yet.
  useEffect(() => {
    if (!subjectId) return;
    let cancelled = false;
    getSubjectAndChapters(subjectId, standardId).then((data) => {
      if (!cancelled) setCourse(data);
    });
    return () => {
      cancelled = true;
    };
  }, [subjectId, standardId]);

  const chapters = useMemo(() => (course?.chapters ?? []).map((chapter) => ({ id: chapter.id, title: chapter.title })), [course]);
  const chaptersHref = `/course-master/lesson-plan/${courseId}/chapters`;
  const goBack = useCallback(() => router.push(chaptersHref), [router, chaptersHref]);
  const selectChapter = useCallback(
    (nextId: string) => router.push(`${chaptersHref}/${encodeURIComponent(nextId)}`),
    [router, chaptersHref]
  );

  if (loading) return <LoadingState />;

  if (error || !plan) {
    return (
      <div className="mx-auto flex min-h-[50vh] w-full max-w-xl flex-col items-center justify-center gap-3 px-4 text-center">
        <AlertTriangle size={28} aria-hidden="true" className="text-amber-600" />
        <h1 className="text-xl font-semibold text-slate-900">We couldn’t open this lesson plan</h1>
        <p className="text-sm text-slate-600">{error || 'Something went wrong. Try again.'}</p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={goBack} className="h-10 rounded-xl px-4">
            Back to chapters
          </Button>
          <Button onClick={() => setReloadKey((key) => key + 1)} className="h-10 rounded-xl px-4">
            Try again
          </Button>
        </div>
      </div>
    );
  }

  const currentChapter = chapters.find((chapter) => chapter.id === chapterId);
  // Identify the chapter by the URL so switching chapters never shows the previous one's title.
  const viewPlan: LessonPlanData = { ...plan, chapterId };

  return (
    <LessonPlanView
      key={`${plan.id || 'new'}-${chapterId}`}
      plan={viewPlan}
      chapters={chapters}
      chapterTitle={plan.chapterName || currentChapter?.title || ''}
      subjectTitle={plan.subjectName || course?.subject?.subject_name || ''}
      standardTitle={plan.standardName || course?.subject?.standard_name || ''}
      editHref={legacyLessonPlanFormUrl(plan)}
      onSelectChapter={selectChapter}
      onBack={goBack}
    />
  );
}
