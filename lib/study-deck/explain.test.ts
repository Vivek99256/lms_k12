import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { parseDeck } from './deck';
import { activeTab, cardsOpenedBy, dockButtonLabel, dockExplanations, dockReducer, dockTabs, examplesExplored, explanationInline, initialDock } from './explain';
import { exampleCards } from './interactions';
import { layoutOf, stepsOf } from './stage';
import type { DeckSlide, StudyDeck } from './types';

const real = (): StudyDeck | null => {
  try {
    return parseDeck(JSON.parse(readFileSync(new URL('../../public/study-deck/chapter-8592/deck.json', import.meta.url), 'utf8')));
  } catch {
    return null; // the review copy is not part of every checkout
  }
};

const slideWith = (over: Partial<DeckSlide['content']>, extra: Partial<DeckSlide> = {}): DeckSlide =>
  ({
    n: 4,
    section: null,
    slide_type: 'concept_intro',
    title: 'Science asks what and how',
    concept_ids: [1],
    taught_concept_ids: [1],
    concepts: ['Science'],
    relationship: null,
    content: { body: '', explanations: [{ concept_id: 1, text: 'Why and how we know.' }], bullets: [], example: null, misconception: null, relationship_note: null, discussion: null, bloom: 'understand', dok: 1, minutes: 2, ...over },
    question_ids: [],
    activities: [],
    interaction: null,
    interaction_reason: '',
    h5p_pattern: null,
    image: null,
    image_missing: null,
    ...extra,
  }) as DeckSlide;

test('the tabs are the slide\'s own content, in teaching order, and a slide with none has no button', () => {
  const slide = slideWith({ example: 'A cricket shot.', misconception: { wrong_idea: 'a', correction: 'b' }, discussion: { prompt: 'p', answer: 'a' } });
  assert.deepEqual(dockTabs(slide, 'cards').map((t) => t.id), ['explain', 'example', 'mistake', 'talk']);
  assert.deepEqual(dockTabs(slideWith({}), 'cards').map((t) => t.id), ['explain']);
  assert.deepEqual(dockTabs(slideWith({ explanations: [], body: 'Intro text.' }), 'intro'), [], 'a slide that states its own text has nothing to add');
  assert.deepEqual(dockTabs(slide, 'cover'), [], 'the cover has no panel');
});

test('the button says what the panel holds first', () => {
  const tabs = (s: DeckSlide) => dockTabs(s, 'cards');
  assert.equal(dockButtonLabel(tabs(slideWith({}))), 'Explain this concept');
  assert.equal(dockButtonLabel(tabs(slideWith({ explanations: [], example: 'x' }))), 'See a worked example');
  assert.equal(dockButtonLabel(tabs(slideWith({ explanations: [], discussion: { prompt: 'p', answer: 'a' } }))), 'Talk about it');
  assert.equal(dockButtonLabel([]), 'Learn more');
});

test('a bare statement keeps its explanation on the slide, so the slide is never left empty', () => {
  const s = slideWith({});
  assert.equal(explanationInline('statement'), true);
  assert.equal(explanationInline('cards'), false);
  assert.deepEqual(dockExplanations(s, 'statement'), []);
  assert.equal(dockExplanations(s, 'cards').length, 1);
  assert.deepEqual(dockTabs(s, 'statement'), [], 'nothing to add behind the button');
  assert.deepEqual(dockTabs(slideWith({ key_idea: 'Remember this.' }), 'statement').map((t) => t.id), ['explain'], 'its key idea still goes behind it');
});

test('opening and closing the panel changes only the panel', () => {
  const tabs = dockTabs(slideWith({ example: 'x', discussion: { prompt: 'p', answer: 'a' } }), 'cards');
  let s = initialDock(tabs);
  assert.equal(s.open, false);
  s = dockReducer(s, { type: 'toggle' });
  assert.equal(s.open, true);
  s = dockReducer(s, { type: 'toggle' });
  assert.equal(s.open, false, 'pressing the button again collapses it');
  s = dockReducer(dockReducer(s, { type: 'toggle' }), { type: 'close' });
  assert.equal(s.open, false);
  assert.equal(dockReducer(s, { type: 'close' }), s, 'closing a closed panel is a no-op');
  s = dockReducer(s, { type: 'answer' });
  assert.equal(s.answer, true);
  assert.equal(dockReducer(s, { type: 'answer' }).answer, false);
});

test('opening the example and mistake tabs counts as exploring the example, as the old screen did', () => {
  const slide = slideWith({ example: 'x', misconception: { wrong_idea: 'w', correction: 'c' } });
  const tabs = dockTabs(slide, 'cards');
  assert.deepEqual(cardsOpenedBy('example'), ['example']);
  assert.deepEqual(cardsOpenedBy('mistake'), ['mistake', 'instead']);
  assert.deepEqual(cardsOpenedBy('talk'), []);

  let s = initialDock(tabs);
  assert.equal(examplesExplored(slide, s.seen), false);
  s = dockReducer(s, { type: 'tab', tab: 'example' });
  assert.equal(examplesExplored(slide, s.seen), false, 'the mistake is still unopened');
  s = dockReducer(s, { type: 'tab', tab: 'mistake' });
  assert.equal(examplesExplored(slide, s.seen), true);
  assert.deepEqual([...s.seen].sort(), ['example', 'instead', 'mistake']);
  assert.equal(dockReducer(s, { type: 'tab', tab: 'example' }).seen.length, 3, 'opening a tab twice counts once');
  assert.equal(examplesExplored(slideWith({ explanations: [] }), []), false, 'a slide with no examples is never "explored"');
});

test('a remembered tab that no longer exists falls back to the first', () => {
  const tabs = dockTabs(slideWith({}), 'cards');
  assert.equal(activeTab(tabs, 'talk'), 'explain');
  assert.equal(activeTab(tabs, 'explain'), 'explain');
});

test('chapter 8592: every slide is one screen and no explanatory content is lost', () => {
  const d = real();
  if (!d) return;

  let example = 0;
  let discuss = 0;
  for (const slide of d.slides) {
    const layout = layoutOf(slide);
    assert.deepEqual(stepsOf(slide), ['teach'], `slide ${slide.n} is one screen`);
    const ids = dockTabs(slide, layout).map((t) => t.id);
    const c = slide.content;

    if (c.example) {
      example += 1;
      assert.ok(ids.includes('example'), `slide ${slide.n}: the worked example is reachable`);
    }
    if (c.misconception) assert.ok(ids.includes('mistake'), `slide ${slide.n}: the common mistake and its correction are reachable`);
    if (c.discussion) {
      discuss += 1;
      assert.ok(ids.includes('talk'), `slide ${slide.n}: the discussion and its possible answer are reachable`);
    }
    if (layout !== 'cover' && layout !== 'statement' && c.explanations.length > 0) assert.ok(ids.includes('explain'), `slide ${slide.n}: the concept explanation is reachable`);
    if ((c.key_idea ?? '').trim() && layout !== 'cover') assert.ok(ids.includes('explain'), `slide ${slide.n}: the key idea is reachable`);
    // the progress rule is unchanged: every example card the old screen asked for is still one the panel can open
    const required = exampleCards(slide).filter((card) => card.id !== 'key').map((card) => card.id);
    const reachable = new Set(ids.flatMap((id) => cardsOpenedBy(id)));
    for (const card of required) assert.ok(reachable.has(card as 'example'), `slide ${slide.n}: ${card} can still be opened`);
  }
  assert.ok(example > 20 && discuss > 20, `the deck really has examples (${example}) and discussions (${discuss})`);
});
