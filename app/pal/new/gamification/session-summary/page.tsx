'use client';

import { Award, ArrowRight, CalendarClock, PartyPopper, Sparkles, TrendingUp } from 'lucide-react';

import {
  EmptyState,
  GamificationTabs,
  PageShell,
  Pill,
  PrivacyNote,
  QuestHero,
  SectionCard,
  StatTile,
  StatusPanel,
} from '../_components/GamificationChrome';
import { LearnerRequiredPanel, ScopeBar } from '../_components/GamificationScope';
import { useGamificationResource } from '../_components/useGamificationResource';
import {
  fetchSessionSummary,
  formatDate,
  tierTone,
  type SessionSummary,
} from '@/app/pal/new/data/gamification';

/**
 * New PAL → Gamification → Session summary.
 *
 * The end-of-session screen from §8.2. Its one job is to show the MOVEMENT —
 * mastery before and after, the specific thing the learner got right, what is
 * next, the streak, the career step, and any badge earned.
 *
 * Two rules are visible in the layout. The celebration budget is one per
 * session: whatever outranks everything else gets the full moment, and the rest
 * are listed quietly rather than competing with it. And when no badge was
 * earned, nothing says so — calling out an absence is what turns it into a
 * punishment.
 */
export default function SessionSummaryPage() {
  const { state, data, error, reload, refreshing, scope } = useGamificationResource<SessionSummary>(
    (learnerScope, signal) => fetchSessionSummary(learnerScope, signal)
  );

  if (state === 'needs-learner') {
    return <LearnerRequiredPanel onSelect={scope.chooseStudent} />;
  }

  if (state === 'loading') {
    return (
      <PageShell>
        <StatusPanel
          kind="loading"
          title="Building the session summary"
          message="Replaying the session's real attempts to find what moved."
        />
      </PageShell>
    );
  }

  if (state === 'error' || data === null) {
    return (
      <PageShell>
        <StatusPanel
          kind="error"
          title="Session summary is not available"
          message={error || 'The backend did not return a session summary.'}
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
        <GamificationTabs />
        <StatusPanel
          kind="empty"
          title="No session to summarise yet"
          message={data.message || 'The summary appears after the first completed practice session.'}
          onRetry={reload}
        />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <ScopeBar student={scope.student} onExit={scope.clearStudent} />

      <QuestHero
        title="Session summary"
        subtitle={`What moved on ${formatDate(data.date)}. Before and after — the movement is the reward.`}
        metrics={[
          { label: 'Concepts worked', value: String(data.conceptsWorked.length) },
          { label: 'Practice items', value: String(data.items) },
          { label: 'Time on task', value: `${data.minutes.toFixed(1)} min` },
          { label: 'Streak', value: `${data.currentStreak}d`, hint: data.streakHeadline },
        ]}
        onRefresh={reload}
        refreshing={refreshing}
      />

      <GamificationTabs />

      {/* --- the one celebration ---------------------------------------- */}
      {data.celebration ? (
        <section className="overflow-hidden rounded-[24px] border border-amber-300 bg-amber-50 p-6">
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-amber-600 shadow-sm">
              <PartyPopper className="h-6 w-6" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-bold text-amber-950">{data.celebration.title}</h2>
                <Pill label={data.celebration.level} tone="amber" />
              </div>
              <p className="mt-1.5 text-sm leading-6 text-amber-900">{data.celebration.message}</p>
            </div>
          </div>
        </section>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <SectionCard
          title="Before and after"
          description="Mastery as it stood at the start of the session, and as it stands now."
        >
          {data.progress.length === 0 ? (
            <EmptyState
              title="Nothing measurable moved"
              message="This session had activity but no measurable mastery change."
              icon={<TrendingUp className="h-5 w-5" />}
            />
          ) : (
            <ul className="space-y-4">
              {data.progress.map((concept) => {
                const before = concept.masteryBefore ?? 0;
                const after = concept.masteryAfter ?? 0;
                const toneAfter = tierTone(concept.tierAfter);

                return (
                  <li key={concept.conceptRef} className="rounded-2xl border border-slate-100 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900">{concept.conceptLabel}</p>
                        <p className="mt-0.5 text-[11px] text-slate-500">
                          {concept.subjectName || 'Unmapped subject'} · {concept.items} item
                          {concept.items === 1 ? '' : 's'} this session
                        </p>
                      </div>
                      {concept.tierChanged ? (
                        <Pill
                          label={`${concept.tierBefore} → ${concept.tierAfter}`}
                          tone={concept.tierAfter === 'sky' ? 'sky' : 'emerald'}
                        />
                      ) : (
                        <Pill label={concept.tierAfter ?? '—'} tone="slate" />
                      )}
                    </div>

                    <div className="mt-4 space-y-2">
                      <Bar label="Before" value={before} tone="bg-slate-300" />
                      <Bar label="After" value={after} tone={toneAfter.bar} />
                    </div>

                    {concept.delta !== null ? (
                      <p className="mt-2.5 text-[11px] text-slate-500">
                        {concept.delta > 0
                          ? `Moved forward by ${concept.delta.toFixed(2)} this session.`
                          : concept.delta < 0
                            ? 'Held steady or dipped — that happens, and the next session picks it back up.'
                            : 'No change this session.'}
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </SectionCard>

        <div className="space-y-5">
          {data.specificPraise ? (
            <SectionCard title="One specific thing" description="Anchored to what actually happened.">
              <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3.5">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <p className="text-sm leading-6 text-emerald-900">{data.specificPraise}</p>
              </div>
            </SectionCard>
          ) : null}

          <SectionCard title="What comes next" description="The honest next step, not a filler suggestion.">
            <div className="space-y-3">
              {data.nextConcept ? (
                <div className="flex items-start gap-3 rounded-2xl border border-slate-100 px-4 py-3">
                  <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800">{data.nextConcept.conceptLabel}</p>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      Currently at {data.nextConcept.tier} — ready when you are.
                    </p>
                  </div>
                </div>
              ) : null}

              {data.reviewDue ? (
                <div className="flex items-start gap-3 rounded-2xl border border-slate-100 px-4 py-3">
                  <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800">{data.reviewDue.conceptLabel}</p>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      Last practised {data.reviewDue.daysSince} day
                      {data.reviewDue.daysSince === 1 ? '' : 's'} ago — worth a review.
                    </p>
                  </div>
                </div>
              ) : null}

              {!data.nextConcept && !data.reviewDue ? (
                <EmptyState
                  title="Nothing queued"
                  message="Everything this learner has met has been practised recently."
                  icon={<CalendarClock className="h-5 w-5" />}
                />
              ) : null}
            </div>
          </SectionCard>

          {data.careerSkillProgress ? (
            <SectionCard title="Career quest step" description="What this session contributed to the path.">
              <p className="text-sm font-medium text-slate-800">{data.careerSkillProgress.pathwayLabel}</p>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-sky-500"
                  style={{ width: `${data.careerSkillProgress.percent}%` }}
                />
              </div>
              <p className="mt-2 text-[11px] text-slate-500">
                {data.careerSkillProgress.mastered} of {data.careerSkillProgress.target} skills mastered
                toward this path.
              </p>
            </SectionCard>
          ) : null}
        </div>
      </div>

      {/* §8.2 — no badges earned means no mention at all. */}
      {data.badgesEarned.length > 0 ? (
        <SectionCard title="Earned this session" description="Added to the learner's portfolio.">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {data.badgesEarned.map((badge) => (
              <div
                key={badge.badgeId}
                className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-amber-600">
                  <Award className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-amber-950">{badge.name}</p>
                  <p className="mt-0.5 text-[11px] leading-4 text-amber-900/90">
                    {badge.awards[0]?.studentMessage || badge.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      ) : null}

      {data.personalBests.length > 0 ? (
        <SectionCard title="Records broken this session">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {data.personalBests.map((record) => (
              <StatTile
                key={`${record.metricKey}:${record.scopeLabel ?? ''}`}
                label={record.scopeLabel || record.metricKey.replace(/_/g, ' ')}
                value={record.value.toFixed(2)}
                hint={
                  record.improvementPct !== null
                    ? `${record.improvementPct > 0 ? '+' : ''}${record.improvementPct.toFixed(1)}% on your own previous best`
                    : undefined
                }
                tone="good"
              />
            ))}
          </div>
        </SectionCard>
      ) : null}

      <PrivacyNote>
        <strong className="font-semibold text-slate-800">One celebration per session.</strong> Too many
        and they stop meaning anything; too few and a learner feels invisible. Nothing on this screen
        celebrates being faster than a classmate or being top of anything — those have no code path in
        this module.
      </PrivacyNote>
    </PageShell>
  );
}

function Bar({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div>
      <div className="flex items-center justify-between text-[11px] text-slate-500">
        <span>{label}</span>
        <span className="font-medium text-slate-700">{value.toFixed(2)}</span>
      </div>
      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.round(value * 100)}%` }} />
      </div>
    </div>
  );
}
