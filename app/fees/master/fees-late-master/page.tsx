'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Loader2,
  Pencil,
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
  type SessionContext,
} from '@/lib/erp-client';

/**
 * Fees Late Master - port of the Laravel screens (tblfeesLateController plus
 * show/add/edit_fees_late.blade.php), which the Next.js app never had. The menu
 * row pointed at the bare Laravel route name `fees_late_master.index`, so the
 * item 404ed rather than being merely broken.
 *
 * The legacy controller's shape is preserved deliberately:
 *  - Add posts `standard_id[]` and writes ONE row per standard, skipping any
 *    (standard, syear, month) that already exists.
 *  - Edit can only change late_date / fine_type / status; the controller simply
 *    ignores standard and month on update, so both are shown read-only here
 *    rather than offering edits that would be silently dropped.
 */

type LateFeeRow = {
  id?: unknown;
  standard_id?: unknown;
  standard?: unknown;
  late_date?: unknown;
  month_id?: unknown;
  fine_type?: unknown;
  status?: unknown;
  user?: unknown;
  created_on?: unknown;
};

type LateFeeRecord = {
  id: string;
  standardId: string;
  standard: string;
  lateDate: string;
  monthId: string;
  fineType: string;
  status: string;
  createdBy: string;
  createdOn: string;
  searchText: string;
};

type LateFeeForm = {
  standard_ids: string[];
  late_date: string;
  fees_month: string;
  fine_type: string;
  status: boolean;
};

type FormErrors = Partial<Record<keyof LateFeeForm, string>>;

const initialForm: LateFeeForm = {
  standard_ids: [],
  late_date: '',
  fees_month: '',
  fine_type: '',
  status: true,
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

/**
 * The legacy endpoints are inconsistent about nesting: `index` wraps rows in
 * `data`, while `create`/`edit` return their option lists at the top level.
 */
function pickList(payload: ApiEnvelope | null, key: string): unknown[] {
  const root = asRecord(payload);
  if (Array.isArray(root[key])) return root[key] as unknown[];
  const nested = asRecord(root.data);
  if (Array.isArray(nested[key])) return nested[key] as unknown[];
  return [];
}

function pickMap(payload: ApiEnvelope | null, key: string): Record<string, unknown> {
  const root = asRecord(payload);
  if (root[key] && typeof root[key] === 'object') {
    return root[key] as Record<string, unknown>;
  }
  const nested = asRecord(root.data);
  if (nested[key] && typeof nested[key] === 'object') {
    return nested[key] as Record<string, unknown>;
  }
  return {};
}

/** `d-m-Y` to match the blade listing, without dragging in a date library. */
function formatDate(value: string): string {
  if (!value) return '-';
  const parsed = new Date(value.includes('T') ? value : `${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(parsed.getDate())}-${pad(parsed.getMonth() + 1)}-${parsed.getFullYear()}`;
}

/** `<input type="date">` needs Y-m-d; the API may hand back a datetime. */
function toDateInputValue(value: string): string {
  if (!value) return '';
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}`;
}

function mapRow(row: LateFeeRow): LateFeeRecord {
  const standard = readString(row.standard);
  const fineType = readString(row.fine_type);
  const createdBy = readString(row.user);
  const lateDate = readString(row.late_date);

  return {
    id: readString(row.id),
    standardId: readString(row.standard_id),
    standard,
    lateDate,
    monthId: readString(row.month_id),
    fineType,
    status: readString(row.status),
    createdBy,
    createdOn: readString(row.created_on),
    searchText: [standard, fineType, createdBy, formatDate(lateDate)]
      .join(' ')
      .toLowerCase(),
  };
}

/** Every legacy call needs the tenant triple; `create`/`store` also want user_id. */
function appendIdentity(target: URLSearchParams | FormData, session: SessionContext) {
  const set = (key: string, value: string) => {
    if (target instanceof FormData) target.append(key, value);
    else target.set(key, value);
  };
  set('type', 'API');
  if (session.subInstituteId) set('sub_institute_id', session.subInstituteId);
  if (session.syear) set('syear', session.syear);
  if (session.userId) set('user_id', session.userId);
}

export default function FeesLateMasterPage() {
  const [session] = useState(buildSessionContext);
  const [records, setRecords] = useState<LateFeeRecord[]>([]);
  const [standards, setStandards] = useState<Array<{ id: string; name: string }>>([]);
  const [monthOptions, setMonthOptions] = useState<Array<{ id: string; label: string }>>([]);
  const [fineTypes, setFineTypes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isDrawerVisible, setIsDrawerVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState<LateFeeRecord | null>(null);
  const [form, setForm] = useState<LateFeeForm>(initialForm);
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
      const url = new URL(`${session.baseUrl}/fees/fees_late_master`);
      appendCommonParams(url.searchParams, session);

      const response = await fetch(url.toString(), {
        headers: createAuthHeaders(session),
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error(`Failed to load late fees (${response.status})`);
      }

      const payload = (await response.json()) as ApiEnvelope;
      const rows = Array.isArray(payload.data) ? (payload.data as LateFeeRow[]) : [];
      setRecords(rows.map(mapRow));
    } catch (fetchError) {
      setError(
        fetchError instanceof Error ? fetchError.message : 'Failed to load late fees.'
      );
    } finally {
      setLoading(false);
    }
  }, [session]);

  /**
   * Loaded on mount rather than on drawer-open: the listing needs `fees_month`
   * to show a month NAME instead of the raw `month_id` it stores.
   */
  const loadOptions = useCallback(async () => {
    if (!session.baseUrl) return;

    setOptionsLoading(true);
    try {
      const url = new URL(`${session.baseUrl}/fees/fees_late_master/create`);
      appendIdentity(url.searchParams, session);

      const response = await fetch(url.toString(), {
        headers: createAuthHeaders(session),
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error(`Failed to load late fee options (${response.status})`);
      }

      const payload = (await response.json()) as ApiEnvelope;

      setStandards(
        pickList(payload, 'standard_list').map((entry) => {
          const row = asRecord(entry);
          return { id: readString(row.id), name: readString(row.name) };
        })
      );

      setMonthOptions(
        Object.entries(pickMap(payload, 'fees_month')).map(([id, label]) => ({
          id,
          label: readString(label),
        }))
      );

      setFineTypes(
        pickList(payload, 'fine_types')
          .map((entry) => readString(entry))
          .filter(Boolean)
      );
    } catch (fetchError) {
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : 'Failed to load late fee options.'
      );
    } finally {
      setOptionsLoading(false);
    }
  }, [session]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadRecords();
      void loadOptions();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [loadRecords, loadOptions]);

  useEffect(() => {
    if (isDrawerOpen) {
      const frame = window.requestAnimationFrame(() => setIsDrawerVisible(true));
      document.body.style.overflow = 'hidden';
      return () => window.cancelAnimationFrame(frame);
    }

    document.body.style.overflow = '';
    const timeout = window.setTimeout(() => setIsDrawerVisible(false), 300);
    return () => window.clearTimeout(timeout);
  }, [isDrawerOpen]);

  const monthLabels = useMemo(() => {
    const lookup = new Map<string, string>();
    monthOptions.forEach((month) => lookup.set(month.id, month.label));
    return lookup;
  }, [monthOptions]);

  const filteredRecords = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return records;
    return records.filter((record) => record.searchText.includes(query));
  }, [records, searchTerm]);

  const updateField = <K extends keyof LateFeeForm>(key: K, value: LateFeeForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setFormErrors((current) => ({ ...current, [key]: undefined }));
  };

  const openCreate = () => {
    setEditingRecord(null);
    setForm(initialForm);
    setFormErrors({});
    setIsDrawerOpen(true);
  };

  const openEdit = (record: LateFeeRecord) => {
    setEditingRecord(record);
    setForm({
      standard_ids: record.standardId ? [record.standardId] : [],
      late_date: toDateInputValue(record.lateDate),
      fees_month: record.monthId,
      fine_type: record.fineType,
      status: record.status === '1',
    });
    setFormErrors({});
    setIsDrawerOpen(true);
  };

  const closeDrawer = () => {
    setIsDrawerOpen(false);
    setEditingRecord(null);
    setFormErrors({});
  };

  const validate = (): boolean => {
    const nextErrors: FormErrors = {};

    // Standard and month are fixed once created - the controller ignores both
    // on update - so they are only required when adding.
    if (!editingRecord) {
      if (form.standard_ids.length === 0) {
        nextErrors.standard_ids = 'Select at least one standard';
      }
      if (!form.fees_month) {
        nextErrors.fees_month = 'Fees month is required';
      }
    }
    if (!form.late_date) {
      nextErrors.late_date = 'Late fees start date is required';
    }
    if (!form.fine_type) {
      nextErrors.fine_type = 'Fine counting type is required';
    }

    setFormErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!session.baseUrl || !validate()) return;

    setSubmitting(true);
    setError('');
    setSuccessMessage('');

    try {
      const formData = new FormData();
      appendIdentity(formData, session);
      formData.append('late_date', form.late_date);
      formData.append('fine_type', form.fine_type);
      // Always sent: the API validator marks `status` required, so an unchecked
      // box has to travel as '0' rather than being omitted like the blade form.
      formData.append('status', form.status ? '1' : '0');

      if (editingRecord) {
        formData.append('_method', 'PUT');
      } else {
        form.standard_ids.forEach((id) => formData.append('standard_id[]', id));
        formData.append('fees_month', form.fees_month);
      }

      const url = editingRecord
        ? `${session.baseUrl}/fees/fees_late_master/${encodeURIComponent(editingRecord.id)}`
        : `${session.baseUrl}/fees/fees_late_master`;

      const response = await fetch(url, {
        method: 'POST',
        headers: createAuthHeaders(session),
        body: formData,
      });

      if (!response.ok) {
        throw new Error(
          `Failed to ${editingRecord ? 'update' : 'save'} late fee (${response.status})`
        );
      }

      const payload = (await response.json()) as ApiEnvelope;
      const apiStatus = normalizeApiStatus(payload);
      if (apiStatus && apiStatus !== '1') {
        throw new Error(payload.message || 'Failed to save late fee.');
      }

      setSuccessMessage(
        payload.message ||
          `Late fee ${editingRecord ? 'updated' : 'saved'} successfully.`
      );
      closeDrawer();
      setForm(initialForm);
      await loadRecords();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : 'Failed to save late fee.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (record: LateFeeRecord) => {
    if (!session.baseUrl) return;
    if (
      !window.confirm(
        `Delete the late fee rule for ${record.standard || 'this standard'}?`
      )
    ) {
      return;
    }

    setDeletingId(record.id);
    setError('');
    setSuccessMessage('');

    try {
      const formData = new FormData();
      appendIdentity(formData, session);
      formData.append('_method', 'DELETE');

      const response = await fetch(
        `${session.baseUrl}/fees/fees_late_master/${encodeURIComponent(record.id)}`,
        {
          method: 'POST',
          headers: createAuthHeaders(session),
          body: formData,
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to delete late fee (${response.status})`);
      }

      const payload = (await response.json()) as ApiEnvelope;
      const apiStatus = normalizeApiStatus(payload);
      if (apiStatus && apiStatus !== '1') {
        throw new Error(payload.message || 'Failed to delete late fee.');
      }

      setSuccessMessage(payload.message || 'Late fee deleted successfully.');
      await loadRecords();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error ? deleteError.message : 'Failed to delete late fee.'
      );
    } finally {
      setDeletingId('');
    }
  };

  const selectedStandardNames = standards
    .filter((standard) => form.standard_ids.includes(standard.id))
    .map((standard) => standard.name)
    .join(', ');

  return (
    <>
      <div className="min-h-screen p-4 sm:p-5 lg:p-6">
        <div className="mx-auto">
          <Card className="rounded-2xl border border-slate-200/90 bg-white py-0 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <CardHeader className="gap-4 border-b border-slate-200/80 px-4 py-4 sm:px-5">
              <div>
                <CardTitle className="text-[16px] font-semibold text-slate-950">
                  Fees Late Master
                </CardTitle>
                <CardDescription className="text-[12px] leading-5 text-slate-600">
                  Late fee start dates and fine rules by standard and fees month
                </CardDescription>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative w-full max-w-sm">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Search late fees"
                    className="h-9 rounded-xl border-slate-300 bg-white pl-9 text-[12px]"
                  />
                </div>

                <Button
                  className="h-9 rounded-xl bg-[#5b4fe9] px-4 text-[12px] font-semibold text-white hover:bg-[#4d42da]"
                  onClick={openCreate}
                >
                  <Plus className="size-4" />
                  Add new fees late
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
                      <TableHead className="h-9 w-[64px] px-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-600">
                        Sr No.
                      </TableHead>
                      <TableHead className="h-9 px-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-600">
                        Standard
                      </TableHead>
                      <TableHead className="h-9 px-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-600">
                        Late Fees Date
                      </TableHead>
                      <TableHead className="h-9 px-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-600">
                        Month
                      </TableHead>
                      <TableHead className="h-9 px-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-600">
                        Fine Type
                      </TableHead>
                      <TableHead className="h-9 px-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-600">
                        Status
                      </TableHead>
                      <TableHead className="h-9 px-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-600">
                        Created By
                      </TableHead>
                      <TableHead className="h-9 px-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-600">
                        Created On
                      </TableHead>
                      <TableHead className="h-9 w-[110px] px-3 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-600">
                        Action
                      </TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell
                          colSpan={9}
                          className="px-3 py-10 text-center text-[12px] text-slate-500"
                        >
                          <span className="inline-flex items-center gap-2">
                            <Loader2 className="size-4 animate-spin" />
                            Loading late fees...
                          </span>
                        </TableCell>
                      </TableRow>
                    ) : filteredRecords.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={9}
                          className="px-3 py-10 text-center text-[12px] text-slate-500"
                        >
                          {searchTerm
                            ? 'No late fees match your search.'
                            : 'No late fees found.'}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredRecords.map((record, index) => (
                        <TableRow
                          key={record.id || index}
                          className="border-slate-200/90 hover:bg-slate-50/40"
                        >
                          <TableCell className="px-3 py-3 text-[12px] text-slate-700">
                            {index + 1}
                          </TableCell>
                          <TableCell className="px-3 py-3 text-[12px] font-semibold text-slate-900">
                            {record.standard || '-'}
                          </TableCell>
                          <TableCell className="px-3 py-3 text-[12px] text-slate-700">
                            {formatDate(record.lateDate)}
                          </TableCell>
                          <TableCell className="px-3 py-3 text-[12px] text-slate-700">
                            {monthLabels.get(record.monthId) || record.monthId || '-'}
                          </TableCell>
                          <TableCell className="px-3 py-3 text-[12px] text-slate-700">
                            {record.fineType || '-'}
                          </TableCell>
                          <TableCell className="px-3 py-3 text-[12px] text-slate-700">
                            {record.status === '1' ? 'Yes' : 'No'}
                          </TableCell>
                          <TableCell className="px-3 py-3 text-[12px] text-slate-700">
                            {record.createdBy || '-'}
                          </TableCell>
                          <TableCell className="px-3 py-3 text-[12px] text-slate-700">
                            {formatDate(record.createdOn)}
                          </TableCell>
                          <TableCell className="px-3 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8 rounded-lg border-slate-300 text-slate-600 hover:bg-slate-50"
                                onClick={() => openEdit(record)}
                                title="Edit late fee"
                              >
                                <Pencil className="size-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8 rounded-lg border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                                onClick={() => void handleDelete(record)}
                                disabled={deletingId === record.id}
                                title="Delete late fee"
                              >
                                {deletingId === record.id ? (
                                  <Loader2 className="size-4 animate-spin" />
                                ) : (
                                  <Trash2 className="size-4" />
                                )}
                              </Button>
                            </div>
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
            aria-label="Close late fees drawer"
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
                  {editingRecord ? 'Edit fees late' : 'New fees late'}
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
                    Standard
                  </Label>

                  {editingRecord ? (
                    <Input
                      value={selectedStandardNames || editingRecord.standard}
                      readOnly
                      disabled
                      className="h-9 rounded-md border-slate-300 bg-slate-50 px-3 text-[12px] text-slate-600"
                    />
                  ) : (
                    <div
                      className={cn(
                        'max-h-[160px] overflow-y-auto rounded-md border border-slate-300 bg-white px-3 py-2',
                        formErrors.standard_ids && 'border-red-300'
                      )}
                    >
                      {optionsLoading ? (
                        <span className="inline-flex items-center gap-2 text-[12px] text-slate-500">
                          <Loader2 className="size-4 animate-spin" />
                          Loading standards...
                        </span>
                      ) : standards.length === 0 ? (
                        <span className="text-[12px] text-slate-500">
                          No standards found.
                        </span>
                      ) : (
                        <div className="grid gap-2">
                          {standards.map((standard) => (
                            <label
                              key={standard.id}
                              className="flex items-center gap-2 text-[12px] text-slate-700"
                            >
                              <input
                                type="checkbox"
                                className="h-4 w-4 rounded border-slate-300"
                                checked={form.standard_ids.includes(standard.id)}
                                onChange={(event) =>
                                  updateField(
                                    'standard_ids',
                                    event.target.checked
                                      ? [...form.standard_ids, standard.id]
                                      : form.standard_ids.filter(
                                          (id) => id !== standard.id
                                        )
                                  )
                                }
                              />
                              {standard.name}
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {formErrors.standard_ids ? (
                    <p className="text-[11px] text-red-600">{formErrors.standard_ids}</p>
                  ) : null}
                  {editingRecord ? (
                    <p className="text-[11px] text-slate-500">
                      Standard cannot be changed after the rule is created.
                    </p>
                  ) : null}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[11px] font-medium text-slate-700">
                    Late fees start date
                  </Label>
                  <Input
                    type="date"
                    value={form.late_date}
                    onChange={(event) => updateField('late_date', event.target.value)}
                    className={cn(
                      'h-9 rounded-md border-slate-300 bg-white px-3 text-[12px]',
                      formErrors.late_date && 'border-red-300'
                    )}
                  />
                  {formErrors.late_date ? (
                    <p className="text-[11px] text-red-600">{formErrors.late_date}</p>
                  ) : null}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[11px] font-medium text-slate-700">
                    Fees month
                  </Label>
                  <select
                    value={form.fees_month}
                    disabled={Boolean(editingRecord)}
                    onChange={(event) => updateField('fees_month', event.target.value)}
                    className={cn(
                      'h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-[12px] outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100',
                      editingRecord && 'bg-slate-50 text-slate-600',
                      formErrors.fees_month && 'border-red-300'
                    )}
                  >
                    <option value="">
                      {optionsLoading ? 'Loading months...' : 'Select fees month'}
                    </option>
                    {monthOptions.map((month) => (
                      <option key={month.id} value={month.id}>
                        {month.label}
                      </option>
                    ))}
                  </select>
                  {formErrors.fees_month ? (
                    <p className="text-[11px] text-red-600">{formErrors.fees_month}</p>
                  ) : null}
                  {editingRecord ? (
                    <p className="text-[11px] text-slate-500">
                      Fees month cannot be changed after the rule is created.
                    </p>
                  ) : null}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[11px] font-medium text-slate-700">
                    Fine counting type
                  </Label>
                  <select
                    value={form.fine_type}
                    onChange={(event) => updateField('fine_type', event.target.value)}
                    className={cn(
                      'h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-[12px] outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100',
                      formErrors.fine_type && 'border-red-300'
                    )}
                  >
                    <option value="">Select type</option>
                    {fineTypes.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                  {formErrors.fine_type ? (
                    <p className="text-[11px] text-red-600">{formErrors.fine_type}</p>
                  ) : null}
                </div>

                <label className="flex items-center gap-2 text-[12px] text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.status}
                    onChange={(event) => updateField('status', event.target.checked)}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  Status
                </label>
              </div>

              <div className="flex items-center gap-2 border-t border-slate-200 px-5 py-4">
                <Button
                  className="h-9 rounded-xl bg-[#5b4fe9] px-4 text-[12px] font-semibold text-white hover:bg-[#4d42da]"
                  onClick={() => void handleSubmit()}
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Saving...
                    </>
                  ) : editingRecord ? (
                    'Update fees late'
                  ) : (
                    'Save fees late'
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
