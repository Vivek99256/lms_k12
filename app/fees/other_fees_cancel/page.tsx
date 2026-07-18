'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Eye, Loader2, RefreshCcw, Search } from 'lucide-react';

import {
  EmptyTableRow,
  Field,
  InlineMessage,
  LoadingRows,
  NativeSelect,
  PageFrame,
  PageHeader,
  ReceiptPreviewModal,
  SectionPanel,
} from '@/app/fees/_components/fees-shared';
import {
  appendSessionFormData,
  appendSessionParams,
  asRecord,
  buildApiUrl,
  fetchLaravelJson,
  formatCurrency,
  getApiBaseUrl,
  getFeesSession,
  readFirstString,
  readNumber,
  readString,
  todayIsoDate,
  toArray,
  type ApiStatusPayload,
  type FeesSession,
} from '@/app/fees/_lib/fees-api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

type OtherFeesTitle = {
  id: string;
  label: string;
};

type OtherFeesCancelRow = {
  id: string;
  studentId: string;
  studentName: string;
  enrollmentNo: string;
  standardName: string;
  divisionName: string;
  mobile: string;
  studentQuota: string;
  headName: string;
  amount: number;
  receiptNo: string;
  receiptHtml: string;
};

type OtherFeesCancelResponse = ApiStatusPayload & {
  other_fees_title?: unknown;
  student_data?: unknown;
};

type CancelInputs = Record<string, { date: string; reason: string }>;

const academicFields: DropdownField[] = ['section', 'standard', 'division'];

export default function OtherFeesCancelPage() {
  const [session, setSession] = useState<FeesSession>(() => getFeesSession());
  const [academicFilters, setAcademicFilters] = useState<Partial<SearchDropdownValues>>({
    section: '',
    standard: '',
    division: '',
  });
  const [titles, setTitles] = useState<OtherFeesTitle[]>([]);
  const [selectedTitleId, setSelectedTitleId] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [enrollmentNo, setEnrollmentNo] = useState('');
  const [mobileNo, setMobileNo] = useState('');
  const [uniqueId, setUniqueId] = useState('');
  const [rows, setRows] = useState<OtherFeesCancelRow[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [inputs, setInputs] = useState<CancelInputs>({});
  const [bulkDate, setBulkDate] = useState(todayIsoDate());
  const [bulkReason, setBulkReason] = useState('');
  const [previewHtml, setPreviewHtml] = useState('');
  const [loadingTitles, setLoadingTitles] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const selectedRows = useMemo(() => rows.filter((row) => selectedIds.includes(row.id)), [rows, selectedIds]);
  const selectedTotal = useMemo(() => selectedRows.reduce((total, row) => total + row.amount, 0), [selectedRows]);
  const allRowsSelected = rows.length > 0 && rows.every((row) => selectedIds.includes(row.id));

  const loadTitles = useCallback(async (nextSession: FeesSession) => {
    if (!nextSession.subInstituteId || !nextSession.academicYearId) {
      setMessage({ type: 'error', text: 'Session institute or academic year is missing.' });
      return;
    }

    setLoadingTitles(true);
    try {
      const params = new URLSearchParams();
      appendSessionParams(params, nextSession);
      const payload = await fetchLaravelJson<OtherFeesCancelResponse>(nextSession, `${getApiBaseUrl(nextSession)}/fees/other_fees_cancel?${params.toString()}`);
      const nextTitles = toOtherFeesTitles(payload.other_fees_title);
      setTitles(nextTitles);
      if (nextTitles.length === 0) {
        setMessage({ type: 'info', text: `No active other fees titles found for academic year ${nextSession.academicYearId}.` });
      }
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Unable to load other fees heads.' });
    } finally {
      setLoadingTitles(false);
    }
  }, []);

  useEffect(() => {
    const nextSession = getFeesSession();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSession(nextSession);
    void loadTitles(nextSession);
  }, [loadTitles]);

  const handleSearch = async () => {
    const currentSession = getFeesSession();
    setSession(currentSession);

    if (!currentSession.subInstituteId || !currentSession.academicYearId) {
      setMessage({ type: 'error', text: 'Session institute or academic year is missing.' });
      return;
    }

    if (!selectedTitleId) {
      setMessage({ type: 'error', text: 'Please select other fees title.' });
      return;
    }

    setLoading(true);
    setHasSearched(true);
    setMessage(null);
    setRows([]);
    setSelectedIds([]);
    setInputs({});

    try {
      const params = new URLSearchParams();
      appendSessionParams(params, currentSession);
      params.set('other_fees_title', selectedTitleId);
      appendIfValue(params, 'grade', getSingleValue(academicFilters.section));
      appendIfValue(params, 'standard', getSingleValue(academicFilters.standard));
      appendIfValue(params, 'division', getSingleValue(academicFilters.division));
      appendIfValue(params, 'enrollment_no', enrollmentNo.trim());
      appendIfValue(params, 'first_name', firstName.trim());
      appendIfValue(params, 'last_name', lastName.trim());
      appendIfValue(params, 'mobile_no', mobileNo.trim());
      appendIfValue(params, 'uniqueid', uniqueId.trim());

      const payload = await fetchLaravelJson<OtherFeesCancelResponse>(currentSession, `${getApiBaseUrl(currentSession)}/fees/other_fees_cancel/create?${params.toString()}`);
      const nextRows = toCancelRows(payload.student_data);
      setRows(nextRows);
      setInputs(Object.fromEntries(nextRows.map((row) => [row.id, { date: todayIsoDate(), reason: '' }])));
      setMessage({ type: 'success', text: payload.message || `Loaded ${nextRows.length} paid other-fee receipt${nextRows.length === 1 ? '' : 's'}.` });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Unable to search other fees receipts.' });
    } finally {
      setLoading(false);
    }
  };

  const toggleAllRows = (checked: boolean) => {
    setSelectedIds(checked ? rows.map((row) => row.id) : []);
  };

  const toggleRow = (rowId: string, checked: boolean) => {
    setSelectedIds((current) => checked ? [...new Set([...current, rowId])] : current.filter((id) => id !== rowId));
  };

  const updateInput = (rowId: string, field: 'date' | 'reason', value: string) => {
    setInputs((current) => ({
      ...current,
      [rowId]: {
        date: current[rowId]?.date ?? todayIsoDate(),
        reason: current[rowId]?.reason ?? '',
        [field]: value,
      },
    }));
  };

  const applyBulkDate = () => {
    setInputs((current) => {
      const next = { ...current };
      rows.forEach((row) => {
        next[row.id] = { date: bulkDate, reason: next[row.id]?.reason ?? '' };
      });
      return next;
    });
  };

  const applyBulkReason = () => {
    setInputs((current) => {
      const next = { ...current };
      rows.forEach((row) => {
        next[row.id] = { date: next[row.id]?.date ?? todayIsoDate(), reason: bulkReason };
      });
      return next;
    });
  };

  const handleSubmit = async () => {
    const currentSession = getFeesSession();
    setSession(currentSession);

    const validationError = validateCancelRows(selectedRows, inputs);
    if (validationError) {
      setMessage({ type: 'error', text: validationError });
      return;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      const form = new FormData();
      appendSessionFormData(form, currentSession);
      form.set('division_id', getSingleValue(academicFilters.division));
      form.set('standard_id', getSingleValue(academicFilters.standard));
      form.set('other_fees_title', selectedTitleId);

      selectedRows.forEach((row) => {
        const values = inputs[row.id] ?? { date: '', reason: '' };
        form.append('students[]', row.id);
        form.set(`date_of_cancel[${row.id}]`, values.date);
        form.set(`reason_of_cancel[${row.id}]`, values.reason.trim());
      });

      const payload = await fetchLaravelJson<ApiStatusPayload>(currentSession, buildApiUrl(currentSession, '/fees/other_fees_cancel'), {
        method: 'POST',
        body: form,
      });

      const removed = new Set(selectedRows.map((row) => row.id));
      setRows((current) => current.filter((row) => !removed.has(row.id)));
      setSelectedIds([]);
      setMessage({ type: 'success', text: payload.message || 'Other fees cancelled successfully.' });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Unable to cancel other fees.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageFrame>
      <PageHeader
        title="Other fees cancel"
        description="Search collected other-fee receipts, preview receipts, and cancel selected rows through Laravel."
        action={
          <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-right">
            <p className="text-xs font-medium text-red-700">Selected value</p>
            <p className="text-lg font-bold text-red-900">{formatCurrency(selectedTotal)}</p>
          </div>
        }
      />

      {message && <InlineMessage type={message.type} text={message.text} />}

      <SectionPanel title="Search">
        <div className="grid gap-3 lg:grid-cols-4">
          <div className="lg:col-span-4">
            <SearchDropdown
              fields={academicFields}
              token={session.token}
              subInstituteId={session.subInstituteId}
              values={academicFilters}
              onChange={(values) => setAcademicFilters(values)}
            />
          </div>
          <Field label="Other fees title">
            <NativeSelect value={selectedTitleId} onChange={setSelectedTitleId} disabled={loadingTitles || titles.length === 0} required>
              <option value="">{loadingTitles ? 'Loading other fees titles' : titles.length === 0 ? 'No active titles found' : 'Select other fees title'}</option>
              {titles.map((title) => (
                <option key={title.id} value={title.id}>{title.label}</option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="First name">
            <Input value={firstName} onChange={(event) => setFirstName(event.target.value)} placeholder="First name" />
          </Field>
          <Field label="Last name">
            <Input value={lastName} onChange={(event) => setLastName(event.target.value)} placeholder="Last name" />
          </Field>
          <Field label="GR no">
            <Input value={enrollmentNo} onChange={(event) => setEnrollmentNo(event.target.value)} placeholder="Enrollment number" />
          </Field>
          <Field label="Mobile no">
            <Input value={mobileNo} onChange={(event) => setMobileNo(event.target.value)} placeholder="Mobile number" />
          </Field>
          <Field label="Unique ID">
            <Input value={uniqueId} onChange={(event) => setUniqueId(event.target.value)} placeholder="Unique ID" />
          </Field>
          <div className="flex items-end">
            <Button type="button" className="h-10 w-full" onClick={handleSearch} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Search
            </Button>
          </div>
        </div>
      </SectionPanel>

      {rows.length > 0 && (
        <SectionPanel title="Bulk cancellation inputs">
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Date of cancel">
              <div className="flex gap-2">
                <Input type="date" value={bulkDate} onChange={(event) => setBulkDate(event.target.value)} />
                <Button type="button" variant="outline" onClick={applyBulkDate}>Apply</Button>
              </div>
            </Field>
            <Field label="Reason of cancel">
              <div className="flex gap-2">
                <Input value={bulkReason} onChange={(event) => setBulkReason(event.target.value)} placeholder="Reason" />
                <Button type="button" variant="outline" onClick={applyBulkReason}>Apply</Button>
              </div>
            </Field>
          </div>
        </SectionPanel>
      )}

      <SectionPanel
        title="Receipts"
        footer={
          rows.length > 0 && (
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <p className="text-sm text-slate-600">{selectedIds.length} selected of {rows.length} receipts.</p>
              <Button type="button" onClick={handleSubmit} disabled={submitting || selectedIds.length === 0}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
                Submit cancellation
              </Button>
            </div>
          )
        }
      >
        <Table className="min-w-[1280px]">
          <TableHeader>
            <TableRow className="bg-slate-100 text-xs uppercase text-slate-700 hover:bg-slate-100">
              <TableHead className="w-10">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 accent-[var(--primary-blue)]"
                  checked={allRowsSelected}
                  onChange={(event) => toggleAllRows(event.target.checked)}
                  aria-label="Select all receipts"
                />
              </TableHead>
              <TableHead>Student</TableHead>
              <TableHead>GR no</TableHead>
              <TableHead>Standard</TableHead>
              <TableHead>Division</TableHead>
              <TableHead>Mobile</TableHead>
              <TableHead>Quota</TableHead>
              <TableHead>Other fees head</TableHead>
              <TableHead className="text-right">Paid amount</TableHead>
              <TableHead>Receipt no</TableHead>
              <TableHead>Date of cancel</TableHead>
              <TableHead>Reason of cancel</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <LoadingRows colSpan={12} label="Loading other fees receipts" />
            ) : rows.length > 0 ? (
              rows.map((row) => {
                const selected = selectedIds.includes(row.id);
                const values = inputs[row.id] ?? { date: '', reason: '' };
                return (
                  <TableRow key={row.id} className="odd:bg-white even:bg-slate-50/70">
                    <TableCell>
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300 accent-[var(--primary-blue)]"
                        checked={selected}
                        onChange={(event) => toggleRow(row.id, event.target.checked)}
                        aria-label={`Select receipt ${row.receiptNo}`}
                      />
                    </TableCell>
                    <TableCell className="font-semibold text-slate-950">{row.studentName || '-'}</TableCell>
                    <TableCell>{row.enrollmentNo || '-'}</TableCell>
                    <TableCell>{row.standardName || '-'}</TableCell>
                    <TableCell>{row.divisionName || '-'}</TableCell>
                    <TableCell>{row.mobile || '-'}</TableCell>
                    <TableCell>{row.studentQuota || '-'}</TableCell>
                    <TableCell>{row.headName || '-'}</TableCell>
                    <TableCell className="text-right font-semibold">{formatCurrency(row.amount)}</TableCell>
                    <TableCell>
                      <Button type="button" size="sm" variant="outline" onClick={() => setPreviewHtml(row.receiptHtml)} disabled={!row.receiptHtml}>
                        <Eye className="h-3.5 w-3.5" />
                        {row.receiptNo || 'View'}
                      </Button>
                    </TableCell>
                    <TableCell className="min-w-40">
                      <Input
                        type="date"
                        value={values.date}
                        onChange={(event) => updateInput(row.id, 'date', event.target.value)}
                        disabled={!selected}
                      />
                    </TableCell>
                    <TableCell className="min-w-56">
                      <Input
                        value={values.reason}
                        onChange={(event) => updateInput(row.id, 'reason', event.target.value)}
                        placeholder="Please enter cancel reason"
                        disabled={!selected}
                      />
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <EmptyTableRow colSpan={12} label={hasSearched ? 'No other-fee receipts match the current search.' : 'Search to load paid other-fee receipts.'} />
            )}
          </TableBody>
        </Table>
      </SectionPanel>

      {previewHtml && (
        <ReceiptPreviewModal
          title="Other fees receipt"
          html={previewHtml}
          onClose={() => setPreviewHtml('')}
        />
      )}
    </PageFrame>
  );
}

function appendIfValue(params: URLSearchParams, key: string, value: string) {
  if (value) params.set(key, value);
}

function getSingleValue(value: DropdownValue | undefined): string {
  if (Array.isArray(value)) return value[0] || '';
  return value || '';
}

function toOtherFeesTitles(value: unknown): OtherFeesTitle[] {
  return toArray(value).map((item) => {
    const record = asRecord(item);
    return {
      id: readFirstString(record, ['id', 'other_fees_title_id']),
      label: readFirstString(record, ['display_name', 'title', 'name']),
    };
  }).filter((title) => title.id && title.label);
}

function toCancelRows(value: unknown): OtherFeesCancelRow[] {
  return toArray(value).map((item) => {
    const record = asRecord(item);
    return {
      id: readFirstString(record, ['id', 'fees_other_collection_id']),
      studentId: readFirstString(record, ['student_id']),
      studentName: readFirstString(record, ['stu_name', 'student_name', 'name']),
      enrollmentNo: readFirstString(record, ['enrollment_no', 'gr_no']),
      standardName: readFirstString(record, ['std_name', 'standard_name']),
      divisionName: readFirstString(record, ['div_name', 'division_name']),
      mobile: readFirstString(record, ['mobile', 'mobile_no']),
      studentQuota: readFirstString(record, ['stu_quota', 'student_quota']),
      headName: readFirstString(record, ['display_name', 'head_name']),
      amount: readNumber(record.deduction_amount ?? record.amount),
      receiptNo: readFirstString(record, ['receipt_id', 'receipt_no']),
      receiptHtml: readString(record.paid_fees_html),
    };
  }).filter((row) => row.id);
}

function validateCancelRows(rows: OtherFeesCancelRow[], inputs: CancelInputs): string {
  if (rows.length === 0) return 'Please select at least one receipt.';

  for (const row of rows) {
    const values = inputs[row.id];
    if (!values?.date) return `Please enter date of cancel for receipt ${row.receiptNo}.`;
    if (!values.reason.trim()) return `Please enter reason of cancel for receipt ${row.receiptNo}.`;
  }

  return '';
}
