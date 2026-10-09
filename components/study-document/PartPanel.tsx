'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { ArrowRight, Eye, Lightbulb } from 'lucide-react';

import { ActivityCard } from '@/components/study-deck/ActivityCard';
import type { BankQuestion } from '@/lib/h5p/question-bank-h5p-map';
import { resolvePart, topicNameOf, PART_NAME } from '@/lib/study-document/document';
import {
  discussionOf,
  featuresOf,
  flashcardsOf,
  followUpOf,
  guidedOf,
  interactionDoneKey,
  exampleKeyOf,
  mistakesInteraction,
  mistakesKey,
  noteMistakeInteraction,
  partProgress,
  reflectionOf,
  stepsInteraction,
  stepsKey,
  workedExampleInteraction,
  type GuidedQuestion,
} from '@/lib/study-document/online';
import type { ProgressAction } from '@/lib/study-document/progress';
import type { ActivityPart, RemedialUnitPart, RevisionNotePart, StudyDocument } from '@/lib/study-document/types';
import { Flashcards } from './Flashcards';
import { InteractionStage } from './InteractionStage';

type Part = RevisionNotePart | RemedialUnitPart | ActivityPart;

export interface PartPanelProps {
  doc: StudyDocument;
  part: Part;
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
 * panel only lays them out for one note, unit or activity and reports what was done upward. The PDF holds the text of the
 * part in full; what is here is what a PDF cannot do.
 */
export function PartPanel({ doc, part, bank, done, notes, dispatch, onOpenPart }: PartPanelProps) {
  const features = featuresOf(part);
  const progress = partProgress(part, done);
  const topic = topicNameOf(doc, part);
  const questions = useMemo(() => resolvePart(part, bank), [part, bank]);
  const memory = `p${part.n}`;
  const mark = (key: string) => () => dispatch({ type: 'done', key });
  const conceptName = (id: number | null) => (id !== null ? doc.concepts[String(id)]?.name ?? null : null);

  const orientation = part.type === 'note' ? part.content.summary : part.type === 'unit' ? part.content.simple_explanation : part.content.focus;

  const cards = flashcardsOf(doc).filter((c) => c.part === part.n);

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
        : questions.map((q) => (
            <ActivityCard
              key={q.key}
              resolved={q.resolved}
              activityKey={q.key}
              done={done.has(q.key)}
              connects={conceptName(q.resolved.activity.connects_concept)}
              onResult={(key) => dispatch({ type: 'done', key })}
            />
          ))}
    </div>
  );

  return (
    <article aria-label={`${PART_NAME[doc.kind]} ${part.n}: ${part.title}`} className="space-y-4" data-testid={`part-${part.n}`}>
      <header className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-indigo-700">
          {PART_NAME[doc.kind]} {part.n}
          {topic ? ` · ${topic}` : ''}
        </p>
        <h2 className="text-xl font-semibold tracking-tight text-slate-900">{part.title}</h2>
        {orientation ? <p className="max-w-3xl text-sm leading-relaxed text-slate-700">{orientation}</p> : null}
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

      {features.map((feature) => {
        switch (feature) {
          case 'term':
            return (
              <Block key={feature} title="Key term" hint="Turn the card over to see what it means.">
                <Flashcards cards={cards} known={done} onKnown={(key, known) => dispatch({ type: known ? 'done' : 'undone', key })} />
              </Block>
            );
          case 'mistakes': {
            const interaction = part.type === 'note' ? noteMistakeInteraction(part) : part.type === 'unit' ? mistakesInteraction(part) : null;
            if (!interaction) return null;
            const key = mistakesKey(part);

            return (
              <InteractionStage
                key={feature}
                interaction={interaction}
                eyebrow={part.type === 'note' ? 'Do not confuse' : 'Watch out'}
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
          case 'questions':
            return (
              <Block key={feature} title={part.type === 'unit' ? 'Practice' : 'Check yourself'} hint={part.type === 'unit' ? 'Start with level 1. Each level gives less help.' : 'Answer, then read why.'}>
                {questionList}
              </Block>
            );
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
            if (part.type !== 'note') return null;

            return (
              <Block key={feature} title="I can…" hint="Tick each one when you can do it without looking.">
                <ul className="space-y-1.5">
                  {part.content.checklist.map((text, i) => {
                    const key = `check:${part.n}:${i}`;

                    return (
                      <li key={key} className="flex items-start gap-3">
                        <input id={key} type="checkbox" checked={done.has(key)} onChange={() => dispatch({ type: 'toggle', key })} className="mt-1 h-4 w-4 rounded border-slate-400 accent-indigo-600" />
                        <label htmlFor={key} className="text-sm text-slate-900">
                          {text}
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </Block>
            );
          }
          default:
            return null;
        }
      })}

      {part.type === 'unit' ? (
        <>
          {followUpOf(doc, part).length > 0 ? (
            <Block title="If that was hard">
              <ul className="space-y-2">
                {followUpOf(doc, part).map((f) => (
                  <li key={f.part} className="flex flex-wrap items-center gap-2 text-sm text-slate-900">
                    <button
                      type="button"
                      onClick={() => onOpenPart(f.part)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-300 bg-indigo-50 px-2.5 py-1 font-medium text-indigo-900 hover:bg-indigo-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600"
                    >
                      {PART_NAME[doc.kind]} {f.part}: {f.name}
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
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
