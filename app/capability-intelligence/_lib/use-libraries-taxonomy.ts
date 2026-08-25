'use client';

/**
 * Ported from G2G's `hooks/use-competency-libraries.ts` — exports
 * `useLibraryMeta`, `useLibraryList`, `useLibraryDetail`, `useTaxonomy`,
 * `useWorkFunctions`, `useLevelsOfResponsibility`, `useSkillTaxonomy` and
 * `invalidateLibraryMeta`, unchanged in shape and behavior.
 *
 * Adaptation: G2G resolved a `LaravelContext` from `useAuth()` +
 * `getLaravelContext(user)`. This repo has no `useAuth` hook, so every call
 * site here calls `buildSessionContext()` directly (it reads live
 * localStorage/sessionStorage, same as G2G's context resolution did),
 * matching `talent-management/_lib/use-certifications.ts`.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  buildSessionContext,
  competencyLibrariesService,
  type GenericDetail,
  type LibraryListParams,
  type LibraryMeta,
  type LibraryPagination,
  type LibraryPayload,
  type LibraryRow,
  type LibraryTabId,
  type ResponsibilityLevel,
  type SkillTaxonomy,
  type TaxonomyPayload,
  type TaxonomyTree,
} from './libraries-taxonomy-api';

function toMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export interface MutationResult {
  ok: boolean;
  message: string;
}

/* ------------------------------------------------------------------ *
 * Shared dropdown options + tab counts
 * ------------------------------------------------------------------ */

const EMPTY_META: LibraryMeta = {
  departments: [],
  sub_departments: [],
  micro_categories: [],
  industries: [],
  jobroles_by_department: {},
  related_skills: [],
  job_titles: [],
  learning_resources: [],
  proficiency_levels: [],
  invisible_types: [],
  task_types: [],
  counts: {} as LibraryMeta['counts'],
};

const META_TTL_MS = 60_000;

let metaCache: { key: string; at: number; value: LibraryMeta } | null = null;

/** Dropped after any library write, so counts never show a stale number. */
export function invalidateLibraryMeta() {
  metaCache = null;
}

export function useLibraryMeta() {
  const [meta, setMeta] = useState<LibraryMeta>(EMPTY_META);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(async () => {
      const session = buildSessionContext();
      const key = session.subInstituteId;
      const fresh =
        metaCache && metaCache.key === key && Date.now() - metaCache.at < META_TTL_MS ? metaCache.value : null;

      if (fresh) {
        if (!cancelled) {
          setMeta(fresh);
          setError(null);
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      try {
        const response = await competencyLibrariesService.meta(session);
        const value = { ...EMPTY_META, ...response.data };
        metaCache = { key, at: Date.now(), value };

        if (!cancelled) {
          setMeta(value);
          setError(null);
        }
      } catch (metaError) {
        if (!cancelled) setError(toMessage(metaError, 'Failed to load library options.'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [nonce]);

  return {
    meta,
    loading,
    error,
    refresh: () => {
      invalidateLibraryMeta();
      setNonce((n) => n + 1);
    },
  };
}

/* ------------------------------------------------------------------ *
 * One tab's list + CRUD
 * ------------------------------------------------------------------ */

export interface UseLibraryListState<T> {
  loading: boolean;
  error: string | null;
  items: T[];
  pagination: LibraryPagination | null;
  saving: boolean;
  actionMessage: string | null;
  actionError: string | null;
  retry: () => void;
  create: (payload: LibraryPayload) => Promise<MutationResult & { createdId?: number | null }>;
  update: (id: number, payload: LibraryPayload) => Promise<MutationResult>;
  remove: (id: number) => Promise<MutationResult>;
  clearMessages: () => void;
}

export function useLibraryList<T extends LibraryRow = LibraryRow>(
  tab: LibraryTabId,
  params: LibraryListParams,
  enabled = true,
): UseLibraryListState<T> {
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<T[]>([]);
  const [pagination, setPagination] = useState<LibraryPagination | null>(null);
  const [saving, setSaving] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const paramsKey = JSON.stringify(params);

  const load = useCallback(async () => {
    if (!enabled) return;

    setLoading(true);
    setError(null);

    try {
      const response = await competencyLibrariesService.list<T>(
        buildSessionContext(),
        tab,
        JSON.parse(paramsKey) as LibraryListParams,
      );
      setItems(response.data ?? []);
      setPagination(response.pagination ?? null);
    } catch (loadError) {
      setError(toMessage(loadError, 'Failed to load this library.'));
      setItems([]);
      setPagination(null);
    } finally {
      setLoading(false);
    }
  }, [enabled, paramsKey, tab]);

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
        invalidateLibraryMeta();
        setActionMessage(response.message);
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
    async (payload: LibraryPayload) => {
      let createdId: number | null = null;
      const result = await runMutation(async () => {
        const response = await competencyLibrariesService.create(buildSessionContext(), tab, payload);
        createdId = response?.data?.id ?? null;
        return { message: response.message };
      }, 'Failed to create the entry.');
      return { ...result, createdId };
    },
    [runMutation, tab],
  );

  const update = useCallback(
    (id: number, payload: LibraryPayload) =>
      runMutation(
        () => competencyLibrariesService.update(buildSessionContext(), tab, id, payload),
        'Failed to update the entry.',
      ),
    [runMutation, tab],
  );

  const remove = useCallback(
    (id: number) =>
      runMutation(
        () => competencyLibrariesService.remove(buildSessionContext(), tab, id),
        'Failed to delete the entry.',
      ),
    [runMutation, tab],
  );

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
    clearMessages: () => {
      setActionMessage(null);
      setActionError(null);
    },
  };
}

/* ------------------------------------------------------------------ *
 * Detail panel
 * ------------------------------------------------------------------ */

export function useLibraryDetail<T = GenericDetail>(tab: LibraryTabId, id: number | null) {
  const [detail, setDetail] = useState<T | null>(null);
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
        const response = await competencyLibrariesService.get<T>(buildSessionContext(), tab, id);
        if (!cancelled) setDetail(response.data);
      } catch (detailError) {
        if (!cancelled) {
          setError(toMessage(detailError, 'Failed to load the details.'));
          setDetail(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [id, tab]);

  return { detail, loading, error };
}

/* ------------------------------------------------------------------ *
 * Taxonomy editor
 * ------------------------------------------------------------------ */

export interface UseTaxonomyState {
  tree: TaxonomyTree | null;
  loading: boolean;
  error: string | null;
  saving: boolean;
  actionMessage: string | null;
  actionError: string | null;
  categories: string[];
  subCategoriesOf: (category: string) => string[];
  retry: () => void;
  addNode: (payload: TaxonomyPayload) => Promise<MutationResult>;
  renameNode: (payload: TaxonomyPayload) => Promise<MutationResult>;
  deleteNode: (category: string, subCategory?: string) => Promise<MutationResult>;
  clearMessages: () => void;
}

export function useTaxonomy(tab: LibraryTabId, enabled = true): UseTaxonomyState {
  const [tree, setTree] = useState<TaxonomyTree | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!enabled) return;

    setLoading(true);
    setError(null);
    try {
      const response = await competencyLibrariesService.taxonomy(buildSessionContext(), tab);
      setTree(response.data);
    } catch (loadError) {
      setError(toMessage(loadError, 'Failed to load the taxonomy.'));
      setTree(null);
    } finally {
      setLoading(false);
    }
  }, [enabled, tab]);

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
        invalidateLibraryMeta();
        setActionMessage(response.message);
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

  const categories = useMemo(() => (tree?.categories ?? []).map((node) => node.category), [tree]);

  const subCategoriesOf = useCallback(
    (category: string) =>
      (tree?.categories ?? []).find((node) => node.category === category)?.sub_categories.map((sub) => sub.name) ?? [],
    [tree],
  );

  return {
    tree,
    loading,
    error,
    saving,
    actionMessage,
    actionError,
    categories,
    subCategoriesOf,
    retry: load,
    addNode: (payload) =>
      runMutation(() => competencyLibrariesService.createTaxonomy(buildSessionContext(), tab, payload), 'Failed to add the category.'),
    renameNode: (payload) =>
      runMutation(() => competencyLibrariesService.renameTaxonomy(buildSessionContext(), tab, payload), 'Failed to rename the category.'),
    deleteNode: (category, subCategory) =>
      runMutation(
        () => competencyLibrariesService.deleteTaxonomy(buildSessionContext(), tab, category, subCategory),
        'Failed to remove the category.',
      ),
    clearMessages: () => {
      setActionMessage(null);
      setActionError(null);
    },
  };
}

/* ------------------------------------------------------------------ *
 * Critical work functions (Job Role Task drill-down)
 * ------------------------------------------------------------------ */

export function useWorkFunctions(jobrole: string | null, enabled = true) {
  const [values, setValues] = useState<string[]>([]);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    queueMicrotask(async () => {
      try {
        const response = await competencyLibrariesService.workFunctions(buildSessionContext(), jobrole ?? undefined);
        if (!cancelled) setValues(response.data ?? []);
      } catch {
        if (!cancelled) setValues([]);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, jobrole]);

  return values;
}

/* ------------------------------------------------------------------ *
 * Levels of responsibility
 * ------------------------------------------------------------------ */

export function useLevelsOfResponsibility(enabled = true) {
  const [levels, setLevels] = useState<ResponsibilityLevel[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    queueMicrotask(async () => {
      setLoading(true);
      try {
        const response = await competencyLibrariesService.levelsOfResponsibility(buildSessionContext());
        if (!cancelled) {
          setLevels(response.data ?? []);
          setError(null);
        }
      } catch (loadError) {
        if (!cancelled) setError(toMessage(loadError, 'Failed to load the responsibility levels.'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return { levels, loading, error };
}

/* ------------------------------------------------------------------ *
 * Skill taxonomy tree
 * ------------------------------------------------------------------ */

export function useSkillTaxonomy(params: { search?: string; category?: string; department?: string }) {
  const [taxonomy, setTaxonomy] = useState<SkillTaxonomy | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const paramsKey = JSON.stringify(params);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await competencyLibrariesService.skillTaxonomyTree(buildSessionContext(), JSON.parse(paramsKey));
      setTaxonomy(response.data);
    } catch (loadError) {
      setError(toMessage(loadError, 'Failed to load the skill taxonomy.'));
      setTaxonomy(null);
    } finally {
      setLoading(false);
    }
  }, [paramsKey]);

  useEffect(() => {
    queueMicrotask(() => {
      load();
    });
  }, [load]);

  return { taxonomy, loading, error, retry: load };
}
