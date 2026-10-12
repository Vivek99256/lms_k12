/**
 * Pure logic for the three interactions a study-deck slide can carry: image hotspots, a
 * branching scenario and click-to-reveal cards.
 *
 * NO REACT AND NO FETCH HERE, so every rule is testable with node:test.
 *
 * These are EXPLORATION, not assessment. Nothing here marks anyone: hotspot coverage reuses the
 * existing H5P image-hotspots scorer (`scoreHotspotVisit`) only to answer "has every part been
 * read", a scenario is finished when a path reaches its end, and reveal cards are done when each
 * has been opened. Each reports completion; none reports a score.
 */

import { scoreHotspotVisit } from '../h5p/image-hotspots';
import type {
  DeckInteraction,
  DeckSlide,
  HotspotSpot,
  HotspotsInteraction,
  ItemsInteraction,
  MatchInteraction,
  OrderInteraction,
  ScenarioChoice,
  ScenarioInteraction,
  ScenarioNode,
} from './types';

/** A stable key for a slide's interaction in the progress record. */
export function interactionKey(slide: Pick<DeckSlide, 'n'>): string {
  return `${slide.n}:i`;
}

/** The plain-words heading a learner sees for each kind. */
export const INTERACTION_HEADING: Record<DeckInteraction['kind'], string> = {
  hotspots: 'Explore the diagram',
  scenario: 'What would you do?',
  reveal: 'Discover',
  steps: 'Step by step',
  timeline: 'Explore the timeline',
  compare: 'Compare',
  match: 'Match',
  order: 'Put in order',
};

/** A stable key for a slide's example screen (worked example, common mistake, key idea) in the progress record. */
export function exampleKey(slide: Pick<DeckSlide, 'n'>): string {
  return `${slide.n}:e`;
}

// ---------------------------------------------------------------------------
// Hotspots
// ---------------------------------------------------------------------------

export interface HotspotState {
  /** Spot ids the learner has opened, in the order they did it. */
  opened: string[];
  /** The spot whose explanation is showing, or null. */
  active: string | null;
}

export const initialHotspots = (): HotspotState => ({ opened: [], active: null });

/** Open a spot: it becomes the active one and counts as explored. Opening it again changes nothing but the focus. */
export function openHotspot(state: HotspotState, interaction: HotspotsInteraction, id: string): HotspotState {
  if (!interaction.spots.some((spot) => spot.id === id)) return state;

  return { opened: state.opened.includes(id) ? state.opened : [...state.opened, id], active: id };
}

export function closeHotspot(state: HotspotState): HotspotState {
  return { ...state, active: null };
}

export interface HotspotProgress {
  opened: number;
  total: number;
  done: boolean;
  remaining: HotspotSpot[];
}

/**
 * How much of the diagram has been explored.
 *
 * Delegates to the image-hotspots coverage scorer the H5P module uses, so "explored" means exactly
 * what it means there: one point per DISTINCT spot opened, repeats count once, and ids that are not
 * on this diagram count for nothing.
 */
export function hotspotProgress(interaction: HotspotsInteraction, state: HotspotState): HotspotProgress {
  const byNumber = interaction.spots.map((spot, index) => ({ id: index + 1, sort_order: index, spot }));
  const opened = new Set(byNumber.filter((entry) => state.opened.includes(entry.spot.id)).map((entry) => entry.id));
  const result = scoreHotspotVisit(byNumber, opened, { points_per_hotspot: 1, pass_percentage: 100 });

  return {
    opened: result.openedCount,
    total: result.hotspotCount,
    done: result.completed,
    remaining: result.remaining.map((entry) => byNumber.find((b) => b.id === entry.id)!.spot),
  };
}

// ---------------------------------------------------------------------------
// Scenario
// ---------------------------------------------------------------------------

export interface ScenarioState {
  /** The decision being faced. */
  nodeId: string;
  /** The choice picked at this decision, once picked. */
  chosen: string | null;
  /** Every choice taken so far, in order, including the current one. */
  path: Array<{ nodeId: string; choiceId: string }>;
  /** A path reached its end and the conclusion is showing. */
  ended: boolean;
  /** Choice ids tried at any point, across restarts: the learner may compare paths. */
  tried: string[];
}

export const initialScenario = (interaction: ScenarioInteraction): ScenarioState => ({
  nodeId: interaction.start,
  chosen: null,
  path: [],
  ended: false,
  tried: [],
});

export function nodeOf(interaction: ScenarioInteraction, id: string): ScenarioNode | undefined {
  return interaction.nodes.find((node) => node.id === id);
}

export function choiceOf(node: ScenarioNode | undefined, id: string | null): ScenarioChoice | undefined {
  return node?.choices.find((choice) => choice.id === id);
}

/** Pick a choice at the current decision. Picking again before moving on replaces the pick (the learner may compare). */
export function choose(interaction: ScenarioInteraction, state: ScenarioState, choiceId: string): ScenarioState {
  const node = nodeOf(interaction, state.nodeId);
  if (!node || state.ended || !choiceOf(node, choiceId)) return state;

  const path = state.path.filter((step) => step.nodeId !== state.nodeId);

  return {
    ...state,
    chosen: choiceId,
    path: [...path, { nodeId: state.nodeId, choiceId }],
    tried: state.tried.includes(choiceId) ? state.tried : [...state.tried, choiceId],
  };
}

/** Take the picked choice's consequence forward: on to the next decision, or to the end. */
export function advance(interaction: ScenarioInteraction, state: ScenarioState): ScenarioState {
  const choice = choiceOf(nodeOf(interaction, state.nodeId), state.chosen);
  if (!choice || state.ended) return state;
  if (choice.next !== null && nodeOf(interaction, choice.next)) {
    return { ...state, nodeId: choice.next, chosen: null };
  }

  return { ...state, ended: true };
}

/** Go back to the start to try a different path. What was tried is remembered. */
export function restart(interaction: ScenarioInteraction, state: ScenarioState): ScenarioState {
  return { ...initialScenario(interaction), tried: state.tried };
}

export interface ScenarioProgress {
  /** Distinct choices tried, out of all the choices there are. */
  triedChoices: number;
  totalChoices: number;
  done: boolean;
}

/** A scenario counts as done when a path has reached its end. Trying other paths is encouraged, never required. */
export function scenarioProgress(interaction: ScenarioInteraction, state: ScenarioState, everEnded: boolean): ScenarioProgress {
  const all = interaction.nodes.flatMap((node) => node.choices.map((choice) => choice.id));

  return {
    triedChoices: state.tried.filter((id) => all.includes(id)).length,
    totalChoices: all.length,
    done: state.ended || everEnded,
  };
}

/** The decisions on the path just walked, with what was chosen at each, for the closing recap. */
export function pathTaken(interaction: ScenarioInteraction, state: ScenarioState): Array<{ node: ScenarioNode; choice: ScenarioChoice }> {
  return state.path
    .map((step) => {
      const node = nodeOf(interaction, step.nodeId);
      const choice = choiceOf(node, step.choiceId);

      return node && choice ? { node, choice } : null;
    })
    .filter((entry): entry is { node: ScenarioNode; choice: ScenarioChoice } => entry !== null);
}

// ---------------------------------------------------------------------------
// Items: reveal cards, steps, timeline, compare
// ---------------------------------------------------------------------------

export interface ItemsProgress {
  opened: number;
  total: number;
  done: boolean;
}

/** How many items have been opened at least once. Closing one again does not undo having opened it. */
export function itemsProgress(interaction: ItemsInteraction, seen: readonly string[]): ItemsProgress {
  const total = interaction.items.length;
  const count = interaction.items.filter((item) => seen.includes(item.id)).length;

  return { opened: count, total, done: total > 0 && count === total };
}

/** Select an item: it becomes the open one (selecting the open one closes it) and counts as seen. */
export function selectItem(state: { open: string | null; seen: string[] }, id: string): { open: string | null; seen: string[] } {
  return { open: state.open === id ? null : id, seen: state.seen.includes(id) ? state.seen : [...state.seen, id] };
}

/** The step after the open one (for "Next step"), or null at the end. */
export function nextItem(interaction: ItemsInteraction, openId: string | null): string | null {
  const index = interaction.items.findIndex((item) => item.id === openId);

  return index >= 0 && index < interaction.items.length - 1 ? interaction.items[index + 1].id : null;
}

// ---------------------------------------------------------------------------
// Match
// ---------------------------------------------------------------------------

/** A fixed shuffle, so the same lesson always shows the same order, and it is never already in order. */
export function shuffled<T extends { id: string }>(items: readonly T[]): T[] {
  const weight = (id: string) => [...id].reduce((total, ch, i) => (total * 31 + ch.charCodeAt(0) * (i + 7)) % 9973, 17);
  const out = [...items].sort((x, y) => weight(x.id) - weight(y.id));
  if (items.length > 1 && out.every((item, i) => item.id === items[i].id)) out.push(out.shift() as T);

  return out;
}

export interface MatchState {
  /** The term waiting for its meaning. */
  picked: string | null;
  matched: string[];
  /** Tries that did not fit. Never shown as a mark. */
  misses: number;
  /** The last try, so the screen can say "not that one" for a moment. */
  last: 'match' | 'miss' | null;
}

export const initialMatch = (): MatchState => ({ picked: null, matched: [], misses: 0, last: null });

export function pickTerm(state: MatchState, id: string): MatchState {
  if (state.matched.includes(id)) return state;

  return { ...state, picked: state.picked === id ? null : id, last: null };
}

/** The learner chose a meaning. It fits when it belongs to the picked term. */
export function pickMeaning(state: MatchState, meaningId: string): MatchState {
  if (state.picked === null || state.matched.includes(meaningId)) return state;
  if (meaningId === state.picked) return { picked: null, matched: [...state.matched, meaningId], misses: state.misses, last: 'match' };

  return { ...state, misses: state.misses + 1, last: 'miss' };
}

export function matchProgress(interaction: MatchInteraction, state: MatchState): ItemsProgress {
  const total = interaction.pairs.length;
  const count = interaction.pairs.filter((pair) => state.matched.includes(pair.id)).length;

  return { opened: count, total, done: total > 0 && count === total };
}

// ---------------------------------------------------------------------------
// Order
// ---------------------------------------------------------------------------

export interface OrderState {
  /** Item ids chosen so far, in the order chosen. */
  placed: string[];
  misses: number;
  last: 'ok' | 'miss' | null;
}

export const initialOrder = (): OrderState => ({ placed: [], misses: 0, last: null });

/** Choose the item that comes next. The right one is placed; any other is a gentle "not yet". */
export function placeItem(interaction: OrderInteraction, state: OrderState, id: string): OrderState {
  if (state.placed.includes(id) || state.placed.length >= interaction.items.length) return state;
  if (interaction.items[state.placed.length].id === id) return { ...state, placed: [...state.placed, id], last: 'ok' };

  return { ...state, misses: state.misses + 1, last: 'miss' };
}

export function orderProgress(interaction: OrderInteraction, state: OrderState): ItemsProgress {
  const total = interaction.items.length;

  return { opened: state.placed.length, total, done: total > 0 && state.placed.length === total };
}

// ---------------------------------------------------------------------------
// The example screen: worked example, common mistake, instead, key idea
// ---------------------------------------------------------------------------

export type ExampleCardId = 'example' | 'mistake' | 'instead' | 'key';

export interface ExampleCard {
  id: ExampleCardId;
  label: string;
  text: string;
}

/**
 * The cards of a slide's example screen, in the order a teacher takes them. The key idea comes last and is only
 * unlocked once every other card has been opened; it is the slide's own key idea, or its first explanation.
 */
export function exampleCards(slide: DeckSlide): ExampleCard[] {
  const c = slide.content;
  const cards: ExampleCard[] = [];
  if (c.example) cards.push({ id: 'example', label: 'Worked example', text: c.example });
  if (c.misconception) {
    cards.push({ id: 'mistake', label: 'Common mistake', text: c.misconception.wrong_idea });
    cards.push({ id: 'instead', label: 'Instead', text: c.misconception.correction });
  }
  const key = c.key_idea || c.explanations[0]?.text || c.body || '';
  if (cards.length > 0 && key) cards.push({ id: 'key', label: 'Key idea', text: key });

  return cards;
}

export interface ExampleProgress {
  opened: number;
  /** Cards that have to be opened (every one except the key idea). */
  total: number;
  done: boolean;
  /** The key idea can be opened. */
  keyUnlocked: boolean;
}

export function exampleProgress(slide: DeckSlide, seen: readonly string[]): ExampleProgress {
  const required = exampleCards(slide).filter((card) => card.id !== 'key');
  const opened = required.filter((card) => seen.includes(card.id)).length;
  const done = required.length > 0 && opened === required.length;

  return { opened, total: required.length, done, keyUnlocked: done };
}

// ---------------------------------------------------------------------------
// Shape check (used by parseDeck)
// ---------------------------------------------------------------------------

/** What is wrong with an interaction's shape, or null when the player can draw it. */
export function interactionProblem(value: unknown, slideImageIsDiagram: boolean): string | null {
  const i = value as Partial<DeckInteraction> | null;
  if (!i || typeof i !== 'object') return 'is not an object';

  switch (i.kind) {
    case 'hotspots': {
      if (!slideImageIsDiagram) return 'asks for hotspots on a slide with no drawn diagram';
      const spots = (i as HotspotsInteraction).spots;
      if (!Array.isArray(spots) || spots.length < 2) return 'has fewer than two hotspots';
      if (spots.some((s) => !s.id || typeof s.text !== 'string' || ![s.x, s.y, s.w, s.h].every((n) => typeof n === 'number'))) return 'has a malformed hotspot';
      if (new Set(spots.map((s) => s.id)).size !== spots.length) return 'repeats a hotspot id';
      return null;
    }
    case 'scenario': {
      const s = i as ScenarioInteraction;
      if (!Array.isArray(s.nodes) || s.nodes.length === 0) return 'has no decisions';
      const ids = s.nodes.map((n) => n.id);
      if (new Set(ids).size !== ids.length) return 'repeats a decision id';
      if (!ids.includes(s.start)) return 'starts at a decision that does not exist';
      for (const node of s.nodes) {
        if (!Array.isArray(node.choices) || node.choices.length < 2) return 'has a decision with fewer than two choices';
        const choiceIds = node.choices.map((c) => c.id);
        if (choiceIds.some((id) => !id)) return 'has a choice with no id';
        if (node.choices.some((c) => c.next !== null && !ids.includes(c.next))) return 'has a choice that leads nowhere';
      }
      // A path must end: links may only go forward through the list.
      const position = new Map(ids.map((id, index) => [id, index]));
      for (const node of s.nodes) {
        if (node.choices.some((c) => c.next !== null && (position.get(c.next) ?? -1) <= (position.get(node.id) ?? 0))) {
          return 'has a choice that loops back, so a path would never end';
        }
      }
      return null;
    }
    case 'reveal':
    case 'steps':
    case 'timeline':
    case 'compare': {
      const items = (i as ItemsInteraction).items;
      const min = i.kind === 'steps' || i.kind === 'timeline' ? 3 : 2;
      if (!Array.isArray(items) || items.length < min) return `has fewer than ${min} items`;
      if (items.some((c) => !c.id || !c.label || !c.text)) return 'has a malformed item';
      if (new Set(items.map((c) => c.id)).size !== items.length) return 'repeats an item id';
      if (i.kind === 'timeline' && items.some((c) => !c.when)) return 'has a timeline event with no date';
      return null;
    }
    case 'match': {
      const pairs = (i as MatchInteraction).pairs;
      if (!Array.isArray(pairs) || pairs.length < 3) return 'has fewer than three pairs';
      if (pairs.some((c) => !c.id || !c.term || !c.meaning)) return 'has a malformed pair';
      if (new Set(pairs.map((c) => c.id)).size !== pairs.length) return 'repeats a pair id';
      return null;
    }
    case 'order': {
      const items = (i as OrderInteraction).items;
      if (!Array.isArray(items) || items.length < 3) return 'has fewer than three items';
      if (items.some((c) => !c.id || !c.text)) return 'has a malformed item';
      if (new Set(items.map((c) => c.id)).size !== items.length) return 'repeats an item id';
      return null;
    }
    default:
      return `has an unknown kind "${String((i as { kind?: unknown }).kind)}"`;
  }
}
