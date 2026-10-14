'use client';

// The running total, kept in view while the marks are edited.
//
// Three numbers that mean three different things and are never merged:
//   - Out of      what the paper is worth;
//   - AI          what the AI suggested in total (never changes while you edit);
//   - Your total  what the sheet adds up to if approved now: your marks where you
//                 gave one, the AI's suggestion everywhere else.
// The server recomputes the total when you save; this is the live preview of it.

import { AlertTriangle } from 'lucide-react';
import { formatMarks, type ReviewTotals } from '@/lib/exam-evaluation/review-math';

type Props = {
  totals: ReviewTotals;
  /** The sheet is approved: "Your total" is then the final, saved total. */
  approved: boolean;
  /** The marks on screen differ from what is saved: the figures are a live preview of the save. */
  unsaved?: boolean;
};

export default function TotalsBar({ totals, approved, unsaved = false }: Props) {
  const changed = totals.teacherTotal !== totals.aiTotal;

  return (
    <section
      aria-label="Marks summary"
      className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
    >
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="Out of" value={formatMarks(totals.maxTotal)} />
        <Tile label="AI suggested" value={formatMarks(totals.aiTotal)} muted />
        <Tile
          label={approved ? 'Final total' : 'Your total'}
          value={formatMarks(totals.teacherTotal)}
          emphasis
          hint={
            unsaved
              ? 'Not saved yet'
              : changed
                ? `${totals.teacherTotal > totals.aiTotal ? '+' : ''}${formatMarks(totals.teacherTotal - totals.aiTotal)} from the AI`
                : undefined
          }
        />
        <Tile label="Percentage" value={totals.percentage === null ? '—' : `${totals.percentage}%`} />
      </dl>

      <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600" aria-live="polite">
        <span>
          <strong className="tabular-nums text-slate-800">{totals.reviewedCount}</strong> of {totals.questionCount}{' '}
          marked by you
        </span>
        <span>
          <strong className="tabular-nums text-slate-800">{totals.unreviewedCount}</strong> still on the AI suggestion
        </span>
        {totals.unlabelledCount > 0 ? (
          <span className="text-slate-500">
            {totals.unlabelledCount === 1 ? '1 question’s number is' : `${totals.unlabelledCount} question numbers are`} inferred
            from the paper layout: the numbers on the sheet weren’t read
          </span>
        ) : null}
        {totals.flaggedUnresolvedCount > 0 ? (
          <span className="inline-flex items-center gap-1 font-semibold text-amber-700">
            <AlertTriangle className="size-3.5" />
            {totals.flaggedUnresolvedCount} flagged {totals.flaggedUnresolvedCount === 1 ? 'question needs' : 'questions need'}{' '}
            your mark
          </span>
        ) : totals.flaggedCount > 0 ? (
          <span className="text-emerald-700">All {totals.flaggedCount} flagged questions are marked</span>
        ) : null}
        {totals.invalidCount > 0 ? (
          <span className="font-semibold text-red-700">
            {totals.invalidCount} {totals.invalidCount === 1 ? 'mark isn’t' : 'marks aren’t'} valid
          </span>
        ) : null}
      </p>
    </section>
  );
}

function Tile({
  label,
  value,
  hint,
  muted = false,
  emphasis = false,
}: {
  label: string;
  value: string;
  hint?: string;
  muted?: boolean;
  emphasis?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border px-3 py-2 ${
        emphasis ? 'border-primary/40 bg-primary/5' : 'border-slate-200 bg-slate-50'
      }`}
    >
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd
        className={`text-lg font-semibold tabular-nums ${muted ? 'text-slate-500' : 'text-slate-900'}`}
      >
        {value}
      </dd>
      {hint ? <p className="text-[11px] text-slate-500">{hint}</p> : null}
    </div>
  );
}
