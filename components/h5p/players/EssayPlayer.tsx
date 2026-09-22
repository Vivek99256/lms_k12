'use client';

import { useEffect, useRef, useState } from 'react';
import { Eye, PenLine, RotateCcw } from 'lucide-react';

import { buildFor, NotPlayable } from './shared';
import type { PlayerProps } from './types';

/**
 * A written answer.
 *
 * THIS IS THE ONE PLAYER WITH NO H5P TYPE BEHIND IT. `H5P.Essay` is not built
 * in this platform: no table, no controller, no authoring screen, no route.
 * Rather than route short-answer questions to a Course Presentation slide --
 * which showed the prompt and hid the model answer in author-only notes, so a
 * learner could neither answer nor check -- this renders the interaction those
 * questions actually want: read the prompt, write an answer, then compare it
 * against what the bank stores.
 *
 * IT MARKS NOTHING, AND SAYS SO. `score` and `correct` are null in the result
 * it reports, because nothing in this platform grades prose and a keyword
 * count is marking by coincidence: an answer that says "changes state" instead
 * of "evaporates" is not wrong. The keywords below are a self-check offered
 * AFTER the learner has committed an answer, and they are labelled as such.
 *
 * WHICH MAKES THE RESULT USEFUL ANYWAY. A caller still learns that the learner
 * engaged, how long they took and what they wrote -- enough for homework to
 * record a submission and for a teacher to mark it.
 */
export function EssayPlayer({ question, onResult }: PlayerProps) {
  const { activity, reason } = buildFor(question, 'essay');

  const [response, setResponse] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);
  // Set on mount, not at construction: a clock read during render is neither
  // pure nor necessarily the moment the learner arrived.
  const startedAt = useRef(0);
  useEffect(() => {
    startedAt.current = Date.now();
  }, []);

  if (!activity || activity.kind !== 'essay') {
    return <NotPlayable reason={reason ?? 'This question cannot be answered.'} />;
  }

  const item = activity.item;
  const words = response.trim() === '' ? 0 : response.trim().split(/\s+/).length;

  const submit = () => {
    setSubmitted(true);
    onResult?.({
      questionId: Number(question.id),
      // Null, not zero: nothing here marked this, and a zero would read as
      // "they got it wrong" to anything aggregating these.
      score: null,
      maxScore: null,
      correct: null,
      durationSeconds: (Date.now() - startedAt.current) / 1000,
      response,
    });
  };

  const retry = () => {
    setResponse('');
    setSubmitted(false);
    setShowAnswer(false);
    startedAt.current = Date.now();
  };

  return (
    <div className="h5p-surface p-5 sm:p-6">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[color:var(--h5p-ink-faint)]">
        <PenLine className="h-3.5 w-3.5" />
        Written answer
        <span className="ml-auto font-mono normal-case tracking-normal text-slate-400">
          {item.marks} {item.marks === 1 ? 'mark' : 'marks'}
        </span>
      </div>

      <div
        className="mt-3 text-sm leading-relaxed text-[color:var(--h5p-ink)]"
        dangerouslySetInnerHTML={{ __html: item.prompt }}
      />

      <label className="mt-4 block">
        <span className="text-xs font-medium text-slate-600">Your answer</span>
        <textarea
          value={response}
          onChange={(event) => setResponse(event.target.value)}
          disabled={submitted}
          rows={6}
          placeholder="Write your answer here."
          className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50 disabled:text-slate-500"
        />
      </label>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] text-slate-500">
          {words} {words === 1 ? 'word' : 'words'}
        </span>

        <div className="flex items-center gap-2">
          {submitted ? (
            <button
              type="button"
              onClick={retry}
              className="h5p-tappable inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Answer again
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={words === 0}
              className="h5p-tappable inline-flex items-center gap-1.5 rounded-xl bg-[#4f46e5] px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-[#4338ca] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
            >
              Submit answer
            </button>
          )}

          {/* The model answer stays shut until the learner has committed one of
              their own: opening it first turns the question into a reading. */}
          {item.model_answer ? (
            <button
              type="button"
              onClick={() => setShowAnswer((open) => !open)}
              disabled={!submitted}
              title={submitted ? undefined : 'Answer first, then compare'}
              className="h5p-tappable inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
            >
              <Eye className="h-3.5 w-3.5" />
              {showAnswer ? 'Hide the model answer' : 'Compare with the model answer'}
            </button>
          ) : null}
        </div>
      </div>

      {submitted ? (
        <p className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
          Answer recorded. This one is marked by your teacher &mdash; nothing here scores written work.
        </p>
      ) : null}

      {showAnswer && item.model_answer ? (
        <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-800">Model answer</p>
          <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-emerald-900">{item.model_answer}</p>

          {item.keywords.length > 0 ? (
            <div className="mt-3 border-t border-emerald-200 pt-2.5">
              <p className="text-[11px] text-emerald-800">
                Points worth checking you covered &mdash; these are for you to compare against, not a mark:
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {item.keywords.map((word) => (
                  <span
                    key={word}
                    className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-emerald-800"
                  >
                    {word}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
