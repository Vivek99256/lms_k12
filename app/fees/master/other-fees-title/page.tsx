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
  RadioGroup,
  RadioGroupItem,
} from '@/components/ui/radio-group';
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
  buildSessionContext,
  createAuthHeaders,
  normalizeApiStatus,
  normalizeAcademicYear,
  readString,
  type ApiEnvelope,
} from '@/lib/erp-client';

type OtherFeeApiRow = {
  id?: number | string | null;
  display_name?: string | null;
  amount?: string | number | null;
  status?: string | number | null;
  include_imprest?: string | null;
  sort_order?: string | number | null;
  syear?: string | number | null;
};

type OtherFeeRecord = {
  id: string;
  displayName: string;
  amount: string;
  status: string;
  includeImprest: string;
  sortOrder: string;
  syear: string;
  searchText: string;
};

type OtherFeeForm = {
  display_name: string;
  amount: string;
  sort_order: string;
  include_imprest: 'Y' | 'N';
  status: '1' | '0';
};

type FormErrors = Partial<Record<keyof OtherFeeForm, string>>;

const initialForm: OtherFeeForm = {
  display_name: '',
  amount: '',
  sort_order: '',
  include_imprest: 'N',
  status: '1',
};

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

function normalizeStatus(value: unknown): string {
  const raw = readString(value).trim().toLowerCase();
  if (!raw) return '-';
  if (raw === '1' || raw === 'active') return 'Active';
  if (raw === '0' || raw === 'inactive') return 'Inactive';
  return readString(value);
}

function normalizeImprest(value: unknown): string {
  const raw = readString(value).trim().toLowerCase();
  if (!raw) return 'No';
  if (raw === 'y' || raw === 'yes' || raw === '1') return 'Yes';
  if (raw === 'n' || raw === 'no' || raw === '0') return 'No';
  return readString(value);
}

function mapRecord(row: OtherFeeApiRow): OtherFeeRecord {
  const displayName = readString(row.display_name ?? (row as Record<string, unknown>).title);
  const amount = readString(row.amount);
  const status = normalizeStatus(row.status);
  const includeImprest = normalizeImprest(row.include_imprest);
  const sortOrder = readString(row.sort_order);
  const syear = readString(row.syear);

  return {
    id: readString(row.id),
    displayName,
    amount,
    status,
    includeImprest,
    sortOrder,
    syear,
    searchText: [
      displayName,
      amount,
      status,
      includeImprest,
      sortOrder,
      syear,
    ]
      .join(' ')
      .toLowerCase(),
  };
}

function normalizeList(payload: ApiEnvelope | null): OtherFeeApiRow[] {
  const source = payload?.data;

  if (Array.isArray(source)) {
    return source as OtherFeeApiRow[];
  }

  if (
    source &&
    typeof source === 'object' &&
    'data' in source &&
    Array.isArray(source.data)
  ) {
    return source.data as OtherFeeApiRow[];
  }

  if (payload && 'records' in payload && Array.isArray(payload.records)) {
    return payload.records as OtherFeeApiRow[];
  }

  return [];
}

export default function OtherFeesTitlePage() {
  const [session] = useState(buildSessionContext);
  const [records, setRecords] = useState<OtherFeeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState('');
  const [editingRecord, setEditingRecord] = useState<OtherFeeRecord | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [form, setForm] = useState<OtherFeeForm>(initialForm);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isDrawerVisible, setIsDrawerVisible] = useState(false);

  const resolvedSubInstituteId =
    session.subInstituteId ||
    readStoredContextValue('sub_institute_id', 'userData', 'menuContext');
  const resolvedAcademicYear = normalizeAcademicYear(
    session.syear ||
      readStoredContextValue('syear', 'userData', 'menuContext') ||
      readStoredContextValue('selectedAcademicYear', 'userData', 'menuContext')
  );
  const resolvedUserId =
    session.userId ||
    readStoredContextValue('user_id', 'userData', 'menuContext') ||
    readStoredContextValue('userId', 'userData', 'menuContext');

  const appendResolvedCommonParams = useCallback(
    (searchParams: URLSearchParams) => {
      searchParams.set('type', 'API');
      if (resolvedSubInstituteId) {
        searchParams.set('sub_institute_id', resolvedSubInstituteId);
      }
      if (resolvedAcademicYear) {
        searchParams.set('syear', resolvedAcademicYear);
      }
      if (resolvedUserId) {
        searchParams.set('user_id', resolvedUserId);
      }
    },
    [resolvedAcademicYear, resolvedSubInstituteId, resolvedUserId]
  );

  const loadRecords = useCallback(async () => {
    if (!session.baseUrl) {
      setError('Session is missing the ERP host name.');
      setLoading(false);
      return;
    }

    if (!resolvedSubInstituteId || !resolvedAcademicYear) {
      setError('Institute and academic year are required.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const url = new URL(`${session.baseUrl}/fees/other_fees_title`);
      appendResolvedCommonParams(url.searchParams);

      const response = await fetch(url.toString(), {
        headers: createAuthHeaders(session),
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error(`Failed to load other fee titles (${response.status})`);
      }

      const payload = (await response.json()) as ApiEnvelope;
      const normalizedRecords = normalizeList(payload);
      console.log('Other Fees Title API response:', payload);
      console.log('Other Fees Title records:', normalizedRecords);
      setRecords(normalizedRecords.map(mapRecord));
    } catch (fetchError) {
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : 'Failed to load other fee titles.'
      );
    } finally {
      setLoading(false);
    }
  }, [
    appendResolvedCommonParams,
    resolvedAcademicYear,
    resolvedSubInstituteId,
    session,
  ]);

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
      document.body.style.overflow = 'hidden';
      return () => window.cancelAnimationFrame(frame);
    }

    document.body.style.overflow = '';
    const timeout = window.setTimeout(() => setIsDrawerVisible(false), 300);
    return () => window.clearTimeout(timeout);
  }, [isDrawerOpen]);

  const filteredRecords = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return records;
    return records.filter((record) => record.searchText.includes(query));
  }, [records, searchTerm]);

  const updateField = <K extends keyof OtherFeeForm>(
    field: K,
    value: OtherFeeForm[K]
  ) => {
    setForm((current) => ({ ...current, [field]: value }));
    setFormErrors((current) => ({ ...current, [field]: undefined }));
  };

  const openCreateDrawer = () => {
    setEditingRecord(null);
    setForm(initialForm);
    setFormErrors({});
    setIsDrawerOpen(true);
  };

  const openEditDrawer = (record: OtherFeeRecord) => {
    setEditingRecord(record);
    setForm({
      display_name: record.displayName,
      amount: record.amount,
      sort_order: record.sortOrder,
      include_imprest: record.includeImprest === 'Yes' ? 'Y' : 'N',
      status: record.status === 'Active' ? '1' : '0',
    });
    setFormErrors({});
    setIsDrawerOpen(true);
  };

  const closeDrawer = () => {
    if (submitting) return;
    setIsDrawerOpen(false);
  };

  const validateForm = () => {
    const nextErrors: FormErrors = {};

    if (!form.display_name.trim()) {
      nextErrors.display_name = 'Display title is required';
    }

    if (!form.amount.trim()) {
      nextErrors.amount = 'Amount is required';
    }

    if (!form.sort_order.trim()) {
      nextErrors.sort_order = 'Sort order is required';
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
    if (!resolvedSubInstituteId || !resolvedAcademicYear) {
      setError('Institute and academic year are required.');
      return;
    }

    setSubmitting(true);
    setError('');
    setSuccessMessage('');

    try {
      const requestPayload = new URLSearchParams();
      requestPayload.set('type', 'API');
      requestPayload.set('display_name', form.display_name.trim());
      requestPayload.set('amount', form.amount.trim());
      requestPayload.set('sort_order', form.sort_order.trim());
      requestPayload.set('include_imprest', form.include_imprest);
      requestPayload.set('status', form.status);
      requestPayload.set('sub_institute_id', resolvedSubInstituteId);
      requestPayload.set('syear', resolvedAcademicYear);
      if (resolvedUserId) {
        requestPayload.set('created_by', resolvedUserId);
        requestPayload.set('user_id', resolvedUserId);
      }
      console.log(
        'Other Fees Title submit payload:',
        Object.fromEntries(requestPayload.entries())
      );

      const url = editingRecord
        ? new URL(
            `${session.baseUrl}/fees/other_fees_title/${encodeURIComponent(
              editingRecord.id
            )}`
          )
        : new URL(`${session.baseUrl}/fees/other_fees_title`);

      appendResolvedCommonParams(url.searchParams);

      const response = await fetch(url.toString(), {
        method: editingRecord ? 'PUT' : 'POST',
        headers: createAuthHeaders(session, 'application/x-www-form-urlencoded'),
        body: requestPayload.toString(),
      });

      if (!response.ok) {
        throw new Error(
          `Failed to ${editingRecord ? 'update' : 'save'} other fee title (${response.status})`
        );
      }

      const payload = (await response.json()) as ApiEnvelope;
      const apiStatus = normalizeApiStatus(payload);
      if (apiStatus && apiStatus !== '1') {
        throw new Error(
          payload.message ||
            `Failed to ${editingRecord ? 'update' : 'save'} other fee title.`
        );
      }

      setSuccessMessage(
        payload.message ||
          `Other fee title ${editingRecord ? 'updated' : 'saved'} successfully.`
      );
      setIsDrawerOpen(false);
      await loadRecords();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Failed to save other fee title.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (record: OtherFeeRecord) => {
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
        `${session.baseUrl}/fees/other_fees_title/${encodeURIComponent(record.id)}`
      );
      appendResolvedCommonParams(url.searchParams);

      const response = await fetch(url.toString(), {
        method: 'DELETE',
        headers: createAuthHeaders(session),
      });

      if (!response.ok) {
        throw new Error(
          `Failed to delete other fee title (${response.status})`
        );
      }

      const payload = (await response.json()) as ApiEnvelope;
      const apiStatus = normalizeApiStatus(payload);
      if (apiStatus && apiStatus !== '1') {
        throw new Error(payload.message || 'Failed to delete other fee title.');
      }

      setSuccessMessage(
        payload.message || 'Other fee title deleted successfully.'
      );
      await loadRecords();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : 'Failed to delete other fee title.'
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
                  Other fees title
                </CardTitle>
                <CardDescription className="text-[12px] leading-5 text-slate-600">
                  On-demand and miscellaneous charges outside the regular structure
                </CardDescription>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative w-full max-w-sm">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Search other fee titles"
                    className="h-9 rounded-xl border-slate-300 bg-white pl-9 text-[12px]"
                  />
                </div>

                <Button
                  className="h-9 rounded-xl bg-[#5b4fe9] px-4 text-[12px] font-semibold text-white hover:bg-[#4d42da]"
                  onClick={openCreateDrawer}
                >
                  <Plus className="size-4" />
                  Add other fees title
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
                        Display Title
                      </TableHead>
                      <TableHead className="h-9 px-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-600">
                        Amount
                      </TableHead>
                      <TableHead className="h-9 px-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-600">
                        Status
                      </TableHead>
                      <TableHead className="h-9 px-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-600">
                        Include Imprest
                      </TableHead>
                      <TableHead className="h-9 px-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-600">
                        Sort Order
                      </TableHead>
                      <TableHead className="h-9 px-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-600">
                        Syear
                      </TableHead>
                      <TableHead className="h-9 px-3 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-600">
                        Actions
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell
                          colSpan={7}
                          className="px-3 py-10 text-center text-[12px] text-slate-500"
                        >
                          <span className="inline-flex items-center gap-2">
                            <Loader2 className="size-4 animate-spin" />
                            Loading other fee titles...
                          </span>
                        </TableCell>
                      </TableRow>
                    ) : filteredRecords.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={7}
                          className="px-3 py-10 text-center text-[12px] text-slate-500"
                        >
                          {searchTerm
                            ? 'No other fee titles match your search.'
                            : 'No other fee titles found.'}
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
                            {record.amount}
                          </TableCell>
                          <TableCell className="px-3 py-3 text-[12px] text-slate-700">
                            {record.status}
                          </TableCell>
                          <TableCell className="px-3 py-3 text-[12px] text-slate-700">
                            {record.includeImprest}
                          </TableCell>
                          <TableCell className="px-3 py-3 text-[12px] text-slate-700">
                            {record.sortOrder}
                          </TableCell>
                          <TableCell className="px-3 py-3 text-[12px] text-slate-700">
                            {record.syear}
                          </TableCell>
                          <TableCell className="px-3 py-3">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8 rounded-lg"
                                onClick={() => openEditDrawer(record)}
                                title="Edit other fee title"
                              >
                                <Pencil className="size-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8 rounded-lg border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                                onClick={() => void handleDelete(record)}
                                disabled={deletingId === record.id}
                                title="Delete other fee title"
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
            aria-label="Close other fees title drawer"
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
                  {editingRecord ? 'Edit other fees title' : 'Add other fees title'}
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
                    Display title
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
                    Amount
                  </Label>
                  <Input
                    value={form.amount}
                    onChange={(event) => updateField('amount', event.target.value)}
                    className={cn(
                      'h-9 rounded-md border-slate-300 bg-white px-3 text-[12px]',
                      formErrors.amount && 'border-red-300'
                    )}
                  />
                  {formErrors.amount ? (
                    <p className="text-[11px] text-red-600">{formErrors.amount}</p>
                  ) : null}
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

                <div className="space-y-2">
                  <Label className="text-[11px] font-medium text-slate-700">
                    Include in Imprest
                  </Label>
                  <RadioGroup
                    value={form.include_imprest}
                    onValueChange={(value) =>
                      updateField('include_imprest', value as 'Y' | 'N')
                    }
                    className="flex gap-6"
                  >
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="Y" id="include-imprest-yes" />
                      <Label htmlFor="include-imprest-yes">Yes</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="N" id="include-imprest-no" />
                      <Label htmlFor="include-imprest-no">No</Label>
                    </div>
                  </RadioGroup>
                </div>

                <div className="space-y-2">
                  <Label className="text-[11px] font-medium text-slate-700">
                    Status
                  </Label>
                  <RadioGroup
                    value={form.status}
                    onValueChange={(value) =>
                      updateField('status', value as '1' | '0')
                    }
                    className="flex gap-6"
                  >
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="1" id="status-active" />
                      <Label htmlFor="status-active">Active</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="0" id="status-inactive" />
                      <Label htmlFor="status-inactive">Inactive</Label>
                    </div>
                  </RadioGroup>
                </div>
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
                    'Update other fees title'
                  ) : (
                    'Save other fees title'
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
