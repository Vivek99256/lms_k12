'use client';

// DS status: `@platform/components-core` is NOT merged into this repo yet
// (absent from package.json, package-lock.json and node_modules). `StatCard`
// is sourced locally with an identical prop surface until it lands — see
// components/ui/stat-card.tsx. Swapping back is this one line:
//   import { StatCard } from "@platform/components-core";
import { StatCard } from '@/components/ui/stat-card';

/**
 * Real Fees dashboard — built from confirmed real fields, not invented.
 * Source: lms-k12.vercel.app/fees/collect (live screenshot, CAP-013).
 *
 * This is the concrete demonstration of "universalization" — no new
 * button, no new card component was needed. StatCard already existed,
 * proven across all four themes. This screen is just real Fees data
 * poured into it.
 *
 * Backend wiring (this file stays presentational — the page fetches):
 *   API      POST {API_BASE_URL}/api/fees-dashboard/summary
 *   Route    next_lms_erp/routes/api.php:205
 *   Handler  next_lms_erp/app/Http/Controllers/api/FeesDashboardApiController.php::summary
 *   Contract next_lms_erp/docs/fees-api/fees-dashboard-contract.md
 *
 * Prop ← response mapping (contract §3, "Wiring to the TSX"):
 *   collectedThisTerm ← summary.collected_display        e.g. "₹1.6L"
 *   outstanding       ← summary.outstanding_display      e.g. "₹2022.2L"
 *   collectionRate    ← summary.collection_rate_display  e.g. "0.1%"
 *   defaulters        ← summary.defaulters_count         e.g. 3074
 *
 * Caller: app/fees/dashboard/page.tsx
 */

/** These cards' ids in the page's Customize registry — stored per user, don't rename them. */
type FeesKpiId = 'kpi.collected_this_term' | 'kpi.outstanding' | 'kpi.collection_rate' | 'kpi.defaulters';

export interface FeesDashboardProps {
  collectedThisTerm: string;   // e.g. "₹0.0L" — real field, confirmed
  outstanding: string;          // e.g. "₹0.1L"
  collectionRate: string;       // e.g. "0%"
  defaulters: number;           // e.g. 5

  /**
   * Optional label for the fee-month bucket the collection figure is scoped to
   * (context.month_label). Contract §1.3: `fees_collect.term_id` is the
   * month_id, not the academic term — so "this term" means "this fee month".
   */
  termLabel?: string;

  /** The signed-in user's show/hide choice per card (useDashboardPreferences). Every card shows when omitted. */
  isVisible?: (id: FeesKpiId) => boolean;
}

export function FeesDashboard({
  collectedThisTerm,
  outstanding,
  collectionRate,
  defaulters,
  termLabel,
  isVisible = () => true,
}: FeesDashboardProps) {
  return (
    <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 xl:grid-cols-4">
      {isVisible('kpi.collected_this_term') && (
        <StatCard label="Collected this term" value={collectedThisTerm} hint={termLabel} />
      )}
      {isVisible('kpi.outstanding') && <StatCard label="Outstanding" value={outstanding} />}
      {isVisible('kpi.collection_rate') && <StatCard label="Collection rate" value={collectionRate} />}
      {isVisible('kpi.defaulters') && <StatCard label="Defaulters" value={defaulters} />}

      {/* Real charts (Collection vs target, Head-wise collected vs pending,
          Payment mode mix) confirmed in the live screenshot. The API now
          returns all three payloads (`collection_vs_target`, `headwise`,
          `payment_mode_mix` — contract §3) but no shared chart component
          exists yet. Still the next real gap, not silently skipped. */}
    </div>
  );
}

export default FeesDashboard;
