import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { compressHeading, headingRepeatsText, isGenericLabel, repairGenericLabels, resolveAllHeadings, resolveHeading } from './cardTitle';
import { parseDeck } from './deck';
import { itemsProgress, selectItem } from './interactions';
import type { DeckSlide, StudyDeck } from './types';

/** Real cards of chapter 8592 with the headings the server (PHP CardTitle) gave them: the two implementations must agree. */
interface Case {
  concept: string;
  card: { statement: string; knowledge: string; type: string };
  title: string;
  level: number;
}
const cases: Case[] = JSON.parse(readFileSync(join(__dirname, 'fixtures', 'card-titles.json'), 'utf8'));

test('numbered placeholders are generic; real titles that contain a number are not', () => {
  for (const label of ['Key idea 1', 'key idea 2', 'Key ideas 3', 'Key point 4', 'Point 1', 'Item 1', 'Card 1', 'Idea 2', 'Tab 3', 'Key idea #2', 'Item: 5', '3', '#4', 'Untitled', '']) {
    assert.equal(isGenericLabel(label), true, label);
  }
  for (const label of ["Newton's 2nd law", 'Step 2 of the water cycle', 'Example 1.1: a cricket shot for a six', 'Point of view', 'Key idea', 'Card sorting by size', 'Using 2 rates to estimate', 'Vitamin B12', 'Estimating with an assumed rate']) {
    assert.equal(isGenericLabel(label), false, label);
  }
});

test('the TypeScript headings match the server for every recorded real card', () => {
  const byConcept = new Map<string, Case[]>();
  for (const c of cases) byConcept.set(c.concept, [...(byConcept.get(c.concept) ?? []), c]);

  for (const [concept, group] of byConcept) {
    const resolved = resolveAllHeadings(group.map((c) => c.card), concept);
    group.forEach((c, i) => {
      assert.equal(resolved[i].title, c.title, concept);
      assert.equal(resolved[i].level, c.level);
      assert.equal(isGenericLabel(resolved[i].title), false);
    });
    const titles = resolved.map((r) => r.title.toLowerCase());
    assert.equal(new Set(titles).size, titles.length, `${concept}: headings differ`);
  }
});

test('incomplete content is handled safely and invents nothing', () => {
  assert.deepEqual(resolveHeading({}), { title: 'More about this idea', level: 4 });
  assert.deepEqual(resolveHeading({ statement: 'Yes.', type: 'Rule' }, 'Scientific models'), { title: 'The rule: Scientific models', level: 3 });
  assert.equal(compressHeading(''), null);
  assert.equal(compressHeading('It is.'), null);
});

// ---- decks stored before the fix

function slideWith(labels: string[], texts: string[], concept = 'Estimate using rates and assumed values'): { slide: DeckSlide; deck: Pick<StudyDeck, 'concepts'> } {
  const slide = {
    n: 1,
    taught_concept_ids: [7],
    interaction: { kind: 'reveal', reason: '', intro: 'Open each card.', wrapup: '', items: labels.map((label, i) => ({ id: `k${i + 1}`, label, text: texts[i] })) },
  } as unknown as DeckSlide;

  return { slide, deck: { concepts: { '7': { id: 7, name: concept, topic_id: 1, requires: [], related: [], definition: null } } } };
}
const labelsOf = (s: DeckSlide) => (s.interaction as { items: { label: string }[] }).items.map((i) => i.label);

test('an older stored deck shows a heading from each card\'s own text instead of "Key idea N"', () => {
  const { slide, deck } = slideWith(
    ['Key idea 1', 'Key idea 2', 'Key idea 3'],
    [
      'An assumed rate is combined over a relevant time or number of persons to give an estimate.',
      'An average adult needs about 2000 2500 kilocalories per day, a value used in the rice-family estimation problem.',
      'A rough estimate can be formed by assuming simple rates, for example breaths per minute and volume per breath, then multiplying over the relevant time period.',
    ]
  );

  assert.equal(repairGenericLabels(slide, deck), 3);
  assert.deepEqual(labelsOf(slide), ['An assumed rate is combined over a relevant time', 'An average adult needs about 2000 2500 kilocalories per day', 'A rough estimate can be formed by assuming simple rates']);
});

test('real labels are never touched, and a thin card is not given an invented claim', () => {
  const { slide, deck } = slideWith(['Reading a map', 'Key idea 2', 'Card 3'], ['Text.', 'Yes.', 'A rough estimate can be built from simple assumed rates and values.']);

  repairGenericLabels(slide, deck);
  const labels = labelsOf(slide);

  assert.equal(labels[0], 'Reading a map');
  assert.equal(labels[2], 'A rough estimate can be built from simple assumed rates');
  assert.equal(isGenericLabel(labels[1]), false, 'a card with no usable text takes the neutral concept heading, not a number');
  assert.match(labels[1], /Estimate using rates and assumed values/);
});

test('a deck with real labels is left exactly as it was', () => {
  const { slide, deck } = slideWith(['Reading a map', 'Using a scale'], ['A map shows places in a small drawing.', 'A scale tells how distance is shrunk on a map.']);
  const before = JSON.stringify(slide);

  assert.equal(repairGenericLabels(slide, deck), 0);
  assert.equal(JSON.stringify(slide), before);
});

test('opening cards and progress tracking work the same after the labels are repaired', () => {
  const { slide, deck } = slideWith(['Key idea 1', 'Key idea 2'], ['An assumed rate is combined over a relevant time or number of persons.', 'A rough estimate can be built from simple assumed rates and values.']);
  repairGenericLabels(slide, deck);
  const interaction = slide.interaction as Parameters<typeof itemsProgress>[0];

  assert.deepEqual(interaction.items.map((i) => i.id), ['k1', 'k2'], 'ids, and so progress keys, are unchanged');
  let state = selectItem({ open: null, seen: [] }, 'k1');
  assert.equal(itemsProgress(interaction, state.seen).done, false);
  state = selectItem(state, 'k2');
  assert.equal(itemsProgress(interaction, state.seen).done, true);
});

test('parseDeck repairs an older stored deck in memory and leaves a current one alone', () => {
  const raw = JSON.parse(readFileSync(join(__dirname, '..', 'coursePresentation', 'fixtures', 'chapter8592-experiential-deck.json'), 'utf8'));
  const current = parseDeck(JSON.parse(JSON.stringify(raw)));
  const numbered = (JSON.parse(JSON.stringify(raw)) as StudyDeck);
  let renamed = 0;
  for (const s of numbered.slides) {
    if (s.interaction?.kind === 'reveal' && s.slide_type === 'concept_intro') {
      s.interaction.items.forEach((item, i) => { item.label = `Key idea ${i + 1}`; renamed += 1; });
    }
  }
  assert.ok(renamed > 20, 'the old-style deck really has numbered cards');

  const repaired = parseDeck(numbered);
  const left = repaired.slides.flatMap((s) => ((s.interaction as { items?: { label: string }[] } | null)?.items?.map((i) => i.label) ?? [])).filter(isGenericLabel);

  assert.deepEqual(left, []);
  assert.equal(current.slides.flatMap((s) => ((s.interaction as { items?: { label: string }[] } | null)?.items?.map((i) => i.label) ?? [])).filter(isGenericLabel).length, 0);
});

test('a heading that only repeats the opening of its card is not shown twice', () => {
  assert.equal(headingRepeatsText('Estimation begins by understanding the situation', 'Estimation begins by understanding the situation being studied.'), true);
  assert.equal(headingRepeatsText('Compass represents direction', 'The compass is used here as a symbol of purposeful direction.'), false);
});
