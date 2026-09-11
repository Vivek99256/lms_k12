'use client';

import { useEffect, useState } from 'react';
import { GraduationCap, Lock, ShieldCheck } from 'lucide-react';

import { fetchTutorContext, type TutorContext } from '@/app/pal/data/pal-eso';

/**
 * The AI Tutor's context, made visible.
 *
 * Two things are shown, and neither is generated:
 *
 *  1. The misconception ESO has actually flagged for this learner, with the
 *     AUTHORED corrective guidance attached to it. Shown verbatim rather than
 *     paraphrased — the value of a misconception library is that a human wrote
 *     the remedy.
 *  2. What the tutor is currently allowed to do. A learner who has not tried
 *     yet is told, plainly, that they will get questions rather than answers
 *     until they have. That rule exists because Alpha School / TimeBack
 *     disabled chat outright over exactly this ("90% of kids use chatbots to
 *     cheat"); stating it up front is what makes it feel like a rule rather
 *     than the tutor being unhelpful.
 *
 * This panel deliberately contains NO chat. The conversation belongs in the
 * shared ChatbotPanel, and wiring PAL context into that shared surface is an
 * open decision — building a second chat here to avoid the decision is exactly
 * the duplication the PAL tracker keeps finding. What this does is make the
 * grounding and the governance real and visible, so the hand-off is the only
 * thing left to decide.
 *
 * Supporting context, never the task: it fetches independently and renders
 * nothing at all when the concept has no tutor grounding.
 */
export default function AiTutorPanel({
  learnerId,
  conceptId,
  /** Changes whenever the engine advances, so governance re-reads after an attempt. */
  actionKey,
}: {
  learnerId: string;
  conceptId: number;
  actionKey?: string;
}) {
  const [context, setContext] = useState<TutorContext | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    if (!learnerId || !conceptId) return;

    fetchTutorContext(learnerId, conceptId, controller.signal)
      .then(setContext)
      .catch(() => setContext(null));

    return () => controller.abort();
  }, [learnerId, conceptId, actionKey]);

  // No grounding means the tutor has nothing authored to explain from, and
  // saying nothing is better than offering help it cannot give.
  if (!context || context.groundingCount === 0) return null;

  const { governance, misconceptions } = context;
  const socratic = governance.mode === 'socratic_only';

  return (
    <section className="mt-4 rounded-xl border border-violet-200 bg-violet-50/50 p-4">
      <div className="flex items-center gap-2">
        <GraduationCap className="h-4 w-4 text-violet-600" />
        <h2 className="text-sm font-semibold text-violet-950">Your tutor</h2>
      </div>

      {misconceptions.length > 0 && (
        <div className="mt-3 space-y-2">
          {misconceptions.map((m) => (
            <div key={m.id} className="rounded-lg border border-violet-200 bg-white p-3">
              {m.description && <p className="text-sm text-slate-800">{m.description}</p>}
              {m.correctiveAction && (
                <p className="mt-1.5 text-sm text-slate-600">
                  <span className="font-medium text-slate-700">Try this: </span>
                  {m.correctiveAction}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 flex items-start gap-2 text-xs text-violet-800">
        {socratic ? <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
        <p>
          {socratic ? (
            <>
              Your tutor will ask you questions rather than give the answer.
              {governance.attemptsRemaining > 0 && (
                <>
                  {' '}
                  After {governance.attemptsRemaining} more{' '}
                  {governance.attemptsRemaining === 1 ? 'try' : 'tries'} of your own, it can explain the
                  concept directly.
                </>
              )}
            </>
          ) : (
            <>You have tried this yourself, so your tutor can now explain the concept directly.</>
          )}
        </p>
      </div>

      {/* Stated unconditionally, because it is unconditional: no number of
          attempts unlocks an answer to something being marked. */}
      <p className="mt-1.5 pl-5 text-xs text-violet-700/80">
        It will never give you the answer to a question that is being marked.
      </p>
    </section>
  );
}
