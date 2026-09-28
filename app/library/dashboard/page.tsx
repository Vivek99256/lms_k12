'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';

import { InlineMessage, PageFrame, PageHeader } from '@/app/fees/_components/fees-shared';
import {
  ItemsByMaterialTypePanel,
  LibraryDashboard,
  RecentIssuesPanel,
} from '@/app/library/_components/library-dashboard';
import { getFeesSession, type FeesSession } from '@/app/fees/_lib/fees-api';
import {
  fetchLibraryDashboardSummary,
  type LibraryDashboardPayload,
} from '@/app/library/_lib/library-dashboard-api';
import { Button } from '@/components/ui/button';
import { AllWidgetsHiddenNotice, CustomizeDashboard } from '@/app/dashboard/_components/CustomizeDashboard';
import { useDashboardPreferences } from '@/app/dashboard/_lib/useDashboardPreferences';
import type { DashboardWidget } from '@/app/dashboard/_lib/dashboard-preferences';

/** Everything on this dashboard a user can hide for themselves. Ids are stored per user — don't rename them. */
const LIBRARY_WIDGETS = [
  { id: 'kpi.titles', label: 'Titles', group: 'kpi' },
  { id: 'kpi.copies_in_catalog', label: 'Copies in catalog', group: 'kpi' },
  { id: 'kpi.currently_issued', label: 'Currently issued', group: 'kpi' },
  { id: 'kpi.overdue', label: 'Overdue', group: 'kpi' },
  { id: 'chart.catalog_by_material_type', label: 'Catalog by material type', group: 'chart' },
  { id: 'panel.recent_issues', label: 'Recent issues', group: 'panel' },
] as const satisfies readonly DashboardWidget[];

/**
 * Library dashboard — the module landing page, wired to the real Laravel
 * aggregate endpoint.
 *
 *   POST {API_BASE_URL}/api/library-dashboard/summary
 *   next_lms_erp/routes/api.php → LibraryDashboardApiController::summary
 */
export default function LibraryDashboardPage() {
  const [session, setSession] = useState<FeesSession | null>(null);
  const [payload, setPayload] = useState<LibraryDashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const prefs = useDashboardPreferences('module.library', LIBRARY_WIDGETS);
  const show = prefs.isVisible;
  const bothPanels = show('chart.catalog_by_material_type') && show('panel.recent_issues');

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSession(getFeesSession());
  }, []);

  const load = useCallback(
    async (activeSession: FeesSession, signal?: AbortSignal) => {
      if (!activeSession.subInstituteId || !activeSession.academicYearId) {
        setLoading(false);
        setError('No active session found. Sign in and pick an academic year to load the library dashboard.');
        return;
      }

      setLoading(true);
      setError('');

      try {
        const result = await fetchLibraryDashboardSummary(
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
        setError(caught instanceof Error ? caught.message : 'Unable to load the library dashboard summary.');
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
        title="Library dashboard"
        description="Catalog, circulation and overdue books for the current academic year."
        action={
          <div className="flex gap-2">
            {prefs.ready ? <CustomizeDashboard widgets={LIBRARY_WIDGETS} {...prefs.customizeProps} /> : null}
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
          Loading library summary…
        </div>
      ) : null}

      {payload && prefs.ready && !prefs.hasVisible() ? <AllWidgetsHiddenNotice /> : null}

      {summary && prefs.ready && prefs.hasVisible('kpi') ? (
        <LibraryDashboard
          totalTitles={summary.total_titles}
          totalItems={summary.total_items}
          currentlyIssued={summary.currently_issued}
          overdue={summary.overdue}
          isVisible={show}
        />
      ) : null}

      {payload && prefs.ready && (show('chart.catalog_by_material_type') || show('panel.recent_issues')) ? (
        // A lone remaining panel takes the full row instead of leaving a gap.
        <div className={`grid grid-cols-1 gap-4 ${bothPanels ? 'xl:grid-cols-2' : ''}`}>
          {show('chart.catalog_by_material_type') ? (
            <ItemsByMaterialTypePanel rows={payload.items_by_material_type ?? []} />
          ) : null}
          {show('panel.recent_issues') ? <RecentIssuesPanel rows={payload.recent_issues ?? []} /> : null}
        </div>
      ) : null}
    </PageFrame>
  );
}
