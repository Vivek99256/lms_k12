'use client';

import { useMemo, useState } from 'react';
import { BookOpen, CheckCircle2, Layers, ListChecks, PenLine } from 'lucide-react';

import { ActivityCard } from '@/components/study-deck/ActivityCard';
import { activityKey } from '@/lib/study-deck/deck';
import type { Audience } from '@/lib/study-document/api';
import type { BankQuestion } from '@/lib/h5p/question-bank-h5p-map';
import { partLabel, resolvePart } from '@/lib/study-document/document';
import { interactionDoneKey, type ChecklistGroup, type Flashcard } from '@/lib/study-document/online';
import { JOURNEYS, REVISION_BLOCKS, blockKeys, conceptMapOf, mapKey, resultActions, retryActions, share, type RevisionStage } from '@/lib/study-document/journey';
import type { ProgressAction } from '@/lib/study-document/progress';
import type { BodyPart, CheckPart, StudyDocument } from '@/lib/study-document/types';
import { ChecklistPanel } from './ChecklistPanel';
import { ConceptMap } from './ConceptMap';
import { Flashcards } from './Flashcards';
import { InteractionStage } from './InteractionStage';
import { Chip, ENTER, JourneyFrame, NextButton, type FrameStep } from './JourneyFrame';
import { PartPanel } from './PartPanel';
import { Plays } from './PlayGame';

export interface ShellProps {
  doc: StudyDocument;
  /** The parts this reader may see (the glossary and the teacher guide are decided before this). */
  parts: BodyPart[];
  glossary: BodyPart | null;
  bank: ReadonlyMap<number, BankQuestion>;
  done: ReadonlySet<string>;
  notes: Readonly<Record<string, string>>;
  dispatch: (action: ProgressAction) => void;
  terms: Flashcard[];
  checklist: ChecklistGroup[];
  audience: Audience;
}

type Selection = { kind: 'part'; n: number } | { kind: 'terms' } | { kind: 'checklist' } | { kind: 'selftest' };

const readKey = (part: Pick<BodyPart, 'n'>): string => `read:${part.n}`;

/** The self-test questions that are about this topic: positions in the check part's `activities`. */
function selfTestIndexes(doc: StudyDocument, check: CheckPart, topicId: number | null): number[] {
  return check.activities.flatMap((a, index) => ((a.concept_id === null ? null : doc.concepts[String(a.concept_id)]?.topic_id ?? null) === topicId ? [index] : []));
}

/**
 * Revision notes as a notebook: a tab for every topic down the side, and for each topic the same four steps, Read, Explore,
 * Recall, Check. A topic is "complete" when its four steps are. It adds no content: every table, diagram, card and question
 * is the stored document's, shown a step at a time instead of all at once.
 */
export function RevisionNotebook(props: ShellProps) {
  const { doc, parts, glossary, bank, done, notes, dispatch, terms, checklist } = props;
  const journey = JOURNEYS.revision_notes;
  const topics = useMemo(() => parts.filter((p) => p.type === 'topic' || p.type === 'note'), [parts]);
  const check = useMemo(() => parts.find((p): p is CheckPart => p.type === 'check') ?? null, [parts]);
  const [selected, setSelected] = useState<Selection>(() => (topics[0] ? { kind: 'part', n: topics[0].n } : terms.length > 0 ? { kind: 'terms' } : { kind: 'selftest' }));
  const [stage, setStage] = useState<RevisionStage>('read');

  const current = selected.kind === 'part' ? topics.find((p) => p.n === selected.n) : undefined;

  /** The steps a topic has something to do in, with how far each is. */
  const stagesOf = (part: BodyPart) => {
    const tests = check ? selfTestIndexes(doc, check, part.topic_id).map((i) => activityKey(check, i)) : [];
    const own = (s: Exclude<RevisionStage, 'read' | 'check'>) => REVISION_BLOCKS[s].flatMap((b) => blockKeys(part, b, undefined, doc));
    const ownQuestions = blockKeys(part, 'questions');
    const check_ = [...ownQuestions, ...tests];

    return {
      read: { keys: [readKey(part)], present: true },
      explore: { keys: own('explore'), present: own('explore').length > 0 },
      recall: { keys: own('recall'), present: own('recall').length > 0 },
      check: { keys: check_, present: check_.length > 0 },
    } satisfies Record<RevisionStage, { keys: string[]; present: boolean }>;
  };
  const stageDone = (keys: string[]) => keys.length > 0 && keys.every((k) => done.has(k));

  // Revision progress: finished steps over the steps that exist, across every topic.
  const progress = useMemo(() => {
    let finished = 0;
    let total = 0;
    for (const part of topics) {
      for (const s of Object.values(stagesOf(part))) {
        if (!s.present) continue;
        total += 1;
        if (stageDone(s.keys)) finished += 1;
      }
    }

    return { finished, total, percent: share({ done: finished, total }) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topics, done, check, doc]);

  const stages = current ? stagesOf(current) : null;
  const available = (id: RevisionStage) => stages?.[id].present ?? false;
  const order = journey.workflow.map((w) => w.id as RevisionStage).filter(available);
  const activeStage: RevisionStage = order.includes(stage) ? stage : order[0] ?? 'read';
  const nextStage = order[order.indexOf(activeStage) + 1];

  const steps: FrameStep[] = journey.workflow.map((w) => {
    const id = w.id as RevisionStage;
    const info = stages?.[id];
    const counted = info && info.present ? `${info.keys.filter((k) => done.has(k)).length}/${info.keys.length}` : undefined;

    return {
      id,
      label: w.label,
      does: w.does,
      state: !current ? 'todo' : id === activeStage ? 'current' : info && info.present && stageDone(info.keys) ? 'done' : 'todo',
      count: current ? counted : undefined,
      disabled: !current || !available(id),
    };
  });

  const items: Array<{ id: string; label: string; sub: string; selection: Selection; complete: boolean; icon?: typeof BookOpen }> = [
    ...topics.map((p) => {
      const s = Object.values(stagesOf(p)).filter((x) => x.present);
      const finished = s.filter((x) => stageDone(x.keys)).length;

      return { id: `p${p.n}`, label: partLabel(doc, p).replace(/^Topic \d+: /, ''), sub: `${finished}/${s.length}`, selection: { kind: 'part', n: p.n } as Selection, complete: s.length > 0 && finished === s.length };
    }),
    ...(terms.length > 0
      ? [{ id: 'terms', label: 'Key terms', sub: `${terms.filter((t) => done.has(t.id)).length}/${terms.length}`, selection: { kind: 'terms' } as Selection, complete: terms.every((t) => done.has(t.id)), icon: Layers }]
      : []),
    ...(checklist.length > 0
      ? [
          {
            id: 'checklist',
            label: 'Revision checklist',
            sub: `${checklist.flatMap((g) => g.items).filter((i) => done.has(i.id)).length}/${checklist.flatMap((g) => g.items).length}`,
            selection: { kind: 'checklist' } as Selection,
            complete: checklist.flatMap((g) => g.items).every((i) => done.has(i.id)),
            icon: ListChecks,
          },
        ]
      : []),
    ...(check ? [{ id: 'selftest', label: 'Full self-test', sub: `${check.activities.filter((_, i) => done.has(activityKey(check, i))).length}/${check.activities.length}`, selection: { kind: 'selftest' } as Selection, complete: check.activities.every((_, i) => done.has(activityKey(check, i))), icon: PenLine }] : []),
  ];
  const isSelected = (s: Selection) => (s.kind === 'part' ? selected.kind === 'part' && selected.n === s.n : selected.kind === s.kind);
  const choose = (s: Selection) => {
    setSelected(s);
    setStage('read');
  };
  const open = (n: number) => {
    if (parts.some((p) => p.n === n)) choose({ kind: 'part', n });
  };

  const mark = (key: string) => () => dispatch({ type: 'done', key });

  return (
    <JourneyFrame
      journey={journey}
      progress={progress.percent}
      progressLabel={`Revision progress · ${progress.finished} of ${progress.total} steps`}
      steps={steps}
      onStep={(id) => setStage(id as RevisionStage)}
      testId="revision-notebook"
    >
      <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] md:grid-cols-[15rem_minmax(0,1fr)] md:grid-rows-1">
        <nav aria-label="Notebook tabs" className="border-b border-sd-line bg-sd-soft/60 md:overflow-y-auto md:border-b-0 md:border-r">
          <div className="p-2 md:hidden">
            <label htmlFor="notebook-tab" className="sr-only">
              Choose a topic
            </label>
            <select
              id="notebook-tab"
              value={items.find((i) => isSelected(i.selection))?.id ?? ''}
              onChange={(e) => {
                const item = items.find((i) => i.id === e.target.value);
                if (item) choose(item.selection);
              }}
              className="w-full rounded-lg border border-sd-line bg-white p-2 text-sm text-slate-900"
            >
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.label} ({i.sub})
                </option>
              ))}
            </select>
          </div>
          <ul className="hidden space-y-1.5 p-2.5 md:block">
            {items.map((i) => {
              const active = isSelected(i.selection);
              const Icon = i.icon ?? BookOpen;

              return (
                <li key={i.id}>
                  <button
                    type="button"
                    aria-current={active ? 'true' : undefined}
                    onClick={() => choose(i.selection)}
                    className={`flex w-full items-start gap-2 rounded-lg border-l-4 px-2.5 py-2 text-left text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-sd-accent motion-reduce:transition-none ${
                      active ? 'border-sd-accent bg-white text-sd-strong shadow-sm' : 'border-transparent text-slate-900 hover:bg-white/70'
                    }`}
                  >
                    {i.complete ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" aria-label="Complete" /> : <Icon className="mt-0.5 h-4 w-4 shrink-0 text-sd-accent" aria-hidden="true" />}
                    <span className="min-w-0 flex-1 leading-snug">{i.label}</span>
                    <span className="shrink-0 text-xs tabular-nums text-slate-700">{i.sub}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="min-h-0 overflow-y-auto p-3 sm:p-5" data-testid="notebook-page">
          {/* The page of the notebook: white paper with a margin rule. */}
          <div key={`${selected.kind}-${selected.kind === 'part' ? selected.n : ''}-${activeStage}`} className={`mx-auto max-w-4xl space-y-4 rounded-2xl border border-sd-line border-l-8 border-l-rose-300 bg-white p-4 shadow-sm sm:p-6 ${ENTER}`}>
            {selected.kind === 'terms' ? (
              <>
                <h2 className="text-xl font-semibold tracking-tight text-slate-900">Key terms</h2>
                <p className="text-sm text-slate-700">Turn a card over to check you remember what the term means, then mark the ones you know.</p>
                <Flashcards cards={terms} known={done} onKnown={(key, known) => dispatch({ type: known ? 'done' : 'undone', key })} />
                {glossary?.interaction ? (
                  <InteractionStage interaction={glossary.interaction} image={glossary.image} eyebrow="Recall" title="Match the key terms" done={done.has(interactionDoneKey(glossary))} onDone={mark(interactionDoneKey(glossary))} memoryKey="glossary:ix" />
                ) : null}
              </>
            ) : selected.kind === 'checklist' ? (
              <>
                <h2 className="text-xl font-semibold tracking-tight text-slate-900">Revision checklist</h2>
                <ChecklistPanel groups={checklist} ticked={done} onToggle={(key) => dispatch({ type: 'toggle', key })} onClear={(keys) => keys.forEach((key) => dispatch({ type: 'undone', key }))} onOpenPart={open} />
              </>
            ) : selected.kind === 'selftest' && check ? (
              <PartPanel key={check.n} doc={doc} part={check} bank={bank} done={done} notes={notes} dispatch={dispatch} onOpenPart={open} />
            ) : current && stages ? (
              <>
                <header className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-xs font-bold uppercase tracking-wider text-sd-strong">{journey.workflow.find((w) => w.id === activeStage)?.label}</p>
                    {Object.values(stages).filter((s) => s.present).every((s) => stageDone(s.keys)) ? <Chip tone="good">Topic complete</Chip> : null}
                  </div>
                  <h2 className="text-xl font-semibold tracking-tight text-slate-900">{current.title}</h2>
                  {current.type === 'topic' && activeStage === 'read' ? <p className="max-w-3xl text-sm leading-relaxed text-slate-800">{current.content.big_idea}</p> : null}
                  {current.type === 'note' && activeStage === 'read' ? <p className="max-w-3xl text-sm leading-relaxed text-slate-800">{current.content.summary}</p> : null}
                </header>

                {activeStage === 'check' ? (
                  <CheckStage doc={doc} part={current} check={check} bank={bank} done={done} dispatch={dispatch} />
                ) : (
                  <div className="space-y-4">
                    <PartPanel key={`${current.n}-${activeStage}`} doc={doc} part={current} bank={bank} done={done} notes={notes} dispatch={dispatch} onOpenPart={open} blocks={REVISION_BLOCKS[activeStage]} bare />
                    {activeStage === 'explore' ? <TopicMap doc={doc} part={current} done={done} dispatch={dispatch} /> : null}
                    {activeStage === 'recall' ? <Plays doc={doc} part={current} done={done} dispatch={dispatch} hints /> : null}
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-sd-line pt-3">
                  {activeStage === 'read' ? (
                    done.has(readKey(current)) ? (
                      <Chip tone="good">
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                        Read
                      </Chip>
                    ) : (
                      <button
                        type="button"
                        onClick={mark(readKey(current))}
                        className="rounded-xl border border-sd-accent bg-white px-3 py-1.5 text-sm font-semibold text-sd-strong hover:bg-sd-softer focus-visible:outline focus-visible:outline-2 focus-visible:outline-sd-accent"
                      >
                        I have read this
                      </button>
                    )
                  ) : (
                    <span />
                  )}
                  {nextStage ? (
                    <NextButton label={`Next: ${journey.workflow.find((w) => w.id === nextStage)?.label}`} onClick={() => setStage(nextStage)} />
                  ) : (
                    (() => {
                      const at = topics.findIndex((p) => p.n === current.n);
                      const after = topics[at + 1];

                      return after ? <NextButton label={`Next topic: ${after.title}`} onClick={() => choose({ kind: 'part', n: after.n })} /> : null;
                    })()
                  )}
                </div>
              </>
            ) : (
              <p className="text-sm text-slate-700">Choose a tab to start.</p>
            )}
          </div>
        </div>
      </div>
    </JourneyFrame>
  );
}

/** The Check step of a topic: its own questions and the self-test questions that are about this topic. */
function CheckStage({ doc, part, check, bank, done, dispatch }: { doc: StudyDocument; part: BodyPart; check: CheckPart | null; bank: ReadonlyMap<number, BankQuestion>; done: ReadonlySet<string>; dispatch: (a: ProgressAction) => void }) {
  const report = (key: string, result: { correct: boolean | null }) => resultActions(key, result.correct !== null, result.correct === true).forEach(dispatch);
  const sources: Array<{ owner: BodyPart; indexes: number[] }> = [
    ...(part.activities.length > 0 ? [{ owner: part, indexes: part.activities.map((_, i) => i) }] : []),
    ...(check ? [{ owner: check as BodyPart, indexes: selfTestIndexes(doc, check, part.topic_id) }] : []),
  ];
  const conceptName = (id: number | null) => (id !== null ? doc.concepts[String(id)]?.name ?? null : null);

  return (
    <section aria-label="Check yourself" className="space-y-3">
      <p className="text-sm text-slate-700">Answer, then read why. Each question is marked as soon as you answer it.</p>
      {sources.flatMap(({ owner, indexes }) => {
        const resolved = resolvePart(owner, bank);

        return indexes.map((i) => (
          <ActivityCard key={resolved[i].key} resolved={resolved[i].resolved} activityKey={resolved[i].key} done={done.has(resolved[i].key)} connects={conceptName(resolved[i].resolved.activity.connects_concept)} onResult={report} onRetry={(key) => retryActions(key).forEach(dispatch)} />
        ));
      })}
    </section>
  );
}

/** How the ideas of a topic connect, when the document says which idea needs which. */
function TopicMap({ doc, part, done, dispatch }: { doc: StudyDocument; part: BodyPart; done: ReadonlySet<string>; dispatch: (a: ProgressAction) => void }) {
  const graph = useMemo(() => conceptMapOf(doc, part), [doc, part]);
  if (!graph) return null;

  return <ConceptMap key={part.n} graph={graph} done={done.has(mapKey(part))} onDone={() => dispatch({ type: 'done', key: mapKey(part) })} />;
}
