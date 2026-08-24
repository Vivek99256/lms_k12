'use client';

/**
 * Disciplinary Library data hook (Organization Management module).
 *
 * Ported from G2G's `disciplinary-management.tsx`, whose data-loading and
 * mutation logic (including the department -> employee cascade lookup) lived
 * inline in the screen component. Split out here as
 * `use-disciplinary-library.ts` to follow this project's `_lib/api.ts` +
 * `_lib/use-*.ts` convention (see `app/talent-management/_lib/use-onboarding.ts`).
 * Behavior is unchanged from the source screen.
 */

import { useCallback, useEffect, useState } from 'react';

import {
  buildSessionContext,
  disciplinaryLibraryService,
  type DisciplinaryApiRecord,
  type DisciplinaryOption,
  type DisciplinaryPayload,
} from './disciplinary-library-api';

function toMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export interface MutationResult {
  ok: boolean;
  message: string;
}

export function useDisciplinaryLibrary() {
  const [records, setRecords] = useState<DisciplinaryApiRecord[]>([]);
  const [departments, setDepartments] = useState<DisciplinaryOption[]>([]);
  const [employees, setEmployees] = useState<DisciplinaryOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await disciplinaryLibraryService.getRecords(buildSessionContext());
      setRecords(response.data ?? []);
      setDepartments(response.departments ?? []);
      setEmployees(response.employees ?? []);
    } catch (loadError) {
      setError(toMessage(loadError, 'Failed to load disciplinary records.'));
      setRecords([]);
      setDepartments([]);
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  const run = useCallback(async (operation: () => Promise<{ message?: string }>, fallback: string): Promise<MutationResult> => {
    setSaving(true);
    try {
      const response = await operation();
      return { ok: true, message: response?.message || fallback };
    } catch (mutationError) {
      return { ok: false, message: toMessage(mutationError, `${fallback} failed.`) };
    } finally {
      setSaving(false);
    }
  }, []);

  const createRecord = useCallback(
    (payload: DisciplinaryPayload) =>
      run(
        () => disciplinaryLibraryService.createRecord(buildSessionContext(), payload),
        'Disciplinary incident submitted successfully.',
      ),
    [run],
  );

  const updateRecord = useCallback(
    (id: string | number, payload: DisciplinaryPayload) =>
      run(
        () => disciplinaryLibraryService.updateRecord(buildSessionContext(), id, payload),
        'Disciplinary incident updated successfully.',
      ),
    [run],
  );

  const deleteRecord = useCallback(
    (id: string | number) =>
      run(
        () => disciplinaryLibraryService.deleteRecord(buildSessionContext(), id),
        'Disciplinary incident deleted successfully.',
      ),
    [run],
  );

  /** Department -> employee cascade, used by both the create form and the edit dialog. */
  const loadEmployeesByDepartment = useCallback(async (department: string): Promise<DisciplinaryOption[]> => {
    if (!department) return [];
    try {
      const response = await disciplinaryLibraryService.getEmployeesByDepartment(buildSessionContext(), department);
      return response.data ?? [];
    } catch {
      return [];
    }
  }, []);

  return {
    records,
    departments,
    employees,
    loading,
    saving,
    error,
    retry: load,
    createRecord,
    updateRecord,
    deleteRecord,
    loadEmployeesByDepartment,
  };
}
