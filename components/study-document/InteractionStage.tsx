'use client';

import type { ReactNode } from 'react';

import { ExploreView } from '@/components/study-deck/ExploreView';
import { HotspotsView } from '@/components/study-deck/HotspotsView';
import { MatchView } from '@/components/study-deck/MatchView';
import { OrderView } from '@/components/study-deck/OrderView';
import { ScenarioView } from '@/components/study-deck/ScenarioView';
import { Eyebrow, FitCanvas } from '@/components/study-deck/stage-ui';
import type { DeckImage, DeckInteraction } from '@/lib/study-deck/types';

export interface InteractionStageProps {
  interaction: DeckInteraction;
  /** The drawn diagram the hotspots sit on (and a picture a list of items may keep beside it). */
  image?: DeckImage | null;
  /** The small label above the title ("Note 3", "Worked example"). */
  eyebrow: string;
  title: string;
  /** One sentence under the title. */
  summary?: string;
  done: boolean;
  onDone: () => void;
  /** Where this screen's state is kept while the viewer is open. */
  memoryKey: string;
  /** Tailwind height of the stage. A stage is a presentation canvas fitted to it, so it never scrolls inside. */
  className?: string;
}

/**
 * One of the study deck's own interactive screens, shown inside a document's online practice.
 *
 * It is not a second player: the hotspots, cards, steps, matching and ordering are the deck's views, fitted to a box by the
 * deck's own canvas. Opening every part reports `onDone` once. Nothing is marked and nothing is written.
 */
export function InteractionStage({ interaction, image = null, eyebrow, title, summary, done, onDone, memoryKey, className = 'h-[30rem]' }: InteractionStageProps) {
  const lead: ReactNode = (
    <div className="space-y-[0.5em]">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h3 className="text-[1.7em] font-semibold leading-tight tracking-tight text-slate-900">{title}</h3>
      {summary ? <p className="text-[0.95em] leading-snug text-slate-700">{summary}</p> : null}
    </div>
  );

  let view: ReactNode = null;
  switch (interaction.kind) {
    case 'hotspots':
      view = image ? <HotspotsView interaction={interaction} image={image} assetBase={null} done={done} onDone={onDone} lead={lead} memoryKey={memoryKey} /> : null;
      break;
    case 'scenario':
      view = <ScenarioView interaction={interaction} done={done} onDone={onDone} lead={lead} memoryKey={memoryKey} />;
      break;
    case 'match':
      view = <MatchView interaction={interaction} done={done} onDone={onDone} lead={lead} memoryKey={memoryKey} />;
      break;
    case 'order':
      view = <OrderView interaction={interaction} done={done} onDone={onDone} lead={lead} memoryKey={memoryKey} />;
      break;
    default:
      view = <ExploreView interaction={interaction} done={done} onDone={onDone} lead={lead} image={null} assetBase={null} memoryKey={memoryKey} />;
  }

  if (!view) return null;

  return (
    <div className={`flex ${className} min-h-[22rem] w-full flex-col`} data-testid={`stage-${interaction.kind}`}>
      <FitCanvas resetKey={memoryKey}>{view}</FitCanvas>
    </div>
  );
}
