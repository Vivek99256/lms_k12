'use client';

/**
 * Compliance Library register data hook (Organization Management module).
 *
 * Compliance Management, frontend-completion pass: previously this hook
 * loaded the FULL unfiltered/unpaginated dataset once and left search/
 * sort/pagination to run entirely client-side in `ComplianceLibraryManagement`
 * - the backend already supported `search`/`per_page`/`page`, they were just
 * never sent. Now the hook owns `filters` state and re-fetches from the
 * server whenever it changes, matching the API's actual pagination contract
 * (see `ComplianceLibraryController::index()`).
 */

import { useCallback, useEffect, useState } from 'react';

import {
  buildSessionContext,
  complianceLibraryService,
  type ComplianceApiRecord,
  type ComplianceCategoryOption,
  type ComplianceDepartmentOption,
  type ComplianceEmployeeOption,
  type ComplianceFilters,
  type ComplianceTemplateOption,
  type CompliancePayload,
} from './compliance-library-api';

function toMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export interface MutationResult {
  ok: boolean;
  message: string;
}

const DEFAULT_FILTERS: ComplianceFilters = { page: '1', per_page: '10' };

export function useComplianceLibrary() {
  const [records, setRecords] = useState<ComplianceApiRecord[]>([]);
  const [departments, setDepartments] = useState<ComplianceDepartmentOption[]>([]);
  const [employees, setEmployees] = useState<ComplianceEmployeeOption[]>([]);
  const [categories, setCategories] = useState<ComplianceCategoryOption[]>([]);
  const [templates, setTemplates] = useState<ComplianceTemplateOption[]>([]);
  const [pagination, setPagination] = useState({ current_page: 1, per_page: 10, total: 0, last_page: 1 });
  const [filters, setFilters] = useState<ComplianceFilters>(DEFAULT_FILTERS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (nextFilters: ComplianceFilters = filters) => {
    setLoading(true);
    setError(null);
    try {
      const response = await complianceLibraryService.getRecords(buildSessionContext(), nextFilters);
      setRecords(response.data ?? []);
      setDepartments(response.departments ?? []);
      setEmployees(response.employees ?? []);
      setCategories(response.categories ?? []);
      setTemplates(response.templates ?? []);
      if (response.pagination) setPagination(response.pagination);
    } catch (loadError) {
      setError(toMessage(loadError, 'Failed to load compliance records.'));
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    queueMicrotask(() => {
      void load(filters);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const applyFilters = useCallback((next: Partial<ComplianceFilters>) => {
    setFilters((current) => ({ ...current, ...next, page: next.page ?? '1' }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
  }, []);

  const setPage = useCallback((page: number) => {
    setFilters((current) => ({ ...current, page: String(page) }));
  }, []);

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

  const completeRecord = useCallback(
    (id: string | number, note?: string, completionDate?: string) =>
      run(
        () => complianceLibraryService.completeRecord(buildSessionContext(), id, note, completionDate),
        'Compliance marked as completed.',
      ),
    [run],
  );

  return {
    records,
    departments,
    employees,
    categories,
    templates,
    pagination,
    filters,
    loading,
    saving,
    error,
    retry: () => load(filters),
    applyFilters,
    clearFilters,
    setPage,
    createRecord,
    updateRecord,
    deleteRecord,
    completeRecord,
  };
}
