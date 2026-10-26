'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, Loader2 } from 'lucide-react';

import { useAuth } from '@/contexts/AuthContext';
import { useShellMenu } from '@/app/components/shell-menu-context';
import { buildStudentNav } from '@/app/components/student/student-nav';
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
 * Shortcuts to the screens this student's account can open. Built from the same
 * rights-filtered menu the navigation uses, so a tile never leads to a page the
 * student can't use.
 */
function QuickAccess() {
  const { menuItems, loading } = useShellMenu();
  const items = useMemo(
    () => buildStudentNav(menuItems).flatMap((section) => section.items).slice(0, 8),
    [menuItems],
  );

  if (loading && items.length === 0) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-100" />
        ))}
      </div>
    );
  }
  if (items.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className="group flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 transition group-hover:bg-indigo-600 group-hover:text-white">
              <Icon size={20} />
            </span>
            <span className="text-sm font-semibold text-slate-800">{item.label}</span>
          </Link>
        );
      })}
    </div>
  );
}

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
    <div className="mx-auto w-full space-y-8 px-4 py-6 sm:px-6 lg:px-8">
      {/* The greeting and the shape of the page are known before any request
          returns, so they paint immediately. */}
     

      {loading && (
        <>
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
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
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
