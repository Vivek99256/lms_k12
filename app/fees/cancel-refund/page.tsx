'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowUpDown,
  Ban,
  CheckCircle2,
  Eye,
  Loader2,
  ReceiptText,
  RefreshCcw,
  Search,
  WalletCards,
} from 'lucide-react';

import { API_BASE_URL } from '@/app/components/utils/api_url';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
  type DropdownField,
  type DropdownValue,
  type SearchDropdownValues,
} from '@/components/search-dropdown';

type SessionContext = {
  token: string;
  subInstituteId: string;
  userId: string;
  academicYearId: string;
  hostName: string;
};

type CancelReceiptRow = {
  id: string;
  feesType: 'REGULAR' | 'OTHER';
  receiptNo: string;
  studentId: string;
  studentName: string;
  enrollmentNo: string;
  grade: string;
  standardName: string;
  divisionName: string;
  totalAmount: number;
  receiptDate: string;
  createdOn: string;
  paymentMode: string;
  bankBranch: string;
  monthId: string;
  receiptHtml: string;
};

type SortKey =
  | 'studentName'
  | 'enrollmentNo'
  | 'receiptNo'
  | 'totalAmount'
  | 'receiptDate'
  | 'createdOn'
  | 'paymentMode';

type SortState = {
  key: SortKey;
  direction: 'asc' | 'desc';
};

type CancelFormState = Record<string, { cancelType: string; cancelRemark: string }>;

type CancelSearchResponse = {
  status?: string | number;
  status_code?: string | number;
  message?: string;
  fees_data?: unknown;
  fees_cancel_type?: unknown;
  receipt_css_data?: unknown;
  paper_size?: unknown;
};

const PAGE_SIZE = 10;
const cancelFields: DropdownField[] = ['section', 'standard', 'division'];

const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

export default function FeesCancelRefundPage() {
  const [activeTab, setActiveTab] = useState<'cancel' | 'refund'>('cancel');
  const [session] = useState(getSessionContext);
  const [academicFilters, setAcademicFilters] = useState<Partial<SearchDropdownValues>>({
    section: '',
    standard: '',
    division: '',
  });
  const [enrollmentNo, setEnrollmentNo] = useState('');
  const [receiptNo, setReceiptNo] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [quickSearch, setQuickSearch] = useState('');
  const [rows, setRows] = useState<CancelReceiptRow[]>([]);
  const [cancelTypes, setCancelTypes] = useState<string[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [formState, setFormState] = useState<CancelFormState>({});
  const [receiptCss, setReceiptCss] = useState('');
  const [paperSize, setPaperSize] = useState('');
  const [previewRow, setPreviewRow] = useState<CancelReceiptRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [sortState, setSortState] = useState<SortState>({ key: 'createdOn', direction: 'desc' });
  const [page, setPage] = useState(1);

  const selectedStandardId = getSingleDropdownValue(academicFilters.standard);
  const selectedDivisionId = getSingleDropdownValue(academicFilters.division);

  const metrics = useMemo(() => {
    const eligibleRows = rows.filter(isRowCancellable);
    const selectedRows = rows.filter((row) => selectedKeys.includes(getRowKey(row)));
    const selectedAmount = selectedRows.reduce((total, row) => total + row.totalAmount, 0);

    return {
      receiptCount: rows.length,
      eligibleCount: eligibleRows.length,
      blockedCount: rows.length - eligibleRows.length,
      selectedAmount,
    };
  }, [rows, selectedKeys]);

  const visibleRows = useMemo(() => {
    const normalizedSearch = quickSearch.trim().toLowerCase();
    const filtered = rows.filter((row) => {
      if (!normalizedSearch) return true;

      return [
        row.studentName,
        row.enrollmentNo,
        row.receiptNo,
        row.standardName,
        row.divisionName,
        row.paymentMode,
        row.feesType,
      ].join(' ').toLowerCase().includes(normalizedSearch);
    });

    return [...filtered].sort((first, second) => compareRows(first, second, sortState));
  }, [quickSearch, rows, sortState]);

  const totalPages = Math.max(Math.ceil(visibleRows.length / PAGE_SIZE), 1);
  const pageRows = visibleRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const selectedSet = useMemo(() => new Set(selectedKeys), [selectedKeys]);
  const selectablePageRows = pageRows.filter(isRowCancellable);
  const allPageRowsSelected = selectablePageRows.length > 0 && selectablePageRows.every((row) => selectedSet.has(getRowKey(row)));

  const handleSearch = useCallback(async () => {
    const currentSession = getSessionContext();
    const apiBaseUrl = getApiBaseUrl(currentSession);
    const academicYearId = currentSession.academicYearId || session.academicYearId;

    if (!apiBaseUrl || !currentSession.subInstituteId || !academicYearId) {
      setMessage({ type: 'error', text: 'Session details are missing. Please sign in again before searching receipts.' });
      return;
    }

    setLoading(true);
    setMessage(null);
    setHasSearched(true);
    setRows([]);
    setSelectedKeys([]);
    setFormState({});
    setPage(1);

    try {
      const form = new URLSearchParams();
      form.append('sub_institute_id', currentSession.subInstituteId);
      form.append('syear', academicYearId);
      if (getSingleDropdownValue(academicFilters.section)) form.append('grade', getSingleDropdownValue(academicFilters.section));
      if (selectedStandardId) form.append('standard', selectedStandardId);
      if (selectedDivisionId) form.append('division', selectedDivisionId);
      if (enrollmentNo.trim()) form.append('enrollment_no', enrollmentNo.trim());
      if (receiptNo.trim()) form.append('receipt_no', receiptNo.trim());
      if (fromDate) form.append('from_date', fromDate);
      if (toDate) form.append('to_date', toDate);

      const response = await fetch(`${apiBaseUrl}/api/fees-cancel/search`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
          ...(currentSession.token ? { Authorization: `Bearer ${currentSession.token}` } : {}),
        },
        body: form.toString(),
      });

      const payload = await parseJsonResponse<CancelSearchResponse>(response);
      if (!response.ok) {
        throw new Error(payload.message || `HTTP ${response.status}: Unable to search fee receipts.`);
      }

      const status = readStatus(payload);
      if (status !== 1) {
        throw new Error(payload.message || 'No fees receipt found. Please search again.');
      }

      const nextRows = toCancelReceiptRows(payload.fees_data);
      setRows(nextRows);
      setCancelTypes(toCancelTypeOptions(payload.fees_cancel_type));
      setReceiptCss(readString(payload.receipt_css_data));
      setPaperSize(readString(payload.paper_size));
      setMessage({ type: 'success', text: payload.message || `Loaded ${nextRows.length} receipt${nextRows.length === 1 ? '' : 's'}.` });
    } catch (error) {
      setRows([]);
      setCancelTypes([]);
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Unable to search fee receipts.' });
    } finally {
      setLoading(false);
    }
  }, [
    academicFilters.section,
    enrollmentNo,
    fromDate,
    receiptNo,
    selectedDivisionId,
    selectedStandardId,
    session.academicYearId,
    toDate,
  ]);

  const handleSubmitCancel = useCallback(async () => {
    const currentSession = getSessionContext();
    const apiBaseUrl = getApiBaseUrl(currentSession);
    const academicYearId = currentSession.academicYearId || session.academicYearId;
    const selectedRows = rows.filter((row) => selectedKeys.includes(getRowKey(row)));
    const validationError = validateCancelSelection(selectedRows, formState);

    if (validationError) {
      setMessage({ type: 'error', text: validationError });
      return;
    }

    if (!apiBaseUrl || !currentSession.subInstituteId || !academicYearId || !currentSession.userId || !currentSession.token) {
      setMessage({ type: 'error', text: 'Session token, user, institute, or academic year is missing. Please sign in again before cancelling fees.' });
      return;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      const form = new FormData();
      form.append('type', 'API');
      form.append('sub_institute_id', currentSession.subInstituteId);
      form.append('syear', academicYearId);
      form.append('user_id', currentSession.userId);
      form.append('submit', 'Cancel');

      selectedRows.forEach((row) => {
        const key = getRowKey(row);
        const cancelValues = formState[key] ?? { cancelType: '', cancelRemark: '' };
        const backendRowKey = `${row.receiptNo}/${row.studentId}`;

        form.append('receipt_no[]', `${row.receiptNo}####${row.studentId}`);
        form.append(`student_id[${row.studentId}]`, row.studentId);
        form.append(`totAmt[${row.receiptNo}]`, String(row.totalAmount));
        form.append('month_id', row.monthId);

        if (row.feesType === 'REGULAR') {
          form.append(`cancel_type[${backendRowKey}]`, `${cancelValues.cancelType}/`);
          form.append(`cancel_remark[${backendRowKey}]`, cancelValues.cancelRemark.trim());
        }
      });

      const response = await fetch(`${apiBaseUrl}/fees/fees_cancel`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${currentSession.token}`,
        },
        body: form,
      });

      const payload = await parseJsonResponse<{ status?: string | number; status_code?: string | number; message?: string }>(response);
      if (!response.ok) {
        throw new Error(payload.message || `HTTP ${response.status}: Unable to cancel selected fees.`);
      }

      const status = readStatus(payload);
      if (status !== 1) {
        throw new Error(payload.message || 'Unable to cancel selected fees.');
      }

      const selectedRowKeys = new Set(selectedRows.map(getRowKey));
      setRows((currentRows) => currentRows.filter((row) => !selectedRowKeys.has(getRowKey(row))));
      setSelectedKeys([]);
      setFormState({});
      setMessage({ type: 'success', text: payload.message || 'Fees deleted successfully.' });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Unable to cancel selected fees.' });
    } finally {
      setSubmitting(false);
    }
  }, [formState, rows, selectedKeys, session.academicYearId]);

  const toggleRowSelection = (row: CancelReceiptRow, checked: boolean) => {
    if (!isRowCancellable(row)) return;
    const key = getRowKey(row);

    setSelectedKeys((current) => {
      if (checked) return current.includes(key) ? current : [...current, key];
      return current.filter((value) => value !== key);
    });
  };

  const togglePageSelection = (checked: boolean) => {
    const pageKeys = selectablePageRows.map(getRowKey);

    setSelectedKeys((current) => {
      if (checked) return [...new Set([...current, ...pageKeys])];
      return current.filter((key) => !pageKeys.includes(key));
    });
  };

  const updateCancelField = (row: CancelReceiptRow, field: 'cancelType' | 'cancelRemark', value: string) => {
    const key = getRowKey(row);
    setFormState((current) => ({
      ...current,
      [key]: {
        cancelType: current[key]?.cancelType ?? '',
        cancelRemark: current[key]?.cancelRemark ?? '',
        [field]: value,
      },
    }));
  };

  const updateSort = (key: SortKey) => {
    setSortState((current) => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-[1500px] space-y-4 p-3 sm:p-4 lg:p-5">
        <section className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <MetricCard title="Receipts found" value={String(metrics.receiptCount)} icon={<ReceiptText className="h-4 w-4" />} />
          <MetricCard title="Eligible to cancel" value={String(metrics.eligibleCount)} icon={<CheckCircle2 className="h-4 w-4" />} />
          <MetricCard title="Blocked online" value={String(metrics.blockedCount)} icon={<Ban className="h-4 w-4" />} />
          <MetricCard title="Selected value" value={currencyFormatter.format(metrics.selectedAmount)} icon={<WalletCards className="h-4 w-4" />} />
        </section>

        <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-base font-bold leading-none text-slate-950">Fees Cancel / Refund</h1>
              <p className="mt-2 text-xs text-slate-700">Search paid receipts, select eligible rows, and submit fee cancellations to Laravel.</p>
            </div>
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1">
              <TabButton active={activeTab === 'cancel'} onClick={() => setActiveTab('cancel')}>Fees Cancel</TabButton>
              <TabButton active={activeTab === 'refund'} onClick={() => setActiveTab('refund')}>Fees Refund</TabButton>
            </div>
          </div>

          {activeTab === 'cancel' ? (
            <div className="space-y-4 p-4">
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">
                The system prohibits cancellation of fees paid via the Online Portal.
              </div>

              <div className="grid gap-3 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
                <div className="lg:col-span-4">
                  <SearchDropdown
                    fields={cancelFields}
                    token={session.token}
                    subInstituteId={session.subInstituteId}
                    values={academicFilters}
                    onChange={setAcademicFilters}
                  />
                </div>

                <Field label="Enrollment No">
                  <Input value={enrollmentNo} onChange={(event) => setEnrollmentNo(event.target.value)} placeholder="Enter GR no" />
                </Field>
                <Field label="Receipt No">
                  <Input value={receiptNo} onChange={(event) => setReceiptNo(event.target.value)} placeholder="Receipt number" />
                </Field>
                <Field label="From Date">
                  <Input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
                </Field>
                <Field label="To Date">
                  <Input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
                </Field>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <Button type="button" onClick={handleSearch} disabled={loading} className="h-9 w-full sm:w-auto">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  Search
                </Button>
                <div className="relative w-full sm:max-w-sm">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={quickSearch}
                    onChange={(event) => {
                      setQuickSearch(event.target.value);
                      setPage(1);
                    }}
                    className="pl-8"
                    placeholder="Filter receipt results"
                  />
                </div>
              </div>

              {message && <InlineMessage type={message.type} text={message.text} />}

              <div className="overflow-hidden rounded-lg border border-slate-200">
                <Table className="min-w-[1180px]">
                  <TableHeader>
                    <TableRow className="bg-slate-100 text-xs uppercase text-slate-700 hover:bg-slate-100">
                      <TableHead className="w-10">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-300"
                          checked={allPageRowsSelected}
                          onChange={(event) => togglePageSelection(event.target.checked)}
                          disabled={selectablePageRows.length === 0}
                          aria-label="Select visible cancellable receipts"
                        />
                      </TableHead>
                      <SortableHead label="GR No" sortKey="enrollmentNo" state={sortState} onSort={updateSort} />
                      <SortableHead label="Student" sortKey="studentName" state={sortState} onSort={updateSort} />
                      <TableHead>Standard</TableHead>
                      <TableHead>Division</TableHead>
                      <SortableHead label="Receipt No" sortKey="receiptNo" state={sortState} onSort={updateSort} />
                      <SortableHead label="Amount" sortKey="totalAmount" state={sortState} onSort={updateSort} align="right" />
                      <SortableHead label="Receipt Date" sortKey="receiptDate" state={sortState} onSort={updateSort} />
                      <SortableHead label="Created Date" sortKey="createdOn" state={sortState} onSort={updateSort} />
                      <SortableHead label="Payment Mode" sortKey="paymentMode" state={sortState} onSort={updateSort} />
                      <TableHead>Cancel Type</TableHead>
                      <TableHead>Cancel Remarks</TableHead>
                      <TableHead>Receipt</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={13} className="h-36 text-center text-sm text-slate-600">
                          <span className="inline-flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Loading fee receipts
                          </span>
                        </TableCell>
                      </TableRow>
                    ) : pageRows.length > 0 ? (
                      pageRows.map((row) => {
                        const key = getRowKey(row);
                        const selected = selectedSet.has(key);
                        const cancellable = isRowCancellable(row);
                        const currentForm = formState[key] ?? { cancelType: '', cancelRemark: '' };

                        return (
                          <TableRow key={key} className="odd:bg-white even:bg-slate-50/70">
                            <TableCell>
                              <input
                                type="checkbox"
                                className="h-4 w-4 rounded border-slate-300"
                                checked={selected}
                                disabled={!cancellable}
                                onChange={(event) => toggleRowSelection(row, event.target.checked)}
                                aria-label={`Select receipt ${row.receiptNo}`}
                              />
                            </TableCell>
                            <TableCell className="font-medium text-slate-950">{row.enrollmentNo || '-'}</TableCell>
                            <TableCell>
                              <p className="font-semibold text-slate-950">{row.studentName || '-'}</p>
                              <p className="mt-1 text-xs text-slate-500">{row.feesType}</p>
                            </TableCell>
                            <TableCell>{row.standardName || '-'}</TableCell>
                            <TableCell>{row.divisionName || '-'}</TableCell>
                            <TableCell className="font-mono text-xs">{row.receiptNo || '-'}</TableCell>
                            <TableCell className="text-right font-semibold text-slate-950">{currencyFormatter.format(row.totalAmount)}</TableCell>
                            <TableCell>{formatDate(row.receiptDate)}</TableCell>
                            <TableCell>{formatDateTime(row.createdOn)}</TableCell>
                            <TableCell>
                              <PaymentModeBadge row={row} />
                            </TableCell>
                            <TableCell className="min-w-48">
                              {row.feesType === 'REGULAR' ? (
                                <select
                                  className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-100"
                                  value={currentForm.cancelType}
                                  onChange={(event) => updateCancelField(row, 'cancelType', event.target.value)}
                                  disabled={!selected || !cancellable}
                                >
                                  <option value="">Select Cancel Type</option>
                                  {cancelTypes.map((cancelType) => (
                                    <option key={cancelType} value={cancelType}>{cancelType}</option>
                                  ))}
                                </select>
                              ) : (
                                <span className="text-slate-500">-</span>
                              )}
                            </TableCell>
                            <TableCell className="min-w-56">
                              {row.feesType === 'REGULAR' ? (
                                <Textarea
                                  value={currentForm.cancelRemark}
                                  onChange={(event) => updateCancelField(row, 'cancelRemark', event.target.value)}
                                  disabled={!selected || !cancellable}
                                  placeholder="Please enter cancel remark"
                                  className="min-h-8"
                                />
                              ) : (
                                <span className="text-slate-500">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setPreviewRow(row)}
                                disabled={!row.receiptHtml}
                              >
                                <Eye className="h-3.5 w-3.5" />
                                View
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    ) : (
                      <TableRow>
                        <TableCell colSpan={13} className="h-36 text-center text-sm text-slate-600">
                          {hasSearched ? 'No fee receipts match the current search.' : 'Search to load cancellable fee receipts.'}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <p className="text-xs text-slate-600">
                  Showing {pageRows.length} of {visibleRows.length} receipt{visibleRows.length === 1 ? '' : 's'}.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" variant="outline" onClick={() => setPage((current) => Math.max(current - 1, 1))} disabled={page === 1}>
                    Previous
                  </Button>
                  <span className="text-xs font-semibold text-slate-600">Page {page} of {totalPages}</span>
                  <Button type="button" variant="outline" onClick={() => setPage((current) => Math.min(current + 1, totalPages))} disabled={page === totalPages}>
                    Next
                  </Button>
                  <Button type="button" onClick={handleSubmitCancel} disabled={submitting || selectedKeys.length === 0}>
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
                    Cancel Selected
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <RefundBackendGapPanel />
          )}
        </section>
      </div>

      {previewRow && (
        <ReceiptPreview
          row={previewRow}
          receiptCss={receiptCss}
          paperSize={paperSize}
          onClose={() => setPreviewRow(null)}
        />
      )}
    </div>
  );
}

function MetricCard({ title, value, icon }: { title: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3.5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium text-slate-700">{title}</p>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-blue-100 bg-blue-50 text-[var(--primary-blue)]">
          {icon}
        </div>
      </div>
      <p className="mt-3 text-xl font-bold leading-none text-slate-950">{value}</p>
    </div>
  );
}

function TabButton({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-8 rounded-md px-3 text-xs font-semibold transition-colors ${
        active ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-600 hover:text-slate-950'
      }`}
    >
      {children}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function SortableHead({
  label,
  sortKey,
  state,
  onSort,
  align = 'left',
}: {
  label: string;
  sortKey: SortKey;
  state: SortState;
  onSort: (key: SortKey) => void;
  align?: 'left' | 'right';
}) {
  const active = state.key === sortKey;

  return (
    <TableHead className={align === 'right' ? 'text-right' : undefined}>
      <button
        type="button"
        className={`inline-flex items-center gap-1.5 ${align === 'right' ? 'justify-end' : ''}`}
        onClick={() => onSort(sortKey)}
      >
        {label}
        <ArrowUpDown className={`h-3.5 w-3.5 ${active ? 'text-blue-600' : 'text-slate-400'}`} />
      </button>
    </TableHead>
  );
}

function InlineMessage({ type, text }: { type: 'success' | 'error'; text: string }) {
  const Icon = type === 'success' ? CheckCircle2 : AlertCircle;
  const classes = type === 'success'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
    : 'border-red-200 bg-red-50 text-red-800';

  return (
    <div className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm font-medium ${classes}`}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{text}</span>
    </div>
  );
}

function PaymentModeBadge({ row }: { row: CancelReceiptRow }) {
  if (!isRowCancellable(row)) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">
        <Ban className="h-3 w-3" />
        Online portal
      </span>
    );
  }

  return (
    <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
      {row.paymentMode || '-'}
    </span>
  );
}

function RefundBackendGapPanel() {
  return (
    <div className="space-y-4 p-4">
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
          <div>
            <h2 className="text-sm font-bold text-amber-900">Refund workflow needs backend API support</h2>
            <p className="mt-2 text-sm leading-6 text-amber-800">
              The Laravel refund flow is currently implemented as session-backed web views. I did not recreate it with mock data because the old ERP does not expose JSON/API-safe endpoints for refund search, student refund detail, or save.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3">
          <h3 className="text-sm font-bold text-slate-950">Backend endpoints needed before frontend wiring</h3>
        </div>
        <div className="grid gap-3 p-4 md:grid-cols-3">
          <GapCard
            title="Refund search"
            body="JSON endpoint equivalent to POST fees/fees_refund that accepts grade, standard, division, enrollment_no, from_date, to_date, sub_institute_id, and syear."
          />
          <GapCard
            title="Refund detail"
            body="JSON endpoint equivalent to fees_refund/{student_id}/edit returning student data, paid fee-head totals, bank options, fee config, and validation metadata."
          />
          <GapCard
            title="Refund save"
            body="JSON endpoint equivalent to POST fees/save_fees_refund accepting refund_amount by fee head, payment mode, receipt date, cheque/DD details, bank details, and remark."
          />
        </div>
      </div>
    </div>
  );
}

function GapCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="text-sm font-bold text-slate-950">{title}</p>
      <p className="mt-2 text-xs leading-5 text-slate-700">{body}</p>
    </div>
  );
}

function ReceiptPreview({
  row,
  receiptCss,
  paperSize,
  onClose,
}: {
  row: CancelReceiptRow;
  receiptCss: string;
  paperSize: string;
  onClose: () => void;
}) {
  const html = `${receiptCss ? `<style>${receiptCss}</style>` : ''}${row.receiptHtml}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div>
            <h2 className="text-sm font-bold text-slate-950">Receipt {row.receiptNo}</h2>
            <p className="mt-1 text-xs text-slate-500">{row.studentName} {paperSize ? `- ${paperSize}` : ''}</p>
          </div>
          <Button type="button" variant="outline" onClick={onClose}>Close</Button>
        </div>
        <div className="overflow-auto p-4">
          <div className="min-w-[720px]" dangerouslySetInnerHTML={{ __html: html }} />
        </div>
      </div>
    </div>
  );
}

function getSessionContext(): SessionContext {
  if (typeof window === 'undefined') {
    return { token: '', subInstituteId: '', userId: '', academicYearId: '', hostName: '' };
  }

  try {
    const userData = JSON.parse(localStorage.getItem('userData') || '{}') as Record<string, unknown>;
    const menuContext = JSON.parse(localStorage.getItem('menuContext') || '{}') as Record<string, unknown>;
    const selectedAcademicYear = localStorage.getItem('selectedAcademicYear');

    return {
      token: readString(userData.user_token ?? userData.token ?? menuContext.user_token ?? menuContext.token),
      subInstituteId: readString(userData.sub_institute_id ?? menuContext.sub_institute_id),
      userId: readString(userData.user_id ?? menuContext.user_id),
      academicYearId: readString(selectedAcademicYear || (userData.academic_year_id ?? userData.academicYearId ?? menuContext.academic_year_id)),
      hostName: readString(userData.host_name) || API_BASE_URL,
    };
  } catch {
    return { token: '', subInstituteId: '', userId: '', academicYearId: '', hostName: '' };
  }
}

function getApiBaseUrl(session: SessionContext) {
  return (session.hostName || API_BASE_URL || '').replace(/\/$/, '');
}

function getSingleDropdownValue(value: DropdownValue | undefined) {
  if (Array.isArray(value)) return value[0] || '';
  return value || '';
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value : value == null ? '' : String(value);
}

function readNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Number(readString(value).replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function readStatus(payload: { status?: string | number; status_code?: string | number }) {
  return readNumber(payload.status_code ?? payload.status);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function toCancelReceiptRows(value: unknown): CancelReceiptRow[] {
  if (!Array.isArray(value)) return [];

  return value.map((item, index) => {
    const row = asRecord(item);
    const feesType = readString(row.fees_type).toUpperCase() === 'OTHER' ? 'OTHER' : 'REGULAR';
    const receiptHtml = readString(row.fees_html || row.paid_fees_html);

    return {
      id: readString(row.id) || String(index),
      feesType,
      receiptNo: readString(row.receipt_no),
      studentId: readString(row.student_id),
      studentName: readString(row.student_name),
      enrollmentNo: readString(row.enrollment_no),
      grade: readString(row.grade),
      standardName: readString(row.standard_name),
      divisionName: readString(row.division_name),
      totalAmount: readNumber(row.total_amount),
      receiptDate: readString(row.receiptdate),
      createdOn: readString(row.created_on),
      paymentMode: readString(row.payment_mode),
      bankBranch: readString(row.bank_branch),
      monthId: readString(row.month_id),
      receiptHtml,
    };
  });
}

function toCancelTypeOptions(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(readString).filter(Boolean);
  }

  if (!value || typeof value !== 'object') return [];

  return Object.values(value as Record<string, unknown>).map(readString).filter(Boolean);
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text) return {} as T;

  try {
    return JSON.parse(text) as T;
  } catch {
    return { message: text } as T;
  }
}

function isRowCancellable(row: CancelReceiptRow) {
  return !(row.paymentMode === 'Online' && row.bankBranch === '');
}

function getRowKey(row: CancelReceiptRow) {
  return `${row.receiptNo}/${row.studentId}/${row.feesType}`;
}

function validateCancelSelection(rows: CancelReceiptRow[], formState: CancelFormState) {
  if (rows.length === 0) return 'Please select receipt no to cancel fees.';
  const blockedRow = rows.find((row) => !isRowCancellable(row));
  if (blockedRow) return `Receipt ${blockedRow.receiptNo} cannot be cancelled because it was paid via the Online Portal.`;

  for (const row of rows) {
    if (row.feesType !== 'REGULAR') continue;
    const values = formState[getRowKey(row)];
    if (!values?.cancelType) return `Please select cancel type for receipt ${row.receiptNo}.`;
    if (!values.cancelRemark.trim()) return `Please enter cancel remark for receipt ${row.receiptNo}.`;
  }

  return '';
}

function compareRows(first: CancelReceiptRow, second: CancelReceiptRow, state: SortState) {
  const multiplier = state.direction === 'asc' ? 1 : -1;
  const firstValue = getSortValue(first, state.key);
  const secondValue = getSortValue(second, state.key);

  if (typeof firstValue === 'number' && typeof secondValue === 'number') {
    return (firstValue - secondValue) * multiplier;
  }

  return String(firstValue).localeCompare(String(secondValue), undefined, { numeric: true, sensitivity: 'base' }) * multiplier;
}

function getSortValue(row: CancelReceiptRow, key: SortKey): string | number {
  if (key === 'totalAmount') return row.totalAmount;
  return row[key] || '';
}

function formatDate(value: string) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTime(value: string) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
