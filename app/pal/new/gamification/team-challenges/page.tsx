'use client';

import { useState } from 'react';
import { CheckCircle2, CircleDashed, Gift, Plus, Users, X } from 'lucide-react';

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
  createTeamChallenge,
  endTeamChallenge,
  fetchTeamChallenges,
  formatDate,
  type TeamChallengeBoard,
  type TeamChallengeEntry,
  type TeamChallengeType,
} from '@/app/pal/new/data/gamification';

/**
 * New PAL → Gamification → Team challenges.
 *
 * A team challenge is what replaces a leaderboard: the class wins or loses
 * together, so a struggling learner's improvement still counts and nobody is
 * exposed as the weakest.
 *
 * That principle is visible in the payload, not just the copy. A student's
 * response carries the class aggregate and their own contribution and nothing
 * else — the per-student breakdown below only ever renders for staff, because
 * for a student it is not in the response at all.
 */
export default function TeamChallengesPage() {
  const { state, data, error, reload, refreshing, scope } = useGamificationResource<TeamChallengeBoard>(
    (learnerScope, signal) => fetchTeamChallenges(learnerScope, signal)
  );

  const [composerOpen, setComposerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');

  const isStaffView = (data?.challenges ?? []).some((challenge) => challenge.perLearner !== null);

  const end = async (challenge: TeamChallengeEntry) => {
    const reason = window.prompt(
      'Ending a challenge early is expected when it is causing pressure. What is the reason?',
      ''
    );
    if (reason === null) return;

    setBusy(true);
    setActionError('');
    try {
      await endTeamChallenge(challenge.id, reason);
      reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not end the challenge.');
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
          title="Loading team challenges"
          message="Recomputing class progress from live learner data."
        />
      </PageShell>
    );
  }

  if (state === 'error' || data === null) {
    return (
      <PageShell>
        <StatusPanel
          kind="error"
          title="Team challenges are not available"
          message={error || 'The backend did not return a challenge payload.'}
          onRetry={reload}
          retrying={refreshing}
        />
      </PageShell>
    );
  }

  const active = data.challenges.filter((challenge) => challenge.status === 'active');
  const finished = data.challenges.filter((challenge) => challenge.status !== 'active');

  return (
    <PageShell>
      <ScopeBar student={scope.student} onExit={scope.clearStudent} />

      <QuestHero
        title="Team challenges"
        subtitle="The whole class reaches the goal together. Progress is an aggregate, the reward is more learning rather than a prize, and no student ever sees which classmates have or have not contributed."
        metrics={[
          { label: 'Active', value: String(active.length) },
          { label: 'Finished', value: String(finished.length) },
          {
            label: 'Weekly cap',
            value: String(data.maxActivePerWeek),
            hint: 'Challenge fatigue is a real cost',
          },
        ]}
        onRefresh={reload}
        refreshing={refreshing}
        right={
          isStaffView ? (
            <button
              type="button"
              onClick={() => setComposerOpen(true)}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-amber-400 px-3.5 text-xs font-semibold text-amber-950 transition hover:bg-amber-300"
            >
              <Plus className="h-3.5 w-3.5" />
              New challenge
            </button>
          ) : null
        }
      />

      <GamificationTabs />

      {actionError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {actionError}
        </div>
      ) : null}

      <SectionCard
        title="Running now"
        description="Progress is recomputed from live class data on every load, so the bar always shows the truth at this moment."
      >
        {active.length === 0 ? (
          <EmptyState
            title="No active challenges"
            message="Challenges are always teacher-initiated — the system never generates one on its own. Nothing is running for this class right now."
            icon={<Users className="h-5 w-5" />}
          />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {active.map((challenge) => (
              <ChallengeCard
                key={challenge.id}
                challenge={challenge}
                onEnd={isStaffView ? () => void end(challenge) : undefined}
                busy={busy}
              />
            ))}
          </div>
        )}
      </SectionCard>

      {finished.length > 0 ? (
        <SectionCard title="Finished" description="Completed and ended challenges stay on the record." tone="muted">
          <div className="grid gap-4 lg:grid-cols-2">
            {finished.map((challenge) => (
              <ChallengeCard key={challenge.id} challenge={challenge} busy={busy} />
            ))}
          </div>
        </SectionCard>
      ) : null}

      <SectionCard
        title="The four challenge types"
        description="Served by the API from the specification — the type list here is never hard-coded in the UI."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {data.types.map((type) => (
            <div key={type.key} className="rounded-2xl border border-slate-100 p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-slate-900">{type.label}</p>
                {type.inclusive ? <Pill label="Inclusive" tone="emerald" /> : null}
              </div>
              <p className="mt-1.5 text-xs leading-5 text-slate-500">{type.summary}</p>
              <p className="mt-2 font-mono text-[10px] text-slate-400">
                target: {type.defaultTargetValue} {type.targetUnit.replace(/_/g, ' ')}
              </p>
            </div>
          ))}
        </div>
      </SectionCard>

      <PrivacyNote>
        <strong className="font-semibold text-slate-800">What a student sees.</strong> The class
        aggregate, their own contribution status, the time remaining and the reward. Which specific
        classmates have contributed, any classmate&apos;s mastery, and any ranking by contribution are
        absent from a student response entirely. A teacher sees the per-student breakdown, for
        intervention.
      </PrivacyNote>

      {composerOpen ? (
        <ChallengeComposer
          types={data.types}
          onClose={() => setComposerOpen(false)}
          onCreated={() => {
            setComposerOpen(false);
            reload();
          }}
        />
      ) : null}
    </PageShell>
  );
}

function ChallengeCard({
  challenge,
  onEnd,
  busy,
}: {
  challenge: TeamChallengeEntry;
  onEnd?: () => void;
  busy?: boolean;
}) {
  const progress = challenge.classProgress;

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_6px_14px_rgba(15,23,42,0.04)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[15px] font-semibold text-slate-900">{challenge.title}</h3>
            <Pill
              label={challenge.status}
              tone={
                challenge.status === 'completed'
                  ? 'emerald'
                  : challenge.status === 'ended'
                    ? 'slate'
                    : 'amber'
              }
            />
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {challenge.typeLabel}
            {challenge.conceptLabel ? ` · ${challenge.conceptLabel}` : ''}
          </p>
        </div>
        {challenge.daysRemaining !== null && challenge.status === 'active' ? (
          <Pill label={`${challenge.daysRemaining}d left`} tone="amber" />
        ) : null}
      </div>

      {challenge.description ? (
        <p className="mt-3 text-sm leading-5 text-slate-600">{challenge.description}</p>
      ) : null}

      <div className="mt-4">
        <div className="flex items-end justify-between gap-3">
          <span className="text-2xl font-bold text-slate-900">{progress.percent}%</span>
          <span className="text-[11px] text-slate-500">
            {progress.qualified} of {progress.total} students
          </span>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full ${progress.achieved ? 'bg-emerald-500' : 'bg-amber-500'}`}
            style={{ width: `${progress.percent}%` }}
          />
        </div>
        <p className="mt-2 text-xs leading-5 text-slate-600">{progress.headline}</p>
      </div>

      {challenge.ownContribution ? (
        <div
          className={`mt-4 flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm ${
            challenge.ownContribution.contributed
              ? 'bg-emerald-50 text-emerald-800'
              : 'bg-slate-50 text-slate-600'
          }`}
        >
          {challenge.ownContribution.contributed ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : (
            <CircleDashed className="h-4 w-4 shrink-0" />
          )}
          {challenge.ownContribution.message}
        </div>
      ) : null}

      {challenge.reward.title || challenge.reward.description ? (
        <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5">
          <Gift className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-amber-900">{challenge.reward.title || 'Reward'}</p>
            {challenge.reward.description ? (
              <p className="mt-0.5 text-xs leading-4 text-amber-800/90">{challenge.reward.description}</p>
            ) : null}
            {!challenge.reward.approved ? (
              <p className="mt-1 text-[11px] text-amber-700">
                Awaiting teacher approval before it is shown to students.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Teacher-only: absent from a student payload, not merely hidden. */}
      {challenge.perLearner ? (
        <details className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5">
          <summary className="cursor-pointer text-xs font-medium text-slate-700">
            Per-student contributions ({challenge.perLearner.filter((row) => row.contributed).length}/
            {challenge.perLearner.length}) — teacher view
          </summary>
          <ul className="mt-3 max-h-56 space-y-1.5 overflow-y-auto">
            {challenge.perLearner.map((row) => (
              <li
                key={row.learnerId}
                className="flex items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 text-xs"
              >
                <span className="truncate text-slate-700">{row.name}</span>
                <span className={row.contributed ? 'text-emerald-600' : 'text-slate-400'}>
                  {row.detail || (row.contributed ? 'Contributed' : 'Not yet')}
                </span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] text-slate-400">
          {challenge.deadline ? `Deadline ${formatDate(challenge.deadline)}` : 'No deadline'}
        </span>
        {onEnd && challenge.status === 'active' ? (
          <button
            type="button"
            onClick={onEnd}
            disabled={busy}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
          >
            End early
          </button>
        ) : null}
      </div>
    </article>
  );
}

/** Teacher composer. Every field maps to a served challenge-type descriptor. */
function ChallengeComposer({
  types,
  onClose,
  onCreated,
}: {
  types: TeamChallengeType[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [type, setType] = useState(types[0]?.key ?? '');
  const [title, setTitle] = useState('');
  const [standardId, setStandardId] = useState('');
  const [divisionId, setDivisionId] = useState('');
  const [conceptRef, setConceptRef] = useState('');
  const [conceptLabel, setConceptLabel] = useState('');
  const [targetValue, setTargetValue] = useState('');
  const [targetTier, setTargetTier] = useState('mountain');
  const [deadline, setDeadline] = useState('');
  const [rewardTitle, setRewardTitle] = useState('');
  const [rewardDescription, setRewardDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const selected = types.find((entry) => entry.key === type);

  const submit = async () => {
    setSaving(true);
    setError('');
    try {
      await createTeamChallenge({
        type,
        title: title || selected?.label,
        standard_id: standardId || undefined,
        division_id: divisionId || undefined,
        concept_ref: conceptRef || undefined,
        concept_label: conceptLabel || undefined,
        target_value: targetValue ? Number(targetValue) : selected?.defaultTargetValue,
        target_tier: type === 'mastery_sprint' ? targetTier : undefined,
        deadline: deadline || undefined,
        reward_title: rewardTitle || undefined,
        reward_description: rewardDescription || undefined,
        reward_approved: true,
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the challenge.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-[24px] border border-slate-200 bg-white p-6 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-slate-900">New team challenge</h3>
            <p className="mt-1 text-xs text-slate-500">
              The reward should be more learning — bonus content the class unlocks together — rather
              than an external prize.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {error ? (
          <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-700">
            {error}
          </p>
        ) : null}

        <div className="mt-5 space-y-4">
          <Field label="Challenge type">
            <select
              value={type}
              onChange={(event) => setType(event.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            >
              {types.map((entry) => (
                <option key={entry.key} value={entry.key}>
                  {entry.label}
                </option>
              ))}
            </select>
            {selected ? <p className="mt-1.5 text-[11px] text-slate-500">{selected.summary}</p> : null}
          </Field>

          <Field label="Title">
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={selected?.label ?? ''}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Standard id">
              <input
                value={standardId}
                onChange={(event) => setStandardId(event.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
            </Field>
            <Field label="Division id (optional)">
              <input
                value={divisionId}
                onChange={(event) => setDivisionId(event.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
            </Field>
          </div>

          {selected?.requiresConcept ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Concept reference">
                <input
                  value={conceptRef}
                  onChange={(event) => setConceptRef(event.target.value)}
                  placeholder="chapter:8104"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 font-mono text-sm"
                />
              </Field>
              <Field label="Concept label">
                <input
                  value={conceptLabel}
                  onChange={(event) => setConceptLabel(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </Field>
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={`Target (${selected?.targetUnit.replace(/_/g, ' ') ?? 'value'})`}>
              <input
                value={targetValue}
                onChange={(event) => setTargetValue(event.target.value)}
                placeholder={String(selected?.defaultTargetValue ?? '')}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
            </Field>
            {type === 'mastery_sprint' ? (
              <Field label="Target tier">
                <select
                  value={targetTier}
                  onChange={(event) => setTargetTier(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                >
                  <option value="mountain">Mountain</option>
                  <option value="sky">Sky</option>
                </select>
              </Field>
            ) : (
              <Field label="Deadline">
                <input
                  type="date"
                  value={deadline}
                  onChange={(event) => setDeadline(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </Field>
            )}
          </div>

          {type === 'mastery_sprint' ? (
            <Field label="Deadline">
              <input
                type="date"
                value={deadline}
                onChange={(event) => setDeadline(event.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
            </Field>
          ) : null}

          <Field label="Reward title">
            <input
              value={rewardTitle}
              onChange={(event) => setRewardTitle(event.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
          </Field>

          <Field label="Reward description">
            <textarea
              value={rewardDescription}
              onChange={(event) => setRewardDescription(event.target.value)}
              rows={2}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
          </Field>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={saving || !type}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60"
          >
            {saving ? 'Creating…' : 'Create challenge'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}
