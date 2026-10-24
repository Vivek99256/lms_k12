'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, Loader2 } from 'lucide-react';

import { useAuth } from '@/contexts/AuthContext';
import { buildSessionContext } from '@/lib/erp-client';
import { DashboardError, EmptyState } from '@/app/dashboard/_components/DashboardPrimitives';
import {
  defaultLearnerId,
  fetchAutoStudentDashboard,
  fetchChapterDashboard,
  type ChapterDashboard,
} from '@/app/pal/data/pal-eso';
import ChapterDashboardView from '@/app/pal/eso/_components/ChapterDashboardView';
import { friendlyError } from '@/lib/user-messages';

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
    const syear = buildSessionContext().syear || '2022';
    if (!learnerId) {
      setError('Your session is missing academic year information. Please sign in again.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    fetchAutoStudentDashboard(learnerId, syear, signal)
      .then((result) => {
        if (result.dashboard && result.dashboard.chapterSections && result.dashboard.chapterSections.length > 0) {
          setNoContent(false);
          setData(result.dashboard);
        } else {
          return fetchChapterDashboard(learnerId, 1014, signal).then((dash) => {
            setNoContent(false);
            setData(dash);
          });
        }
      })
      .catch((reason: unknown) => {
        if (signal?.aborted) return;
        fetchChapterDashboard(learnerId, 1014, signal)
          .then((dash) => {
            setNoContent(false);
            setData(dash);
          })
          .catch(() => {
            setError(friendlyError(reason, "We couldn't load your learning dashboard. Please try again."));
          });
      })
      .finally(() => {
        if (!signal?.aborted) setLoading(false);
      });
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      load(controller.signal);
    });
    return () => controller.abort();
  }, [load]);

  return (
    <div className="flex-1 overflow-auto p-8">
      {/* The greeting and the shape of the page are known before any request
          returns, so they paint immediately. */}
      {loading && (
        <>
          <h1 className="text-2xl font-bold text-slate-900">Welcome back, {user?.name || 'Student'}</h1>
          <p className="mt-1 text-sm text-slate-500">See where you are. Every student starts from the same concept.</p>
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
          <h1 className="text-2xl font-bold text-slate-900">Welcome back, {user?.name || 'Student'}</h1>
          <p className="mt-1 text-sm text-slate-500">See where you are. Every student starts from the same concept.</p>
          <div className="mt-6">
            <EmptyState message="Diagnostic questions aren't available for your subjects yet. Please check back soon." />
          </div>
        </>
      )}

      {!loading && !error && !noContent && data && (
        <>
          <ChapterDashboardView
            studentName={user?.name}
            data={data}
            learnerId={defaultLearnerId()}
            onGoToSubject={(subjectId) => router.push(`/pal?subjectId=${subjectId}`)}
            onOpenConcept={(conceptId) => router.push(`/pal/eso?conceptId=${conceptId}&learnerId=${defaultLearnerId()}`)}
          />

          <div className="mt-6">
            <Link
              href="/pal/eso/learning-path"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-800"
            >
              View your full learning path
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </>
      )}

      {!loading && (
        <div className="mt-8 rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-900">Alumni</h2>
          <p className="mt-1 text-sm text-slate-600">Jobs and internships from people who studied here, and mentors who can guide you.</p>
          <Link href="/alumni/student" className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-800">
            Open the alumni board
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}
    </div>
  );
}
