import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { parseDeck } from './deck';
import { allPositions, exampleRequired, layoutOf, nextPosition, pendingHint, previousPosition, stepsOf } from './stage';
import type { DeckSlide, StudyDeck } from './types';

const deck = (): StudyDeck => parseDeck(JSON.parse(readFileSync(new URL('./fixtures/study-deck-golden.json', import.meta.url), 'utf8')));
const real = (): StudyDeck | null => {
  try {
    return parseDeck(JSON.parse(readFileSync(new URL('../../public/study-deck/chapter-8592/deck.json', import.meta.url), 'utf8')));
  } catch {
    return null;
  }
};

test('a slide is one screen per thing a teacher would take: teach, then example, then discuss', () => {
  const d = deck();

  assert.deepEqual(stepsOf(d.slides[0]), ['teach'], 'the cover is one screen');
  assert.deepEqual(stepsOf(d.slides[1]), ['teach', 'example'], 'a misconception slide gets an example screen');
  assert.deepEqual(stepsOf(d.slides[2]), ['teach', 'example'], 'slide 3 has an example');
  assert.deepEqual(stepsOf(d.slides[3]), ['teach', 'discuss'], 'slide 4 has only a discussion prompt');
  const both = structuredClone(d.slides[2]) as DeckSlide;
  both.content.discussion = { prompt: 'Why?', answer: 'Because.' };
  assert.deepEqual(stepsOf(both), ['teach', 'example', 'discuss']);
});

test('Continue and Previous walk every screen, in order, and stop at the ends', () => {
  const d = deck();
  const all = allPositions(d);
  assert.deepEqual(all[0], { n: 1, step: 0 });

  let at = all[0];
  const walked = [at];
  for (let next = nextPosition(d, at); next; next = nextPosition(d, next)) walked.push(next);
  assert.deepEqual(walked, all, 'Continue visits every screen exactly once');
  assert.equal(nextPosition(d, all[all.length - 1]), null, 'nothing after the last screen');

  assert.equal(previousPosition(d, all[0]), null, 'nothing before the first screen');
  at = all[all.length - 1];
  const back = [at];
  for (let p = previousPosition(d, at); p; p = previousPosition(d, p)) back.push(p);
  assert.deepEqual(back.reverse(), all, 'Previous retraces the same path');
});

test('going back from a slide lands on the LAST screen of the one before', () => {
  const d = deck();

  assert.deepEqual(previousPosition(d, { n: 4, step: 0 }), { n: 3, step: stepsOf(d.slides[2]).length - 1 });
  assert.deepEqual(nextPosition(d, { n: 3, step: 0 }), { n: 3, step: 1 });
  assert.equal(nextPosition(d, { n: 99, step: 0 }), null, 'an unknown slide has no next screen');
});

test('the slide data picks the composition', () => {
  const d = deck();
  const kinds = d.slides.map(layoutOf);

  assert.equal(kinds[0], 'cover');
  assert.equal(kinds[1], 'explore', 'a comparison, opened item by item');
  assert.equal(kinds[2], 'visual-hotspots', 'a drawn diagram with hotspots');
  assert.equal(kinds[3], 'explore', 'click-to-reveal cards');
  assert.equal(kinds[4], 'scenario', 'a decision');
  assert.equal(kinds[5], 'explore', 'a process opened step by step');
  assert.equal(kinds[6], 'match', 'terms paired with their meanings');
});

test('without an image or an interaction the slide data still decides between cards, a connection and a statement', () => {
  const base = structuredClone(deck().slides[3]) as DeckSlide;
  base.image = null;
  base.interaction = null;
  base.slide_type = 'concept_intro';
  base.relationship = null;
  base.content.bullets = [];

  assert.equal(layoutOf(base), 'statement');
  assert.equal(layoutOf({ ...base, content: { ...base.content, bullets: ['One', 'Two', 'Three'] } }), 'cards');
  assert.equal(
    layoutOf({ ...base, relationship: { from: 1, to: 2, kind: 'depends_on', idea: 'x' }, content: { ...base.content, relationship_note: 'They connect.' } }),
    'relationship'
  );
  assert.equal(layoutOf({ ...base, slide_type: 'exit_ticket', taught_concept_ids: [] }), 'intro');
  assert.equal(layoutOf({ ...base, image: structuredClone(deck().slides[1].image) }), 'image-text', 'a picture with nothing to explore on it');
});

test('an interaction that is still open says what to do; once explored, or on another screen, it says nothing', () => {
  const d = deck();
  const hot = d.slides[2];

  assert.equal(pendingHint(hot, 'teach', false), 'Explore all 2 parts of the diagram to continue.');
  assert.equal(pendingHint(d.slides[1], 'teach', false), 'Open all 2 to compare, then continue.');
  assert.equal(pendingHint(d.slides[3], 'teach', false), 'Open all 2 cards to continue.');
  assert.equal(pendingHint(d.slides[4], 'teach', false), 'Make your decision to continue.');
  assert.equal(pendingHint(d.slides[5], 'teach', false), 'Open all 3 steps to continue.');
  assert.equal(pendingHint(d.slides[6], 'teach', false), 'Match every pair to continue.');
  assert.equal(pendingHint(hot, 'teach', true), null);
  assert.equal(pendingHint(hot, 'discuss', false), null, 'only the screen that carries the interaction asks for it');
  assert.equal(pendingHint(d.slides[0], 'teach', false), null);
});

test('the example screen asks for its cards too, and the key idea is not one of them', () => {
  const d = deck();
  const withMistake = d.slides[1]; // slide 2 carries a misconception: mistake + instead

  assert.equal(exampleRequired(withMistake), 2);
  assert.equal(pendingHint(withMistake, 'example', false), 'Open all 2 cards to continue.');
  assert.equal(pendingHint(withMistake, 'example', true), null);
  assert.equal(exampleRequired(d.slides[3]), 0, 'a slide with no example has no example cards');
  assert.equal(pendingHint(d.slides[3], 'example', false), null);
});

test('chapter 8592: every screen fits the rules - at most three, and every layout is one the player draws', () => {
  const d = real();
  if (!d) return; // the review copy is not part of every checkout

  const kinds = new Set<string>();
  for (const slide of d.slides) {
    kinds.add(layoutOf(slide));
    assert.ok(stepsOf(slide).length >= 1 && stepsOf(slide).length <= 3, `slide ${slide.n}`);
  }
  for (const kind of kinds) assert.ok(['cover', 'scenario', 'visual-hotspots', 'explore', 'match', 'order', 'image-text', 'summary', 'intro', 'relationship', 'cards', 'statement'].includes(kind));
  assert.ok(kinds.size >= 5, `a varied lesson, not one layout: ${[...kinds].join(', ')}`);
});
