'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

import { useAuth } from '@/contexts/AuthContext';
import { buildSessionContext } from '@/lib/erp-client';
import { DashboardError, EmptyState } from '@/app/dashboard/_components/DashboardPrimitives';
import { defaultLearnerId, fetchAutoStudentDashboard, type ChapterDashboard } from '@/app/pal/data/pal-eso';
import ChapterDashboardView from '@/app/pal/eso/_components/ChapterDashboardView';

/**
 * The student's main /dashboard landing page — the PAL "Hello, {name}"
 * chapter dashboard, with the chapter auto-picked across the student's
 * whole enrollment (see EsoPolicyService::studentDashboard()) since there's
 * no chapterId in this route. Content rendering is shared with the
 * chapter-scoped route at app/pal/eso/chapter/[chapterId]/page.tsx via
 * ChapterDashboardView — nothing here is static/mock data.
 */
export default function StudentDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<ChapterDashboard | null>(null);
  const [noContent, setNoContent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback((signal?: AbortSignal) => {
    const learnerId = defaultLearnerId();
    const syear = buildSessionContext().syear;
    if (!learnerId || !syear) {
      setError('Your session is missing academic year information. Please sign in again.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    fetchAutoStudentDashboard(learnerId, syear, signal)
      .then((result) => {
        setNoContent(result.noContent);
        setData(result.dashboard);
      })
      .catch((reason: unknown) => {
        if (signal?.aborted) return;
        setError(reason instanceof Error ? reason.message : 'Unable to load your PAL dashboard.');
      })
      .finally(() => {
        if (!signal?.aborted) setLoading(false);
      });
  }, []);

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

  return (
    <div className="flex-1 overflow-auto p-8">
      {/* The greeting and the shape of the page are known before any request
          returns, so they paint immediately. Previously the whole screen was a
          single centred spinner until the dashboard call completed, which on
          this estate (remote database) is long enough to look like a failure. */}
      {loading && (
        <>
          <h1 className="text-2xl font-bold text-slate-900">Hello, {user?.name || 'Student'}</h1>
          <p className="mt-1 text-sm text-slate-500">This page shows where you are, and all students start from the same concept.</p>
          <div className="my-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-lg border border-slate-200 bg-slate-50" />
            ))}
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading your progress...
          </div>
        </>
      )}

      {!loading && error && <DashboardError message={error} onRetry={() => load()} />}

      {!loading && !error && noContent && (
        <>
          <h1 className="text-2xl font-bold text-slate-900">Hello, {user?.name || 'Student'}</h1>
          <p className="mt-1 text-sm text-slate-500">This page shows where you are, and all students start from the same concept.</p>
          <div className="mt-6">
            <EmptyState message="Adaptive learning content isn't available for your subjects yet. Check back soon." />
          </div>
        </>
      )}

      {!loading && !error && !noContent && data && (
        <ChapterDashboardView
          studentName={user?.name}
          data={data}
          learnerId={defaultLearnerId()}
          onGoToSubject={(subjectId) => router.push(`/pal?subjectId=${subjectId}`)}
          onOpenConcept={(conceptId) => router.push(`/pal/eso?conceptId=${conceptId}&learnerId=${defaultLearnerId()}`)}
        />
      )}
    </div>
  );
}
