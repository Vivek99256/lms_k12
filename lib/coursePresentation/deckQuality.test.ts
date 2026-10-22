import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { parseDeck } from '../study-deck/deck';
import { interactionProblem, exampleCards } from '../study-deck/interactions';
import { layoutOf } from '../study-deck/stage';

/**
 * The Chapter 1 (8592) Course Presentation preview as the server built it for "Experiential / learning by doing" +
 * "PPT / interactive slides" (pictures as stored references). It is the real output of the source-to-template adapter,
 * so these tests check the deck the viewer is actually given, not a hand-made one.
 */
const raw = JSON.parse(readFileSync(join(__dirname, 'fixtures', 'chapter8592-experiential-deck.json'), 'utf8'));
const deck = parseDeck(raw);

test('the chapter topic list is drawn once, not after every topic', () => {
  const topicLists = deck.slides.filter((s) => layoutOf(s) === 'intro' && s.content.bullets.length === 0);

  assert.equal(topicLists.length, 1);
  assert.equal(topicLists[0].title, 'The chapter at a glance');
  assert.ok(topicLists[0].n <= 10, 'and it is near the start');
});

test('every one of the 32 concepts is taught by at least one slide', () => {
  const ids = Object.keys(deck.concepts);

  assert.equal(ids.length, 32);
  for (const id of ids) assert.ok((deck.taught_by[id] ?? []).length >= 1, `concept ${deck.concepts[id].name} has a slide`);
});

test('no two slides share a title, and no slide is empty', () => {
  const titles = deck.slides.filter((s) => s.slide_type !== 'cover').map((s) => s.title);

  assert.equal(new Set(titles).size, titles.length);
  for (const s of deck.slides) {
    const hasSomething = s.interaction || s.image || s.content.explanations.length > 0 || s.content.bullets.length > 0 || s.content.body.length > 20 || s.slide_type === 'cover';
    assert.ok(hasSomething, `slide ${s.n} has content`);
  }
});

test('every interaction is one the player can draw, and most slides are interactive', () => {
  const interactive = deck.slides.filter((s) => s.interaction);

  for (const s of interactive) assert.equal(interactionProblem(s.interaction, s.image?.type === 'diagram'), null, `slide ${s.n}`);
  assert.ok(interactive.length / deck.slides.length > 0.6, `${interactive.length} of ${deck.slides.length} slides are interactive`);
  assert.ok(interactive.some((s) => s.interaction?.kind === 'hotspots'), 'a clickable diagram is among them');
});

test('a diagram with hotspots is always shown with its picture, at its own aspect ratio', () => {
  for (const s of deck.slides.filter((x) => x.interaction?.kind === 'hotspots')) {
    assert.ok(s.image, `slide ${s.n} has its diagram`);
    assert.ok(s.image.width > 0 && s.image.height > 0);
  }
});

test('a prediction prompt rides with each explained idea and is answered from the stored explanation', () => {
  const taught = deck.slides.filter((s) => s.taught_concept_ids.length === 1 && s.content.explanations.length === 1);

  assert.ok(taught.length >= 30);
  for (const s of taught) {
    assert.ok(s.content.discussion, `slide ${s.n} has a prediction prompt`);
    assert.equal(s.content.discussion.answer, s.content.explanations[0].text);
  }
});

test('stored mistakes become cards the learner opens in place', () => {
  const withMistake = deck.slides.filter((s) => s.content.misconception);

  assert.ok(withMistake.length > 0);
  for (const s of withMistake) assert.ok(exampleCards(s).some((c) => c.id === 'mistake') && exampleCards(s).some((c) => c.id === 'instead'));
});
