'use client';

import { useCallback, useEffect, useState } from 'react';

import type { LearnerScope } from '@/app/pal/new/data/gamification';

import { isMissingLearnerError, useGamificationScope } from './GamificationScope';

/**
 * The load state machine every Gamification page shares.
 *
 * Five states rather than the usual three, because two of the outcomes here are
 * legitimate rather than failures:
 *
 *   needs-learner  staff have not picked a student yet — a prompt, not an error
 *   ready + empty  the learner genuinely has no record yet. Pages render an
 *                  honest empty state; this hook never invents one.
 *
 * An in-flight request is deliberately not aborted on unmount: an abort landing
 * in the catch used to leave pages with no state at all.
 */
export type LoadState = 'loading' | 'ready' | 'error' | 'needs-learner';

export function useGamificationResource<T>(
  loader: (scope: LearnerScope, signal?: AbortSignal) => Promise<T>
): {
  state: LoadState;
  data: T | null;
  error: string;
  reload: () => void;
  refreshing: boolean;
  scope: ReturnType<typeof useGamificationScope>;
} {
  const scope = useGamificationScope();
  const [state, setState] = useState<LoadState>('loading');
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const learnerId = scope.scope.learnerId ?? '';

  const load = useCallback(
    async (isRefresh: boolean) => {
      if (isRefresh) setRefreshing(true);
      try {
        const next = await loader({ learnerId: learnerId || undefined });
        setData(next);
        setError('');
        setState('ready');
      } catch (err) {
        if (isMissingLearnerError(err)) {
          setData(null);
          setError('');
          setState('needs-learner');
        } else {
          setData(null);
          setError(err instanceof Error ? err.message : 'The Gamification request failed.');
          setState('error');
        }
      } finally {
        setRefreshing(false);
      }
    },
    // `loader` is recreated on every render by the calling page, so depending
    // on it would loop. The learner is the only real input.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [learnerId]
  );

  const reload = useCallback(() => {
    void load(true);
  }, [load]);

  useEffect(() => {
    if (!scope.hydrated) return;
    // The rule cannot see that `load` only touches state after its first await
    // on the non-refresh path — the same exemption the Administration page uses.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(false);
  }, [load, scope.hydrated]);

  return { state, data, error, reload, refreshing, scope };
}
