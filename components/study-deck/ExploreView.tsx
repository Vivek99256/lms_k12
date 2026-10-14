'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { ArrowRight, CheckCircle2, Columns2, History, Layers, Lightbulb, MousePointerClick } from 'lucide-react';

import { INTERACTION_HEADING, itemsProgress, nextItem, selectItem } from '@/lib/study-deck/interactions';
import type { DeckImage, ExploreItem, ItemsInteraction } from '@/lib/study-deck/types';
import { CompletedSlot, GlyphIcon, motion, PANEL, PhotoCredit, Tag, TONES, useRememberedReducer, useStage, VisualFigure } from './stage-ui';

export interface ExploreViewProps {
  interaction: ItemsInteraction;
  done: boolean;
  /** Called once, when every item has been opened. */
  onDone: () => void;
  /** The slide's title and explanation. */
  lead: ReactNode;
  /** A picture the slide also carries, kept beside the items. */
  image?: DeckImage | null;
  assetBase: string | null;
  /** Where this screen's state is kept for the session. */
  memoryKey: string;
  /** The slide's photograph is the background of the whole slide (see `usesBleed`): the items go in a translucent panel over it. */
  bleed?: boolean;
}

const ICON = { reveal: Lightbulb, steps: Layers, timeline: History, compare: Columns2 } as const;

type State = { open: string | null; seen: string[] };

/** The big faded number behind an idle card: decoration only, so it is drawn with plain styles. */
const WATERMARK = { position: 'absolute', right: '0.25em', bottom: '-0.15em', fontSize: '5em', fontWeight: 700, lineHeight: 1, color: 'rgba(15, 23, 42, 0.06)' } as const;

/**
 * Items opened one at a time, drawn the way the content is shaped:
 *   reveal    cards: select one and its explanation replaces the panel below
 *   steps     a process: numbered steps along a line, with "Next step"
 *   timeline  dated events along an axis
 *   compare   two or three things side by side, then how they compare
 *
 * The explanation always appears INSIDE the slide (a panel, or the card itself) and never pushes anything below the
 * fold. Nothing is scored; the screen says "All ideas explored" when everything has been opened.
 */
export function ExploreView({ interaction, done, onDone, lead, image = null, assetBase, memoryKey, bleed = false }: ExploreViewProps) {
  const { portrait } = useStage();
  const [state, select] = useRememberedReducer(memoryKey, (s: State, id: string) => selectItem(s, id), (): State => ({ open: null, seen: [] }));
  const progress = itemsProgress(interaction, state.seen);
  const finished = progress.done || done;
  const reported = useRef(done);
  const { kind, items } = interaction;
  const open = items.find((item) => item.id === state.open) ?? null;
  const Icon = ICON[kind as keyof typeof ICON] ?? Lightbulb;
  const withImage = Boolean(image);

  useEffect(() => {
    if (progress.done && !reported.current) {
      reported.current = true;
      onDone();
    }
  }, [progress.done, onDone]);

  const seen = (id: string) => state.seen.includes(id) || done;

  const status = (
    <div className="space-y-[0.4em]">
      <div className="flex flex-wrap items-center gap-[0.6em]">
        <Tag>
          <Icon className="h-[1em] w-[1em]" aria-hidden="true" />
          {INTERACTION_HEADING[kind]}
        </Tag>
        <span role="status" className="text-[0.72em] font-medium text-slate-600">
          {finished ? 'All explored' : `Explore ${progress.opened} / ${progress.total}`}
        </span>
      </div>
      <p className="text-[0.75em] text-slate-600">{interaction.intro}</p>
    </div>
  );

  const detail = (
    <div
      aria-live="polite"
      className={`flex min-h-0 flex-col justify-center-safe rounded-[1em] border-2 p-[1em] ${open ? 'border-sd-line bg-sd-softer' : 'border-dashed border-slate-300 bg-slate-50'}`}
    >
      {open ? (
        <div key={open.id} className={motion.fadeUp}>
          {open.when ? <p className="text-[0.7em] font-semibold uppercase tracking-wider text-sd-strong">{open.when}</p> : null}
          <h3 className="text-[1.15em] font-semibold text-slate-900">{open.label}</h3>
          <p className="mt-[0.3em] text-[1.1em] leading-snug text-slate-800">{open.text}</p>
          {kind === 'steps' && nextItem(interaction, open.id) ? (
            <button
              type="button"
              onClick={() => select(nextItem(interaction, open.id) as string)}
              className="mt-[0.6em] inline-flex items-center gap-[0.4em] rounded-[0.6em] bg-sd-accent px-[0.9em] py-[0.35em] text-[0.8em] font-semibold text-white hover:bg-sd-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sd-accent"
            >
              Next step
              <ArrowRight className="h-[1em] w-[1em]" aria-hidden="true" />
            </button>
          ) : null}
        </div>
      ) : (
        <p className="text-center text-[0.9em] text-slate-500">
          {kind === 'steps' ? 'Select a step to see what happens.' : kind === 'timeline' ? 'Select an event to see what happened.' : 'Select one to see its explanation.'}
        </p>
      )}
    </div>
  );

  const doneBanner = <CompletedSlot show={finished}>{kind === 'compare' ? null : interaction.wrapup}</CompletedSlot>;

  // The photograph is the slide: the title and the items on a translucent panel at the left, the photograph clear on the
  // right, and the opened item on a second translucent panel over its lower part. Nothing on the photograph can be pressed,
  // so a panel can never cover a control.
  if (bleed && image && !portrait) {
    return (
      <section aria-label={INTERACTION_HEADING[kind]} className="relative grid h-full min-h-0 grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-[1.4em] p-[1.4em]">
        <div className={`${PANEL} flex min-h-0 min-w-0 flex-col justify-center-safe gap-[0.8em] p-[1.2em]`}>
          {lead}
          {status}
          <ul className="space-y-[0.3em]" aria-label="Items to explore">
            {items.map((item, index) => (
              <li key={item.id}>
                <button
                  type="button"
                  aria-pressed={state.open === item.id}
                  onClick={() => select(item.id)}
                  className={`flex w-full items-center gap-[0.55em] rounded-[0.7em] border px-[0.6em] py-[0.35em] text-left text-[0.82em] shadow-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-sd-accent ${
                    state.open === item.id ? 'border-sd-accent bg-sd-soft font-semibold text-sd-strong' : 'border-sd-line bg-white text-slate-800 hover:border-sd-accent'
                  }`}
                >
                  <span className="flex h-[1.5em] w-[1.5em] shrink-0 items-center justify-center rounded-full bg-sd-accent text-[0.85em] font-bold tabular-nums text-white">{index + 1}</span>
                  <span className="flex-1">{item.label}</span>
                  {seen(item.id) ? <CheckCircle2 className="h-[1.1em] w-[1.1em] shrink-0 text-emerald-600" aria-label="Opened" /> : null}
                </button>
              </li>
            ))}
          </ul>
          {doneBanner}
        </div>
        <div className="relative min-h-0 min-w-0">
          {open ? (
            <div role="region" aria-label={open.label} aria-live="polite" className={`${PANEL} absolute inset-x-[2%] bottom-[2.2em] z-20 border-l-[0.35em] border-l-sd-accent p-[1em] ${motion.fadeUp}`}>
              {open.when ? <p className="text-[0.7em] font-semibold uppercase tracking-wider text-sd-strong">{open.when}</p> : null}
              <h3 className="text-[1.15em] font-bold text-slate-900">{open.label}</h3>
              <p className="mt-[0.25em] text-[1em] leading-snug text-slate-800">{open.text}</p>
            </div>
          ) : (
            <p className={`${PANEL} absolute bottom-[2.2em] left-[2%] z-20 inline-flex px-[1em] py-[0.5em] text-[0.8em] font-medium text-slate-700`}>Select an item to read about it.</p>
          )}
          <PhotoCredit image={image} className="absolute bottom-0 left-[2%] z-20" />
        </div>
      </section>
    );
  }

  // A picture on a narrow screen: the picture right after the title, the items as a row of numbered names under it and the
  // explanation in its own panel under those (never over the picture).
  if (withImage && image && portrait) {
    return (
      <section aria-label={INTERACTION_HEADING[kind]} className="flex h-full min-h-0 flex-col gap-[0.6em] p-[1.1em]">
        {lead}
        <div className="min-h-0 flex-1">
          <VisualFigure image={image} assetBase={assetBase} />
        </div>
        <ul className="flex flex-wrap gap-[0.35em]" aria-label="Items to explore">
          {items.map((item, index) => (
            <li key={item.id}>
              <button
                type="button"
                aria-pressed={state.open === item.id}
                onClick={() => select(item.id)}
                className={`inline-flex items-center gap-[0.4em] rounded-full border px-[0.6em] py-[0.2em] text-[0.72em] font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-sd-accent ${
                  state.open === item.id ? 'border-sd-accent bg-sd-soft text-sd-strong' : 'border-sd-line bg-white/90 text-slate-800'
                }`}
              >
                {seen(item.id) ? <CheckCircle2 className="h-[1.1em] w-[1.1em] shrink-0 text-emerald-600" aria-label="Opened" /> : <span className="text-slate-500">{index + 1}</span>}
                {item.label}
              </button>
            </li>
          ))}
        </ul>
        <div role="region" aria-label="Explanation" aria-live="polite" className={`min-h-[4.6em] rounded-[0.9em] border-2 p-[0.7em] ${open ? 'border-sd-accent bg-white shadow-md' : 'border-dashed border-sd-line bg-white/60'}`}>
          {open ? (
            <div key={open.id} className={motion.fadeUp}>
              <h3 className="text-[1.05em] font-semibold text-slate-900">{open.label}</h3>
              <p className="mt-[0.2em] text-[0.9em] leading-snug text-slate-800">{open.text}</p>
            </div>
          ) : (
            <p className="text-[0.8em] text-slate-600">{finished ? interaction.wrapup : 'Select a name to read about it.'}</p>
          )}
        </div>
        {status}
      </section>
    );
  }

  // A picture beside the items: the items are a list on the left, the explanation sits over the picture.
  if (withImage && image) {
    return (
      <section aria-label={INTERACTION_HEADING[kind]} className="grid h-full min-h-0 grid-cols-[minmax(0,4fr)_minmax(0,8fr)] gap-[1.2em] p-[1.4em]">
        <div className="flex min-h-0 min-w-0 flex-col justify-center-safe gap-[0.8em]">
          {lead}
          {status}
          <ul className="space-y-[0.3em]" aria-label="Items to explore">
            {items.map((item, index) => (
              <li key={item.id}>
                <button
                  type="button"
                  aria-pressed={state.open === item.id}
                  onClick={() => select(item.id)}
                  className={`flex w-full items-center gap-[0.5em] rounded-[0.7em] border px-[0.6em] py-[0.35em] text-left text-[0.82em] shadow-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-sd-accent ${
                    state.open === item.id ? 'border-sd-accent bg-sd-soft font-semibold text-sd-strong' : 'border-sd-line bg-white/90 text-slate-800 hover:border-sd-accent'
                  }`}
                >
                  {seen(item.id) ? <CheckCircle2 className="h-[1.1em] w-[1.1em] shrink-0 text-emerald-600" aria-label="Opened" /> : <span className="w-[1.1em] shrink-0 text-center text-slate-500">{index + 1}</span>}
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
          {doneBanner}
        </div>
        <div className="relative min-h-0 min-w-0">
          <VisualFigure image={image} assetBase={assetBase} />
          {open ? (
            <div role="dialog" aria-label={open.label} className={`absolute bottom-[3%] left-[8%] right-[8%] z-20 rounded-[0.9em] border border-sd-line bg-white p-[0.9em] shadow-xl ${motion.fadeUp}`}>
              <h3 className="text-[1.05em] font-semibold text-slate-900">{open.label}</h3>
              <p className="mt-[0.25em] text-[0.95em] leading-snug text-slate-800">{open.text}</p>
            </div>
          ) : null}
        </div>
      </section>
    );
  }

  const tileBase =
    'rounded-[0.9em] border-2 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sd-accent';
  const tone = (item: ExploreItem) =>
    state.open === item.id ? 'border-sd-accent bg-sd-accent text-white shadow-md' : seen(item.id) ? 'border-emerald-300 bg-emerald-50 text-slate-900' : 'border-slate-300 bg-white text-slate-900 hover:border-sd-accent';

  let explorer: ReactNode;
  if (kind === 'compare') {
    const cols = items.length === 3 ? 'grid-cols-3' : 'grid-cols-2';
    explorer = (
      <div className="grid min-h-0 grid-rows-[minmax(0,1fr)_auto] gap-[0.7em]">
        <ul className={`relative grid min-h-0 gap-[0.8em] ${portrait ? 'grid-cols-1' : cols}`}>
          {items.map((item, index) => {
            const t = TONES[index % TONES.length];
            const isOpen = state.open === item.id;
            const showText = isOpen || (finished && seen(item.id));

            return (
              <li key={item.id} className="min-h-0">
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => select(item.id)}
                  className={`${tileBase} relative flex h-full w-full flex-col overflow-hidden text-left shadow-[0_0.2em_0.8em_rgba(15,23,42,0.12)] hover:-translate-y-[0.05em] ${isOpen ? 'border-sd-accent bg-white' : t.card}`}
                >
                  <span className={`flex min-h-[3.4em] items-center gap-[0.6em] px-[1em] py-[0.7em] text-white ${seen(item.id) && !isOpen ? 'bg-emerald-700' : t.dot}`}>
                    {seen(item.id) && !isOpen ? <CheckCircle2 className="h-[1.4em] w-[1.4em] shrink-0" aria-label="Opened" /> : <GlyphIcon text={item.label} className="h-[1.4em] w-[1.4em] shrink-0" />}
                    <span className="text-[1.3em] font-bold leading-tight">{item.label}</span>
                  </span>
                  <span className={`relative flex flex-1 items-center px-[1em] py-[0.8em] ${t.text}`}>
                    {showText ? (
                      <span className={`block text-[1.05em] leading-snug ${motion.fadeUp}`}>{item.text}</span>
                    ) : (
                      <span className="inline-flex items-center gap-[0.4em] rounded-full bg-white/80 px-[0.9em] py-[0.25em] text-[0.8em] font-semibold text-sd-strong shadow-sm">
                        <MousePointerClick className="h-[1.1em] w-[1.1em]" aria-hidden="true" />
                        Select to see it
                      </span>
                    )}
                    {showText ? null : (
                      <span aria-hidden="true" className="pointer-events-none absolute -bottom-[0.1em] right-[0.3em] text-[6em] font-extrabold leading-none text-slate-900/[0.06]">
                        {index + 1}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
          {items.length === 2 && !portrait ? (
            <li aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/2 z-10 flex h-[2.7em] w-[2.7em] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-slate-900 text-[0.85em] font-extrabold text-white ring-[0.25em] ring-white">
              VS
            </li>
          ) : null}
        </ul>
        {finished ? (
          <div className={`rounded-[0.9em] border border-sd-line bg-sd-softer p-[0.8em] text-[1em] leading-snug text-sd-strong ${motion.fadeUp}`}>
            <span className="text-[0.7em] font-semibold uppercase tracking-wider text-sd-strong">How they compare </span>
            <br />
            {interaction.wrapup}
          </div>
        ) : null}
      </div>
    );
  } else if (kind === 'steps' || kind === 'timeline') {
    explorer = (
      <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-[0.9em]">
        <ol className={`relative grid gap-[0.5em] ${portrait ? 'grid-cols-1' : ''}`} style={portrait ? undefined : { gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
          {!portrait ? <span aria-hidden="true" className="absolute left-[3%] right-[3%] top-[2.1em] h-[0.25em] rounded bg-sd-line" /> : null}
          {items.map((item, index) => (
            <li key={item.id} className="relative flex flex-col items-center gap-[0.35em] text-center">
              {kind === 'timeline' ? <span className="text-[0.7em] font-semibold text-sd-strong">{item.when}</span> : <span className="h-[1em]" aria-hidden="true" />}
              <button
                type="button"
                aria-label={item.label}
                aria-pressed={state.open === item.id}
                onClick={() => select(item.id)}
                className={`relative z-10 flex h-[2.4em] w-[2.4em] items-center justify-center rounded-full border-2 text-[1em] font-semibold ${
                  state.open === item.id ? 'scale-110 border-sd-accent bg-sd-accent text-white shadow-md' : seen(item.id) ? 'border-emerald-400 bg-emerald-50 text-emerald-800' : 'border-slate-300 bg-white text-slate-700 hover:border-sd-accent'
                } transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sd-accent`}
              >
                {seen(item.id) && state.open !== item.id ? <CheckCircle2 className="h-[1.2em] w-[1.2em]" aria-hidden="true" /> : index + 1}
              </button>
              <span className={`text-[0.8em] leading-tight ${state.open === item.id ? 'font-semibold text-sd-strong' : 'text-slate-700'}`}>{item.label}</span>
            </li>
          ))}
        </ol>
        {detail}
      </div>
    );
  } else {
    const cols = items.length === 2 || items.length === 4 ? 'grid-cols-2' : items.length === 5 ? 'grid-cols-3' : 'grid-cols-3';
    explorer = (
      <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-[0.8em]">
        <ul className={`grid gap-[0.6em] ${portrait ? 'grid-cols-1' : cols}`}>
          {items.map((item, index) => (
            <li key={item.id}>
              <button type="button" aria-expanded={state.open === item.id} onClick={() => select(item.id)} className={`${tileBase} flex min-h-[3.2em] w-full items-center gap-[0.6em] px-[0.9em] py-[0.6em] ${tone(item)}`}>
                <span className={`flex h-[1.9em] w-[1.9em] shrink-0 items-center justify-center rounded-full text-[0.85em] font-semibold ${state.open === item.id ? 'bg-white text-sd-strong' : seen(item.id) ? 'bg-emerald-600 text-white' : 'bg-sd-accent text-white'}`}>
                  {seen(item.id) && state.open !== item.id ? <CheckCircle2 className="h-[1.1em] w-[1.1em]" aria-label="Opened" /> : index + 1}
                </span>
                <span className="text-[1em] font-semibold leading-tight">{item.label}</span>
              </button>
            </li>
          ))}
        </ul>
        {detail}
      </div>
    );
  }

  // Before anything is opened the items FILL the area as large cards (nothing is left blank). Opening one turns the
  // area into a compact row of tiles with that item's explanation beside them.
  if (kind !== 'compare' && !open) {
    const n = items.length;
    const cols = n === 2 || n === 4 ? 'grid-cols-2' : 'grid-cols-3';
    explorer = (
      <ul className={`grid min-h-0 gap-[0.8em] ${portrait ? 'grid-cols-1 content-start gap-[0.5em]' : `auto-rows-fr ${cols}`}`}>
        {items.map((item, index) => (
          <li key={item.id} className="min-h-0">
            <button
              type="button"
              aria-pressed={false}
              onClick={() => select(item.id)}
              className={`${tileBase} relative flex w-full flex-col items-start justify-center overflow-hidden shadow-sm hover:shadow-md ${
                portrait ? 'min-h-[3.4em] gap-[0.2em] p-[0.6em]' : 'h-full min-h-[4em] gap-[0.6em] p-[1.2em]'
              } ${seen(item.id) ? 'border-emerald-300 bg-emerald-50' : TONES[index % TONES.length].card}`}
            >
              {kind === 'timeline' && item.when ? <span className="text-[0.85em] font-semibold text-sd-strong">{item.when}</span> : null}
              <span className="flex items-center gap-[0.6em]">
                <span className={`flex h-[2.6em] w-[2.6em] shrink-0 items-center justify-center text-[0.95em] font-semibold text-white shadow-sm ${kind === 'reveal' ? 'rounded-[0.8em]' : 'rounded-full'} ${seen(item.id) ? 'bg-emerald-700' : TONES[index % TONES.length].dot}`}>
                  {seen(item.id) ? <CheckCircle2 className="h-[1.3em] w-[1.3em]" aria-label="Opened" /> : kind === 'reveal' ? <GlyphIcon text={item.label} className="h-[1.4em] w-[1.4em]" /> : index + 1}
                </span>
                <span className={`font-semibold leading-tight text-slate-900 ${portrait ? 'text-[1.05em]' : 'text-[1.3em]'}`}>{item.label}</span>
              </span>
              {portrait ? null : <span aria-hidden="true" className="pointer-events-none" style={WATERMARK}>{index + 1}</span>}
              {portrait ? null : <span className="text-[0.75em] font-medium text-sd-strong">{seen(item.id) ? 'Opened. Select to read it again' : kind === 'steps' ? 'Select to see this step' : kind === 'timeline' ? 'Select to see this event' : 'Select to open'}</span>}
            </button>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <section
      aria-label={INTERACTION_HEADING[kind]}
      className={`grid h-full min-h-0 gap-[1.2em] p-[1.4em] ${portrait ? 'grid-rows-[auto_minmax(0,1fr)]' : 'grid-cols-[minmax(0,4.2fr)_minmax(0,7.8fr)]'}`}
    >
      <div className="flex min-h-0 min-w-0 flex-col justify-center-safe gap-[0.9em]">
        {lead}
        {status}
        {doneBanner}
      </div>
      {explorer}
    </section>
  );
}
