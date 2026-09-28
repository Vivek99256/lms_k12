'use client';

import Link from 'next/link';
import { ArrowRight, CheckCircle2, Lightbulb } from 'lucide-react';

import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { BandChip } from '@/app/pal/_components/BandMeter';
import type { DetectedMisconception, PracticeNext } from '@/app/pal/data/pal-diagnostic';

/**
 * The one next step, as decided by PracticeOutcomeService.
 *
 * ---------------------------------------------------------------------------
 * WHY IT LIVES HERE AND NOT ON A PAGE
 * ---------------------------------------------------------------------------
 * Moved out of app/pal/adaptive/concept/[conceptId] UNCHANGED when the
 * Feedback stage was added. The learner now reads the synthesis of their
 * practice set before they press the engine's button, so the button moved one
 * screen along with them.
 *
 * Two screens can reach it, which is exactly why the table below cannot live
 * on either of them: the practice result and the Feedback page must never
 * offer different buttons for the same engine decision. Nothing in it is
 * computed - the reason string is the server's own words.
 */

export interface NextStepPlan {
  title: string;
  cta: string;
  href?: string;
  tone: 'go' | 'warn' | 'done';
}

/**
 * The action -> title/button/destination table, byte for byte as it was
 * written against PracticeOutcomeService's action vocabulary.
 *
 * An action with no `href` is one that repeats the practice set, which the
 * caller handles itself - the practice screen reloads in place, the Feedback
 * page navigates back to it.
 */
export function nextStepPlan(
  action: string,
  ids: { conceptId: string; chapterId: string }
): NextStepPlan {
  const esoHref = `/pal/eso?conceptId=${ids.conceptId}`;
  // The lesson, served read-only, so a button labelled "Learn" always opens a
  // lesson. Pointing it at the engine meant the engine chose the screen, and it
  // legitimately chose practice - the button could not keep its promise.
  const learnHref = `/pal/learn/concept/${ids.conceptId}?chapterId=${ids.chapterId}`;

  const plan: Record<string, NextStepPlan> = {
    remediate: { title: 'Clear up a mix-up first', cta: 'Sort this out', href: esoHref, tone: 'warn' },
    reteach: { title: 'Worth going over this again', cta: 'Learn it again', href: learnHref, tone: 'warn' },
    review_content: { title: 'Worth going over this again', cta: 'See the material', href: learnHref, tone: 'warn' },
    practice: { title: 'Ready to start', cta: 'Start practice', tone: 'go' },
    continue_practice: { title: 'Keep going', cta: 'Keep practising', tone: 'go' },
    advance_band: { title: 'Level cleared', cta: 'Move up a level', tone: 'go' },
    mastery_check: { title: 'Ready for the mastery check', cta: 'Check my mastery', href: esoHref, tone: 'done' },
    mastered: { title: 'Concept mastered', cta: 'Back to the plan', href: `/pal/plan/chapter/${ids.chapterId}`, tone: 'done' },
    // Reteach/remediate would otherwise repeat forever once the learner is
    // genuinely stuck (see PracticeOutcomeService::decide()'s bounded-retry
    // comments) - this is the terminal step instead of another lap. It still
    // does not block: the learner can carry on with the rest of the chapter
    // from the plan while their teacher is flagged.
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
            <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Icon aria-hidden className="h-4 w-4" />
              {step.title}
              {next.band && <BandChip band={next.band} />}
            </p>

            {/* The server's own sentence. */}
            <p className="mt-1 text-sm text-slate-700">{next.reason}</p>

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
