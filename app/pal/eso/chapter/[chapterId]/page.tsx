'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';

import { useAuth } from '@/contexts/AuthContext';
import { DashboardError } from '@/app/dashboard/_components/DashboardPrimitives';
import { defaultLearnerId, fetchChapterDashboard, type ChapterDashboard } from '@/app/pal/data/pal-eso';
import { useViewAsStudent } from '@/app/pal/data/pal-view-as';
import ChapterDashboardView from '@/app/pal/eso/_components/ChapterDashboardView';

/**
 * The chapter-level "where am I" screen a student lands on before drilling
 * into a concept — everything comes from one call to
 * EsoPolicyService::chapterDashboard() (see app/pal/data/pal-eso.ts,
 * fetchChapterDashboard); nothing on this page is static/mock data. Content
 * rendering lives in ChapterDashboardView, shared with the main student
 * dashboard (app/dashboard/StudentDashboard.tsx), which auto-picks the
 * chapter instead of taking it from the URL.
 */
export default function PalChapterDashboardPage() {
  return (
    <Suspense fallback={<CenteredSpinner label="Loading..." />}>
      <PalChapterDashboard />
    </Suspense>
  );
}

function CenteredSpinner({ label }: { label: string }) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center text-sm text-slate-500">
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      {label}
    </div>
  );
}

function PalChapterDashboard() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const viewAsStudent = useViewAsStudent();

  const chapterId = Number((params?.chapterId as string) || '0');
  // Same convention as app/pal/eso/page.tsx: the real entry point never puts
  // learnerId in the URL for a student — it resolves to defaultLearnerId().
  // `?learnerId=` only matters for a staff "view as student" session, and
  // the backend independently enforces ownership regardless.
  const learnerId = searchParams.get('learnerId') || viewAsStudent?.studentId || defaultLearnerId();

  const [data, setData] = useState<ChapterDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    (signal?: AbortSignal) => {
      if (!chapterId || !learnerId) return;
      setLoading(true);
      setError(null);
      fetchChapterDashboard(learnerId, chapterId, signal)
        .then(setData)
        .catch((reason: unknown) => {
          if (signal?.aborted) return;
          setError(reason instanceof Error ? reason.message : 'Unable to load your PAL dashboard.');
        })
        .finally(() => {
          if (!signal?.aborted) setLoading(false);
        });
    },
    [chapterId, learnerId]
  );

  useEffect(() => {
    const controller = new AbortController();
    // Deferred to a microtask so setLoading/setError inside load() don't
    // fire synchronously within the effect body — same convention as
    // app/pal/eso/page.tsx's refresh().
    queueMicrotask(() => {
      load(controller.signal);
    });
    return () => controller.abort();
  }, [load]);

  if (!chapterId) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <Alert tone="error">A chapter must be selected to open this dashboard (missing chapterId in the URL).</Alert>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      {loading && <CenteredSpinner label="Loading your PAL dashboard..." />}
      {!loading && error && <DashboardError message={error} onRetry={() => load()} />}

      {!loading && !error && data && (
        <ChapterDashboardView
          studentName={user?.name}
          data={data}
          onGoToSubject={(subjectId) => router.push(`/pal?subjectId=${subjectId}`)}
          onOpenConcept={(conceptId) => router.push(`/pal/eso?conceptId=${conceptId}${learnerId ? `&learnerId=${learnerId}` : ''}`)}
        />
      )}
    </div>
  );
}

function Alert({ children, tone = 'info' }: { children: React.ReactNode; tone?: 'info' | 'error' }) {
  return (
    <div
      className={`rounded-lg border px-4 py-3 text-sm ${
        tone === 'error' ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-slate-200 bg-slate-50 text-slate-600'
      }`}
    >
      {children}
    </div>
  );
}
