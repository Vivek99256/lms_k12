// One place for how the exam-evaluation statuses look, so the evaluations list
// and the review page cannot drift apart. Explicit palette classes rather than
// StatusBadge variants: the success / warning colour tokens those rely on are
// not registered in the Tailwind theme and render unstyled.

import type { AnswerStatus, SheetStatus } from './types';

export const SHEET_STATUS_STYLES: Record<SheetStatus, string> = {
  Identifying: 'bg-sky-50 text-sky-700 border-sky-200',
  // The system is idle and a person is needed: the same amber as "Needs review".
  'Awaiting identity': 'bg-amber-50 text-amber-700 border-amber-200',
  Pending: 'bg-slate-100 text-slate-600 border-slate-200',
  Processing: 'bg-sky-50 text-sky-700 border-sky-200',
  Evaluated: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  'Needs review': 'bg-amber-50 text-amber-700 border-amber-200',
  Approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Failed: 'bg-red-50 text-red-700 border-red-200',
};

/** What a teacher reads in place of the internal status name. */
export const SHEET_STATUS_LABELS: Partial<Record<SheetStatus, string>> = {
  Identifying: 'Reading student',
  'Awaiting identity': 'Confirm student',
  Pending: 'Queued',
};

export const BATCH_STATUS_STYLES: Record<string, string> = {
  Draft: 'bg-slate-100 text-slate-600 border-slate-200',
  Processing: 'bg-sky-50 text-sky-700 border-sky-200',
  Review: 'bg-amber-50 text-amber-700 border-amber-200',
  Published: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

export const ANSWER_STATUS_STYLES: Record<AnswerStatus, { label: string; className: string }> = {
  correct: { label: 'Correct', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  partially_correct: { label: 'Partly correct', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  wrong: { label: 'Wrong', className: 'bg-red-50 text-red-700 border-red-200' },
  unattempted: { label: 'Not attempted', className: 'bg-slate-100 text-slate-600 border-slate-200' },
};
