'use client';

import { useState } from 'react';
import { Briefcase, Check, Compass, Flag, Map, Sparkles } from 'lucide-react';

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
  chooseCareerPathway,
  fetchCareerQuest,
  formatDate,
  generateCareerReport,
  type CareerQuest,
} from '@/app/pal/new/data/gamification';

/**
 * New PAL → Gamification → Career quest.
 *
 * The Career Quest answers the question every student asks and few products
 * address: why am I learning this?
 *
 * The most important behaviour on this page is what it refuses to do. A RIASEC
 * profile assembled from too little evidence would be a guess presented to a
 * child as insight, so when the profile is not ready the page says which gate
 * is still closed and how far off it is — rather than rendering a plausible
 * profile nobody earned. The same applies to pathway suggestions: a pathway
 * with no evidence behind it is not returned at all.
 */
export default function CareerQuestPage() {
  const { state, data, error, reload, refreshing, scope } = useGamificationResource<CareerQuest>(
    (learnerScope, signal) => fetchCareerQuest(learnerScope, signal)
  );

  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');

  const choose = async (pathway: string) => {
    setBusy(true);
    setActionError('');
    try {
      await chooseCareerPathway(pathway, scope.scope);
      reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not set the pathway.');
    } finally {
      setBusy(false);
    }
  };

  const buildReport = async () => {
    setBusy(true);
    setActionError('');
    try {
      await generateCareerReport(scope.scope);
      reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not generate the report.');
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
          title="Loading career quest"
          message="Reading the learner's own career signals, mastery and engaged learning units."
        />
      </PageShell>
    );
  }

  if (state === 'error' || data === null) {
    return (
      <PageShell>
        <StatusPanel
          kind="error"
          title="Career quest is not available"
          message={error || 'The backend did not return a career quest payload.'}
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
          title="No career quest yet"
          message="This account has no learner record, so there is no journey to map."
          onRetry={reload}
        />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <ScopeBar student={scope.student} onExit={scope.clearStudent} />

      <QuestHero
        title="Career quest"
        subtitle={data.questMessage}
        gradeLabel={data.gradeLabel}
        metrics={[
          { label: 'Stage', value: data.stage.label, hint: data.stage.gradeKnown ? undefined : 'Grade unknown' },
          { label: 'Quest level', value: String(data.questLevel), hint: 'Earned from real mastery' },
          {
            label: 'Career signals',
            value: `${data.riasec.signalsTotal}/${data.riasec.signalsRequired}`,
            hint: data.riasec.ready ? 'Profile ready' : 'Profile not ready yet',
          },
          {
            label: 'Careers explored',
            value: String(data.careerExposure.length),
          },
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

      {/* --- Explorer stage: the five HPC islands ---------------------- */}
      {data.islands.length > 0 ? (
        <SectionCard
          title="Explorer map"
          description="Five islands, one per HPC domain. A flag appears when this learner has real evidence there — there is no career framing at this stage."
        >
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {data.islands.map((island) => (
              <div
                key={island.key}
                className={`rounded-2xl border p-4 text-center ${
                  island.flagPlanted ? 'border-emerald-200 bg-emerald-50' : 'border-dashed border-slate-200'
                }`}
              >
                <span
                  className={`mx-auto flex h-10 w-10 items-center justify-center rounded-2xl ${
                    island.flagPlanted ? 'bg-white text-emerald-600' : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  <Flag className="h-4 w-4" />
                </span>
                <p className="mt-2 text-sm font-medium text-slate-800">{island.label}</p>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  {island.flagPlanted ? 'Flag planted' : 'Not explored yet'}
                </p>
              </div>
            ))}
          </div>
        </SectionCard>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        {/* --- RIASEC profile ---------------------------------------- */}
        <SectionCard
          title="Career personality profile"
          description="Built from RIASEC signals accumulated across this learner's real work — never from a questionnaire they filled in once."
        >
          {!data.stage.showsRiasec ? (
            <EmptyState
              title="Not part of this stage"
              message={`The career personality profile appears from the Pathway Seeker stage. This learner is at ${data.stage.label}.`}
              icon={<Compass className="h-5 w-5" />}
            />
          ) : !data.riasec.ready ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-sm font-semibold text-slate-800">Not ready yet — and that is the honest answer</p>
              <p className="mt-2 text-xs leading-5 text-slate-600">
                {data.riasec.reason === 'grade_below_minimum'
                  ? `A career profile is only shown from Grade ${data.riasec.minGrade}.`
                  : data.riasec.reason === 'not_enough_distinct_signals'
                    ? `Signals so far point at ${data.riasec.distinctTypes} of the ${data.riasec.distinctRequired} distinct interest types needed. A profile built on one type would be a guess.`
                    : `${data.riasec.signalsTotal} of ${data.riasec.signalsRequired} career signals recorded so far. A profile assembled from fewer would be a guess dressed as insight.`}
              </p>
              <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-white">
                <div
                  className="h-full rounded-full bg-sky-500"
                  style={{
                    width: `${
                      data.riasec.signalsRequired > 0
                        ? Math.min(100, (data.riasec.signalsTotal / data.riasec.signalsRequired) * 100)
                        : 0
                    }%`,
                  }}
                />
              </div>
              <p className="mt-2 text-[11px] text-slate-500">
                Signals accumulate as the learner works through units that carry career meaning.
              </p>
            </div>
          ) : (
            <>
              {data.riasec.top ? (
                <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-sky-700">Top signal</p>
                  <p className="mt-1 text-lg font-bold text-sky-900">
                    {data.riasec.top.label} ({data.riasec.top.type})
                  </p>
                  <p className="mt-1 text-sm text-sky-800">{data.riasec.top.blurb}</p>
                </div>
              ) : null}

              <ul className="mt-4 space-y-2.5">
                {data.riasec.types.map((type) => (
                  <li key={type.type}>
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="font-medium text-slate-800">
                        {type.label} <span className="text-slate-400">({type.type})</span>
                      </span>
                      <span className="text-[11px] text-slate-500">
                        {type.signals} signal{type.signals === 1 ? '' : 's'}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-sky-500" style={{ width: `${type.share}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </SectionCard>

        {/* --- skill progress ---------------------------------------- */}
        <SectionCard
          title="Skills toward the chosen path"
          description="Counted from concepts this learner has genuinely mastered, matched to the path through the units they have engaged with."
        >
          {data.skillProgress === null ? (
            <EmptyState
              title="No pathway being tracked"
              message="Choose a suggested path below to start tracking skill progress toward it. Nothing is chosen automatically."
              icon={<Map className="h-5 w-5" />}
            />
          ) : (
            <>
              <div className="flex items-center gap-5">
                <ProgressRing
                  percent={data.skillProgress.percent}
                  label={`${data.skillProgress.mastered}`}
                  sublabel={`of ${data.skillProgress.target}`}
                  size={132}
                  tone="sky"
                />
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold text-slate-900">
                    {data.skillProgress.pathwayLabel}
                  </p>
                  <p className="mt-1.5 text-xs leading-5 text-slate-500">
                    {data.skillProgress.targetSource === 'linked_concepts'
                      ? 'The target is the number of concepts actually linked to this path in your estate.'
                      : data.skillProgress.targetSource === 'institute'
                        ? 'The target was set by your institute.'
                        : 'No concepts are mapped to this path yet, so the default target is used.'}
                  </p>
                </div>
              </div>

              {data.skillProgress.skills.length > 0 ? (
                <ul className="mt-5 space-y-1.5">
                  {data.skillProgress.skills.slice(0, 12).map((skill) => (
                    <li
                      key={skill.conceptRef}
                      className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 px-3.5 py-2"
                    >
                      <span className="min-w-0 truncate text-sm text-slate-700">{skill.conceptLabel}</span>
                      <span
                        className={`flex shrink-0 items-center gap-1 text-[11px] font-medium ${
                          skill.mastered ? 'text-emerald-600' : 'text-slate-400'
                        }`}
                      >
                        {skill.mastered ? <Check className="h-3.5 w-3.5" /> : null}
                        {skill.mastered ? 'Mastered' : skill.tier}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          )}
        </SectionCard>
      </div>

      {/* --- pathway suggestions ---------------------------------------- */}
      <SectionCard
        title="Paths that might suit this learner"
        description="Ranked from the learner's own interest signals and the concepts they have practised. They are not locked in — all of them stay open."
      >
        {!data.stage.showsPathways ? (
          <EmptyState
            title="Not part of this stage"
            message={`Pathway suggestions begin at the Pathway Seeker stage. This learner is at ${data.stage.label}.`}
            icon={<Compass className="h-5 w-5" />}
          />
        ) : data.pathways.length === 0 ? (
          <EmptyState
            title="No path has evidence behind it yet"
            message="A pathway is only suggested when the learner's own signals or practised concepts point at it. Suggesting one without evidence would be a guess."
            icon={<Compass className="h-5 w-5" />}
          />
        ) : (
          <div className="grid gap-4 lg:grid-cols-3">
            {data.pathways.map((pathway, index) => {
              const chosen = data.primaryPathway === pathway.key;
              return (
                <article
                  key={pathway.key}
                  className={`rounded-2xl border p-5 shadow-[0_6px_14px_rgba(15,23,42,0.04)] ${
                    chosen ? 'border-sky-300 bg-sky-50/50' : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-sm font-bold text-white">
                      {index + 1}
                    </span>
                    {chosen ? <Pill label="Tracking" tone="sky" /> : null}
                  </div>
                  <h3 className="mt-3 text-[15px] font-semibold text-slate-900">{pathway.label}</h3>
                  <p className="mt-1.5 text-xs leading-5 text-slate-500">{pathway.skillsBlurb}</p>

                  <div className="mt-4">
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span>Evidence match</span>
                      <span className="font-semibold text-slate-700">{pathway.matchScore}%</span>
                    </div>
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-sky-500"
                        style={{ width: `${Math.min(100, pathway.matchScore)}%` }}
                      />
                    </div>
                  </div>

                  <p className="mt-3 text-[11px] leading-4 text-slate-600">{pathway.why}</p>

                  <button
                    type="button"
                    onClick={() => void choose(pathway.key)}
                    disabled={busy || chosen}
                    className="mt-4 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                  >
                    {chosen ? 'Currently tracking' : 'Track this path'}
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </SectionCard>

      {/* --- exposure + report ----------------------------------------- */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <SectionCard
          title="Careers actually explored"
          description="Drawn from the learning units this learner has engaged with that carry a career layer."
        >
          {data.careerExposure.length === 0 ? (
            <EmptyState
              title="No career scenarios completed yet"
              message="Exposure builds as the learner works through units that carry career meaning. Nothing is listed before that happens."
              icon={<Briefcase className="h-5 w-5" />}
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {data.careerExposure.map((exposure) => (
                <div key={exposure.cluster} className="rounded-2xl border border-slate-100 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900">{exposure.label}</p>
                    <Pill label={`${exposure.count}`} tone="slate" />
                  </div>
                  {exposure.titles.length > 0 ? (
                    <p className="mt-1.5 text-[11px] leading-4 text-slate-500">
                      {exposure.titles.join(' · ')}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Career pathway report"
          description="The payoff of the whole journey — generated only at the Career Builder stage, and only from evidence that exists."
        >
          <div className="space-y-3">
            <StatTile
              label="Stage"
              value={data.stage.label}
              hint={
                data.stage.gradeMin !== null
                  ? `Grades ${data.stage.gradeMin}–${data.stage.gradeMax}`
                  : undefined
              }
              icon={<Sparkles className="h-4 w-4" />}
            />
            {data.report.generatedAt ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                <p className="text-sm font-medium text-emerald-900">Report generated</p>
                <p className="mt-0.5 text-xs text-emerald-800">{formatDate(data.report.generatedAt)}</p>
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => void buildReport()}
              disabled={busy || !data.report.eligible || !data.riasec.ready}
              className="w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {data.report.generatedAt ? 'Regenerate report' : 'Generate report'}
            </button>

            {!data.report.eligible ? (
              <p className="text-[11px] leading-4 text-slate-500">
                The report belongs to the Career Builder stage (Grade 9 and up).
              </p>
            ) : !data.riasec.ready ? (
              <p className="text-[11px] leading-4 text-slate-500">
                There is not enough career evidence yet to write an honest report.
              </p>
            ) : null}
          </div>
        </SectionCard>
      </div>

      <PrivacyNote>
        <strong className="font-semibold text-slate-800">Nothing here is a verdict.</strong> Suggested
        paths are open, reversible and evidence-backed; a learner can track one today and a different
        one tomorrow. The profile describes how they have learned so far — not what they are capable of.
      </PrivacyNote>
    </PageShell>
  );
}
