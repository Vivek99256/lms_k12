'use client';

import { useCallback, useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Info,
  Loader2,
  Lock,
  Play,
  Shield,
  Trophy,
  Zap,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  getStudentChallengeStatus,
  setChallengeOptIn,
  setChallengeOptOut,
  startChallengeAttempt,
  getStudentChallengeHistory,
  getChallengeModeLeaderboard,
} from '@/app/pal/data/cm-api';
import { buildSessionContext, createAuthHeaders } from '@/lib/erp-client';
import type {
  Challenge,
  ChallengeAttempt,
  ChallengeLeaderboardEntry,
  ChallengeOptIn,
} from '@/app/pal/data/cm-types';

type ViewState = 'loading' | 'not-opted-in' | 'opted-in' | 'challenge-preview' | 'in-attempt' | 'leaderboard';

interface ChallengeModeState {
  hasOptedIn: boolean;
  optIn: ChallengeOptIn | null;
  availableChallenges: Challenge[];
  loading: boolean;
  error: string | null;
  currentAttempt: ChallengeAttempt | null;
  attempts: ChallengeAttempt[];
  leaderboard: ChallengeLeaderboardEntry[];
  leaderboardLoading: boolean;
  activeView: ViewState;
  selectedChallengeId: number | null;
  previewChallenge: Challenge | null;
}

const getMonday = (d: Date): Date => {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = date.getUTCDay();
  const diff = date.getUTCDate() - day + (day === 0 ? -6 : 1);
  date.setUTCDate(diff);
  date.setUTCHours(0, 0, 0, 0);
  return date;
};

const formatWeekLabel = (d: Date): string => {
  const monday = getMonday(d);
  const sunday = new Date(monday);
  sunday.setUTCDate(sunday.getUTCDate() + 6);
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  return `${monday.toLocaleDateString('en-US', opts)} – ${sunday.toLocaleDateString('en-US', opts)}`;
};

export default function ChallengeModePage() {
  const router = useRouter();
  const [state, setState] = useState<ChallengeModeState>({
    hasOptedIn: false,
    optIn: null,
    availableChallenges: [],
    loading: true,
    error: null,
    currentAttempt: null,
    attempts: [],
    leaderboard: [],
    leaderboardLoading: false,
    activeView: 'loading',
    selectedChallengeId: null,
    previewChallenge: null,
  });

  const loadStatus = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const status = await getStudentChallengeStatus();
      const attempts = await getStudentChallengeHistory();
      setState((s) => ({
        ...s,
        hasOptedIn: status.hasOptedIn,
        optIn: status.optIn,
        availableChallenges: status.availableChallenges,
        attempts,
        loading: false,
        activeView: status.hasOptedIn ? 'opted-in' : 'not-opted-in',
      }));
    } catch (err) {
      setState((s) => ({
        ...s,
        loading: false,
        error: err instanceof Error ? err.message : 'Unable to load Challenge Mode status.',
      }));
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const handleOptIn = async () => {
    try {
      const optIn = await setChallengeOptIn(true);
      setState((s) => ({
        ...s,
        hasOptedIn: true,
        optIn,
        activeView: 'opted-in',
      }));
    } catch (err) {
      setState((s) => ({ ...s, error: err instanceof Error ? err.message : 'Unable to opt in.' }));
    }
  };

  const handleOptOut = async () => {
    const confirmed = window.confirm(
      'Are you sure you want to opt out of Challenge Mode? You will no longer appear in the student-facing leaderboard, but your past attempts will be preserved.'
    );
    if (!confirmed) return;
    try {
      const optIn = await setChallengeOptOut();
      setState((s) => ({
        ...s,
        hasOptedIn: false,
        optIn,
        activeView: 'not-opted-in',
        currentAttempt: null,
        leaderboard: [],
      }));
    } catch (err) {
      setState((s) => ({ ...s, error: err instanceof Error ? err.message : 'Unable to opt out.' }));
    }
  };

  const handleStartChallenge = async (challengeId: number) => {
    const challenge = state.availableChallenges.find((c) => c.id === challengeId) || null;
    setState((s) => ({
      ...s,
      selectedChallengeId: challengeId,
      previewChallenge: challenge,
      activeView: 'challenge-preview',
      error: null,
    }));
  };

  const handleConfirmStart = async () => {
    if (!state.selectedChallengeId) return;
    setState((s) => ({ ...s, loading: true, error: null, activeView: 'opted-in' }));
    try {
      const attempt = await startChallengeAttempt(state.selectedChallengeId);
      if (attempt) {
        setState((s) => ({ ...s, currentAttempt: attempt, activeView: 'in-attempt', loading: false, previewChallenge: null }));
      } else {
        setState((s) => ({ ...s, loading: false, error: 'Unable to start challenge. Ensure you have opted in and the challenge is available.', previewChallenge: null }));
      }
    } catch (err) {
      setState((s) => ({ ...s, loading: false, error: err instanceof Error ? err.message : 'Unable to start challenge.', previewChallenge: null }));
    }
  };

  const handleCancelPreview = () => {
    setState((s) => ({ ...s, activeView: 'opted-in', previewChallenge: null, selectedChallengeId: null }));
  };

  const handleShowLeaderboard = async () => {
    if (!state.availableChallenges.length) return;
    const challengeId = state.selectedChallengeId || state.availableChallenges[0].id;
    setState((s) => ({ ...s, leaderboardLoading: true, error: null }));
    try {
      const weekStart = getMonday(new Date()).toISOString().slice(0, 10);
      const entries = await getChallengeModeLeaderboard(challengeId, weekStart);
      setState((s) => ({ ...s, leaderboard: entries, activeView: 'leaderboard', leaderboardLoading: false }));
    } catch (err) {
      setState((s) => ({ ...s, leaderboardLoading: false, error: err instanceof Error ? err.message : 'Unable to load leaderboard.' }));
    }
  };

  const handleShowResults = () => {
    setState((s) => ({ ...s, activeView: 'opted-in', previewChallenge: null }));
  };

  if (state.loading && state.activeView === 'loading') {
    return (
      <div className="flex items-center justify-center rounded-xl border border-slate-200 bg-white py-16 text-sm text-slate-500">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading Challenge Mode...
      </div>
    );
  }

  return (
    <div className="min-h-full px-4 py-5 sm:px-6">
      <div className="mx-auto w-full max-w-[900px] space-y-5">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
            <Zap className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Challenge Mode</h1>
            <p className="text-sm text-slate-500">
              Optional speed-based challenges with a weekly leaderboard. Challenge Mode is separate from normal learning and does not affect your PAL mastery.
            </p>
          </div>
        </div>

        {state.error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {state.error}
          </div>
        )}

        {!state.hasOptedIn && state.activeView !== 'in-attempt' && (
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-start gap-3">
              <Info className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" />
              <div className="space-y-3">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">What is Challenge Mode?</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Challenge Mode is an optional, competitive learning experience. You will face hard/advanced challenge tasks
                    where speed and accuracy both matter. Your results only appear on the Challenge Mode leaderboard if you opt in
                    and score with at least 5 valid responses. Normal PAL mastery, BKT, streaks, and badges are never affected.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={handleOptIn} className="bg-amber-600 text-white hover:bg-amber-700">
                    <Zap className="mr-2 h-4 w-4" />
                    Opt In to Challenge Mode
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {state.hasOptedIn && state.activeView !== 'in-attempt' && (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">
            <Zap className="h-4 w-4 shrink-0" />
            <span className="font-medium">You are opted in to Challenge Mode.</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleOptOut}
              className="ml-auto text-emerald-700 hover:bg-emerald-100"
            >
              Opt Out
            </Button>
          </div>
        )}

        {state.hasOptedIn && state.activeView !== 'in-attempt' && state.activeView !== 'leaderboard' && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-slate-900">Available Challenges</h2>
            {state.availableChallenges.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-white px-5 py-8 text-center text-sm text-slate-500">
                <Lock className="mx-auto mb-2 h-8 w-8 text-slate-300" />
                No challenges are currently available. Check back later.
              </div>
            ) : (
              <div className="space-y-3">
                {state.availableChallenges.map((challenge) => (
                  <div
                    key={challenge.id}
                    className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 space-y-1">
                        <h3 className="text-sm font-semibold text-slate-900">{challenge.title}</h3>
                        {challenge.description && (
                          <p className="text-xs text-slate-600">{challenge.description}</p>
                        )}
                        <div className="flex flex-wrap gap-2">
                          <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700 capitalize">
                            {challenge.difficulty}
                          </span>
                          <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">
                            {challenge.item_count} items
                          </span>
                          <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">
                            {challenge.target_time_seconds}s target/item
                          </span>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleStartChallenge(challenge.id)}
                        disabled={state.loading}
                        className="shrink-0 bg-amber-600 text-white hover:bg-amber-700"
                      >
                        {state.loading && state.selectedChallengeId === challenge.id ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Play className="mr-2 h-4 w-4" />
                        )}
                        Start Challenge
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {state.hasOptedIn && state.activeView !== 'in-attempt' && (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleShowLeaderboard}
              disabled={state.leaderboardLoading || state.availableChallenges.length === 0}
              className="border-indigo-200 text-indigo-700 hover:bg-indigo-50"
            >
              {state.leaderboardLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trophy className="mr-2 h-4 w-4" />
              )}
              Weekly Leaderboard
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/pal/visibility')}
              className="text-slate-500"
            >
              <Shield className="mr-2 h-4 w-4" />
              Visibility & Access
            </Button>
          </div>
        )}
        {(!state.hasOptedIn || state.activeView === 'in-attempt') && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/pal/visibility')}
            className="text-slate-500"
          >
            <Shield className="mr-2 h-4 w-4" />
            Visibility & Access
          </Button>
        )}

        {state.activeView === 'leaderboard' && (
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="text-sm font-semibold text-slate-900">Weekly Leaderboard</h2>
              <p className="text-xs text-slate-500">
                Top 5 Challenge Mode participants · {formatWeekLabel(new Date())}
              </p>
            </div>
            <div className="p-5">
              {state.leaderboard.length === 0 ? (
                <p className="text-sm text-slate-500">No qualified participants this week.</p>
              ) : (
                <div className="space-y-2">
                  {state.leaderboard.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-4 py-2.5"
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
                          {entry.rank || 0}
                        </span>
                        <span className="text-sm font-medium text-slate-900">{entry.display_name}</span>
                      </div>
                      <span className="text-sm font-semibold text-indigo-700">{entry.score} pts</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-4">
                <Button variant="ghost" size="sm" onClick={handleShowResults}>
                  Back to challenges
                </Button>
              </div>
            </div>
          </div>
        )}

        {state.activeView === 'challenge-preview' && state.previewChallenge && (
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="text-lg font-semibold text-slate-900">{state.previewChallenge.title}</h2>
              <p className="text-xs text-slate-500">Review challenge details before starting</p>
            </div>
            <div className="p-5 space-y-4">
              {state.previewChallenge.description && (
                <p className="text-sm text-slate-600">{state.previewChallenge.description}</p>
              )}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <InfoCard label="Difficulty" value={state.previewChallenge.difficulty} tone="amber" />
                <InfoCard label="Items" value={String(state.previewChallenge.item_count)} tone="slate" />
                <InfoCard label="Target Time" value={`${state.previewChallenge.target_time_seconds}s/item`} tone="indigo" />
                <InfoCard label="Status" value={state.previewChallenge.availability_status} tone="emerald" />
              </div>
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                <p className="font-medium">Before you start</p>
                <p className="mt-1 text-amber-700">
                  This challenge is timed. Answer as quickly and accurately as you can. Your score is based on accuracy, speed, and difficulty.
                  Normal PAL mastery is not affected.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={handleConfirmStart} disabled={state.loading} className="bg-indigo-600 text-white hover:bg-indigo-700">
                  {state.loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                  Start Challenge
                </Button>
                <Button variant="ghost" size="sm" onClick={handleCancelPreview} className="text-slate-500">
                  Back
                </Button>
              </div>
            </div>
          </div>
        )}

        {state.activeView === 'in-attempt' && state.currentAttempt && (
          <ChallengeSession
            attempt={state.currentAttempt}
            challenge={state.availableChallenges.find((c) => c.id === state.selectedChallengeId) || null}
            onComplete={async () => {
              setState((s) => ({ ...s, activeView: 'opted-in', currentAttempt: null, selectedChallengeId: null }));
              await loadStatus();
            }}
            onExit={() => {
              setState((s) => ({ ...s, activeView: 'opted-in', currentAttempt: null, selectedChallengeId: null }));
            }}
          />
        )}

        {state.hasOptedIn && state.activeView === 'opted-in' && state.attempts.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="text-sm font-semibold text-slate-900">Your Recent Results</h2>
            </div>
            <div className="divide-y divide-slate-100">
              {state.attempts.slice(0, 10).map((attempt) => (
                <div key={attempt.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900">Challenge #{attempt.challenge_id}</p>
                    <p className="text-xs text-slate-500">
                      {attempt.completed_at ? new Date(attempt.completed_at).toLocaleDateString() : 'In progress'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-slate-900">{attempt.raw_score} pts</p>
                    <p className="text-xs text-slate-500">
                      {Math.round(attempt.accuracy * 100)}% acc · {attempt.is_qualified ? 'Qualified' : 'Not qualified'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ChallengeSession({
  attempt,
  challenge,
  onComplete,
  onExit,
}: {
  attempt: ChallengeAttempt;
  challenge: Challenge | null;
  onComplete: () => void;
  onExit: () => void;
}) {
  const [responses, setResponses] = useState<{ questionIndex: number; isCorrect: boolean; responseTime: number; difficulty: number; targetTime: number }[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const startTimeRef = useRef<number>(0);
  const [elapsed, setElapsed] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [finished, setFinished] = useState(false);
  const [scoring, setScoring] = useState<{ accuracy: number; avg_time_per_item: number; speed_ratio: number; difficulty_coefficient: number; raw_score: number; is_qualified: boolean } | null>(null);

  useEffect(() => {
    startTimeRef.current = Date.now();
  }, []);

  useEffect(() => {
    if (finished) return;
    const id = setInterval(() => {
      setElapsed(Math.round((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [finished]);

  const totalItems = challenge?.item_count || attempt.total_items;
  const targetPerItem = challenge?.target_time_seconds || 60;
  const remaining = Math.max(0, totalItems * targetPerItem - elapsed);

  const submitAttempt = useCallback(async (finalResponses: typeof responses) => {
    setSubmitting(true);
    try {
      const session = buildSessionContext();
      const result = await fetch('/api/pal/gamification/challenge-mode/attempts/' + attempt.id + '/complete', {
        method: 'POST',
        headers: {
          ...createAuthHeaders(session, 'application/json'),
          Accept: 'application/json',
        },
        body: JSON.stringify({
          responses: finalResponses.map((r) => ({
            question_id: null,
            is_correct: r.isCorrect,
            response_time: r.responseTime,
            difficulty: r.difficulty,
            target_time: r.targetTime,
          })),
        }),
      });
      const payload = await result.json();
      if (payload.status === '1' && payload.data?.scoring) {
        setScoring(payload.data.scoring);
        setFinished(true);
      } else {
        alert(payload.message || 'Unable to complete challenge.');
      }
    } catch {
      alert('Unable to complete challenge.');
    } finally {
      setSubmitting(false);
    }
  }, [attempt.id]);

  const handleAnswer = useCallback((isCorrect: boolean) => {
    const responseTime = (Date.now() - startTimeRef.current) / 1000;
    setResponses((prev) => {
      const next = [...prev, { questionIndex: currentIndex, isCorrect, responseTime, difficulty: 3, targetTime: targetPerItem }];
      if (next.length >= totalItems) {
        void submitAttempt(next);
      } else {
        setCurrentIndex(currentIndex + 1);
      }
      return next;
    });
  }, [currentIndex, submitAttempt, totalItems, targetPerItem]);

  if (finished && scoring) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-900">Challenge Complete</h2>
          <p className="text-xs text-slate-500">{challenge?.title || 'Challenge Mode'}</p>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <ResultCard label="Score" value={String(scoring.raw_score)} tone="indigo" />
            <ResultCard label="Accuracy" value={`${Math.round(scoring.accuracy * 100)}%`} tone="emerald" />
            <ResultCard label="Speed Ratio" value={scoring.speed_ratio.toFixed(2)} tone="amber" />
            <ResultCard label="Difficulty" value={(scoring.difficulty_coefficient * 5).toFixed(1)} tone="slate" />
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            {scoring.is_qualified ? (
              <span className="font-medium text-emerald-700">Qualified for leaderboard (≥5 valid responses)</span>
            ) : (
              <span className="font-medium text-amber-700">Not qualified — need at least 5 valid responses for leaderboard.</span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={onComplete} className="bg-indigo-600 text-white hover:bg-indigo-700">
              Back to challenges
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{challenge?.title || 'Challenge Mode'}</h2>
            <p className="text-xs text-slate-500">
              Item {currentIndex + 1} of {totalItems}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold text-slate-900">
              {Math.floor(remaining / 60)}:{(remaining % 60).toString().padStart(2, '0')}
            </p>
            <p className="text-[11px] text-slate-500">remaining</p>
          </div>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-indigo-500 transition-all"
            style={{ width: `${(responses.length / totalItems) * 100}%` }}
          />
        </div>
      </div>
      <div className="p-5 space-y-4">
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <p className="font-medium">Question {currentIndex + 1}</p>
          <p className="mt-1 text-amber-700">Answer as quickly and accurately as you can.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => handleAnswer(true)}
            disabled={submitting}
            className="bg-emerald-600 text-white hover:bg-emerald-700"
          >
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Correct
          </Button>
          <Button
            onClick={() => handleAnswer(false)}
            disabled={submitting}
            variant="outline"
            className="border-rose-200 text-rose-700 hover:bg-rose-50"
          >
            Incorrect
          </Button>
        </div>
        <Button variant="ghost" size="sm" onClick={onExit} className="text-slate-500">
          Exit challenge
        </Button>
      </div>
    </div>
  );
}

function InfoCard({ label, value, tone }: { label: string; value: string; tone: string }) {
  const toneStyles: Record<string, string> = {
    indigo: 'text-indigo-700',
    emerald: 'text-emerald-700',
    amber: 'text-amber-700',
    slate: 'text-slate-700',
  };
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-center">
      <div className={`text-sm font-bold ${toneStyles[tone] || 'text-slate-700'}`}>{value}</div>
      <div className="text-[11px] font-medium text-slate-500">{label}</div>
    </div>
  );
}

function ResultCard({ label, value, tone }: { label: string; value: string; tone: string }) {
  const toneStyles: Record<string, string> = {
    indigo: 'text-indigo-700',
    emerald: 'text-emerald-700',
    amber: 'text-amber-700',
    slate: 'text-slate-700',
  };
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-center">
      <div className={`text-lg font-bold ${toneStyles[tone] || 'text-slate-700'}`}>{value}</div>
      <div className="text-[11px] font-medium text-slate-500">{label}</div>
    </div>
  );
}
