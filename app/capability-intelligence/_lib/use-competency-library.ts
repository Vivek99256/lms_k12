'use client';

/**
 * Ported from G2G's `hooks/use-competency-library.ts` — exports
 * `useCompetencyLibrary` (list + KPIs + mutations) and `useCompetencyDetail`
 * (detail-panel fetch for the Proficiency / Associations / Attachments /
 * History tabs), same shape and behavior.
 *
 * Adaptation: G2G resolved a `LaravelContext` from `useAuth()` +
 * `getLaravelContext(user)`. This repo has no `useAuth` hook, so
 * `buildSessionContext()` is called directly — same pattern as
 * `use-certifications.ts` / `use-command-center.ts`.
 *
 * UPDATE (this session) — `archive`, `clone`, `importRows` and `exportRows`
 * are now wired (their endpoints are confirmed-live — see
 * `competency-library-api.ts`). `useCompetencyDetail` now calls the richer
 * `GET .../competency/{id}/detail` endpoint (proficiency/associations/
 * attachments/history), matching G2G exactly, instead of the earlier
 * scoped-down version that reused the plain `show()` record.
 */

import { useCallback, useEffect, useState } from 'react';

import {
  buildSessionContext,
  competencyLibraryService,
  type CompetencyDetail,
  type CompetencyImportResult,
  type CompetencyImportRow,
  type CompetencyLibraryItem,
  type CompetencyLibraryListParams,
  type CompetencyLibraryPagination,
  type CompetencyLibraryPayload,
} from './competency-library-api';

function toMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export interface MutationResult {
  ok: boolean;
  message: string;
}

export interface UseCompetencyLibraryState {
  loading: boolean;
  error: string | null;
  items: CompetencyLibraryItem[];
  pagination: CompetencyLibraryPagination | null;
  saving: boolean;
  actionMessage: string | null;
  actionError: string | null;
  retry: () => void;
  create: (payload: CompetencyLibraryPayload) => Promise<MutationResult>;
  update: (id: number, payload: CompetencyLibraryPayload) => Promise<MutationResult>;
  remove: (id: number) => Promise<MutationResult>;
  /** Archive (approve_status = Cancelled) or restore - never a delete. */
  archive: (id: number, restore?: boolean) => Promise<MutationResult>;
  clone: (id: number, name?: string) => Promise<MutationResult>;
  importRows: (rows: CompetencyImportRow[]) => Promise<MutationResult & { result?: CompetencyImportResult }>;
  exportRows: () => Promise<CompetencyLibraryItem[]>;
  exporting: boolean;
  importing: boolean;
  clearMessages: () => void;
}

/**
 * Fetches the detail payload (proficiency / associations / attachments /
 * history) for the selected competency in the library side panel. Refetches
 * when the id changes; clears when id is null (panel closed).
 */
export function useCompetencyDetail(id: number | null) {
  const [detail, setDetail] = useState<CompetencyDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(async () => {
      if (id == null) {
        setDetail(null);
        setError(null);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const res = await competencyLibraryService.getDetail(buildSessionContext(), id);
        if (!cancelled) setDetail(res.data);
      } catch (err) {
        if (!cancelled) {
          setError(toMessage(err, 'Failed to load competency detail.'));
          setDetail(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  return { detail, loading, error };
}

export function useCompetencyLibrary(params: CompetencyLibraryListParams): UseCompetencyLibraryState {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<CompetencyLibraryItem[]>([]);
  const [pagination, setPagination] = useState<CompetencyLibraryPagination | null>(null);

  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Serialised so the effect only refires when a param value actually changes.
  const paramsKey = JSON.stringify(params);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await competencyLibraryService.list(
        buildSessionContext(),
        JSON.parse(paramsKey) as CompetencyLibraryListParams,
      );
      setItems(response.data ?? []);
      setPagination(response.pagination ?? null);
    } catch (loadError) {
      setError(toMessage(loadError, 'Failed to load competencies.'));
      setItems([]);
      setPagination(null);
    } finally {
      setLoading(false);
    }
  }, [paramsKey]);

  useEffect(() => {
    queueMicrotask(() => {
      load();
    });
  }, [load]);

  const runMutation = useCallback(
    async (action: () => Promise<{ message: string }>, fallback: string): Promise<MutationResult> => {
      setSaving(true);
      setActionError(null);
      setActionMessage(null);

      try {
        const response = await action();
        setActionMessage(response.message);
        // Reload so the table reflects the change (and any server-side re-sort).
        await load();
        return { ok: true, message: response.message };
      } catch (mutationError) {
        const message = toMessage(mutationError, fallback);
        setActionError(message);
        return { ok: false, message };
      } finally {
        setSaving(false);
      }
    },
    [load],
  );

  const create = useCallback(
    (payload: CompetencyLibraryPayload) =>
      runMutation(
        () => competencyLibraryService.create(buildSessionContext(), payload),
        'Failed to create the competency.',
      ),
    [runMutation],
  );

  const update = useCallback(
    (id: number, payload: CompetencyLibraryPayload) =>
      runMutation(
        () => competencyLibraryService.update(buildSessionContext(), id, payload),
        'Failed to update the competency.',
      ),
    [runMutation],
  );

  const remove = useCallback(
    (id: number) =>
      runMutation(
        () => competencyLibraryService.remove(buildSessionContext(), id),
        'Failed to delete the competency.',
      ),
    [runMutation],
  );

  const archive = useCallback(
    (id: number, restore = false) =>
      runMutation(
        () => competencyLibraryService.archive(buildSessionContext(), id, restore),
        restore ? 'Failed to restore the competency.' : 'Failed to archive the competency.',
      ),
    [runMutation],
  );

  const clone = useCallback(
    (id: number, name?: string) =>
      runMutation(
        () => competencyLibraryService.clone(buildSessionContext(), id, name),
        'Failed to clone the competency.',
      ),
    [runMutation],
  );

  const importRows = useCallback(
    async (rows: CompetencyImportRow[]) => {
      setImporting(true);
      setActionError(null);
      setActionMessage(null);

      try {
        const response = await competencyLibraryService.importRows(buildSessionContext(), rows);
        setActionMessage(response.message);
        await load();
        return { ok: true, message: response.message, result: response.data };
      } catch (importError) {
        const message = toMessage(importError, 'Failed to import competencies.');
        setActionError(message);
        return { ok: false, message };
      } finally {
        setImporting(false);
      }
    },
    [load],
  );

  const exportRows = useCallback(async () => {
    setExporting(true);
    setActionError(null);

    try {
      const response = await competencyLibraryService.exportRows(
        buildSessionContext(),
        JSON.parse(paramsKey) as CompetencyLibraryListParams,
      );
      return response.data ?? [];
    } catch (exportError) {
      setActionError(toMessage(exportError, 'Failed to export the library.'));
      return [];
    } finally {
      setExporting(false);
    }
  }, [paramsKey]);

  return {
    loading,
    error,
    items,
    pagination,
    saving,
    actionMessage,
    actionError,
    retry: load,
    create,
    update,
    remove,
    archive,
    clone,
    importRows,
    exportRows,
    exporting,
    importing,
    clearMessages: () => {
      setActionMessage(null);
      setActionError(null);
    },
  };
}
