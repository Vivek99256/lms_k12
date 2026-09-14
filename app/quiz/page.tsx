'use client';

import Link from 'next/link';

import { buttonVariants } from '@/components/ui/button';
import { ComingSoonPanel } from '@/components/ui/coming-soon';

/**
 * Quizzes landing screen.
 *
 * Rebuilt on the shared `ComingSoonPanel` so it matches every other roadmap
 * surface. The previous version was a bespoke hero with gradients, a frosted
 * panel and three looping animations — all of which the design system rules out
 * (see CLAUDE.md: flat surfaces, no gradients, no glass, no decorative motion).
 *
 * It also claimed "Coming Soon" while linking to a Create quiz page that works.
 * The status now says in progress, which is what is actually true, and the link
 * to the working screen is kept.
 */
export default function QuizPage() {
  return (
    <div className="flex-1 overflow-y-auto p-6 sm:p-8">
      <div className="mx-auto w-full max-w-3xl">
        <ComingSoonPanel
          roadmapId="lms.quizzes"
          points={[
            'Questions that adapt to each student’s pace.',
            'Instant feedback and live performance tracking.',
            'Badges, streaks and leaderboards.',
          ]}
        >
          <Link href="/quiz/create" className={buttonVariants()}>
            Create a quiz
          </Link>
        </ComingSoonPanel>
      </div>
    </div>
  );
}
