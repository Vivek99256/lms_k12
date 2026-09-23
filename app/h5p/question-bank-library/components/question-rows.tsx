'use client';

import { useEffect } from 'react';
import { ChevronLeft, ChevronRight, ExternalLink, ListChecks, Loader2, Play, Send, X } from 'lucide-react';

import { plainText } from '@/lib/h5p/true-false';
import { mappingForQuestion } from '@/lib/h5p/question-bank-h5p-map';
import type { QuestionBankApiQuestion } from '@/app/course-master/data/chapters';
import { playability } from '../../data/question-bank-library';

/**
 * One row per question, with the two actions this screen has: play it here, or
 * play it on its own page.
 *
 * WHAT IS NOT HERE ANY MORE. Convert, Generate activity, Export package and
 * Edit have all gone. Each of them existed only because a question had to
 * become a saved H5P draft before it could be looked at; now it does not, and
 * a row that offers "convert" would be offering a step that no longer has a
 * purpose. Editing an activity is likewise gone -- there is no activity to
 * edit until somebody chooses to author one, which is what the H5P type's own
 * Create screen is for.
 *
 * ASSIGN STAYS, because it never depended on conversion: it hands the QUESTION
 * ids to the homework module, which references them directly.
 */

export type RowAction = 'preview' | 'open' | 'assign';

export interface QuestionRowsProps {
  questions: QuestionBankApiQuestion[];
  /** The whole chapter, so a case study stem can find its sub-parts. */
  chapter: QuestionBankApiQuestion[];
  loading: boolean;
  selected: Set<number>;
  onToggle: (id: number) => void;
  onToggleAll: () => void;
  onAction: (action: RowAction, question: QuestionBankApiQuestion) => void;
  /** Run every playable question on this page as one continuous quiz. Omit to hide the button. */
  onStartQuiz?: () => void;

  page: number;
  perPage: number;
  total: number;
  serverPaged: boolean;
  onPageChange: (page: number) => void;
  onPerPageChange: (perPage: number) => void;
}

function ActionButton({
  label,
  icon: Icon,
  disabled,
  title,
  onClick,
}: {
  label: string;
  icon: typeof Play;
  disabled?: boolean;
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={title}
      className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-800 disabled:cursor-not-allowed disabled:border-slate-100 disabled:text-slate-300"
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}

export function QuestionRows(props: QuestionRowsProps) {
  const { questions, selected } = props;
  const lastPage = Math.max(1, Math.ceil(props.total / props.perPage));
  const allSelected = questions.length > 0 && questions.every((question) => selected.has(Number(question.id)));

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {props.onStartQuiz ? (
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/60 px-3 py-2.5">
          <p className="text-xs text-slate-500">
            Run this list as one quiz — one question at a time, with Next moving through all {questions.length}.
          </p>
          <button
            type="button"
            onClick={props.onStartQuiz}
            disabled={questions.length === 0}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
          >
            <ListChecks className="h-3.5 w-3.5" />
            Start quiz
          </button>
        </div>
      ) : null}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
            <tr>
              <th className="w-10 px-3 py-2.5">
                <input
                  type="checkbox"
                  aria-label="Select every question on this page"
                  checked={allSelected}
                  onChange={props.onToggleAll}
                  className="h-3.5 w-3.5 accent-indigo-600"
                />
              </th>
              <th className="px-3 py-2.5 font-semibold">Question</th>
              <th className="px-3 py-2.5 font-semibold">Form</th>
              <th className="px-3 py-2.5 font-semibold">Plays as</th>
              <th className="px-3 py-2.5 font-semibold">Difficulty</th>
              <th className="px-3 py-2.5 text-right font-semibold">Marks</th>
              <th className="px-3 py-2.5 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {props.loading ? (
              <tr>
                <td colSpan={7} className="px-3 py-14 text-center text-sm text-slate-500">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin text-indigo-500" />
                  Loading questions&hellip;
                </td>
              </tr>
            ) : questions.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-14 text-center text-sm text-slate-500">
                  No questions match these filters.
                </td>
              </tr>
            ) : (
              questions.map((question) => {
                const id = Number(question.id);
                const mapping = mappingForQuestion(question);
                const verdict = playability(question, props.chapter);

                return (
                  <tr key={id} className="align-top hover:bg-slate-50/60">
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        aria-label={`Select question ${id}`}
                        checked={selected.has(id)}
                        onChange={() => props.onToggle(id)}
                        className="mt-1 h-3.5 w-3.5 accent-indigo-600"
                      />
                    </td>
                    <td className="max-w-[420px] px-3 py-3">
                      <p className="line-clamp-2 text-slate-800">{plainText(question.question) || '(No question text)'}</p>
                      <p className="mt-1 font-mono text-[11px] text-slate-400">QB-{id}</p>
                      {verdict.ok ? null : (
                        <p className="mt-1 text-[11px] text-amber-700">{verdict.reason}</p>
                      )}
                    </td>
                    <td className="px-3 py-3 text-slate-600">{mapping?.label ?? question.question_type_raw ?? '—'}</td>
                    <td className="px-3 py-3">
                      <span className="font-mono text-[11px] text-slate-600">{mapping?.target?.library ?? '—'}</span>
                      {mapping && !mapping.supported ? (
                        <span
                          className="ml-1.5 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700"
                          title={mapping.note}
                        >
                          substitute
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 text-slate-600">{question.difficulty || '—'}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-slate-600">{question.marks ?? 1}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <ActionButton
                          label={`Preview question ${id}`}
                          title={verdict.ok ? 'Play it here, in the H5P player' : verdict.reason ?? ''}
                          icon={Play}
                          disabled={!verdict.ok}
                          onClick={() => props.onAction('preview', question)}
                        />
                        <ActionButton
                          label={`Open question ${id} in the player`}
                          title={verdict.ok ? 'Open the player on its own page' : verdict.reason ?? ''}
                          icon={ExternalLink}
                          disabled={!verdict.ok}
                          onClick={() => props.onAction('open', question)}
                        />
                        <ActionButton
                          label={`Assign question ${id}`}
                          title="Assign this question as homework"
                          icon={Send}
                          onClick={() => props.onAction('assign', question)}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-3 py-2.5 text-xs text-slate-600">
        <div className="flex items-center gap-2">
          <span>Rows per page</span>
          <select
            value={props.perPage}
            onChange={(event) => props.onPerPageChange(Number(event.target.value))}
            className="h-7 rounded-lg border border-slate-200 bg-white px-1.5 text-xs"
            aria-label="Rows per page"
          >
            {[25, 50, 100].map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
          {props.serverPaged ? null : <span className="text-[11px] text-slate-400">paged in the browser</span>}
        </div>

        <div className="flex items-center gap-2">
          <span className="tabular-nums">
            {props.total === 0
              ? '0 questions'
              : `${(props.page - 1) * props.perPage + 1}–${Math.min(props.page * props.perPage, props.total)} of ${props.total}`}
          </span>
          <button
            type="button"
            onClick={() => props.onPageChange(props.page - 1)}
            disabled={props.page <= 1}
            className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 transition hover:bg-slate-50 disabled:text-slate-300"
            aria-label="Previous page"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => props.onPageChange(props.page + 1)}
            disabled={props.page >= lastPage}
            className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 transition hover:bg-slate-50 disabled:text-slate-300"
            aria-label="Next page"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * The preview panel: the real player, mounted directly.
 *
 * NOT AN IFRAME. The earlier build framed a player route, which needed a saved
 * activity to have a URL at all. The player is now a component and the row is
 * built in memory, so it mounts in this tree: one React tree, no second auth
 * context, no second stylesheet load, and the panel can say plainly that
 * nothing was stored.
 */
export function PreviewPanel({
  title,
  library,
  onClose,
  children,
}: {
  title: string;
  library: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  // Escape closes, and the page behind does not scroll while it is open.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);

    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Preview: ${title}`}
      onClick={onClose}
    >
      <div
        className="flex h-full max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Live preview</p>
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                Nothing saved
              </span>
              <span className="font-mono text-[10px] text-slate-400">{library}</span>
            </div>
            <h2 className="mt-0.5 truncate text-sm font-semibold text-slate-900">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close preview"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto bg-slate-50">{children}</div>
      </div>
    </div>
  );
}

