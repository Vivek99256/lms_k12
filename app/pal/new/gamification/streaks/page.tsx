'use client';

import { useEffect, useState } from 'react';
import { CalendarDays, CheckCircle2, Flame, Info } from 'lucide-react';

import {
  EmptyState,
  GamificationTabs,
  PageShell,
  Pill,
  PrivacyNote,
  ProgressRing,
  QuestHero,
  SectionCard,
  StatTile,
  StatusPanel,
} from '../_components/GamificationChrome';
import { LearnerRequiredPanel, ScopeBar } from '../_components/GamificationScope';
import { useGamificationResource } from '../_components/useGamificationResource';
import {
  fetchStreak,
  fetchStreakHistory,
  formatDate,
  type StreakHistory,
  type StreakSummary,
} from '@/app/pal/new/data/gamification';

/**
 * New PAL → Gamification → Streaks.
 *
 * Two rules from the specification drive this whole screen.
 *
 * A day counts only on real productive engagement, so the ledger below shows
 * days that had activity but did NOT qualify, with what was missing. Silently
 * dropping them would leave a learner thinking their work vanished.
 *
 * The language is growth-focused, never pressure. There is no countdown, no
 * "you broke your streak", and no comparison to classmates anywhere on this
 * page — a reset simply reads as a new streak starting at day one.
 */
export default function StreaksPage() {
  const { state, data, error, reload, refreshing, scope } = useGamificationResource<StreakSummary>(
    (learnerScope, signal) => fetchStreak(learnerScope, signal)
  );

  const [history, setHistory] = useState<StreakHistory | null>(null);
  const [historyError, setHistoryError] = useState('');

  const learnerId = scope.scope.learnerId ?? '';
  useEffect(() => {
    if (state !== 'ready') return;
    let cancelled = false;
    fetchStreakHistory({ learnerId: learnerId || undefined }, 120)
      .then((rows) => {
        if (!cancelled) setHistory(rows);
      })
      .catch((err: unknown) => {
        if (!cancelled) setHistoryError(err instanceof Error ? err.message : 'Could not load the day ledger.');
      });
    return () => {
      cancelled = true;
    };
  }, [state, learnerId]);

  if (state === 'needs-learner') {
    return <LearnerRequiredPanel onSelect={scope.chooseStudent} />;
  }

  if (state === 'loading') {
    return (
      <PageShell>
        <StatusPanel
          kind="loading"
          title="Loading streak"
          message="Rebuilding the day ledger from every recorded piece of productive work."
        />
      </PageShell>
    );
  }

  if (state === 'error' || data === null) {
    return (
      <PageShell>
        <StatusPanel
          kind="error"
          title="Streak is not available"
          message={error || 'The backend did not return a streak payload.'}
          onRetry={reload}
          retrying={refreshing}
        />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <ScopeBar student={scope.student} onExit={scope.clearStudent} />

      <QuestHero
        title="Streaks"
        subtitle="Showing up is the habit the whole system rests on. One missed day is forgiven each week, because illness and school events are not failures of commitment."
        metrics={[
          { label: 'Current streak', value: `${data.currentStreak}d`, hint: data.headline },
          {
            label: 'Longest ever',
            value: `${data.longestStreak}d`,
            hint: data.longestStreakEndedOn ? `ended ${formatDate(data.longestStreakEndedOn)}` : undefined,
          },
          { label: 'Qualifying days', value: String(data.totalActiveDays) },
          {
            label: 'Grace day',
            value: data.graceAvailable ? 'Available' : 'Used',
            hint: data.graceUsedOn ? `last used ${formatDate(data.graceUsedOn)}` : undefined,
          },
        ]}
        onRefresh={reload}
        refreshing={refreshing}
      />

      <GamificationTabs />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
        <SectionCard title="Right now" description={data.headline}>
          <div className="flex flex-col items-center gap-4">
            <ProgressRing
              percent={
                data.longestStreak > 0
                  ? (data.currentStreak / data.longestStreak) * 100
                  : data.currentStreak > 0
                    ? 100
                    : 0
              }
              label={String(data.currentStreak)}
              sublabel={data.currentStreak === 1 ? 'day' : 'days'}
              size={148}
              tone="amber"
            />
            <div className="flex flex-wrap justify-center gap-2">
              <Pill
                label={data.activeToday ? 'Active today' : 'Nothing recorded today yet'}
                tone={data.activeToday ? 'emerald' : 'slate'}
              />
              {data.currentStartedOn ? (
                <Pill label={`Started ${formatDate(data.currentStartedOn)}`} tone="slate" />
              ) : null}
            </div>
          </div>

          <div className="mt-6">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              Milestones
            </h3>
            <ul className="mt-3 space-y-2">
              {data.milestones.map((milestone) => (
                <li
                  key={milestone.days}
                  className={`flex items-center justify-between rounded-xl border px-3.5 py-2.5 text-sm ${
                    milestone.reached
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                      : 'border-slate-200 text-slate-600'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    {milestone.reached ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <Flame className="h-4 w-4 text-slate-300" />
                    )}
                    Day {milestone.days}
                  </span>
                  <span className="text-[11px] font-medium">
                    {milestone.reached ? 'Reached' : 'Not yet'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </SectionCard>

        <div className="space-y-5">
          <SectionCard
            title="What counts as a streak day"
            description="Served by the API from the specification, so the rule the learner is told is the rule the server applies."
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <StatTile
                label="Minimum productive time"
                value={`${data.minProductiveMinutes} min`}
                hint="Opening the app, or watching without interacting, does not count."
                icon={<Info className="h-4 w-4" />}
              />
              <StatTile
                label="Grace period"
                value={`${data.gracePeriodDays} day`}
                hint="One forgiven day per week. Two missed days start a new streak."
              />
            </div>

            <ul className="mt-3 space-y-2">
              {data.qualifyingActivities.map((activity) => (
                <li
                  key={activity.key}
                  className="flex items-center justify-between rounded-xl border border-slate-100 px-3.5 py-2.5"
                >
                  <span className="text-sm text-slate-700">{activity.label}</span>
                  <Pill label={`× ${activity.minCount}`} tone="slate" />
                </li>
              ))}
            </ul>
          </SectionCard>

          <SectionCard
            title="Day ledger"
            description={
              history
                ? `${history.qualifiedDays} qualifying of ${history.activeDays} days with activity, since ${formatDate(history.from)}.`
                : 'Every day with recorded activity, and whether it cleared the bar.'
            }
          >
            {historyError ? (
              <p className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-700">
                {historyError}
              </p>
            ) : null}

            {history === null ? (
              <p className="text-xs text-slate-500">Loading the ledger…</p>
            ) : history.days.length === 0 ? (
              <EmptyState
                title="No activity recorded yet"
                message="The ledger fills in as soon as this learner completes their first practice session."
                icon={<CalendarDays className="h-5 w-5" />}
              />
            ) : (
              <>
                <div className="flex flex-wrap gap-1.5">
                  {history.days
                    .slice()
                    .reverse()
                    .map((day) => (
                      <span
                        key={day.date}
                        title={`${day.date} — ${day.productiveMinutes} min, ${day.qualifyingEvents} qualifying activit${
                          day.qualifyingEvents === 1 ? 'y' : 'ies'
                        }${day.qualified ? '' : ` (${day.shortfall === 'below_minimum_minutes' ? 'below the minute bar' : 'no qualifying activity'})`}`}
                        className={`h-6 w-6 rounded-md ${
                          day.qualified
                            ? 'bg-amber-500'
                            : day.productiveMinutes > 0
                              ? 'bg-amber-100'
                              : 'bg-slate-100'
                        }`}
                      />
                    ))}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <span className="h-3 w-3 rounded bg-amber-500" /> qualified
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-3 w-3 rounded bg-amber-100" /> activity, below the bar
                  </span>
                </div>

                <ul className="mt-4 divide-y divide-slate-100">
                  {history.days.slice(0, 14).map((day) => (
                    <li key={day.date} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-800">{formatDate(day.date)}</p>
                        <p className="mt-0.5 text-[11px] text-slate-500">
                          {day.productiveMinutes.toFixed(1)} min · {day.conceptCount} concept
                          {day.conceptCount === 1 ? '' : 's'}
                          {day.qualifyingActivities.length > 0
                            ? ` · ${day.qualifyingActivities.join(', ').replace(/_/g, ' ')}`
                            : ''}
                        </p>
                      </div>
                      <Pill
                        label={
                          day.qualified
                            ? 'Counted'
                            : day.shortfall === 'below_minimum_minutes'
                              ? `Under ${data.minProductiveMinutes} min`
                              : 'No qualifying activity'
                        }
                        tone={day.qualified ? 'emerald' : 'slate'}
                      />
                    </li>
                  ))}
                </ul>
              </>
            )}
          </SectionCard>
        </div>
      </div>

      {data.nearMisses.length > 0 ? (
        <SectionCard
          title="Days that nearly counted"
          description="Real work that did not clear the bar. Shown so the rule is transparent — never as a reprimand."
          tone="muted"
        >
          <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {data.nearMisses.map((day) => (
              <li key={day.date} className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5">
                <p className="text-sm font-medium text-slate-800">{formatDate(day.date)}</p>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  {day.productiveMinutes.toFixed(1)} min of measured work —{' '}
                  {day.shortfall === 'below_minimum_minutes'
                    ? `${data.minProductiveMinutes} minutes are needed for a day to count.`
                    : 'no full learning cell, review set, peer teaching or challenge contribution.'}
                </p>
              </li>
            ))}
          </ul>
        </SectionCard>
      ) : null}

      <PrivacyNote>
        <strong className="font-semibold text-slate-800">Language rules.</strong> A reset streak is
        framed as a new streak starting, never as one that was broken. There are no countdowns, no
        &quot;hours left&quot; warnings, and no comparison to classmates&apos; streaks anywhere in this
        module.
      </PrivacyNote>
    </PageShell>
  );
}
