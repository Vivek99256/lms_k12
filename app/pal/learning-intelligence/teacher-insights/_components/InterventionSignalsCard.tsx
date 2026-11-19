'use client';

/**
 * Surfaces App\Domain\PAL\CoherenceRisk\CoherenceRiskAgent — a fully governed
 * agent (hypothesis, evidence, explanation, draft recommendation, never
 * auto-executes) that finds students whose weak concepts share root-blocker
 * concepts spanning 2+ chapters via CoherenceMapRepository::rootBlockers()
 * (Neo4j). This is its first frontend caller anywhere in this repo.
 *
 * View-only by design: the shared ai_recommendations approve/reject
 * endpoints are administrator-only (AdministratorCheck), not teacher-scoped,
 * so this card shows recommendation.status as a label rather than exposing
 * an approve/dismiss control that would need a permission check this agent
 * framework doesn't grant to teachers today.
 *
 * Scoping is load-bearing, not cosmetic: CoherenceRiskAgent has no
 * standard_id/division_id scoping of its own (those fields are accepted by
 * the generic AgentController but ignored by this agent) — the only way to
 * limit a run to "this teacher's current class" is passing explicit
 * student_ids drawn from the already-permission-scoped roster. Never call
 * runAgent() here without student_ids: omitting it sweeps every student in
 * the tenant.
 *
 * Response shape note: the shared `AgentCaseFinding` type in
 * lib/intelligence/client.ts was modeled on a different agent
 * (k12_academic_risk) and does not match what CoherenceRiskAgent actually
 * returns (verified by reading CoherenceRiskAgent.php/DetectedSignal.php
 * directly) — AgentRunner passes each agent's raw return value straight
 * through as `result`, unnormalized. This file defines its own
 * CoherenceRiskCase type and reads fields defensively instead of trusting
 * that shared type.
 */

import { useEffect, useState } from 'react';
import { AlertTriangle, Loader2, ShieldAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { buildSessionContext } from '@/lib/erp-client';
import { runAgent, type IntelligenceContext } from '@/lib/intelligence/client';
import SectionCard from '../../_components/SectionCard';
import type { RosterRow } from '../../data/teacher-insights';

const SEVERITY_META: Record<string, { label: string; className: string }> = {
  critical: { label: 'Critical', className: 'border-rose-300 bg-rose-50 text-rose-700' },
  high: { label: 'High', className: 'border-amber-300 bg-amber-50 text-amber-700' },
  moderate: { label: 'Moderate', className: 'border-indigo-300 bg-indigo-50 text-indigo-700' },
};

/** Locally-scoped, not the shared (and shape-mismatched, for this agent) AgentCaseFinding type. */
interface CoherenceRiskCase {
  case_id: number;
  student_id: number;
  student_name: string;
  placement: { standard_name: string | null; division_name: string | null } | null;
  severity: string;
  signal: {
    components?: {
      distinct_chapters?: number;
      root_blocker_count?: number;
    };
  };
  explanation: {
    narrative: string;
    governance_passed: boolean;
    reason_refused: string | null;
  };
  recommendation: {
    id: number;
    status: string;
    requires_approval: boolean;
    title: string;
    governance_passed: boolean;
    reason_refused: string | null;
  } | null;
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function toCases(value: unknown): CoherenceRiskCase[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((row): CoherenceRiskCase | null => {
      const r = toRecord(row);
      if (typeof r.case_id !== 'number' || typeof r.student_id !== 'number') return null;
      const explanation = toRecord(r.explanation);
      const recommendation = r.recommendation ? toRecord(r.recommendation) : null;
      return {
        case_id: r.case_id,
        student_id: r.student_id,
        student_name: typeof r.student_name === 'string' ? r.student_name : `Student #${r.student_id}`,
        placement: (r.placement as CoherenceRiskCase['placement']) ?? null,
        severity: typeof r.severity === 'string' ? r.severity : 'moderate',
        signal: toRecord(r.signal) as CoherenceRiskCase['signal'],
        explanation: {
          narrative: typeof explanation.narrative === 'string' ? explanation.narrative : '',
          governance_passed: Boolean(explanation.governance_passed),
          reason_refused: typeof explanation.reason_refused === 'string' ? explanation.reason_refused : null,
        },
        recommendation: recommendation
          ? {
              id: Number(recommendation.id ?? 0),
              status: typeof recommendation.status === 'string' ? recommendation.status : 'draft',
              requires_approval: Boolean(recommendation.requires_approval),
              governance_passed: Boolean(recommendation.governance_passed),
              reason_refused: typeof recommendation.reason_refused === 'string' ? recommendation.reason_refused : null,
              title: typeof recommendation.title === 'string' ? recommendation.title : '',
            }
          : null,
      };
    })
    .filter((c): c is CoherenceRiskCase => c !== null);
}

export default function InterventionSignalsCard({
  roster,
  onSelectStudent,
}: {
  roster: RosterRow[];
  onSelectStudent: (studentId: number) => void;
}) {
  const [cases, setCases] = useState<CoherenceRiskCase[]>([]);
  const [emptyMessage, setEmptyMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const studentIds = roster.map((row) => row.studentId);
    if (studentIds.length === 0) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setFailed(false);

    const context: IntelligenceContext = (() => {
      const session = buildSessionContext();
      return {
        token: session.token || null,
        baseUrl: session.baseUrl || null,
        instituteId: session.subInstituteId || null,
        academicYear: session.syear || null,
        termId: session.termId || null,
      };
    })();

    runAgent(context, 'pal_coherence_risk', { student_ids: studentIds, limit: studentIds.length })
      .then((run) => {
        if (cancelled) return;
        const result = toRecord(run.result);
        const parsedCases = toCases(result.cases);
        setCases(parsedCases);
        setEmptyMessage(parsedCases.length === 0 && typeof result.message === 'string' ? result.message : null);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // roster is replaced wholesale on every class-scope change (never mutated
    // in place), so comparing its identity here is sufficient.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roster]);

  if (failed) return null;

  if (loading) {
    return (
      <SectionCard title="Intervention signals" icon={ShieldAlert} accent="danger">
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Checking for compounding gaps…
        </div>
      </SectionCard>
    );
  }

  return (
    <SectionCard
      title="Intervention signals"
      icon={ShieldAlert}
      accent="danger"
      action={cases.length > 0 ? <Badge className="bg-rose-100 text-rose-800">{cases.length} flagged</Badge> : undefined}
    >
      {cases.length === 0 ? (
        <p className="text-sm text-slate-500">
          {emptyMessage ?? 'No compounding root-blocker concerns detected for this class.'}
        </p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {cases.map((c) => {
            const meta = SEVERITY_META[c.severity] ?? SEVERITY_META.moderate;
            const chapters = c.signal.components?.distinct_chapters;
            const blockers = c.signal.components?.root_blocker_count;
            return (
              <li key={c.case_id} className="space-y-1.5 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
                    <AlertTriangle className="h-3.5 w-3.5 text-rose-500" />
                    {c.student_name}
                    {c.placement?.standard_name ? (
                      <span className="text-xs font-normal text-slate-400">
                        {c.placement.standard_name}
                        {c.placement.division_name ? ` · ${c.placement.division_name}` : ''}
                      </span>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={meta.className}>
                      {meta.label}
                      {blockers != null && chapters != null ? ` · ${blockers} blocker(s) across ${chapters} chapters` : ''}
                    </Badge>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-slate-500 hover:text-slate-900"
                      onClick={() => onSelectStudent(c.student_id)}
                    >
                      View
                    </Button>
                  </div>
                </div>
                {c.explanation.narrative ? (
                  <p className="text-xs text-slate-600">{c.explanation.narrative}</p>
                ) : null}
                <p className="text-[11px] font-medium text-slate-400">
                  {c.recommendation
                    ? c.recommendation.governance_passed
                      ? `Pending administrator review — ${c.recommendation.title}`
                      : `Drafted, not yet reviewable — ${c.recommendation.reason_refused ?? 'pending further governance checks'}`
                    : c.explanation.reason_refused ?? 'No recommendation drafted yet.'}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </SectionCard>
  );
}
