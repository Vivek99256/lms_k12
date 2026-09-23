'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ChevronLeft, Info, Library, Loader2, Play, X } from 'lucide-react';

import { QuestionPlayer } from '@/components/h5p/players';
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
 * questions THIS content type can ask, and plays any of them through this
 * type's own player. A teacher who has questions in the bank has activities in
 * every type those questions reach, without authoring anything.
 *
 * WHAT IT DOES NOT DO — and this is the design, not a gap. It does not create
 * an H5P record, and there is no "convert" button to press. The activity is
 * built in the browser at the moment it is opened and thrown away when the
 * panel closes, so:
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

export function QuestionBankSource({ kind, unavailableReason, ctx, noun }: QuestionBankSourceProps) {
  const [result, setResult] = useState<BankSourceResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [playing, setPlaying] = useState<QuestionBankApiQuestion | null>(null);
  const [showSkipped, setShowSkipped] = useState(false);

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
          setPlaying(null);
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

  if (playing) {
    return (
      <Panel>
        <div className="mb-3 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setPlaying(null)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Back to questions
          </button>
          <span className="text-xs text-slate-500">
            Question {playing.id} · played as {targetLabel(kind).toLowerCase()}
          </span>
        </div>

        {/*
          The question, not an activity id. The player derives everything it
          needs from the row, which is why no record had to be created to get
          here — and `as` is what makes the SAME row render as this type
          rather than as whatever its default target is.
        */}
        <QuestionPlayer question={playing} as={kind} embedded />
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
              Questions in this chapter that can be asked as a {noun}. Nothing is created — each one
              is played straight from the bank.
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
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
            {filtered.map((row) => (
              <li key={row.id} className="flex items-start justify-between gap-3 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm text-slate-800">{plainText(row.question)}</p>
                  <p className="mt-0.5 font-mono text-[11px] text-slate-400">QB-{row.id}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setPlaying(row)}
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

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">{children}</section>
  );
}
