'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import {
  BarChart3,
  Calendar,
  CheckCircle,
  ClipboardList,
  Edit,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Shield,
  Target,
  Trophy,
  UserPlus,
  Users,
  X,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { SearchDropdown, type SearchDropdownValues } from '@/components/search-dropdown';
import { isStudentSession } from '@/app/pal/data/pal-lookups';
import { buildSessionContext } from '@/lib/erp-client';
import {
  fetchTeamChallenges,
  fetchChallengeDetail,
  joinChallenge,
  submitChallengeContribution,
  createTeamChallenge,
  updateTeamChallenge,
  endTeamChallenge,
} from '@/app/pal/data/tc-api';
import type {
  ChallengeWithProgress,
  ChallengeType,
  TargetMetric,
  TeamChallengeCreateData,
  TeamChallengeUpdateData,
} from '@/app/pal/data/tc-types';
import type { ChallengeDetail, ChallengeParticipantInfo, ChallengeContributionInfo } from '@/app/pal/data/tc-api';

const CHALLENGE_TYPES: Record<string, { label: string; icon: ReactNode; color: string }> = {
  mastery_sprint: { label: 'Mastery Sprint', icon: <Target className="h-4 w-4" />, color: 'emerald' },
  collective_fluency: { label: 'Collective Fluency', icon: <BarChart3 className="h-4 w-4" />, color: 'sky' },
  peer_teaching: { label: 'Peer Teaching', icon: <Users className="h-4 w-4" />, color: 'purple' },
  exploration: { label: 'Exploration', icon: <Target className="h-4 w-4" />, color: 'teal' },
};

const CHALLENGE_TYPE_OPTIONS = [
  { value: 'mastery_sprint', label: 'Mastery Sprint' },
  { value: 'collective_fluency', label: 'Collective Fluency Challenge' },
  { value: 'peer_teaching', label: 'Peer Teaching Challenge' },
  { value: 'exploration', label: 'Exploration Challenge' },
];

const TARGET_TYPE_OPTIONS = [
  { value: 'concepts_mastered', label: 'Concepts Mastered' },
  { value: 'total_fluency', label: 'Total Fluency' },
  { value: 'peer_help_count', label: 'Peer Help Count' },
  { value: 'content_explored', label: 'Content Explored' },
];

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600',
  active: 'bg-emerald-100 text-emerald-700',
  ended: 'bg-slate-100 text-slate-600',
  completed: 'bg-amber-100 text-amber-700',
};

export default function TeamChallengesPage() {
  const router = useRouter();
  const isStudent = isStudentSession();
  const [challenges, setChallenges] = useState<ChallengeWithProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedChallenge, setSelectedChallenge] = useState<ChallengeDetail | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingChallenge, setEditingChallenge] = useState<ChallengeWithProgress | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadChallenges = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchTeamChallenges({ activeOnly: !isStudent, signal });
      setChallenges(data);
    } catch (reason) {
      if (signal?.aborted) return;
      setError(reason instanceof Error ? reason.message : 'Unable to load team challenges.');
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [isStudent]);

  useEffect(() => {
    const controller = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data-fetch loader, matches repo PAL pages
    void loadChallenges(controller.signal);
    return () => controller.abort();
  }, [loadChallenges, editingChallenge]);

  const handleJoin = useCallback(async (challengeId: number) => {
    setSubmitting(true);
    try {
      await joinChallenge(challengeId);
      void loadChallenges();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to join challenge.');
    } finally {
      setSubmitting(false);
    }
  }, [loadChallenges]);

  const handleViewDetail = useCallback(async (challenge: ChallengeWithProgress) => {
    try {
      const detail = await fetchChallengeDetail(challenge.id);
      setSelectedChallenge(detail);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load challenge details.');
    }
  }, []);

  const handleCreate = useCallback(async (data: TeamChallengeCreateData) => {
    setSubmitting(true);
    try {
      await createTeamChallenge(data);
      setShowCreateModal(false);
      void loadChallenges();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to create challenge.');
    } finally {
      setSubmitting(false);
    }
  }, [loadChallenges]);

  const handleUpdate = useCallback(async (data: TeamChallengeUpdateData) => {
    if (!editingChallenge) return;
    setSubmitting(true);
    try {
      await updateTeamChallenge(editingChallenge.id, data);
      setShowEditModal(false);
      setEditingChallenge(null);
      void loadChallenges();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to update challenge.');
    } finally {
      setSubmitting(false);
    }
  }, [loadChallenges, editingChallenge]);

  const handleEnd = useCallback(async (challengeId: number) => {
    setSubmitting(true);
    try {
      await endTeamChallenge(challengeId);
      void loadChallenges();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to end challenge.');
    } finally {
      setSubmitting(false);
    }
  }, [loadChallenges]);

  if (selectedChallenge) {
    return (
       <ChallengeDetailView
        challenge={selectedChallenge}
        isStudent={isStudent}
        onBack={() => setSelectedChallenge(null)}
        onJoin={handleJoin}
        onEnd={handleEnd}
        submitting={submitting}
      />
    );
  }

  return (
    <div className="min-h-full px-4 py-5 sm:px-6">
      <div className="mx-auto w-full max-w-[1200px] space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Team Challenges</h1>
              <p className="text-sm text-slate-500">
                {isStudent
                  ? 'Collaborative challenges where you and your classmates work together.'
                  : 'Create and manage team challenges for your class.'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!isStudent && (
              <Button
                size="sm"
                className="shrink-0 bg-indigo-600 hover:bg-indigo-700"
                onClick={() => setShowCreateModal(true)}
              >
                <Plus className="h-3.5 w-3.5" />
                Create Challenge
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 border-indigo-200 text-indigo-700 hover:bg-indigo-50"
              onClick={() => router.push('/pal/visibility')}
            >
              <Shield className="h-3.5 w-3.5" />
              Visibility & Access
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 border-indigo-200 text-indigo-700 hover:bg-indigo-50"
              onClick={() => router.push('/pal')}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Back to PAL
            </Button>
          </div>
        </div>

        {error && (
          <div className="flex items-center justify-between rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <span>{error}</span>
            <Button size="sm" variant="outline" onClick={() => loadChallenges()} className="border-rose-200 text-rose-700 hover:bg-rose-100">
              Retry
            </Button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center rounded-xl border border-slate-200 bg-white py-16 text-sm text-slate-500">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading team challenges...
          </div>
        ) : challenges.length === 0 ? (
          <EmptyState isStudent={isStudent} onRetry={() => loadChallenges()} onCreate={() => setShowCreateModal(true)} />
        ) : (
          <ChallengeGrid
            challenges={challenges}
            isStudent={isStudent}
            onSelect={handleViewDetail}
            onJoin={handleJoin}
            onEdit={(c) => {
              setEditingChallenge(c);
              setShowEditModal(true);
            }}
            onEnd={handleEnd}
            submitting={submitting}
          />
        )}

        {showCreateModal && (
          <ChallengeFormModal
            title="Create Team Challenge"
            submitLabel="Create Challenge"
            onSubmit={handleCreate}
            onCancel={() => setShowCreateModal(false)}
            submitting={submitting}
          />
        )}

        {showEditModal && editingChallenge && (
          <ChallengeFormModal
            title="Edit Team Challenge"
            submitLabel="Save Changes"
            editingChallenge={editingChallenge}
            onSubmit={(data) => handleUpdate(data)}
            onCancel={() => {
              setShowEditModal(false);
              setEditingChallenge(null);
            }}
            submitting={submitting}
          />
        )}
      </div>
    </div>
  );
}

function ChallengeGrid({
  challenges,
  isStudent,
  onSelect,
  onJoin,
  onEdit,
  onEnd,
  submitting,
}: {
  challenges: ChallengeWithProgress[];
  isStudent: boolean;
  onSelect: (c: ChallengeWithProgress) => void;
  onJoin: (id: number) => void;
  onEdit: (c: ChallengeWithProgress) => void;
  onEnd: (id: number) => void;
  submitting: boolean;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {challenges.map((challenge) => {
        const meta = CHALLENGE_TYPES[challenge.challenge_type] || CHALLENGE_TYPES.mastery_sprint;
        const progress = challenge.progress;
        const pct = progress.progress_percentage;
        const isJoined = challenge.can_contribute;
        const statusClass = STATUS_COLORS[challenge.status] || STATUS_COLORS.active;

        return (
          <div
            key={challenge.id}
            className="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-2">
              <div className={`rounded-lg ${meta.color === 'emerald' ? 'bg-emerald-50' : meta.color === 'sky' ? 'bg-sky-50' : meta.color === 'purple' ? 'bg-purple-50' : 'bg-teal-50'} p-2`}>
                {meta.icon}
              </div>
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${statusClass}`}>
                {challenge.status}
              </span>
            </div>

            <h3 className="mt-3 text-lg font-semibold text-slate-900">{challenge.title}</h3>
            <p className="mt-1 line-clamp-2 text-sm text-slate-600">
              {challenge.description || 'No description provided.'}
            </p>

            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Type</span>
                <span className="font-medium text-slate-700">{meta.label}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Target</span>
                <span className="font-medium text-slate-700">
                  {progress.target_value} {challenge.target_type.replace(/_/g, ' ')}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Progress</span>
                <span className="font-medium text-slate-700">
                  {Math.round(pct)}% · {progress.active_contributors}/{progress.total_participants} contributors
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-100">
                <div
                  className={`h-2 rounded-full ${pct >= 100 ? 'bg-amber-500' : 'bg-indigo-500'}`}
                  style={{ width: `${Math.min(pct, 100)}%` }}
                />
              </div>
            </div>

            {challenge.deadline && (
              <div className="mt-3 flex items-center gap-1 text-xs text-slate-500">
                <Calendar className="h-3 w-3" />
                <span>Deadline: {new Date(challenge.deadline).toLocaleDateString()}</span>
              </div>
            )}

            <div className="mt-4 flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                onClick={() => onSelect(challenge)}
              >
                <ClipboardList className="h-3.5 w-3.5" />
                Details
              </Button>
              {isStudent && !isJoined && challenge.can_join && (
                <Button
                  size="sm"
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700"
                  disabled={submitting}
                  onClick={() => onJoin(challenge.id)}
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  Join
                </Button>
              )}
              {!isStudent && (
                <>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onEdit(challenge)}
                  >
                    <Edit className="h-3.5 w-3.5" />
                  </Button>
                  {challenge.status !== 'ended' && challenge.status !== 'completed' && (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={submitting}
                      onClick={() => onEnd(challenge.id)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ChallengeDetailView({
  challenge,
  isStudent,
  onBack,
  onJoin,
  onEnd,
  submitting,
}: {
  challenge: ChallengeDetail;
  isStudent: boolean;
  onBack: () => void;
  onJoin: (id: number) => void;
  onEnd: (id: number) => void;
  submitting: boolean;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [contributionInput, setContributionInput] = useState<{
    event_type: string;
    value: number;
    source_id: string;
  }>({ event_type: 'mastery', value: 1, source_id: '' });
  const [showContributionForm, setShowContributionForm] = useState(false);

  const handleContribute = useCallback(async () => {
    setIsSubmitting(true);
    try {
      await submitChallengeContribution(challenge.challenge.id, {
        event_type: contributionInput.event_type as 'mastery' | 'fluency' | 'peer_help' | 'exploration',
        source_id: contributionInput.source_id || undefined,
        value: contributionInput.value,
        idempotency_key: `tc_contrib_${challenge.challenge.id}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
      });
      setShowContributionForm(false);
      onBack();
      void fetchChallengeDetail(challenge.challenge.id).then((updated) => {
        void updated;
      });
    } catch (reason) {
      console.error('Contribution failed:', reason);
    } finally {
      setIsSubmitting(false);
    }
  }, [challenge, contributionInput, onBack]);

  const progress = challenge.progress;
  const pct = progress?.progress_percentage ?? 0;
  const session = buildSessionContext();
  const currentUserId = Number(session.userId);
  const isJoined = challenge.participants.some((p: ChallengeParticipantInfo) => p.user_id === currentUserId && p.status === 'active');

  return (
    <div className="min-h-full px-4 py-5 sm:px-6">
      <div className="mx-auto w-full max-w-[1200px] space-y-5">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack}>
            ← Back
          </Button>
          <h1 className="text-2xl font-bold text-slate-900">{challenge.challenge.title}</h1>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-2">
            <h2 className="text-sm font-semibold text-slate-500 uppercase">Challenge Details</h2>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div>
                <dt className="text-slate-500">Type</dt>
                <dd className="font-medium text-slate-700">
                  {CHALLENGE_TYPES[challenge.challenge.challenge_type]?.label || challenge.challenge.challenge_type}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Status</dt>
                <dd>
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[challenge.challenge.status] || ''}`}>
                    {challenge.challenge.status}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Target</dt>
                <dd className="font-medium text-slate-700">
                  {challenge.challenge.target_value} {challenge.challenge.target_type.replace(/_/g, ' ')}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Reward</dt>
                <dd className="font-medium text-slate-700">
                  {challenge.challenge.reward_type
                    ? `${challenge.challenge.reward_type} ${challenge.challenge.reward_value ?? ''}`.trim()
                    : 'None'}
                </dd>
              </div>
            </dl>

            {challenge.challenge.description && (
              <p className="mt-4 text-sm text-slate-600">{challenge.challenge.description}</p>
            )}

            {challenge.challenge.deadline && (
              <div className="mt-4 flex items-center gap-1 text-sm text-slate-500">
                <Calendar className="h-4 w-4" />
                <span>Deadline: {new Date(challenge.challenge.deadline).toLocaleString()}</span>
              </div>
            )}
          </div>

          <div className="space-y-6">
            {progress && (
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <h2 className="text-sm font-semibold text-slate-500 uppercase">Team Progress</h2>
                <div className="mt-4 space-y-3">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600">{Math.round(pct)}% Complete</span>
                      <span className="text-sm font-medium text-slate-900">
                        {progress.aggregate_value} / {progress.target_value}
                      </span>
                    </div>
                    <div className="mt-2 h-3 w-full rounded-full bg-slate-100">
                      <div
                        className={`h-3 rounded-full ${pct >= 100 ? 'bg-amber-500' : 'bg-indigo-500'}`}
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-center">
                    <div className="rounded-lg bg-slate-50 p-2">
                      <p className="text-2xl font-bold text-slate-900">{progress.total_participants}</p>
                      <p className="text-xs text-slate-500">Participants</p>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-2">
                      <p className="text-2xl font-bold text-slate-900">{progress.active_contributors}</p>
                      <p className="text-xs text-slate-500">Contributors</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="text-sm font-semibold text-slate-500 uppercase">Actions</h2>
              <div className="mt-3 flex flex-col gap-2">
                {isStudent && !isJoined && challenge.challenge.status === 'active' && (
                  <Button size="sm" onClick={() => onJoin(challenge.challenge.id)} disabled={submitting}>
                    <UserPlus className="h-3.5 w-3.5" />
                    Join Challenge
                  </Button>
                )}
                {isStudent && isJoined && challenge.challenge.status === 'active' && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowContributionForm(true)}
                    disabled={submitting}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Submit Contribution
                  </Button>
                )}
                {!isStudent && challenge.challenge.status === 'active' && (
                  <Button size="sm" variant="outline" onClick={() => onEnd(challenge.challenge.id)} disabled={submitting}>
                    <X className="h-3.5 w-3.5" />
                    End Challenge
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-slate-500 uppercase">
              Participants ({challenge.participants.length})
            </h2>
            <div className="mt-3 space-y-1">
              {challenge.participants.length === 0 ? (
                <p className="text-sm text-slate-500">No participants yet.</p>
              ) : (
                challenge.participants.map((p: ChallengeParticipantInfo) => (
                  <div key={p.id} className="flex items-center gap-2 text-sm">
                    <Users className="h-4 w-4 text-slate-400" />
                    <span>Student #{p.user_id}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-slate-500 uppercase">
              Recent Contributions ({challenge.contributions.length})
            </h2>
            <div className="mt-3 space-y-1">
              {challenge.contributions.length === 0 ? (
                <p className="text-sm text-slate-500">No contributions yet.</p>
              ) : (
                challenge.contributions.slice(0, 10).map((c: ChallengeContributionInfo) => (
                  <div key={c.id} className="flex items-center justify-between text-sm">
                    <span>
                      <span className="font-medium">Student #{c.user_id}</span> · {c.event_type.replace(/_/g, ' ')}
                      {c.source_id && ` · ${c.source_id}`}
                    </span>
                    <span className="text-slate-600">+{Number(c.value)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {showContributionForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="w-full max-w-md rounded-xl bg-white p-6">
              <h3 className="text-lg font-semibold text-slate-900">Submit Contribution</h3>
              <div className="mt-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Event Type</label>
                  <select
                    className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    value={contributionInput.event_type}
                    onChange={(e) => setContributionInput({ ...contributionInput, event_type: e.target.value })}
                  >
                    <option value="mastery">Mastery</option>
                    <option value="fluency">Fluency</option>
                    <option value="peer_help">Peer Help</option>
                    <option value="exploration">Exploration</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Value</label>
                  <input
                    type="number"
                    className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    value={contributionInput.value}
                    onChange={(e) => setContributionInput({ ...contributionInput, value: Number(e.target.value) })}
                    min="1"
                    step="1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Source ID (optional)</label>
                  <input
                    type="text"
                    className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    value={contributionInput.source_id || ''}
                    onChange={(e) => setContributionInput({ ...contributionInput, source_id: e.target.value })}
                    placeholder="e.g., concept_42, quiz_7"
                  />
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-2">
                <Button size="sm" variant="outline" onClick={() => setShowContributionForm(false)}>
                  Cancel
                </Button>
                <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700" onClick={handleContribute} disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  Submit
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ChallengeFormModal({
  title,
  submitLabel,
  editingChallenge,
  onSubmit,
  onCancel,
  submitting,
}: {
  title: string;
  submitLabel: string;
  editingChallenge?: ChallengeWithProgress;
  onSubmit: (data: TeamChallengeCreateData) => void;
  onCancel: () => void;
  submitting: boolean;
}) {
  const [formData, setFormData] = useState<{
    title: string;
    description: string;
    challenge_type: string;
    target_type: string;
    target_value: number;
    reward_type: string;
    reward_value: string;
    deadline: string;
    grade_id: string;
    standard_id: string;
    division_id: string;
  }>({
    title: editingChallenge?.title || '',
    description: editingChallenge?.description || '',
    challenge_type: editingChallenge?.challenge_type || 'mastery_sprint',
    target_type: editingChallenge?.target_type || 'concepts_mastered',
    target_value: editingChallenge?.target_value || 100,
    reward_type: editingChallenge?.reward_type || '',
    reward_value: editingChallenge?.reward_value || '',
    deadline: editingChallenge?.deadline ? new Date(editingChallenge.deadline).toISOString().slice(0, 16) : '',
    grade_id: editingChallenge?.grade_id ? String(editingChallenge.grade_id) : '',
    standard_id: editingChallenge?.standard_id ? String(editingChallenge.standard_id) : '',
    division_id: editingChallenge?.division_id ? String(editingChallenge.division_id) : '',
  });

  const session = useMemo(() => buildSessionContext(), []);
  const [classValues, setClassValues] = useState<SearchDropdownValues>({
    section: formData.grade_id,
    standard: formData.standard_id,
    division: formData.division_id,
    subject: '',
  });

  const handleSubmit = () => {
    const data: TeamChallengeCreateData = {
      title: formData.title,
      description: formData.description || null,
      challenge_type: formData.challenge_type as unknown as ChallengeType,
      target_type: formData.target_type as unknown as TargetMetric,
      target_value: formData.target_value,
      reward_type: formData.reward_type ? (formData.reward_type as 'points' | 'badge' | 'certificate') : null,
      reward_value: formData.reward_value || null,
      grade_id: formData.grade_id ? Number(formData.grade_id) : null,
      standard_id: formData.standard_id ? Number(formData.standard_id) : null,
      division_id: formData.division_id ? Number(formData.division_id) : null,
      deadline: formData.deadline ? new Date(formData.deadline) : null,
    };
    onSubmit(data);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg rounded-xl bg-white p-6">
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
        <div className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">Title</label>
            <input
              type="text"
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Description</label>
            <textarea
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Class / Group</label>
            <SearchDropdown
              fields={['section', 'standard', 'division']}
              token={session.token}
              subInstituteId={session.subInstituteId}
              values={classValues}
              onChange={(values) => {
                setClassValues(values);
                setFormData({
                  ...formData,
                  grade_id: String(values.section || ''),
                  standard_id: String(values.standard || ''),
                  division_id: String(values.division || ''),
                });
              }}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">Challenge Type</label>
              <select
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                value={formData.challenge_type}
                onChange={(e) => setFormData({ ...formData, challenge_type: e.target.value })}
              >
                {CHALLENGE_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Target Metric</label>
              <select
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                value={formData.target_type}
                onChange={(e) => setFormData({ ...formData, target_type: e.target.value })}
              >
                {TARGET_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Target Value</label>
            <input
              type="number"
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={formData.target_value}
              onChange={(e) => setFormData({ ...formData, target_value: Number(e.target.value) })}
              min="1"
              step="1"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">Reward Type</label>
              <select
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                value={formData.reward_type}
                onChange={(e) => setFormData({ ...formData, reward_type: e.target.value })}
              >
                <option value="">None</option>
                <option value="points">Points</option>
                <option value="badge">Badge</option>
                <option value="certificate">Certificate</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Reward Value</label>
              <input
                type="text"
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                value={formData.reward_value}
                onChange={(e) => setFormData({ ...formData, reward_value: e.target.value })}
                placeholder="e.g., 50 points"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Deadline</label>
            <input
              type="datetime-local"
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={formData.deadline}
              onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
            />
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button size="sm" variant="outline" onClick={onCancel} disabled={submitting}>
            Cancel
          </Button>
          <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700" onClick={handleSubmit} disabled={submitting}>
            {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
            {submitLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ isStudent, onRetry, onCreate }: { isStudent: boolean; onRetry: () => void; onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white py-16 text-center">
      <Trophy className="h-12 w-12 text-slate-300" />
      <h3 className="mt-4 text-lg font-semibold text-slate-900">
        {isStudent ? 'No team challenges yet' : 'No team challenges created'}
      </h3>
      <p className="mt-1 max-w-md text-sm text-slate-500">
        {isStudent
          ? 'Your teacher hasn\'t created any team challenges yet. Keep an eye out!'
          : 'Create your first team challenge to get your class collaborating on learning goals.'}
      </p>
      <div className="mt-4 flex gap-2">
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </Button>
        {!isStudent && (
          <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700" onClick={onCreate}>
            <Plus className="h-3.5 w-3.5" />
            Create Challenge
          </Button>
        )}
      </div>
    </div>
  );
}
