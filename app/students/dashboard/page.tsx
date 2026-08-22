'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';

import { InlineMessage, PageFrame, PageHeader } from '@/app/fees/_components/fees-shared';
import {
  DropReasonsPanel,
  GenderBreakdownPanel,
  RecentEnrollmentsPanel,
  StudentsByClassPanel,
  StudentsDashboard,
} from '@/app/students/_components/students-dashboard';
import { getFeesSession, type FeesSession } from '@/app/fees/_lib/fees-api';
import {
  fetchStudentsDashboardSummary,
  type StudentsDashboardPayload,
} from '@/app/students/_lib/students-dashboard-api';
import { Button } from '@/components/ui/button';

/**
 * Students dashboard — the module landing page (Main dashboard → Students →
 * this screen → Directory / Discipline / Documents / …), wired to the real
 * Laravel aggregate endpoint.
 *
 *   POST {API_BASE_URL}/api/students-dashboard/summary
 *   next_lms_erp/routes/api.php → StudentsDashboardApiController::summary
 */
export default function StudentsDashboardPage() {
  const [session, setSession] = useState<FeesSession | null>(null);
  const [payload, setPayload] = useState<StudentsDashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setSession(getFeesSession());
  }, []);

  const load = useCallback(
    async (activeSession: FeesSession, signal?: AbortSignal) => {
      if (!activeSession.subInstituteId || !activeSession.academicYearId) {
        setLoading(false);
        setError('No active session found. Sign in and pick an academic year to load the students dashboard.');
        return;
      }

      setLoading(true);
      setError('');

      try {
        const result = await fetchStudentsDashboardSummary(
          activeSession,
          {
            sub_institute_id: activeSession.subInstituteId,
            syear: activeSession.academicYearId,
            user_id: activeSession.userId,
          },
          signal
        );

        if (signal?.aborted) return;
        setPayload(result);
      } catch (caught) {
        if (signal?.aborted) return;
        setError(caught instanceof Error ? caught.message : 'Unable to load the students dashboard summary.');
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (!session) return;

    const controller = new AbortController();
    void load(session, controller.signal);

    return () => controller.abort();
  }, [session, load]);

  const summary = payload?.summary;

  return (
    <PageFrame>
      <PageHeader
        title="Students dashboard"
        description="Enrollment, class strength and movement for the current academic year."
        action={
          <Button
            type="button"
            variant="outline"
            disabled={loading || !session}
            onClick={() => session && void load(session)}
          >
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Refresh
          </Button>
        }
      />

      {error ? <InlineMessage type="error" text={error} /> : null}

      {loading && !summary ? (
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-6 text-sm text-slate-500 shadow-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading students summary…
        </div>
      ) : null}

      {summary ? (
        <StudentsDashboard
          totalStudents={summary.total_students}
          inactiveThisYear={summary.inactive_this_year}
          totalClasses={summary.total_classes}
        />
      ) : null}

      {payload ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <StudentsByClassPanel rows={payload.students_by_class ?? []} />
          <GenderBreakdownPanel rows={payload.gender_breakdown ?? []} />
        </div>
      ) : null}

      {payload ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <RecentEnrollmentsPanel rows={payload.recent_enrollments ?? []} />
          <DropReasonsPanel rows={payload.drop_reasons ?? []} />
        </div>
      ) : null}
    </PageFrame>
  );
}
