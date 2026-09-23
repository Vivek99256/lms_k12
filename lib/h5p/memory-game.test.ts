import test from 'node:test';
import assert from 'node:assert/strict';

import {
  activeMemoryPairs,
  buildMemoryBoard,
  memoryFeedback,
  scoreMemoryAttempt,
  tilesMatch,
  type MemoryDeckRules,
  type ScorableMemoryCard,
} from './memory-game';

/**
 * The failure this file exists to prevent is a board that cannot be completed.
 * It looks like a shuffling bug from the outside and is nearly always the
 * pair/tile translation: a row is a PAIR and a tile is half a row, and code
 * that treats one as the other produces an odd board, or a board where a tile
 * matches itself, or one where two tiles from different rows match.
 */

/** Ids are non-sequential on purpose: an id used as an index would show up. */
function cards(): ScorableMemoryCard[] {
  return [
    {
      id: 41,
      pair_set: 1,
      front_type: 'image',
      front_text: null,
      front_image: 'kerala.png',
      front_alt: 'Outline of Kerala.',
      back_type: 'text',
      back_text: 'Thiruvananthapuram',
      back_image: null,
      back_alt: null,
      match_description: 'Thiruvananthapuram is the capital of Kerala.',
      sort_order: 0,
    },
    {
      id: 17,
      pair_set: 1,
      front_type: 'image',
      front_text: null,
      front_image: 'assam.png',
      front_alt: 'Outline of Assam.',
      back_type: 'text',
      back_text: 'Dispur',
      back_image: null,
      back_alt: null,
      match_description: null,
      sort_order: 1,
    },
    {
      id: 93,
      pair_set: 2,
      front_type: 'text',
      front_text: 'Goa',
      front_image: null,
      front_alt: null,
      back_type: 'text',
      back_text: 'Panaji',
      back_image: null,
      back_alt: null,
      match_description: null,
      sort_order: 2,
    },
  ];
}

function rules(overrides: Partial<MemoryDeckRules> = {}): MemoryDeckRules {
  return { pairs_to_use: 0, active_pair_sets: null, shuffle_cards: true, ...overrides };
}

// ---------------------------------------------------------------------------
// Selection
// ---------------------------------------------------------------------------

test('every pair is in play by default', () => {
  assert.equal(activeMemoryPairs(cards(), rules()).length, 3);
});

test('pair sets filter the deck', () => {
  const selected = activeMemoryPairs(cards(), rules({ active_pair_sets: [2] }));

  assert.equal(selected.length, 1);
  assert.equal(selected[0].id, 93);
});

test('an empty set list means every set, not no sets', () => {
  // A deck that dealt zero pairs because the author cleared the filter would
  // be an unplayable board with no error anywhere.
  assert.equal(activeMemoryPairs(cards(), rules({ active_pair_sets: [] })).length, 3);
});

test('the pair limit applies after the set filter', () => {
  const selected = activeMemoryPairs(cards(), rules({ active_pair_sets: [1], pairs_to_use: 1 }));

  assert.equal(selected.length, 1);
  assert.equal(selected[0].id, 41);
});

// ---------------------------------------------------------------------------
// Board
// ---------------------------------------------------------------------------

test('the board has two tiles per pair', () => {
  const board = buildMemoryBoard(cards(), rules(), 7);

  assert.equal(board.length, 6);
  assert.equal(new Set(board.map((t) => t.key)).size, 6);
});

test('exactly two tiles carry each pair id', () => {
  const board = buildMemoryBoard(cards(), rules(), 7);

  for (const id of [41, 17, 93]) {
    assert.equal(board.filter((t) => t.pairId === id).length, 2, `pair ${id}`);
  }
});

test('a tile never matches itself and never matches another pair', () => {
  const board = buildMemoryBoard(cards(), rules(), 7);

  for (const a of board) {
    assert.equal(tilesMatch(a, a), false);

    const partners = board.filter((b) => tilesMatch(a, b));
    assert.equal(partners.length, 1, `${a.key} should have exactly one partner`);
    assert.equal(partners[0].pairId, a.pairId);
  }
});

test('the same seed always deals the same board', () => {
  assert.deepEqual(buildMemoryBoard(cards(), rules(), 4242), buildMemoryBoard(cards(), rules(), 4242));
});

test('shuffling off deals front-then-back in author order', () => {
  const board = buildMemoryBoard(cards(), rules({ shuffle_cards: false }), 1);

  assert.deepEqual(
    board.map((t) => t.key),
    ['41:front', '41:back', '17:front', '17:back', '93:front', '93:back']
  );
});

test('shuffling actually moves the tiles', () => {
  const ordered = buildMemoryBoard(cards(), rules({ shuffle_cards: false }), 1).map((t) => t.key);

  // Several seeds, because any single shuffle may legitimately land on the
  // identity permutation.
  const moved = [1, 2, 3, 4, 5].some(
    (seed) => buildMemoryBoard(cards(), rules(), seed).map((t) => t.key).join('|') !== ordered.join('|')
  );

  assert.equal(moved, true);
});

test('a text tile with no alt text still announces its word', () => {
  const board = buildMemoryBoard(cards(), rules({ shuffle_cards: false }), 1);
  const capital = board.find((t) => t.key === '41:back');

  assert.equal(capital?.alt, 'Thiruvananthapuram');
});

test('a mixed pair keeps both face types', () => {
  const board = buildMemoryBoard(cards(), rules({ shuffle_cards: false }), 1);

  assert.equal(board.find((t) => t.key === '41:front')?.type, 'image');
  assert.equal(board.find((t) => t.key === '41:back')?.type, 'text');
});

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

test('pairs mode ignores how many moves it took', () => {
  const quick = scoreMemoryAttempt(3, 3, 3, { scoring_mode: 'pairs', points_per_pair: 2, pass_percentage: 100 });
  const slow = scoreMemoryAttempt(3, 3, 30, { scoring_mode: 'pairs', points_per_pair: 2, pass_percentage: 100 });

  assert.equal(quick.score, 6);
  assert.equal(slow.score, 6);
  assert.equal(slow.percentage, 100);
  assert.equal(slow.passed, true);
});

test('moves mode scales the score by efficiency', () => {
  const perfect = scoreMemoryAttempt(4, 4, 4, { scoring_mode: 'moves', points_per_pair: 1, pass_percentage: 60 });
  assert.equal(perfect.score, 4);
  assert.equal(perfect.percentage, 100);

  // Twice the minimum moves is half the marks.
  const doubled = scoreMemoryAttempt(4, 4, 8, { scoring_mode: 'moves', points_per_pair: 1, pass_percentage: 60 });
  assert.equal(doubled.score, 2);
  assert.equal(doubled.percentage, 50);
  assert.equal(doubled.passed, false);
});

test('moves mode never awards more than full marks', () => {
  // Fewer moves than pairs is impossible in play, but it must not be
  // representable as a score above the maximum either.
  const result = scoreMemoryAttempt(4, 4, 1, { scoring_mode: 'moves', points_per_pair: 1, pass_percentage: 60 });

  assert.equal(result.score, 4);
  assert.equal(result.percentage, 100);
});

test('a cleared board is completed even when it did not pass', () => {
  const result = scoreMemoryAttempt(4, 4, 40, { scoring_mode: 'moves', points_per_pair: 1, pass_percentage: 60 });

  assert.equal(result.completed, true);
  assert.equal(result.passed, false);
});

test('an abandoned board is not completed', () => {
  const result = scoreMemoryAttempt(2, 4, 6, { scoring_mode: 'pairs', points_per_pair: 1, pass_percentage: 50 });

  assert.equal(result.completed, false);
  assert.equal(result.percentage, 50);
  assert.equal(result.passed, true);
});

test('matched pairs cannot exceed the total', () => {
  const result = scoreMemoryAttempt(9, 3, 9, { scoring_mode: 'pairs', points_per_pair: 1, pass_percentage: 100 });

  assert.equal(result.matchedPairs, 3);
  assert.equal(result.percentage, 100);
});

test('an empty deck scores zero rather than NaN', () => {
  const result = scoreMemoryAttempt(0, 0, 0, { scoring_mode: 'pairs', points_per_pair: 1, pass_percentage: 0 });

  assert.equal(result.percentage, 0);
  assert.equal(result.completed, false);
  assert.ok(!Number.isNaN(result.percentage));
});

test('the last matching feedback band wins', () => {
  const bands = [
    { from: 0, to: 100, feedback: 'Played.' },
    { from: 100, to: 100, feedback: 'All matched.' },
  ];

  assert.equal(memoryFeedback(100, bands), 'All matched.');
  assert.equal(memoryFeedback(50, bands), 'Played.');
});
