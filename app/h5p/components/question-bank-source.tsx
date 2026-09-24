'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Info,
  Library,
  ListChecks,
  Loader2,
  Play,
  RotateCcw,
  X,
} from 'lucide-react';

import { QuestionPlayer } from '@/components/h5p/players';
import type { QuestionResult } from '@/components/h5p/players/types';
import type { QuestionBankApiQuestion } from '@/app/course-master/data/chapters';
import { plainText } from '@/lib/h5p/true-false';
import type { H5pTargetKind } from '@/lib/h5p/question-bank-h5p-map';
import { hasH5pContext, type H5pContext } from '../data/h5p';
import {
  fetchBankForType,
  targetLabel,
  type BankSourceResult,
} from '../data/question-bank-source';
import { Input } from '@/components/ui/input';

/**
 * "From the question bank" — the auto-sourced half of every content type page.
 *
 * WHAT IT DOES. Reads the chapter out of `lms_question_master`, keeps the
 * questions THIS content type can ask, and runs them through this type's own
 * player as one continuous quiz — one question on screen, Next once it is
 * answered, Previous to go back, a score at the end. A teacher who has
 * questions in the bank has an activity in every type those questions reach,
 * without authoring anything.
 *
 * WHAT IT DOES NOT DO — and this is the design, not a gap. It does not create
 * an H5P record, and there is no "convert" button to press. The activity is
 * built in the browser at the moment it is opened and thrown away when the
 * quiz closes, so:
 *
 *   - nothing is written, per question or per type;
 *   - the same question appears in every type it maps to, from one row;
 *   - editing the question in the bank changes it everywhere at once, because
 *     there is no copy anywhere to go stale.
 *
 * WHY EACH PAGE STILL HAS ITS AUTHORED LIST. This sits BESIDE the authored
 * activities, not instead of them. The create / edit / publish / export flow
 * and every activity already saved in `h5p_*` are a real product, and a
 * teacher writing an activity by hand is doing something the bank cannot do
 * for them. Auto-sourcing is additive on every page it appears on.
 *
 * WHY COMPATIBILITY IS DECIDED IN `lib/` AND NOT HERE. A page that filtered
 * for itself would be fourteen filters to keep in step with one map. This
 * component names its kind and is handed the rows; `question-bank-h5p-map.ts`
 * decides, once, for all of them.
 *
 * WHY A QUIZ AND NOT A LIST OF ONE-AT-A-TIME PLAYS. The list used to open one
 * question in a player, with a "back to questions" link to open the next one
 * by hand. That made ten questions ten round trips through the list. Now the
 * whole compatible set plays as one sequential run — Play (on a row, or the
 * "Start quiz" button) begins there and steps forward through the rest —
 * ending in a score, the way a learner would sit an assessment.
 */

export interface QuestionBankSourceProps {
  /** The H5P type this page is. Null for a type the bank cannot source. */
  kind: H5pTargetKind | null;
  /** Shown in place of the list when `kind` is null: why not, in plain words. */
  unavailableReason?: string;
  ctx: H5pContext;
  /** "memory game" — used in the counts and the empty state. */
  noun: string;
}

interface QuizSession {
  /** The compatible rows this run steps through, in list order. */
  questions: QuestionBankApiQuestion[];
  index: number;
}

export function QuestionBankSource({ kind, unavailableReason, ctx, noun }: QuestionBankSourceProps) {
  const [result, setResult] = useState<BankSourceResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [showSkipped, setShowSkipped] = useState(false);

  const [session, setSession] = useState<QuizSession | null>(null);
  const [results, setResults] = useState<Record<number, QuestionResult>>({});
  const [finished, setFinished] = useState(false);

  const chapterId = ctx.chapter_id;

  const load = useCallback(
    (signal: AbortSignal) => {
      if (!kind || !hasH5pContext(ctx)) return;

      setLoading(true);
      setError('');

      fetchBankForType(kind, chapterId, signal)
        .then((next) => {
          if (signal.aborted) return;
          setResult(next);
          setSession(null);
          setResults({});
          setFinished(false);
        })
        .catch((err: unknown) => {
          if (signal.aborted) return;
          setError(err instanceof Error ? err.message : 'Failed to read the question bank');
        })
        .finally(() => {
          if (!signal.aborted) setLoading(false);
        });
    },
    [kind, chapterId, ctx]
  );

  useEffect(() => {
    const controller = new AbortController();
    // Deferred out of the effect body, as every other load on this module's
    // list pages is — see `components/content-type-list.tsx`.
    queueMicrotask(() => {
      if (!controller.signal.aborted) load(controller.signal);
    });
    return () => controller.abort();
  }, [load]);

  const filtered = useMemo(() => {
    const rows = result?.compatible ?? [];
    const needle = search.trim().toLowerCase();
    if (needle === '') return rows;

    return rows.filter((row) => plainText(row.question).toLowerCase().includes(needle));
  }, [result, search]);

  // ---------------------------------------------------------------------
  // The sequential quiz
  // ---------------------------------------------------------------------

  function closeQuiz() {
    setSession(null);
    setResults({});
    setFinished(false);
  }

  function startQuiz(questions: QuestionBankApiQuestion[], startAt: number) {
    if (questions.length === 0) return;
    setSession({ questions, index: Math.max(0, startAt) });
    setResults({});
    setFinished(false);
  }

  // Keyed by POSITION in the run, not `result.questionId`. Every player
  // reports a `questionId`, but a couple of them (the ones built on
  // `TextActivityPlayer` -- mark the words, drag the words, fill in the
  // blanks) report the built activity's own id rather than the bank
  // question's, because that is the id their xAPI statements need. Keying on
  // the id a player happens to report would silently fail to match the
  // question actually on screen for those types, leaving Next disabled even
  // though the learner answered -- keying on the index sidesteps that
  // entirely, since this component always knows which question is current.
  const handleResult = useCallback((index: number, result: QuestionResult) => {
    setResults((previous) => ({ ...previous, [index]: result }));
  }, []);

  const goNext = () => {
    if (!session) return;
    if (session.index + 1 >= session.questions.length) {
      setFinished(true);
      return;
    }
    setSession({ ...session, index: session.index + 1 });
  };

  const goPrevious = () => {
    if (!session) return;
    setSession({ ...session, index: Math.max(0, session.index - 1) });
  };

  const retake = () => {
    if (!session) return;
    setResults({});
    setFinished(false);
    setSession({ ...session, index: 0 });
  };

  // -------------------------------------------------------------------------
  // The three states that are not a list
  // -------------------------------------------------------------------------

  if (!kind) {
    return (
      <Panel>
        <div className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
          <div className="text-sm text-slate-700">
            <p className="font-medium text-slate-800">This type is built by hand</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">
              {unavailableReason ??
                'The question bank does not store what this activity needs, so there is nothing to source from it.'}
            </p>
          </div>
        </div>
      </Panel>
    );
  }

  if (!hasH5pContext(ctx)) {
    return (
      <Panel>
        <p className="py-8 text-center text-sm text-slate-500">
          Choose a class, subject and chapter to see the questions this activity can ask.
        </p>
      </Panel>
    );
  }

  if (finished && session) {
    return (
      <Panel>
        <QuizResult
          total={session.questions.length}
          results={results}
          onRetake={retake}
          onBackToQuestions={closeQuiz}
        />
      </Panel>
    );
  }

  if (session) {
    const current = session.questions[session.index];
    const currentAnswered = results[session.index] !== undefined;
    const answeredCount = Object.keys(results).length;
    const total = session.questions.length;
    // The running tally across the WHOLE quiz, not the marks for whichever
    // question is on screen -- a mark-the-words or drag-the-words question can
    // report "1/1" for its own passage, which read as the quiz's score even
    // though there are twelve more questions to go. This is the number a
    // learner mid-quiz actually wants: how many of all N they have right so
    // far, out of all N -- not out of however many they have answered yet.
    const correctSoFar = Object.values(results).filter((entry) => entry.correct === true).length;

    return (
      <Panel>
        <div className="mb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={closeQuiz}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Back to questions
            </button>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                {correctSoFar}/{total} correct
              </span>
              <span className="text-xs text-slate-500">
                Question {session.index + 1} of {total} · played as {targetLabel(kind).toLowerCase()}
              </span>
            </div>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-indigo-600 transition-all duration-300"
              style={{ width: `${((session.index + (currentAnswered ? 1 : 0)) / total) * 100}%` }}
            />
          </div>
        </div>

        {/*
          The question, not an activity id. The player derives everything it
          needs from the row, which is why no record had to be created to get
          here — and `as` is what makes the SAME row render as this type
          rather than as whatever its default target is.
        */}
        <QuestionPlayer
          key={current.id}
          question={current}
          as={kind}
          embedded
          onResult={(outcome) => handleResult(session.index, outcome)}
        />

        {/*
          The quiz's own score, separate from whatever the player above just
          showed for this one question. A mark-the-words or drag-the-words
          passage reports its own "1 / 1" -- correct for that passage, but
          easy to mistake for the quiz's score when it is the most prominent
          number on screen. This is the number that actually answers "how am
          I doing on this quiz": correct answers so far, out of every
          question in the run.
        */}
        {currentAnswered ? (
          <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-indigo-500">Quiz score</p>
              <p className="text-2xl font-bold tabular-nums text-indigo-900">
                {correctSoFar} <span className="text-base font-medium text-indigo-400">/ {total}</span>
              </p>
            </div>
            <p className="text-xs text-indigo-700">
              {correctSoFar} correct out of {total} question{total === 1 ? '' : 's'} so far
            </p>
          </div>
        ) : null}

        <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-200 pt-3">
          <button
            type="button"
            onClick={goPrevious}
            disabled={session.index === 0}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Previous
          </button>

          <span className="text-xs text-slate-500">{answeredCount} of {total} answered</span>

          <button
            type="button"
            onClick={goNext}
            disabled={!currentAnswered}
            title={currentAnswered ? undefined : 'Answer this question to continue'}
            className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
          >
            {session.index + 1 >= total ? 'Finish' : 'Next'}
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </Panel>
    );
  }

  // -------------------------------------------------------------------------
  // The list
  // -------------------------------------------------------------------------

  const skipped = result?.incompatible ?? [];

  return (
    <Panel>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Library className="h-4 w-4 text-indigo-600" />
          <div>
            <p className="text-sm font-semibold text-slate-800">From the question bank</p>
            <p className="text-xs text-slate-500">
              Questions in this chapter that can be asked as a {noun}. Nothing is created — they play
              straight from the bank, as one quiz.
            </p>
          </div>
        </div>

        <div className="relative w-full max-w-xs">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search questions…"
            aria-label="Search question bank questions"
          />
        </div>
      </div>

      {error ? (
        <div className="mb-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {loading ? (
        <p className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Reading the question bank…
        </p>
      ) : filtered.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-500">
          {result && result.total > 0
            ? `None of the ${result.total} questions in this chapter can be asked as a ${noun}.`
            : 'No questions are stored against this chapter yet.'}
        </p>
      ) : (
        <>
          <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2.5">
            <p className="text-xs text-slate-500">
              Run every question below as one quiz — one at a time, with Next moving through all {filtered.length}.
            </p>
            <button
              type="button"
              onClick={() => startQuiz(filtered, 0)}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-700"
            >
              <ListChecks className="h-3.5 w-3.5" />
              Start quiz
            </button>
          </div>

          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
            {filtered.map((row, rowIndex) => (
              <li key={row.id} className="flex items-start justify-between gap-3 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm text-slate-800">{plainText(row.question)}</p>
                  <p className="mt-0.5 font-mono text-[11px] text-slate-400">QB-{row.id}</p>
                </div>
                <button
                  type="button"
                  onClick={() => startQuiz(filtered, rowIndex)}
                  title="Start the quiz from this question"
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  <Play className="h-3.5 w-3.5" />
                  Play
                </button>
              </li>
            ))}
          </ul>

          <p className="mt-3 text-xs text-slate-500">
            {filtered.length} of {result?.total ?? 0} questions in this chapter can be asked as a {noun}.
          </p>
        </>
      )}

      {/*
        The near misses, stated rather than hidden.

        A teacher who tagged forty questions fill-in-the-blank and sees
        twenty-six here will assume the feature is broken. These are the other
        fourteen, each with the part it is missing — which is nearly always
        something to fix in the question rather than in this screen.
      */}
      {skipped.length > 0 && !loading ? (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
          <button
            type="button"
            onClick={() => setShowSkipped((open) => !open)}
            className="flex w-full items-center justify-between gap-2 text-left text-xs font-medium text-amber-900"
          >
            <span className="flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5" />
              {skipped.length} {skipped.length === 1 ? 'question is' : 'questions are'} tagged for this
              activity but cannot be asked yet
            </span>
            {showSkipped ? <X className="h-3.5 w-3.5" /> : <span aria-hidden>Show</span>}
          </button>

          {showSkipped ? (
            <ul className="mt-2 space-y-2">
              {skipped.map(({ question, reason }) => (
                <li key={question.id} className="text-[11px] leading-relaxed text-amber-900">
                  <span className="font-mono text-amber-700">QB-{question.id}</span>{' '}
                  {plainText(question.question).slice(0, 80)}
                  <span className="block text-amber-800">{reason}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </Panel>
  );
}

function QuizResult({
  total,
  results,
  onRetake,
  onBackToQuestions,
}: {
  total: number;
  results: Record<number, QuestionResult>;
  onRetake: () => void;
  onBackToQuestions: () => void;
}) {
  const values = Object.values(results);
  const answeredCount = values.length;
  const correctCount = values.filter((entry) => entry.correct === true).length;
  const scored = values.filter((entry) => entry.score !== null && entry.maxScore !== null);
  const totalScore = scored.reduce((sum, entry) => sum + (entry.score ?? 0), 0);
  const totalMax = scored.reduce((sum, entry) => sum + (entry.maxScore ?? 0), 0);
  const percent = totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : null;

  return (
    <div className="flex flex-col items-center gap-5 py-10 text-center">
      <CheckCircle2 className="h-10 w-10 text-emerald-500" />
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Quiz complete</h2>
        <p className="mt-1 text-sm text-slate-500">
          {answeredCount} of {total} question{total === 1 ? '' : 's'} answered.
        </p>
      </div>

      <div className="flex flex-wrap justify-center gap-3">
        <StatTile label="Correct" value={`${correctCount}/${total}`} />
        {percent !== null ? <StatTile label="Score" value={`${percent}%`} /> : null}
        {totalMax > 0 ? <StatTile label="Marks" value={`${totalScore}/${totalMax}`} /> : null}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onRetake}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Retake
        </button>
        <button
          type="button"
          onClick={onBackToQuestions}
          className="rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
        >
          Back to questions
        </button>
      </div>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-[92px] rounded-xl border border-slate-200 bg-white px-4 py-3">
      <p className="text-lg font-semibold tabular-nums text-slate-900">{value}</p>
      <p className="text-[11px] uppercase tracking-wide text-slate-400">{label}</p>
    </div>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">{children}</section>
  );
}
