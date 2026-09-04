'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Award,
  ChevronLeft,
  ChevronRight,
  Crown,
  Medal,
  RefreshCw,
  Sparkles,
  Trophy,
  Users,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { isStudentSession } from '@/app/pal/data/pal-lookups';
import {
  fetchLbFilterOptions,
  fetchLbRankings,
  fetchLeaderBoard,
  type LbFilterOptions,
  type LbRanking,
  type LbRankingPage,
  type LeaderBoard,
} from '@/app/lms/data/leaderBoard';

const PER_PAGE = 20;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

/* -------------------------------------------------------------------------- */
/* Small building blocks                                                      */
/* -------------------------------------------------------------------------- */

function Avatar({ name, src, className }: { name: string; src?: string; className?: string }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <span
        className={cn(
          'flex shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700',
          className
        )}
        aria-hidden
      >
        {initials(name) || '?'}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      onError={() => setFailed(true)}
      className={cn('shrink-0 rounded-full object-cover', className)}
    />
  );
}

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-slate-200/70', className)} aria-hidden />;
}

function StatCard({
  icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  tone: 'amber' | 'indigo' | 'emerald';
}) {
  const tones = {
    amber: 'bg-amber-50 text-amber-600',
    indigo: 'bg-indigo-50 text-indigo-600',
    emerald: 'bg-emerald-50 text-emerald-600',
  } as const;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <span className={cn('flex size-10 items-center justify-center rounded-xl', tones[tone])}>{icon}</span>
        <div className="min-w-0">
          <p className="truncate text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
          <p className="mt-1 text-2xl font-bold leading-none text-slate-900">{value}</p>
          {hint ? <p className="mt-1.5 truncate text-xs text-slate-500">{hint}</p> : null}
        </div>
      </div>
    </div>
  );
}

/** Top three, on a podium: silver, gold (raised), bronze. */
function Podium({ toppers }: { toppers: LbRanking[] }) {
  const [first, second, third] = [toppers[0], toppers[1], toppers[2]];
  const order = [second, first, third];

  const styles = [
    { ring: 'ring-slate-300', chip: 'bg-slate-200 text-slate-700', pad: 'sm:mt-8', label: '2nd' },
    { ring: 'ring-amber-300', chip: 'bg-amber-100 text-amber-800', pad: '', label: '1st' },
    { ring: 'ring-orange-300', chip: 'bg-orange-100 text-orange-800', pad: 'sm:mt-12', label: '3rd' },
  ];

  return (
    <section className="rounded-2xl border border-slate-200 bg-gradient-to-b from-indigo-50/60 to-white p-5 shadow-sm">
      <header className="mb-4 flex items-center gap-2">
        <Crown className="size-4 text-amber-500" />
        <h2 className="text-sm font-semibold text-slate-900">Top performers</h2>
      </header>

      <ol className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {order.map((entry, index) =>
          entry ? (
            <li
              key={entry.userId}
              className={cn(
                'flex flex-col items-center rounded-xl border border-slate-200 bg-white px-4 py-5 text-center shadow-sm',
                styles[index].pad,
                entry.isCurrentUser && 'border-indigo-300 ring-1 ring-indigo-200'
              )}
            >
              <Avatar name={entry.name} src={entry.avatarUrl} className={cn('size-14 ring-2', styles[index].ring)} />
              <span
                className={cn(
                  'mt-3 rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide',
                  styles[index].chip
                )}
              >
                {styles[index].label}
              </span>
              <p className="mt-2 line-clamp-2 text-sm font-semibold text-slate-900">{entry.name}</p>
              <p className="mt-1 text-sm font-bold text-indigo-600">{entry.points.toLocaleString('en-IN')} pts</p>
              {entry.isCurrentUser ? (
                <span className="mt-1 text-[11px] font-medium text-indigo-500">That is you</span>
              ) : null}
            </li>
          ) : (
            <li
              key={`empty-${index}`}
              className={cn(
                'flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-xs text-slate-400',
                styles[index].pad
              )}
            >
              Position {styles[index].label} is open
            </li>
          )
        )}
      </ol>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Page                                                                        */
/* -------------------------------------------------------------------------- */

export default function LeaderBoardPage() {
  const [isStudent, setIsStudent] = useState(true);

  const [board, setBoard] = useState<LeaderBoard | null>(null);
  const [options, setOptions] = useState<LbFilterOptions | null>(null);
  const [rankings, setRankings] = useState<LbRankingPage | null>(null);

  const [loading, setLoading] = useState(true);
  const [rankingLoading, setRankingLoading] = useState(true);
  const [errorText, setErrorText] = useState('');

  const [syear, setSyear] = useState('');
  const [standardId, setStandardId] = useState('');
  const [moduleName, setModuleName] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    // Deferred: the session lives in localStorage, so this can only run on the
    // client, and setting state synchronously in an effect body cascades.
    queueMicrotask(() => setIsStudent(isStudentSession()));
  }, []);

  // Summary + filter options.
  const loadSummary = useCallback(
    (signal?: AbortSignal) => {
      setLoading(true);
      setErrorText('');

      Promise.all([fetchLeaderBoard(syear || undefined, signal), fetchLbFilterOptions(signal)])
        .then(([summary, filterOptions]) => {
          if (signal?.aborted) return;
          setBoard(summary);
          setOptions(filterOptions);
          setLoading(false);
        })
        .catch((error: unknown) => {
          if (signal?.aborted) return;
          setBoard(null);
          setErrorText(errorMessage(error));
          setLoading(false);
        });
    },
    [syear]
  );

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => loadSummary(controller.signal));
    return () => controller.abort();
  }, [loadSummary]);

  // Full ranking table.
  useEffect(() => {
    const controller = new AbortController();

    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      setRankingLoading(true);

      fetchLbRankings(
        { standardId: standardId || undefined, moduleName: moduleName || undefined, page, perPage: PER_PAGE },
        controller.signal
      )
        .then((result) => {
          if (controller.signal.aborted) return;
          setRankings(result);
          setRankingLoading(false);
        })
        .catch(() => {
          if (controller.signal.aborted) return;
          setRankings(null);
          setRankingLoading(false);
        });
    });

    return () => controller.abort();
  }, [standardId, moduleName, page, syear]);

  const maxPoints = useMemo(
    () => Math.max(1, ...(rankings?.items ?? []).map((row) => row.points)),
    [rankings]
  );

  const classLabel = board && board.standardName ? `Class ${board.standardName}${board.sectionName ? `/${board.sectionName}` : ''}` : '';

  return (
    <div className="min-h-full  px-4 py-5 sm:px-6">
      <div className="mx-auto w-full  space-y-5">
        {/* Header ---------------------------------------------------------- */}
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
              <Trophy className="size-5" />
            </span>
            <div className="min-w-0">
              <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">Leader board</h1>
              <p className="mt-0.5 text-sm text-slate-500">
                Points earned across learning activities, and how the class is placed.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {options && options.syears.length > 0 ? (
              <label className="sr-only" htmlFor="lb-syear">
                Academic year
              </label>
            ) : null}
            {options && options.syears.length > 0 ? (
              <select
                id="lb-syear"
                value={syear}
                onChange={(event) => {
                  setSyear(event.target.value);
                  setPage(1);
                }}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">Current year</option>
                {options.syears.map((year) => (
                  <option key={year} value={String(year)}>
                    {year}
                  </option>
                ))}
              </select>
            ) : null}

            <button
              type="button"
              onClick={() => loadSummary()}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
            >
              <RefreshCw className={cn('size-3.5', loading && 'animate-spin')} />
              Refresh
            </button>
          </div>
        </header>

        {/* Error ----------------------------------------------------------- */}
        {errorText ? (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-700"
          >
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <div className="min-w-0 flex-1">
              {errorText}
              <button
                type="button"
                onClick={() => loadSummary()}
                className="ml-2 font-semibold underline underline-offset-2"
              >
                Try again
              </button>
            </div>
          </div>
        ) : null}

        {/* Summary --------------------------------------------------------- */}
        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
        ) : board ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard
              tone="amber"
              icon={<Award className="size-5" />}
              label="My points"
              value={board.totalPoints.toLocaleString('en-IN')}
              hint={board.syear ? `Academic year ${board.syear}` : undefined}
            />
            <StatCard
              tone="indigo"
              icon={<Trophy className="size-5" />}
              label="Class rank"
              value={board.rank ? `#${board.rank}` : '—'}
              hint={board.classSize ? `Out of ${board.classSize} ranked learners` : 'No ranked learners yet'}
            />
            <StatCard
              tone="emerald"
              icon={<Medal className="size-5" />}
              label="Medal"
              value={board.medal}
              hint={classLabel || undefined}
            />
          </div>
        ) : null}

        {/* Podium ---------------------------------------------------------- */}
        {loading ? (
          <Skeleton className="h-56" />
        ) : board && board.toppers.length > 0 ? (
          <Podium toppers={board.toppers} />
        ) : null}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
          {/* Points breakdown --------------------------------------------- */}
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm lg:col-span-2">
            <header className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
              <Sparkles className="size-4 text-indigo-500" />
              <h2 className="text-sm font-semibold text-slate-900">How I earned my points</h2>
            </header>

            {loading ? (
              <div className="space-y-3 p-4">
                <Skeleton className="h-12" />
                <Skeleton className="h-12" />
                <Skeleton className="h-12" />
              </div>
            ) : board && board.modules.length > 0 ? (
              <ul className="divide-y divide-slate-100">
                {board.modules.map((module) => {
                  const share = board.totalPoints > 0 ? Math.round((module.points / board.totalPoints) * 100) : 0;
                  return (
                    <li key={module.moduleName} className="px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-800">{module.label}</p>
                          <p className="truncate text-xs text-slate-500">
                            {module.description || `${module.entries.length} activity record(s)`}
                          </p>
                        </div>
                        <span className="shrink-0 text-sm font-bold tabular-nums text-slate-900">
                          {module.points > 0 ? '+' : ''}
                          {module.points}
                        </span>
                      </div>
                      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={cn('h-full rounded-full', module.points < 0 ? 'bg-rose-400' : 'bg-indigo-500')}
                          style={{ width: `${Math.min(100, Math.abs(share))}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="px-4 py-10 text-center">
                <p className="text-sm font-medium text-slate-700">No points recorded yet</p>
                <p className="mx-auto mt-1 max-w-xs text-xs text-slate-500">
                  Points appear here once activity is credited for the selected academic year.
                </p>
              </div>
            )}
          </section>

          {/* Full ranking -------------------------------------------------- */}
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm lg:col-span-3">
            <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
              <div className="flex items-center gap-2">
                <Users className="size-4 text-indigo-500" />
                <h2 className="text-sm font-semibold text-slate-900">Class ranking</h2>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {!isStudent && options && options.standards.length > 0 ? (
                  <select
                    aria-label="Class"
                    value={standardId}
                    onChange={(event) => {
                      setStandardId(event.target.value);
                      setPage(1);
                    }}
                    className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="">All classes</option>
                    {options.standards.map((standard) => (
                      <option key={standard.id} value={String(standard.id)}>
                        Class {standard.name}
                      </option>
                    ))}
                  </select>
                ) : null}

                {options && options.modules.length > 0 ? (
                  <select
                    aria-label="Activity"
                    value={moduleName}
                    onChange={(event) => {
                      setModuleName(event.target.value);
                      setPage(1);
                    }}
                    className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="">All activities</option>
                    {options.modules.map((module) => (
                      <option key={module.value} value={module.value}>
                        {module.label}
                      </option>
                    ))}
                  </select>
                ) : null}
              </div>
            </header>

            {rankingLoading ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 5 }).map((_, index) => (
                  <Skeleton key={index} className="h-11" />
                ))}
              </div>
            ) : rankings && rankings.items.length > 0 ? (
              <>
                <ul className="divide-y divide-slate-100">
                  {rankings.items.map((row) => (
                    <li
                      key={row.userId}
                      className={cn(
                        'flex items-center gap-3 px-4 py-2.5 transition',
                        row.isCurrentUser ? 'bg-indigo-50/60' : 'hover:bg-slate-50'
                      )}
                    >
                      <span
                        className={cn(
                          'flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums',
                          row.rank === 1
                            ? 'bg-amber-100 text-amber-700'
                            : row.rank === 2
                              ? 'bg-slate-200 text-slate-700'
                              : row.rank === 3
                                ? 'bg-orange-100 text-orange-700'
                                : 'bg-slate-100 text-slate-500'
                        )}
                      >
                        {row.rank}
                      </span>
                      <Avatar name={row.name} src={row.avatarUrl} className="size-8" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-800">
                          {row.name}
                          {row.isCurrentUser ? (
                            <span className="ml-1.5 text-[11px] font-semibold text-indigo-600">you</span>
                          ) : null}
                        </p>
                        <div className="mt-1 h-1 w-full max-w-[220px] overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-indigo-400"
                            style={{ width: `${Math.max(4, Math.round((row.points / maxPoints) * 100))}%` }}
                          />
                        </div>
                      </div>
                      <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-900">
                        {row.points.toLocaleString('en-IN')}
                      </span>
                    </li>
                  ))}
                </ul>

                <footer className="flex items-center justify-between gap-2 border-t border-slate-100 px-4 py-2.5 text-xs text-slate-500">
                  <span>
                    Showing {(rankings.page - 1) * rankings.perPage + 1}–
                    {Math.min(rankings.page * rankings.perPage, rankings.total)} of {rankings.total}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setPage((current) => Math.max(1, current - 1))}
                      disabled={rankings.page <= 1}
                      className="inline-flex items-center rounded-md border border-slate-300 p-1 text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
                      aria-label="Previous page"
                    >
                      <ChevronLeft className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setPage((current) => Math.min(rankings.lastPage, current + 1))}
                      disabled={rankings.page >= rankings.lastPage}
                      className="inline-flex items-center rounded-md border border-slate-300 p-1 text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
                      aria-label="Next page"
                    >
                      <ChevronRight className="size-4" />
                    </button>
                  </div>
                </footer>
              </>
            ) : (
              <div className="px-4 py-12 text-center">
                <p className="text-sm font-medium text-slate-700">No leader board data available</p>
                <p className="mx-auto mt-1 max-w-sm text-xs text-slate-500">
                  Nothing has been credited for this class and academic year yet. Try another year, or ask an
                  administrator to configure the leader board points.
                </p>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
