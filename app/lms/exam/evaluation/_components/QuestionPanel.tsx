'use client';

// The marks, question by question.
//
// Each question shows two things side by side and never blends them: what the AI
// SUGGESTED (read-only, with its reason and how sure it was) and what the TEACHER
// decides (a mark box that starts empty, and a note). An empty box means "still on
// the suggestion"; it is not pre-filled, so a draft saved without touching a
// question does not turn that suggestion into a teacher mark.

import { useMemo, useState } from 'react';
import { AlertTriangle, Check, CheckCircle2, FileSearch, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ANSWER_STATUS_STYLES } from '@/app/lms/exam/_exam-evaluation/status-styles';
import type { EvaluationAnswer } from '@/app/lms/exam/_exam-evaluation/types';
import {
  formatMarks,
  parseMarkInput,
  questionLabel,
  type FeedbackInputs,
  type MarkInputs,
} from '@/lib/exam-evaluation/review-math';

type Filter = 'all' | 'attention' | 'unreviewed';

type Props = {
  answers: EvaluationAnswer[];
  marks: MarkInputs;
  feedback: FeedbackInputs;
  /** Read-only: the sheet is approved, or its batch is published. */
  locked: boolean;
  /** The question whose page was last asked for. */
  activeQuestion: number | null;
  onMark: (questionNo: number, value: string) => void;
  onFeedback: (questionNo: number, value: string) => void;
  onAccept: (questionNo: number) => void;
  onRequestReset: (questionNo: number) => void;
  onJump: (questionNo: number, page: number) => void;
};

export default function QuestionPanel({
  answers,
  marks,
  feedback,
  locked,
  activeQuestion,
  onMark,
  onFeedback,
  onAccept,
  onRequestReset,
  onJump,
}: Props) {
  const [filter, setFilter] = useState<Filter>('all');

  const counts = useMemo(() => {
    const unreviewed = answers.filter((answer) => (marks[answer.question_no] ?? '').trim() === '');

    return {
      all: answers.length,
      attention: unreviewed.filter((answer) => answer.needs_attention).length,
      unreviewed: unreviewed.length,
    };
  }, [answers, marks]);

  const visible = answers.filter((answer) => {
    const empty = (marks[answer.question_no] ?? '').trim() === '';

    if (filter === 'attention') return answer.needs_attention && empty;
    if (filter === 'unreviewed') return empty;

    return true;
  });

  const tabs: Array<{ id: Filter; label: string; count: number }> = [
    { id: 'all', label: 'All', count: counts.all },
    { id: 'attention', label: 'Needs your mark', count: counts.attention },
    { id: 'unreviewed', label: 'Not yet marked', count: counts.unreviewed },
  ];

  return (
    <section aria-label="Question-wise evaluation" className="flex min-h-0 flex-col">
      <div className="flex flex-wrap gap-1.5 pb-3" role="tablist" aria-label="Filter questions">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={filter === tab.id}
            onClick={() => setFilter(tab.id)}
            className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
              filter === tab.id
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {tab.label} <span className="tabular-nums opacity-80">{tab.count}</span>
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
          {filter === 'attention'
            ? 'Every flagged question has a mark.'
            : filter === 'unreviewed'
              ? 'Every question has a mark.'
              : 'There are no questions on this sheet.'}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {visible.map((answer) => (
            <li key={answer.question_no}>
              <AnswerRow
                answer={answer}
                mark={marks[answer.question_no] ?? ''}
                note={feedback[answer.question_no] ?? ''}
                locked={locked}
                active={activeQuestion === answer.question_no}
                onMark={(value) => onMark(answer.question_no, value)}
                onFeedback={(value) => onFeedback(answer.question_no, value)}
                onAccept={() => onAccept(answer.question_no)}
                onRequestReset={() => onRequestReset(answer.question_no)}
                onJump={() => onJump(answer.question_no, answer.page)}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function AnswerRow({
  answer,
  mark,
  note,
  locked,
  active,
  onMark,
  onFeedback,
  onAccept,
  onRequestReset,
  onJump,
}: {
  answer: EvaluationAnswer;
  mark: string;
  note: string;
  locked: boolean;
  active: boolean;
  onMark: (value: string) => void;
  onFeedback: (value: string) => void;
  onAccept: () => void;
  onRequestReset: () => void;
  onJump: () => void;
}) {
  const label = questionLabel(answer);
  const status = ANSWER_STATUS_STYLES[answer.status] ?? ANSWER_STATUS_STYLES.unattempted;
  const parsed = parseMarkInput(mark, answer.max_marks);
  const hasMark = mark.trim() !== '';
  const waiting = answer.needs_attention && !hasMark;
  const inputId = `mark-${answer.question_no}`;
  const errorId = `mark-error-${answer.question_no}`;
  const noteId = `note-${answer.question_no}`;

  return (
    <article
      aria-label={`Question ${label}`}
      className={`rounded-xl border bg-white p-4 shadow-sm transition ${
        waiting ? 'border-amber-300 bg-amber-50/40' : active ? 'border-primary/60' : 'border-slate-200'
      }`}
    >
      {/* Stacked on a phone, so the pills never squeeze the question into a sliver. */}
      <header className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-slate-900">
            {/* The number the SHEET printed, so it matches what the teacher sees in the scan. */}
            {label}
            {answer.label_from_sheet ? null : (
              <span
                className="ml-2 rounded-full border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-500"
                title={
                  answer.label_inferred
                    ? 'The number printed on the sheet wasn’t read, so this is worked out from the paper’s layout (a run of multiple-choice questions is Q.1(A), (B)…). Check it against the scan.'
                    : 'The question number printed on the sheet wasn’t read, so this is the question’s position in the paper. It may not match the number on the scan.'
                }
              >
                {answer.label_inferred ? 'inferred' : 'paper position'}
              </span>
            )}
            <span className="ml-2 font-normal text-slate-500">
              {answer.is_objective ? 'Objective' : 'Written'} · {formatMarks(answer.max_marks)} mark
              {answer.max_marks === 1 ? '' : 's'}
            </span>
          </h3>
          {answer.question_title ? (
            <p className="mt-1 line-clamp-3 text-sm leading-5 text-slate-600" title={answer.question_title}>
              {answer.question_title}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-row flex-wrap gap-1 sm:flex-col sm:items-end">
          <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${status.className}`}>
            {status.label}
          </span>
          {waiting ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
              <AlertTriangle className="size-3" /> Needs your mark
            </span>
          ) : hasMark && !parsed.error ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
              <CheckCircle2 className="size-3" /> Marked
            </span>
          ) : null}
        </div>
      </header>

      <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-sm">
        <dt className="text-slate-500">Student</dt>
        <dd className="min-w-0 whitespace-pre-line break-words text-slate-800">
          {answer.selected_options.length > 0
            ? answer.selected_options.join(', ')
            : answer.detected_answer || <span className="italic text-slate-400">nothing written</span>}
        </dd>

        <dt className="text-slate-500">Key</dt>
        <dd className="min-w-0 whitespace-pre-line break-words text-slate-800">
          {answer.expected_answer || <span className="italic text-slate-400">no model answer saved</span>}
        </dd>
      </dl>

      {/* ---- What the AI suggested: read-only ------------------------------ */}
      <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
          AI suggestion
          <span className="text-sm normal-case tracking-normal text-slate-800">
            {formatMarks(answer.ai_marks)} / {formatMarks(answer.max_marks)}
          </span>
          <span className="font-normal normal-case tracking-normal text-slate-500">
            {answer.is_objective
              ? 'checked against the key'
              : answer.ai_confidence !== null
                ? `${Math.round(answer.ai_confidence)}% confident`
                : ''}
          </span>
        </p>
        {answer.ai_remark ? <p className="mt-1 text-sm leading-5 text-slate-600">{answer.ai_remark}</p> : null}
      </div>

      {/* ---- What the teacher decides ------------------------------------- */}
      <div className="mt-3 grid gap-3 sm:grid-cols-[auto_minmax(0,1fr)]">
        <div>
          <label htmlFor={inputId} className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Your mark
          </label>
          <div className="mt-1 flex items-center gap-2">
            <Input
              id={inputId}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={mark}
              disabled={locked}
              placeholder={formatMarks(answer.ai_marks)}
              aria-invalid={parsed.error ? true : undefined}
              aria-describedby={parsed.error ? errorId : undefined}
              onChange={(event) => onMark(event.target.value)}
              className="h-9 w-20 text-right font-semibold tabular-nums"
            />
            <span className="text-sm text-slate-400">/ {formatMarks(answer.max_marks)}</span>
          </div>
          {parsed.error ? (
            <p id={errorId} role="alert" className="mt-1 text-xs text-red-700">
              {parsed.error}
            </p>
          ) : null}
        </div>

        <div className="min-w-0">
          <label htmlFor={noteId} className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Your feedback
          </label>
          <Textarea
            id={noteId}
            value={note}
            rows={2}
            maxLength={2000}
            disabled={locked}
            placeholder="Optional. Say why, if you changed the mark."
            onChange={(event) => onFeedback(event.target.value)}
            className="mt-1 min-h-9 resize-y text-sm"
          />
        </div>
      </div>

      <footer className="mt-3 flex flex-wrap items-center gap-2">
        {locked ? null : (
          <>
            <Button type="button" variant="outline" size="sm" onClick={onAccept} disabled={hasMark && !parsed.error && parsed.value === (answer.ai_marks ?? 0)}>
              <Check /> Accept AI mark
            </Button>
            {hasMark ? (
              <Button type="button" variant="ghost" size="sm" onClick={onRequestReset}>
                <RotateCcw /> Reset to AI suggestion
              </Button>
            ) : null}
          </>
        )}
        <Button type="button" variant="ghost" size="sm" onClick={onJump} className="ml-auto">
          <FileSearch /> Page {answer.page} of the scan
        </Button>
      </footer>
    </article>
  );
}
