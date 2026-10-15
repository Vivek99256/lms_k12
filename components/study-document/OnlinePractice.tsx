'use client';

import { useEffect, useMemo, useReducer, useState } from 'react';
import { CheckCircle2, Loader2, RefreshCw } from 'lucide-react';

import { MemoryContext } from '@/components/study-deck/stage-ui';
import type { BankQuestion } from '@/lib/h5p/question-bank-h5p-map';
import type { Audience } from '@/lib/study-document/api';
import { partsFor } from '@/lib/study-document/document';
import { checklistOf, flashcardsOf } from '@/lib/study-document/online';
import { doneSet, loadProgress, progressKey, progressReducer, saveProgress, type DocumentProgress, type ProgressAction, type StorageLike } from '@/lib/study-document/progress';
import type { StudyDocument } from '@/lib/study-document/types';
import { ActivityWorkspace } from './ActivityWorkspace';
import { loadBank, loadStudyDocument } from './data';
import { RemedialJourney } from './RemedialJourney';
import { RevisionNotebook } from './RevisionNotebook';

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
  // Only the parts this reader may see are listed, counted and opened. The glossary has no screen of its own: "Key terms" is it.
  const parts = useMemo(() => partsFor(doc, audience).filter((p) => p.type !== 'glossary'), [doc, audience]);
  const bankMap = useMemo(() => new Map(bank.map((q) => [Number(q.id), q])), [bank]);
  const terms = useMemo(() => flashcardsOf(doc), [doc]);
  // The glossary has no screen of its own, so an interaction it carries is shown on the Key terms screen.
  const glossary = useMemo(() => partsFor(doc, audience).find((p) => p.type === 'glossary') ?? null, [doc, audience]);
  const checklist = useMemo(() => checklistOf(doc), [doc]);
  const storeKey = progressKey(userKey, contentId);
  const [progress, dispatch] = useReducer(reduce, undefined, () => loadProgress(browserStorage(), storeKey, contentId));
  const done = useMemo(() => doneSet(progress), [progress]);
  // What the learner has opened on each screen, kept while this panel is open.
  const [memory] = useState(() => new Map<string, unknown>());

  useEffect(() => {
    saveProgress(browserStorage(), storeKey, progress);
  }, [storeKey, progress]);

  const shell = { doc, parts, glossary, bank: bankMap, done, notes: progress.notes, dispatch, terms, checklist, audience };

  // Each kind of document is its own experience (its own look, steps and navigation) over the same stored document.
  return (
    <MemoryContext.Provider value={memory}>
      <div className="flex h-full min-h-0 flex-col" data-testid="online-practice">
        <div className="min-h-0 flex-1">{doc.kind === 'remedial' ? <RemedialJourney {...shell} /> : doc.kind === 'activities' ? <ActivityWorkspace {...shell} /> : <RevisionNotebook {...shell} />}</div>
        <p className="flex items-center gap-2 border-t border-slate-200 bg-white px-4 py-1.5 text-xs text-slate-600">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
          Your place and what you write are kept in this browser only.
        </p>
      </div>
    </MemoryContext.Provider>
  );
}
