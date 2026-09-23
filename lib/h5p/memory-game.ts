/**
 * Deck building and scoring for H5P Memory Game (H5P.MemoryGame).
 *
 * Lives in `lib/` rather than beside the player so it can be tested without a
 * browser, a fetch stub or a React tree. It has no imports for the same reason:
 * the inputs are structural, so `app/h5p/data/h5p.ts` can satisfy them with its
 * own richer row types without either side depending on the other.
 *
 * THE ONE THING TO KNOW: A ROW IS A PAIR, A TILE IS HALF A ROW.
 *
 * An authored `card` has two faces. The deck the learner sees is twice as long
 * as the authored list, and a match is "these two tiles came from the same
 * row". Everything in this file exists to keep that translation in one place,
 * because a player that gets it wrong produces a board that cannot be
 * completed and looks, from the outside, like a shuffling bug.
 *
 * Shuffling is SEEDED for the same three reasons generation is in the
 * arithmetic quiz: the tests can assert on real boards, a reload restores the
 * board rather than dealing a new one, and a teacher can reproduce what a
 * learner saw.
 */

export type MemoryFaceType = 'text' | 'image';

export interface ScorableMemoryCard {
  id: number;
  pair_set: number;
  front_type: MemoryFaceType | string;
  front_text: string | null;
  front_image: string | null;
  front_alt: string | null;
  back_type: MemoryFaceType | string;
  back_text: string | null;
  back_image: string | null;
  back_alt: string | null;
  match_description: string | null;
  sort_order: number;
}

export interface MemoryDeckRules {
  /** 0 means every pair in the active sets. */
  pairs_to_use: number;
  /** null or empty means every set. */
  active_pair_sets: number[] | null;
  shuffle_cards: boolean;
}

/** One face-down tile on the board. */
export interface MemoryTile {
  /** Unique within a board: a pair id plus which face it is. */
  key: string;
  /** The row this tile came from. Two tiles match when these are equal. */
  pairId: number;
  side: 'front' | 'back';
  type: MemoryFaceType;
  text: string;
  image: string;
  /** What a screen reader announces for this tile once it is turned. */
  alt: string;
  matchDescription: string;
}

// ---------------------------------------------------------------------------
// Selection
// ---------------------------------------------------------------------------

/**
 * The pairs actually dealt.
 *
 * Two filters, in the order an author thinks about them: which SETS are in
 * play, then how many pairs to take from them. This mirrors
 * `H5pMemoryGame::activeCards()` on the server exactly, so the board a learner
 * gets and the max score the analytics pipeline records cannot disagree.
 */
export function activeMemoryPairs(cards: ScorableMemoryCard[], rules: MemoryDeckRules): ScorableMemoryCard[] {
  let selected = [...(cards ?? [])];

  const sets = rules.active_pair_sets;
  if (Array.isArray(sets) && sets.length > 0) {
    const wanted = new Set(sets.map(Number));
    selected = selected.filter((card) => wanted.has(Number(card.pair_set)));
  }

  const limit = Math.max(0, Math.floor(Number(rules.pairs_to_use) || 0));
  if (limit > 0) selected = selected.slice(0, limit);

  return selected;
}

// ---------------------------------------------------------------------------
// Board
// ---------------------------------------------------------------------------

function faceOf(card: ScorableMemoryCard, side: 'front' | 'back'): MemoryTile {
  const type = (side === 'front' ? card.front_type : card.back_type) === 'text' ? 'text' : 'image';
  const text = (side === 'front' ? card.front_text : card.back_text) ?? '';
  const image = (side === 'front' ? card.front_image : card.back_image) ?? '';
  const alt = (side === 'front' ? card.front_alt : card.back_alt) ?? '';

  return {
    key: `${card.id}:${side}`,
    pairId: card.id,
    side,
    type,
    text,
    image,
    // A tile is never unannounced. The alt text first, then the word on a text
    // tile, then a positional fallback -- a picture tile with no alt text is
    // an authoring problem that publish refuses, but a draft is allowed to be
    // unfinished and still has to be playable.
    alt: alt || text || `Card ${card.sort_order + 1}`,
    matchDescription: card.match_description ?? '',
  };
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function newMemorySeed(): number {
  return Math.floor(Math.random() * 0xffffffff) >>> 0;
}

/**
 * Build the board.
 *
 * Shuffled with Fisher-Yates, which is the only in-place shuffle that is
 * uniform. `sort(() => random() - 0.5)` is the common alternative and is not:
 * it leaves tiles near where they started, which on a memory board is
 * immediately obvious to anyone who plays it twice.
 *
 * `shuffle_cards: false` deals front-then-back in author order, which is what
 * a teacher walking a class through a fixed board asked for.
 */
export function buildMemoryBoard(
  cards: ScorableMemoryCard[],
  rules: MemoryDeckRules,
  seed: number
): MemoryTile[] {
  const pairs = activeMemoryPairs(cards, rules);

  const tiles: MemoryTile[] = [];
  for (const card of pairs) {
    tiles.push(faceOf(card, 'front'));
    tiles.push(faceOf(card, 'back'));
  }

  if (!rules.shuffle_cards) return tiles;

  const random = mulberry32(seed);
  for (let i = tiles.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
  }

  return tiles;
}

/** Two tiles match when they are different tiles from the same pair. */
export function tilesMatch(a: MemoryTile, b: MemoryTile): boolean {
  return a.key !== b.key && a.pairId === b.pairId;
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

export type MemoryScoringMode = 'pairs' | 'moves';

export interface MemoryScoringRules {
  scoring_mode: MemoryScoringMode | string;
  points_per_pair: number;
  pass_percentage: number;
}

export interface MemoryAttemptResult {
  matchedPairs: number;
  totalPairs: number;
  /** A move is one pair of tiles turned over, matching or not. */
  moves: number;
  /** The fewest moves this board could have been cleared in. */
  perfectMoves: number;
  score: number;
  maxScore: number;
  percentage: number;
  passed: boolean;
  /** True when the whole board was cleared, whatever the score. */
  completed: boolean;
}

/**
 * Score an attempt.
 *
 * TWO MODES, BECAUSE THEY MEASURE DIFFERENT THINGS.
 *
 *   pairs  one point per matched pair. Measures recall of the CONTENT — did
 *          the learner know Kerala goes with Thiruvananthapuram?
 *
 *   moves  the same points, scaled by efficiency: a board cleared in the
 *          minimum number of moves scores full marks, and every extra move
 *          costs. Measures recall of the BOARD — working memory, which is
 *          what a teacher using this for early-years recall is after.
 *
 * `moves` scales the whole score rather than penalising per pair, so the two
 * modes share one max score and `maxScore` does not branch. Efficiency is
 * clamped to [0, 1]: a learner cannot score more than full marks by clearing
 * a board in fewer moves than the minimum, which is impossible anyway but
 * would otherwise be representable.
 */
export function scoreMemoryAttempt(
  matchedPairs: number,
  totalPairs: number,
  moves: number,
  rules: MemoryScoringRules
): MemoryAttemptResult {
  const pointsPerPair = Math.max(1, Math.floor(Number(rules.points_per_pair) || 1));
  const matched = Math.max(0, Math.min(matchedPairs, totalPairs));
  const maxScore = totalPairs * pointsPerPair;

  // The best possible play: every pair found in one move. Never zero, so the
  // efficiency division below is always safe.
  const perfectMoves = Math.max(1, totalPairs);

  let score = matched * pointsPerPair;

  if (rules.scoring_mode === 'moves' && moves > 0) {
    const efficiency = Math.max(0, Math.min(1, perfectMoves / moves));
    score = Math.round(matched * pointsPerPair * efficiency);
  }

  const percentage = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;

  return {
    matchedPairs: matched,
    totalPairs,
    moves,
    perfectMoves,
    score,
    maxScore,
    percentage,
    passed: percentage >= Math.max(0, Math.min(100, Number(rules.pass_percentage) || 0)),
    // Completion is about the BOARD, not the score. A learner who cleared it
    // inefficiently in `moves` mode has finished the activity even though
    // they did not pass it, and the analytics contract wants both facts.
    completed: totalPairs > 0 && matched === totalPairs,
  };
}

/** The feedback message for a percentage. Last matching band wins. */
export function memoryFeedback(
  percentage: number,
  bands: Array<{ from: number; to: number; feedback?: string }> | null | undefined
): string {
  let message = '';
  for (const band of bands ?? []) {
    if (percentage >= band.from && percentage <= band.to && band.feedback) {
      message = band.feedback;
    }
  }
  return message;
}
