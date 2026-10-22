import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { parseDeck } from './deck';
import { applyImageUrls, pendingImageIds } from './images';
import {
  advance,
  cameFrom,
  choose,
  continueStory,
  decisionsTaken,
  initialScenario,
  interactionProblem,
  nodeOf,
  picturesFor,
  restart,
  scenarioProgress,
  storyProblem,
  storyProgress,
  variantFor,
  type ScenarioState,
} from './interactions';
import { layoutOf, pendingHint } from './stage';
import { STORY_TEMPLATE, type DeckSlide, type ScenarioInteraction } from './types';

/**
 * The story act below is a HAND-WRITTEN fixture for chapter 8592 ("Scientific Models and Simplification"), used to test the
 * player's navigation. It is test data, not generated content.
 */
const raw = JSON.parse(readFileSync(join(__dirname, 'fixtures', 'story-deck-chapter8592-fixture.json'), 'utf8'));
const deck = parseDeck(JSON.parse(JSON.stringify(raw)));
const slide = deck.slides[1];
const story = slide.interaction as ScenarioInteraction;
const clone = (): ScenarioInteraction => JSON.parse(JSON.stringify(story));

/** Play a list of moves from the start: 'c' continues a scene, 'x:<choice>' picks a choice and goes on. */
function walk(interaction: ScenarioInteraction, moves: string[]): ScenarioState {
  let s = initialScenario(interaction);
  for (const m of moves) {
    s = m === 'c' ? continueStory(interaction, s) : advance(interaction, choose(interaction, s, m.slice(2)));
  }
  return s;
}

test('the story deck is a valid v3 deck and its act is drawn by the scenario layout', () => {
  assert.equal(story.template, STORY_TEMPLATE);
  assert.equal(layoutOf(slide), 'scenario');
  assert.equal(storyProblem(story), null);
  assert.equal(interactionProblem(story, false), null);
  assert.equal(pendingHint(slide, 'teach', false), 'Follow the story to an ending to continue.');
});

test('a choice goes to the scene it names, on each branch', () => {
  const start = walk(story, ['c']);
  assert.equal(start.nodeId, 'd1');

  const a = choose(story, start, 'd1-a');
  assert.equal(a.nodeId, 'd1', 'choosing alone does not move: the event is shown first');
  assert.equal(advance(story, a).nodeId, 's2a');
  const b = choose(story, start, 'd1-b');
  assert.equal(advance(story, b).nodeId, 's2b', 'the other choice leads somewhere else');
});

test('different branches meet again at a merge scene and then part again', () => {
  const viaA = walk(story, ['c', 'x:d1-a', 'c']);
  const viaB = walk(story, ['c', 'x:d1-b', 'c']);

  assert.equal(viaA.nodeId, 's3');
  assert.equal(viaB.nodeId, 's3');
  assert.deepEqual(viaA.path.map((p) => p.nodeId), ['s1', 'd1', 's2a']);
  assert.deepEqual(viaB.path.map((p) => p.nodeId), ['s1', 'd1', 's2b'], 'the two learners walked different scenes to get here');

  const good = walk(story, ['c', 'x:d1-a', 'c', 'c', 'x:d2-a', 'c']);
  const other = walk(story, ['c', 'x:d1-a', 'c', 'c', 'x:d2-b', 'c']);
  assert.equal(good.nodeId, 'e1');
  assert.equal(other.nodeId, 'e2');
});

test('every path ends in an ending, with its own text, and the learner lands on it', () => {
  const endings = new Map<string, string>();
  for (const first of ['d1-a', 'd1-b']) {
    for (const second of ['d2-a', 'd2-b']) {
      const end = walk(story, ['c', `x:${first}`, 'c', 'c', `x:${second}`, 'c']);
      assert.equal(end.ended, true, `${first}/${second} ends`);
      const node = story.nodes.find((n) => n.id === end.nodeId)!;
      assert.equal(node.kind, 'ending');
      endings.set(`${first}/${second}`, node.title ?? '');
    }
  }
  assert.deepEqual([...new Set(endings.values())].sort(), ['A model worth revisiting', 'The captain gets her answer']);
});

test('nothing moves after an ending, and a different path can be taken from the start', () => {
  const end = walk(story, ['c', 'x:d1-a', 'c', 'c', 'x:d2-a', 'c']);

  assert.deepEqual(continueStory(story, end), end);
  assert.deepEqual(advance(story, end), end);
  const again = restart(story, end);
  assert.equal(again.nodeId, 's1');
  assert.equal(again.ended, false);
  assert.deepEqual(again.path, []);
  assert.ok(again.tried.includes('d1-a'), 'what was tried is remembered');
});

test('the recap lists only the decisions, and progress reports the scene and the tried choices', () => {
  const end = walk(story, ['c', 'x:d1-b', 'c', 'c', 'x:d2-b', 'c']);
  assert.equal(end.nodeId, 'e2', 'the weaker choices end in the revisit ending');

  assert.deepEqual(decisionsTaken(story, end).map((d) => d.choice.id), ['d1-b', 'd2-b']);
  const p = storyProgress(story, end);
  assert.equal(p.ended, true);
  assert.equal(p.percent, 100);
  assert.equal(p.decisionsTotal, 6, 'two decisions of three choices each');
  assert.equal(p.decisionsTried, 2);
  assert.equal(scenarioProgress(story, end, false).done, true, 'finishing a path completes the slide\'s interaction');
  assert.equal(scenarioProgress(story, initialScenario(story), false).done, false);

  const mid = storyProgress(story, walk(story, ['c', 'x:d1-a', 'c']));
  assert.equal(mid.position, 6, 'at the merge scene, the sixth of twelve in story order');
  assert.equal(mid.total, 12);
  assert.ok(mid.percent > 0 && mid.percent < 100);
});

test('the player refuses a story that could strand a learner', () => {
  const cases: Array<[string, (s: ScenarioInteraction) => void, RegExp]> = [
    ['a way on to nowhere', (s) => { s.nodes[1].choices[0].next = null; }, /leads nowhere/],
    ['a way on to a scene that does not exist', (s) => { s.nodes[1].choices[0].next = 'ghost'; }, /leads nowhere/],
    ['a way back', (s) => { s.nodes[4].choices[0].next = 'd1'; }, /leads back/],
    ['a scene no choice leads to', (s) => { s.nodes[1].choices[1].next = 's2a'; }, /no choice leads to/],
    ['no ending at all', (s) => { s.nodes = s.nodes.filter((n) => n.kind !== 'ending'); }, /no ending|way on|leads/],
    ['a scene with two ways on', (s) => { s.nodes[2].choices.push({ ...s.nodes[2].choices[0], id: 'extra' }); }, /exactly one way on/],
    ['an ending that still has a way on', (s) => { s.nodes[10].choices = [{ id: 'x', text: 'more', outcome: '', why: '', sound: true, next: 'e2' }]; }, /ending/],
    ['a decision with one choice', (s) => { s.nodes[1].choices = s.nodes[1].choices.slice(0, 1); }, /fewer than two/],
    ['opening on a decision', (s) => { s.start = 'd1'; }, /does not start at its first scene/],
    ['a picture with no size', (s) => { s.nodes[0].image = { ...s.nodes[0].image!, width: 0 }; }, /cannot be drawn/],
    ['an unknown kind', (s) => { (s.nodes[2] as { kind: string }).kind = 'cutscene'; }, /kind/],
  ];
  for (const [name, mutate, expected] of cases) {
    const s = clone();
    mutate(s);
    assert.match(storyProblem(s) ?? '', expected, name);
    assert.notEqual(interactionProblem(s, false), null, `${name}: parseDeck would refuse it`);
  }
  const wrong = clone();
  (wrong as { template: string }).template = 'something_else';
  assert.match(storyProblem(wrong) ?? '', /unknown template/);
});

test('parseDeck refuses a deck whose story is broken', () => {
  const broken = JSON.parse(JSON.stringify(raw));
  broken.slides[1].interaction.nodes[1].choices[0].next = null;

  assert.throws(() => parseDeck(broken), /Slide 2's interaction/);
});

test('an ordinary scenario, with no template, behaves exactly as before', () => {
  const legacy: ScenarioInteraction = {
    kind: 'scenario', reason: 'r', situation: 'A situation', start: 'n1', conclusion: 'Done',
    nodes: [
      { id: 'n1', prompt: 'First?', choices: [{ id: 'n1-1', text: 'Yes', outcome: 'o', why: 'w', sound: true, next: 'n2' }, { id: 'n1-2', text: 'No', outcome: 'o', why: 'w', sound: false, next: null }] },
      { id: 'n2', prompt: 'Second?', choices: [{ id: 'n2-1', text: 'Yes', outcome: 'o', why: 'w', sound: true, next: null }, { id: 'n2-2', text: 'No', outcome: 'o', why: 'w', sound: false, next: null }] },
    ],
  };
  assert.equal(interactionProblem(legacy, false), null);
  let s = advance(legacy, choose(legacy, initialScenario(legacy), 'n1-1'));
  assert.equal(s.nodeId, 'n2');
  assert.equal(s.ended, false, 'a decision node never ends the scenario by arrival');
  s = advance(legacy, choose(legacy, s, 'n2-1'));
  assert.equal(s.ended, true);
  assert.equal(pendingHint({ ...slide, interaction: legacy } as DeckSlide, 'teach', false), 'Make your decision to continue.');
});

test('a scene picture is found and resolved like any other deck picture', () => {
  assert.deepEqual(pendingImageIds(deck as never).sort((a, b) => a - b), [5, 9, 10]);
});

test('where branches meet, the scene opens with the lead-in for the way the learner came, and only that one', () => {
  const s3 = nodeOf(story, 's3')!;
  assert.equal(s3.variants?.length, 3, 'one lead-in for each of the three ways in');

  for (const [choice, from] of [['d1-a', 's2a'], ['d1-b', 's2b'], ['d1-c', 's2c']] as const) {
    const at = walk(story, ['c', `x:${choice}`, 'c']);
    assert.equal(at.nodeId, 's3');
    assert.equal(cameFrom(story, at, s3), from);
    assert.equal(variantFor(story, at, s3), s3.variants!.find((v) => v.after === from)!.body);
  }
  const texts = ['d1-a', 'd1-b', 'd1-c'].map((c) => variantFor(story, walk(story, ['c', `x:${c}`, 'c']), s3));
  assert.equal(new Set(texts).size, 3, 'each path reads a different lead-in');

  // the same story, reached by the other branch of the second decision, tells the other lead-in at the ending
  const e2 = nodeOf(story, 'e2')!;
  const viaB = walk(story, ['c', 'x:d1-a', 'c', 'c', 'x:d2-b', 'c']);
  const viaC = walk(story, ['c', 'x:d1-a', 'c', 'c', 'x:d2-c', 'c']);
  assert.equal(viaB.nodeId, 'e2');
  assert.notEqual(variantFor(story, viaB, e2), variantFor(story, viaC, e2));

  // a scene that is not a meeting point, and the very start, have no lead-in
  assert.equal(variantFor(story, walk(story, ['c', 'x:d1-a']), nodeOf(story, 's2a')!), null);
  assert.equal(variantFor(story, initialScenario(story), nodeOf(story, 's1')!), null);
});

test('a decision keeps showing the latest picture of the path, and a scene without one shows none', () => {
  const at = (moves: string[]) => walk(story, moves);
  assert.equal(picturesFor(story, at([]), nodeOf(story, 's1')!).length, 2, "the opening scene's own picture and its supporting one");
  // d1 has its own picture; d2 has none and the scene before it (s3) has none either, so the last picture on the path is d1's
  const d2 = nodeOf(story, 'd2')!;
  const shown = picturesFor(story, at(['c', 'x:d1-a', 'c', 'c']), d2);
  assert.equal(shown.length, 1);
  assert.equal(shown[0].url, nodeOf(story, 'd1')!.image!.url);
  // a scene with no picture of its own does not borrow one
  assert.deepEqual(picturesFor(story, at(['c', 'x:d1-a']), nodeOf(story, 's2a')!), []);
});

test('supporting pictures are named, found and given their addresses like the main picture', () => {
  const withExtras = JSON.parse(JSON.stringify(raw));
  const node = withExtras.slides[1].interaction.nodes.find((n: { id: string }) => n.id === 's2a');
  node.image = { ...withExtras.slides[1].interaction.nodes[0].image, url: 'study-deck-image:21' };
  node.extra_images = [
    { ...node.image, url: 'study-deck-image:22', role: 'close_up' },
    { ...node.image, url: 'study-deck-image:23', role: 'evidence' },
  ];
  const parsed = parseDeck(withExtras);

  const ids = pendingImageIds(parsed);
  for (const id of [21, 22, 23]) assert.ok(ids.includes(id), `picture ${id} is requested`);

  applyImageUrls(parsed, { '21': 'https://x/21', '22': 'https://x/22', '23': 'https://x/23' });
  const shown = nodeOf(parsed.slides[1].interaction as ScenarioInteraction, 's2a')!;
  assert.equal(shown.image!.url, 'https://x/21');
  assert.deepEqual(shown.extra_images!.map((i) => i.url), ['https://x/22', 'https://x/23']);
  assert.deepEqual(picturesFor(parsed.slides[1].interaction as ScenarioInteraction, initialScenario(parsed.slides[1].interaction as ScenarioInteraction), shown).map((i) => i.url), ['https://x/21', 'https://x/22', 'https://x/23']);
});
