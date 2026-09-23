'use client';

import { useState } from 'react';
import { Loader2, X } from 'lucide-react';

import { SearchDropdown, type SearchDropdownValues } from '@/components/search-dropdown';
import { Input } from '@/components/ui/input';
import { assignHomework } from '@/app/lms/homework/api';

/**
 * Assign the selected questions as homework.
 *
 * WHY THIS WRITES HOMEWORK AND NOT SOMETHING NEW. `assignHomework` already
 * takes `sourceType: 'question_bank'` and a list of question ids, and the
 * homework screen, the student's submission flow and the review queue are all
 * built on that. Assigning from here therefore REFERENCES the same questions
 * rather than copying them, and the homework a learner opens is the one the
 * homework module has always served.
 *
 * WHOLE CLASS, NOT A STUDENT LIST. `assign_mode: 'all'` makes the server
 * resolve the class from the section, standard and division, so no student ids
 * are sent from here and none are trusted. Picking individual students is what
 * the homework screen is for; this is the shortcut from a chapter's questions
 * to "the whole class has this tonight".
 */

export function AssignDialog({
  questionIds,
  defaults,
  onClose,
  onAssigned,
}: {
  questionIds: number[];
  defaults: { section?: string; standard?: string; subject?: string };
  onClose: () => void;
  onAssigned: (message: string) => void;
}) {
  const [scope, setScope] = useState<Partial<SearchDropdownValues>>({
    section: defaults.section ?? '',
    standard: defaults.standard ?? '',
    division: '',
    subject: defaults.subject ?? '',
  });
  const [title, setTitle] = useState(
    questionIds.length === 1 ? 'Practice question' : `Practice set of ${questionIds.length} questions`
  );
  const [dueDate, setDueDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const value = (field: keyof SearchDropdownValues): string => {
    const stored = scope[field];
    return Array.isArray(stored) ? stored[0] ?? '' : String(stored ?? '');
  };

  const submit = async () => {
    setError('');

    if (!value('standard') || !value('division') || !value('subject')) {
      setError('Choose the standard, division and subject this homework is for.');
      return;
    }
    if (!dueDate) {
      setError('Choose a submission date.');
      return;
    }

    setSaving(true);
    try {
      await assignHomework({
        studentIds: [],
        assignMode: 'all',
        grade: value('section'),
        title: title.trim() || 'Practice questions',
        description: `${questionIds.length} question${questionIds.length === 1 ? '' : 's'} from the question bank.`,
        submissionDate: dueDate,
        standardId: value('standard'),
        divisionId: value('division'),
        subjectId: value('subject'),
        sourceType: 'question_bank',
        questionIds,
      });

      onAssigned(
        `Homework assigned to the class: ${questionIds.length} question${questionIds.length === 1 ? '' : 's'}, due ${dueDate}.`
      );
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not assign this homework.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Assign as homework"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Assign as homework</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {questionIds.length} question{questionIds.length === 1 ? '' : 's'} go to the whole class. The questions are
              referenced, never copied.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-4 py-4">
          <SearchDropdown
            fields={['section', 'standard', 'division', 'subject']}
            values={scope}
            onChange={(values) => setScope(values)}
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">Title</span>
              <Input value={title} onChange={(event) => setTitle(event.target.value)} className="h-9" />
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">Submission date</span>
              <Input
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
                className="h-9"
              />
            </div>
          </div>

          {error ? (
            <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#4f46e5] px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-[#4338ca] disabled:bg-slate-300"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Assign to the class
          </button>
        </div>
      </div>
    </div>
  );
}
