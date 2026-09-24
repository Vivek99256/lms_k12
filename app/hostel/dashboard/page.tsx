'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';

import { InlineMessage, PageFrame, PageHeader } from '@/app/fees/_components/fees-shared';
import {
  AllocationsByCategoryPanel,
  AllocationsByHostelPanel,
  HostelDashboard,
} from '@/app/hostel/_components/hostel-dashboard';
import { getFeesSession, type FeesSession } from '@/app/fees/_lib/fees-api';
import {
  fetchHostelDashboardSummary,
  type HostelDashboardPayload,
} from '@/app/hostel/_lib/hostel-dashboard-api';
import { Button } from '@/components/ui/button';
import { AllWidgetsHiddenNotice, CustomizeDashboard } from '@/app/dashboard/_components/CustomizeDashboard';
import { useDashboardPreferences } from '@/app/dashboard/_lib/useDashboardPreferences';
import type { DashboardWidget } from '@/app/dashboard/_lib/dashboard-preferences';

/** Everything on this dashboard a user can hide for themselves. Ids are stored per user — don't rename them. */
const HOSTEL_WIDGETS = [
  { id: 'kpi.hostels', label: 'Hostels', group: 'kpi' },
  { id: 'kpi.rooms', label: 'Rooms', group: 'kpi' },
  { id: 'kpi.allocations', label: 'Allocations', group: 'kpi' },
  { id: 'kpi.occupancy_rate', label: 'Occupancy rate', group: 'kpi' },
  { id: 'chart.allocations_by_hostel', label: 'Allocations by hostel', group: 'chart' },
  { id: 'chart.allocations_by_category', label: 'Allocations by admission category', group: 'chart' },
] as const satisfies readonly DashboardWidget[];

/**
 * Hostel dashboard — the module landing page, wired to the real Laravel
 * aggregate endpoint.
 *
 *   POST {API_BASE_URL}/api/hostel-dashboard/summary
 *   next_lms_erp/routes/api.php → HostelDashboardApiController::summary
 */
export default function HostelDashboardPage() {
  const [session, setSession] = useState<FeesSession | null>(null);
  const [payload, setPayload] = useState<HostelDashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const prefs = useDashboardPreferences('module.hostel', HOSTEL_WIDGETS);
  const show = prefs.isVisible;
  const bothCharts = show('chart.allocations_by_hostel') && show('chart.allocations_by_category');

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSession(getFeesSession());
  }, []);

  const load = useCallback(
    async (activeSession: FeesSession, signal?: AbortSignal) => {
      if (!activeSession.subInstituteId || !activeSession.academicYearId) {
        setLoading(false);
        setError('No active session found. Sign in and pick an academic year to load the hostel dashboard.');
        return;
      }

      setLoading(true);
      setError('');

      try {
        const result = await fetchHostelDashboardSummary(
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
        setError(caught instanceof Error ? caught.message : 'Unable to load the hostel dashboard summary.');
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
        title="Hostel dashboard"
        description="Rooms, occupancy and allocations for the current academic year."
        action={
          <div className="flex gap-2">
            {prefs.ready ? <CustomizeDashboard widgets={HOSTEL_WIDGETS} {...prefs.customizeProps} /> : null}
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
          Loading hostel summary…
        </div>
      ) : null}

      {payload && prefs.ready && !prefs.hasVisible() ? <AllWidgetsHiddenNotice /> : null}

      {summary && prefs.ready && prefs.hasVisible('kpi') ? (
        <HostelDashboard
          totalHostels={summary.total_hostels}
          totalRooms={summary.total_rooms}
          totalAllocations={summary.total_allocations}
          occupancyRate={summary.occupancy_rate}
          isVisible={show}
        />
      ) : null}

      {payload && prefs.ready && prefs.hasVisible('chart') ? (
        // A lone remaining chart takes the full row instead of leaving a gap.
        <div className={`grid grid-cols-1 gap-4 ${bothCharts ? 'xl:grid-cols-2' : ''}`}>
          {show('chart.allocations_by_hostel') ? (
            <AllocationsByHostelPanel rows={payload.allocations_by_hostel ?? []} />
          ) : null}
          {show('chart.allocations_by_category') ? (
            <AllocationsByCategoryPanel rows={payload.allocations_by_category ?? []} />
          ) : null}
        </div>
      ) : null}
    </PageFrame>
  );
}
