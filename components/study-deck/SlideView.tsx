'use client';

import { useCallback, type CSSProperties, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, ChevronRight, Link2 } from 'lucide-react';

import { assetUrl, outlineOf, relatedConcepts, stageLabel, topicOfSlide } from '@/lib/study-deck/deck';
import { dockTabs, explanationInline } from '@/lib/study-deck/explain';
import { exampleKey, interactionKey } from '@/lib/study-deck/interactions';
import { conceptStatus, type DeckProgress, type ResultInput } from '@/lib/study-deck/progress';
import { layoutOf, usesBleed, type LayoutKind, type StepKind } from '@/lib/study-deck/stage';
import { backdropSlideOf, backdropUrl, THEMES, themeForTopic, themeOf } from '@/lib/study-deck/theme';
import type { DeckImage, DeckSlide, StudyDeck } from '@/lib/study-deck/types';
import { ExplainDock } from './ExplainDock';
import { ExploreView } from './ExploreView';
import { HotspotsView } from './HotspotsView';
import { MatchView } from './MatchView';
import { OrderView } from './OrderView';
import { ScenarioView } from './ScenarioView';
import { Eyebrow, GlyphIcon, SlideStage, TONES, useStage, VisualFigure } from './stage-ui';

export interface SlideViewProps {
  deck: StudyDeck;
  slide: DeckSlide;
  /** Which screen of the slide: see lib/study-deck/stage.ts. */
  step: StepKind;
  progress: DeckProgress;
  assetBase: string | null;
  onResult: (key: string, result: ResultInput, conceptId: number | null, questionId: number | null) => void;
  onGoto: (n: number) => void;
  /** Moves on to the next screen: the cover's Start button. */
  onNext: () => void;
}

const EXPLORED: ResultInput = { correct: null, score: null, maxScore: null };

/**
 * One screen of a slide, drawn as a presentation slide. The same slide data the PPT is built from decides the
 * composition (see `layoutOf`): a diagram with its hotspots, a picture beside its explanation, three cards, a
 * statement with the concept's neighbours, a connection between two ideas, a decision, discovery cards - then,
 * and the worked example, common mistake and question for the class, in the panel behind the slide's own button.
 *
 * Every slide is drawn on its topic's colour family (see lib/study-deck/theme.ts) with the slide number in the corner.
 * Everything fits the stage: nothing here scrolls, and the canvas it is drawn on shrinks text before it overflows.
 */
export function SlideView(props: SlideViewProps) {
  const { deck, slide, progress, onResult } = props;
  const layout = layoutOf(slide);
  const tabs = dockTabs(slide, layout);
  const theme = themeOf(deck, slide);
  const dockDone = Boolean(progress.activities[exampleKey(slide)]?.done);
  const dockDoneNow = useCallback(
    () => onResult(exampleKey(slide), EXPLORED, slide.taught_concept_ids[0] ?? null, null),
    [onResult, slide]
  );
  const { portrait } = useStage();
  const bleed = usesBleed(slide, portrait);
  // A photograph behind the slide: its own when the slide is made of one, else the nearest suitable photograph of its topic, faint.
  const behind = bleed ? slide.image : (deck.slides.find((s) => s.n === backdropSlideOf(deck, slide))?.image ?? null);
  const photo = layout === 'cover' || !behind ? null : { src: assetUrl(behind.url, props.assetBase), led: bleed };
  const stage = { theme, number: slide.n, count: deck.slides.length, bare: layout === 'cover', photo };

  // No panel when the slide has nothing beyond its main picture (the cover; a slide with no explanation at all). The
  // number badge takes the bottom-right corner, so the slide keeps a little room under it.
  if (tabs.length === 0) {
    return (
      <SlideStage {...stage}>
        <div data-fit={layout === 'cover' ? undefined : true} className={`h-full ${layout === 'cover' ? '' : 'overflow-hidden pb-[1.8em]'}`}>
          <SlideLayout {...props} layout={layout} bleed={bleed} />
        </div>
      </SlideStage>
    );
  }

  return (
    <SlideStage {...stage}>
      <div className="relative flex h-full min-h-0 flex-col">
        <div data-fit className="min-h-0 flex-1 overflow-hidden">
          <SlideLayout {...props} layout={layout} bleed={bleed} />
        </div>
        <ExplainDock key={slide.n} deck={deck} slide={slide} layout={layout} tabs={tabs} done={dockDone} onDone={dockDoneNow} />
      </div>
    </SlideStage>
  );
}

function SlideLayout({ deck, slide, progress, assetBase, onResult, onGoto, onNext, layout, bleed = false }: SlideViewProps & { layout: LayoutKind; bleed?: boolean }) {
  const exploredKey = interactionKey(slide);
  const memoryKey = exploredKey;
  const exploredDone = Boolean(progress.activities[exploredKey]?.done);
  const explored = useCallback(
    () => onResult(exploredKey, EXPLORED, slide.taught_concept_ids[0] ?? null, null),
    [onResult, exploredKey, slide.taught_concept_ids]
  );

  const interaction = slide.interaction;
  const lead = <Lead deck={deck} slide={slide} large={layout === 'statement'} inline={explanationInline(layout)} wide={layout === 'visual-hotspots'} />;

  switch (layout) {
    case 'cover':
      return <CoverScreen deck={deck} slide={slide} assetBase={assetBase} onStart={onNext} />;
    case 'visual-hotspots':
      return interaction?.kind === 'hotspots' && slide.image ? (
        <HotspotsView interaction={interaction} image={slide.image} assetBase={assetBase} done={exploredDone} onDone={explored} lead={lead} memoryKey={memoryKey} />
      ) : null;
    case 'scenario':
      return interaction?.kind === 'scenario' ? (
        <ScenarioView interaction={interaction} done={exploredDone} onDone={explored} lead={lead} memoryKey={memoryKey} image={slide.image} assetBase={assetBase} />
      ) : null;
    case 'explore':
      return interaction && 'items' in interaction && interaction.kind !== 'order' ? (
        <ExploreView interaction={interaction} done={exploredDone} onDone={explored} lead={lead} image={slide.image} assetBase={assetBase} memoryKey={memoryKey} bleed={bleed} />
      ) : null;
    case 'match':
      return interaction?.kind === 'match' ? (
        <MatchView interaction={interaction} done={exploredDone} onDone={explored} lead={lead} memoryKey={memoryKey} image={slide.image} assetBase={assetBase} />
      ) : null;
    case 'order':
      return interaction?.kind === 'order' ? (
        <OrderView interaction={interaction} done={exploredDone} onDone={explored} lead={lead} memoryKey={memoryKey} image={slide.image} assetBase={assetBase} />
      ) : null;
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

/**
 * Where this is and the title. The explanation of each concept the slide teaches is behind the slide's "Explain this
 * concept" button (see ExplainDock); it stays here only where it IS the slide (a bare statement). A slide that has no
 * concept explanation (the hook, the objectives) states its own text here.
 */
function Lead({ deck, slide, large = false, inline = false, wide = false }: { deck: StudyDeck; slide: DeckSlide; large?: boolean; inline?: boolean; wide?: boolean }) {
  const { portrait } = useStage();
  const c = slide.content;
  const topic = topicOfSlide(deck, slide);
  const names = slide.taught_concept_ids.map((id) => deck.concepts[String(id)]?.name).filter((x): x is string => Boolean(x));
  // The title sits beside an icon badge in the topic's colour, as in a slide deck: the icon is chosen from the slide's own words.
  const size = portrait ? 'text-[1.45em]' : wide ? 'text-[2.2em]' : 'text-[1.9em]';

  return (
    <div className="space-y-[0.5em]">
      <Eyebrow>{stageLabel(slide.slide_type)}</Eyebrow>
      <div className="flex items-center gap-[0.65em]">
        <span aria-hidden="true" className={`flex shrink-0 items-center justify-center rounded-[0.9em] bg-sd-accent text-white shadow-[0_0.2em_0.7em_rgba(15,23,42,0.25)] ${portrait ? 'h-[2.3em] w-[2.3em]' : wide ? 'h-[2.7em] w-[2.7em]' : 'h-[2.4em] w-[2.4em]'}`}>
          <GlyphIcon text={`${slide.title} ${names.join(' ')}`} className="h-[55%] w-[55%]" />
        </span>
        <h2 id={`slide-${slide.n}-title`} tabIndex={-1} className={`min-w-0 font-extrabold leading-[1.1] tracking-tight text-sd-strong outline-none ${size}`}>
          {slide.title}
        </h2>
      </div>
      {topic ? (
        <p className="text-[0.72em] text-slate-600">
          {topic.name}
          {names.length > 0 ? (
            <>
              <span aria-hidden="true"> › </span>
              <span className="sr-only">, concept: </span>
              <span className="font-semibold text-slate-800">{names.join(' and ')}</span>
            </>
          ) : null}
        </p>
      ) : null}
      {c.explanations.length > 0 ? (
        inline ? (
          <div className="space-y-[0.5em]">
            {c.explanations.map((e) => (
              <div key={e.concept_id} className="rounded-[0.9em] border border-white/70 border-l-[0.3em] border-l-sd-accent bg-white/85 px-[1em] py-[0.7em] shadow-[0_0.2em_0.9em_rgba(15,23,42,0.12)]">
                {slide.taught_concept_ids.length > 1 ? <p className="mb-[0.15em] text-[0.62em] font-semibold text-sd-strong">{deck.concepts[String(e.concept_id)]?.name}</p> : null}
                <p className={`leading-snug text-slate-900 ${large && !portrait ? 'text-[1.4em]' : 'text-[1.08em]'}`}>{e.text}</p>
              </div>
            ))}
          </div>
        ) : null
      ) : c.body ? (
        <p className={`rounded-[0.9em] border border-white/70 border-l-[0.3em] border-l-sd-accent bg-white/85 px-[1em] py-[0.7em] leading-snug text-slate-800 shadow-[0_0.2em_0.9em_rgba(15,23,42,0.12)] ${large && !portrait ? 'text-[1.4em]' : 'text-[1.12em]'}`}>{c.body}</p>
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
        <li key={b} className="flex items-center gap-[0.6em] rounded-[0.7em] border border-sd-line bg-white/90 px-[0.7em] py-[0.4em] text-[0.9em] text-slate-800 shadow-sm">
          <span className="flex h-[1.6em] w-[1.6em] shrink-0 items-center justify-center rounded-full bg-sd-accent text-[0.8em] font-bold text-white">{index + 1}</span>
          {b}
        </li>
      ))}
    </ul>
  );
}

/** The three-card explanation: one big numbered, colour-coded card per point. */
function NumberedCards({ items, stacked = false }: { items: string[]; stacked?: boolean }) {
  const { portrait } = useStage();
  const cols = stacked || portrait ? 'grid-cols-1' : items.length === 2 ? 'grid-cols-2' : items.length >= 4 ? 'grid-cols-4' : 'grid-cols-3';

  return (
    <ul className={`grid min-h-0 flex-1 content-center gap-[1em] ${stacked ? 'auto-rows-fr' : ''} ${cols}`}>
      {items.map((item, index) => {
        const tone = TONES[index % TONES.length];

        return (
          <li key={item} className={`relative flex min-h-[10em] flex-col justify-center gap-[0.7em] overflow-hidden rounded-[1.1em] border-2 p-[1.2em] shadow-[0_0.2em_0.8em_rgba(15,23,42,0.1)] ${tone.card.replace(/hover:\S+/, '')}`}>
            <span className={`flex h-[2.6em] w-[2.6em] items-center justify-center rounded-[0.8em] text-white shadow-sm ${tone.dot}`}>
              <GlyphIcon text={item} className="h-[1.4em] w-[1.4em]" />
            </span>
            <span className={`text-[1.45em] font-semibold leading-snug ${tone.text}`}>{item}</span>
            <span aria-hidden="true" className="pointer-events-none absolute -bottom-[0.2em] right-[0.2em] text-[4.5em] font-extrabold leading-none text-slate-900/[0.06]">
              {index + 1}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** Small links to the ideas this one builds on or connects to. */
function Connections({ deck, slide, onGoto }: { deck: StudyDeck; slide: DeckSlide; onGoto: (n: number) => void }) {
  const related = relatedConcepts(deck, slide);
  if (related.length === 0) return null;

  return (
    <div className="mt-auto flex flex-wrap items-center gap-[0.4em]" aria-label="How this connects">
      <Link2 className="h-[0.9em] w-[0.9em] text-sd-strong" aria-hidden="true" />
      {related.slice(0, 3).map((r) =>
        r.slide !== null && r.slide !== slide.n ? (
          <button
            key={r.concept.id}
            type="button"
            onClick={() => onGoto(r.slide as number)}
            className="inline-flex items-center gap-[0.3em] rounded-full border border-sd-line bg-white px-[0.7em] py-[0.15em] text-[0.68em] font-medium text-slate-800 shadow-sm hover:border-sd-accent hover:text-sd-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-sd-accent"
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
        className={`block rounded-[0.9em] border-2 px-[0.9em] py-[0.55em] text-[0.95em] font-semibold leading-snug shadow-sm ${
          tone === 'here' ? 'border-sd-accent bg-sd-accent text-white' : 'border-sd-line bg-white text-slate-800 hover:border-sd-accent'
        }`}
      >
        {label}
      </span>
    );

    return go !== null && go !== slide.n ? (
      <button key={key} type="button" onClick={() => onGoto(go)} className="block w-full text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-sd-accent">
        {body}
      </button>
    ) : (
      <div key={key}>{body}</div>
    );
  };

  return (
    <div className="flex min-h-0 flex-col justify-center-safe gap-[0.5em] rounded-[1.1em] border border-sd-line bg-white/80 p-[1.1em] shadow-[0_0.2em_0.8em_rgba(15,23,42,0.08)]" aria-label="Where this idea sits">
      <p className="text-[0.62em] font-bold uppercase tracking-wider text-sd-strong">Where this idea sits</p>
      {before.map((r) => (
        <div key={r.concept.id} className="space-y-[0.2em]">
          <p className="text-[0.62em] text-slate-600">Builds on</p>
          {node(r.concept.name, `b${r.concept.id}`, r.slide, 'plain')}
          <p className="text-center text-sd-accent" aria-hidden="true">
            ↓
          </p>
        </div>
      ))}
      {here.map((c) => (
        <div key={c.id} className="space-y-[0.2em]">
          <p className={`text-[0.62em] font-semibold ${conceptStatus(deck, progress, c.id).taught ? 'text-emerald-800' : 'text-sd-strong'}`}>
            {conceptStatus(deck, progress, c.id).taught ? 'You are here' : 'This idea'}
          </p>
          {node(c.name, `h${c.id}`, null, 'here')}
        </div>
      ))}
      {after.map((r) => (
        <div key={r.concept.id} className="space-y-[0.2em]">
          <p className="text-center text-sd-accent" aria-hidden="true">
            ↓
          </p>
          <p className="text-[0.62em] text-slate-600">Connects to</p>
          {node(r.concept.name, `a${r.concept.id}`, r.slide, 'plain')}
        </div>
      ))}
    </div>
  );
}

/** The chapter's topics as numbered cards, each in its own topic colour. */
function TopicList({ deck, onGoto, onDark = false }: { deck: StudyDeck; onGoto: (n: number) => void; onDark?: boolean }) {
  const topics = outlineOf(deck);

  return (
    <ol className="grid h-full min-h-0 auto-rows-fr gap-[0.55em]" aria-label="The chapter in topics">
      {topics.map((topic, index) => {
        const first = topic.concepts[0]?.taughtOn[0];
        const t = themeForTopic(index);
        const style = { '--sd-accent': t.accent, '--sd-strong': t.strong, '--sd-soft': t.soft, '--sd-line': t.line } as CSSProperties;

        return (
          <li key={topic.topicId} className="min-h-0" style={style}>
            <button
              type="button"
              disabled={first === undefined}
              onClick={() => first !== undefined && onGoto(first)}
              className={`group flex h-full w-full items-center gap-[0.8em] rounded-[0.9em] border px-[0.7em] text-left text-[0.88em] font-semibold text-slate-900 transition hover:-translate-y-[0.05em] hover:border-sd-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-sd-accent ${
                onDark ? 'border-white/60 bg-white/95 shadow-[0_0.2em_0.9em_rgba(2,6,23,0.35)]' : 'border-sd-line bg-white/90 shadow-[0_0.15em_0.6em_rgba(15,23,42,0.1)]'
              }`}
            >
              <span className="flex h-[2.1em] w-[2.1em] shrink-0 items-center justify-center rounded-[0.7em] bg-sd-accent text-[0.9em] font-extrabold text-white">{index + 1}</span>
              <span className="flex-1 leading-tight">{topic.name}</span>
              <span className="shrink-0 rounded-full bg-sd-soft px-[0.7em] py-[0.1em] text-[0.72em] font-semibold text-sd-strong">{topic.concepts.length} ideas</span>
              <ChevronRight className="h-[1em] w-[1em] shrink-0 text-sd-accent transition group-hover:translate-x-[0.1em]" aria-hidden="true" />
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

/** Who made the cover picture, small in the corner (a photograph always carries its credit). */
function CoverCredit({ image }: { image: DeckImage }) {
  if (image.type !== 'photo' || !image.source_url) return null;

  return (
    <p className="absolute bottom-[0.8em] left-[1.4em] z-20 max-w-[60%] truncate rounded-full bg-slate-950/55 px-[0.9em] py-[0.2em] text-[0.55em] text-white">
      Photo: {image.creator ?? 'Openverse'}, {image.licence}{' '}
      <a href={image.source_url} target="_blank" rel="noreferrer noopener" className="font-semibold underline">
        Source
      </a>
    </p>
  );
}

/**
 * The opening screen, kept simple: the chapter's own micrograph edge to edge under a deep blue-teal wash that fades toward
 * the right so the picture shows, the chapter number and title large, the standard and subject, one line of what the
 * chapter is about and a Start button. Nothing to answer, nothing to explore: it only lets the student begin.
 */
function CoverScreen({ deck, slide, assetBase, onStart }: { deck: StudyDeck; slide: DeckSlide; assetBase: string | null; onStart: () => void }) {
  const { portrait } = useStage();
  const image = slide.image;
  const number = deck.chapter.number;

  return (
    <div className="relative h-full overflow-hidden bg-[#172554] text-white">
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element -- deck images are our own stored files or local review copies
        <img src={assetUrl(image.url, assetBase)} alt={image.alt} className="absolute inset-0 h-full w-full object-cover" />
      ) : null}
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background: portrait
            ? 'linear-gradient(180deg, rgba(23,37,84,0.94) 0%, rgba(30,58,138,0.84) 60%, rgba(15,118,110,0.7) 100%)'
            : 'linear-gradient(100deg, rgba(23,37,84,0.96) 0%, rgba(30,58,138,0.88) 42%, rgba(30,58,138,0.35) 74%, rgba(15,118,110,0.18) 100%)',
        }}
      />
      <div aria-hidden="true" className="absolute inset-0" style={{ backgroundImage: backdropUrl('cells', '#ffffff'), backgroundSize: portrait ? 'auto 100%' : '100% 100%', backgroundRepeat: 'no-repeat', backgroundPosition: 'right top' }} />
      <div aria-hidden="true" className="absolute inset-x-0 top-0 z-10 h-[0.32em]" style={{ background: `linear-gradient(90deg, ${THEMES.blue.accent}, ${THEMES.teal.accent}, ${THEMES.purple.accent}, ${THEMES.cyan.accent}, ${THEMES.amber.accent})` }} />

      <div className={`relative z-10 flex h-full min-h-0 flex-col justify-center-safe gap-[0.9em] ${portrait ? 'p-[1.6em]' : 'w-[58%] p-[3em]'}`}>
        <p className="inline-flex w-fit items-center gap-[0.7em] text-[0.85em] font-semibold text-sky-100">
          <span>Standard {deck.chapter.standard_name}</span>
          <span aria-hidden="true" className="h-[1.1em] w-px bg-sky-200/60" />
          <span>{deck.chapter.subject_name}</span>
        </p>
        <div>
          {number ? <p className={`font-extrabold tracking-tight text-cyan-300 ${portrait ? 'text-[1.5em]' : 'text-[2.2em]'}`}>Chapter {number}</p> : null}
          <h2 id={`slide-${slide.n}-title`} tabIndex={-1} className={`font-extrabold leading-[1.05] tracking-tight text-white outline-none ${portrait ? 'text-[2em]' : 'text-[3.2em]'}`}>
            {deck.chapter.name}
          </h2>
        </div>
        {slide.content.body ? <p className={`leading-snug text-sky-50 ${portrait ? 'text-[1em]' : 'text-[1.25em]'}`}>{slide.content.body}</p> : null}
        <button
          type="button"
          onClick={onStart}
          className="mt-[0.4em] inline-flex w-fit items-center gap-[0.6em] rounded-full bg-sky-100 px-[1.6em] py-[0.7em] text-[1em] font-bold text-[#172554] shadow-[0_0.3em_1em_rgba(2,6,23,0.35)] transition hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          Start lesson <ArrowRight className="h-[1.1em] w-[1.1em]" aria-hidden="true" />
        </button>
      </div>
      {image ? <CoverCredit image={image} /> : null}
    </div>
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

  const node = (name: string, id: number, tone: number) => {
    const go = slideOf(id);
    const t = TONES[tone];
    const body = (
      <span className={`flex min-h-[7em] flex-col items-center justify-center gap-[0.5em] rounded-[1.1em] border-2 px-[1em] py-[1.2em] text-center shadow-[0_0.2em_0.8em_rgba(15,23,42,0.12)] ${t.card.replace(/hover:\S+/, '')}`}>
        <span className={`flex h-[2.6em] w-[2.6em] items-center justify-center rounded-[0.8em] text-white ${t.dot}`}>
          <GlyphIcon text={name} className="h-[1.4em] w-[1.4em]" />
        </span>
        <span className={`text-[1.5em] font-bold leading-snug ${t.text}`}>{name}</span>
      </span>
    );

    return go !== null && go !== slide.n ? (
      <button type="button" onClick={() => onGoto(go)} className="block w-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-sd-accent">
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
          {node(from.name, from.id, 0)}
          <div className="flex flex-col items-center gap-[0.3em] text-center">
            <span className="rounded-full bg-sd-soft px-[0.9em] py-[0.2em] text-[0.7em] font-bold uppercase tracking-wider text-sd-strong">{RELATION_WORD[rel.kind] ?? 'is connected to'}</span>
            <span className="flex h-[2.4em] w-[2.4em] items-center justify-center rounded-full bg-sd-accent text-[1.2em] leading-none text-white shadow-md" aria-hidden="true">
              {portrait ? '↓' : '→'}
            </span>
          </div>
          {node(to.name, to.id, 1)}
        </div>
      ) : null}
      {slide.content.relationship_note ? (
        <p className="mb-[0.2em] rounded-r-[0.9em] border-l-[0.3em] border-sd-accent bg-white/85 px-[1em] py-[0.7em] text-[1.05em] leading-snug text-slate-800 shadow-sm">
          <Link2 className="mr-[0.4em] inline h-[1em] w-[1em] text-sd-accent" aria-hidden="true" />
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
      <ul className={`grid min-h-0 content-start gap-[0.7em] ${portrait ? 'grid-cols-1' : 'grid-cols-4'}`} aria-label="The chapter at a glance">
        {topics.map((topic, index) => {
          const t = themeForTopic(index);

          return (
            <li key={topic.topicId} className="flex min-h-0 flex-col overflow-hidden rounded-[0.9em] border bg-white/90 shadow-[0_0.15em_0.6em_rgba(15,23,42,0.1)]" style={{ borderColor: t.line }}>
              <p className="px-[0.7em] py-[0.45em] text-[0.95em] font-bold leading-tight text-white" style={{ background: t.accent }}>
                {index + 1}. {topic.name}
              </p>
              <div className="flex flex-wrap content-start gap-[0.3em] p-[0.6em]">
                {topic.concepts.map(({ concept, taughtOn }) => {
                  const done = conceptStatus(deck, progress, concept.id).taught;

                  return (
                    <button
                      key={concept.id}
                      type="button"
                      disabled={taughtOn[0] === undefined || taughtOn[0] === slide.n}
                      onClick={() => taughtOn[0] !== undefined && onGoto(taughtOn[0])}
                      className={`rounded-full border px-[0.55em] py-[0.08em] text-[0.64em] leading-tight focus-visible:outline focus-visible:outline-2 focus-visible:outline-sd-accent ${
                        done ? 'border-emerald-300 bg-emerald-50 text-emerald-900' : 'border-slate-300 bg-white text-slate-700'
                      }`}
                    >
                      {concept.name}
                    </button>
                  );
                })}
              </div>
            </li>
          );
        })}
      </ul>
    </Frame>
  );
}
