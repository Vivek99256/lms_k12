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
import {
  SearchDropdown,
  type DropdownValue,
  type SearchDropdownValues,
} from '@/components/search-dropdown';
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
 * Fees Circular Master - port of feesCircularMasterController and its blade
 * views. The menu row pointed at /fees/master/fees-config-master, so this tab
 * and Fees Config Master rendered the same screen.
 *
 * Despite the shared "circular" name this is NOT the circular generation screen
 * at /fees/circulars. It is the per-(academic section, standard) bank block
 * printed on a fee circular: bank name, two address lines, account number,
 * paid collection, shift, form number and branch.
 *
 * The legacy `edit` action returns a blade view with no type=API branch, so the
 * edit form is populated from the row already held by the listing - `index`
 * returns every column plus standard_name/grade_name, so nothing is missing.
 */

type CircularRow = {
  id?: unknown;
  grade_id?: unknown;
  standard_id?: unknown;
  grade_name?: unknown;
  standard_name?: unknown;
  bank_name?: unknown;
  address_line1?: unknown;
  address_line2?: unknown;
  account_no?: unknown;
  paid_collection?: unknown;
  shift?: unknown;
  form_no?: unknown;
  branch?: unknown;
};

type CircularRecord = {
  id: string;
  gradeId: string;
  standardId: string;
  gradeName: string;
  standardName: string;
  bankName: string;
  addressLine1: string;
  addressLine2: string;
  accountNo: string;
  paidCollection: string;
  shift: string;
  formNo: string;
  branch: string;
  searchText: string;
};

type CircularForm = {
  bank_name: string;
  address_line1: string;
  address_line2: string;
  account_no: string;
  paid_collection: string;
  shift: string;
  form_no: string;
  branch: string;
};

type FormErrors = Partial<Record<keyof CircularForm | 'grade', string>>;

const initialForm: CircularForm = {
  bank_name: '',
  address_line1: '',
  address_line2: '',
  account_no: '',
  paid_collection: '',
  shift: '',
  form_no: '',
  branch: '',
};

/** Every field on the blade form carries `required`. */
const REQUIRED_LABELS: Record<keyof CircularForm, string> = {
  bank_name: 'Bank name',
  address_line1: 'Address line 1',
  address_line2: 'Address line 2',
  account_no: 'Account no',
  paid_collection: 'Paid collection',
  shift: 'Shift',
  form_no: 'Form no',
  branch: 'Branch',
};

function single(value: DropdownValue | undefined): string {
  return Array.isArray(value) ? value[0] || '' : value || '';
}

function mapRow(row: CircularRow): CircularRecord {
  const gradeName = readString(row.grade_name);
  const standardName = readString(row.standard_name);
  const bankName = readString(row.bank_name);
  const accountNo = readString(row.account_no);
  const branch = readString(row.branch);

  return {
    id: readString(row.id),
    gradeId: readString(row.grade_id),
    standardId: readString(row.standard_id),
    gradeName,
    standardName,
    bankName,
    addressLine1: readString(row.address_line1),
    addressLine2: readString(row.address_line2),
    accountNo,
    paidCollection: readString(row.paid_collection),
    shift: readString(row.shift),
    formNo: readString(row.form_no),
    branch,
    searchText: [gradeName, standardName, bankName, accountNo, branch]
      .join(' ')
      .toLowerCase(),
  };
}

function appendIdentity(target: FormData, session: SessionContext) {
  target.append('type', 'API');
  if (session.subInstituteId) target.append('sub_institute_id', session.subInstituteId);
  if (session.syear) target.append('syear', session.syear);
  if (session.userId) target.append('user_id', session.userId);
}

export default function FeesCircularMasterPage() {
  const [session] = useState(buildSessionContext);
  const [records, setRecords] = useState<CircularRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isDrawerVisible, setIsDrawerVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState<CircularRecord | null>(null);
  const [filters, setFilters] = useState<Partial<SearchDropdownValues>>({
    section: '',
    standard: '',
  });
  const [form, setForm] = useState<CircularForm>(initialForm);
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
      const url = new URL(`${session.baseUrl}/fees/fees_circular_master`);
      appendCommonParams(url.searchParams, session);

      const response = await fetch(url.toString(), {
        headers: createAuthHeaders(session),
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error(`Failed to load circular masters (${response.status})`);
      }

      const payload = (await response.json()) as ApiEnvelope;
      const rows = Array.isArray(payload.data) ? (payload.data as CircularRow[]) : [];
      setRecords(rows.map(mapRow));
    } catch (fetchError) {
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : 'Failed to load circular masters.'
      );
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadRecords();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [loadRecords]);

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

  const filteredRecords = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return records;
    return records.filter((record) => record.searchText.includes(query));
  }, [records, searchTerm]);

  const updateField = (key: keyof CircularForm, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    setFormErrors((current) => ({ ...current, [key]: undefined }));
  };

  const openCreate = () => {
    setEditingRecord(null);
    setForm(initialForm);
    setFilters({ section: '', standard: '' });
    setFormErrors({});
    setIsDrawerOpen(true);
  };

  const openEdit = (record: CircularRecord) => {
    setEditingRecord(record);
    setForm({
      bank_name: record.bankName,
      address_line1: record.addressLine1,
      address_line2: record.addressLine2,
      account_no: record.accountNo,
      paid_collection: record.paidCollection,
      shift: record.shift,
      form_no: record.formNo,
      branch: record.branch,
    });
    setFilters({ section: record.gradeId, standard: record.standardId });
    setFormErrors({});
    setIsDrawerOpen(true);
  };

  const closeDrawer = () => {
    setIsDrawerOpen(false);
    setEditingRecord(null);
    setFormErrors({});
  };

  const grade = single(filters.section);
  const standard = single(filters.standard);

  const validate = (): boolean => {
    const nextErrors: FormErrors = {};

    if (!grade || !standard) {
      nextErrors.grade = 'Select academic section and standard';
    }

    (Object.keys(REQUIRED_LABELS) as Array<keyof CircularForm>).forEach((key) => {
      if (!form[key].trim()) {
        nextErrors[key] = `${REQUIRED_LABELS[key]} is required`;
      }
    });

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
      // The controller reads the pair as `grade`/`standard` and writes them to
      // grade_id/standard_id itself.
      formData.append('grade', grade);
      formData.append('standard', standard);
      (Object.keys(REQUIRED_LABELS) as Array<keyof CircularForm>).forEach((key) => {
        formData.append(key, form[key]);
      });

      if (editingRecord) {
        formData.append('_method', 'PUT');
      }

      const url = editingRecord
        ? `${session.baseUrl}/fees/fees_circular_master/${encodeURIComponent(editingRecord.id)}`
        : `${session.baseUrl}/fees/fees_circular_master`;

      const response = await fetch(url, {
        method: 'POST',
        headers: createAuthHeaders(session),
        body: formData,
      });

      if (!response.ok) {
        throw new Error(
          `Failed to ${editingRecord ? 'update' : 'save'} circular master (${response.status})`
        );
      }

      const payload = (await response.json()) as ApiEnvelope;
      const apiStatus = normalizeApiStatus(payload);
      if (apiStatus && apiStatus !== '1') {
        throw new Error(payload.message || 'Failed to save circular master.');
      }

      setSuccessMessage(
        payload.message ||
          `Circular master ${editingRecord ? 'updated' : 'saved'} successfully.`
      );
      closeDrawer();
      setForm(initialForm);
      setFilters({ section: '', standard: '' });
      await loadRecords();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Failed to save circular master.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (record: CircularRecord) => {
    if (!session.baseUrl) return;
    if (
      !window.confirm(
        `Delete the circular master for ${record.bankName || 'this bank'}?`
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
        `${session.baseUrl}/fees/fees_circular_master/${encodeURIComponent(record.id)}`,
        {
          method: 'POST',
          headers: createAuthHeaders(session),
          body: formData,
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to delete circular master (${response.status})`);
      }

      const payload = (await response.json()) as ApiEnvelope;
      const apiStatus = normalizeApiStatus(payload);
      if (apiStatus && apiStatus !== '1') {
        throw new Error(payload.message || 'Failed to delete circular master.');
      }

      setSuccessMessage(payload.message || 'Circular master deleted successfully.');
      await loadRecords();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : 'Failed to delete circular master.'
      );
    } finally {
      setDeletingId('');
    }
  };

  return (
    <>
      <div className="min-h-screen p-4 sm:p-5 lg:p-6">
        <div className="mx-auto">
          <Card className="rounded-2xl border border-slate-200/90 bg-white py-0 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <CardHeader className="gap-4 border-b border-slate-200/80 px-4 py-4 sm:px-5">
              <div>
                <CardTitle className="text-[16px] font-semibold text-slate-950">
                  Fees Circular Master
                </CardTitle>
                <CardDescription className="text-[12px] leading-5 text-slate-600">
                  Bank and payment details printed on fee circulars, per section and
                  standard
                </CardDescription>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative w-full max-w-sm">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Search circular masters"
                    className="h-9 rounded-xl border-slate-300 bg-white pl-9 text-[12px]"
                  />
                </div>

                <Button
                  className="h-9 rounded-xl bg-[#5b4fe9] px-4 text-[12px] font-semibold text-white hover:bg-[#4d42da]"
                  onClick={openCreate}
                >
                  <Plus className="size-4" />
                  Add fees circular
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

              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                <Table>
                  <TableHeader className="bg-slate-100/90">
                    <TableRow className="border-slate-200 hover:bg-transparent">
                      {[
                        'Sr.No.',
                        'Academic Section',
                        'Standard',
                        'Bank Name',
                        'Address 1',
                        'Address 2',
                        'Account No',
                        'Paid Collection',
                        'Shift',
                        'Form No',
                        'Branch',
                      ].map((heading) => (
                        <TableHead
                          key={heading}
                          className="h-9 whitespace-nowrap px-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-600"
                        >
                          {heading}
                        </TableHead>
                      ))}
                      <TableHead className="h-9 w-[110px] px-3 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-600">
                        Action
                      </TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell
                          colSpan={12}
                          className="px-3 py-10 text-center text-[12px] text-slate-500"
                        >
                          <span className="inline-flex items-center gap-2">
                            <Loader2 className="size-4 animate-spin" />
                            Loading circular masters...
                          </span>
                        </TableCell>
                      </TableRow>
                    ) : filteredRecords.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={12}
                          className="px-3 py-10 text-center text-[12px] text-slate-500"
                        >
                          {searchTerm
                            ? 'No circular masters match your search.'
                            : 'No circular masters found.'}
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
                          <TableCell className="px-3 py-3 text-[12px] text-slate-700">
                            {record.gradeName || '-'}
                          </TableCell>
                          <TableCell className="px-3 py-3 text-[12px] text-slate-700">
                            {record.standardName || '-'}
                          </TableCell>
                          <TableCell className="px-3 py-3 text-[12px] font-semibold text-slate-900">
                            {record.bankName || '-'}
                          </TableCell>
                          <TableCell className="px-3 py-3 text-[12px] text-slate-700">
                            {record.addressLine1 || '-'}
                          </TableCell>
                          <TableCell className="px-3 py-3 text-[12px] text-slate-700">
                            {record.addressLine2 || '-'}
                          </TableCell>
                          <TableCell className="px-3 py-3 text-[12px] text-slate-700">
                            {record.accountNo || '-'}
                          </TableCell>
                          <TableCell className="px-3 py-3 text-[12px] text-slate-700">
                            {record.paidCollection || '-'}
                          </TableCell>
                          <TableCell className="px-3 py-3 text-[12px] text-slate-700">
                            {record.shift || '-'}
                          </TableCell>
                          <TableCell className="px-3 py-3 text-[12px] text-slate-700">
                            {record.formNo || '-'}
                          </TableCell>
                          <TableCell className="px-3 py-3 text-[12px] text-slate-700">
                            {record.branch || '-'}
                          </TableCell>
                          <TableCell className="px-3 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8 rounded-lg border-slate-300 text-slate-600 hover:bg-slate-50"
                                onClick={() => openEdit(record)}
                                title="Edit circular master"
                              >
                                <Pencil className="size-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8 rounded-lg border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                                onClick={() => void handleDelete(record)}
                                disabled={deletingId === record.id}
                                title="Delete circular master"
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
            aria-label="Close circular master drawer"
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
                  {editingRecord ? 'Edit fees circular' : 'Add fees circular'}
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
                  <SearchDropdown
                    fields={['section', 'standard']}
                    token={session.token}
                    subInstituteId={session.subInstituteId}
                    values={filters}
                    onChange={(value) => {
                      setFilters(value);
                      setFormErrors((current) => ({ ...current, grade: undefined }));
                    }}
                  />
                  {formErrors.grade ? (
                    <p className="text-[11px] text-red-600">{formErrors.grade}</p>
                  ) : null}
                </div>

                {(Object.keys(REQUIRED_LABELS) as Array<keyof CircularForm>).map(
                  (key) => (
                    <div key={key} className="space-y-1.5">
                      <Label className="text-[11px] font-medium text-slate-700">
                        {REQUIRED_LABELS[key]}
                      </Label>
                      <Input
                        value={form[key]}
                        onChange={(event) => updateField(key, event.target.value)}
                        className={cn(
                          'h-9 rounded-md border-slate-300 bg-white px-3 text-[12px]',
                          formErrors[key] && 'border-red-300'
                        )}
                      />
                      {formErrors[key] ? (
                        <p className="text-[11px] text-red-600">{formErrors[key]}</p>
                      ) : null}
                    </div>
                  )
                )}
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
                    'Update fees circular'
                  ) : (
                    'Save fees circular'
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
