'use client';

import Link from 'next/link';
import {
  Award,
  Compass,
  Flame,
  ShieldCheck,
  Sparkles,
  Swords,
  Trophy,
  Users,
} from 'lucide-react';

import {
  EmptyState,
  GamificationTabs,
  PageShell,
  Pill,
  PrivacyNote,
  ProgressRing,
  QuestHero,
  SectionCard,
  SourceNote,
  StatTile,
  StatusPanel,
} from './_components/GamificationChrome';
import { LearnerRequiredPanel, ScopeBar } from './_components/GamificationScope';
import { useGamificationResource } from './_components/useGamificationResource';
import {
  fetchOverview,
  formatDate,
  tierTone,
  type GamificationOverview,
} from '@/app/pal/new/data/gamification';

/**
 * New PAL → Gamification — overview.
 *
 * One screen answers: where does this learner stand on their own journey, and
 * what changed since last time. Everything on it is measured — the module's
 * whole claim is that no value here was seeded, sampled or defaulted, so the
 * footer names the tables the numbers came from.
 *
 * Sections a given audience may not see are simply absent from the API
 * response (§9 visibility matrix), so each block below is rendered only when
 * its data actually arrived.
 */
export default function GamificationOverviewPage() {
  const { state, data, error, reload, refreshing, scope } = useGamificationResource<GamificationOverview>(
    (learnerScope, signal) => fetchOverview(learnerScope, signal)
  );

  if (state === 'needs-learner') {
    return <LearnerRequiredPanel onSelect={scope.chooseStudent} />;
  }

  if (state === 'loading') {
    return (
      <PageShell>
        <StatusPanel
          kind="loading"
          title="Loading Gamification"
          message="Measuring this learner's mastery, streak, badges and career signals from their real activity."
        />
      </PageShell>
    );
  }

  if (state === 'error' || data === null) {
    return (
      <PageShell>
        <StatusPanel
          kind="error"
          title="Gamification is not available"
          message={error || 'The backend did not return a gamification payload.'}
          onRetry={reload}
          retrying={refreshing}
        />
      </PageShell>
    );
  }

  if (!data.available) {
    return (
      <PageShell>
        <ScopeBar student={scope.student} onExit={scope.clearStudent} />
        <StatusPanel
          kind="empty"
          title="No learner record"
          message={
            data.reason === 'learner_not_found'
              ? 'That account is not a student in this institute, so there is no learning journey to show. Gamification follows a learner, not a staff member.'
              : 'This learner has no gamification record yet.'
          }
          onRetry={reload}
        />
      </PageShell>
    );
  }

  const { mastery, streak, badges, personalBests, careerQuest, challengeMode, teamChallenges } = data;
  const newRecords = personalBests?.recent ?? [];

  return (
    <PageShell>
      <ScopeBar student={scope.student} onExit={scope.clearStudent} />

      <QuestHero
        title="Gamification"
        subtitle="Personal Best, badges, streaks, team challenges and the Career Quest — every one of them measured against this learner's own record, never against a classmate."
        learnerName={data.learner?.name}
        gradeLabel={data.learner?.standardName || null}
        tiers={(mastery?.tiers ?? []).map((tier) => ({
          key: tier.key,
          label: tier.label,
          count: tier.count,
          minMastery: tier.minMastery,
        }))}
        metrics={[
          {
            label: 'Concepts tracked',
            value: String(mastery?.conceptsTracked ?? 0),
            hint: mastery?.headline,
          },
          {
            label: 'Current streak',
            value: streak ? `${streak.currentStreak}d` : '—',
            hint: streak ? `Longest ${streak.longestStreak}d` : 'Not visible to you',
          },
          {
            label: 'Badges earned',
            value: badges ? `${badges.totalEarned}/${badges.totalAvailable}` : '—',
            hint: badges ? 'Portfolio evidence, not decoration' : 'Not visible to you',
          },
          {
            label: 'Personal bests',
            value: String(personalBests?.totalRecords ?? 0),
            hint: personalBests?.headline,
          },
        ]}
        onRefresh={reload}
        refreshing={refreshing}
      />

      <GamificationTabs />

      {newRecords.length > 0 ? (
        <section className="rounded-[24px] border border-amber-200 bg-amber-50/70 p-5">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-amber-600 shadow-sm">
              <Sparkles className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-amber-900">Records broken</p>
              <ul className="mt-2 space-y-1.5">
                {newRecords.slice(0, 3).map((record) => (
                  <li key={record.id} className="text-sm leading-5 text-amber-900/90">
                    {record.message}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-3">
        {/* --- mastery ------------------------------------------------- */}
        {mastery ? (
          <SectionCard
            title="Where the learning stands"
            description="Stream → Mountain → Sky, one row per concept this learner has practised."
            action={
              <Link
                href="/pal/new/gamification/personal-best"
                className="text-xs font-medium text-amber-700 hover:text-amber-800"
              >
                Personal best →
              </Link>
            }
          >
            {mastery.concepts.length === 0 ? (
              <EmptyState
                title="No concepts practised yet"
                message="The map fills in as soon as this learner completes their first PAL practice set. Nothing is shown before then."
              />
            ) : (
              <ul className="space-y-2.5">
                {mastery.concepts.slice(0, 8).map((concept) => {
                  const tone = tierTone(concept.tier);
                  return (
                    <li
                      key={concept.conceptRef}
                      className="rounded-2xl border border-slate-100 px-3.5 py-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-800">
                            {concept.conceptLabel}
                          </p>
                          <p className="mt-0.5 text-[11px] text-slate-500">
                            {concept.subjectName || 'Unmapped subject'} · {concept.sessions} session
                            {concept.sessions === 1 ? '' : 's'}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ${tone.chip}`}
                        >
                          {concept.tierLabel}
                        </span>
                      </div>
                      <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={`h-full rounded-full ${tone.bar}`}
                          style={{ width: `${Math.round(concept.mastery * 100)}%` }}
                        />
                      </div>
                      <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-500">
                        <span>Mastery {concept.mastery.toFixed(2)}</span>
                        <span>
                          {concept.bestNetFluency === null
                            ? 'Fluency not measured yet'
                            : `Best fluency ${concept.bestNetFluency.toFixed(2)}`}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </SectionCard>
        ) : null}

        {/* --- streak + badges ----------------------------------------- */}
        <div className="space-y-5">
          {streak ? (
            <SectionCard
              title="Streak"
              description="A day counts only on real productive engagement — never on opening the app."
              action={
                <Link
                  href="/pal/new/gamification/streaks"
                  className="text-xs font-medium text-amber-700 hover:text-amber-800"
                >
                  Ledger →
                </Link>
              }
            >
              <div className="flex items-center gap-4">
                <ProgressRing
                  percent={
                    streak.longestStreak > 0
                      ? (streak.currentStreak / streak.longestStreak) * 100
                      : streak.currentStreak > 0
                        ? 100
                        : 0
                  }
                  label={`${streak.currentStreak}`}
                  sublabel="day streak"
                  size={104}
                  tone="amber"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-5 text-slate-700">{streak.headline}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Pill label={`Longest ${streak.longestStreak}d`} tone="slate" />
                    <Pill
                      label={streak.activeToday ? 'Active today' : 'Not yet today'}
                      tone={streak.activeToday ? 'emerald' : 'slate'}
                    />
                    {streak.graceAvailable ? <Pill label="Grace day available" tone="sky" /> : null}
                  </div>
                </div>
              </div>
            </SectionCard>
          ) : null}

          {badges ? (
            <SectionCard
              title="Badges"
              description="Each one maps to an HPC domain, a CASEL competency or an NCDG goal."
              action={
                <Link
                  href="/pal/new/gamification/badges"
                  className="text-xs font-medium text-amber-700 hover:text-amber-800"
                >
                  All badges →
                </Link>
              }
            >
              {badges.earned.length === 0 ? (
                <EmptyState
                  title="No badges earned yet"
                  message="Badges are awarded from real learning milestones only. None has been granted as a welcome gift."
                  icon={<Award className="h-5 w-5" />}
                />
              ) : (
                <ul className="space-y-2">
                  {badges.earned.slice(0, 4).map((badge) => (
                    <li
                      key={badge.badgeId}
                      className="flex items-start gap-3 rounded-2xl border border-slate-100 px-3.5 py-3"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                        <Award className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-800">{badge.name}</p>
                        <p className="mt-0.5 text-[11px] leading-4 text-slate-500">
                          {badge.awards[0]?.studentMessage || badge.description}
                        </p>
                        <p className="mt-1 text-[10px] uppercase tracking-wider text-slate-400">
                          {formatDate(badge.awards[0]?.awardedAt ?? null)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
          ) : null}
        </div>

        {/* --- career quest + challenges ------------------------------- */}
        <div className="space-y-5">
          {careerQuest?.available ? (
            <SectionCard
              title="Career quest"
              description={careerQuest.stage.label}
              action={
                <Link
                  href="/pal/new/gamification/career-quest"
                  className="text-xs font-medium text-amber-700 hover:text-amber-800"
                >
                  Open quest →
                </Link>
              }
            >
              <p className="text-sm leading-5 text-slate-700">{careerQuest.questMessage}</p>

              {careerQuest.skillProgress ? (
                <div className="mt-4 flex items-center gap-4">
                  <ProgressRing
                    percent={careerQuest.skillProgress.percent}
                    label={`${careerQuest.skillProgress.mastered}`}
                    sublabel={`of ${careerQuest.skillProgress.target}`}
                    size={96}
                    tone="sky"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800">
                      {careerQuest.skillProgress.pathwayLabel}
                    </p>
                    <p className="mt-1 text-[11px] leading-4 text-slate-500">
                      Skills mastered toward this path, counted from real concept mastery.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="mt-4">
                  <EmptyState
                    title={
                      careerQuest.riasec.ready
                        ? 'No pathway chosen yet'
                        : 'Career profile not ready yet'
                    }
                    message={
                      careerQuest.riasec.ready
                        ? 'Pick a suggested path in the Career Quest to start tracking skills toward it.'
                        : `${careerQuest.riasec.signalsTotal} of ${careerQuest.riasec.signalsRequired} career signals recorded. A profile built on less would be a guess.`
                    }
                    icon={<Compass className="h-5 w-5" />}
                  />
                </div>
              )}
            </SectionCard>
          ) : null}

          {teamChallenges ? (
            <SectionCard
              title="Team challenges"
              description="The class wins or loses together — no individual is exposed."
              action={
                <Link
                  href="/pal/new/gamification/team-challenges"
                  className="text-xs font-medium text-amber-700 hover:text-amber-800"
                >
                  All challenges →
                </Link>
              }
            >
              {teamChallenges.length === 0 ? (
                <EmptyState
                  title="No active challenges"
                  message="Challenges are always teacher-initiated. None is running for this class right now."
                  icon={<Users className="h-5 w-5" />}
                />
              ) : (
                <ul className="space-y-3">
                  {teamChallenges.slice(0, 3).map((challenge) => (
                    <li key={challenge.id} className="rounded-2xl border border-slate-100 px-3.5 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-800">{challenge.title}</p>
                          <p className="mt-0.5 text-[11px] text-slate-500">{challenge.typeLabel}</p>
                        </div>
                        {challenge.daysRemaining !== null ? (
                          <Pill label={`${challenge.daysRemaining}d left`} tone="amber" />
                        ) : null}
                      </div>
                      <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-amber-500"
                          style={{ width: `${challenge.classProgress.percent}%` }}
                        />
                      </div>
                      <p className="mt-1.5 text-[11px] leading-4 text-slate-500">
                        {challenge.classProgress.headline}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
          ) : null}

          {challengeMode ? (
            <SectionCard
              title="Challenge mode"
              description="Optional, opt-in, and kept entirely separate from learning mastery."
              action={
                <Link
                  href="/pal/new/gamification/challenge-mode"
                  className="text-xs font-medium text-amber-700 hover:text-amber-800"
                >
                  Open →
                </Link>
              }
            >
              <div className="flex flex-wrap items-center gap-2">
                <Pill
                  label={challengeMode.optedIn ? 'Opted in' : 'Not opted in'}
                  tone={challengeMode.optedIn ? 'emerald' : 'slate'}
                />
                <Pill
                  label={challengeMode.eligible ? 'Available' : 'Unavailable'}
                  tone={challengeMode.eligible ? 'sky' : 'rose'}
                />
                {challengeMode.bestScore !== null ? (
                  <Pill label={`Best ${challengeMode.bestScore}`} tone="amber" />
                ) : null}
              </div>
              <p className="mt-3 text-[11px] leading-4 text-slate-500">
                {challengeMode.eligible
                  ? 'Scores never affect mastery, the practice ladder or the regular learning path.'
                  : challengeMode.eligibilityMessage}
              </p>
            </SectionCard>
          ) : null}
        </div>
      </div>

      {/* --- class aggregate ------------------------------------------- */}
      {data.classAggregate?.available ? (
        <SectionCard
          title="This class, in aggregate"
          description="The only cross-learner figure the system produces — anonymous, and never a ranking."
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile
              label="Students in class"
              value={String(data.classAggregate.classSize)}
              icon={<Users className="h-4 w-4" />}
            />
            <StatTile
              label="With PAL activity"
              value={String(data.classAggregate.learnersWithActivity)}
              hint="Learners who have completed at least one practice set"
            />
            {Object.entries(data.classAggregate.tierCounts)
              .slice(0, 2)
              .map(([tier, count]) => (
                <StatTile
                  key={tier}
                  label={`Concepts at ${tier}`}
                  value={String(count)}
                  tone={tier === 'sky' ? 'good' : 'default'}
                />
              ))}
          </div>
          <p className="mt-3 text-[11px] text-slate-500">{data.classAggregate.note}</p>
        </SectionCard>
      ) : null}

      {/* --- governance + provenance ------------------------------------ */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <PrivacyNote>
          <span className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
            <span>
              <strong className="font-semibold text-slate-800">Who sees what.</strong> Students see only
              their own data and anonymous class aggregates. Teachers see everything they need for
              intervention. Parents see milestones and career signals. Classmates see nothing about each
              other. These rules are applied on the server — a field you cannot see is not in the response
              at all.
            </span>
          </span>
        </PrivacyNote>

        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
          <SourceNote
            tables={data.dataSources.tables}
            extra={`${data.dataSources.palAttempts} PAL attempts${
              data.dataSources.lastAttemptAt ? `, last ${formatDate(data.dataSources.lastAttemptAt)}` : ''
            }`}
          />
        </div>
      </div>

      {/* --- quick links ------------------------------------------------- */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <QuickLink
          href="/pal/new/gamification/personal-best"
          icon={<Trophy className="h-4 w-4" />}
          title="Personal best"
          blurb={
            personalBests
              ? `${personalBests.totalRecords} record${personalBests.totalRecords === 1 ? '' : 's'} tracked`
              : 'Not visible to you'
          }
        />
        <QuickLink
          href="/pal/new/gamification/streaks"
          icon={<Flame className="h-4 w-4" />}
          title="Streaks"
          blurb={streak ? `${streak.totalActiveDays} qualifying days so far` : 'Not visible to you'}
        />
        <QuickLink
          href="/pal/new/gamification/career-quest"
          icon={<Compass className="h-4 w-4" />}
          title="Career quest"
          blurb={careerQuest?.available ? careerQuest.stage.label : 'No quest yet'}
        />
        <QuickLink
          href="/pal/new/gamification/challenge-mode"
          icon={<Swords className="h-4 w-4" />}
          title="Challenge mode"
          blurb={challengeMode?.optedIn ? 'Opted in' : 'Optional — off by default'}
        />
      </div>
    </PageShell>
  );
}

function QuickLink({
  href,
  icon,
  title,
  blurb,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  blurb: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_6px_14px_rgba(15,23,42,0.04)] transition hover:border-amber-300"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-slate-900">{title}</span>
        <span className="mt-0.5 block truncate text-[11px] text-slate-500">{blurb}</span>
      </span>
    </Link>
  );
}
