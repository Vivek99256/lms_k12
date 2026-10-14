'use client';

// Whose sheet this is, for which exam, and how far along it is.
//
// The brief for this screen is that a teacher can never be unsure whose paper they
// are marking, so the student is the first thing on it, and a sheet with no student
// says so loudly rather than showing a blank.

import { ArrowLeft, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BATCH_STATUS_STYLES, SHEET_STATUS_LABELS, SHEET_STATUS_STYLES } from '@/app/lms/exam/_exam-evaluation/status-styles';
import type { EvaluationSheet, SheetContext } from '@/app/lms/exam/_exam-evaluation/types';
import { identityState } from '@/lib/exam-evaluation/identity';
import { formatMarks } from '@/lib/exam-evaluation/review-math';

type Props = {
  sheet: EvaluationSheet;
  context: SheetContext | undefined;
  /** Position among the batch's reviewable sheets, for "Sheet 3 of 12". */
  position: { index: number; total: number } | null;
  onBack: () => void;
  onPrevious: (() => void) | null;
  onNext: (() => void) | null;
  busy: boolean;
};

/** What the evaluation step itself did, separate from where the teacher's review stands. */
function aiEvaluationLabel(sheet: EvaluationSheet): { label: string; className: string; spinning: boolean } {
  switch (sheet.status) {
    case 'Identifying':
      return { label: 'Reading the student’s details', className: SHEET_STATUS_STYLES.Identifying, spinning: true };
    case 'Awaiting identity':
      return { label: 'Not started — confirm the student first', className: SHEET_STATUS_STYLES['Awaiting identity'], spinning: false };
    case 'Pending':
      return { label: 'Queued', className: SHEET_STATUS_STYLES.Pending, spinning: false };
    case 'Processing':
      return { label: 'Reading the scan', className: SHEET_STATUS_STYLES.Processing, spinning: true };
    case 'Failed':
      return { label: 'Failed', className: SHEET_STATUS_STYLES.Failed, spinning: false };
    default:
      return { label: 'Completed', className: 'bg-emerald-50 text-emerald-700 border-emerald-200', spinning: false };
  }
}

export default function ReviewHeader({ sheet, context, position, onBack, onPrevious, onNext, busy }: Props) {
  const ai = aiEvaluationLabel(sheet);
  const approved = sheet.status === 'Approved';
  const studentName = sheet.student_name || '';
  const classLine = [context?.class_name, context?.section_name ? `Section ${context.section_name}` : '']
    .filter(Boolean)
    .join(' · ');

  return (
    <header className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onBack}>
          <ArrowLeft /> Back to evaluations
        </Button>

        <div className="flex items-center gap-2">
          {position ? (
            <span className="text-xs tabular-nums text-slate-500">
              Sheet {position.index + 1} of {position.total}
            </span>
          ) : null}
          <Button type="button" variant="outline" size="icon-sm" aria-label="Previous sheet" disabled={!onPrevious || busy} onClick={() => onPrevious?.()}>
            <ChevronLeft />
          </Button>
          <Button type="button" variant="outline" size="icon-sm" aria-label="Next sheet" disabled={!onNext || busy} onClick={() => onNext?.()}>
            <ChevronRight />
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Answer sheet of</p>
          {studentName ? (
            <h1 className="flex flex-wrap items-center gap-x-3 gap-y-1 text-2xl font-bold text-slate-900">
              {studentName}
              <IdentityBadge sheet={sheet} />
            </h1>
          ) : (
            <h1 className="text-2xl font-bold text-amber-700">Student not assigned</h1>
          )}
          <p className="mt-0.5 text-sm text-slate-600">
            {[
              sheet.student_roll_no ? `Roll ${sheet.student_roll_no}` : '',
              sheet.student_enrollment_no ? `GR ${sheet.student_enrollment_no}` : '',
              classLine,
            ]
              .filter(Boolean)
              .join(' · ') || 'Choose the student this sheet belongs to below.'}
          </p>
        </div>

        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
          <Fact label="Exam" value={context?.paper_name} extra={context?.paper_id ? `#${context.paper_id}` : undefined} />
          <Fact label="Subject" value={context?.subject_name} />
          <Fact label="Academic year" value={context?.syear ? String(context.syear) : undefined} />
          <Fact label="Evaluation" value={context?.batch_name} />
          <Fact label="Out of" value={sheet.max_marks === null ? undefined : formatMarks(sheet.max_marks)} />
          <Fact label="AI suggested" value={sheet.ai_total === null ? undefined : formatMarks(sheet.ai_total)} />
          <Fact
            label="Approved total"
            value={approved ? formatMarks(sheet.teacher_total) : undefined}
            fallback="Not approved yet"
          />
        </dl>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-slate-500">Review</span>
        <span className={`rounded-full border px-2.5 py-0.5 font-semibold ${SHEET_STATUS_STYLES[sheet.status] ?? SHEET_STATUS_STYLES.Pending}`}>
          {SHEET_STATUS_LABELS[sheet.status] ?? sheet.status}
        </span>
        <span className="ml-2 text-slate-500">AI evaluation</span>
        <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 font-semibold ${ai.className}`}>
          {ai.spinning ? <Loader2 className="size-3 animate-spin" /> : null}
          {ai.label}
        </span>
        {context?.batch_status ? (
          <>
            <span className="ml-2 text-slate-500">Batch</span>
            <span className={`rounded-full border px-2.5 py-0.5 font-semibold ${BATCH_STATUS_STYLES[context.batch_status] ?? BATCH_STATUS_STYLES.Draft}`}>
              {context.batch_status}
            </span>
          </>
        ) : null}
      </div>
    </header>
  );
}

/** Whether a teacher has vouched for this student, or the matcher only suggested them. */
function IdentityBadge({ sheet }: { sheet: EvaluationSheet }) {
  const state = identityState(sheet);

  if (state === 'unmatched') return null;

  const confirmed = state !== 'suggested';

  return (
    <span
      className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
        confirmed ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'
      }`}
    >
      {state === 'selected_by_teacher' ? 'Selected by a teacher' : confirmed ? 'Confirmed by a teacher' : 'Suggested — not confirmed'}
    </span>
  );
}

function Fact({ label, value, extra, fallback = '—' }: { label: string; value: string | undefined; extra?: string; fallback?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="truncate text-slate-900" title={value}>
        {value ? (
          <>
            {value}
            {extra ? <span className="ml-1 font-mono text-xs text-slate-400">{extra}</span> : null}
          </>
        ) : (
          <span className="text-slate-400">{fallback}</span>
        )}
      </dd>
    </div>
  );
}
