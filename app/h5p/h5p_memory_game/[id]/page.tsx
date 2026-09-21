'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Clock, RotateCcw } from 'lucide-react';
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
import { H5pPageHeader, InlineBanner, LoadingState, MissingContextNotice } from '../../components/shared';

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
    <span className="px-1.5 text-center text-xs font-medium leading-tight text-slate-800 sm:text-sm">
      {tile.text || tile.alt}
    </span>
  );
}

function MemoryGamePlayerContent() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';
  const searchParams = useSearchParams();
  const ctx: H5pContext = useMemo(
    () => readH5pContext(new URLSearchParams(searchParams?.toString())),
    [searchParams]
  );
  const contextQuery = h5pContextQuery(ctx);

  const [game, setGame] = useState<H5pMemoryGame | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
        setGame(data);
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
  }, [ctx, id]);

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
    },
    [game, totalPairs, startedAt, ctx]
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

        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
          <span className="tabular-nums">
            {matched.size} of {totalPairs} pairs · {moves} {moves === 1 ? 'turn' : 'turns'}
          </span>
          {game.track_time || limit > 0 ? (
            <span
              className={`inline-flex items-center gap-1.5 tabular-nums ${
                remaining !== null && remaining <= 10 ? 'font-semibold text-red-600' : ''
              }`}
            >
              <Clock className="h-3.5 w-3.5" />
              {remaining !== null ? formatClock(remaining) : formatClock(elapsed)}
            </span>
          ) : null}
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
                className={`flex aspect-square items-center justify-center overflow-hidden rounded-xl border-2 transition ${
                  game.use_grid ? 'w-full' : 'h-20 w-20 sm:h-24 sm:w-24'
                } ${
                  isMatched
                    ? 'border-emerald-300 bg-emerald-50 opacity-70'
                    : faceUp
                      ? 'border-indigo-300 bg-white'
                      : 'border-transparent hover:opacity-90'
                } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2`}
                style={
                  faceUp
                    ? undefined
                    : game.card_back_image
                      ? { backgroundImage: `url(${game.card_back_image})`, backgroundSize: 'cover' }
                      : { backgroundColor: game.theme_color || '#4f46e5' }
                }
              >
                {faceUp ? <TileFace tile={tile} /> : null}
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
          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              {result.completed ? 'Board cleared' : 'Time'}
            </p>
            <p className="mt-2 text-3xl font-semibold tabular-nums text-slate-900">
              {result.score}
              <span className="text-xl text-slate-400"> / {result.maxScore}</span>
            </p>
            <p className="mt-1 text-sm text-slate-600">
              {result.matchedPairs} of {result.totalPairs} pairs in {result.moves}{' '}
              {result.moves === 1 ? 'turn' : 'turns'}
              {game.scoring_mode === 'moves' ? ` · a perfect run is ${result.perfectMoves}` : ''}
              {game.track_time ? ` · ${formatClock(elapsed)}` : ''}
            </p>

            {(() => {
              const message = memoryFeedback(result.percentage, game.feedback_bands) || game.completion_message;
              return message ? <p className="mt-3 text-sm text-slate-700">{message}</p> : null;
            })()}

            {game.allow_retry ? (
              <button
                type="button"
                onClick={reset}
                className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-indigo-700"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Play again
              </button>
            ) : null}
          </div>
        ) : null}
      </>
    );
  };

  return (
    <div className="flex-1 overflow-auto p-4 sm:p-6">
      <div className="mx-auto max-w-3xl">
        <H5pPageHeader
          title={game?.title || 'Memory game'}
          description={game?.description || undefined}
          ctx={ctx}
          backHref={`/h5p/h5p_memory_game?${contextQuery}`}
        />

        {!hasH5pContext(ctx) ? (
          <MissingContextNotice />
        ) : loading ? (
          <LoadingState label="Loading game…" />
        ) : error ? (
          <InlineBanner kind="error" message={error} />
        ) : (
          body()
        )}
      </div>
    </div>
  );
}

export default function MemoryGamePlayerPage() {
  return (
    <Suspense fallback={<LoadingState label="Loading game…" />}>
      <MemoryGamePlayerContent />
    </Suspense>
  );
}
