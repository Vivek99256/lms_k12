'use client';

/**
 * Ported from G2G's `hooks/use-competency.ts` (command-center slice) —
 * exports `useCompetencyCommandCenter`, unchanged in shape and behavior.
 *
 * Adaptation: G2G resolved a `LaravelContext` from `useAuth()` +
 * `getLaravelContext(user)`. This repo has no `useAuth` hook, so
 * `buildSessionContext()` is called directly (it reads live
 * localStorage/sessionStorage, same as G2G's context resolution did) —
 * same pattern as `use-certifications.ts`.
 */

import { useCallback, useEffect, useState } from 'react';

import {
  buildSessionContext,
  competencyCommandCenterService,
  type CommandCenterData,
  type CompetencyFilterOptions,
  type CompetencyFilters,
  type QuickCreateKind,
} from './command-center-api';

function toMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export interface CompetencyCommandCenterState {
  loading: boolean;
  error: string | null;
  data: CommandCenterData | null;
  filterOptions: CompetencyFilterOptions | null;
  filterOptionsLoading: boolean;
  creating: boolean;
  actionMessage: string | null;
  actionError: string | null;
  retry: () => void;
  create: (
    kind: QuickCreateKind,
    payload: Record<string, unknown>,
  ) => Promise<{ ok: boolean; message: string }>;
  clearMessages: () => void;
}

export function useCompetencyCommandCenter(filters: CompetencyFilters): CompetencyCommandCenterState {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<CommandCenterData | null>(null);

  const [filterOptions, setFilterOptions] = useState<CompetencyFilterOptions | null>(null);
  const [filterOptionsLoading, setFilterOptionsLoading] = useState(true);

  const [creating, setCreating] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Serialised so the effect only refires when a filter value actually changes.
  const filterKey = JSON.stringify(filters);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await competencyCommandCenterService.getCommandCenter(
        buildSessionContext(),
        JSON.parse(filterKey) as CompetencyFilters,
      );
      setData(response.data);
    } catch (loadError) {
      setError(toMessage(loadError, 'Failed to load the competency command center.'));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [filterKey]);

  useEffect(() => {
    queueMicrotask(() => {
      load();
    });
  }, [load]);

  // Filter options are tenant-wide - loaded once, independent of the filters.
  const loadFilters = useCallback(async () => {
    setFilterOptionsLoading(true);

    try {
      const response = await competencyCommandCenterService.getFilters(buildSessionContext());
      setFilterOptions(response.data);
    } catch {
      setFilterOptions(null);
    } finally {
      setFilterOptionsLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      loadFilters();
    });
  }, [loadFilters]);

  const create = useCallback(
    async (kind: QuickCreateKind, payload: Record<string, unknown>) => {
      setCreating(true);
      setActionError(null);
      setActionMessage(null);

      try {
        const response = await competencyCommandCenterService.create(buildSessionContext(), kind, payload);
        setActionMessage(response.message);
        // Reload so the new record is reflected across tiles, queues and the feed.
        await load();
        return { ok: true, message: response.message };
      } catch (createError) {
        const message = toMessage(createError, 'Failed to create the record.');
        setActionError(message);
        return { ok: false, message };
      } finally {
        setCreating(false);
      }
    },
    [load],
  );

  return {
    loading,
    error,
    data,
    filterOptions,
    filterOptionsLoading,
    creating,
    actionMessage,
    actionError,
    retry: load,
    create,
    clearMessages: () => {
      setActionMessage(null);
      setActionError(null);
    },
  };
}
