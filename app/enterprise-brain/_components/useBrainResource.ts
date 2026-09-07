'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * Load-once-per-key fetch with an explicit refresh, shared by every Brain
 * screen so they report failure the same way.
 *
 * Errors are surfaced, never swallowed into an empty result: a screen showing
 * "no rows" when the request actually 404'd is the failure mode this whole
 * integration was brought in to remove.
 */
export function useBrainResource<T>(load: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(load, deps);

  const fetchNow = useCallback(
    async (isRefresh: boolean) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError('');
      try {
        setData(await run());
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Enterprise Brain request failed.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [run],
  );

  useEffect(() => {
    void fetchNow(false);
  }, [fetchNow]);

  return {
    data,
    error,
    loading,
    refreshing,
    refresh: () => void fetchNow(true),
    setData,
  };
}
