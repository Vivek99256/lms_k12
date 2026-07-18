'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Loader2,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import {
  appendCommonParams,
  buildSessionContext,
  createAuthHeaders,
  normalizeApiStatus,
  readString,
  type ApiEnvelope,
} from '@/lib/erp-client';

type FeeTitleApiRow = {
  id?: number | string | null;
  display_name?: string | null;
  sort_order?: number | string | null;
  cumulative_name?: string | null;
  append_name?: string | null;
  mandatory?: string | null;
  syear?: number | string | null;
  other_fee_id?: string | null;
};

type FeeTitleRecord = {
  id: string;
  displayName: string;
  sortOrder: string;
  cumulativeName: string;
  appendName: string;
  mandatory: string;
  syear: string;
  feeType: string;
  searchText: string;
};

type FeeTitleForm = {
  fees_title_id: string;
  display_name: string;
  cumulative_name: string;
  append_name: string;
  sort_order: string;
  mandatory: boolean;
};

type FormErrors = Partial<Record<keyof FeeTitleForm, string>>;

const initialForm: FeeTitleForm = {
  fees_title_id: '',
  display_name: '',
  cumulative_name: '',
  append_name: '',
  sort_order: '',
  mandatory: false,
};

function normalizeListPayload(payload: ApiEnvelope | null): FeeTitleApiRow[] {
  const source = payload?.data;
  if (Array.isArray(source)) {
    return source as FeeTitleApiRow[];
  }

  if (
    source &&
    typeof source === 'object' &&
    'data' in source &&
    Array.isArray(source.data)
  ) {
    return source.data as FeeTitleApiRow[];
  }

  return [];
}

function normalizeCreateOptions(payload: ApiEnvelope | null): Array<{ value: string; label: string }> {
  const source = payload?.data;
  const options =
    (source &&
      typeof source === 'object' &&
      'ddTtitle' in source &&
      source.ddTtitle &&
      typeof source.ddTtitle === 'object'
      ? (source.ddTtitle as Record<string, unknown>)
      : {}) || {};

  return Object.entries(options).map(([value, label]) => ({
    value,
    label: readString(label),
  }));
}

function mapFeeTitleRow(row: FeeTitleApiRow): FeeTitleRecord {
  const displayName = readString(row.display_name);
  const cumulativeName = readString(row.cumulative_name);
  const appendName = readString(row.append_name);
  const sortOrder = readString(row.sort_order);
  const mandatory = readString(row.mandatory) || 'No';
  const syear = readString(row.syear);
  const feeType = readString(row.other_fee_id) || '-';

  return {
    id: readString(row.id),
    displayName,
    sortOrder,
    cumulativeName,
    appendName,
    mandatory,
    syear,
    feeType,
    searchText: [
      displayName,
      cumulativeName,
      appendName,
      sortOrder,
      mandatory,
      syear,
      feeType,
    ]
      .join(' ')
      .toLowerCase(),
  };
}

function readStoredContextValue(
  storageKey: string,
  ...jsonSources: string[]
): string {
  if (typeof window === 'undefined') return '';

  const directValue = readString(localStorage.getItem(storageKey));
  if (directValue) {
    return directValue;
  }

  for (const sourceKey of jsonSources) {
    try {
      const source = JSON.parse(
        localStorage.getItem(sourceKey) || '{}'
      ) as Record<string, unknown>;
      const nestedValue = readString(source[storageKey]);
      if (nestedValue) {
        return nestedValue;
      }
    } catch {
      continue;
    }
  }

  return '';
}

export default function NewFeesTitleMasterPage() {
  const [session] = useState(buildSessionContext);
  const [records, setRecords] = useState<FeeTitleRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isDrawerVisible, setIsDrawerVisible] = useState(false);
  const [titleOptions, setTitleOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [form, setForm] = useState<FeeTitleForm>(initialForm);
  const [formErrors, setFormErrors] = useState<FormErrors>({});

  const loadRecords = useCallback(async () => {
    if (!session.baseUrl) {
      setError('Session is missing the ERP host name.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const url = new URL(`${session.baseUrl}/fees/fees_title`);
      appendCommonParams(url.searchParams, session);

      const response = await fetch(url.toString(), {
        headers: createAuthHeaders(session),
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error(`Failed to load fee titles (${response.status})`);
      }

      const payload = (await response.json()) as ApiEnvelope;
      const nextRecords = normalizeListPayload(payload).map(mapFeeTitleRow);
      setRecords(nextRecords);
    } catch (fetchError) {
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : 'Failed to load fee titles.'
      );
    } finally {
      setLoading(false);
    }
  }, [session]);

  const loadTitleOptions = useCallback(async () => {
    if (!session.baseUrl || titleOptions.length > 0) return;

    setOptionsLoading(true);
    try {
      const url = new URL(`${session.baseUrl}/fees/fees_title/create`);
      appendCommonParams(url.searchParams, session);

      const response = await fetch(url.toString(), {
        headers: createAuthHeaders(session),
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error(`Failed to load fee title options (${response.status})`);
      }

      const payload = (await response.json()) as ApiEnvelope;
      setTitleOptions(normalizeCreateOptions(payload));
    } catch (fetchError) {
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : 'Failed to load fee title options.'
      );
    } finally {
      setOptionsLoading(false);
    }
  }, [session, titleOptions.length]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadRecords();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [loadRecords]);

  useEffect(() => {
    if (isDrawerOpen) {
      const frame = window.requestAnimationFrame(() => {
        setIsDrawerVisible(true);
      });
      const timeout = window.setTimeout(() => {
        void loadTitleOptions();
      }, 0);
      document.body.style.overflow = 'hidden';
      return () => {
        window.cancelAnimationFrame(frame);
        window.clearTimeout(timeout);
      };
    }

    document.body.style.overflow = '';
    const timeout = window.setTimeout(() => setIsDrawerVisible(false), 300);
    return () => window.clearTimeout(timeout);
  }, [isDrawerOpen, loadTitleOptions]);

  const filteredRecords = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return records;
    return records.filter((record) => record.searchText.includes(query));
  }, [records, searchTerm]);

  const updateField = <K extends keyof FeeTitleForm>(
    field: K,
    value: FeeTitleForm[K]
  ) => {
    setForm((current) => ({ ...current, [field]: value }));
    setFormErrors((current) => ({ ...current, [field]: undefined }));
  };

  const closeDrawer = () => {
    if (submitting) return;
    setIsDrawerOpen(false);
    setForm(initialForm);
    setFormErrors({});
  };

  const validateForm = () => {
    const nextErrors: FormErrors = {};

    if (!form.fees_title_id) {
      nextErrors.fees_title_id = 'Fees title is required';
    }

    if (!form.display_name.trim()) {
      nextErrors.display_name = 'Display name is required';
    }

    if (form.sort_order.trim() && !/^\d+$/.test(form.sort_order.trim())) {
      nextErrors.sort_order = 'Sort order must be numeric';
    }

    setFormErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    if (!session.baseUrl) {
      setError('Session is missing the ERP host name.');
      return;
    }

    const subInstituteId =
      session.subInstituteId ||
      readStoredContextValue('sub_institute_id', 'userData', 'menuContext');
    const academicYear =
      session.syear ||
      readStoredContextValue('syear', 'userData', 'menuContext') ||
      readStoredContextValue(
        'selectedAcademicYear',
        'userData',
        'menuContext'
      );

    if (!subInstituteId || !academicYear) {
      setError('Institute ID and academic year are required.');
      return;
    }

    setSubmitting(true);
    setError('');
    setSuccessMessage('');

    try {
      const formData = new FormData();
      formData.append('type', 'API');
      formData.append('fees_title_id', form.fees_title_id);
      formData.append('display_name', form.display_name.trim());
      formData.append('cumulative_name', form.cumulative_name.trim());
      formData.append('append_name', form.append_name.trim());
      formData.append('sort_order', form.sort_order.trim());
      formData.append('mandatory', form.mandatory ? '1' : '0');
      formData.append('syear', academicYear);
      formData.append('sub_institute_id', subInstituteId);

      const response = await fetch(`${session.baseUrl}/fees/fees_title`, {
        method: 'POST',
        headers: createAuthHeaders(session),
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Failed to save fee title (${response.status})`);
      }

      const payload = (await response.json()) as ApiEnvelope;
      const apiStatus = normalizeApiStatus(payload);
      if (apiStatus && apiStatus !== '1') {
        throw new Error(payload.message || 'Failed to save fee title.');
      }

      setSuccessMessage(payload.message || 'Fee title saved successfully.');
      closeDrawer();
      await loadRecords();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Failed to save fee title.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (record: FeeTitleRecord) => {
    if (!session.baseUrl) {
      setError('Session is missing the ERP host name.');
      return;
    }

    if (!window.confirm(`Delete "${record.displayName}"?`)) {
      return;
    }

    setDeletingId(record.id);
    setError('');
    setSuccessMessage('');

    try {
      const url = new URL(
        `${session.baseUrl}/fees/fees_title/${encodeURIComponent(record.id)}`
      );
      appendCommonParams(url.searchParams, session);

      const response = await fetch(url.toString(), {
        method: 'DELETE',
        headers: createAuthHeaders(session),
      });

      if (!response.ok) {
        throw new Error(`Failed to delete fee title (${response.status})`);
      }

      const payload = (await response.json()) as ApiEnvelope;
      const apiStatus = normalizeApiStatus(payload);
      if (apiStatus && apiStatus !== '1') {
        throw new Error(payload.message || 'Failed to delete fee title.');
      }

      setSuccessMessage(payload.message || 'Fee title deleted successfully.');
      await loadRecords();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : 'Failed to delete fee title.'
      );
    } finally {
      setDeletingId('');
    }
  };

  return (
    <>
      <div className="min-h-screen bg-[#e9eef7] p-4 sm:p-5 lg:p-6">
        <div className="mx-auto max-w-7xl">
          <Card className="rounded-2xl border border-slate-200/90 bg-white py-0 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <CardHeader className="gap-4 border-b border-slate-200/80 px-4 py-4 sm:px-5">
              <div>
                <CardTitle className="text-[16px] font-semibold text-slate-950">
                  New fees title
                </CardTitle>
                <CardDescription className="text-[12px] leading-5 text-slate-600">
                  Master list of fee titles used across structures and collection
                </CardDescription>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative w-full max-w-sm">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Search fee titles"
                    className="h-9 rounded-xl border-slate-300 bg-white pl-9 text-[12px]"
                  />
                </div>

                <Button
                  className="h-9 rounded-xl bg-[#5b4fe9] px-4 text-[12px] font-semibold text-white hover:bg-[#4d42da]"
                  onClick={() => setIsDrawerOpen(true)}
                >
                  <Plus className="size-4" />
                  Add fees title
                </Button>
              </div>
            </CardHeader>

            <CardContent className="space-y-4 px-4 py-4 sm:px-5">
              {error ? (
                <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  <span>{error}</span>
                </div>
              ) : null}

              {successMessage ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] text-emerald-700">
                  {successMessage}
                </div>
              ) : null}

              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <Table>
                  <TableHeader className="bg-slate-100/90">
                    <TableRow className="border-slate-200 hover:bg-transparent">
                      <TableHead className="h-9 px-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-600">
                        Display Name
                      </TableHead>
                      <TableHead className="h-9 px-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-600">
                        Sort Order
                      </TableHead>
                      <TableHead className="h-9 px-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-600">
                        Cumulative Name
                      </TableHead>
                      <TableHead className="h-9 px-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-600">
                        Append Name
                      </TableHead>
                      <TableHead className="h-9 px-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-600">
                        Mandatory
                      </TableHead>
                      <TableHead className="h-9 px-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-600">
                        Syear
                      </TableHead>
                      <TableHead className="h-9 px-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-600">
                        Fee Type
                      </TableHead>
                      <TableHead className="h-9 w-[80px] px-3 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-600">
                        Action
                      </TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell
                          colSpan={8}
                          className="px-3 py-10 text-center text-[12px] text-slate-500"
                        >
                          <span className="inline-flex items-center gap-2">
                            <Loader2 className="size-4 animate-spin" />
                            Loading fee titles...
                          </span>
                        </TableCell>
                      </TableRow>
                    ) : filteredRecords.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={8}
                          className="px-3 py-10 text-center text-[12px] text-slate-500"
                        >
                          {searchTerm
                            ? 'No fee titles match your search.'
                            : 'No fee titles found.'}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredRecords.map((record) => (
                        <TableRow
                          key={record.id}
                          className="border-slate-200/90 hover:bg-slate-50/40"
                        >
                          <TableCell className="px-3 py-3 text-[12px] font-semibold text-slate-900">
                            {record.displayName}
                          </TableCell>
                          <TableCell className="px-3 py-3 text-[12px] text-slate-700">
                            {record.sortOrder || '-'}
                          </TableCell>
                          <TableCell className="px-3 py-3 text-[12px] text-slate-700">
                            {record.cumulativeName || '-'}
                          </TableCell>
                          <TableCell className="px-3 py-3 text-[12px] text-slate-700">
                            {record.appendName || '-'}
                          </TableCell>
                          <TableCell className="px-3 py-3 text-[12px] text-slate-700">
                            {record.mandatory || 'No'}
                          </TableCell>
                          <TableCell className="px-3 py-3 text-[12px] text-slate-700">
                            {record.syear || '-'}
                          </TableCell>
                          <TableCell className="px-3 py-3 text-[12px] text-slate-700">
                            {record.feeType || '-'}
                          </TableCell>
                          <TableCell className="px-3 py-3 text-right">
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8 rounded-lg border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                              onClick={() => void handleDelete(record)}
                              disabled={deletingId === record.id}
                              title="Delete fee title"
                            >
                              {deletingId === record.id ? (
                                <Loader2 className="size-4 animate-spin" />
                              ) : (
                                <Trash2 className="size-4" />
                              )}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {isDrawerVisible ? (
        <div className="fixed inset-0 z-[70] overflow-hidden">
          <button
            type="button"
            aria-label="Close new fees title drawer"
            className={cn(
              'absolute inset-0 bg-slate-950/45 transition-opacity duration-300 ease-out',
              isDrawerOpen ? 'opacity-100' : 'opacity-0'
            )}
            onClick={closeDrawer}
          />

          <div className="absolute inset-y-0 right-0 flex max-w-full">
            <div
              className={cn(
                'flex h-full w-full flex-col border-l border-slate-200 bg-white shadow-[0_18px_48px_rgba(15,23,42,0.18)] transition-transform duration-300 ease-out sm:w-[26rem] lg:w-[28rem]',
                isDrawerOpen ? 'translate-x-0' : 'translate-x-full'
              )}
            >
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                <h2 className="text-[15px] font-semibold text-slate-950">
                  New fees title
                </h2>

                <button
                  type="button"
                  onClick={closeDrawer}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                >
                  <span className="text-lg leading-none">&times;</span>
                </button>
              </div>

              <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-medium text-slate-700">
                    Fees title
                  </Label>
                  <Select
                    value={form.fees_title_id}
                    onValueChange={(value) =>
                      updateField('fees_title_id', value ?? '')
                    }
                  >
                    <SelectTrigger
                      className={cn(
                        'h-9 rounded-md border-slate-300 bg-white px-3 text-[12px] shadow-none',
                        formErrors.fees_title_id && 'border-red-300'
                      )}
                      variant="default"
                      size="sm"
                    >
                      <SelectValue
                        placeholder={
                          optionsLoading ? 'Loading fee titles...' : 'Select fees title'
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {titleOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {formErrors.fees_title_id ? (
                    <p className="text-[11px] text-red-600">
                      {formErrors.fees_title_id}
                    </p>
                  ) : null}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[11px] font-medium text-slate-700">
                    Display name
                  </Label>
                  <Input
                    value={form.display_name}
                    onChange={(event) =>
                      updateField('display_name', event.target.value)
                    }
                    className={cn(
                      'h-9 rounded-md border-slate-300 bg-white px-3 text-[12px]',
                      formErrors.display_name && 'border-red-300'
                    )}
                  />
                  {formErrors.display_name ? (
                    <p className="text-[11px] text-red-600">
                      {formErrors.display_name}
                    </p>
                  ) : null}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[11px] font-medium text-slate-700">
                    Cumulative name
                  </Label>
                  <Input
                    value={form.cumulative_name}
                    onChange={(event) =>
                      updateField('cumulative_name', event.target.value)
                    }
                    className="h-9 rounded-md border-slate-300 bg-white px-3 text-[12px]"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[11px] font-medium text-slate-700">
                    Append name
                  </Label>
                  <Input
                    value={form.append_name}
                    onChange={(event) =>
                      updateField('append_name', event.target.value)
                    }
                    className="h-9 rounded-md border-slate-300 bg-white px-3 text-[12px]"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[11px] font-medium text-slate-700">
                    Sort order
                  </Label>
                  <Input
                    value={form.sort_order}
                    onChange={(event) =>
                      updateField('sort_order', event.target.value)
                    }
                    inputMode="numeric"
                    className={cn(
                      'h-9 rounded-md border-slate-300 bg-white px-3 text-[12px]',
                      formErrors.sort_order && 'border-red-300'
                    )}
                  />
                  {formErrors.sort_order ? (
                    <p className="text-[11px] text-red-600">
                      {formErrors.sort_order}
                    </p>
                  ) : null}
                </div>

                <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-[12px] text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.mandatory}
                    onChange={(event) =>
                      updateField('mandatory', event.target.checked)
                    }
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  Mandatory
                </label>
              </div>

              <div className="flex items-center gap-2 border-t border-slate-200 px-5 py-4">
                <Button
                  className="h-9 rounded-xl bg-[#5b4fe9] px-4 text-[12px] font-semibold text-white hover:bg-[#4d42da]"
                  onClick={() => void handleSubmit()}
                  disabled={submitting || optionsLoading}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save fees title'
                  )}
                </Button>
                <Button
                  variant="outline"
                  className="h-9 rounded-xl border-slate-300 px-4 text-[12px] font-medium text-slate-700"
                  onClick={closeDrawer}
                  disabled={submitting}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
