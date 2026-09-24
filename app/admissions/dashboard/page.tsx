'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';

import { InlineMessage, PageFrame, PageHeader } from '@/app/fees/_components/fees-shared';
import {
  AdmissionsDashboard,
  AdmissionsFunnelPanel,
  EnquiriesByStandardPanel,
  RecentEnquiriesPanel,
} from '@/app/admissions/_components/admissions-dashboard';
import { getFeesSession, type FeesSession } from '@/app/fees/_lib/fees-api';
import {
  fetchAdmissionsDashboardSummary,
  type AdmissionsDashboardPayload,
} from '@/app/admissions/_lib/admissions-dashboard-api';
import { Button } from '@/components/ui/button';
import { AllWidgetsHiddenNotice, CustomizeDashboard } from '@/app/dashboard/_components/CustomizeDashboard';
import { useDashboardPreferences } from '@/app/dashboard/_lib/useDashboardPreferences';
import type { DashboardWidget } from '@/app/dashboard/_lib/dashboard-preferences';

/** Everything on this dashboard a user can hide for themselves. Ids are stored per user — don't rename them. */
const ADMISSIONS_WIDGETS = [
  { id: 'kpi.enquiries', label: 'Enquiries', group: 'kpi' },
  { id: 'kpi.applications', label: 'Applications', group: 'kpi' },
  { id: 'kpi.registrations', label: 'Registrations', group: 'kpi' },
  { id: 'kpi.conversion_rate', label: 'Conversion rate', group: 'kpi' },
  { id: 'chart.enquiries_by_grade', label: 'Enquiries by grade', group: 'chart' },
  { id: 'chart.registrations_by_status', label: 'Registrations by status', group: 'chart' },
  { id: 'panel.recent_enquiries', label: 'Recent enquiries', group: 'panel' },
] as const satisfies readonly DashboardWidget[];

/**
 * Admissions dashboard — the module landing page (Main dashboard → Admissions
 * → this screen → Enquiries / Applications / Registrations), wired to the
 * real Laravel aggregate endpoint.
 *
 *   POST {API_BASE_URL}/api/admissions-dashboard/summary
 *   next_lms_erp/routes/api.php → AdmissionsDashboardApiController::summary
 */
export default function AdmissionsDashboardPage() {
  const [session, setSession] = useState<FeesSession | null>(null);
  const [payload, setPayload] = useState<AdmissionsDashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const prefs = useDashboardPreferences('module.admissions', ADMISSIONS_WIDGETS);
  const show = prefs.isVisible;
  const bothCharts = show('chart.enquiries_by_grade') && show('chart.registrations_by_status');

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSession(getFeesSession());
  }, []);

  const load = useCallback(
    async (activeSession: FeesSession, signal?: AbortSignal) => {
      if (!activeSession.subInstituteId || !activeSession.academicYearId) {
        setLoading(false);
        setError('No active session found. Sign in and pick an academic year to load the admissions dashboard.');
        return;
      }

      setLoading(true);
      setError('');

      try {
        const result = await fetchAdmissionsDashboardSummary(
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
        setError(caught instanceof Error ? caught.message : 'Unable to load the admissions dashboard summary.');
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
        title="Admissions dashboard"
        description="Enquiries, applications and registrations for the current academic year."
        action={
          <div className="flex gap-2">
            {prefs.ready ? <CustomizeDashboard widgets={ADMISSIONS_WIDGETS} {...prefs.customizeProps} /> : null}
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
          Loading admissions summary…
        </div>
      ) : null}

      {payload && prefs.ready && !prefs.hasVisible() ? <AllWidgetsHiddenNotice /> : null}

      {summary && prefs.ready && prefs.hasVisible('kpi') ? (
        <AdmissionsDashboard
          totalEnquiries={summary.total_enquiries}
          totalApplications={summary.total_applications}
          totalRegistrations={summary.total_registrations}
          conversionRate={summary.conversion_rate}
          isVisible={show}
        />
      ) : null}

      {payload && prefs.ready && prefs.hasVisible('chart') ? (
        // A lone remaining chart takes the full row instead of leaving a gap.
        <div className={`grid grid-cols-1 gap-4 ${bothCharts ? 'xl:grid-cols-2' : ''}`}>
          {show('chart.enquiries_by_grade') ? <EnquiriesByStandardPanel rows={payload.enquiries_by_standard ?? []} /> : null}
          {show('chart.registrations_by_status') ? <AdmissionsFunnelPanel rows={payload.registrations_by_status ?? []} /> : null}
        </div>
      ) : null}

      {payload && prefs.ready && show('panel.recent_enquiries') ? (
        <RecentEnquiriesPanel rows={payload.recent_enquiries ?? []} />
      ) : null}
    </PageFrame>
  );
}
