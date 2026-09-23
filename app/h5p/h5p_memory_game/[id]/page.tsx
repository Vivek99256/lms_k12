'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Clock } from 'lucide-react';
import {
  h5pContextQuery,
  hasH5pContext,
  postH5pXapiStatement,
  readH5pContext,
  type H5pContext,
} from '../../data/h5p';
import { memoryGameApi, type H5pMemoryGame } from '../../data/h5p-content-types';
import {
  buildMemoryBoard,
  memoryFeedback,
  newMemorySeed,
  scoreMemoryAttempt,
  tilesMatch,
  type MemoryTile,
} from '@/lib/h5p/memory-game';
import type { QuestionResult as PlayerQuestionResult } from '@/components/h5p/players/types';
import { H5pPageHeader, InlineBanner, MissingContextNotice } from '../../components/shared';
import {
  PlayerSkeleton,
  ProgressRail,
  ResultScreen,
  RetryAction,
  StatRow,
  deriveAchievements,
} from '../../components/game';

/**
 * Memory game — player.
 *
 * EVERY TILE IS A BUTTON. The whole game is turn-a-card, which a keyboard and
 * a switch can already do if the tiles are real buttons — so they are, and
 * there is no pointer-only path. Each carries its face as its accessible name
 * once turned and "Card N, face down" before, so a learner using a screen
 * reader can build the same mental map a sighted learner does.
 *
 * TWO TURNED TILES LOCK THE BOARD for a beat before flipping back. Without the
 * lock a fast clicker turns three, which is not a memory game. The lock is a
 * piece of state rather than a disabled attribute so the tiles stay focusable
 * throughout — losing focus mid-turn would send a keyboard user back to the
 * top of the board every time they got a pair wrong.
 */

type Turned = { first: MemoryTile | null; second: MemoryTile | null };

function formatClock(seconds: number): string {
  const whole = Math.max(0, Math.round(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

function TileFace({ tile }: { tile: MemoryTile }) {
  if (tile.type === 'image' && tile.image) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={tile.image} alt="" className="h-full w-full rounded-lg object-cover" />;
  }
  return (
    <span className="px-1.5 text-center text-xs font-medium leading-tight text-[color:var(--h5p-ink)] sm:text-sm">
      {tile.text || tile.alt}
    </span>
  );
}

/**
 * A row supplied by the caller instead of fetched by id.
 *
 * This is what makes the player embeddable. The route below still loads by id
 * from the URL, but a caller that already HAS the row -- the question bank
 * library, which builds one in memory from a bank question and never saves it
 * -- hands it over directly and skips the fetch entirely. `embedded` drops the
 * page header, because an embedding surface has its own.
 *
 * Nothing downstream of here knows the difference: the row shape is identical,
 * so scoring, feedback, solutions and xAPI behave exactly as they do for a
 * saved activity.
 */
export interface PreloadedMemoryGame {
  item: H5pMemoryGame;
  ctx: H5pContext;
  embedded?: boolean;
  /**
   * Fired once, where this player already reports completion over xAPI.
   *
   * It is how a module other than the H5P library uses this player: PAL needs
   * the score to advance its state machine and homework needs it to record an
   * attempt. The player still persists nothing itself -- the caller decides.
   */
  onResult?: (result: PlayerQuestionResult) => void;
}

function MemoryGamePlayerContent({ preloaded }: { preloaded?: PreloadedMemoryGame }) {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';
  const searchParams = useSearchParams();
  const routeCtx: H5pContext = useMemo(
    () => readH5pContext(new URLSearchParams(searchParams?.toString())),
    [searchParams]
  );
  const ctx = preloaded?.ctx ?? routeCtx;
  const contextQuery = h5pContextQuery(ctx);

  const [fetchedGame, setFetchedGame] = useState<H5pMemoryGame | null>(null);
  const [loading, setLoading] = useState(!preloaded);
  const [error, setError] = useState('');
  /** Which preloaded board has had its clock started. */
  const initialisedFor = useRef<number | null>(null);

  // Derived rather than copied into state: a preloaded row can change between
  // renders (the library previews a different question), and state seeded once
  // would keep showing the first one.
  const game = preloaded?.item ?? fetchedGame;

  const [seed, setSeed] = useState(() => newMemorySeed());
  const [turned, setTurned] = useState<Turned>({ first: null, second: null });
  const [matched, setMatched] = useState<Set<number>>(new Set());
  const [moves, setMoves] = useState(0);
  // The clock. `startedAt` is seeded when the board loads and re-seeded on
  // reset -- both event-shaped -- and `now` is written only by the interval.
  // Date.now() during render is impure and would drift on every re-render.
  const [startedAt, setStartedAt] = useState(0);
  const [finishedAt, setFinishedAt] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [announcement, setAnnouncement] = useState('');

  useEffect(() => {
    let cancelled = false;

    // The caller supplied the row, so there is nothing to fetch -- but the
    // attempt clock is started BELOW, inside the fetch callback. Leaving it at
    // zero would measure every preview as having begun in 1970.
    if (preloaded) {
      if (initialisedFor.current !== preloaded.item.id) {
        initialisedFor.current = preloaded.item.id;
        queueMicrotask(() => {
          const at = Date.now();
          setStartedAt(at);
          setNow(at);
        });
      }
      return () => {
        cancelled = true;
      };
    }
    if (!hasH5pContext(ctx) || !id) {
      queueMicrotask(() => {
        if (!cancelled) setLoading(false);
      });
      return () => {
        cancelled = true;
      };
    }

    memoryGameApi
      .get(id, ctx)
      .then((data) => {
        if (cancelled) return;
        setFetchedGame(data);
        // The attempt starts when the board does, not when the route was
        // entered -- a slow load must not count against the learner.
        const at = Date.now();
        setStartedAt(at);
        setNow(at);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load game');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [ctx, id, preloaded]);

  const board = useMemo(
    () =>
      game
        ? buildMemoryBoard(game.cards ?? [], {
            pairs_to_use: game.pairs_to_use,
            active_pair_sets: game.active_pair_sets,
            shuffle_cards: game.shuffle_cards,
          }, seed)
        : [],
    [game, seed]
  );

  const totalPairs = board.length / 2;
  const running = game !== null && finishedAt === null && totalPairs > 0;

  // Zero until the board has loaded, rather than the seconds since 1970
  // for the first render.
  const elapsed = startedAt === 0 ? 0 : ((finishedAt ?? Math.max(now, startedAt)) - startedAt) / 1000;
  const limit = game?.time_limit_seconds ?? 0;
  const remaining = limit > 0 ? Math.max(0, limit - elapsed) : null;

  const result = game
    ? scoreMemoryAttempt(matched.size, totalPairs, moves, {
        scoring_mode: game.scoring_mode,
        points_per_pair: game.points_per_pair,
        pass_percentage: game.pass_percentage,
      })
    : null;

  const finish = useCallback(
    (matchedCount: number, moveCount: number) => {
      if (!game) return;
      const at = Date.now();
      setFinishedAt(at);

      const scored = scoreMemoryAttempt(matchedCount, totalPairs, moveCount, {
        scoring_mode: game.scoring_mode,
        points_per_pair: game.points_per_pair,
        pass_percentage: game.pass_percentage,
      });

      void postH5pXapiStatement({
        objectId: `memory_game:${game.id}`,
        verb: 'completed',
        ctx,
        success: scored.passed,
        response: `${scored.matchedPairs}/${scored.totalPairs} pairs in ${moveCount} moves`,
        durationSeconds: (at - startedAt) / 1000,
      });

      preloaded?.onResult?.({
        questionId: Number(game.id),
        score: scored.score,
        maxScore: scored.maxScore,
        correct: scored.passed,
        durationSeconds: (at - startedAt) / 1000,
        response: `${scored.matchedPairs}/${scored.totalPairs} pairs in ${moveCount} moves`,
      });
    },
    [game, totalPairs, startedAt, ctx, preloaded]
  );

  // One interval drives both the displayed clock and the time limit, for
  // the reason the arithmetic quiz player gives: enforcing the limit from
  // an effect reacting to derived state would be a setState in an effect
  // body, whereas an interval callback is an external system reporting in.
  useEffect(() => {
    if (!running || startedAt === 0) return;

    const tick = window.setInterval(() => {
      const at = Date.now();
      setNow(at);
      if (limit > 0 && at - startedAt >= limit * 1000) finish(matched.size, moves);
    }, 500);

    return () => window.clearInterval(tick);
  }, [running, startedAt, limit, matched, moves, finish]);


  const reset = () => {
    setSeed(newMemorySeed());
    setTurned({ first: null, second: null });
    setMatched(new Set());
    setMoves(0);
    // An event handler, so the clock may be read here.
    const at = Date.now();
    setStartedAt(at);
    setFinishedAt(null);
    setNow(at);
    setAnnouncement('');
  };

  const flip = (tile: MemoryTile) => {
    if (!game || finishedAt !== null) return;
    if (matched.has(tile.pairId)) return;
    // The lock: two already turned, nothing else moves until they resolve.
    if (turned.first && turned.second) return;
    if (turned.first?.key === tile.key) return;

    if (!turned.first) {
      setTurned({ first: tile, second: null });
      return;
    }

    const first = turned.first;
    setTurned({ first, second: tile });

    const nextMoves = moves + 1;
    setMoves(nextMoves);

    if (tilesMatch(first, tile)) {
      const nextMatched = new Set(matched);
      nextMatched.add(tile.pairId);
      setMatched(nextMatched);
      setAnnouncement(tile.matchDescription || `Match found: ${first.alt} and ${tile.alt}.`);

      void postH5pXapiStatement({
        objectId: `memory_game:${game.id}`,
        verb: 'answered',
        ctx,
        success: true,
        response: `${first.alt} ↔ ${tile.alt}`,
      });

      // Matched tiles stay face up, so they clear immediately.
      window.setTimeout(() => setTurned({ first: null, second: null }), 600);

      if (nextMatched.size === totalPairs) finish(nextMatched.size, nextMoves);
    } else {
      setAnnouncement('Not a match.');
      void postH5pXapiStatement({
        objectId: `memory_game:${game.id}`,
        verb: 'answered',
        ctx,
        success: false,
        response: `${first.alt} ↔ ${tile.alt}`,
      });
      window.setTimeout(() => setTurned({ first: null, second: null }), 900);
    }
  };

  const isFaceUp = (tile: MemoryTile) =>
    matched.has(tile.pairId) || turned.first?.key === tile.key || turned.second?.key === tile.key;

  const body = () => {
    if (!game) return null;

    if (totalPairs === 0) {
      return (
        <InlineBanner kind="error" message="This game has no pairs in play, so there is nothing to match yet." />
      );
    }

    const finished = finishedAt !== null && result !== null;

    return (
      <>
        {game.task_description ? <p className="mb-4 text-sm text-slate-600">{game.task_description}</p> : null}

        {/* The scoreboard. Sticky, because on a phone the board is taller than
            the viewport and a pairs count that scrolls away is a pairs count
            nobody reads. */}
        <div className="h5p-surface sticky top-2 z-10 mb-4 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <StatRow
              items={[
                { icon: 'target', label: 'Pairs', value: `${matched.size} / ${totalPairs}` },
                { icon: 'zap', label: 'Turns', value: moves },
              ]}
            />
            {game.track_time || limit > 0 ? (
              <span
                className="inline-flex items-center gap-1.5 text-xs font-semibold tabular-nums text-[color:var(--h5p-ink-muted)]"
                style={remaining !== null && remaining <= 10 ? { color: 'var(--h5p-danger)' } : undefined}
              >
                <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                {remaining !== null ? formatClock(remaining) : formatClock(elapsed)}
              </span>
            ) : null}
          </div>

          <ProgressRail value={matched.size} max={totalPairs} label="Pairs matched" className="mt-2.5" />
        </div>

        <div
          className={
            game.use_grid
              ? 'grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6'
              : 'flex flex-wrap justify-center gap-2'
          }
        >
          {board.map((tile, index) => {
            const faceUp = isFaceUp(tile);
            const isMatched = matched.has(tile.pairId);

            return (
              <button
                key={tile.key}
                type="button"
                onClick={() => flip(tile)}
                aria-pressed={faceUp}
                aria-label={faceUp ? tile.alt : `Card ${index + 1}, face down`}
                className={`h5p-flip h5p-focusable h5p-target relative aspect-square rounded-xl ${
                  game.use_grid ? 'w-full' : 'h-20 w-20 sm:h-24 sm:w-24'
                } ${faceUp ? 'is-flipped' : ''} ${isMatched ? 'h5p-halo' : ''}`}
              >
                {/* A real two-faced card rather than a swap of contents: the
                    back stays mounted behind the front, so the turn is one
                    rotation instead of a flicker, and the tile's accessible
                    name (on the button) is unaffected by either face. */}
                <span className="h5p-flip__inner rounded-[inherit]">
                  <span
                    className="h5p-flip__face border-2 border-transparent"
                    aria-hidden="true"
                    style={
                      game.card_back_image
                        ? { backgroundImage: `url(${game.card_back_image})`, backgroundSize: 'cover' }
                        : { backgroundColor: game.theme_color || 'var(--h5p-accent)' }
                    }
                  />
                  <span
                    className="h5p-flip__face h5p-flip__face--back border-2"
                    style={
                      isMatched
                        ? { borderColor: 'var(--h5p-success-line)', background: 'var(--h5p-success-soft)' }
                        : { borderColor: 'var(--h5p-accent-line)', background: 'var(--h5p-surface)' }
                    }
                  >
                    <TileFace tile={tile} />
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        {/* One live region for both the match message and the turn result, so
            a screen reader is told what happened without the board moving. */}
        <p aria-live="polite" className="mt-4 min-h-[1.25rem] text-center text-sm text-slate-600">
          {announcement}
        </p>

        {finished && game.show_completion_screen ? (
          <div className="mt-6">
            <ResultScreen
              headline={result.completed ? 'Board cleared' : 'Time'}
              score={result.score}
              maxScore={result.maxScore}
              percentage={result.percentage}
              passed={result.passed}
              passLabel={`Pass mark is ${game.pass_percentage}%`}
              summary={
                <>
                  {result.matchedPairs} of {result.totalPairs} pairs in {result.moves}{' '}
                  {result.moves === 1 ? 'turn' : 'turns'}
                </>
              }
              facts={[
                ...(game.scoring_mode === 'moves'
                  ? [{ icon: 'target' as const, label: 'Perfect run', value: `${result.perfectMoves} turns` }]
                  : []),
                ...(game.track_time
                  ? [{ icon: 'timer' as const, label: 'Time', value: formatClock(elapsed) }]
                  : []),
              ]}
              achievements={deriveAchievements({
                // A board cleared in the theoretical minimum number of turns is
                // this type's perfect paper — every turn a match — so that, and
                // not a full score, is what earns the flawless badge here. A
                // pairs-mode board scores 100% however many turns it took.
                percentage:
                  result.completed && result.moves <= result.perfectMoves ? 100 : Math.min(99, result.percentage),
                passed: result.passed,
              })}
              message={memoryFeedback(result.percentage, game.feedback_bands) || game.completion_message}
              actions={game.allow_retry ? <RetryAction onClick={reset} label="Play again" /> : null}
            />
          </div>
        ) : null}
      </>
    );
  };

  return (
    <div className="p-4 sm:p-6">
      <div className="mx-auto">
        {preloaded?.embedded ? null : (
        <H5pPageHeader
          title={game?.title || 'Memory game'}
          description={game?.description || undefined}
          ctx={ctx}
          backHref={`/h5p/h5p_memory_game?${contextQuery}`}
        />
        )}

        {!hasH5pContext(ctx) ? (
          <MissingContextNotice />
        ) : loading ? (
          <PlayerSkeleton lines={3} label="Loading game" />
        ) : error ? (
          <InlineBanner kind="error" message={error} />
        ) : (
          body()
        )}
      </div>
    </div>
  );
}

/**
 * The player as a component, for a caller that already holds the row.
 *
 * The Suspense boundary stays, because the body still calls `useSearchParams`
 * even when it does not read it -- hooks cannot be conditional, and an
 * unwrapped `useSearchParams` opts the whole embedding route into client-side
 * rendering.
 */
export function MemoryGamePlayer({ item, ctx, embedded, onResult }: PreloadedMemoryGame) {
  // Memoised, because this object is the load effect's dependency. Passing a
  // fresh one each render re-ran that effect on every render, and its cleanup
  // then cancelled the setup the previous run had just scheduled.
  const preloaded = useMemo(
    () => ({ item, ctx, embedded, onResult }),
    [item, ctx, embedded, onResult]
  );

  return (
    <Suspense fallback={<PlayerSkeleton lines={3} label="Loading activity" />}>
      <MemoryGamePlayerContent preloaded={preloaded} />
    </Suspense>
  );
}

export default function MemoryGamePlayerPage() {
  return (
    <Suspense fallback={<PlayerSkeleton lines={3} label="Loading game" />}>
      <MemoryGamePlayerContent />
    </Suspense>
  );
}
