'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';

import { InlineMessage, PageFrame, PageHeader } from '@/app/fees/_components/fees-shared';
import { TransportationDashboard, VanSummaryPanel } from '@/app/Transportation/_components/transportation-dashboard';
import { getFeesSession, type FeesSession } from '@/app/fees/_lib/fees-api';
import {
  fetchTransportationDashboardSummary,
  type TransportationDashboardPayload,
} from '@/app/Transportation/_lib/transportation-dashboard-api';
import { Button } from '@/components/ui/button';
import { AllWidgetsHiddenNotice, CustomizeDashboard } from '@/app/dashboard/_components/CustomizeDashboard';
import { useDashboardPreferences } from '@/app/dashboard/_lib/useDashboardPreferences';
import type { DashboardWidget } from '@/app/dashboard/_lib/dashboard-preferences';

/** Everything on this dashboard a user can hide for themselves. Ids are stored per user — don't rename them. */
const TRANSPORTATION_WIDGETS = [
  { id: 'kpi.routes', label: 'Routes', group: 'kpi' },
  { id: 'kpi.vehicles', label: 'Vehicles', group: 'kpi' },
  { id: 'kpi.students_mapped', label: 'Students mapped', group: 'kpi' },
  { id: 'kpi.capacity_utilization', label: 'Capacity utilization', group: 'kpi' },
  { id: 'chart.vehicle_occupancy_by_shift', label: 'Vehicle occupancy by shift', group: 'chart' },
] as const satisfies readonly DashboardWidget[];

/**
 * Transportation dashboard — the module landing page, wired to the real
 * Laravel aggregate endpoint.
 *
 *   POST {API_BASE_URL}/api/transportation-dashboard/summary
 *   next_lms_erp/routes/api.php → TransportationDashboardApiController::summary
 */
export default function TransportationDashboardPage() {
  const [session, setSession] = useState<FeesSession | null>(null);
  const [payload, setPayload] = useState<TransportationDashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const prefs = useDashboardPreferences('module.transportation', TRANSPORTATION_WIDGETS);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSession(getFeesSession());
  }, []);

  const load = useCallback(
    async (activeSession: FeesSession, signal?: AbortSignal) => {
      if (!activeSession.subInstituteId || !activeSession.academicYearId) {
        setLoading(false);
        setError('No active session found. Sign in and pick an academic year to load the transportation dashboard.');
        return;
      }

      setLoading(true);
      setError('');

      try {
        const result = await fetchTransportationDashboardSummary(
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
        setError(caught instanceof Error ? caught.message : 'Unable to load the transportation dashboard summary.');
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
        title="Transportation dashboard"
        description="Routes, vehicles and student mappings for the current academic year."
        action={
          <div className="flex gap-2">
            {prefs.ready ? <CustomizeDashboard widgets={TRANSPORTATION_WIDGETS} {...prefs.customizeProps} /> : null}
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
          Loading transportation summary…
        </div>
      ) : null}

      {payload && prefs.ready && !prefs.hasVisible() ? <AllWidgetsHiddenNotice /> : null}

      {summary && prefs.ready && prefs.hasVisible('kpi') ? (
        <TransportationDashboard
          totalRoutes={summary.total_routes}
          totalVehicles={summary.total_vehicles}
          totalStudentsMapped={summary.total_students_mapped}
          capacityUtilization={summary.capacity_utilization}
          isVisible={prefs.isVisible}
        />
      ) : null}

      {payload && prefs.ready && prefs.isVisible('chart.vehicle_occupancy_by_shift') ? (
        <VanSummaryPanel rows={payload.van_summary ?? []} />
      ) : null}
    </PageFrame>
  );
}
