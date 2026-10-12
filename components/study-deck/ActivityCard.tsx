'use client';

import { memo, useCallback } from 'react';
import { CheckCircle2 } from 'lucide-react';

import { NotPlayable, QuestionPlayer } from '@/components/h5p/players';
import type { Question, QuestionResult } from '@/components/h5p/players/types';
import type { H5pTargetKind } from '@/lib/h5p/question-bank-h5p-map';
import { explanationOf, type ResolvedActivity } from '@/lib/study-deck/deck';
import type { ResultInput } from '@/lib/study-deck/progress';

export interface ActivityCardProps {
  resolved: ResolvedActivity;
  /** Where in the deck this activity sits; the player remounts when it changes. */
  activityKey: string;
  done: boolean;
  /** Name of the other concept this question connects to, when it does. */
  connects: string | null;
  onResult: (key: string, result: ResultInput, conceptId: number | null, questionId: number | null) => void;
}

/**
 * The player alone, memoised on exactly what it renders. Marking an activity "Done" re-renders
 * the card around it; without this the player would be rebuilt with it, and a player that
 * re-seeds on a changed prop would send the learner back to its first screen after answering.
 */
const PlayerSlot = memo(function PlayerSlot({
  question,
  as,
  onResult,
}: {
  question: Question;
  as: H5pTargetKind;
  onResult: (result: QuestionResult) => void;
}) {
  return <QuestionPlayer question={question} as={as} embedded onResult={onResult} />;
});

/**
 * One interactive activity on a slide.
 *
 * It does not build any H5P content itself. It hands the question row to the shared
 * `QuestionPlayer` with the target the deck chose; the player shows the question, takes the
 * answer, marks it, and shows the stored explanation. This card only adds the learner-facing
 * frame (what kind of activity it is, whether it is done) and reports the result upward.
 *
 * Nothing is written. `onResult` is the only thing that leaves this component.
 */
function ActivityCardImpl({ resolved, activityKey, done, connects, onResult }: ActivityCardProps) {
  const { activity } = resolved;

  // The stored explanation, shown only AFTER the learner has answered. In the embedded one-question
  // mode the choice player's own verdict says "review the solution" without showing one, and a flashcard
  // check says only right or wrong, so this is where the learner is told why. A written answer already has
  // its own "compare with the model answer" step, so it is not repeated here.
  const explanation = resolved.ok && done && resolved.as !== 'essay' ? explanationOf(resolved.question) : '';

  // A stable handler: some players re-seed themselves when their callback changes identity,
  // which would send the learner back to the first card mid-answer.
  const report = useCallback(
    (result: QuestionResult) => {
      onResult(
        activityKey,
        { correct: result.correct, score: result.score, maxScore: result.maxScore },
        activity.concept_id,
        activity.question_id
      );
    },
    [onResult, activityKey, activity.concept_id, activity.question_id]
  );

  return (
    <section
      aria-label={`${activity.label} activity`}
      className="rounded-2xl border border-indigo-200 bg-white p-4 shadow-sm sm:p-5"
    >
      <header className="mb-3 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-indigo-600 px-2.5 py-0.5 text-xs font-semibold text-white">{activity.label}</span>
        {activity.decision ? (
          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-900">Make a decision</span>
        ) : null}
        {connects ? (
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">Connects to {connects}</span>
        ) : null}
        {done ? (
          <span className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            Done
          </span>
        ) : null}
      </header>

      {resolved.ok ? (
        <PlayerSlot question={resolved.question as unknown as Question} as={resolved.as} onResult={report} />
      ) : (
        <NotPlayable reason={resolved.reason} />
      )}

      {explanation ? (
        <aside aria-label="Explanation" className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950">
          <p className="font-semibold">Why</p>
          <p className="mt-0.5 leading-relaxed">{explanation}</p>
        </aside>
      ) : null}
    </section>
  );
}

export const ActivityCard = memo(ActivityCardImpl);
