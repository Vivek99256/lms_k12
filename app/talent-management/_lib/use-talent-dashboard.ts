'use client';

/**
 * Ported from G2G's `hooks/use-talent-dashboard.ts`.
 *
 * G2G's hook uses `@tanstack/react-query` (`useQuery` for both the dashboard
 * payload and the filter options, `useQueryClient().invalidateQueries` for
 * refresh) gated on `isLaravelContextReady(getLaravelContext(user))`. This
 * project has no react-query, so it is reimplemented with plain
 * `useState`/`useEffect`/`useCallback` - same pattern as
 * `app/hrit/_lib/use-payroll.ts` - while preserving the same returned data
 * shape and loading/error semantics:
 *   - `loading` is true only while there is nothing to show yet (first load);
 *     a refetch after that keeps the previous data on screen.
 *   - `fetching` is true for the duration of any in-flight dashboard request,
 *     first load or refresh alike (drives the header's spinner).
 *   - `optionsLoading` mirrors the filter-options request the same way.
 *   - `unauthenticated` is true when the session cannot be resolved at all,
 *     so the page can render the signed-out prompt instead of an error state.
 * Readiness is `buildSessionContext().token` truthiness (this project's
 * equivalent of G2G's `isLaravelContextReady`), not `useAuth()`.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { buildSessionContext } from '@/lib/erp-client';
import { errorMessage, talentDashboardService } from './talent-dashboard-api';
import type { TalentDashboardData, TalentDashboardFilterData, TalentDashboardQuery } from './talent-types';

/** Laravel's `date` rule expects Y-m-d, not an ISO timestamp. */
export function toDateParam(date: Date) {
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function startOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

/** "1 May - 31 May 2025" - what the date-range button shows. */
export function formatRangeLabel(from: string, to: string) {
  const fromDate = new Date(from);
  const toDate = new Date(to);

  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
    return `${from} - ${to}`;
  }

  const day = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' });
  const full = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  return `${day.format(fromDate)} - ${full.format(toDate)}`;
}

export interface TalentDashboardFilters {
  departmentId: string;
  location: string;
  businessUnit: string;
  from: string;
  to: string;
}

const DEFAULT_FILTERS: TalentDashboardFilters = {
  departmentId: 'all',
  location: 'all',
  businessUnit: 'all',
  from: toDateParam(startOfMonth()),
  to: toDateParam(endOfMonth()),
};

function toQuery(filters: TalentDashboardFilters): TalentDashboardQuery {
  return {
    // 'all' is the UI's no-filter sentinel; the service strips it before sending.
    department_id: filters.departmentId,
    location: filters.location,
    from: filters.from,
    to: filters.to,
  };
}

/**
 * The Talent Management dashboard.
 *
 * One request for all six sections (GET /api/talent/dashboard), plus a second
 * for the real filter options. Both are gated on a resolvable session:
 * firing before login would 401 and surface as an error state on a page the
 * user has not finished authenticating into.
 */
export function useTalentDashboard() {
  const [filters, setFilters] = useState<TalentDashboardFilters>(DEFAULT_FILTERS);

  const ready = useMemo(() => Boolean(buildSessionContext().token), []);

  const [data, setData] = useState<TalentDashboardData | null>(null);
  const [meta, setMeta] = useState<{ from: string; to: string }>({ from: filters.from, to: filters.to });
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [options, setOptions] = useState<TalentDashboardFilterData | null>(null);
  const [optionsLoading, setOptionsLoading] = useState(true);

  const hasDataRef = useRef(false);

  const loadDashboard = useCallback(async () => {
    if (!ready) {
      setLoading(false);
      return;
    }

    setFetching(true);
    if (!hasDataRef.current) setLoading(true);
    setError(null);

    try {
      const response = await talentDashboardService.getDashboard(toQuery(filters));
      setData(response.data);
      setMeta(response.meta);
      hasDataRef.current = true;
    } catch (loadError) {
      setError(errorMessage(loadError, 'Failed to load the talent dashboard.'));
    } finally {
      setLoading(false);
      setFetching(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, filters.departmentId, filters.location, filters.from, filters.to]);

  const loadOptions = useCallback(async () => {
    if (!ready) {
      setOptionsLoading(false);
      return;
    }

    setOptionsLoading(true);

    try {
      const response = await talentDashboardService.getFilters();
      setOptions(response);
    } catch {
      setOptions(null);
    } finally {
      setOptionsLoading(false);
    }
  }, [ready]);

  useEffect(() => {
    queueMicrotask(() => {
      loadDashboard();
    });
  }, [loadDashboard]);

  useEffect(() => {
    // Departments and locations change far less often than the metrics, so
    // this only reruns if `ready` flips (there is no filter-driven refetch).
    queueMicrotask(() => {
      loadOptions();
    });
  }, [loadOptions]);

  const setFilter = useCallback(
    <K extends keyof TalentDashboardFilters>(key: K, value: TalentDashboardFilters[K]) => {
      setFilters((current) => ({ ...current, [key]: value }));
    },
    []
  );

  const setRange = useCallback((from: string, to: string) => {
    setFilters((current) => ({ ...current, from, to }));
  }, []);

  const resetFilters = useCallback(() => setFilters(DEFAULT_FILTERS), []);

  const refresh = useCallback(() => loadDashboard(), [loadDashboard]);

  return {
    data,
    meta,
    options,
    filters,
    setFilter,
    setRange,
    resetFilters,
    rangeLabel: formatRangeLabel(filters.from, filters.to),
    /** True only while there is nothing to show - a refetch keeps the old data. */
    loading: loading && ready,
    fetching,
    optionsLoading: optionsLoading && ready,
    error,
    /** Session not yet established: render the signed-out prompt, not an error. */
    unauthenticated: !ready,
    refresh,
  };
}
