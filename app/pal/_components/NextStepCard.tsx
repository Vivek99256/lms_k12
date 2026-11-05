'use client';

import Link from 'next/link';
import { AlertTriangle, ArrowRight, CheckCircle2, Compass, GitFork, Lightbulb } from 'lucide-react';

import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { BandChip } from '@/app/pal/_components/BandMeter';
import type { DetectedMisconception, PracticeNext } from '@/app/pal/data/pal-diagnostic';

/**
 * The one next step, as decided by PracticeOutcomeService or CoherenceRecommender.
 */

export interface NextStepPlan {
  title: string;
  cta: string;
  href?: string;
  tone: 'go' | 'warn' | 'done';
}

/**
 * The action -> title/button/destination table, byte for byte as it was
 * written against PracticeOutcomeService's and CoherenceRecommender's action vocabulary.
 */
export function nextStepPlan(
  action: string,
  ids: { conceptId: string; chapterId: string }
): NextStepPlan {
  const esoHref = `/pal/eso?conceptId=${ids.conceptId}`;
  const learnHref = `/pal/learn/concept/${ids.conceptId}?chapterId=${ids.chapterId}`;

  const plan: Record<string, NextStepPlan> = {
    unblock: { title: 'Prerequisite Blocker Detected', cta: 'Remediate Prerequisite', href: esoHref, tone: 'warn' },
    consolidate: { title: 'Nearly at Mastery Gate', cta: 'Consolidate Concept', href: learnHref, tone: 'go' },
    advance: { title: 'Ready to Move Forward', cta: 'Start Next Concept', href: learnHref, tone: 'go' },
    remediate: { title: 'Clear up a mix-up first', cta: 'Sort this out', href: esoHref, tone: 'warn' },
    reteach: { title: 'Worth going over this again', cta: 'Learn it again', href: learnHref, tone: 'warn' },
    review_content: { title: 'Worth going over this again', cta: 'See the material', href: learnHref, tone: 'warn' },
    practice: { title: 'Ready to start', cta: 'Start practice', tone: 'go' },
    continue_practice: { title: 'Keep going', cta: 'Keep practising', tone: 'go' },
    advance_band: { title: 'Level cleared', cta: 'Move up a level', tone: 'go' },
    mastery_check: { title: 'Ready for the mastery check', cta: 'Check my mastery', href: esoHref, tone: 'done' },
    mastered: { title: 'Concept mastered', cta: 'Back to the plan', href: `/pal/plan/chapter/${ids.chapterId}`, tone: 'done' },
    escalate: {
      title: 'Time to bring in your teacher',
      cta: 'See what happens next',
      href: `/pal/intervention/concept/${ids.conceptId}`,
      tone: 'warn',
    },
  };

  return plan[action] ?? { title: 'What is next', cta: 'Continue', tone: 'go' };
}

export function NextStepCard({
  next,
  misconception,
  conceptId,
  chapterId,
  onPractiseAgain,
}: {
  next: PracticeNext;
  misconception: DetectedMisconception | null;
  conceptId: string;
  chapterId: string;
  onPractiseAgain: () => void;
}) {
  const step = nextStepPlan(next.action, { conceptId, chapterId });

  const tone =
    step.tone === 'warn'
      ? 'border-amber-200 bg-amber-50'
      : step.tone === 'done'
        ? 'border-emerald-200 bg-emerald-50'
        : 'border-indigo-200 bg-indigo-50';

  const Icon = step.tone === 'warn' ? Lightbulb : step.tone === 'done' ? CheckCircle2 : ArrowRight;

  return (
    <Card className={cn('mt-4', tone)} data-pal-next-action={next.action}>
      <CardContent className="pt-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Icon aria-hidden className="h-4 w-4" />
              <p className="text-sm font-semibold text-slate-900">{step.title}</p>
              {next.band && <BandChip band={next.band} />}
              {next.graphAware && (
                <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-[10px] text-emerald-800">
                  Prerequisite Graph Verified
                </Badge>
              )}
            </div>

            {/* The server's own sentence. */}
            <p className="mt-1 text-sm text-slate-700">{next.reason}</p>

            {/* Root Prerequisite Blocker Visual Walk */}
            {next.roots && next.roots.length > 0 && (
              <div className="mt-2.5 rounded-lg border border-amber-300/80 bg-white/80 p-2.5 text-xs text-amber-950 shadow-sm">
                <div className="flex items-center gap-1.5 font-semibold text-amber-900">
                  <GitFork className="h-3.5 w-3.5 text-amber-700" />
                  Prerequisite Path Blocker:
                </div>
                <div className="mt-1 space-y-1">
                  {next.roots.map((root) => (
                    <div key={root.id} className="flex items-center justify-between">
                      <span className="font-medium text-slate-800">
                        {root.name} (Mastery: {Math.round(root.mastery * 100)}% vs Gate: {Math.round(root.gate * 100)}%)
                      </span>
                      <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                        {root.depth} step(s) back
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {misconception && (
              <p className="mt-2 rounded-lg border border-white/60 bg-white/70 px-3 py-2 text-xs text-slate-700">
                <span className="font-medium">What tripped you up: </span>
                {misconception.description || misconception.correctiveAction}
              </p>
            )}

            {!next.eso && (next.action === 'review_content' || next.action === 'mastered') && (
              <p className="mt-2 text-xs text-slate-500">
                Guided learning is not set up for this concept yet, so this step is shown from your plan instead.
              </p>
            )}
          </div>

          <div className="shrink-0">
            {step.href ? (
              <Link href={step.href} className={buttonVariants()}>
                {step.cta}
                <ArrowRight aria-hidden className="ml-1.5 h-4 w-4" />
              </Link>
            ) : (
              <Button onClick={onPractiseAgain}>
                {step.cta}
                <ArrowRight aria-hidden className="ml-1.5 h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
