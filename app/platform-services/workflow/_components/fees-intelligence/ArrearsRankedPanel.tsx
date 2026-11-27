'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2 } from 'lucide-react';

import { fetchFeesArrears, fetchFeesGraphSignals, PlatformApiError } from '@/lib/platform/client';
import type { ArrearsRow, FeesGraphSignals } from '@/lib/platform/types';
import { resolveTone, SeverityChip } from '@/components/intelligence/module/primitives';

import { Card, ErrorState, LoadingState, Pager, Pill } from '../../../_components/shell';

/**
 * Largest Fee Arrears, ranked and paged.
 *
 * The "From the Knowledge Graph" footer is a DIFFERENT, NARROWER signal than
 * the ranking above it — it is a read-only cross-link to the Fees
 * Recommendation panel's own graph engine (`fetchFeesGraphSignals`), not a
 * second arrears total. It is labelled and visually separated for exactly
 * that reason: so it never reads as a second number competing with the real
 * ranking.
 *
 * Risk tiers reuse the SAME ₹5,000 / ₹25,000 boundaries the Escalation Rule
 * card already shows (FeesEscalationReportService::classify()) rather than
 * inventing a second, competing threshold scheme for "risk" — an account
 * above ₹25,000 is already the amount that would require Trustee sign-off
 * if a concession were requested against it, so calling it "high risk" here
 * is the same rule, not a new one.
 */

function inr(amount: number): string {
  return '₹' + Math.round(amount).toLocaleString('en-IN');
}

type RiskTier = 'high' | 'medium' | 'low';

function riskTier(outstanding: number): RiskTier {
  if (outstanding > 25000) return 'high';
  if (outstanding > 5000) return 'medium';
  return 'low';
}

const RISK_TONE: Record<RiskTier, 'red' | 'amber' | 'green'> = { high: 'red', medium: 'amber', low: 'green' };
const RISK_LABEL: Record<RiskTier, string> = { high: 'High risk', medium: 'Medium risk', low: 'Low risk' };
const RISK_ICON: Record<RiskTier, typeof AlertTriangle> = { high: AlertTriangle, medium: AlertCircle, low: CheckCircle2 };

/** Icon + colour, not colour alone — a red/amber/green distinction that relies only on hue is invisible to colour-blind readers. */
function RiskPill({ tier }: { tier: RiskTier }) {
  const Icon = RISK_ICON[tier];
  return (
    <span className="animate-in zoom-in-75 fade-in-0 [--tw-animation-duration:250ms] inline-flex">
      <Pill tone={RISK_TONE[tier]}>
        <Icon size={11} className="shrink-0" />
        {RISK_LABEL[tier]}
      </Pill>
    </span>
  );
}

export interface ArrearsRankedPanelProps {
  chainActiveConcession: boolean;
  refreshToken: number;
  onRequestConcession: (studentId: number, studentName: string) => void;
  onViewFamily: (anchorStudentId: number) => void;
}

export function ArrearsRankedPanel({ chainActiveConcession, refreshToken, onRequestConcession, onViewFamily }: ArrearsRankedPanelProps) {
  const perPage = 20;
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<ArrearsRow[]>([]);
  const [rankingTotal, setRankingTotal] = useState(0);
  const [rankingBasis, setRankingBasis] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [signals, setSignals] = useState<FeesGraphSignals | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchFeesArrears({ page, per_page: perPage })
      .then((result) => {
        setRows(result.rows);
        setRankingTotal(result.ranking_total);
        setRankingBasis(result.ranking_basis);
      })
      .catch((cause: unknown) => {
        setError(cause instanceof PlatformApiError ? cause.message : "Couldn't load the arrears ranking. Try again.");
      })
      .finally(() => setLoading(false));
  }, [page, refreshToken]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    fetchFeesGraphSignals()
      .then(setSignals)
      .catch(() => setSignals({ available: false, reason: 'Graph signals could not be loaded.' }));
  }, [refreshToken]);

  return (
    <div className="space-y-3">
      {rankingBasis && <p className="text-xs text-slate-500">{rankingBasis}</p>}

      {loading ? (
        <LoadingState label="Loading the arrears ranking" />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : rows.length === 0 ? (
        <Card className="px-4 py-8 text-center text-sm text-slate-600">No students on the arrears ranking.</Card>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">#</th>
                <th className="px-3 py-2">Student</th>
                <th className="px-3 py-2">Standard</th>
                <th className="px-3 py-2 text-right">Outstanding</th>
                <th className="px-3 py-2">Risk</th>
                <th className="px-3 py-2">Family</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr
                  key={row.student_id}
                  className="animate-in fade-in-0 [--tw-animation-duration:250ms] border-t border-slate-100 transition-colors hover:bg-slate-50/80"
                  style={{ animationDelay: `${Math.min(index * 25, 250)}ms`, animationFillMode: 'backwards' }}
                >
                  <td className="px-3 py-2 text-slate-500">{row.rank}</td>
                  <td className="px-3 py-2">
                    <p className="font-medium text-slate-900">{row.student_name ?? `Student #${row.student_id}`}</p>
                    <p className="text-xs text-slate-500">{row.enrollment_no}</p>
                  </td>
                  <td className="px-3 py-2">{row.standard_name ?? '—'}</td>
                  <td className="px-3 py-2 text-right font-medium">
                    {row.checked && row.outstanding !== null ? inr(row.outstanding) : <span className="text-slate-400">Not checked</span>}
                  </td>
                  <td className="px-3 py-2">
                    {row.checked && row.outstanding !== null ? (
                      <RiskPill tier={riskTier(row.outstanding)} />
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {row.family ? (
                      <button
                        type="button"
                        onClick={() => onViewFamily(row.family!.anchor_student_id)}
                        className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
                      >
                        {row.family.size} in family
                      </button>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      disabled={!chainActiveConcession}
                      title={chainActiveConcession ? undefined : 'Activate a Fee concession chain in Approval Workflows first'}
                      onClick={() => onRequestConcession(row.student_id, row.student_name ?? `Student #${row.student_id}`)}
                      className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Request concession
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && !error && rows.length > 0 && <Pager page={page} perPage={perPage} total={rankingTotal} onPage={setPage} />}

      <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">From the Knowledge Graph</p>
        {signals === null ? (
          <p className="text-xs text-slate-500">Loading…</p>
        ) : !signals.available ? (
          <p className="text-xs text-slate-500">{signals.reason}</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {Object.entries(signals.cards).map(([key, card]) => (
              <span key={key} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs">
                <SeverityChip tone={resolveTone(card.severity)}>{card.severity}</SeverityChip>
                <span className="font-medium text-slate-700">{card.title}</span>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
