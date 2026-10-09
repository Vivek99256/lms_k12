import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { parseDeck } from './deck';
import {
  advance,
  choose,
  closeHotspot,
  hotspotProgress,
  initialHotspots,
  initialScenario,
  interactionKey,
  interactionProblem,
  openHotspot,
  pathTaken,
  restart,
  exampleCards,
  exampleProgress,
  initialMatch,
  initialOrder,
  itemsProgress,
  matchProgress,
  nextItem,
  orderProgress,
  pickMeaning,
  pickTerm,
  placeItem,
  scenarioProgress,
  selectItem,
  shuffled,
} from './interactions';
import type { HotspotsInteraction, ItemsInteraction, MatchInteraction, ScenarioInteraction } from './types';

const deck = parseDeck(JSON.parse(readFileSync(new URL('./fixtures/study-deck-golden.json', import.meta.url), 'utf8')));
const hotspots = deck.slides[2].interaction as HotspotsInteraction;
const reveal = deck.slides[3].interaction as ItemsInteraction;
const compare = deck.slides[1].interaction as ItemsInteraction;
const steps = deck.slides[5].interaction as ItemsInteraction;
const match = deck.slides[6].interaction as MatchInteraction;
const scenario = deck.slides[4].interaction as ScenarioInteraction;

test('an interaction has its own key on the slide, apart from the practice activities', () => {
  assert.equal(interactionKey({ n: 3 }), '3:i');
});

// ---------------------------------------------------------------------------

test('hotspots: opening a part highlights it and counts it explored; repeats count once', () => {
  const [a, b] = hotspots.spots;
  let s = initialHotspots();
  assert.deepEqual(hotspotProgress(hotspots, s), { opened: 0, total: 2, done: false, remaining: hotspots.spots });

  s = openHotspot(s, hotspots, a.id);
  assert.equal(s.active, a.id);
  s = openHotspot(s, hotspots, a.id);
  s = openHotspot(s, hotspots, a.id);
  assert.deepEqual(s.opened, [a.id]);
  assert.equal(hotspotProgress(hotspots, s).opened, 1, 'clicking one part three times is one part read');
  assert.equal(hotspotProgress(hotspots, s).done, false);
  assert.deepEqual(hotspotProgress(hotspots, s).remaining.map((x) => x.id), [b.id]);

  s = openHotspot(s, hotspots, b.id);
  assert.equal(s.active, b.id);
  assert.equal(hotspotProgress(hotspots, s).done, true);
});

test('hotspots: closing the explanation keeps what was explored; an unknown part changes nothing', () => {
  let s = openHotspot(initialHotspots(), hotspots, hotspots.spots[0].id);
  s = closeHotspot(s);

  assert.equal(s.active, null);
  assert.deepEqual(s.opened, [hotspots.spots[0].id]);
  assert.equal(openHotspot(s, hotspots, 'not-a-part'), s);
});

test('hotspots lie inside the picture and carry the size of the box they cover', () => {
  for (const spot of hotspots.spots) {
    assert.ok(spot.x - spot.w / 2 >= 0 && spot.x + spot.w / 2 <= 100, spot.label);
    assert.ok(spot.y - spot.h / 2 >= 0 && spot.y + spot.h / 2 <= 100, spot.label);
  }
});

// ---------------------------------------------------------------------------

test('scenario: a choice shows its consequence, and the next decision follows only after it', () => {
  let s = initialScenario(scenario);
  assert.equal(s.nodeId, 'n1');
  assert.equal(advance(scenario, s), s, 'cannot move on before choosing');

  s = choose(scenario, s, 'n1-1');
  assert.equal(s.chosen, 'n1-1');
  s = advance(scenario, s);
  assert.deepEqual([s.nodeId, s.chosen, s.ended], ['n2', null, false]);

  s = choose(scenario, s, 'n2-1');
  s = advance(scenario, s);
  assert.equal(s.ended, true, 'a choice with no next decision ends the path');
});

test('scenario: a path that ends at the first decision is a complete path', () => {
  let s = choose(scenario, initialScenario(scenario), 'n1-2'); // the less sound choice, no next decision
  s = advance(scenario, s);

  assert.equal(s.ended, true);
  assert.equal(scenarioProgress(scenario, s, false).done, true);
});

test('scenario: the learner can change their mind before moving on, and can compare paths', () => {
  let s = initialScenario(scenario);
  s = choose(scenario, s, 'n1-2');
  s = choose(scenario, s, 'n1-1');

  assert.equal(s.chosen, 'n1-1');
  assert.deepEqual(s.path, [{ nodeId: 'n1', choiceId: 'n1-1' }], 'the earlier pick is replaced, not stacked');
  assert.deepEqual(s.tried, ['n1-2', 'n1-1']);

  s = advance(scenario, choose(scenario, advance(scenario, s), 'n2-2'));
  assert.equal(s.ended, true);
  assert.deepEqual(pathTaken(scenario, s).map((p) => [p.node.id, p.choice.id]), [['n1', 'n1-1'], ['n2', 'n2-2']]);

  const again = restart(scenario, s);
  assert.deepEqual([again.nodeId, again.chosen, again.ended, again.path], ['n1', null, false, []]);
  assert.deepEqual(again.tried, s.tried, 'what was tried is remembered across a restart');
  assert.equal(scenarioProgress(scenario, again, true).done, true, 'having reached an end once is enough');
  assert.equal(scenarioProgress(scenario, again, false).done, false);
  assert.equal(scenarioProgress(scenario, again, true).totalChoices, 4);
});

test('scenario: choices that do not exist, or made after the end, change nothing', () => {
  const s = initialScenario(scenario);
  assert.equal(choose(scenario, s, 'ghost'), s);

  const ended = advance(scenario, choose(scenario, s, 'n1-2'));
  assert.equal(choose(scenario, ended, 'n1-1'), ended);
  assert.equal(advance(scenario, ended), ended);
});

// ---------------------------------------------------------------------------

test('items: each one opened counts once, and closing it again does not undo having opened it', () => {
  let state: { open: string | null; seen: string[] } = { open: null, seen: [] };
  assert.deepEqual(itemsProgress(reveal, state.seen), { opened: 0, total: 2, done: false });

  state = selectItem(state, 'i1');
  assert.equal(state.open, 'i1');
  state = selectItem(state, 'i1');
  assert.deepEqual(state, { open: null, seen: ['i1'] }, 'selecting the open one closes it');
  state = selectItem(state, 'i2');
  assert.equal(itemsProgress(reveal, state.seen).done, true);
  assert.equal(itemsProgress(reveal, ['nope']).opened, 0, 'only items on this slide count');
});

test('steps move on one at a time, and compare needs both sides opened', () => {
  assert.equal(nextItem(steps, 'i1'), 'i2');
  assert.equal(nextItem(steps, 'i3'), null, 'nothing after the last step');
  assert.equal(nextItem(steps, null), null);
  assert.equal(itemsProgress(compare, ['i1']).done, false);
  assert.equal(itemsProgress(compare, ['i1', 'i2']).done, true);
});

// ---------------------------------------------------------------------------

test('match: a fitting meaning locks the pair; one that does not fit is a gentle miss, never a mark', () => {
  let s = initialMatch();
  assert.equal(pickMeaning(s, 'p1'), s, 'a meaning cannot be chosen before a term');

  s = pickTerm(s, 'p1');
  s = pickMeaning(s, 'p2');
  assert.deepEqual([s.matched, s.misses, s.last, s.picked], [[], 1, 'miss', 'p1'], 'the term stays picked so the learner can try again');
  s = pickMeaning(s, 'p1');
  assert.deepEqual([s.matched, s.picked, s.last], [['p1'], null, 'match']);
  assert.equal(pickTerm(s, 'p1'), s, 'a matched term stays matched');

  s = pickMeaning(pickTerm(s, 'p2'), 'p2');
  s = pickMeaning(pickTerm(s, 'p3'), 'p3');
  assert.deepEqual(matchProgress(match, s), { opened: 3, total: 3, done: true });
});

test('match: the shuffle is fixed and never leaves the meanings in the order of the terms', () => {
  const once = shuffled(match.pairs).map((p) => p.id);
  assert.deepEqual(shuffled(match.pairs).map((p) => p.id), once, 'the same lesson always shows the same order');
  assert.notDeepEqual(once, match.pairs.map((p) => p.id));
  assert.equal(shuffled([{ id: 'only' }]).length, 1);
});

const order = {
  kind: 'order' as const,
  reason: 'a real sequence',
  intro: 'Put them in order.',
  wrapup: '',
  items: [{ id: 'o1', text: 'First' }, { id: 'o2', text: 'Second' }, { id: 'o3', text: 'Third' }],
};

test('order: the next item in the sequence is placed; any other is "not yet"', () => {
  let s = initialOrder();
  s = placeItem(order, s, 'o2');
  assert.deepEqual([s.placed, s.misses, s.last], [[], 1, 'miss']);
  s = placeItem(order, s, 'o1');
  s = placeItem(order, s, 'o2');
  assert.deepEqual([s.placed, s.last], [['o1', 'o2'], 'ok']);
  assert.equal(placeItem(order, s, 'o1'), s, 'a placed item cannot be placed again');
  s = placeItem(order, s, 'o3');
  assert.deepEqual(orderProgress(order, s), { opened: 3, total: 3, done: true });
  assert.equal(placeItem(order, s, 'o1'), s, 'nothing more once the sequence is complete');
});

// ---------------------------------------------------------------------------

test('the example screen: the cards in teaching order, and the key idea unlocks last', () => {
  const slide = deck.slides[1]; // a common mistake, no worked example
  const cards = exampleCards(slide);

  assert.deepEqual(cards.map((c) => c.id), ['mistake', 'instead', 'key']);
  assert.equal(cards[0].text, slide.content.misconception?.wrong_idea);
  assert.equal(cards[1].text, slide.content.misconception?.correction);
  assert.deepEqual(exampleProgress(slide, []), { opened: 0, total: 2, done: false, keyUnlocked: false });
  assert.deepEqual(exampleProgress(slide, ['mistake']), { opened: 1, total: 2, done: false, keyUnlocked: false });
  assert.deepEqual(exampleProgress(slide, ['mistake', 'instead']), { opened: 2, total: 2, done: true, keyUnlocked: true });
  assert.equal(exampleProgress(slide, ['key']).done, false, 'the key idea is not one of the cards to open');
  assert.deepEqual(exampleCards(deck.slides[3]), [], 'no example or mistake means no example screen');
});

test('the key idea is the slide\'s own, else its first explanation', () => {
  const withKey = deck.slides[3];
  const slide = structuredClone(deck.slides[1]);

  assert.equal(withKey.content.key_idea, 'A law describes a repeated pattern.');
  assert.equal(exampleCards(slide).at(-1)?.text, slide.content.explanations[0].text);
  slide.content.key_idea = 'Remember this.';
  assert.equal(exampleCards(slide).at(-1)?.text, 'Remember this.');
});

// ---------------------------------------------------------------------------

test('shape check: what the player can draw, and why anything else is refused', () => {
  assert.equal(interactionProblem(hotspots, true), null);
  assert.equal(interactionProblem(scenario, false), null);
  assert.equal(interactionProblem(reveal, false), null);

  assert.match(String(interactionProblem(hotspots, false)), /no drawn diagram/);
  assert.match(String(interactionProblem(null, true)), /not an object/);
  assert.match(String(interactionProblem({ kind: 'carousel' }, true)), /unknown kind "carousel"/);
  assert.match(String(interactionProblem({ ...hotspots, spots: [hotspots.spots[0], hotspots.spots[0]] }, true)), /repeats a hotspot id/);
  assert.match(String(interactionProblem({ ...scenario, start: 'zzz' }, true)), /starts at a decision that does not exist/);
  assert.match(String(interactionProblem({ ...scenario, nodes: [] }, true)), /no decisions/);
  assert.equal(interactionProblem(compare, false), null);
  assert.equal(interactionProblem(steps, false), null);
  assert.equal(interactionProblem(match, false), null);
  assert.equal(interactionProblem(order, false), null);
  assert.match(String(interactionProblem({ ...steps, items: steps.items.slice(0, 2) }, false)), /fewer than 3 items/);
  assert.match(String(interactionProblem({ ...match, pairs: match.pairs.slice(0, 2) }, false)), /fewer than three pairs/);
  assert.match(String(interactionProblem({ ...order, items: order.items.slice(0, 2) }, false)), /fewer than three items/);
  assert.match(String(interactionProblem({ ...reveal, items: [reveal.items[0], reveal.items[0]] }, false)), /repeats an item id/);
  assert.match(String(interactionProblem({ ...steps, kind: 'timeline' }, false)), /no date/);
});
