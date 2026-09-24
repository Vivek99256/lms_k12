'use client';

import { AlertTriangle } from 'lucide-react';

import { mapQuestionToPlayerPayload, type RuntimeActivity } from '@/lib/h5p/question-bank-runtime';
import type { BankQuestion } from '@/lib/h5p/question-bank-h5p-map';
import type { Question, QuestionScope } from './types';

// Every player under `components/h5p/players/` renders through the
// `h5p-*` classes defined here, but the stylesheet is only ever imported by
// `app/h5p/layout.tsx` -- a boundary that exists for the standalone
// `/h5p/...` routes and does not extend to a caller outside that segment.
// PAL, homework, and the question bank quiz embed these same players
// directly (that is the whole point of `QuestionPlayer`), so without this
// import they render with none of the option/stage styling: buttons fall
// back to their native inline layout and a set of answer options collapses
// into one run-on paragraph instead of a stacked list. Every player file
// imports this module, so importing the stylesheet once here -- rather than
// per player, which is one forgotten line away from the same bug -- covers
// every embedding surface as well as the standalone routes (Next.js dedupes
// the already-loaded stylesheet there).
import '@/app/h5p/h5p.css';

/**
 * What every shared player does before it renders: turn the question into an
 * activity, or say why it cannot.
 *
 * The transform is the one in `lib/h5p/question-bank-runtime.ts`, which is
 * pure and unit-tested and produces the exact row shape the underlying H5P
 * player already consumes. Nothing is fetched and nothing is stored.
 */

/** The curriculum keys, read off the question itself. */
export function scopeOfQuestion(question: Question): QuestionScope {
  const read = (value: unknown): number | null => {
    const number = Number(value ?? NaN);
    return Number.isFinite(number) && number > 0 ? number : null;
  };

  return {
    standard_id: read(question.standard_id),
    subject_id: read(question.subject_id),
    chapter_id: read(question.chapter_id),
  };
}

export interface BuildOutcome {
  activity: RuntimeActivity | null;
  reason: string | null;
}

/**
 * Build the activity, and check it is the kind this player renders.
 *
 * A player asked for a question it does not serve is a routing mistake, not a
 * data problem, so it says which player the question actually needs rather
 * than rendering something misleading.
 */
export function buildFor(
  question: Question,
  expected: RuntimeActivity['kind'] | RuntimeActivity['kind'][],
  children: Question[] = []
): BuildOutcome {
  const wanted = Array.isArray(expected) ? expected : [expected];

  const result = mapQuestionToPlayerPayload(
    question as BankQuestion,
    scopeOfQuestion(question),
    undefined,
    children as BankQuestion[],
    // A player that serves exactly ONE type asks for that type by name, rather
    // than building the question's default and then checking what it got.
    //
    // That difference is what lets a single question appear in several content
    // types. A fill-in-the-blank row's default is Blanks, so the old code path
    // could only ever hand it to the Blanks player; asking for `drag_text`
    // builds the same passage and the same answer key as a Drag-the-words
    // activity instead. Nothing is copied and nothing is stored to say so.
    wanted.length === 1 ? wanted[0] : undefined
  );

  if (!result.ok || !result.activity) {
    return { activity: null, reason: result.reason ?? 'This question cannot be played.' };
  }

  if (!wanted.includes(result.activity.kind)) {
    return {
      activity: null,
      reason: `This question renders as ${result.activity.kind.replace(/_/g, ' ')}, not ${wanted
        .join(' or ')
        .replace(/_/g, ' ')}. Use QuestionPlayer, which picks the right one.`,
    };
  }

  return { activity: result.activity, reason: null };
}

/** Shown in place of an activity, whenever one cannot be built. */
export function NotPlayable({ reason }: { reason: string }) {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
      <p className="flex items-center gap-1.5 font-medium">
        <AlertTriangle className="h-4 w-4" />
        This question cannot be played yet
      </p>
      <p className="mt-1 text-xs leading-relaxed text-amber-800">{reason}</p>
    </div>
  );
}
