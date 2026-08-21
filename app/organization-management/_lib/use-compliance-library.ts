'use client';

/**
 * Compliance Library data hook (Organization Management module).
 *
 * Ported from G2G's `compliance-library-management.tsx`, whose data-loading
 * and mutation logic lived inline in the screen component (no separate hook
 * file existed in G2G). Split out here as `use-compliance-library.ts` to
 * follow this project's `_lib/api.ts` + `_lib/use-*.ts` convention (see
 * `app/talent-management/_lib/use-onboarding.ts`). Behavior — what loads,
 * when, and what each mutation does — is unchanged from the source screen.
 */

import { useCallback, useEffect, useState } from 'react';

import {
  buildSessionContext,
  complianceLibraryService,
  type ComplianceApiRecord,
  type ComplianceDepartmentOption,
  type ComplianceEmployeeOption,
  type CompliancePayload,
} from './compliance-library-api';

function toMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export interface MutationResult {
  ok: boolean;
  message: string;
}

export function useComplianceLibrary() {
  const [records, setRecords] = useState<ComplianceApiRecord[]>([]);
  const [departments, setDepartments] = useState<ComplianceDepartmentOption[]>([]);
  const [employees, setEmployees] = useState<ComplianceEmployeeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await complianceLibraryService.getRecords(buildSessionContext());
      setRecords(response.data ?? []);
      setDepartments(response.departments ?? []);
      setEmployees(response.employees ?? []);
    } catch (loadError) {
      setError(toMessage(loadError, 'Failed to load compliance records.'));
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
    (payload: CompliancePayload, attachment?: File) =>
      run(
        () => complianceLibraryService.createRecord(buildSessionContext(), payload, attachment),
        'Compliance record created successfully.',
      ),
    [run],
  );

  const updateRecord = useCallback(
    (id: string | number, payload: CompliancePayload, attachment?: File) =>
      run(
        () => complianceLibraryService.updateRecord(buildSessionContext(), id, payload, attachment),
        'Compliance record updated successfully.',
      ),
    [run],
  );

  const deleteRecord = useCallback(
    (id: string | number) =>
      run(
        () => complianceLibraryService.deleteRecord(buildSessionContext(), id),
        'Compliance record deleted successfully.',
      ),
    [run],
  );

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
  };
}
