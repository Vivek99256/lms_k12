'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Loader2, RefreshCw, ShieldCheck } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import {
  approveRecommendation,
  getCase,
  getSubjectIntelligence,
  rejectRecommendation,
  runAgent,
  type IntelligenceContext,
} from '@/lib/intelligence/client';
import type {
  CaseDetail,
  SubjectIntelligence,
  Severity,
} from '@/lib/intelligence/types';
import { cn } from '@/lib/utils';

import { EvidenceList } from './EvidenceList';
import { ExplanationCard } from './ExplanationCard';
import { OutcomeTimeline } from './OutcomeTimeline';
import { RecommendationCard } from './RecommendationCard';

const SEVERITY_VARIANT: Record<Severity, 'secondary' | 'outline' | 'destructive'> = {
  low: 'secondary',
  moderate: 'outline',
  high: 'destructive',
  critical: 'destructive',
};

/**
 * The AI surface on a student profile.
 *
 * Follows the brief's user-facing structure — insight, evidence, explanation,
 * recommendation, outcome — without exposing any of the machinery behind it. There
 * is no mention of agents, ontologies or workflows here; a teacher sees a finding,
 * why it was made, what is proposed, and what happened.
 *
 * "Run analysis" is a button rather than something that happens on page load. Risk
 * analysis reads a lot of rows, and a profile view should not silently trigger it.
 */
export function AiInsightsPanel({
  studentId,
  studentName,
  className,
}: {
  studentId: number;
  studentName?: string;
  className?: string;
}) {
  const auth = useAuth();

  const [subject, setSubject] = useState<SubjectIntelligence | null>(null);
  const [detail, setDetail] = useState<CaseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [analysing, setAnalysing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const context = useMemo<IntelligenceContext>(() => {
    const token =
      typeof window === 'undefined' ? null : localStorage.getItem('token');

    return {
      token,
      instituteId: auth?.menuContext?.sub_institute_id ?? null,
      academicYear:
        (auth?.academicYears?.[0] as { syear?: string | number } | undefined)?.syear ?? null,
    };
  }, [auth?.menuContext?.sub_institute_id, auth?.academicYears]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await getSubjectIntelligence(context, 'student', studentId);
      setSubject(result);

      const openCase = result.cases.find((record) =>
        ['open', 'analysing', 'awaiting_decision', 'in_progress'].includes(record.status)
      );

      setDetail(openCase ? await getCase(context, openCase.id) : null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Insights could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [context, studentId]);

  useEffect(() => {
    void load();
  }, [load]);

  const analyse = useCallback(async () => {
    setAnalysing(true);
    setError(null);

    try {
      const result = await runAgent(context, 'k12_academic_risk', { subject_id: studentId });

      if (result.status === 'rejected') {
        setError(result.summary);

        return;
      }

      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The analysis could not be run.');
    } finally {
      setAnalysing(false);
    }
  }, [context, studentId, load]);

  const decide = useCallback(
    async (kind: 'approve' | 'reject', id: number, reason?: string) => {
      if (kind === 'approve') {
        await approveRecommendation(context, id, { reason, startWorkflow: true });
      } else {
        await rejectRecommendation(context, id, reason);
      }

      await load();
    },
    [context, load]
  );

  if (loading) {
    return (
      <div className={cn('flex items-center gap-2 p-6 text-sm text-muted-foreground', className)}>
        <Loader2 aria-hidden className="size-4 animate-spin" />
        Loading insights…
      </div>
    );
  }

  const hasFinding = Boolean(detail);

  return (
    <div className={cn('space-y-5', className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">AI insights</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {hasFinding
              ? 'Based on assessment results, attendance and assigned work.'
              : 'No academic risk has been identified for this student.'}
          </p>
        </div>

        <Button variant="outline" size="sm" onClick={analyse} disabled={analysing}>
          {analysing ? (
            <Loader2 aria-hidden className="size-4 animate-spin" />
          ) : (
            <RefreshCw aria-hidden className="size-4" />
          )}
          {analysing ? 'Analysing…' : 'Run analysis'}
        </Button>
      </div>

      {error && (
        <p className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      )}

      {!hasFinding && !error && (
        <div className="rounded-lg border border-dashed border-border p-6 text-center">
          <ShieldCheck aria-hidden className="mx-auto size-6 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">
            Nothing needs attention for {studentName ?? 'this student'} right now.
          </p>
          {subject && subject.signals.length > 0 && (
            <p className="mt-1 text-xs text-muted-foreground">
              {subject.signals.length} historical signal
              {subject.signals.length === 1 ? '' : 's'} on record.
            </p>
          )}
        </div>
      )}

      {detail && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={SEVERITY_VARIANT[detail.case.severity]}>
              {detail.case.severity} risk
            </Badge>
            <span className="font-mono text-xs text-muted-foreground">
              {detail.case.reference}
            </span>
          </div>

          <ExplanationCard explanation={detail.explanation} evidence={detail.evidence} />

          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">Evidence</h3>
            <EvidenceList evidence={detail.evidence} />
          </section>

          {detail.recommendations.length > 0 && (
            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-foreground">Recommendations</h3>
              <p className="text-xs text-muted-foreground">
                Nothing happens until you approve one of these.
              </p>
              <div className="space-y-3">
                {detail.recommendations.map((recommendation) => (
                  <RecommendationCard
                    key={recommendation.id}
                    recommendation={recommendation}
                    onApprove={(id, reason) => decide('approve', id, reason)}
                    onReject={(id, reason) => decide('reject', id, reason)}
                  />
                ))}
              </div>
            </section>
          )}

          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">Outcomes</h3>
            <OutcomeTimeline outcomes={detail.outcomes} />
          </section>
        </>
      )}
    </div>
  );
}
