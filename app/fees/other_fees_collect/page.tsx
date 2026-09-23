'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Banknote, Loader2, ReceiptText, Search } from 'lucide-react';

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
  fetchLaravelJson,
  formatCurrency,
  getFeesSession,
  readFirstString,
  readNumber,
  readString,
  todayIsoDate,
  toArray,
  toSelectOptions,
  type ApiStatusPayload,
  type FeesSession,
  type SelectOption,
} from '@/app/fees/_lib/fees-api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

type OtherFeesTitle = {
  id: string;
  label: string;
  amount: number;
};

type OtherFeesStudentRow = {
  studentId: string;
  studentName: string;
  enrollmentNo: string;
  standardName: string;
  divisionName: string;
  mobile: string;
  studentQuota: string;
  paidAmount: number;
  remainingAmount: number;
  defaultAmount: number;
};

type OtherFeesCollectResponse = ApiStatusPayload & {
  other_fees_title?: unknown;
  student_data?: unknown;
  bank_data?: unknown;
  other_fees_title_selected?: unknown;
  get_amount_of_head?: unknown;
  get_name_of_head?: unknown;
  str?: unknown;
  last_inserted_ids?: unknown;
};

type PaymentMode = 'Cash' | 'Cheque' | 'DD' | 'Online' | 'From Imprest';

const academicFields: DropdownField[] = ['section', 'standard', 'division'];
const paymentModes: PaymentMode[] = ['Cash', 'Cheque', 'DD', 'Online', 'From Imprest'];

export default function OtherFeesCollectPage() {
  const [session, setSession] = useState<FeesSession>(() => getFeesSession());
  const [academicFilters, setAcademicFilters] = useState<Partial<SearchDropdownValues>>({
    section: '',
    standard: '',
    division: '',
  });
  const [titles, setTitles] = useState<OtherFeesTitle[]>([]);
  const [banks, setBanks] = useState<SelectOption[]>([]);
  const [selectedTitleId, setSelectedTitleId] = useState('');
  const [selectedTitleName, setSelectedTitleName] = useState('');
  const [defaultHeadAmount, setDefaultHeadAmount] = useState(0);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [enrollmentNo, setEnrollmentNo] = useState('');
  const [mobileNo, setMobileNo] = useState('');
  const [uniqueId, setUniqueId] = useState('');
  const [rows, setRows] = useState<OtherFeesStudentRow[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [bulkAmount, setBulkAmount] = useState('');
  const [deductionDate, setDeductionDate] = useState(todayIsoDate());
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('Cash');
  const [remarks, setRemarks] = useState('');
  const [bankName, setBankName] = useState('');
  const [bankBranch, setBankBranch] = useState('N/A');
  const [chequeNo, setChequeNo] = useState('N/A');
  const [chequeDate, setChequeDate] = useState(todayIsoDate());
  const [loadingTitles, setLoadingTitles] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [receiptHtml, setReceiptHtml] = useState('');
  const [hasSearched, setHasSearched] = useState(false);

  const selectedTitle = useMemo(() => titles.find((title) => title.id === selectedTitleId), [selectedTitleId, titles]);
  const selectedRows = useMemo(() => rows.filter((row) => selectedStudentIds.includes(row.studentId)), [rows, selectedStudentIds]);
  const totalSelectedAmount = useMemo(() => {
    return selectedRows.reduce((total, row) => total + readNumber(amounts[row.studentId]), 0);
  }, [amounts, selectedRows]);
  const allEligibleRowsSelected = rows.length > 0 && rows.filter(isRowCollectable).every((row) => selectedStudentIds.includes(row.studentId));

  const loadTitles = useCallback(async (nextSession: FeesSession) => {
    if (!nextSession.subInstituteId || !nextSession.academicYearId) {
      setMessage({ type: 'error', text: 'Session institute or academic year is missing.' });
      return;
    }

    setLoadingTitles(true);
    try {
      const params = new URLSearchParams();
      appendSessionParams(params, nextSession);
      const payload = await fetchLaravelJson<OtherFeesCollectResponse>(nextSession, buildLaravelProxyUrl('fees/other_fees_collect', params));
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

  const handleAcademicChange = (values: SearchDropdownValues) => {
    setAcademicFilters(values);
  };

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
    setMessage(null);
    setHasSearched(true);
    setRows([]);
    setSelectedStudentIds([]);
    setAmounts({});
    setReceiptHtml('');

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

      const payload = await fetchLaravelJson<OtherFeesCollectResponse>(currentSession, buildLaravelProxyUrl('fees/other_fees_collect/create', params));
      const nextRows = toStudentRows(payload.student_data, readNumber(payload.get_amount_of_head || selectedTitle?.amount));
      const headName = readString(payload.get_name_of_head) || selectedTitle?.label || '';
      const headAmount = readNumber(payload.get_amount_of_head || selectedTitle?.amount);

      setRows(nextRows);
      setBanks(toSelectOptions(payload.bank_data, ['bank_name', 'id'], ['bank_name', 'name']));
      setSelectedTitleName(headName);
      setDefaultHeadAmount(headAmount);
      setBulkAmount(String(headAmount || ''));
      setAmounts(Object.fromEntries(nextRows.map((row) => [row.studentId, String(row.defaultAmount || '')])));
      setMessage({ type: 'success', text: payload.message || `Loaded ${nextRows.length} student${nextRows.length === 1 ? '' : 's'}.` });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Unable to search other fees students.' });
    } finally {
      setLoading(false);
    }
  };

  const toggleEligibleRows = (checked: boolean) => {
    setSelectedStudentIds(checked ? rows.filter(isRowCollectable).map((row) => row.studentId) : []);
  };

  const toggleStudent = (studentId: string, checked: boolean) => {
    setSelectedStudentIds((current) => checked ? [...new Set([...current, studentId])] : current.filter((id) => id !== studentId));
  };

  const applyBulkAmount = () => {
    setAmounts((current) => {
      const next = { ...current };
      rows.filter(isRowCollectable).forEach((row) => {
        next[row.studentId] = bulkAmount;
      });
      return next;
    });
  };

  const handleSubmit = async () => {
    const currentSession = getFeesSession();
    setSession(currentSession);

    const validationError = validateSubmission(selectedRows, amounts, paymentMode, bankName, chequeNo);
    if (validationError) {
      setMessage({ type: 'error', text: validationError });
      return;
    }

    setSubmitting(true);
    setMessage(null);
    setReceiptHtml('');

    try {
      const form = new FormData();
      appendSessionFormData(form, currentSession);
      form.set('division_id', getSingleValue(academicFilters.division));
      form.set('standard_id', getSingleValue(academicFilters.standard));
      form.set('other_fees_title', selectedTitleId);
      form.set('other_fees_title_name', selectedTitleName || selectedTitle?.label || '');
      form.set('deduction_date', deductionDate);
      form.set('payment_mode', paymentMode);
      form.set('remarks', remarks.trim());
      form.set('bank_name', paymentMode === 'Cash' ? '' : bankName);
      form.set('bank_branch', paymentMode === 'Cash' ? 'N/A' : bankBranch);
      form.set('cheque_no', paymentMode === 'Cash' ? 'N/A' : chequeNo);
      form.set('cheque_date', chequeDate);

      selectedRows.forEach((row) => {
        form.append('students[]', row.studentId);
        form.set(`amount_of_deduction[${row.studentId}]`, String(readNumber(amounts[row.studentId])));
      });

      const payload = await fetchLaravelJson<OtherFeesCollectResponse>(currentSession, buildLaravelProxyUrl('fees/other_fees_collect'), {
        method: 'POST',
        body: form,
      });

      const html = readString(payload.str);
      setReceiptHtml(html);
      setSelectedStudentIds([]);
      setMessage({ type: 'success', text: payload.message || 'Other fees collected successfully.' });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Unable to collect other fees.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageFrame>
      <PageHeader
        title="Other fees collect"
        description="Search students by other fees head, select eligible rows, and collect the amount through Laravel."
        action={
          <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-right">
            <p className="text-xs font-medium text-emerald-700">Selected value</p>
            <p className="text-lg font-bold text-emerald-900">{formatCurrency(totalSelectedAmount)}</p>
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
              onChange={handleAcademicChange}
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
        <SectionPanel title="Collection details" description={selectedTitleName ? `Selected head: ${selectedTitleName}` : undefined}>
          <div className="grid gap-3 lg:grid-cols-4">
            <Field label="Date of deduction">
              <Input type="date" value={deductionDate} onChange={(event) => setDeductionDate(event.target.value)} />
            </Field>
            <Field label="Payment mode">
              <NativeSelect value={paymentMode} onChange={(value) => setPaymentMode(value as PaymentMode)} required>
                {paymentModes.map((mode) => (
                  <option key={mode} value={mode}>{mode}</option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Bank name">
              <NativeSelect value={bankName} onChange={setBankName} disabled={paymentMode === 'Cash'}>
                <option value="">Select bank</option>
                {banks.map((bank) => (
                  <option key={`${bank.id}-${bank.label}`} value={bank.label}>{bank.label}</option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Bank branch">
              <Input value={bankBranch} onChange={(event) => setBankBranch(event.target.value)} disabled={paymentMode === 'Cash'} />
            </Field>
            <Field label="Cheque/DD no">
              <Input value={chequeNo} onChange={(event) => setChequeNo(event.target.value)} disabled={paymentMode === 'Cash'} />
            </Field>
            <Field label="Cheque/DD date">
              <Input type="date" value={chequeDate} onChange={(event) => setChequeDate(event.target.value)} disabled={paymentMode === 'Cash'} />
            </Field>
            <Field label="Bulk amount">
              <div className="flex gap-2">
                <Input type="number" min="0" value={bulkAmount} onChange={(event) => setBulkAmount(event.target.value)} placeholder={String(defaultHeadAmount || '')} />
                <Button type="button" variant="outline" onClick={applyBulkAmount}>Apply</Button>
              </div>
            </Field>
            <Field label="Remarks">
              <Textarea value={remarks} onChange={(event) => setRemarks(event.target.value)} placeholder="Remarks if any" className="min-h-10" />
            </Field>
          </div>
        </SectionPanel>
      )}

      <SectionPanel
        title="Students"
        footer={
          rows.length > 0 && (
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <p className="text-sm text-slate-600">
                {selectedStudentIds.length} selected of {rows.filter(isRowCollectable).length} eligible students.
              </p>
              <Button type="button" onClick={handleSubmit} disabled={submitting || selectedStudentIds.length === 0}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ReceiptText className="h-4 w-4" />}
                Submit
              </Button>
            </div>
          )
        }
      >
        <Table className="min-w-[1120px]">
          <TableHeader>
            <TableRow className="bg-slate-100 text-xs uppercase text-slate-700 hover:bg-slate-100">
              <TableHead className="w-10">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 accent-[var(--primary-blue)]"
                  checked={allEligibleRowsSelected}
                  onChange={(event) => toggleEligibleRows(event.target.checked)}
                  aria-label="Select eligible students"
                />
              </TableHead>
              <TableHead>Student</TableHead>
              <TableHead>GR no</TableHead>
              <TableHead>Standard</TableHead>
              <TableHead>Division</TableHead>
              <TableHead>Mobile</TableHead>
              <TableHead>Quota</TableHead>
              <TableHead className="text-right">Paid</TableHead>
              <TableHead className="text-right">Remaining</TableHead>
              <TableHead>Amount of deduction</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <LoadingRows colSpan={10} label="Loading other fees students" />
            ) : rows.length > 0 ? (
              rows.map((row) => {
                const collectable = isRowCollectable(row);
                const selected = selectedStudentIds.includes(row.studentId);
                return (
                  <TableRow key={row.studentId} className="odd:bg-white even:bg-slate-50/70">
                    <TableCell>
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300 accent-[var(--primary-blue)] disabled:opacity-40"
                        checked={selected}
                        disabled={!collectable}
                        onChange={(event) => toggleStudent(row.studentId, event.target.checked)}
                        aria-label={`Select ${row.studentName}`}
                      />
                    </TableCell>
                    <TableCell className="font-semibold text-slate-950">{row.studentName || '-'}</TableCell>
                    <TableCell>{row.enrollmentNo || '-'}</TableCell>
                    <TableCell>{row.standardName || '-'}</TableCell>
                    <TableCell>{row.divisionName || '-'}</TableCell>
                    <TableCell>{row.mobile || '-'}</TableCell>
                    <TableCell>{row.studentQuota || '-'}</TableCell>
                    <TableCell className="text-right">{formatCurrency(row.paidAmount)}</TableCell>
                    <TableCell className="text-right font-semibold">{formatCurrency(row.remainingAmount)}</TableCell>
                    <TableCell className="min-w-44">
                      {collectable ? (
                        <Input
                          type="number"
                          min="0"
                          value={amounts[row.studentId] ?? ''}
                          onChange={(event) => setAmounts((current) => ({ ...current, [row.studentId]: event.target.value }))}
                          disabled={!selected}
                        />
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">
                          <Banknote className="h-3 w-3" />
                          Already paid
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <EmptyTableRow colSpan={10} label={hasSearched ? 'No students match the current search.' : 'Search to load students.'} />
            )}
          </TableBody>
        </Table>
      </SectionPanel>

      {receiptHtml && (
        <ReceiptPreviewModal
          title="Other fees receipt"
          html={receiptHtml}
          onClose={() => setReceiptHtml('')}
        />
      )}
    </PageFrame>
  );
}

function buildLaravelProxyUrl(path: string, params?: URLSearchParams) {
  const query = new URLSearchParams();
  query.set('path', path);
  params?.forEach((value, key) => query.append(key, value));
  return `/api/proxy?${query.toString()}`;
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
    const id = readFirstString(record, ['id', 'other_fees_title_id']);
    const label = readFirstString(record, ['display_name', 'title', 'name']);
    return {
      id,
      label,
      amount: readNumber(record.amount),
    };
  }).filter((title) => title.id && title.label);
}

function toStudentRows(value: unknown, defaultAmount: number): OtherFeesStudentRow[] {
  return toArray(value).map((item) => {
    const record = asRecord(item);
    const studentId = readFirstString(record, ['student_id', 'id']);
    const remainingAmount = readNumber(record.remaining_amt ?? record.remaining_amount ?? record.remaining);

    return {
      studentId,
      studentName: readFirstString(record, ['student_name', 'name']),
      enrollmentNo: readFirstString(record, ['enrollment_no', 'gr_no']),
      standardName: readFirstString(record, ['standard_name', 'std_name']),
      divisionName: readFirstString(record, ['division_name', 'div_name']),
      mobile: readFirstString(record, ['mobile', 'mobile_no']),
      studentQuota: readFirstString(record, ['stu_quota', 'student_quota']),
      paidAmount: readNumber(record.paid_amt ?? record.paid_amount),
      remainingAmount,
      defaultAmount: remainingAmount > 0 ? Math.min(defaultAmount || remainingAmount, remainingAmount) : 0,
    };
  }).filter((row) => row.studentId);
}

function isRowCollectable(row: OtherFeesStudentRow): boolean {
  return row.remainingAmount > 0;
}

function validateSubmission(rows: OtherFeesStudentRow[], amounts: Record<string, string>, paymentMode: PaymentMode, bankName: string, chequeNo: string): string {
  if (rows.length === 0) return 'Please select at least one student.';

  for (const row of rows) {
    const amount = readNumber(amounts[row.studentId]);
    if (amount <= 0) return `Please enter amount of deduction for ${row.studentName || row.enrollmentNo}.`;
    if (row.remainingAmount > 0 && amount > row.remainingAmount) return `Amount for ${row.studentName || row.enrollmentNo} cannot be more than remaining fees.`;
  }

  if (paymentMode === 'Cheque' || paymentMode === 'DD') {
    if (!bankName.trim()) return 'Please select bank name.';
    if (!chequeNo.trim() || chequeNo.trim() === 'N/A') return 'Please enter cheque/DD number.';
  }

  return '';
}
