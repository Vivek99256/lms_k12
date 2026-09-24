'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';

import { InlineMessage, PageFrame, PageHeader } from '@/app/fees/_components/fees-shared';
import { FeesDashboard } from '@/app/fees/_components/fees-dashboard';
import { FeesCharts } from '@/app/fees/_components/fees-charts';
import { getFeesSession, type FeesSession } from '@/app/fees/_lib/fees-api';
import {
  fetchFeesDashboardSummary,
  type FeesDashboardPayload,
} from '@/app/fees/_lib/fees-dashboard-api';
import { Button } from '@/components/ui/button';
import { AllWidgetsHiddenNotice, CustomizeDashboard } from '@/app/dashboard/_components/CustomizeDashboard';
import { useDashboardPreferences } from '@/app/dashboard/_lib/useDashboardPreferences';
import type { DashboardWidget } from '@/app/dashboard/_lib/dashboard-preferences';

/** Everything on this dashboard a user can hide for themselves. Ids are stored per user — don't rename them. */
const FEES_WIDGETS = [
  { id: 'kpi.collected_this_term', label: 'Collected this term', group: 'kpi' },
  { id: 'kpi.outstanding', label: 'Outstanding', group: 'kpi' },
  { id: 'kpi.collection_rate', label: 'Collection rate', group: 'kpi' },
  { id: 'kpi.defaulters', label: 'Defaulters', group: 'kpi' },
  { id: 'chart.collection_vs_target', label: 'Collection vs target', group: 'chart' },
  { id: 'chart.headwise', label: 'Head-wise collected vs pending', group: 'chart' },
  { id: 'chart.payment_mode_mix', label: 'Payment mode mix', group: 'chart' },
] as const satisfies readonly DashboardWidget[];

/**
 * Fees dashboard — the four stat cards, wired to the real Laravel aggregate
 * endpoint.
 *
 *   POST {API_BASE_URL}/api/fees-dashboard/summary
 *   next_lms_erp/routes/api.php:205 → FeesDashboardApiController::summary
 *   Contract: next_lms_erp/docs/fees-api/fees-dashboard-contract.md
 */
export default function FeesDashboardPage() {
  const [session, setSession] = useState<FeesSession | null>(null);
  const [payload, setPayload] = useState<FeesDashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const prefs = useDashboardPreferences('module.fees', FEES_WIDGETS);

  // Session lives in browser storage, so it can only be read after mount.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSession(getFeesSession());
  }, []);

  const load = useCallback(
    async (activeSession: FeesSession, signal?: AbortSignal) => {
      if (!activeSession.subInstituteId || !activeSession.academicYearId) {
        setLoading(false);
        setError('No active session found. Sign in and pick an academic year to load the fees dashboard.');
        return;
      }

      setLoading(true);
      setError('');

      try {
        const result = await fetchFeesDashboardSummary(
          activeSession,
          {
            sub_institute_id: activeSession.subInstituteId,
            syear: activeSession.academicYearId,
            user_id: activeSession.userId,
            // term_id on a receipt IS the month_id (contract §1.3). Sending it
            // scopes "collected this term" to that fee-month bucket; when the
            // session has no term, the API falls back to the whole syear.
            month_id: activeSession.termId || null,
          },
          signal
        );

        if (signal?.aborted) return;
        setPayload(result);
      } catch (caught) {
        if (signal?.aborted) return;
        setError(caught instanceof Error ? caught.message : 'Unable to load the fees dashboard summary.');
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
        title="Fees dashboard"
        description="Collection, outstanding and defaulters for the current academic year."
        action={
          <div className="flex gap-2">
            {prefs.ready ? <CustomizeDashboard widgets={FEES_WIDGETS} {...prefs.customizeProps} /> : null}
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
          Loading fees summary…
        </div>
      ) : null}

      {payload && prefs.ready && !prefs.hasVisible() ? <AllWidgetsHiddenNotice /> : null}

      {summary && prefs.ready && prefs.hasVisible('kpi') ? (
        <FeesDashboard
          collectedThisTerm={summary.collected_display}
          outstanding={summary.outstanding_display}
          collectionRate={summary.collection_rate_display}
          defaulters={summary.defaulters_count}
          termLabel={payload?.context?.month_label ?? undefined}
          isVisible={prefs.isVisible}
        />
      ) : null}

      {payload && prefs.ready && prefs.hasVisible('chart') ? (
        <FeesCharts
          collectionVsTarget={payload.collection_vs_target ?? []}
          headwise={payload.headwise ?? []}
          paymentModeMix={payload.payment_mode_mix ?? []}
          stale={loading}
          isVisible={prefs.isVisible}
        />
      ) : null}
    </PageFrame>
  );
}
