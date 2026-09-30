'use client';

/**
 * Supporting hooks for the Compliance Management System's non-register
 * screens (Dashboard, Calendar, My Compliance, Overdue, Categories,
 * Templates, and a single-record Detail view with its evidence). Split out
 * from `use-compliance-library.ts` (which owns the register list) to keep
 * each hook focused - same `_lib/use-*.ts` convention as the rest of this
 * module (see `use-compliance-library.ts`'s own header comment).
 */

import { useCallback, useEffect, useState } from 'react';

import {
  buildSessionContext,
  complianceLibraryService,
  type ComplianceApiRecord,
  type ComplianceCalendarEvent,
  type ComplianceCategoryRecord,
  type ComplianceDashboardResponse,
  type ComplianceDetailResponse,
  type ComplianceEvidenceRecord,
  type ComplianceFilters,
  type ComplianceMyResponse,
  type ComplianceTemplateRecord,
} from './compliance-library-api';

function toMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export interface MutationResult {
  ok: boolean;
  message: string;
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export function useComplianceDashboard() {
  const [data, setData] = useState<ComplianceDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await complianceLibraryService.getDashboard(buildSessionContext());
      setData(response.data);
    } catch (loadError) {
      setError(toMessage(loadError, 'Failed to load the compliance dashboard.'));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  return { data, loading, error, retry: load };
}

// ---------------------------------------------------------------------------
// Calendar
// ---------------------------------------------------------------------------

export function useComplianceCalendar(year: number, month: number) {
  const [events, setEvents] = useState<ComplianceCalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await complianceLibraryService.getCalendar(buildSessionContext(), year, month);
      setEvents(response.data ?? []);
    } catch (loadError) {
      setError(toMessage(loadError, 'Failed to load the compliance calendar.'));
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  return { events, loading, error, retry: load };
}

// ---------------------------------------------------------------------------
// My Compliance
// ---------------------------------------------------------------------------

export function useMyCompliance(filters?: ComplianceFilters) {
  const [data, setData] = useState<ComplianceMyResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await complianceLibraryService.getMy(buildSessionContext(), filters);
      setData(response.data);
    } catch (loadError) {
      setError(toMessage(loadError, 'Failed to load your compliance items.'));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  return { records: data?.records ?? [], summary: data?.summary, loading, error, retry: load };
}

// ---------------------------------------------------------------------------
// Overdue
// ---------------------------------------------------------------------------

export function useOverdueCompliance(filters?: ComplianceFilters) {
  const [records, setRecords] = useState<ComplianceApiRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await complianceLibraryService.getOverdue(buildSessionContext(), filters);
      setRecords(response.data ?? []);
    } catch (loadError) {
      setError(toMessage(loadError, 'Failed to load overdue compliance.'));
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  return { records, loading, error, retry: load };
}

// ---------------------------------------------------------------------------
// Detail (single record + evidence + activity + cycle history)
// ---------------------------------------------------------------------------

export function useComplianceDetail(id: string | number | null) {
  const [data, setData] = useState<ComplianceDetailResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (id === null) {
      setData(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await complianceLibraryService.getDetail(buildSessionContext(), id);
      setData(response.data);
    } catch (loadError) {
      setError(toMessage(loadError, 'Failed to load compliance details.'));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  const uploadEvidence = useCallback(
    async (file: File, meta?: { document_type?: string; description?: string; expiry_date?: string }): Promise<MutationResult> => {
      if (id === null) return { ok: false, message: 'No compliance record selected.' };
      try {
        const response = await complianceLibraryService.uploadEvidence(buildSessionContext(), id, file, meta);
        await load();
        return { ok: true, message: response.message || 'Evidence uploaded.' };
      } catch (uploadError) {
        return { ok: false, message: toMessage(uploadError, 'Evidence upload failed.') };
      }
    },
    [id, load],
  );

  const verifyEvidence = useCallback(
    async (evidenceId: number): Promise<MutationResult> => {
      try {
        const response = await complianceLibraryService.verifyEvidence(buildSessionContext(), evidenceId);
        await load();
        return { ok: true, message: response.message || 'Evidence verified.' };
      } catch (verifyError) {
        return { ok: false, message: toMessage(verifyError, 'Verification failed.') };
      }
    },
    [load],
  );

  const rejectEvidence = useCallback(
    async (evidenceId: number, reason: string): Promise<MutationResult> => {
      try {
        const response = await complianceLibraryService.rejectEvidence(buildSessionContext(), evidenceId, reason);
        await load();
        return { ok: true, message: response.message || 'Evidence rejected.' };
      } catch (rejectError) {
        return { ok: false, message: toMessage(rejectError, 'Rejection failed.') };
      }
    },
    [load],
  );

  const deleteEvidence = useCallback(
    async (evidenceId: number): Promise<MutationResult> => {
      try {
        const response = await complianceLibraryService.deleteEvidence(buildSessionContext(), evidenceId);
        await load();
        return { ok: true, message: response.message || 'Evidence deleted.' };
      } catch (deleteError) {
        return { ok: false, message: toMessage(deleteError, 'Delete failed.') };
      }
    },
    [load],
  );

  return {
    record: data?.record ?? null,
    evidence: data?.evidence ?? ([] as ComplianceEvidenceRecord[]),
    activity: data?.activity ?? [],
    cycles: data?.cycles ?? [],
    loading,
    error,
    retry: load,
    uploadEvidence,
    verifyEvidence,
    rejectEvidence,
    deleteEvidence,
  };
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export function useComplianceCategories() {
  const [categories, setCategories] = useState<ComplianceCategoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await complianceLibraryService.getCategories(buildSessionContext());
      setCategories(response.data ?? []);
    } catch (loadError) {
      setError(toMessage(loadError, 'Failed to load categories.'));
      setCategories([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  const run = useCallback(async (operation: () => Promise<{ message?: string }>, fallback: string): Promise<MutationResult> => {
    setSaving(true);
    try {
      const response = await operation();
      await load();
      return { ok: true, message: response?.message || fallback };
    } catch (mutationError) {
      return { ok: false, message: toMessage(mutationError, `${fallback} failed.`) };
    } finally {
      setSaving(false);
    }
  }, [load]);

  const createCategory = useCallback(
    (data: { name: string; description?: string; sort_order?: number }) =>
      run(() => complianceLibraryService.createCategory(buildSessionContext(), data), 'Category created.'),
    [run],
  );
  const updateCategory = useCallback(
    (id: number, data: Partial<{ name: string; description: string; sort_order: number; status: boolean }>) =>
      run(() => complianceLibraryService.updateCategory(buildSessionContext(), id, data), 'Category updated.'),
    [run],
  );
  const deleteCategory = useCallback(
    (id: number) => run(() => complianceLibraryService.deleteCategory(buildSessionContext(), id), 'Category deleted.'),
    [run],
  );

  return { categories, loading, saving, error, retry: load, createCategory, updateCategory, deleteCategory };
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

export function useComplianceTemplates() {
  const [templates, setTemplates] = useState<ComplianceTemplateRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await complianceLibraryService.getTemplates(buildSessionContext());
      setTemplates(response.data ?? []);
    } catch (loadError) {
      setError(toMessage(loadError, 'Failed to load templates.'));
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  const run = useCallback(async (operation: () => Promise<{ message?: string }>, fallback: string): Promise<MutationResult> => {
    setSaving(true);
    try {
      const response = await operation();
      await load();
      return { ok: true, message: response?.message || fallback };
    } catch (mutationError) {
      return { ok: false, message: toMessage(mutationError, `${fallback} failed.`) };
    } finally {
      setSaving(false);
    }
  }, [load]);

  const createTemplate = useCallback(
    (data: Record<string, unknown>) => run(() => complianceLibraryService.createTemplate(buildSessionContext(), data), 'Template created.'),
    [run],
  );
  const updateTemplate = useCallback(
    (id: number, data: Record<string, unknown>) => run(() => complianceLibraryService.updateTemplate(buildSessionContext(), id, data), 'Template updated.'),
    [run],
  );
  const duplicateTemplate = useCallback(
    (id: number) => run(() => complianceLibraryService.duplicateTemplate(buildSessionContext(), id), 'Template duplicated.'),
    [run],
  );
  const deleteTemplate = useCallback(
    (id: number) => run(() => complianceLibraryService.deleteTemplate(buildSessionContext(), id), 'Template deleted.'),
    [run],
  );

  return { templates, loading, saving, error, retry: load, createTemplate, updateTemplate, duplicateTemplate, deleteTemplate };
}
