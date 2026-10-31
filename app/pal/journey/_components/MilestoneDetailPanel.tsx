'use client';

import React from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowRight, Info, Network, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { stageHref } from '@/app/pal/_components/journey-stages';
import { milestoneStatusStyle, type JourneyMilestone } from '@/app/pal/journey/data/pal-journey';
import { ConceptDiagnosticPanel } from './ConceptDiagnosticPanel';

export interface MilestoneDetailPanelProps {
  milestone: JourneyMilestone;
  chapterId: string;
  /** Hides the "Continue" CTA — the teacher monitor view (a later phase) is read-only by design. */
  readOnly?: boolean;
  /**
   * Extension point for a later phase's Knowledge Graph panel (Milestones 2
   * and 6, where a concept id is in scope). This phase never builds that
   * panel — only leaves the hook for it, so a future phase can wire
   * `fetchKnowledgeMap`/the teacher-scoped equivalent without touching this
   * component again. Omitted or null hides the button entirely rather than
   * rendering one that does nothing.
   */
  onOpenKnowledgeGraph?: ((milestone: JourneyMilestone) => void) | null;
  /** The concept the 12-stage map is currently focused on — forwarded to `ConceptDiagnosticPanel` so it can mark that one row as "Viewing" among the chapter's full concept list. */
  focusConceptId?: string | null;
  /** Set when a learner picks a different concept out of `ConceptDiagnosticPanel`'s drawer — `MountainJourneyView` re-fetches the whole map around it. Omitted hides the picker's click affordance entirely (nothing to call back into). */
  onSelectConcept?: (conceptId: string) => void;
}

const KNOWLEDGE_GRAPH_MILESTONES = new Set(['adaptive', 'mastery']);

/**
 * The selected milestone's real data, and nothing invented — score, levels
 * cleared, misconception, next step, exactly as `pal-journey.ts` reduced it.
 * The "Continue" CTA is built from `stageHref()`, never a hardcoded href, so
 * it can never send a learner past a prerequisite the backend itself has not
 * cleared.
 */
/**
 * The attention-grabbing "this concept is mastered" treatment — the status
 * `Badge` in the header already says "Mastered", this just makes that fact
 * impossible to miss, the same way `ConceptDiagnosticPanel` gives the
 * diagnostic step's status more than a plain badge. No new data: it only
 * renders when `milestone.status === 'mastered'`, the same signal
 * `masteryMilestone()` in `pal-journey.ts` already computed from
 * `fetchChapterMastery`/`fetchConceptResult`.
 */
function MasteryAchievedBanner() {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 p-3.5">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 via-orange-400 to-rose-500 shadow-[0_0_14px_rgba(251,146,60,0.6)]">
        <Trophy aria-hidden className="h-5 w-5 text-white" />
      </span>
      <div>
        <p className="text-sm font-bold text-amber-900">Concept mastered!</p>
        <p className="text-xs text-amber-700">Signed off by the mastery engine — see the note below for the stage it reached.</p>
      </div>
    </div>
  );
}

export function MilestoneDetailPanel({
  milestone,
  chapterId,
  readOnly = false,
  onOpenKnowledgeGraph = null,
  focusConceptId = null,
  onSelectConcept,
}: MilestoneDetailPanelProps) {
  const style = milestoneStatusStyle(milestone.status);
  const href = stageHref(milestone.key, { chapterId, conceptId: milestone.conceptId });
  const canOpenKnowledgeGraph =
    Boolean(onOpenKnowledgeGraph) && Boolean(milestone.conceptId) && KNOWLEDGE_GRAPH_MILESTONES.has(milestone.key);

  return (
    <Card className={cn('border-2', style.border)}>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardDescription>Step {milestone.index} of 12</CardDescription>
          <CardTitle className="text-base">{milestone.label}</CardTitle>
        </div>
        <Badge className={cn(style.bg, style.text, 'border', style.border)}>{style.label}</Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        {milestone.error && (
          <p className="flex items-start gap-1.5 text-sm text-rose-700">
            <AlertTriangle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
            {milestone.error}
          </p>
        )}

        {!milestone.available && !milestone.error && (
          <p className="flex items-start gap-1.5 text-sm text-slate-500">
            <Info aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Not yet available for this chapter.
              {milestone.unavailableReason ? ` ${milestone.unavailableReason}` : ''}
            </span>
          </p>
        )}

        {milestone.available && milestone.unavailableReason && (
          <p className="text-sm text-slate-500">{milestone.unavailableReason}</p>
        )}

        {milestone.key === 'adaptive' && (
          <ConceptDiagnosticPanel chapterId={chapterId} activeConceptId={focusConceptId} onSelectConcept={onSelectConcept} />
        )}

        {milestone.key === 'mastery' && milestone.status === 'mastered' && <MasteryAchievedBanner />}

        {milestone.facts.length > 0 && (
          <ul className="space-y-1 text-sm text-slate-700">
            {milestone.facts.map((fact, index) => (
              <li key={index}>• {fact}</li>
            ))}
          </ul>
        )}

        {milestone.branch && milestone.branch.length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-700">
              Remediation {milestone.branch.length === 1 ? 'attempt' : `attempts (${milestone.branch.length})`}
            </p>
            <ol className="space-y-2">
              {milestone.branch.map((attempt) => (
                <li key={attempt.attemptNumber} className="rounded-md border border-amber-200 bg-white p-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-amber-800">Attempt {attempt.attemptNumber}</span>
                    <span className={attempt.resolved ? 'text-emerald-700' : 'text-rose-700'}>
                      {attempt.resolved ? 'Resolved — back to practice' : 'Open'}
                    </span>
                  </div>
                  <p className="mt-0.5 text-slate-600">
                    {attempt.trigger.action} ({attempt.trigger.ruleFired})
                  </p>
                </li>
              ))}
            </ol>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 pt-2">
          {!readOnly && href && (
            <Link href={href} className={buttonVariants({ size: 'sm' })}>
              Continue
              <ArrowRight aria-hidden className="ml-1.5 h-4 w-4" />
            </Link>
          )}
          {canOpenKnowledgeGraph && (
            <Button size="sm" variant="outline" onClick={() => onOpenKnowledgeGraph?.(milestone)}>
              <Network aria-hidden className="h-4 w-4" />
              Explore concept map
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
