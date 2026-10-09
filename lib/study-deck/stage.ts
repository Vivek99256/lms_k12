/**
 * How a deck slide becomes presentation screens.
 *
 * NO REACT HERE, so every rule is testable with node:test.
 *
 * The student player is a PRESENTATION: each screen fits the viewport and nothing scrolls. A slide is ONE screen:
 * the title, the large visual and the interaction the slide carries. Everything that used to follow on extra screens
 * (the explanation of the concept, the worked example, the common mistake and what to do instead, the question for
 * the class) is on that same screen, behind the slide's "Explain this concept" button (see ./explain.ts).
 *
 * `example` and `discuss` stay in the type only so that code written for the older three-screen model keeps
 * compiling; no slide produces them any more. The same slide data the PPT is built from decides all of it; nothing
 * here asks the model for anything.
 */

import { exampleCards } from './interactions';
import type { DeckSlide, StudyDeck } from './types';

export type StepKind = 'teach' | 'example' | 'discuss';

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- kept so callers need not change; every slide is one screen
export function stepsOf(_slide: DeckSlide): StepKind[] {
  return ['teach'];
}

/** Where the learner is: a slide and the screen within it. */
export interface Position {
  n: number;
  step: number;
}

/** The screen after this one, or null at the very end of the lesson. */
export function nextPosition(deck: StudyDeck, at: Position): Position | null {
  const index = deck.slides.findIndex((slide) => slide.n === at.n);
  if (index < 0) return null;
  if (at.step < stepsOf(deck.slides[index]).length - 1) return { n: at.n, step: at.step + 1 };
  const next = deck.slides[index + 1];

  return next ? { n: next.n, step: 0 } : null;
}

/** The screen before this one, or null at the very start. Going back lands on the LAST screen of the previous slide. */
export function previousPosition(deck: StudyDeck, at: Position): Position | null {
  const index = deck.slides.findIndex((slide) => slide.n === at.n);
  if (index < 0) return null;
  if (at.step > 0) return { n: at.n, step: at.step - 1 };
  const before = deck.slides[index - 1];

  return before ? { n: before.n, step: stepsOf(before).length - 1 } : null;
}

/** Every screen in the lesson, in order. */
export function allPositions(deck: StudyDeck): Position[] {
  return deck.slides.flatMap((slide) => stepsOf(slide).map((_, step) => ({ n: slide.n, step })));
}

export type LayoutKind =
  | 'cover'
  | 'scenario'
  | 'visual-hotspots'
  | 'explore'
  | 'match'
  | 'order'
  | 'image-text'
  | 'summary'
  | 'intro'
  | 'relationship'
  | 'cards'
  | 'statement';

/** Slide types that frame the lesson rather than teach a concept. */
const FRAMING = new Set(['hook', 'objectives', 'prior_knowledge', 'challenge', 'exit_ticket']);

/**
 * Which composition a slide's first screen uses. The slide's own data picks it - what it carries, not what it
 * is called - so a concept with a diagram and hotspots looks like a diagram with hotspots, a concept with three
 * short points looks like three cards, and a bare statement looks like a statement.
 */
export function layoutOf(slide: DeckSlide): LayoutKind {
  if (slide.slide_type === 'cover') return 'cover';
  if (slide.interaction?.kind === 'scenario') return 'scenario';
  if (slide.interaction?.kind === 'hotspots' && slide.image) return 'visual-hotspots';
  const kind = slide.interaction?.kind;
  if (kind === 'reveal' || kind === 'steps' || kind === 'timeline' || kind === 'compare') return 'explore';
  if (kind === 'match') return 'match';
  if (kind === 'order') return 'order';
  if (slide.image) return 'image-text';
  if (slide.slide_type === 'summary' || slide.slide_type === 'concept_map') return 'summary';
  if (FRAMING.has(slide.slide_type) || slide.taught_concept_ids.length === 0) return 'intro';
  if (slide.relationship && slide.content.relationship_note) return 'relationship';
  if (slide.content.bullets.length >= 2) return 'cards';

  return 'statement';
}

/** How many cards the example screen asks the learner to open (the key idea comes after them). */
export function exampleRequired(slide: DeckSlide): number {
  return exampleCards(slide).filter((card) => card.id !== 'key').length;
}

/**
 * What a learner is told when the screen's interaction is still open, or null when there is nothing to do.
 * `explored` is whether THIS screen's interaction is finished.
 */
export function pendingHint(slide: DeckSlide, step: StepKind, explored: boolean): string | null {
  if (explored) return null;

  if (step === 'example') {
    const n = exampleRequired(slide);

    return n > 0 ? `Open all ${n} cards to continue.` : null;
  }
  if (step !== 'teach' || !slide.interaction) return null;

  switch (slide.interaction.kind) {
    case 'hotspots':
      return `Explore all ${slide.interaction.spots.length} parts of the diagram to continue.`;
    case 'scenario':
      return 'Make your decision to continue.';
    case 'reveal':
      return `Open all ${slide.interaction.items.length} cards to continue.`;
    case 'steps':
      return `Open all ${slide.interaction.items.length} steps to continue.`;
    case 'timeline':
      return `Open all ${slide.interaction.items.length} events to continue.`;
    case 'compare':
      return `Open all ${slide.interaction.items.length} to compare, then continue.`;
    case 'match':
      return 'Match every pair to continue.';
    case 'order':
      return 'Put the steps in order to continue.';
  }
}
