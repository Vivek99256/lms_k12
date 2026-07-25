'use client';

import { useCallback, useEffect, useState } from 'react';
import { Activity, AlertTriangle, Award, Loader2, Medal, RefreshCw, Trophy } from 'lucide-react';

import { cn } from '@/lib/utils';
import { fetchLeaderBoard, type LeaderBoard } from '@/app/lms/data/leaderBoard';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}

export default function LeaderBoardPage() {
  const [board, setBoard] = useState<LeaderBoard | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState('');

  const load = useCallback((signal?: AbortSignal) => {
    setLoading(true);
    setErrorText('');
    fetchLeaderBoard(signal)
      .then((data) => {
        setBoard(data);
        setLoading(false);
      })
      .catch((error: unknown) => {
        if (signal?.aborted) return;
        setBoard(null);
        setErrorText(errorMessage(error));
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => load(controller.signal));
    return () => controller.abort();
  }, [load]);

  return (
    <div className="min-h-full px-4 py-5 sm:px-6">
      <div className="mx-auto w-full max-w-[1100px] space-y-5">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <Trophy className="size-5" />
            </span>
            <div className="min-w-0">
              <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">Leader Board</h1>
              <p className="mt-0.5 text-sm text-slate-500">Your points, medal and class ranking.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => load()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCw className={cn('size-3.5', loading && 'animate-spin')} />
            Refresh
          </button>
        </header>

        {errorText ? (
          <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-700">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <div className="min-w-0 flex-1">{errorText}</div>
          </div>
        ) : null}

        {loading ? (
          <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 px-3 py-20 text-sm text-slate-500">
            <Loader2 className="size-4 animate-spin" /> Loading leader board…
          </div>
        ) : board && board.hasData ? (
          <>
            {/* KPI cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-lg bg-amber-50 text-amber-500">
                    <Award className="size-5" />
                  </span>
                  <div>
                    <p className="text-2xl font-bold text-slate-900">{board.totalPoints}</p>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">My Points</p>
                  </div>
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-lg bg-orange-50 text-orange-500">
                    <Medal className="size-5" />
                  </span>
                  <div>
                    <p className="text-2xl font-bold text-slate-900">{board.medal}</p>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Medal</p>
                  </div>
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-500">
                    <Trophy className="size-5" />
                  </span>
                  <div>
                    <p className="text-2xl font-bold text-slate-900">#{board.rank || '-'}</p>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Class Rank</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {/* Points details */}
              <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
                <header className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
                  <Activity className="size-4 text-indigo-500" />
                  <h3 className="text-sm font-semibold text-slate-900">Points Details</h3>
                </header>
                {board.modules.length === 0 ? (
                  <p className="px-4 py-6 text-center text-sm text-slate-500">No point activity yet.</p>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {board.modules.map((m) => (
                      <li key={m.name} className="flex items-center justify-between gap-3 px-4 py-3">
                        <span className="inline-flex items-center gap-2 text-sm capitalize text-slate-700">
                          <Award className="size-4 text-amber-400" />
                          {m.name}
                        </span>
                        <span className="text-sm font-semibold text-slate-900">{m.points} pts</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {/* Class toppers */}
              <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
                <header className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
                  <Trophy className="size-4 text-amber-500" />
                  <h3 className="text-sm font-semibold text-slate-900">Class Toppers</h3>
                </header>
                {board.toppers.length === 0 ? (
                  <p className="px-4 py-6 text-center text-sm text-slate-500">No class data yet.</p>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {board.toppers.map((t) => (
                      <li
                        key={`${t.rank}-${t.name}`}
                        className={cn(
                          'flex items-center gap-3 px-4 py-3',
                          t.isCurrentUser && 'bg-indigo-50/50'
                        )}
                      >
                        <span
                          className={cn(
                            'flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                            t.rank === 1
                              ? 'bg-amber-100 text-amber-700'
                              : t.rank === 2
                                ? 'bg-slate-200 text-slate-700'
                                : t.rank === 3
                                  ? 'bg-orange-100 text-orange-700'
                                  : 'bg-slate-100 text-slate-500'
                          )}
                        >
                          {t.rank}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">
                          {t.name}
                          {t.isCurrentUser ? <span className="ml-1.5 text-xs text-indigo-500">(you)</span> : null}
                        </span>
                        <span className="text-sm font-semibold text-slate-700">{t.points} pts</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 px-3 py-16 text-center text-sm text-slate-500">
            No leader-board points yet for your account this year.
          </div>
        )}
      </div>
    </div>
  );
}
