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

  useEffect(() => {
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
          Loading hostel summary…
        </div>
      ) : null}

      {summary ? (
        <HostelDashboard
          totalHostels={summary.total_hostels}
          totalRooms={summary.total_rooms}
          totalAllocations={summary.total_allocations}
          occupancyRate={summary.occupancy_rate}
        />
      ) : null}

      {payload ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <AllocationsByHostelPanel rows={payload.allocations_by_hostel ?? []} />
          <AllocationsByCategoryPanel rows={payload.allocations_by_category ?? []} />
        </div>
      ) : null}
    </PageFrame>
  );
}
