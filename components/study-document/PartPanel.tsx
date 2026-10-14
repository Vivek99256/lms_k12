'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { ArrowRight, Eye, Lightbulb } from 'lucide-react';

import { ActivityCard } from '@/components/study-deck/ActivityCard';
import type { BankQuestion } from '@/lib/h5p/question-bank-h5p-map';
import { partHeading, partLabel, partName, partTag, resolvePart, topicNameOf } from '@/lib/study-document/document';
import {
  clinicCardsOf,
  discussionOf,
  featuresOf,
  flashcardsOf,
  followUpOf,
  guidedOf,
  ifMissedFor,
  interactionDoneKey,
  exampleKeyOf,
  mistakesInteraction,
  mistakesKey,
  noteMistakeInteraction,
  partProgress,
  questionGroups,
  readinessRule,
  reflectionOf,
  stepsInteraction,
  stepsKey,
  tickItemsOf,
  topicMixupInteraction,
  unitPointers,
  workedExampleInteraction,
  type GuidedQuestion,
} from '@/lib/study-document/online';
import type { ProgressAction } from '@/lib/study-document/progress';
import type { BodyPart, ClinicPart, GapsPart, RevisionTopicPart, StudyDocument, TeacherPart } from '@/lib/study-document/types';
import { Flashcards } from './Flashcards';
import { InteractionStage } from './InteractionStage';

export interface PartPanelProps {
  doc: StudyDocument;
  part: BodyPart;
  bank: ReadonlyMap<number, BankQuestion>;
  /** Keys of everything the learner has done in this document. */
  done: ReadonlySet<string>;
  /** What the learner wrote for reflection prompts. */
  notes: Readonly<Record<string, string>>;
  dispatch: (action: ProgressAction) => void;
  /** Open another part (a "go back to" pointer). */
  onOpenPart: (n: number) => void;
}

function Block({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5" aria-label={title}>
      <header>
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        {hint ? <p className="mt-0.5 text-sm text-slate-600">{hint}</p> : null}
      </header>
      {children}
    </section>
  );
}

/** A button that opens another part of the document. */
function PartButton({ label, onOpen }: { label: string; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-300 bg-indigo-50 px-2.5 py-1 text-sm font-medium text-indigo-900 hover:bg-indigo-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600"
    >
      {label}
      <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
    </button>
  );
}

/** A table that scrolls sideways on a narrow screen. The frame can take focus, so a keyboard can scroll it. */
function TableFrame({ caption, minWidth = 'min-w-[36rem]', children }: { caption: string; minWidth?: string; children: ReactNode }) {
  return (
    <div role="region" aria-label={caption} tabIndex={0} className="overflow-x-auto rounded-xl border border-slate-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600">
      <table className={`w-full ${minWidth} border-collapse text-left text-sm text-slate-900`}>
        <caption className="sr-only">{caption}</caption>
        {children}
      </table>
    </div>
  );
}

const COLUMN = 'px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-700';

function CellList({ items }: { items: string[] }) {
  if (items.length === 0) return <span className="text-slate-500">None</span>;

  return (
    <ul className="list-disc space-y-0.5 pl-4">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

/** What a topic is about, concept by concept, and its comparison table when it has one. */
function TopicTables({ part }: { part: RevisionTopicPart }) {
  const { rows, compare } = part.content;

  return (
    <>
      {rows.length > 0 ? (
        <Block title="Concepts at a glance">
          <TableFrame caption={`Concepts in ${part.title}`}>
            <thead className="bg-slate-50">
              <tr>
                <th scope="col" className={COLUMN}>
                  Concept
                </th>
                <th scope="col" className={COLUMN}>
                  What to know
                </th>
                <th scope="col" className={COLUMN}>
                  Terms
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {rows.map((row, i) => (
                <tr key={`${row.concept_id}-${i}`}>
                  <th scope="row" className="px-3 py-2 align-top font-medium">
                    {row.name}
                  </th>
                  <td className="px-3 py-2 align-top">{row.essential}</td>
                  <td className="px-3 py-2 align-top">
                    {row.terms.length > 0 ? (
                      <ul className="flex flex-wrap gap-1.5">
                        {row.terms.map((term, j) => (
                          <li key={j} className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-900">
                            {term}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-slate-500">None</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </TableFrame>
        </Block>
      ) : null}

      {compare && compare.columns.length > 0 && compare.rows.length > 0 ? (
        <Block title={compare.title || 'Side by side'}>
          <TableFrame caption={compare.title || `Comparison in ${part.title}`}>
            <thead className="bg-slate-50">
              <tr>
                {compare.columns.map((column, i) => (
                  <th key={i} scope="col" className={COLUMN}>
                    {column || <span className="sr-only">Row</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {compare.rows.map((row, i) => (
                <tr key={i}>
                  {compare.columns.map((_, j) =>
                    j === 0 ? (
                      <th key={j} scope="row" className="px-3 py-2 align-top font-medium">
                        {row?.[j] ?? ''}
                      </th>
                    ) : (
                      <td key={j} className="px-3 py-2 align-top">
                        {row?.[j] ?? ''}
                      </td>
                    )
                  )}
                </tr>
              ))}
            </tbody>
          </TableFrame>
        </Block>
      ) : null}
    </>
  );
}

/** How likely a concept is to be a gap. Written out in words as well as styled, so it never rests on colour alone. */
const PRIORITY: Record<string, { label: string; className: string }> = {
  higher: { label: 'Higher', className: 'border-rose-300 bg-rose-50 text-rose-900' },
  medium: { label: 'Medium', className: 'border-amber-300 bg-amber-50 text-amber-900' },
  lower: { label: 'Lower', className: 'border-slate-300 bg-slate-50 text-slate-800' },
};

/** The concepts that may be hard, each with its priority. The part's `note` (these are potential difficulties, not measured results) is printed above it. */
function GapsTable({ part }: { part: GapsPart }) {
  const { rows, others } = part.content;

  return (
    <Block title="Concepts to look at">
      {rows.length > 0 ? (
        <TableFrame caption="Concepts that may be hard, with their priority">
          <thead className="bg-slate-50">
            <tr>
              {['Concept', 'Priority', 'Why it may be hard', 'Check first', 'Covered in'].map((column) => (
                <th key={column} scope="col" className={COLUMN}>
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {rows.map((row, i) => {
              const priority = PRIORITY[row.priority] ?? { label: String(row.priority || 'Not set'), className: PRIORITY.lower.className };

              return (
                <tr key={`${row.concept_id}-${i}`}>
                  <th scope="row" className="px-3 py-2 align-top font-medium">
                    {row.name}
                  </th>
                  <td className="px-3 py-2 align-top">
                    <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-semibold ${priority.className}`}>{priority.label}</span>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <CellList items={row.reasons} />
                  </td>
                  <td className="px-3 py-2 align-top">
                    <CellList items={row.check_first} />
                  </td>
                  <td className="px-3 py-2 align-top">{row.covered_in}</td>
                </tr>
              );
            })}
          </tbody>
        </TableFrame>
      ) : null}
      {others.length > 0 ? <p className="text-sm text-slate-800">Also in this chapter, at lower priority: {others.join(', ')}.</p> : null}
    </Block>
  );
}

/** The ideas to judge. Decide whether the idea is right, then open the card for why it seems true and what is true. */
function ClinicCards({ doc, part, dispatch, onOpenPart }: { doc: StudyDocument; part: ClinicPart; dispatch: (action: ProgressAction) => void; onOpenPart: (n: number) => void }) {
  return (
    <ul className="space-y-3">
      {clinicCardsOf(part).map((card) => {
        const unit = card.unit === null ? undefined : unitPointers(doc, [card.unit])[0];

        return (
          <li key={card.key} className="rounded-xl border border-slate-200 p-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-600">Is this idea right?</p>
            <p className="mt-0.5 text-sm font-medium text-slate-900">{card.wrongIdea}</p>
            <details
              className="mt-2"
              onToggle={(event) => {
                if (event.currentTarget.open) dispatch({ type: 'done', key: card.key });
              }}
            >
              <summary className="inline-flex cursor-pointer items-center gap-1.5 text-sm font-medium text-indigo-700 hover:text-indigo-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600">
                <Eye className="h-4 w-4" aria-hidden="true" />
                Show what is true
              </summary>
              <div className="mt-2 space-y-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-950">
                {card.whySeemsTrue ? (
                  <p>
                    <span className="font-semibold">Why it seems true. </span>
                    {card.whySeemsTrue}
                  </p>
                ) : null}
                <p>
                  <span className="font-semibold">What is true. </span>
                  {card.correction}
                </p>
                {card.checkIt ? (
                  <p>
                    <span className="font-semibold">Check it. </span>
                    {card.checkIt}
                  </p>
                ) : null}
              </div>
            </details>
            {unit ? (
              <div className="mt-2">
                <PartButton label={`Go to ${unit.label}`} onOpen={() => onOpenPart(unit.part)} />
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

/** The teacher's guide to running the class. Only a teacher is given it: the list of parts leaves it out for anyone else. */
function TeacherGuide({ doc, part, onOpenPart }: { doc: StudyDocument; part: TeacherPart; onOpenPart: (n: number) => void }) {
  const { how_to_run: steps, pacing, total_minutes: total, interventions } = part.content;

  return (
    <>
      {steps.length > 0 ? (
        <Block title="How to run it">
          <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-900">
            {steps.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
        </Block>
      ) : null}

      {pacing.length > 0 ? (
        <Block title="Pacing">
          <TableFrame caption="Minutes for each part of the class" minWidth="min-w-[16rem]">
            <thead className="bg-slate-50">
              <tr>
                <th scope="col" className={COLUMN}>
                  Part
                </th>
                <th scope="col" className={COLUMN}>
                  Minutes
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {pacing.map((row, i) => (
                <tr key={`${row.n}-${i}`}>
                  <th scope="row" className="px-3 py-2 font-medium">
                    {row.title}
                  </th>
                  <td className="px-3 py-2">{row.minutes}</td>
                </tr>
              ))}
            </tbody>
            {total > 0 ? (
              <tfoot className="border-t border-slate-300 bg-slate-50">
                <tr>
                  <th scope="row" className="px-3 py-2 font-semibold">
                    Total
                  </th>
                  <td className="px-3 py-2 font-semibold">{total}</td>
                </tr>
              </tfoot>
            ) : null}
          </TableFrame>
        </Block>
      ) : null}

      {interventions.length > 0 ? (
        <Block title="If a learner is stuck" hint="For each idea: what to look for, what to try, and what to do if that is not enough.">
          <ul className="space-y-3">
            {interventions.map((item, i) => {
              const unit = unitPointers(doc, [item.n])[0];

              return (
                <li key={`${item.concept_id}-${i}`} className="space-y-2 rounded-xl border border-slate-200 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-sm font-semibold text-slate-900">{item.name}</h4>
                    {unit ? <PartButton label={`Open ${unit.label}`} onOpen={() => onOpenPart(unit.part)} /> : null}
                  </div>
                  <dl className="grid gap-2 text-sm text-slate-900 sm:grid-cols-3">
                    <div>
                      <dt className="font-semibold">Look for</dt>
                      <dd>{item.look_for}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold">Try this</dt>
                      <dd>{item.try_this}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold">If still stuck</dt>
                      <dd>{item.if_still_stuck}</dd>
                    </div>
                  </dl>
                </li>
              );
            })}
          </ul>
        </Block>
      ) : null}
    </>
  );
}

/** What a part says about itself under its heading: the idea of a topic, the purpose of the guide, the lead-in to its questions. */
function orientationOf(part: BodyPart): string {
  switch (part.type) {
    case 'note':
      return part.content.summary;
    case 'topic':
      return part.content.big_idea;
    case 'unit':
      return part.content.simple_explanation;
    case 'activity':
      return part.content.focus;
    case 'gaps':
      return part.content.note;
    case 'teacher':
      return part.content.purpose;
    case 'check':
    case 'diagnostic':
    case 'clinic':
    case 'independent':
    case 'exit':
      return part.content.intro;
    default:
      return '';
  }
}

/** What the question block of each kind of part is called and says. */
const QUESTION_BLOCK: Partial<Record<BodyPart['type'], { title: string; hint: string }>> = {
  unit: { title: 'Practice', hint: 'Start with level 1. Each level gives less help.' },
  diagnostic: { title: 'Quick check', hint: 'Answer each question. If you miss one, the unit to take is shown under it.' },
  check: { title: 'Questions', hint: 'Answer, then read why.' },
  independent: { title: 'Questions', hint: 'There are no hints here. Answer, then read why.' },
  exit: { title: 'Questions', hint: 'Answer each one without looking back.' },
};

/** One question with its hint (shown on request) and, once it has been answered, why each wrong choice is wrong. */
function GuidedCard({ g, children, done }: { g: GuidedQuestion; children: ReactNode; done: boolean }) {
  const [hintOpen, setHintOpen] = useState(false);
  const reasons = Object.entries(g.notOptions).filter(([, why]) => why.trim());

  return (
    <div className="space-y-2" data-testid={`guided-${g.level}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-sky-600 px-2.5 py-0.5 text-xs font-semibold text-white">Level {g.level}</span>
        <span className="text-sm font-medium text-slate-800">{g.label}</span>
        {g.hint.trim() ? (
          <button
            type="button"
            onClick={() => setHintOpen((o) => !o)}
            aria-expanded={hintOpen}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-sky-300 bg-sky-50 px-2.5 py-1 text-sm font-medium text-sky-900 hover:bg-sky-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-600"
          >
            <Lightbulb className="h-4 w-4" aria-hidden="true" />
            {hintOpen ? 'Hide the hint' : 'Show a hint'}
          </button>
        ) : null}
      </div>
      {hintOpen && g.hint.trim() ? (
        <p role="note" className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-950">
          <span className="font-semibold">Hint. </span>
          {g.hint}
        </p>
      ) : null}
      {children}
      {done && reasons.length > 0 ? (
        <aside aria-label="Why the other choices do not fit" className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900">
          <p className="font-semibold">Why the other choices do not fit</p>
          <ul className="mt-1 space-y-1">
            {reasons.map(([label, why]) => (
              <li key={label}>
                <span className="font-semibold">{label}.</span> {why}
              </li>
            ))}
          </ul>
        </aside>
      ) : null}
    </div>
  );
}

/**
 * Everything a document part offers online, in the order the PDF prints it.
 *
 * The parts are the study deck's own (diagram hotspots, cards, steps, matching, ordering, the shared question players); this
 * panel only lays them out for one part and reports what was done upward. The PDF holds the text of the part in full; what is
 * here is what a PDF cannot do, and the tables and lists a part is read from.
 *
 * Which parts a reader is given is decided before this (`partsFor`): the teacher guide never reaches a student.
 */
export function PartPanel({ doc, part, bank, done, notes, dispatch, onOpenPart }: PartPanelProps) {
  const features = featuresOf(part);
  const progress = partProgress(part, done);
  const topic = topicNameOf(doc, part);
  const questions = useMemo(() => resolvePart(part, bank), [part, bank]);
  const memory = `p${part.n}`;
  const mark = (key: string) => () => dispatch({ type: 'done', key });
  const conceptName = (id: number | null) => (id !== null ? doc.concepts[String(id)]?.name ?? null : null);

  const orientation = orientationOf(part);
  const aside = part.type === 'diagnostic' ? part.content.scoring : part.type === 'check' ? part.content.note : '';

  const cards = flashcardsOf(doc).filter((c) => c.part === part.n);
  const revisit = part.type === 'exit' ? unitPointers(doc, part.content.revisit.map((r) => r.n)) : [];

  const question = (index: number) => {
    const q = questions[index];
    const card = (
      <ActivityCard
        key={q.key}
        resolved={q.resolved}
        activityKey={q.key}
        done={done.has(q.key)}
        connects={conceptName(q.resolved.activity.connects_concept)}
        onResult={(key) => dispatch({ type: 'done', key })}
      />
    );
    const pointers = part.type === 'diagnostic' ? ifMissedFor(doc, part, index) : [];
    if (pointers.length === 0) return card;

    return (
      <div key={q.key} className="space-y-2">
        {card}
        <div className="flex flex-wrap items-center gap-2 px-1 text-sm text-slate-800">
          <span>If you miss this one, take</span>
          {pointers.map((p) => (
            <PartButton key={p.part} label={p.label} onOpen={() => onOpenPart(p.part)} />
          ))}
        </div>
      </div>
    );
  };

  // A check spans every topic, so its questions are set out topic by topic; anywhere else they are one list.
  const groups = part.type === 'check' ? questionGroups(doc, part) : [{ topic: null, indexes: questions.map((_, i) => i) }];

  const questionList = (
    <div className="space-y-3">
      {part.type === 'unit'
        ? (() => {
            const guided = guidedOf(part);
            const guidedKeys = new Set(guided.map((g) => g.key));

            return (
              <>
                {guided.map((g) => {
                  const q = questions[g.index];
                  const isDone = done.has(g.key);

                  return (
                    <GuidedCard key={g.key} g={g} done={isDone}>
                      <ActivityCard
                        resolved={q.resolved}
                        activityKey={g.key}
                        done={isDone}
                        connects={conceptName(q.resolved.activity.connects_concept)}
                        onResult={(key) => dispatch({ type: 'done', key })}
                      />
                    </GuidedCard>
                  );
                })}
                {questions
                  .filter((q) => !guidedKeys.has(q.key))
                  .map((q) => (
                    <ActivityCard
                      key={q.key}
                      resolved={q.resolved}
                      activityKey={q.key}
                      done={done.has(q.key)}
                      connects={conceptName(q.resolved.activity.connects_concept)}
                      onResult={(key) => dispatch({ type: 'done', key })}
                    />
                  ))}
              </>
            );
          })()
        : groups.map((group) => (
            <div key={group.topic ?? 'all'} className="space-y-3">
              {groups.length > 1 ? <h4 className="text-sm font-semibold text-indigo-900">{group.topic ?? 'Other questions'}</h4> : null}
              {group.indexes.map(question)}
            </div>
          ))}
    </div>
  );

  return (
    <article aria-label={partLabel(doc, part)} className="space-y-4" data-testid={`part-${part.n}`}>
      <header className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-indigo-700">
          {partTag(doc, part)}
          {topic && topic !== part.title ? ` · ${topic}` : ''}
        </p>
        <h2 className="text-xl font-semibold tracking-tight text-slate-900">{partHeading(part)}</h2>
        {orientation ? <p className="max-w-3xl text-sm leading-relaxed text-slate-700">{orientation}</p> : null}
        {aside ? <p className="max-w-3xl text-sm leading-relaxed text-slate-700">{aside}</p> : null}
        {progress.total > 0 ? (
          <p className="text-xs text-slate-600" role="status">
            {progress.done} of {progress.total} done
          </p>
        ) : null}
      </header>

      {features.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">Everything in this part is in the PDF. There is nothing more to try online.</p>
      ) : null}

      {part.type === 'activity' && part.content.student_steps.length > 0 ? (
        <Block title="What you do" hint={part.content.materials.length > 0 ? `You need: ${part.content.materials.join(', ')}.` : undefined}>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-900">
            {part.content.student_steps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        </Block>
      ) : null}

      {part.type === 'topic' ? (
        <>
          <TopicTables part={part} />
          {part.content.recall.length > 0 ? (
            <Block title="Remember this">
              <ul className="list-disc space-y-1 pl-5 text-sm text-slate-900">
                {part.content.recall.map((fact, i) => (
                  <li key={i}>{fact}</li>
                ))}
              </ul>
            </Block>
          ) : null}
        </>
      ) : null}

      {part.type === 'exit' && (part.content.criteria.length > 0 || readinessRule(part)) ? (
        <Block title="What you should be able to do" hint={readinessRule(part) ?? undefined}>
          {part.content.criteria.length > 0 ? (
            <ul className="list-disc space-y-1 pl-5 text-sm text-slate-900">
              {part.content.criteria.map((c, i) => (
                <li key={i}>{c.text}</li>
              ))}
            </ul>
          ) : null}
        </Block>
      ) : null}

      {features.map((feature) => {
        switch (feature) {
          case 'term':
            return (
              <Block key={feature} title={part.type === 'glossary' ? 'Turn the cards' : 'Key term'} hint="Turn the card over to see what it means.">
                <Flashcards cards={cards} known={done} onKnown={(key, known) => dispatch({ type: known ? 'done' : 'undone', key })} />
              </Block>
            );
          case 'mistakes': {
            if (part.type === 'clinic') {
              return (
                <Block key={feature} title="Ideas to judge" hint="Open an idea to see why it seems true, and what is true.">
                  <ClinicCards doc={doc} part={part} dispatch={dispatch} onOpenPart={onOpenPart} />
                </Block>
              );
            }
            const interaction = part.type === 'note' ? noteMistakeInteraction(part) : part.type === 'topic' ? topicMixupInteraction(part) : part.type === 'unit' ? mistakesInteraction(part) : null;
            if (!interaction) return null;
            const key = mistakesKey(part);

            return (
              <InteractionStage
                key={feature}
                interaction={interaction}
                eyebrow={part.type === 'note' || part.type === 'topic' ? 'Do not confuse' : 'Watch out'}
                title="What people often get wrong"
                summary="Select a card to see why it does not hold, and what is true instead."
                done={done.has(key)}
                onDone={mark(key)}
                memoryKey={`${memory}:mistakes`}
                className="h-[26rem]"
              />
            );
          }
          case 'steps': {
            if (part.type !== 'unit') return null;
            const interaction = stepsInteraction(part);
            if (!interaction) return null;

            return (
              <InteractionStage
                key={feature}
                interaction={interaction}
                eyebrow="Step by step"
                title="Take the idea one step at a time"
                summary={part.content.real_life ?? undefined}
                done={done.has(stepsKey(part))}
                onDone={mark(stepsKey(part))}
                memoryKey={`${memory}:steps`}
              />
            );
          }
          case 'worked_example': {
            if (part.type !== 'unit') return null;
            const interaction = workedExampleInteraction(part);
            if (!interaction) return null;

            return (
              <InteractionStage
                key={feature}
                interaction={interaction}
                eyebrow="Worked example"
                title={part.content.worked_example?.problem ?? 'Worked example'}
                done={done.has(exampleKeyOf(part))}
                onDone={mark(exampleKeyOf(part))}
                memoryKey={`${memory}:example`}
              />
            );
          }
          case 'diagram':
          case 'interaction': {
            if (!part.interaction) return null;
            const key = interactionDoneKey(part);

            return (
              <InteractionStage
                key={feature}
                interaction={part.interaction}
                image={part.image}
                eyebrow={part.interaction.kind === 'hotspots' ? 'Explore the diagram' : 'Try it'}
                title={part.title}
                done={done.has(key)}
                onDone={mark(key)}
                memoryKey={`${memory}:ix`}
              />
            );
          }
          case 'questions': {
            const copy = QUESTION_BLOCK[part.type] ?? { title: 'Check yourself', hint: 'Answer, then read why.' };

            return (
              <Block key={feature} title={copy.title} hint={copy.hint}>
                {questionList}
              </Block>
            );
          }
          case 'discussion': {
            if (part.type !== 'activity') return null;

            return (
              <Block key={feature} title="Talk about it" hint="Discuss first. Then open a possible answer to compare.">
                <ul className="space-y-3">
                  {discussionOf(part).map((d) => (
                    <li key={d.id} className="rounded-xl border border-slate-200 p-3">
                      <p className="text-sm font-medium text-slate-900">{d.prompt}</p>
                      <details className="mt-2">
                        <summary className="inline-flex cursor-pointer items-center gap-1.5 text-sm font-medium text-indigo-700 hover:text-indigo-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600">
                          <Eye className="h-4 w-4" aria-hidden="true" />
                          Show a possible answer
                        </summary>
                        <p className="mt-2 rounded-lg bg-emerald-50 p-2.5 text-sm text-emerald-950">{d.answer}</p>
                      </details>
                    </li>
                  ))}
                </ul>
              </Block>
            );
          }
          case 'reflection': {
            if (part.type !== 'activity') return null;

            return (
              <Block key={feature} title="Reflect" hint="What you write stays in this browser. It is not sent anywhere.">
                <div className="space-y-3">
                  {reflectionOf(part).map((r) => {
                    const key = `${part.n}:${r.id}`;

                    return (
                      <div key={r.id} className="space-y-1">
                        <label htmlFor={`reflect-${key}`} className="block text-sm font-medium text-slate-900">
                          {r.prompt}
                        </label>
                        <textarea
                          id={`reflect-${key}`}
                          rows={3}
                          value={notes[key] ?? ''}
                          onChange={(event) => dispatch({ type: 'note', key, text: event.target.value })}
                          className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-sm text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600"
                        />
                      </div>
                    );
                  })}
                </div>
              </Block>
            );
          }
          case 'checklist': {
            if (part.type !== 'note' && part.type !== 'topic') return null;

            return (
              <Block key={feature} title="I can…" hint="Tick each one when you can do it without looking.">
                <ul className="space-y-1.5">
                  {tickItemsOf(part).map(({ key, text }) => (
                    <li key={key} className="flex items-start gap-3">
                      <input id={key} type="checkbox" checked={done.has(key)} onChange={() => dispatch({ type: 'toggle', key })} className="mt-1 h-4 w-4 rounded border-slate-400 accent-indigo-600" />
                      <label htmlFor={key} className="text-sm text-slate-900">
                        {text}
                      </label>
                    </li>
                  ))}
                </ul>
              </Block>
            );
          }
          case 'reading':
            if (part.type === 'gaps') return <GapsTable key={feature} part={part} />;
            if (part.type === 'teacher') return <TeacherGuide key={feature} doc={doc} part={part} onOpenPart={onOpenPart} />;

            return null;
          default:
            return null;
        }
      })}

      {revisit.length > 0 ? (
        <Block title="If you are not ready yet" hint="Go back to these units, then try the check again.">
          <ul className="flex flex-wrap gap-2">
            {revisit.map((p) => (
              <li key={p.part}>
                <PartButton label={p.label} onOpen={() => onOpenPart(p.part)} />
              </li>
            ))}
          </ul>
        </Block>
      ) : null}

      {part.type === 'unit' ? (
        <>
          {followUpOf(doc, part).length > 0 ? (
            <Block title="If that was hard">
              <ul className="space-y-2">
                {followUpOf(doc, part).map((f) => (
                  <li key={f.part} className="flex flex-wrap items-center gap-2 text-sm text-slate-900">
                    <PartButton label={`${partName('unit')} ${f.part}: ${f.name}`} onOpen={() => onOpenPart(f.part)} />
                    <span className="text-slate-700">{f.why}</span>
                  </li>
                ))}
              </ul>
            </Block>
          ) : null}
          {part.content.win ? (
            <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-950">
              <span className="mr-1 text-xs font-semibold uppercase tracking-wider text-emerald-700">You can now</span>
              {part.content.win.replace(/^You can now\s*/i, '')}
            </p>
          ) : null}
        </>
      ) : null}
    </article>
  );
}
