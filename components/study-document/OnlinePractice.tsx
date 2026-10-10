'use client';

import { useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import { CheckCircle2, Layers, ListChecks, Loader2, RefreshCw } from 'lucide-react';

import { MemoryContext } from '@/components/study-deck/stage-ui';
import type { BankQuestion } from '@/lib/h5p/question-bank-h5p-map';
import type { Audience } from '@/lib/study-document/api';
import { KIND_LABEL, partLabel, partsFor } from '@/lib/study-document/document';
import { checklistOf, featuresOf, flashcardsOf, partProgress } from '@/lib/study-document/online';
import { doneSet, loadProgress, progressKey, progressReducer, saveProgress, type DocumentProgress, type ProgressAction, type StorageLike } from '@/lib/study-document/progress';
import type { StudyDocument } from '@/lib/study-document/types';
import { ChecklistPanel } from './ChecklistPanel';
import { loadBank, loadStudyDocument } from './data';
import { Flashcards } from './Flashcards';
import { PartPanel } from './PartPanel';

export interface OnlinePracticeProps {
  chapterId: number;
  contentId: number;
  instituteId: number;
  /** Identifies the learner so progress is kept per learner. */
  userKey: string;
  /** Who is reading: a student is not shown the teacher guide of a remedial class. */
  audience: Audience;
}

type Loaded = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; doc: StudyDocument; bank: BankQuestion[] };

type Selection = { kind: 'part'; n: number } | { kind: 'terms' } | { kind: 'checklist' };

/** The reducer without its optional clock, so React sees the two-argument shape it expects. */
const reduce = (state: DocumentProgress, action: ProgressAction): DocumentProgress => progressReducer(state, action);

/** The browser's own storage, or null when it will not hand it over (a private window). */
function browserStorage(): StorageLike | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

/**
 * The "Try it online" side of a study document.
 *
 * A PDF is the document; this is what a PDF cannot do: select a part of a diagram, turn a card, open a step, answer a
 * question and be told why, tick a point off. It is built from the same stored document the PDF was drawn from, using
 * the study deck's own interaction views and question players. It runs inside the panel that opened it: no route, no tab.
 * Progress is kept in this browser only.
 */
export function OnlinePractice({ chapterId, contentId, instituteId, userKey, audience }: OnlinePracticeProps) {
  const [attempt, setAttempt] = useState(0);
  // What came back is kept with the request it answers (see PdfFrame), so nothing is reset inside the effect.
  const requestKey = `${chapterId}:${contentId}:${instituteId}:${attempt}`;
  const [answer, setAnswer] = useState<{ key: string; loaded: Exclude<Loaded, { status: 'loading' }> } | null>(null);
  const loaded: Loaded = answer && answer.key === requestKey ? answer.loaded : { status: 'loading' };

  useEffect(() => {
    const controller = new AbortController();

    // The question bank is only needed for the questions; a chapter whose bank cannot be read still gets everything else.
    Promise.all([loadStudyDocument({ chapterId, contentId, instituteId, signal: controller.signal }), loadBank(chapterId, controller.signal).catch(() => [] as BankQuestion[])])
      .then(([doc, bank]) => {
        if (!controller.signal.aborted) setAnswer({ key: requestKey, loaded: { status: 'ready', doc, bank } });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setAnswer({ key: requestKey, loaded: { status: 'error', message: error instanceof Error ? error.message : 'Couldn’t load the online practice.' } });
      });

    return () => controller.abort();
  }, [chapterId, contentId, instituteId, requestKey]);

  if (loaded.status === 'loading') {
    return (
      <div role="status" className="flex h-full min-h-[18rem] flex-col items-center justify-center gap-3 text-slate-600">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-600" aria-hidden="true" />
        <p className="text-sm">Getting the online practice ready…</p>
      </div>
    );
  }

  if (loaded.status === 'error') {
    return (
      <div role="alert" className="flex h-full min-h-[18rem] flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="max-w-md text-sm text-slate-800">{loaded.message}</p>
        <p className="max-w-md text-xs text-slate-600">The PDF tab still works.</p>
        <button
          type="button"
          onClick={() => setAttempt((n) => n + 1)}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Try again
        </button>
      </div>
    );
  }

  return <Practice doc={loaded.doc} bank={loaded.bank} contentId={contentId} userKey={userKey} audience={audience} />;
}

function Practice({ doc, bank, contentId, userKey, audience }: { doc: StudyDocument; bank: BankQuestion[]; contentId: number; userKey: string; audience: Audience }) {
  // Only the parts this reader may see are listed, counted and opened. The glossary has no entry of its own: "Key terms" below is it.
  const parts = useMemo(() => partsFor(doc, audience).filter((p) => p.type !== 'glossary'), [doc, audience]);
  const bankMap = useMemo(() => new Map(bank.map((q) => [Number(q.id), q])), [bank]);
  const terms = useMemo(() => flashcardsOf(doc), [doc]);
  const checklist = useMemo(() => checklistOf(doc), [doc]);
  const storeKey = progressKey(userKey, contentId);
  const [progress, dispatch] = useReducer(reduce, undefined, () => loadProgress(browserStorage(), storeKey, contentId));
  const done = useMemo(() => doneSet(progress), [progress]);
  // What the learner has opened on each screen, kept while this panel is open.
  const [memory] = useState(() => new Map<string, unknown>());

  const firstWithWork = parts.find((p) => featuresOf(p).length > 0) ?? parts[0];
  const [selected, setSelected] = useState<Selection>({ kind: 'part', n: firstWithWork?.n ?? 1 });

  useEffect(() => {
    saveProgress(browserStorage(), storeKey, progress);
  }, [storeKey, progress]);

  const open = useCallback(
    (n: number) => {
      if (parts.some((p) => p.n === n)) setSelected({ kind: 'part', n });
    },
    [parts]
  );
  const current = selected.kind === 'part' ? parts.find((p) => p.n === selected.n) : undefined;

  const items: Array<{ id: string; label: string; sub?: string; selection: Selection; muted?: boolean }> = [
    ...(doc.kind === 'revision_notes' && terms.length > 0 ? [{ id: 'terms', label: 'Key terms', sub: `${terms.filter((t) => done.has(t.id)).length}/${terms.length}`, selection: { kind: 'terms' } as Selection }] : []),
    ...(doc.kind === 'revision_notes' && checklist.length > 0
      ? [{ id: 'checklist', label: 'Revision checklist', sub: `${checklist.flatMap((g) => g.items).filter((i) => done.has(i.id)).length}/${checklist.flatMap((g) => g.items).length}`, selection: { kind: 'checklist' } as Selection }]
      : []),
    ...parts.map((p) => {
      const progressOf = partProgress(p, done);
      const hasWork = featuresOf(p).length > 0;

      return {
        id: `part-${p.n}`,
        label: partLabel(doc, p),
        sub: hasWork ? (progressOf.total > 0 ? `${progressOf.done}/${progressOf.total}` : '') : 'PDF only',
        selection: { kind: 'part', n: p.n } as Selection,
        muted: !hasWork,
      };
    }),
  ];
  const isSelected = (s: Selection) => (s.kind === 'part' ? selected.kind === 'part' && selected.n === s.n : selected.kind === s.kind);
  const currentId = items.find((i) => isSelected(i.selection))?.id ?? '';

  return (
    <MemoryContext.Provider value={memory}>
      <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] md:grid-cols-[17rem_minmax(0,1fr)] md:grid-rows-1" data-testid="online-practice">
        <nav aria-label={`${KIND_LABEL[doc.kind]} parts`} className="border-b border-slate-200 bg-slate-50 md:overflow-y-auto md:border-b-0 md:border-r">
          <div className="p-2 md:hidden">
            <label htmlFor="part-select" className="sr-only">
              Choose a part
            </label>
            <select
              id="part-select"
              value={currentId}
              onChange={(event) => {
                const item = items.find((i) => i.id === event.target.value);
                if (item) setSelected(item.selection);
              }}
              className="w-full rounded-lg border border-slate-300 bg-white p-2 text-sm text-slate-900"
            >
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.label}
                  {i.sub ? ` (${i.sub})` : ''}
                </option>
              ))}
            </select>
          </div>
          <ul className="hidden space-y-0.5 p-2 md:block">
            {items.map((i) => {
              const active = isSelected(i.selection);
              const Icon = i.id === 'terms' ? Layers : i.id === 'checklist' ? ListChecks : null;

              return (
                <li key={i.id}>
                  <button
                    type="button"
                    aria-current={active ? 'true' : undefined}
                    onClick={() => setSelected(i.selection)}
                    className={`flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600 ${
                      active ? 'bg-indigo-600 text-white' : i.muted ? 'text-slate-500 hover:bg-slate-100' : 'text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    {Icon ? <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> : null}
                    <span className="min-w-0 flex-1 leading-snug">{i.label}</span>
                    {i.sub ? <span className={`shrink-0 text-xs ${active ? 'text-indigo-100' : 'text-slate-500'}`}>{i.sub}</span> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="min-h-0 overflow-y-auto p-4 sm:p-6" data-testid="online-panel">
          {selected.kind === 'terms' ? (
            <div className="mx-auto max-w-2xl space-y-3">
              <h2 className="text-xl font-semibold tracking-tight text-slate-900">Key terms</h2>
              <p className="text-sm text-slate-700">The terms from the notes, with what each one means. Turn a card over to check yourself.</p>
              <Flashcards cards={terms} known={done} onKnown={(key, known) => dispatch({ type: known ? 'done' : 'undone', key })} />
            </div>
          ) : selected.kind === 'checklist' ? (
            <div className="mx-auto max-w-3xl space-y-3">
              <h2 className="text-xl font-semibold tracking-tight text-slate-900">Revision checklist</h2>
              <ChecklistPanel
                groups={checklist}
                ticked={done}
                onToggle={(key) => dispatch({ type: 'toggle', key })}
                onClear={(keys) => keys.forEach((key) => dispatch({ type: 'undone', key }))}
                onOpenPart={open}
              />
            </div>
          ) : current ? (
            <div className="mx-auto max-w-4xl">
              <PartPanel key={current.n} doc={doc} part={current} bank={bankMap} done={done} notes={progress.notes} dispatch={dispatch} onOpenPart={open} />
            </div>
          ) : null}

          <p className="mx-auto mt-6 flex max-w-4xl items-center gap-2 text-xs text-slate-600">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
            Your place and what you write are kept in this browser only.
          </p>
        </div>
      </div>
    </MemoryContext.Provider>
  );
}
