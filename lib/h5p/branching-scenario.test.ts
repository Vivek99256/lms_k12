import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  analyse,
  back,
  begin,
  canGoBack,
  choose,
  continueFromFeedback,
  endingsOf,
  estimateMinutes,
  enumeratePaths,
  maxScore,
  normalizeScenario,
  orderedChoices,
  outcomeOf,
  plainText,
  proceed,
  qualityCounts,
  recap,
  restart,
  start,
  type BsScenario,
  type PlayState,
  type RawNode,
} from './branching-scenario';

/**
 * Three things here go wrong without anybody noticing.
 *
 * THE RULES DISAGREE WITH THE SERVER'S. The editor and the publish check are
 * two implementations of one definition of "sound", held together by a golden
 * file the backend test also runs. If this suite fails there, an editor that
 * says "ready" is about to meet a publish that says "no".
 *
 * THE PLAYER STRANDS A LEARNER. A back button that lands on the wrong node, a
 * restart that forgets the endings already found, a choice that follows the
 * wrong branch when choices are shuffled: all of them render fine.
 *
 * A SCORE IS MISREAD. A scenario that is not marked must not report 0 of 0 as a
 * failure.
 */

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const body = '<p>Words that say something useful to a learner.</p>';

function screen(ref: string, next: string | null, more: Partial<RawNode> = {}): RawNode {
  return { ref, node_type: 'text', title: `Screen ${ref}`, body, next_ref: next, options: [], ...more };
}

function decision(ref: string, choices: [string, string | null, string?][], more: Partial<RawNode> = {}): RawNode {
  return {
    ref,
    node_type: 'branching_question',
    title: `Decision ${ref}`,
    body: '<p>What do you do now?</p>',
    options: choices.map(([text, next, quality]) => ({
      text,
      next_ref: next,
      quality: quality ?? 'best',
      feedback_title: 'Why',
      feedback_text: '<p>Because of the idea.</p>',
    })),
    ...more,
  };
}

function ending(ref: string, score: number): RawNode {
  return { ref, node_type: 'ending', title: `Ending ${ref}`, body: '<p>Where it stops.</p>', score, options: [] };
}

/** start -> decision -> {good screen -> best ending | weak screen -> weaker ending} */
function tree(over: Partial<Parameters<typeof normalizeScenario>[0]> = {}): BsScenario {
  return normalizeScenario({
    title: 'Is the map the land?',
    scoring_option: 'static-end-score',
    pass_percentage: 60,
    nodes: [
      screen('a', 'd'),
      decision('d', [['Look closer', 'b', 'best'], ['Guess', 'c', 'misstep']]),
      screen('b', 'e1'),
      screen('c', 'e2'),
      ending('e1', 100),
      ending('e2', 40),
    ],
    ...over,
  });
}

// ---------------------------------------------------------------------------
// The golden file
// ---------------------------------------------------------------------------

interface GoldenCase {
  name: string;
  strict: boolean;
  nodes: RawNode[];
  errors: string[];
  warnings: string[];
  stats: Record<string, number | boolean>;
}

const golden = JSON.parse(readFileSync(new URL('./fixtures/branching-graph-golden.json', import.meta.url), 'utf8')) as GoldenCase[];

for (const c of golden) {
  test(`the editor's rules agree with the server's: ${c.name}`, () => {
    const report = analyse(normalizeScenario({ nodes: c.nodes }), c.strict);

    assert.deepEqual([...report.errors.map((i) => i.code)].sort(), c.errors, 'errors');
    assert.deepEqual([...report.warnings.map((i) => i.code)].sort(), c.warnings, 'warnings');
    for (const [key, value] of Object.entries(c.stats)) {
      assert.equal(report.stats[key as keyof typeof report.stats], value, `stats.${key}`);
    }
  });
}

test('the golden file exercises more than a handful of cases', () => {
  assert.ok(golden.length >= 12);
});

// ---------------------------------------------------------------------------
// Normalising
// ---------------------------------------------------------------------------

test('rows from the API and a payload with refs become the same scenario', () => {
  const fromRows = normalizeScenario({
    title: 'T',
    nodes: [
      { id: 11, node_type: 'text', title: 'A', body, next_node_id: 12, options: null },
      { id: 12, node_type: 'ending', title: 'B', body, score: 80 },
    ],
  });
  const fromRefs = normalizeScenario({
    title: 'T',
    nodes: [
      { ref: 'x', node_type: 'text', title: 'A', body, next_ref: 'y' },
      { ref: 'y', node_type: 'ending', title: 'B', body, score: 80 },
    ],
  });

  assert.equal(fromRows.nodes[0].next, '12');
  assert.equal(fromRefs.nodes[0].next, 'y');
  assert.deepEqual(analyse(fromRows).errors, []);
  assert.deepEqual(analyse(fromRefs).errors, []);
});

test('unknown kinds, missing fields and bad values are made safe, not trusted', () => {
  const s = normalizeScenario({
    nodes: [
      { ref: 'a', node_type: 'banana', next_ref: 'b' },
      { ref: 'b', node_type: 'ending', score: -5 },
    ],
    scoring_option: 'dynamic-score',
    pass_percentage: 400,
  });

  assert.equal(s.nodes[0].type, 'text');
  assert.equal(s.nodes[1].score, 0);
  assert.equal(s.scoring, 'static-end-score');
  assert.equal(s.passPercentage, 100);
  assert.equal(s.backNavigation, true);
});

test('the start title falls back to the scenario title, and an unrated choice stays unrated', () => {
  const s = normalizeScenario({
    title: 'My scenario',
    nodes: [decision('d', [['x', 'e'], ['y', 'e']]), ending('e', 1)],
  });
  s.nodes[0].choices[0].quality = null;

  assert.equal(s.startTitle, 'My scenario');
  assert.equal(qualityCounts([{ nodeKey: 'd', title: '', question: '', choiceText: '', quality: null, feedbackTitle: '' }]).unrated, 1);
});

test('plainText reads what a learner would see', () => {
  assert.equal(plainText('<p>One&nbsp;<strong>two</strong> &amp; three</p>'), 'One two & three');
  assert.equal(plainText(null), '');
});

// ---------------------------------------------------------------------------
// Paths and scoring
// ---------------------------------------------------------------------------

test('every simple path to an ending is listed', () => {
  assert.deepEqual(enumeratePaths(tree().nodes), [
    ['a', 'd', 'b', 'e1'],
    ['a', 'd', 'c', 'e2'],
  ]);
});

test('a loop that can still finish is allowed and each node counts once per path', () => {
  const s = normalizeScenario({
    nodes: [screen('a', 'd'), decision('d', [['Retry', 'r'], ['Finish', 'e1']]), screen('r', 'd'), ending('e1', 100)],
  });

  assert.deepEqual(analyse(s).errors, []);
  assert.equal(analyse(s).stats.acyclic, false);
  assert.equal(analyse(s).stats.paths, 1);
});

test('the best ending is a full-marks attempt, and an unmarked scenario has no maximum', () => {
  assert.equal(maxScore(tree()), 100);
  assert.equal(maxScore(tree({ scoring_option: 'no-score' })), 0);
});

test('an ending is scored against the best, and passing is judged by the pass mark', () => {
  const s = tree();

  assert.deepEqual(outcomeOf(s, 'e1'), { score: 100, max: 100, percent: 100, passed: true });
  assert.deepEqual(outcomeOf(s, 'e2'), { score: 40, max: 100, percent: 40, passed: false });
});

test('a scenario that is not marked reports no verdict rather than a failed 0 of 0', () => {
  const outcome = outcomeOf(tree({ scoring_option: 'no-score' }), 'e1');

  assert.deepEqual(outcome, { score: 0, max: 0, percent: 0, passed: null });
});

test('endings are listed best first', () => {
  assert.deepEqual(endingsOf(tree()).map((n) => n.key), ['e1', 'e2']);
});

// ---------------------------------------------------------------------------
// The player
// ---------------------------------------------------------------------------

const play = (s: BsScenario, ...steps: ((state: PlayState) => PlayState)[]): PlayState =>
  steps.reduce((state, step) => step(state), begin());

test('a learner walks screen, decision, feedback, screen, ending', () => {
  const s = tree();
  let st = begin();
  assert.equal(st.phase, 'start');

  st = start(s, st);
  assert.deepEqual([st.phase, st.nodeKey], ['node', 'a']);

  st = proceed(s, st);
  assert.deepEqual([st.phase, st.nodeKey], ['node', 'd']);

  st = choose(s, st, 0);
  assert.deepEqual([st.phase, st.pending], ['feedback', 0]);
  assert.equal(st.nodeKey, 'd', 'still on the decision while its consequence is shown');

  st = continueFromFeedback(s, st);
  assert.deepEqual([st.phase, st.nodeKey], ['node', 'b']);

  st = proceed(s, st);
  assert.deepEqual([st.phase, st.endingKey], ['end', 'e1']);
  assert.deepEqual(st.found, ['e1']);
  assert.deepEqual(st.trail.map((v) => v.nodeKey), ['a', 'd', 'b']);
});

test('the other choice leads down the other branch', () => {
  const s = tree();
  const st = play(s, (x) => start(s, x), (x) => proceed(s, x), (x) => choose(s, x, 1), (x) => continueFromFeedback(s, x), (x) => proceed(s, x));

  assert.equal(st.endingKey, 'e2');
});

test('actions that do not apply to the current screen change nothing', () => {
  const s = tree();
  const atStart = begin();

  assert.equal(proceed(s, atStart), atStart);
  assert.equal(choose(s, atStart, 0), atStart);
  const onScreen = start(s, atStart);
  assert.equal(choose(s, onScreen, 0), onScreen, 'a screen has no choices');
  const onDecision = proceed(s, onScreen);
  assert.equal(proceed(s, onDecision), onDecision, 'a decision has no continue');
  assert.equal(choose(s, onDecision, 7), onDecision, 'a choice that does not exist');
});

test('back from the consequence returns to the unanswered decision', () => {
  const s = tree();
  const decided = play(s, (x) => start(s, x), (x) => proceed(s, x), (x) => choose(s, x, 1));

  const st = back(s, decided);

  assert.deepEqual([st.phase, st.nodeKey, st.pending], ['node', 'd', null]);
  assert.equal(st.trail.length, 1, 'the earlier screen is still behind it');
});

test('back from an ending returns to the step before it, and back to the start ends at the first node', () => {
  const s = tree();
  const ended = play(s, (x) => start(s, x), (x) => proceed(s, x), (x) => choose(s, x, 0), (x) => continueFromFeedback(s, x), (x) => proceed(s, x));

  const one = back(s, ended);
  assert.deepEqual([one.phase, one.nodeKey, one.endingKey], ['node', 'b', null]);

  const two = back(s, back(s, back(s, one)));
  assert.deepEqual([two.phase, two.nodeKey, two.trail.length], ['node', 'a', 0]);
  assert.equal(canGoBack(s, two), false, 'nothing before the first screen');
  assert.equal(back(s, two), two);
});

test('a scenario that turns back navigation off cannot be walked backwards', () => {
  const s = tree({ enable_backwards_navigation: false });
  const st = play(s, (x) => start(s, x), (x) => proceed(s, x));

  assert.equal(canGoBack(s, st), false);
  assert.equal(back(s, st), st);
});

test('restart goes straight to the first screen and remembers the endings already found', () => {
  const s = tree();
  const ended = play(s, (x) => start(s, x), (x) => proceed(s, x), (x) => choose(s, x, 0), (x) => continueFromFeedback(s, x), (x) => proceed(s, x));

  const again = restart(s, ended);
  assert.deepEqual([again.phase, again.nodeKey, again.trail.length], ['node', 'a', 0]);
  assert.deepEqual(again.found, ['e1']);

  const second = play(s, () => again, (x) => proceed(s, x), (x) => choose(s, x, 1), (x) => continueFromFeedback(s, x), (x) => proceed(s, x));
  assert.deepEqual(second.found, ['e1', 'e2']);
  assert.equal(endingsOf(s).length, 2, '2 of 2 found');
});

test('reaching the same ending twice counts it once', () => {
  const s = tree();
  const route = [(x: PlayState) => start(s, x), (x: PlayState) => proceed(s, x), (x: PlayState) => choose(s, x, 0), (x: PlayState) => continueFromFeedback(s, x), (x: PlayState) => proceed(s, x)];
  const first = play(s, ...route);
  const second = play(s, () => restart(s, first), ...route.slice(1));

  assert.deepEqual(second.found, ['e1']);
});

test('a link to a step that is not there stops the learner with a flag, not a blank screen', () => {
  const s = normalizeScenario({ nodes: [screen('a', 'ghost'), ending('e1', 1)] });

  const st = proceed(s, start(s, begin()));

  assert.equal(st.phase, 'end');
  assert.equal(st.stuck, true);
  assert.equal(st.endingKey, null);
});

test('a scenario with no nodes cannot be started', () => {
  const st = start(normalizeScenario({ nodes: [] }), begin());

  assert.deepEqual([st.phase, st.stuck], ['end', true]);
});

test('the recap lists the decisions made, in order, with how sound each was', () => {
  const s = tree();
  const st = play(s, (x) => start(s, x), (x) => proceed(s, x), (x) => choose(s, x, 1), (x) => continueFromFeedback(s, x), (x) => proceed(s, x));

  const entries = recap(s, st);

  assert.equal(entries.length, 1);
  assert.deepEqual([entries[0].nodeKey, entries[0].choiceText, entries[0].quality], ['d', 'Guess', 'misstep']);
  assert.equal(entries[0].question, 'What do you do now?');
  assert.deepEqual(qualityCounts(entries), { best: 0, partial: 0, misstep: 1, unrated: 0 });
});

// ---------------------------------------------------------------------------
// Choice order
// ---------------------------------------------------------------------------

test('choices keep their order unless the scenario shuffles them', () => {
  const node = tree().nodes[1];

  assert.deepEqual(orderedChoices(node, false, 1).map((c) => c.index), [0, 1]);
});

test('a shuffled order is stable for an attempt, differs between attempts, and reports original indices', () => {
  const s = normalizeScenario({
    nodes: [
      decision('d', [['one', 'e'], ['two', 'e'], ['three', 'e'], ['four', 'e'], ['five', 'e'], ['six', 'e']], { source_question_id: 1 }),
      ending('e', 1),
    ],
  });
  const node = s.nodes[0];

  const a = orderedChoices(node, true, 11).map((c) => c.index);
  const again = orderedChoices(node, true, 11).map((c) => c.index);
  const other = [...Array(30).keys()].map((seed) => orderedChoices(node, true, seed).map((c) => c.index).join());

  assert.deepEqual(a, again, 'the same attempt sees the same order after a back-and-forward');
  assert.deepEqual([...a].sort(), [0, 1, 2, 3, 4, 5], 'nothing lost or repeated');
  assert.ok(new Set(other).size > 1, 'a new attempt shuffles differently');
  for (const { choice, index } of orderedChoices(node, true, 3)) {
    assert.equal(choice, node.choices[index], 'each choice still carries its own original index');
  }
});

// ---------------------------------------------------------------------------
// The checks a teacher sees
// ---------------------------------------------------------------------------

test('a picture without a description blocks publishing but not a draft', () => {
  const s = tree();
  s.nodes[0].mediaPath = 'https://cdn.example.test/a.png';

  assert.ok(analyse(s, true).errors.some((i) => i.code === 'missing_alt'));
  assert.ok(!analyse(s, false).errors.some((i) => i.code === 'missing_alt'));
  assert.ok(analyse(s, false).warnings.some((i) => i.code === 'missing_alt'));
});

test('issues name the step in words and point at its key', () => {
  const s = tree();
  s.nodes.push({ ...s.nodes[2], key: 'orphan', title: 'Left over', next: 'e1' });

  const issue = analyse(s).errors.find((i) => i.code === 'unreachable');

  assert.equal(issue?.node, 'orphan');
  assert.match(issue?.message ?? '', /Step 7 \(Left over\)/);
});

test('the path count is capped so a pathological tree cannot hang the editor', () => {
  const raw: RawNode[] = [screen('a', 'd0')];
  for (let i = 0; i < 14; i++) {
    const next = i === 13 ? 'e1' : `d${i + 1}`;
    raw.push(decision(`d${i}`, [['x', `m${i}`], ['y', `n${i}`]]), screen(`m${i}`, next), screen(`n${i}`, next));
  }
  raw.push(ending('e1', 1));

  const stats = analyse(normalizeScenario({ nodes: raw })).stats;

  assert.equal(stats.paths_capped, true);
  assert.equal(stats.paths, 5000);
});

// ---------------------------------------------------------------------------
// Time
// ---------------------------------------------------------------------------

test('a short scenario is about a minute and a long one is measured on a typical path', () => {
  assert.equal(estimateMinutes(tree()), 1);

  const words = (n: number) => `<p>${Array.from({ length: n }, () => 'word').join(' ')}</p>`;
  const long = normalizeScenario({
    nodes: [
      screen('a', 'd', { body: words(260) }),
      decision('d', [['x', 'b'], ['y', 'c']]),
      screen('b', 'e1', { body: words(260) }),
      screen('c', 'e2', { body: words(1300) }),
      ending('e1', 100),
      ending('e2', 40),
    ],
  });

  // Two paths: 520+ words and 1560+ words. The median of two is the longer one at index 1.
  assert.ok(estimateMinutes(long) >= 4 && estimateMinutes(long) <= 14, String(estimateMinutes(long)));
  assert.equal(estimateMinutes(normalizeScenario({ nodes: [] })), 1);
});
