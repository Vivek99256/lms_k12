'use client';

import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, Eye, EyeOff, KeyRound, Lightbulb, Link2, Lock, MessageCircle, Users } from 'lucide-react';

import { outlineOf, relatedConcepts, stageLabel, topicOfSlide } from '@/lib/study-deck/deck';
import { exampleCards, exampleKey, exampleProgress, interactionKey, selectItem, type ExampleCardId } from '@/lib/study-deck/interactions';
import { conceptStatus, type DeckProgress, type ResultInput } from '@/lib/study-deck/progress';
import { layoutOf, type StepKind } from '@/lib/study-deck/stage';
import type { DeckSlide, StudyDeck } from '@/lib/study-deck/types';
import { ExploreView } from './ExploreView';
import { HotspotsView } from './HotspotsView';
import { MatchView } from './MatchView';
import { OrderView } from './OrderView';
import { ScenarioView } from './ScenarioView';
import { CompletedSlot, Eyebrow, motion, Tag, useRememberedReducer, useStage, VisualFigure } from './stage-ui';

export interface SlideViewProps {
  deck: StudyDeck;
  slide: DeckSlide;
  /** Which screen of the slide: see lib/study-deck/stage.ts. */
  step: StepKind;
  progress: DeckProgress;
  assetBase: string | null;
  onResult: (key: string, result: ResultInput, conceptId: number | null, questionId: number | null) => void;
  onGoto: (n: number) => void;
}

const EXPLORED: ResultInput = { correct: null, score: null, maxScore: null };

/**
 * One screen of a slide, drawn as a presentation slide. The same slide data the PPT is built from decides the
 * composition (see `layoutOf`): a diagram with its hotspots, a picture beside its explanation, three cards, a
 * statement with the concept's neighbours, a connection between two ideas, a decision, discovery cards - then,
 * on the following screens, the worked example and common mistake, and the question for the class.
 *
 * Everything fits the stage: nothing here scrolls, and the canvas it is drawn on shrinks text before it overflows.
 */
export function SlideView({ deck, slide, step, progress, assetBase, onResult, onGoto }: SlideViewProps) {
  const exploredKey = interactionKey(slide);
  const memoryKey = exploredKey;
  const exploredDone = Boolean(progress.activities[exploredKey]?.done);
  const explored = useCallback(
    () => onResult(exploredKey, EXPLORED, slide.taught_concept_ids[0] ?? null, null),
    [onResult, exploredKey, slide.taught_concept_ids]
  );

  if (step === 'example') {
    return (
      <ExampleScreen
        slide={slide}
        assetBase={assetBase}
        done={Boolean(progress.activities[exampleKey(slide)]?.done)}
        onDone={() => onResult(exampleKey(slide), EXPLORED, slide.taught_concept_ids[0] ?? null, null)}
      />
    );
  }
  if (step === 'discuss') return <DiscussScreen slide={slide} assetBase={assetBase} />;

  const layout = layoutOf(slide);
  const interaction = slide.interaction;
  const lead = <Lead deck={deck} slide={slide} large={layout === 'statement'} />;

  switch (layout) {
    case 'cover':
      return <CoverScreen deck={deck} slide={slide} onGoto={onGoto} />;
    case 'visual-hotspots':
      return interaction?.kind === 'hotspots' && slide.image ? (
        <HotspotsView interaction={interaction} image={slide.image} assetBase={assetBase} done={exploredDone} onDone={explored} lead={lead} memoryKey={memoryKey} />
      ) : null;
    case 'scenario':
      return interaction?.kind === 'scenario' ? <ScenarioView interaction={interaction} done={exploredDone} onDone={explored} lead={lead} memoryKey={memoryKey} /> : null;
    case 'explore':
      return interaction && 'items' in interaction && interaction.kind !== 'order' ? (
        <ExploreView interaction={interaction} done={exploredDone} onDone={explored} lead={lead} image={slide.image} assetBase={assetBase} memoryKey={memoryKey} />
      ) : null;
    case 'match':
      return interaction?.kind === 'match' ? <MatchView interaction={interaction} done={exploredDone} onDone={explored} lead={lead} memoryKey={memoryKey} /> : null;
    case 'order':
      return interaction?.kind === 'order' ? <OrderView interaction={interaction} done={exploredDone} onDone={explored} lead={lead} memoryKey={memoryKey} /> : null;
    case 'image-text':
      return (
        <Split>
          <div className="flex min-h-0 min-w-0 flex-col gap-[0.8em]">
            {lead}
            <Bullets slide={slide} />
            <Connections deck={deck} slide={slide} onGoto={onGoto} />
          </div>
          <div className="min-h-0 min-w-0">{slide.image ? <VisualFigure image={slide.image} assetBase={assetBase} /> : null}</div>
        </Split>
      );
    case 'cards':
      return (
        <Frame>
          {lead}
          <NumberedCards items={slide.content.bullets} />
          <Connections deck={deck} slide={slide} onGoto={onGoto} />
        </Frame>
      );
    case 'relationship':
      return <RelationshipScreen deck={deck} slide={slide} lead={lead} onGoto={onGoto} />;
    case 'summary':
      return <SummaryScreenSlide deck={deck} slide={slide} progress={progress} lead={lead} onGoto={onGoto} />;
    case 'intro':
      return (
        <Split>
          <div className="flex min-h-0 min-w-0 flex-col gap-[0.8em]">{lead}</div>
          <div className="min-h-0 min-w-0">
            {slide.content.bullets.length > 0 ? <NumberedCards items={slide.content.bullets} stacked /> : <TopicList deck={deck} onGoto={onGoto} />}
          </div>
        </Split>
      );
    case 'statement':
      return (
        <Split wide>
          <div className="flex min-h-0 min-w-0 flex-col gap-[0.8em]">
            {lead}
            <Bullets slide={slide} />
          </div>
          <ConceptTrail deck={deck} slide={slide} onGoto={onGoto} progress={progress} />
        </Split>
      );
  }
}

// ---------------------------------------------------------------------------
// Frames
// ---------------------------------------------------------------------------

/** Two columns on a wide stage, stacked on a tall one. */
function Split({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  const { portrait } = useStage();

  return (
    <div
      className={`grid h-full min-h-0 gap-[1.2em] p-[1.4em] ${
        portrait ? 'grid-rows-[auto_minmax(0,1fr)]' : wide ? 'grid-cols-[minmax(0,7fr)_minmax(0,5fr)]' : 'grid-cols-[minmax(0,4fr)_minmax(0,8fr)]'
      }`}
    >
      {children}
    </div>
  );
}

function Frame({ children }: { children: ReactNode }) {
  return <div className="flex h-full min-h-0 flex-col gap-[1em] p-[1.4em]">{children}</div>;
}

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

/** Where this is, the title, and the explanation of every concept the slide teaches. */
function Lead({ deck, slide, large = false }: { deck: StudyDeck; slide: DeckSlide; large?: boolean }) {
  const { portrait } = useStage();
  const c = slide.content;
  const topic = topicOfSlide(deck, slide);
  const names = slide.taught_concept_ids.map((id) => deck.concepts[String(id)]?.name).filter((x): x is string => Boolean(x));

  return (
    <div className="space-y-[0.5em]">
      <Eyebrow>{stageLabel(slide.slide_type)}</Eyebrow>
      <h2
        id={`slide-${slide.n}-title`}
        tabIndex={-1}
        className={`font-semibold leading-tight tracking-tight text-slate-900 outline-none ${portrait ? 'text-[1.5em]' : 'text-[2.05em]'}`}
      >
        {slide.title}
      </h2>
      {topic ? (
        <p className="text-[0.72em] text-slate-600">
          {topic.name}
          {names.length > 0 ? (
            <>
              <span aria-hidden="true"> › </span>
              <span className="sr-only">, concept: </span>
              <span className="font-medium text-slate-800">{names.join(' and ')}</span>
            </>
          ) : null}
        </p>
      ) : null}
      {c.explanations.length > 0 ? (
        <div className="space-y-[0.5em]">
          {c.explanations.map((e) => (
            <div key={e.concept_id} className="rounded-[0.8em] border border-slate-200 bg-slate-50 px-[0.9em] py-[0.6em]">
              {slide.taught_concept_ids.length > 1 ? <p className="mb-[0.15em] text-[0.62em] font-semibold text-slate-500">{deck.concepts[String(e.concept_id)]?.name}</p> : null}
              <p className={`leading-snug text-slate-900 ${large && !portrait ? 'text-[1.4em]' : 'text-[1.08em]'}`}>{e.text}</p>
            </div>
          ))}
        </div>
      ) : c.body ? (
        <p className={`leading-snug text-slate-800 ${large && !portrait ? 'text-[1.4em]' : 'text-[1.15em]'}`}>{c.body}</p>
      ) : null}
    </div>
  );
}

/** A short list as small cards, for the screens that also carry a picture. */
function Bullets({ slide }: { slide: DeckSlide }) {
  if (slide.content.bullets.length === 0) return null;

  return (
    <ul className="space-y-[0.35em]">
      {slide.content.bullets.map((b, index) => (
        <li key={b} className="flex items-center gap-[0.6em] rounded-[0.6em] border border-slate-200 bg-white px-[0.7em] py-[0.35em] text-[0.9em] text-slate-800">
          <span className="flex h-[1.5em] w-[1.5em] shrink-0 items-center justify-center rounded-full bg-indigo-600 text-[0.8em] font-semibold text-white">{index + 1}</span>
          {b}
        </li>
      ))}
    </ul>
  );
}

/** The three-card explanation: one big numbered card per point. */
function NumberedCards({ items, stacked = false }: { items: string[]; stacked?: boolean }) {
  const { portrait } = useStage();
  const cols = stacked || portrait ? 'grid-cols-1' : items.length === 2 ? 'grid-cols-2' : items.length >= 4 ? 'grid-cols-4' : 'grid-cols-3';

  return (
    <ul className={`grid min-h-0 flex-1 content-center gap-[1em] ${cols}`}>
      {items.map((item, index) => (
        <li key={item} className="flex min-h-[10em] flex-col justify-center gap-[0.7em] rounded-[1.1em] border border-indigo-100 bg-indigo-50 p-[1.2em] shadow-sm">
          <span className="flex h-[2.4em] w-[2.4em] items-center justify-center rounded-full bg-indigo-600 text-[1.1em] font-semibold text-white">{index + 1}</span>
          <span className="text-[1.5em] font-medium leading-snug text-slate-900">{item}</span>
        </li>
      ))}
    </ul>
  );
}

/** Small links to the ideas this one builds on or connects to. */
function Connections({ deck, slide, onGoto }: { deck: StudyDeck; slide: DeckSlide; onGoto: (n: number) => void }) {
  const related = relatedConcepts(deck, slide);
  if (related.length === 0) return null;

  return (
    <div className="mt-auto flex flex-wrap items-center gap-[0.4em]" aria-label="How this connects">
      <Link2 className="h-[0.9em] w-[0.9em] text-slate-500" aria-hidden="true" />
      {related.slice(0, 3).map((r) =>
        r.slide !== null && r.slide !== slide.n ? (
          <button
            key={r.concept.id}
            type="button"
            onClick={() => onGoto(r.slide as number)}
            className="inline-flex items-center gap-[0.3em] rounded-full border border-slate-300 bg-white px-[0.7em] py-[0.15em] text-[0.68em] text-slate-800 hover:border-indigo-400 hover:text-indigo-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600"
          >
            <ArrowLeft className="h-[0.9em] w-[0.9em]" aria-hidden="true" />
            {r.kind === 'builds on' ? 'Builds on' : 'Connects to'} {r.concept.name}
          </button>
        ) : (
          <span key={r.concept.id} className="rounded-full border border-slate-200 bg-white px-[0.7em] py-[0.15em] text-[0.68em] text-slate-700">
            {r.kind === 'builds on' ? 'Builds on' : 'Connects to'} {r.concept.name}
          </span>
        )
      )}
    </div>
  );
}

/** The concept in the middle of what it builds on and what it connects to: the lesson's own map, close up. */
function ConceptTrail({ deck, slide, onGoto, progress }: { deck: StudyDeck; slide: DeckSlide; onGoto: (n: number) => void; progress: DeckProgress }) {
  const related = relatedConcepts(deck, slide);
  const here = slide.taught_concept_ids.map((id) => deck.concepts[String(id)]).filter(Boolean);
  const before = related.filter((r) => r.kind === 'builds on').slice(0, 2);
  const after = related.filter((r) => r.kind === 'connects to').slice(0, 2);

  const node = (label: string, key: string, go: number | null, tone: 'plain' | 'here') => {
    const body = (
      <span
        className={`block rounded-[0.8em] border-2 px-[0.9em] py-[0.55em] text-[0.95em] font-medium leading-snug ${
          tone === 'here' ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300 bg-white text-slate-800 hover:border-indigo-400'
        }`}
      >
        {label}
      </span>
    );

    return go !== null && go !== slide.n ? (
      <button key={key} type="button" onClick={() => onGoto(go)} className="block w-full text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600">
        {body}
      </button>
    ) : (
      <div key={key}>{body}</div>
    );
  };

  return (
    <div className="flex min-h-0 flex-col justify-center gap-[0.5em] rounded-[1em] border border-slate-200 bg-slate-50 p-[1em]" aria-label="Where this idea sits">
      <p className="text-[0.62em] font-semibold uppercase tracking-wider text-slate-500">Where this idea sits</p>
      {before.map((r) => (
        <div key={r.concept.id} className="space-y-[0.2em]">
          <p className="text-[0.62em] text-slate-500">Builds on</p>
          {node(r.concept.name, `b${r.concept.id}`, r.slide, 'plain')}
          <p className="text-center text-slate-400" aria-hidden="true">
            ↓
          </p>
        </div>
      ))}
      {here.map((c) => (
        <div key={c.id} className="space-y-[0.2em]">
          <p className={`text-[0.62em] ${conceptStatus(deck, progress, c.id).taught ? 'text-emerald-700' : 'text-indigo-700'}`}>
            {conceptStatus(deck, progress, c.id).taught ? 'You are here' : 'This idea'}
          </p>
          {node(c.name, `h${c.id}`, null, 'here')}
        </div>
      ))}
      {after.map((r) => (
        <div key={r.concept.id} className="space-y-[0.2em]">
          <p className="text-center text-slate-400" aria-hidden="true">
            ↓
          </p>
          <p className="text-[0.62em] text-slate-500">Connects to</p>
          {node(r.concept.name, `a${r.concept.id}`, r.slide, 'plain')}
        </div>
      ))}
    </div>
  );
}

function TopicList({ deck, onGoto }: { deck: StudyDeck; onGoto: (n: number) => void }) {
  const topics = outlineOf(deck);

  return (
    <ol className="grid h-full min-h-0 auto-rows-fr gap-[0.5em]" aria-label="The chapter in topics">
      {topics.map((topic, index) => {
        const first = topic.concepts[0]?.taughtOn[0];

        return (
          <li key={topic.topicId} className="min-h-0">
            <button
              type="button"
              disabled={first === undefined}
              onClick={() => first !== undefined && onGoto(first)}
              className="flex h-full w-full items-center gap-[0.7em] rounded-[0.8em] border border-slate-200 bg-white px-[0.8em] text-left text-[0.85em] font-medium text-slate-800 hover:border-indigo-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600"
            >
              <span className="flex h-[1.7em] w-[1.7em] shrink-0 items-center justify-center rounded-full bg-indigo-600 text-[0.8em] font-semibold text-white">{index + 1}</span>
              <span className="flex-1">{topic.name}</span>
              <span className="text-[0.75em] text-slate-500">{topic.concepts.length} ideas</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

// ---------------------------------------------------------------------------
// Whole screens
// ---------------------------------------------------------------------------

function CoverScreen({ deck, slide, onGoto }: { deck: StudyDeck; slide: DeckSlide; onGoto: (n: number) => void }) {
  const { portrait } = useStage();

  return (
    <Split>
      <div className="flex min-h-0 min-w-0 flex-col justify-center gap-[0.9em]">
        <Eyebrow>
          Class {deck.chapter.standard_name} · {deck.chapter.subject_name}
        </Eyebrow>
        <h2 id={`slide-${slide.n}-title`} tabIndex={-1} className={`font-semibold leading-tight tracking-tight text-slate-900 outline-none ${portrait ? 'text-[1.9em]' : 'text-[3em]'}`}>
          {deck.chapter.name}
        </h2>
        {slide.content.body ? <p className="text-[1.3em] leading-snug text-slate-700">{slide.content.body}</p> : null}
        <p className="inline-flex items-center gap-[0.4em] text-[0.8em] text-indigo-700">
          Press Continue to begin <ArrowRight className="h-[1em] w-[1em]" aria-hidden="true" />
        </p>
      </div>
      <div className="min-h-0 min-w-0">
        <TopicList deck={deck} onGoto={onGoto} />
      </div>
    </Split>
  );
}

const RELATION_WORD: Record<string, string> = {
  depends_on: 'depends on',
  builds_on: 'builds on',
  contrasts_with: 'is different from',
  related_to: 'is connected to',
};

/** Two ideas and the link between them, as the cause-and-effect style progression of the reference. */
function RelationshipScreen({ deck, slide, lead, onGoto }: { deck: StudyDeck; slide: DeckSlide; lead: ReactNode; onGoto: (n: number) => void }) {
  const { portrait } = useStage();
  const rel = slide.relationship;
  const from = rel ? deck.concepts[String(rel.from)] : undefined;
  const to = rel ? deck.concepts[String(rel.to)] : undefined;
  const slideOf = (id: number) => (deck.taught_by[String(id)] ?? [])[0] ?? null;

  const node = (name: string, id: number) => {
    const go = slideOf(id);
    const body = (
      <span className="block rounded-[1em] border-2 border-indigo-200 bg-indigo-50 px-[1em] py-[1.2em] text-center text-[1.5em] font-semibold leading-snug text-indigo-950">{name}</span>
    );

    return go !== null && go !== slide.n ? (
      <button type="button" onClick={() => onGoto(go)} className="block w-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600">
        {body}
      </button>
    ) : (
      <div>{body}</div>
    );
  };

  return (
    <Frame>
      {lead}
      {rel && from && to ? (
        <div className={`my-auto grid items-center gap-[0.8em] ${portrait ? 'grid-cols-1' : 'grid-cols-[1fr_auto_1fr]'}`}>
          {node(from.name, from.id)}
          <div className="flex flex-col items-center gap-[0.2em] text-center">
            <span className="text-[0.7em] font-semibold uppercase tracking-wider text-slate-500">{RELATION_WORD[rel.kind] ?? 'is connected to'}</span>
            <span className="text-[1.6em] leading-none text-indigo-600" aria-hidden="true">
              {portrait ? '↓' : '→'}
            </span>
          </div>
          {node(to.name, to.id)}
        </div>
      ) : null}
      {slide.content.relationship_note ? (
        <p className="mb-[0.2em] rounded-[0.8em] border border-slate-200 bg-slate-50 px-[1em] py-[0.7em] text-[1.05em] leading-snug text-slate-800">
          <Link2 className="mr-[0.4em] inline h-[1em] w-[1em] text-indigo-600" aria-hidden="true" />
          {slide.content.relationship_note}
        </p>
      ) : null}
    </Frame>
  );
}

/** The wrap-up: the lesson's topics, each with its ideas, as a map the learner can jump around. */
function SummaryScreenSlide({
  deck,
  slide,
  progress,
  lead,
  onGoto,
}: {
  deck: StudyDeck;
  slide: DeckSlide;
  progress: DeckProgress;
  lead: ReactNode;
  onGoto: (n: number) => void;
}) {
  const { portrait } = useStage();
  const topics = outlineOf(deck);

  return (
    <Frame>
      {lead}
      <ul className={`grid min-h-0 content-start gap-[0.6em] ${portrait ? 'grid-cols-1' : 'grid-cols-4'}`} aria-label="The chapter at a glance">
        {topics.map((topic, index) => (
          <li key={topic.topicId} className="flex min-h-0 flex-col gap-[0.25em] rounded-[0.8em] border border-slate-200 bg-slate-50 p-[0.6em]">
            <p className="text-[0.95em] font-semibold leading-tight text-slate-900">
              {index + 1}. {topic.name}
            </p>
            <div className="flex flex-wrap content-start gap-[0.3em]">
              {topic.concepts.map(({ concept, taughtOn }) => {
                const done = conceptStatus(deck, progress, concept.id).taught;

                return (
                  <button
                    key={concept.id}
                    type="button"
                    disabled={taughtOn[0] === undefined || taughtOn[0] === slide.n}
                    onClick={() => taughtOn[0] !== undefined && onGoto(taughtOn[0])}
                    className={`rounded-full border px-[0.55em] py-[0.08em] text-[0.64em] leading-tight focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600 ${
                      done ? 'border-emerald-300 bg-emerald-50 text-emerald-900' : 'border-slate-300 bg-white text-slate-700'
                    }`}
                  >
                    {concept.name}
                  </button>
                );
              })}
            </div>
          </li>
        ))}
      </ul>
    </Frame>
  );
}

const CARD_STYLE: Record<ExampleCardId, { Icon: typeof Lightbulb; tile: string; panel: string; text: string }> = {
  example: { Icon: Lightbulb, tile: 'border-emerald-300 bg-emerald-50 text-emerald-950', panel: 'border-emerald-200 bg-emerald-50', text: 'text-emerald-950' },
  mistake: { Icon: AlertTriangle, tile: 'border-amber-300 bg-amber-50 text-amber-950', panel: 'border-amber-200 bg-amber-50', text: 'text-amber-950' },
  instead: { Icon: CheckCircle2, tile: 'border-emerald-300 bg-emerald-50 text-emerald-950', panel: 'border-emerald-200 bg-emerald-50', text: 'text-emerald-950' },
  key: { Icon: KeyRound, tile: 'border-indigo-300 bg-indigo-50 text-indigo-950', panel: 'border-indigo-200 bg-indigo-50', text: 'text-indigo-950' },
};

/**
 * The worked example, the common mistake, what to do instead, and then the key idea: each one a card the learner
 * opens, with its content replacing the panel beside them. The key idea unlocks once the others have been opened. The
 * slide's picture stays in the panel until a card is chosen, so the visual is never lost.
 */
function ExampleScreen({ slide, assetBase, done, onDone }: { slide: DeckSlide; assetBase: string | null; done: boolean; onDone: () => void }) {
  const { portrait } = useStage();
  const cards = exampleCards(slide);
  const [state, select] = useRememberedReducer(
    `${slide.n}:e`,
    (s: { open: string | null; seen: string[] }, id: string) => selectItem(s, id),
    (): { open: string | null; seen: string[] } => ({ open: null, seen: [] })
  );
  const progress = exampleProgress(slide, state.seen);
  const finished = progress.done || done;
  const reported = useRef(done);
  const open = cards.find((card) => card.id === state.open) ?? null;

  useEffect(() => {
    if (progress.done && !reported.current) {
      reported.current = true;
      onDone();
    }
  }, [progress.done, onDone]);

  const seen = (id: string) => state.seen.includes(id) || (done && id !== 'key');

  return (
    <section aria-label="Example" className={`grid h-full min-h-0 gap-[1.2em] p-[1.4em] ${portrait ? 'grid-rows-[auto_minmax(0,1fr)]' : 'grid-cols-[minmax(0,4fr)_minmax(0,8fr)]'}`}>
      <div className="flex min-h-0 min-w-0 flex-col justify-center gap-[0.8em]">
        <div className="space-y-[0.4em]">
          <Tag tone="emerald">Explore the example</Tag>
          <h2 id={`slide-${slide.n}-example`} tabIndex={-1} className={`font-semibold leading-tight text-slate-900 outline-none ${portrait ? 'text-[1.2em]' : 'text-[1.6em]'}`}>
            {slide.title}
          </h2>
          <p role="status" className="text-[0.75em] font-medium text-slate-600">
            {finished ? 'All explored' : `Explore ${progress.opened} / ${progress.total}`}
          </p>
        </div>
        <ul className="space-y-[0.5em]" aria-label="Cards to open">
          {cards.map((card) => {
            const style = CARD_STYLE[card.id];
            const locked = card.id === 'key' && !progress.keyUnlocked && !done;
            const isOpen = state.open === card.id;

            return (
              <li key={card.id}>
                <button
                  type="button"
                  disabled={locked}
                  aria-pressed={isOpen}
                  onClick={() => select(card.id)}
                  className={`flex min-h-[3em] w-full items-center gap-[0.7em] rounded-[0.9em] border-2 px-[0.9em] py-[0.5em] text-left text-[1em] font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 ${
                    locked ? 'cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400' : isOpen ? `${style.tile} shadow-md ring-2 ring-indigo-500` : seen(card.id) ? style.tile : 'border-slate-300 bg-white text-slate-900 hover:border-indigo-400'
                  }`}
                >
                  {locked ? <Lock className="h-[1.1em] w-[1.1em] shrink-0" aria-hidden="true" /> : <style.Icon className="h-[1.1em] w-[1.1em] shrink-0" aria-hidden="true" />}
                  <span className="flex-1">{card.label}</span>
                  {seen(card.id) && !isOpen ? <CheckCircle2 className="h-[1em] w-[1em] shrink-0 text-emerald-600" aria-label="Opened" /> : null}
                </button>
              </li>
            );
          })}
        </ul>
        <CompletedSlot show={progress.done}>{state.seen.includes('key') || !cards.some((c) => c.id === 'key') ? null : 'Open the key idea to finish.'}</CompletedSlot>
      </div>

      <div aria-live="polite" className="flex min-h-0 min-w-0 flex-col justify-center">
        {open ? (
          <div key={open.id} className={`flex min-h-0 flex-1 flex-col justify-center gap-[0.6em] rounded-[1.1em] border-2 p-[1.4em] ${CARD_STYLE[open.id].panel} ${motion.fadeUp}`}>
            <p className={`flex items-center gap-[0.5em] text-[0.9em] font-semibold ${CARD_STYLE[open.id].text}`}>
              {(() => {
                const I = CARD_STYLE[open.id].Icon;
                return <I className="h-[1.2em] w-[1.2em]" aria-hidden="true" />;
              })()}
              {open.label}
            </p>
            <p className={`leading-snug ${CARD_STYLE[open.id].text} ${open.text.length > 160 ? 'text-[1.35em]' : 'text-[1.7em]'}`}>{open.text}</p>
          </div>
        ) : slide.image ? (
          <div className="min-h-0 flex-1">
            <VisualFigure image={slide.image} assetBase={assetBase} />
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col justify-center gap-[0.6em] rounded-[1.1em] border-2 border-slate-200 bg-slate-50 p-[1.6em]">
            <p className="text-[0.8em] font-semibold uppercase tracking-wider text-slate-500">The idea</p>
            <p className="text-[1.6em] font-medium leading-snug text-slate-900">{slide.content.explanations[0]?.text ?? slide.content.body ?? slide.title}</p>
            <p className="text-[0.85em] text-slate-500">Open the cards on the left to see it in action.</p>
          </div>
        )}
      </div>
    </section>
  );
}

/** The question for the class. The possible answer stays behind a button so the class can talk first. */
function DiscussScreen({ slide, assetBase }: { slide: DeckSlide; assetBase: string | null }) {
  const { portrait } = useStage();
  const [shown, toggle] = useRememberedReducer(`${slide.n}:d`, (s: boolean, action: "toggle") => (action === "toggle" ? !s : s), () => false);
  const d = slide.content.discussion;
  const answer = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (shown) answer.current?.focus({ preventScroll: true });
  }, [shown]);

  if (!d) return null;

  return (
    <div className={`grid h-full min-h-0 gap-[1.2em] p-[1.4em] ${portrait ? 'grid-rows-[auto_minmax(0,1fr)]' : 'grid-cols-[minmax(0,7fr)_minmax(0,5fr)]'}`}>
      <aside aria-label="Discussion" className="flex min-h-0 flex-col justify-center gap-[0.9em] rounded-[1.1em] border border-sky-200 bg-sky-50 p-[1.4em]">
        <div className="flex items-center gap-[0.6em]">
          <Tag tone="sky">
            <MessageCircle className="h-[1em] w-[1em]" aria-hidden="true" />
            Talk about it
          </Tag>
          <span className="text-[0.75em] text-sky-900">Discuss with your teacher</span>
        </div>
        <p className="text-[1.95em] font-medium leading-snug text-sky-950">{d.prompt}</p>
        <div>
          <button
            type="button"
            onClick={() => toggle("toggle")}
            aria-expanded={shown}
            className="inline-flex items-center gap-[0.5em] rounded-[0.7em] border border-sky-300 bg-white px-[1em] py-[0.45em] text-[0.8em] font-semibold text-sky-900 hover:bg-sky-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600"
          >
            {shown ? <EyeOff className="h-[1.1em] w-[1.1em]" aria-hidden="true" /> : <Eye className="h-[1.1em] w-[1.1em]" aria-hidden="true" />}
            {shown ? 'Hide the possible answer' : 'Show a possible answer'}
          </button>
        </div>
        <p ref={answer} tabIndex={-1} hidden={!shown} className="rounded-[0.8em] bg-white p-[0.9em] text-[1.05em] leading-snug text-slate-800 outline-none">
          {d.answer}
        </p>
      </aside>

      <div className="flex min-h-0 flex-col gap-[0.8em]">
        {slide.image && !portrait ? (
          <div className="min-h-0 flex-1">
            <VisualFigure image={slide.image} assetBase={assetBase} />
          </div>
        ) : null}
        <ol className="grid min-h-0 flex-1 auto-rows-fr gap-[0.6em]" aria-label="Think, pair, share">
          {[
            ['Think', 'On your own for a minute.'],
            ['Pair', 'Compare with the person next to you.'],
            ['Share', 'Tell the class what you decided.'],
          ].map(([name, hint], index) => (
            <li key={name} className="flex min-h-0 items-center gap-[0.9em] rounded-[1em] border border-sky-100 bg-white px-[1em] py-[0.5em] shadow-sm">
              <span className="flex h-[2.2em] w-[2.2em] shrink-0 items-center justify-center rounded-full bg-sky-600 text-[0.95em] font-semibold text-white">{index + 1}</span>
              <span className="text-[1.15em] leading-snug">
                <span className="font-semibold text-slate-900">{name}. </span>
                <span className="text-slate-600">{hint}</span>
              </span>
            </li>
          ))}
        </ol>
        <p className="flex items-center gap-[0.4em] text-[0.65em] text-slate-500">
          <Users className="h-[1em] w-[1em]" aria-hidden="true" />
          Nothing is marked: this is for talking.
        </p>
      </div>
    </div>
  );
}
