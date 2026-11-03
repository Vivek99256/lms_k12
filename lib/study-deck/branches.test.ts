import test from 'node:test';
import assert from 'node:assert/strict';

import { parseDeck } from './deck';
import { branchProblem, interactionProblem } from './interactions';
import type { DeckInteraction } from './types';

// A small branching deck: slide 1 chooses between two paths, 2 asks a question whose answers open 3 and 4, 4 goes on to 5, and 7 is the proposal.
const hub: DeckInteraction = {
  kind: 'hub',
  reason: '',
  intro: '',
  options: [
    { id: 'a', label: 'Alpha', tagline: '', goto: 2, end: 4, image_slide: 3, art: 'k12' },
    { id: 'b', label: 'Beta', tagline: '', goto: 5, end: 6, image_slide: 6, art: 'g2g' },
  ],
  skip_to: { label: 'Go on', goto: 7 },
};
const decision: DeckInteraction = {
  kind: 'decision',
  reason: '',
  kicker: 'Scenario',
  question: 'What now?',
  options: [
    { id: 'a', text: 'One', goto: 3 },
    { id: 'b', text: 'Two', goto: 4 },
  ],
};
const outcome = (goto: number): DeckInteraction => ({
  kind: 'outcome',
  reason: '',
  tone: 'sound',
  choice: { id: 'b', text: 'Two' },
  what: 'Something happens.',
  why: 'Because.',
  actions: [{ label: 'Choose again', goto, primary: true }],
});
const slide = (n: number, interaction: DeckInteraction | null = null, next?: number) => ({ n, interaction, ...(next === undefined ? {} : { next }) });
const deck = [slide(1, hub), slide(2, decision, -1), slide(3, outcome(2)), slide(4, outcome(2), 5), slide(5), slide(6), slide(7)];
const changed = (n: number, replacement: ReturnType<typeof slide>) => deck.map((s) => (s.n === n ? replacement : s));

test('a branching deck is fine when every way on leads to a slide that exists (and -1 means Continue waits)', () => {
  assert.equal(branchProblem(deck), null);
});

test('the first way on that leads nowhere is named, so the author can fix it', () => {
  assert.match(String(branchProblem(changed(3, slide(3, outcome(9))))), /Slide 3's "Choose again" button opens slide 9, which does not exist/);
  assert.match(String(branchProblem(changed(2, slide(2, { ...decision, options: [{ id: 'a', text: 'One', goto: 12 }, { id: 'b', text: 'Two', goto: 4 }] } as DeckInteraction, -1)))), /Slide 2's answer A opens slide 12/);
  assert.match(String(branchProblem(changed(5, slide(5, null, 40)))), /Slide 5 continues to slide 40, which does not exist/);
  assert.match(String(branchProblem(changed(1, slide(1, { ...hub, options: [{ ...hub.options[0], end: 99 }, hub.options[1]] } as DeckInteraction)))), /"Alpha" ends at slide 99/);
  assert.match(String(branchProblem(changed(1, slide(1, { ...hub, options: [{ ...hub.options[0], image_slide: 98 }, hub.options[1]] } as DeckInteraction)))), /"Alpha" takes its picture from slide 98/);
  assert.match(String(branchProblem(changed(1, slide(1, { ...hub, skip_to: { label: 'Go on', goto: 70 } } as DeckInteraction)))), /"Go on" button opens slide 70/);
});

test('shape check: the choice of products, the pop-up question and the answer slide', () => {
  for (const kind of [hub, decision, outcome(2)]) assert.equal(interactionProblem(kind, false), null, kind.kind);

  assert.match(String(interactionProblem({ ...hub, options: [(hub as { options: unknown[] }).options[0]] }, false)), /fewer than two options/);
  assert.match(String(interactionProblem({ ...decision, question: '' }, false)), /no question or fewer than two answers/);
  assert.match(String(interactionProblem({ ...decision, options: [{ id: 'a', text: 'One', goto: 0 }, { id: 'b', text: 'Two', goto: 4 }] }, false)), /answer that opens no slide/);
  assert.match(String(interactionProblem({ ...outcome(2), actions: [] }, false)), /no consequence or no way on/);
});

test('a deck whose choices lead nowhere is refused when it is read, not when a learner gets stuck', () => {
  const raw = (slides: typeof deck) => ({
    version: 3,
    chapter: { id: 1 },
    concepts: {},
    outline: [],
    slides: slides.map((s) => ({ ...s, title: 'Title', content: { body: '' }, activities: [] })),
  });

  assert.equal(parseDeck(raw(deck)).slides.length, 7);
  assert.throws(() => parseDeck(raw(changed(3, slide(3, outcome(9))))), /Slide 3's "Choose again" button opens slide 9, which does not exist/);
});
