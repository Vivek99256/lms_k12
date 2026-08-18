'use client';

import { useState } from 'react';
import { ArrowUpRight, History, Trophy } from 'lucide-react';

import {
  EmptyState,
  GamificationTabs,
  PageShell,
  Pill,
  PrivacyNote,
  QuestHero,
  SectionCard,
  StatusPanel,
} from '../_components/GamificationChrome';
import { LearnerRequiredPanel, ScopeBar } from '../_components/GamificationScope';
import { useGamificationResource } from '../_components/useGamificationResource';
import {
  fetchPersonalBest,
  fetchPersonalBestHistory,
  formatDate,
  formatMetric,
  type PersonalBestBoard,
  type PersonalBestEventRow,
} from '@/app/pal/new/data/gamification';

/**
 * New PAL → Gamification → Personal best.
 *
 * The screen that carries the module's central idea: this learner competes only
 * against their own prior performance. A record card therefore always shows the
 * pair — the value now, and the value it beat — and nothing on this page can
 * express a comparison to anybody else. There is no rank, no class average and
 * no "better than N students", because there is no field for one.
 */
export default function PersonalBestPage() {
  const { state, data, error, reload, refreshing, scope } = useGamificationResource<PersonalBestBoard>(
    (learnerScope, signal) => fetchPersonalBest(learnerScope, signal)
  );

  const [history, setHistory] = useState<PersonalBestEventRow[] | null>(null);
  const [historyError, setHistoryError] = useState('');
  const [loadingHistory, setLoadingHistory] = useState(false);

  const loadHistory = async () => {
    setLoadingHistory(true);
    setHistoryError('');
    try {
      setHistory(await fetchPersonalBestHistory(scope.scope, 50));
    } catch (err) {
      setHistoryError(err instanceof Error ? err.message : 'Could not load the record history.');
    } finally {
      setLoadingHistory(false);
    }
  };

  if (state === 'needs-learner') {
    return <LearnerRequiredPanel onSelect={scope.chooseStudent} />;
  }

  if (state === 'loading') {
    return (
      <PageShell>
        <StatusPanel
          kind="loading"
          title="Loading personal bests"
          message="Re-measuring every metric from this learner's real activity."
        />
      </PageShell>
    );
  }

  if (state === 'error' || data === null) {
    return (
      <PageShell>
        <StatusPanel
          kind="error"
          title="Personal bests are not available"
          message={error || 'The backend did not return a personal-best payload.'}
          onRetry={reload}
          retrying={refreshing}
        />
      </PageShell>
    );
  }

  const totalImproved = data.groups
    .flatMap((group) => group.records)
    .filter((record) => record.previousValue !== null).length;

  return (
    <PageShell>
      <ScopeBar student={scope.student} onExit={scope.clearStudent} />

      <QuestHero
        title="Personal best"
        subtitle="Every record here is this learner against their own earlier self. A learner improving from 0.40 to 0.65 has moved exactly as far as one improving from 0.80 to 0.93 — and the system treats both the same."
        metrics={[
          { label: 'Records tracked', value: String(data.totalRecords) },
          { label: 'Records broken', value: String(totalImproved), hint: 'Beaten at least once' },
          { label: 'Groups', value: String(data.groups.length) },
        ]}
        onRefresh={reload}
        refreshing={refreshing}
      />

      <GamificationTabs />

      <SectionCard title="Where it stands" description={data.headline}>
        {data.groups.length === 0 ? (
          <EmptyState
            title="No records yet"
            message="A record appears the first time a metric can be measured from real activity. Nothing is pre-filled."
            icon={<Trophy className="h-5 w-5" />}
          />
        ) : (
          <div className="space-y-6">
            {data.groups.map((group) => (
              <div key={group.group}>
                <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                  {group.label}
                </h3>
                <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {group.records.map((record) => {
                    const beaten = record.previousValue !== null;
                    const improved =
                      record.improvementPct !== null &&
                      (record.direction === 'lower'
                        ? record.improvementPct < 0
                        : record.improvementPct > 0);

                    return (
                      <article
                        key={`${record.metricKey}:${record.scopeLabel ?? ''}`}
                        className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_6px_14px_rgba(15,23,42,0.04)]"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-[12px] font-medium text-slate-500">{record.label}</p>
                            {record.scopeLabel ? (
                              <p className="mt-0.5 truncate text-[11px] text-slate-400">
                                {record.scopeLabel}
                              </p>
                            ) : null}
                          </div>
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                            <Trophy className="h-4 w-4" />
                          </span>
                        </div>

                        <p className="mt-3 text-[28px] font-bold leading-none text-slate-900">
                          {formatMetric(record.bestValue, record.format)}
                        </p>

                        {beaten ? (
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <span className="text-[11px] text-slate-500">
                              up from {formatMetric(record.previousValue, record.format)}
                            </span>
                            {record.improvementPct !== null ? (
                              <Pill
                                label={`${record.improvementPct > 0 ? '+' : ''}${record.improvementPct.toFixed(1)}%`}
                                tone={improved ? 'emerald' : 'slate'}
                              />
                            ) : null}
                          </div>
                        ) : (
                          <p className="mt-3 text-[11px] leading-4 text-slate-500">
                            First measurement — this is the baseline to beat, not an achievement yet.
                          </p>
                        )}

                        <p className="mt-3 text-[10px] uppercase tracking-wider text-slate-400">
                          {formatDate(record.bestAchievedAt)}
                        </p>
                      </article>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Every time a record was broken"
        description="The full history — each entry is a moment this learner beat their own previous mark."
        action={
          <button
            type="button"
            onClick={() => void loadHistory()}
            disabled={loadingHistory}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 px-3 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
          >
            <History className="h-3.5 w-3.5" />
            {history === null ? 'Load history' : 'Reload'}
          </button>
        }
      >
        {historyError ? (
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-700">
            {historyError}
          </p>
        ) : null}

        {history === null ? (
          <p className="text-xs text-slate-500">
            The recent records are shown below. Load the full history for everything on file.
          </p>
        ) : null}

        {(history ?? data.recent).length === 0 ? (
          <div className="mt-3">
            <EmptyState
              title="No records broken yet"
              message="A first measurement is a baseline, not a record. The history starts the first time this learner beats one of their own marks."
              icon={<ArrowUpRight className="h-5 w-5" />}
            />
          </div>
        ) : (
          <ol className="mt-3 space-y-2.5">
            {(history ?? data.recent).map((event) => (
              <li
                key={event.id}
                className="flex items-start gap-3 rounded-2xl border border-slate-100 px-3.5 py-3"
              >
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                  <ArrowUpRight className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-5 text-slate-800">{event.message}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                    <span>{event.label}</span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {formatMetric(event.previousValue, event.format)} →{' '}
                      {formatMetric(event.value, event.format)}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{formatDate(event.achievedAt)}</span>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </SectionCard>

      <PrivacyNote>
        <strong className="font-semibold text-slate-800">What this page never shows.</strong> A class
        rank, how many classmates score better, the class average, or another student&apos;s records.
        Those framings are not hidden by this screen — the API has no field for them.
      </PrivacyNote>
    </PageShell>
  );
}
