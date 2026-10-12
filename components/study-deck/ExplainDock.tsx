'use client';

import { useEffect, useId, useRef, type KeyboardEvent } from 'react';
import { AlertTriangle, CheckCircle2, Eye, EyeOff, KeyRound, Lightbulb, MessageCircle, Users } from 'lucide-react';

import {
  activeTab,
  dockButtonLabel,
  dockExplanations,
  dockReducer,
  examplesExplored,
  initialDock,
  keyIdeaOf,
  type DockTab,
  type DockTabId,
} from '@/lib/study-deck/explain';
import type { LayoutKind } from '@/lib/study-deck/stage';
import type { DeckSlide, StudyDeck } from '@/lib/study-deck/types';
import { motion, useRememberedReducer, useStage } from './stage-ui';

export interface ExplainDockProps {
  deck: StudyDeck;
  slide: DeckSlide;
  layout: LayoutKind;
  tabs: DockTab[];
  /** Whether the slide's example cards were already all opened in an earlier visit. */
  done: boolean;
  /** Called once, when everything the old example screen asked the learner to open has been opened. */
  onDone: () => void;
}

/**
 * The slide's explanation, on the slide.
 *
 * A button along the bottom of the slide ("Explain this concept") opens a panel over the lower part of the SAME
 * screen, and pressing it again closes it. The panel has a tab for each thing the slide has to say beyond its main
 * picture: the explanation of the concept (and its key idea), the worked example, the common mistake with what to do
 * instead, and the question for the class with its possible answer behind a button. It never changes the slide
 * number or the address, and it is drawn over the slide rather than inside it, so the teaching content keeps its size.
 * Opening the example and mistake tabs counts as exploring the example, exactly as the old example screen did.
 */
export function ExplainDock({ deck, slide, layout, tabs, done, onDone }: ExplainDockProps) {
  const { portrait } = useStage();
  const id = useId();
  const [state, dispatch] = useRememberedReducer(`${slide.n}:x`, dockReducer, () => initialDock(tabs));
  const reported = useRef(done);
  const tab = activeTab(tabs, state.tab);
  const explored = examplesExplored(slide, done ? ['example', 'mistake', 'instead'] : state.seen);

  useEffect(() => {
    if (explored && !reported.current) {
      reported.current = true;
      onDone();
    }
  }, [explored, onDone]);

  // Escape closes the panel, the way any popover does.
  useEffect(() => {
    if (!state.open) return;
    const onKey = (event: KeyboardEvent | globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') dispatch({ type: 'close' });
    };
    window.addEventListener('keydown', onKey);

    return () => window.removeEventListener('keydown', onKey);
  }, [state.open, dispatch]);

  const label = dockButtonLabel(tabs);
  const panelId = `${id}-panel`;

  const onTabKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    event.stopPropagation();
    const next = tabs[(index + (event.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
    dispatch({ type: 'tab', tab: next.id });
    requestAnimationFrame(() => document.getElementById(`${id}-tab-${next.id}`)?.focus());
  };

  return (
    <>
      {state.open ? (
        <section
          id={panelId}
          aria-label={`${slide.title}: more on this slide`}
          className={`absolute inset-x-[1.4em] bottom-[3.5em] z-20 flex flex-col overflow-hidden rounded-[1.1em] border-2 border-indigo-200 bg-white shadow-[0_10px_40px_rgba(15,23,42,0.22)] ${
            portrait ? 'max-h-[62%]' : 'max-h-[50%]'
          } ${motion.fadeUp}`}
        >
          <div role="tablist" aria-label="More on this slide" className="flex shrink-0 gap-[0.4em] border-b border-slate-200 bg-slate-50 px-[0.8em] pt-[0.6em]">
            {tabs.map((t, index) => (
              <button
                key={t.id}
                id={`${id}-tab-${t.id}`}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                aria-controls={`${id}-tabpanel`}
                tabIndex={tab === t.id ? 0 : -1}
                onClick={() => dispatch({ type: 'tab', tab: t.id })}
                onKeyDown={(event) => onTabKey(event, index)}
                className={`rounded-t-[0.7em] border border-b-0 px-[0.9em] py-[0.4em] text-[0.8em] font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600 ${
                  tab === t.id ? 'border-slate-200 bg-white text-indigo-900' : 'border-transparent text-slate-600 hover:bg-white/70'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div id={`${id}-tabpanel`} role="tabpanel" aria-labelledby={`${id}-tab-${tab}`} aria-live="polite" className="min-h-0 flex-1 overflow-hidden p-[1em]">
            <TabBody deck={deck} slide={slide} layout={layout} tab={tab} answer={state.answer} onAnswer={() => dispatch({ type: 'answer' })} />
          </div>
        </section>
      ) : null}

      <div className="flex shrink-0 items-center gap-[0.8em] px-[1.4em] pb-[0.8em] pt-[0.1em]">
        <button
          type="button"
          aria-expanded={state.open}
          aria-controls={state.open ? panelId : undefined}
          onClick={() => dispatch({ type: 'toggle' })}
          className="inline-flex items-center gap-[0.5em] rounded-[0.8em] border-2 border-indigo-300 bg-indigo-50 px-[1.1em] py-[0.45em] text-[0.85em] font-semibold text-indigo-900 transition hover:border-indigo-500 hover:bg-indigo-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
        >
          <Lightbulb className="h-[1.15em] w-[1.15em]" aria-hidden="true" />
          {state.open ? 'Hide explanation' : label}
        </button>
        {!state.open && tabs.length > 1 ? <span className="truncate text-[0.7em] text-slate-500">{tabs.map((t) => t.label).join(' · ')}</span> : null}
      </div>
    </>
  );
}

function TabBody({ deck, slide, layout, tab, answer, onAnswer }: { deck: StudyDeck; slide: DeckSlide; layout: LayoutKind; tab: DockTabId; answer: boolean; onAnswer: () => void }) {
  const c = slide.content;

  if (tab === 'explain') {
    const explanations = dockExplanations(slide, layout);
    const key = keyIdeaOf(slide);

    return (
      <div className="grid gap-[0.7em]">
        {explanations.map((e) => (
          <div key={e.concept_id}>
            {slide.taught_concept_ids.length > 1 ? <p className="mb-[0.15em] text-[0.7em] font-semibold text-slate-500">{deck.concepts[String(e.concept_id)]?.name}</p> : null}
            <p className="text-[1.3em] leading-snug text-slate-900">{e.text}</p>
          </div>
        ))}
        {key ? (
          <p className="flex items-start gap-[0.6em] rounded-[0.8em] border border-indigo-200 bg-indigo-50 px-[0.9em] py-[0.6em] text-[1.05em] leading-snug text-indigo-950">
            <KeyRound className="mt-[0.15em] h-[1.1em] w-[1.1em] shrink-0" aria-hidden="true" />
            <span>
              <span className="font-semibold">Key idea. </span>
              {key}
            </span>
          </p>
        ) : null}
      </div>
    );
  }

  if (tab === 'example') {
    return (
      <p className="flex items-start gap-[0.7em] rounded-[0.8em] border border-emerald-200 bg-emerald-50 px-[1em] py-[0.8em] text-[1.25em] leading-snug text-emerald-950">
        <Lightbulb className="mt-[0.15em] h-[1.1em] w-[1.1em] shrink-0" aria-hidden="true" />
        <span>
          <span className="font-semibold">Worked example. </span>
          {c.example}
        </span>
      </p>
    );
  }

  if (tab === 'mistake' && c.misconception) {
    return (
      <div className="grid grid-cols-2 gap-[0.8em]">
        <p className="rounded-[0.8em] border border-amber-200 bg-amber-50 px-[1em] py-[0.8em] text-[1.15em] leading-snug text-amber-950">
          <span className="mb-[0.2em] flex items-center gap-[0.4em] text-[0.75em] font-semibold">
            <AlertTriangle className="h-[1.1em] w-[1.1em]" aria-hidden="true" />
            Common mistake - not quite
          </span>
          {c.misconception.wrong_idea}
        </p>
        <p className="rounded-[0.8em] border border-emerald-200 bg-emerald-50 px-[1em] py-[0.8em] text-[1.15em] leading-snug text-emerald-950">
          <span className="mb-[0.2em] flex items-center gap-[0.4em] text-[0.75em] font-semibold">
            <CheckCircle2 className="h-[1.1em] w-[1.1em]" aria-hidden="true" />
            Instead
          </span>
          {c.misconception.correction}
        </p>
      </div>
    );
  }

  if (tab === 'talk' && c.discussion) {
    return (
      <div className="grid gap-[0.7em]">
        <p className="flex items-start gap-[0.6em] text-[1.3em] font-medium leading-snug text-sky-950">
          <MessageCircle className="mt-[0.2em] h-[1.1em] w-[1.1em] shrink-0 text-sky-700" aria-hidden="true" />
          {c.discussion.prompt}
        </p>
        <ol aria-label="Think, pair, share" className="flex flex-wrap gap-[0.5em]">
          {[
            ['Think', 'On your own for a minute.'],
            ['Pair', 'Compare with the person next to you.'],
            ['Share', 'Tell the class what you decided.'],
          ].map(([name, hint], index) => (
            <li key={name} className="flex items-center gap-[0.5em] rounded-[0.8em] border border-sky-100 bg-sky-50 px-[0.7em] py-[0.3em] text-[0.8em]">
              <span className="flex h-[1.8em] w-[1.8em] items-center justify-center rounded-full bg-sky-600 text-[0.9em] font-semibold text-white">{index + 1}</span>
              <span>
                <span className="font-semibold text-slate-900">{name}. </span>
                <span className="text-slate-600">{hint}</span>
              </span>
            </li>
          ))}
        </ol>
        <div className="flex flex-wrap items-center gap-[0.8em]">
          <button
            type="button"
            onClick={onAnswer}
            aria-expanded={answer}
            className="inline-flex items-center gap-[0.5em] rounded-[0.7em] border border-sky-300 bg-white px-[1em] py-[0.4em] text-[0.8em] font-semibold text-sky-900 hover:bg-sky-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600"
          >
            {answer ? <EyeOff className="h-[1.1em] w-[1.1em]" aria-hidden="true" /> : <Eye className="h-[1.1em] w-[1.1em]" aria-hidden="true" />}
            {answer ? 'Hide the possible answer' : 'Show a possible answer'}
          </button>
          <span className="flex items-center gap-[0.4em] text-[0.65em] text-slate-500">
            <Users className="h-[1em] w-[1em]" aria-hidden="true" />
            Nothing is marked: this is for talking.
          </span>
        </div>
        {answer ? <p className="rounded-[0.8em] bg-sky-50 p-[0.8em] text-[1.05em] leading-snug text-slate-800">{c.discussion.answer}</p> : null}
      </div>
    );
  }

  return null;
}
