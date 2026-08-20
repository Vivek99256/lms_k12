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

  useEffect(() => {
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
          Loading admissions summary…
        </div>
      ) : null}

      {summary ? (
        <AdmissionsDashboard
          totalEnquiries={summary.total_enquiries}
          totalApplications={summary.total_applications}
          totalRegistrations={summary.total_registrations}
          conversionRate={summary.conversion_rate}
        />
      ) : null}

      {payload ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <EnquiriesByStandardPanel rows={payload.enquiries_by_standard ?? []} />
          <AdmissionsFunnelPanel rows={payload.registrations_by_status ?? []} />
        </div>
      ) : null}

      {payload ? <RecentEnquiriesPanel rows={payload.recent_enquiries ?? []} /> : null}
    </PageFrame>
  );
}
