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
import { AllWidgetsHiddenNotice, CustomizeDashboard } from '@/app/dashboard/_components/CustomizeDashboard';
import { useDashboardPreferences } from '@/app/dashboard/_lib/useDashboardPreferences';
import type { DashboardWidget } from '@/app/dashboard/_lib/dashboard-preferences';

/** Everything on this dashboard a user can hide for themselves. Ids are stored per user — don't rename them. */
const STUDENTS_WIDGETS = [
  { id: 'kpi.active_students', label: 'Active students', group: 'kpi' },
  { id: 'kpi.classes', label: 'Classes', group: 'kpi' },
  { id: 'kpi.left_this_year', label: 'Left this year', group: 'kpi' },
  { id: 'kpi.retention', label: 'Retention', group: 'kpi' },
  { id: 'chart.students_by_class', label: 'Students by class', group: 'chart' },
  { id: 'chart.gender_breakdown', label: 'Gender breakdown', group: 'chart' },
  { id: 'chart.left_by_reason', label: 'Students who left, by reason', group: 'chart' },
  { id: 'panel.recently_enrolled', label: 'Recently enrolled', group: 'panel' },
] as const satisfies readonly DashboardWidget[];

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
  const prefs = useDashboardPreferences('module.students', STUDENTS_WIDGETS);
  const show = prefs.isVisible;
  // Each row holds two panels; a lone one takes the full width.
  const bothUpper = show('chart.students_by_class') && show('chart.gender_breakdown');
  const bothLower = show('panel.recently_enrolled') && show('chart.left_by_reason');

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
          <div className="flex gap-2">
            {prefs.ready ? <CustomizeDashboard widgets={STUDENTS_WIDGETS} {...prefs.customizeProps} /> : null}
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
          </div>
        }
      />

      {error ? <InlineMessage type="error" text={error} /> : null}

      {/* Wait for the user's layout too, so hidden widgets never flash in. */}
      {(loading && !summary) || (!prefs.ready && !error) ? (
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-6 text-sm text-slate-500 shadow-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading students summary…
        </div>
      ) : null}

      {payload && prefs.ready && !prefs.hasVisible() ? <AllWidgetsHiddenNotice /> : null}

      {summary && prefs.ready && prefs.hasVisible('kpi') ? (
        <StudentsDashboard
          totalStudents={summary.total_students}
          inactiveThisYear={summary.inactive_this_year}
          totalClasses={summary.total_classes}
          isVisible={show}
        />
      ) : null}

      {payload && prefs.ready && (show('chart.students_by_class') || show('chart.gender_breakdown')) ? (
        <div className={`grid grid-cols-1 gap-4 ${bothUpper ? 'xl:grid-cols-2' : ''}`}>
          {show('chart.students_by_class') ? <StudentsByClassPanel rows={payload.students_by_class ?? []} /> : null}
          {show('chart.gender_breakdown') ? <GenderBreakdownPanel rows={payload.gender_breakdown ?? []} /> : null}
        </div>
      ) : null}

      {payload && prefs.ready && (show('panel.recently_enrolled') || show('chart.left_by_reason')) ? (
        <div className={`grid grid-cols-1 gap-4 ${bothLower ? 'xl:grid-cols-2' : ''}`}>
          {show('panel.recently_enrolled') ? <RecentEnrollmentsPanel rows={payload.recent_enrollments ?? []} /> : null}
          {show('chart.left_by_reason') ? <DropReasonsPanel rows={payload.drop_reasons ?? []} /> : null}
        </div>
      ) : null}
    </PageFrame>
  );
}
