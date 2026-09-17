'use client';

/**
 * Verification status resolver for the Fees onboarding journey.
 *
 * The onboarding step "Verify the Fees data" asks the school to reconcile its
 * imported records against its own registers. Nothing in the system records
 * that a human did so — there is no report-run log — so the closest signal the
 * platform actually holds is whether each report *returns rows*: a report with
 * data is one there is something to reconcile and which has demonstrably been
 * populated, a report with none is still outstanding.
 *
 * That is the definition used here, and it is the one the checklist shows:
 *   checked   = the report returned at least one row
 *   unchecked = it returned none, or could not be read
 *
 * Every probe runs the report unfiltered, through the same helpers the report
 * screens themselves use, so a probe can never disagree with what the user sees
 * when they open the report. Probes run in parallel and are only ever triggered
 * when the step's drawer is opened.
 */

import {
  fetchDatewiseSummaryFeesTitleGet,
  fetchDatewiseSummaryReportGet,
  fetchDatewiseSummaryReportIndex,
  fetchFeesCancelReportPost,
  fetchFeesCollectionReportGet,
  fetchFeesDefaulterReportPost,
  fetchFeesStructureReportPost,
  fetchOtherFeesReportGet,
  fetchStudentBreakoffReportGet,
  readArrayRecords,
  type ReportApiPayload,
} from '@/app/fees/_lib/fees-report-utils';
import { readString } from '@/app/fees/_lib/fees-api';

export type FeesVerificationKey =
  | 'feesCollection'
  | 'otherFees'
  | 'datewiseSummary'
  | 'feesStructure'
  | 'feesCancellation'
  | 'feesDefaulter'
  | 'studentBreakOff';

/** One checklist line: what it is, where it lives, and how to prove it has data. */
type ReportDefinition = {
  key: FeesVerificationKey;
  label: string;
  href: string;
  /** Resolves to true when the report has at least one row. */
  probe: () => Promise<boolean>;
};

export type FeesVerificationItem = {
  key: FeesVerificationKey;
  label: string;
  href: string;
  verified: boolean;
  /** Set when the probe could not complete, so "unchecked" can be explained. */
  error: string;
};

export type FeesVerificationStatus = {
  /** Flat map, in the shape the onboarding UI reads. */
  reports: Record<FeesVerificationKey, boolean>;
  items: FeesVerificationItem[];
  completedCount: number;
  pendingCount: number;
  completionPercentage: number;
  /**
   * Where "Open setup screen" should land: the first still-pending report in
   * priority order, or the primary collection report once all are verified.
   */
  nextPendingRoute: string;
  isComplete: boolean;
};

/**
 * The report every verified journey falls back to: where "Open setup screen"
 * lands once nothing is pending, and before the probes have resolved.
 */
export const PRIMARY_VERIFICATION_ROUTE = '/fees/reports/fees-collection';

/** True when an object-of-arrays payload (grouped reports) holds any row. */
function groupsHaveRows(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  return Object.values(value as Record<string, unknown>).some((group) => {
    if (Array.isArray(group)) return group.length > 0;
    return Boolean(group && typeof group === 'object' && Object.keys(group).length > 0);
  });
}

/** True when a payload field holds any row, as either an array or a keyed map. */
function hasRows(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0;
  return groupsHaveRows(value);
}

/**
 * Datewise summary is the one report that cannot be probed directly: it only
 * returns rows for an explicit receipt title and its fee heads, so the same
 * three-step chain the report screen walks is repeated here — index for the
 * receipt titles, fees-title for that title's heads, then the report itself.
 */
async function probeDatewiseSummary(): Promise<boolean> {
  const { payload: index } = await fetchDatewiseSummaryReportIndex<ReportApiPayload>();
  const titles = readArrayRecords(index.receipt_title)
    .map((record) => ({
      id: readString(record.sort_order),
      heads: readString(record.heads),
    }))
    .filter((title) => title.id);

  if (titles.length === 0) return false;

  const [title] = titles;
  const headParams = new URLSearchParams();
  headParams.set('heads', title.heads);

  const { payload: headPayload } = await fetchDatewiseSummaryFeesTitleGet<ReportApiPayload>(headParams);
  const headIds = readArrayRecords(headPayload)
    .map((record) => readString(record.id))
    .filter(Boolean);

  if (headIds.length === 0) return false;

  const params = new URLSearchParams();
  params.set('receipt_title', title.id);
  params.set('search', '1');
  headIds.forEach((head) => params.append('fees_head[]', head));

  const { payload } = await fetchDatewiseSummaryReportGet<ReportApiPayload>(params);
  return hasRows(payload.datewiseData);
}

/**
 * The checklist, in priority order — this array *is* the priority: the first
 * pending entry is where "Open setup screen" sends the user. Collection and
 * other fees come first because the rest of the reports read the records they
 * prove; the derived reports (defaulter, break-off) come last.
 */
const REPORTS: ReportDefinition[] = [
  {
    key: 'feesCollection',
    label: 'Fees collection report',
    href: '/fees/reports/fees-collection',
    probe: async () => {
      const { payload } = await fetchFeesCollectionReportGet<ReportApiPayload>(new URLSearchParams());
      return hasRows(payload.fees_data);
    },
  },
  {
    key: 'otherFees',
    label: 'Other fees report',
    href: '/fees/reports/other-fees',
    probe: async () => {
      const { payload } = await fetchOtherFeesReportGet<ReportApiPayload>(new URLSearchParams());
      return hasRows(payload.other_feesData);
    },
  },
  {
    key: 'datewiseSummary',
    label: 'Datewise summary',
    href: '/fees/reports/datewise-summary',
    probe: probeDatewiseSummary,
  },
  {
    key: 'feesStructure',
    label: 'Fees structure report',
    href: '/fees/reports/fees-structure',
    probe: async () => {
      const { payload } = await fetchFeesStructureReportPost<ReportApiPayload>(new URLSearchParams());
      return hasRows(payload.report_data);
    },
  },
  {
    key: 'feesCancellation',
    label: 'Fees cancellation report',
    href: '/fees/reports/fees-cancel',
    probe: async () => {
      const { payload } = await fetchFeesCancelReportPost<ReportApiPayload>(new URLSearchParams());
      return hasRows(payload.report_data);
    },
  },
  {
    key: 'feesDefaulter',
    label: 'Fees defaulter report',
    href: '/fees/reports/fees-defaulter',
    probe: async () => {
      const { payload } = await fetchFeesDefaulterReportPost<ReportApiPayload>(new URLSearchParams());
      return hasRows(payload.fees_data);
    },
  },
  {
    key: 'studentBreakOff',
    label: 'Student break-off report',
    href: '/fees/reports/student-breakoff',
    probe: async () => {
      const { payload } = await fetchStudentBreakoffReportGet<ReportApiPayload>(new URLSearchParams());
      return hasRows(payload.fees_data);
    },
  },
];

function buildStatus(items: FeesVerificationItem[]): FeesVerificationStatus {
  const completedCount = items.filter((item) => item.verified).length;
  const pending = items.filter((item) => !item.verified);

  return {
    reports: Object.fromEntries(
      items.map((item) => [item.key, item.verified])
    ) as Record<FeesVerificationKey, boolean>,
    items,
    completedCount,
    pendingCount: pending.length,
    // Rounded for display; 7 reports never divide evenly, so 6/7 reads as 86%.
    completionPercentage: items.length === 0
      ? 0
      : Math.round((completedCount / items.length) * 100),
    nextPendingRoute: pending[0]?.href ?? PRIMARY_VERIFICATION_ROUTE,
    isComplete: pending.length === 0 && items.length > 0,
  };
}

/**
 * Run every probe and resolve the checklist against live data.
 *
 * A probe that throws does not fail the whole resolver — that report is simply
 * reported as unverified with its reason, so one unreachable report cannot hide
 * the state of the other six.
 */
export async function getVerificationStatus(): Promise<FeesVerificationStatus> {
  const settled = await Promise.allSettled(REPORTS.map((report) => report.probe()));

  return buildStatus(
    REPORTS.map((report, index) => {
      const result = settled[index];

      return {
        key: report.key,
        label: report.label,
        href: report.href,
        verified: result.status === 'fulfilled' && result.value,
        error: result.status === 'rejected'
          ? (result.reason instanceof Error ? result.reason.message : 'Could not read this report.')
          : '',
      };
    })
  );
}
