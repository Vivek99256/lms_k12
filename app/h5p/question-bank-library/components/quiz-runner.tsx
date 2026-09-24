'use client';

import { useCallback, useMemo, useState } from 'react';
import { CheckCircle2, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';

import { QuestionPlayer } from '@/components/h5p/players';
import type { QuestionResult } from '@/components/h5p/players/types';
import type { QuestionBankApiQuestion } from '@/app/course-master/data/chapters';
import { caseStudyChildren, playability } from '../../data/question-bank-library';

/**
 * A sequential quiz over a set of question bank rows: one question on screen
 * at a time, a Next button that only lights up once the learner has answered,
 * Previous to go back, and a score screen once the last question is done.
 *
 * WHY THIS EXISTS SEPARATELY FROM `RuntimePlayer`. `RuntimePlayer` renders one
 * row and stops -- that is what the per-row Play button in the table still
 * uses, for a quick spot-check of a single question. This component is the
 * "run the whole list as one continuous quiz" experience: it owns the current
 * index and the accumulated results, and hands each question to the exact
 * same `QuestionPlayer` the rest of the module uses, so a question scores
 * identically here and in the row-by-row preview.
 *
 * NOTHING IS PERSISTED. Like the rest of this module, this is a viewer: the
 * score lives in memory for the length of the run and is not written
 * anywhere. A caller that needs a durable attempt (PAL) has its own flow.
 */

export interface QuizRunnerProps {
  /** The questions to quiz, in the order they should be asked. */
  questions: QuestionBankApiQuestion[];
  /** The whole chapter, so a case study stem in the list can find its sub-parts. */
  chapter: QuestionBankApiQuestion[];
  onClose: () => void;
}

export function QuizRunner({ questions, chapter, onClose }: QuizRunnerProps) {
  // A row that cannot be played (missing options, unsupported form, ...) has
  // no place in a quiz that expects every stop to be answerable -- it is
  // dropped up front, the same way the table disables its Play button.
  const playable = useMemo(
    () => questions.filter((question) => playability(question, chapter).ok),
    [questions, chapter]
  );
  const skipped = questions.length - playable.length;

  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<Record<number, QuestionResult>>({});
  const [finished, setFinished] = useState(false);

  const total = playable.length;
  const current = playable[index];
  // Keyed by POSITION, not `result.questionId`. A couple of players (the ones
  // built on `TextActivityPlayer` -- mark the words, drag the words, fill in
  // the blanks) report the built activity's own id in `questionId` rather
  // than the bank question's, since that is what their xAPI statements need.
  // Keying on that id would never match `current.id` for those types, so Next
  // would stay disabled even though the learner answered. The index always
  // identifies the question actually on screen, regardless of what id the
  // player reports.
  const currentAnswered = results[index] !== undefined;
  const answeredCount = Object.keys(results).length;
  // The running tally across the WHOLE quiz, not the marks for whichever
  // question is on screen -- a question can report its own "1/1" against
  // its own passage, which reads as the quiz's score even though there are
  // more questions to go. This is out of every question in the run, not
  // just the ones answered so far.
  const correctSoFar = Object.values(results).filter((entry) => entry.correct === true).length;

  const handleResult = useCallback((result: QuestionResult) => {
    setResults((previous) => ({ ...previous, [index]: result }));
  }, [index]);

  const goNext = () => {
    if (index + 1 >= total) {
      setFinished(true);
      return;
    }
    setIndex((value) => value + 1);
  };

  const goPrevious = () => setIndex((value) => Math.max(0, value - 1));

  const restart = () => {
    setIndex(0);
    setResults({});
    setFinished(false);
  };

  if (total === 0) {
    return (
      <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
        <p className="text-sm text-slate-600">None of these questions can be played yet.</p>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-slate-200 px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          Close
        </button>
      </div>
    );
  }

  if (finished) {
    return <QuizResult total={total} answeredCount={answeredCount} results={results} onRestart={restart} onClose={onClose} />;
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Question {index + 1} of {total}
          </p>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
              {correctSoFar}/{total} correct
            </span>
            {skipped > 0 ? (
              <span className="text-[11px] text-amber-700">{skipped} question{skipped === 1 ? '' : 's'} skipped — not playable</span>
            ) : null}
          </div>
        </div>
        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-indigo-600 transition-all duration-300"
            style={{ width: `${((index + (currentAnswered ? 1 : 0)) / total) * 100}%` }}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-slate-50">
        <QuestionPlayer
          key={current.id}
          question={current}
          subParts={caseStudyChildren(current, chapter)}
          onResult={handleResult}
          embedded
        />

        {/*
          The quiz's own score, separate from whatever the player above just
          showed for this one question -- some players report their own
          "1 / 1" against their own content, which is easy to mistake for the
          quiz's score when it is the most prominent number on screen. This is
          correct answers so far, out of every question in the run.
        */}
        {currentAnswered ? (
          <div className="mx-4 mb-4 flex items-center justify-between gap-3 rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3">
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
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-slate-200 bg-white px-4 py-3">
        <button
          type="button"
          onClick={goPrevious}
          disabled={index === 0}
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
          {index + 1 >= total ? 'Finish' : 'Next'}
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function QuizResult({
  total,
  answeredCount,
  results,
  onRestart,
  onClose,
}: {
  total: number;
  answeredCount: number;
  results: Record<number, QuestionResult>;
  onRestart: () => void;
  onClose: () => void;
}) {
  const values = Object.values(results);
  const correctCount = values.filter((result) => result.correct === true).length;
  const scored = values.filter((result) => result.score !== null && result.maxScore !== null);
  const totalScore = scored.reduce((sum, result) => sum + (result.score ?? 0), 0);
  const totalMax = scored.reduce((sum, result) => sum + (result.maxScore ?? 0), 0);
  const percent = totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : null;

  return (
    <div className="flex flex-col items-center gap-5 px-6 py-12 text-center">
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
          onClick={onRestart}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Retake
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
        >
          Done
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
