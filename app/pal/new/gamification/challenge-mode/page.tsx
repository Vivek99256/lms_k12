'use client';

import { useState } from 'react';
import { Ban, Crown, ShieldOff, Swords, ToggleLeft, ToggleRight } from 'lucide-react';

import {
  EmptyState,
  GamificationTabs,
  PageShell,
  PrivacyNote,
  QuestHero,
  SectionCard,
  StatTile,
  StatusPanel,
} from '../_components/GamificationChrome';
import { LearnerRequiredPanel, ScopeBar } from '../_components/GamificationScope';
import { useGamificationResource } from '../_components/useGamificationResource';
import {
  fetchChallengeMode,
  formatDate,
  setChallengeModeOptIn,
  type ChallengeModeState,
} from '@/app/pal/new/data/gamification';

/**
 * New PAL → Gamification → Challenge mode.
 *
 * The only place in PAL V4 where students are shown against each other, and the
 * page is built to make its own fences obvious rather than to hide them:
 * strictly opt-in, Grade 4 and up, switchable off by a teacher, weekly reset,
 * first names only, invisible to parents, and completely separate from mastery.
 *
 * A learner who has not opted in is not shown the leaderboard at all — not even
 * an empty one, which would still be an invitation to compare.
 */
export default function ChallengeModePage() {
  const { state, data, error, reload, refreshing, scope } = useGamificationResource<ChallengeModeState>(
    (learnerScope, signal) => fetchChallengeMode(learnerScope, signal)
  );

  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');

  const toggle = async (next: boolean) => {
    setBusy(true);
    setActionError('');
    try {
      await setChallengeModeOptIn(next, scope.scope);
      reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not change the opt-in.');
    } finally {
      setBusy(false);
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
          title="Loading challenge mode"
          message="Checking eligibility, consent and this week's board."
        />
      </PageShell>
    );
  }

  if (state === 'error' || data === null) {
    return (
      <PageShell>
        <StatusPanel
          kind="error"
          title="Challenge mode is not available"
          message={error || 'The backend did not return a challenge mode payload.'}
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
        title="Challenge mode"
        subtitle="Optional, off by default, and kept entirely separate from learning. A score here never moves mastery, never touches the practice ladder, and never appears in the regular learning path."
        metrics={[
          { label: 'Status', value: data.optedIn ? 'Opted in' : 'Not opted in' },
          {
            label: 'Availability',
            value: data.eligible ? 'Available' : 'Unavailable',
            hint: data.eligible ? `Grade ${data.minGrade}+` : data.eligibilityReason ?? undefined,
          },
          { label: 'Best score', value: data.bestScore === null ? '—' : String(data.bestScore) },
          { label: 'Runs recorded', value: String(data.ownScores.length) },
        ]}
        onRefresh={reload}
        refreshing={refreshing}
      />

      <GamificationTabs />

      {actionError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {actionError}
        </div>
      ) : null}

      {!data.eligible ? (
        <SectionCard title="Not available for this learner">
          <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
            <ShieldOff className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" />
            <div>
              <p className="text-sm font-medium text-slate-800">{data.eligibilityMessage}</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                {data.eligibilityReason === 'disabled_for_class'
                  ? 'A teacher can switch Challenge Mode off for a whole class — exam periods are the usual reason.'
                  : `Challenge Mode opens at Grade ${data.minGrade}. Nothing else about this learner's PAL experience changes.`}
              </p>
            </div>
          </div>
        </SectionCard>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <SectionCard
            title="Your choice"
            description="One toggle, reversible at any time. Opting out removes this learner from the board immediately."
          >
            <button
              type="button"
              onClick={() => void toggle(!data.optedIn)}
              disabled={busy}
              className={`flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-4 text-left transition disabled:opacity-60 ${
                data.optedIn
                  ? 'border-emerald-200 bg-emerald-50 hover:border-emerald-300'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-slate-900">
                  {data.optedIn ? 'You are taking part' : 'You are not taking part'}
                </span>
                <span className="mt-0.5 block text-xs text-slate-500">
                  {data.optedIn
                    ? `Opted in ${formatDate(data.optedInAt)}. Tap to opt out.`
                    : 'Tap to opt in. Nothing about your normal learning changes either way.'}
                </span>
              </span>
              {data.optedIn ? (
                <ToggleRight className="h-7 w-7 shrink-0 text-emerald-600" />
              ) : (
                <ToggleLeft className="h-7 w-7 shrink-0 text-slate-400" />
              )}
            </button>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <StatTile
                label="Affects mastery"
                value={data.affectsMastery ? 'Yes' : 'No'}
                tone={data.affectsMastery ? 'warn' : 'good'}
                hint="Challenge scores are stored separately from every learning signal."
                icon={<Ban className="h-4 w-4" />}
              />
              <StatTile
                label="Items to qualify"
                value={String(data.minItemsToQualify)}
                hint="Fewer than this and a run does not score — a guard against gaming."
              />
            </div>

            <p className="mt-4 text-[11px] leading-4 text-slate-500">
              Scoring is accuracy × speed × difficulty, computed on the server from the real item
              metadata. Answering fast but wrong scores lower than answering slowly and correctly.
            </p>
          </SectionCard>

          <SectionCard
            title="This week's board"
            description={
              data.leaderboard?.weekStart
                ? `Top ${data.leaderboardTopN} for the week of ${formatDate(data.leaderboard.weekStart)}. Resets every week so no ranking cements.`
                : `Top ${data.leaderboardTopN}, reset weekly.`
            }
          >
            {!data.optedIn ? (
              <EmptyState
                title="The board is only for participants"
                message="You have not opted in, so the board is not shown — not even empty. Comparison is something you choose, not something you have to look away from."
                icon={<Crown className="h-5 w-5" />}
              />
            ) : !data.leaderboard || !data.leaderboard.visible ? (
              <EmptyState
                title="Board unavailable"
                message={data.leaderboard?.reason === 'not_visible_to_parents'
                  ? 'Challenge Mode is deliberately invisible to parents, to prevent external pressure.'
                  : 'No board is available for this class right now.'}
                icon={<Crown className="h-5 w-5" />}
              />
            ) : data.leaderboard.entries.length === 0 ? (
              <EmptyState
                title="No scores this week yet"
                message="The board fills in as opted-in classmates complete challenge runs. It clears again next week."
                icon={<Swords className="h-5 w-5" />}
              />
            ) : (
              <>
                <ol className="space-y-2">
                  {data.leaderboard.entries.map((entry) => (
                    <li
                      key={`${entry.position}:${entry.displayName}`}
                      className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 ${
                        entry.isYou ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white'
                      }`}
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <span
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${
                            entry.position === 1
                              ? 'bg-amber-400 text-amber-950'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {entry.position}
                        </span>
                        <span className="min-w-0 truncate text-sm font-medium text-slate-800">
                          {entry.displayName}
                          {entry.isYou ? <span className="ml-1.5 text-xs text-amber-700">(you)</span> : null}
                        </span>
                      </span>
                      <span className="shrink-0 text-sm font-bold text-slate-900">{entry.score}</span>
                    </li>
                  ))}
                </ol>
                <p className="mt-3 text-[11px] text-slate-500">
                  {data.leaderboard.participants} participant
                  {data.leaderboard.participants === 1 ? '' : 's'} this week
                  {data.leaderboard.firstNamesOnly ? ' · first names only' : ''}.
                </p>
              </>
            )}
          </SectionCard>
        </div>
      )}

      <SectionCard
        title="Your runs"
        description="Every scored run on record. These numbers live entirely outside your mastery."
      >
        {data.ownScores.length === 0 ? (
          <EmptyState
            title="No runs yet"
            message="A run is recorded when a Challenge Mode task is completed with enough items to qualify."
            icon={<Swords className="h-5 w-5" />}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-[11px] uppercase tracking-wider text-slate-400">
                  <th className="py-2 pr-3 font-semibold">Date</th>
                  <th className="py-2 pr-3 font-semibold">Concept</th>
                  <th className="py-2 pr-3 text-right font-semibold">Score</th>
                  <th className="py-2 pr-3 text-right font-semibold">Accuracy</th>
                  <th className="py-2 pr-3 text-right font-semibold">Speed bonus</th>
                  <th className="py-2 text-right font-semibold">Items</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.ownScores.map((score) => (
                  <tr key={score.id}>
                    <td className="py-2.5 pr-3 text-slate-600">{formatDate(score.submittedAt)}</td>
                    <td className="py-2.5 pr-3 text-slate-800">{score.conceptLabel || '—'}</td>
                    <td className="py-2.5 pr-3 text-right font-semibold text-slate-900">{score.score}</td>
                    <td className="py-2.5 pr-3 text-right text-slate-600">{score.accuracyPct}%</td>
                    <td className="py-2.5 pr-3 text-right text-slate-600">
                      {score.speedBonus > 0 ? `+${score.speedBonus}%` : `${score.speedBonus}%`}
                    </td>
                    <td className="py-2.5 text-right text-slate-600">{score.items}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <PrivacyNote>
        <strong className="font-semibold text-slate-800">The fences on this one page.</strong> Opt-in
        only · Grade {data.minGrade} and up · a teacher can switch it off for a class · scores never
        touch mastery · the board resets weekly · first names only for students · never visible to
        parents · opting out removes a learner from the display at once. There is no penalty of any
        kind for never taking part.
      </PrivacyNote>
    </PageShell>
  );
}
