'use client';
/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Search } from 'lucide-react';

import {
  EmptyTableRow,
  Field,
  InlineMessage,
  LoadingRows,
  NativeSelect,
  PageFrame,
  PageHeader,
  SectionPanel,
} from '@/app/fees/_components/fees-shared';
import {
  PaginationFooter,
  ReportActions,
  ReportSummaryBar,
  SummaryChip,
} from '@/app/fees/_components/fees-report-shared';
import {
  REPORT_PAGE_SIZE,
  appendIfValue,
  buildMonthMap,
  fetchFeesCollectionReportGet,
  fetchFeesCollectionReportIndex,
  formatDateDisplay,
  formatPlainAmount,
  getPaymentModes,
  paginateRows,
  readArrayRecords,
  type ReportApiPayload,
  type ReportMessage,
} from '@/app/fees/_lib/fees-report-utils';
import {
  readNumber,
  readString,
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
  type SearchDropdownValues,
} from '@/components/search-dropdown';
import {
  exportRowsAsCsv,
  exportRowsAsExcel,
  exportRowsAsPdf,
  openPrintPreview,
  type TableExportColumn,
  type TableExportRow,
} from '@/lib/table-export';

type UserOption = {
  id: string;
  label: string;
};

type FeesCollectionRow = {
  studentId: string;
  enrollmentNo: string;
  studentName: string;
  standardName: string;
  divisionName: string;
  batch: string;
  quota: string;
  uniqueId: string;
  monthLabel: string;
  receiptNo: string;
  paymentMode: string;
  chequeNo: string;
  bankName: string;
  bankBranch: string;
  chequeDate: string;
  remarks: string;
  receiptDate: string;
  collectedBy: string;
  amountPaid: number;
};

type FeesCollectionPayload = ReportApiPayload & {
  get_users?: unknown;
  fees_data?: unknown;
  months?: unknown;
  syear?: unknown;
  data?: unknown;
};

const academicFields: DropdownField[] = ['section', 'standard', 'division'];

export default function FeesCollectionReportPage() {
  const [message, setMessage] = useState<ReportMessage | null>(null);
  const [loadingFilters, setLoadingFilters] = useState(true);
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [rows, setRows] = useState<FeesCollectionRow[]>([]);
  const [page, setPage] = useState(1);
  const [hasSearched, setHasSearched] = useState(false);
  const [academicFilters, setAcademicFilters] = useState<Partial<SearchDropdownValues>>({
    section: '',
    standard: '',
    division: '',
  });
  const [enrollmentNo, setEnrollmentNo] = useState('');
  const [studentName, setStudentName] = useState('');
  const [mobileNo, setMobileNo] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [paymentMode, setPaymentMode] = useState('');
  const [userId, setUserId] = useState('');
  const [groupBankDetails, setGroupBankDetails] = useState(false);
  const [separateDetails, setSeparateDetails] = useState(false);
  const [subInstituteId, setSubInstituteId] = useState('');
  const [academicYearId, setAcademicYearId] = useState('');

  const paymentModes = useMemo(() => getPaymentModes(subInstituteId), [subInstituteId]);
  const pagination = useMemo(() => paginateRows(rows, page, REPORT_PAGE_SIZE), [page, rows]);
  const totalAmount = useMemo(() => rows.reduce((sum, row) => sum + row.amountPaid, 0), [rows]);
  const paymentSummary = useMemo(() => {
    const grouped = new Map<string, { amount: number; students: Set<string> }>();
    rows.forEach((row) => {
      const current = grouped.get(row.paymentMode) ?? { amount: 0, students: new Set<string>() };
      current.amount += row.amountPaid;
      current.students.add(`${row.studentId}-${row.studentName}`);
      grouped.set(row.paymentMode, current);
    });
    return Array.from(grouped.entries()).map(([mode, value]) => ({
      mode,
      amount: value.amount,
      studentCount: value.students.size,
    }));
  }, [rows]);

  const exportColumns = useMemo<TableExportColumn[]>(() => [
    { key: 'enrollmentNo', label: 'GR No' },
    { key: 'studentName', label: 'Student name', width: '220px' },
    { key: 'standardDivision', label: separateDetails ? 'Standard / Division' : 'Std / Div' },
    { key: 'quota', label: 'Quota' },
    { key: 'uniqueId', label: 'Unique ID' },
    { key: 'monthLabel', label: 'Month', width: '200px' },
    { key: 'receiptNo', label: 'Receipt no' },
    { key: 'paymentMode', label: 'Payment mode' },
    { key: 'bankDetails', label: groupBankDetails ? 'Bank fields' : 'Bank details', width: '220px' },
    { key: 'remarks', label: 'Remarks', width: '220px' },
    { key: 'receiptDate', label: 'Receipt date' },
    { key: 'collectedBy', label: 'Collected by' },
    { key: 'amountPaid', label: 'Amount', align: 'right' },
  ], [groupBankDetails, separateDetails]);

  const exportRows = useMemo<TableExportRow[]>(() => rows.map((row) => ({
    enrollmentNo: row.enrollmentNo,
    studentName: row.studentName,
    standardDivision: `${row.standardName} / ${row.divisionName}${row.batch ? ` / ${row.batch}` : ''}`,
    quota: row.quota,
    uniqueId: row.uniqueId,
    monthLabel: row.monthLabel,
    receiptNo: row.receiptNo,
    paymentMode: row.paymentMode,
    bankDetails: groupBankDetails
      ? `Cheque: ${row.chequeNo} | Bank: ${row.bankName} | Branch: ${row.bankBranch} | Date: ${row.chequeDate}`
      : `${row.chequeNo} ${row.bankName} ${row.bankBranch}`.trim(),
    remarks: row.remarks,
    receiptDate: row.receiptDate,
    collectedBy: row.collectedBy,
    amountPaid: formatPlainAmount(row.amountPaid),
  })), [groupBankDetails, rows]);

  const loadFilters = useCallback(async () => {
    setLoadingFilters(true);
    try {
      const { session, payload } = await fetchFeesCollectionReportIndex<FeesCollectionPayload>();
      const source = getFeesCollectionSource(payload);
      setSubInstituteId(session.subInstituteId);
      setAcademicYearId(session.academicYearId);
      setUsers(
        readArrayRecords(source.get_users).map((record) => ({
          id: readString(record.id),
          label: readString(record.user_name),
        })).filter((item) => item.id && item.label)
      );
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Unable to load fees collection report filters.',
      });
    } finally {
      setLoadingFilters(false);
    }
  }, []);

  useEffect(() => {
    void loadFilters();
  }, [loadFilters]);

  const handleSearch = async () => {
    setLoading(true);
    setHasSearched(true);
    setPage(1);
    setMessage(null);
    try {
      const params = new URLSearchParams();
      appendIfValue(params, 'enrollment_no', enrollmentNo);
      appendIfValue(params, 'name', studentName);
      appendIfValue(params, 'mb_no', mobileNo);
      appendAcademicParams(params, academicFilters);
      appendIfValue(params, 'from_date', fromDate);
      appendIfValue(params, 'to_date', toDate);
      appendIfValue(params, 'payment_mode', paymentMode);
      appendIfValue(params, 'user_name', userId);
      if (groupBankDetails) params.set('groupby', 'on');
      if (separateDetails) params.set('seprateDetails', 'on');

      const { session, payload } = await fetchFeesCollectionReportGet<FeesCollectionPayload>(params);
      const source = getFeesCollectionSource(payload);
      setSubInstituteId(session.subInstituteId);
      setAcademicYearId(session.academicYearId);
      const monthMap = buildMonthMap(source.months);
      const mappedRows = readArrayRecords(source.fees_data).map((record) =>
        mapFeesCollectionRow(record, monthMap, session.academicYearId)
      );
      setRows(mappedRows);
      setUsers(
        readArrayRecords(source.get_users).map((record) => ({
          id: readString(record.id),
          label: readString(record.user_name),
        })).filter((item) => item.id && item.label)
      );
      setMessage({
        type: mappedRows.length > 0 ? 'success' : 'info',
        text: payload.message || (mappedRows.length > 0 ? `Loaded ${mappedRows.length} receipt row${mappedRows.length === 1 ? '' : 's'}.` : 'No fees collection rows found.'),
      });
    } catch (error) {
      setRows([]);
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Unable to fetch fees collection report.',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (loadingFilters || hasSearched) {
      return;
    }
    const timer = window.setTimeout(() => {
      void handleSearch();
    }, 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasSearched, loadingFilters]);

  return (
    <PageFrame>
      <PageHeader
        title="Fees Collection Report"
        description="Review collected regular and other-fee receipts with payment summaries and export actions."
        action={
          <ReportActions
            onExportCsv={() => exportRowsAsCsv({ filename: 'fees-collection-report.csv', columns: exportColumns, rows: exportRows })}
            onExportExcel={() => exportRowsAsExcel({ filename: 'fees-collection-report.xls', title: 'Fees Collection Report', columns: exportColumns, rows: exportRows })}
            onExportPdf={() => exportRowsAsPdf({ filename: 'fees-collection-report.pdf', title: 'Fees Collection Report', subtitle: `Academic year ${academicYearId || '-'}`, columns: exportColumns, rows: exportRows })}
            onPrint={() => openPrintPreview({ title: 'Fees Collection Report', subtitle: `Academic year ${academicYearId || '-'}`, columns: exportColumns, rows: exportRows })}
          />
        }
      />

      {message && <InlineMessage type={message.type} text={message.text} />}

      <SectionPanel title="Filters">
        <div className="grid gap-3 lg:grid-cols-4">
          <div className="lg:col-span-4">
            <SearchDropdown
              fields={academicFields}
              values={academicFilters}
              onChange={(values) => setAcademicFilters(values)}
            />
          </div>
          <Field label="GR no">
            <Input value={enrollmentNo} onChange={(event) => setEnrollmentNo(event.target.value)} placeholder="GR number" />
          </Field>
          <Field label="Student name">
            <Input value={studentName} onChange={(event) => setStudentName(event.target.value)} placeholder="Student name" />
          </Field>
          <Field label="Mobile number">
            <Input value={mobileNo} onChange={(event) => setMobileNo(event.target.value)} placeholder="Mobile number" />
          </Field>
          <Field label="Payment mode">
            <NativeSelect value={paymentMode} onChange={setPaymentMode} disabled={loadingFilters}>
              <option value="">Select payment mode</option>
              {paymentModes.map((mode) => (
                <option key={mode.value} value={mode.value}>{mode.label}</option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Collected by">
            <NativeSelect value={userId} onChange={setUserId} disabled={loadingFilters}>
              <option value="">Select collector</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>{user.label}</option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="From date">
            <Input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
          </Field>
          <Field label="To date">
            <Input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
          </Field>
          <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <input type="checkbox" checked={groupBankDetails} onChange={(event) => setGroupBankDetails(event.target.checked)} className="h-4 w-4 rounded border-slate-300 accent-[var(--primary-blue)]" />
              Separate bank details
            </label>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <input type="checkbox" checked={separateDetails} onChange={(event) => setSeparateDetails(event.target.checked)} className="h-4 w-4 rounded border-slate-300 accent-[var(--primary-blue)]" />
              Separate student details
            </label>
          </div>
          <div className="flex items-end">
            <Button type="button" className="h-10 w-full" onClick={handleSearch} disabled={loading || loadingFilters}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Search
            </Button>
          </div>
        </div>
      </SectionPanel>

      <SectionPanel
        title="Results"
        description="Legacy parity includes receipt grouping, month labels, bank details, and payment-mode totals."
        footer={<PaginationFooter pagination={pagination} onPageChange={setPage} />}
      >
        {rows.length > 0 && (
          <ReportSummaryBar>
            <SummaryChip label="Total receipts" value={String(rows.length)} />
            <SummaryChip label="Total amount" value={formatPlainAmount(totalAmount)} />
            {paymentSummary.map((item) => (
              <SummaryChip key={item.mode} label={`${item.mode} students`} value={`${item.studentCount} / ${formatPlainAmount(item.amount)}`} />
            ))}
          </ReportSummaryBar>
        )}

        <div className="mt-4">
          <Table className="min-w-[1480px]">
            <TableHeader>
              <TableRow className="bg-slate-100 text-xs uppercase text-slate-700 hover:bg-slate-100">
                <TableHead>Sr no</TableHead>
                <TableHead>GR no</TableHead>
                <TableHead>Student name</TableHead>
                <TableHead>{separateDetails ? 'Standard' : 'Std / Div'}</TableHead>
                {separateDetails && <TableHead>Division</TableHead>}
                <TableHead>Batch</TableHead>
                <TableHead>Quota</TableHead>
                <TableHead>Unique ID</TableHead>
                <TableHead>Month</TableHead>
                <TableHead>Receipt no</TableHead>
                <TableHead>Payment mode</TableHead>
                {groupBankDetails ? (
                  <>
                    <TableHead>Cheque no</TableHead>
                    <TableHead>Bank name</TableHead>
                    <TableHead>Bank branch</TableHead>
                    <TableHead>Cheque date</TableHead>
                  </>
                ) : (
                  <TableHead>Bank details</TableHead>
                )}
                <TableHead>Remarks</TableHead>
                <TableHead>Receipt date</TableHead>
                <TableHead>Collected by</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <LoadingRows colSpan={groupBankDetails ? 19 : 16} label="Loading fees collection report" />
              ) : pagination.rows.length > 0 ? (
                pagination.rows.map((row, index) => (
                  <TableRow key={`${row.receiptNo}-${row.studentId}-${index}`} className="odd:bg-white even:bg-slate-50/70">
                    <TableCell>{pagination.startIndex + index}</TableCell>
                    <TableCell>{row.enrollmentNo || '-'}</TableCell>
                    <TableCell className="font-semibold text-slate-950">{row.studentName || '-'}</TableCell>
                    <TableCell>{separateDetails ? row.standardName || '-' : `${row.standardName || '-'} / ${row.divisionName || '-'}`}</TableCell>
                    {separateDetails && <TableCell>{row.divisionName || '-'}</TableCell>}
                    <TableCell>{row.batch || '-'}</TableCell>
                    <TableCell>{row.quota || '-'}</TableCell>
                    <TableCell>{row.uniqueId || '-'}</TableCell>
                    <TableCell>{row.monthLabel || '-'}</TableCell>
                    <TableCell>{row.receiptNo || '-'}</TableCell>
                    <TableCell>{row.paymentMode || '-'}</TableCell>
                    {groupBankDetails ? (
                      <>
                        <TableCell>{row.chequeNo || '-'}</TableCell>
                        <TableCell>{row.bankName || '-'}</TableCell>
                        <TableCell>{row.bankBranch || '-'}</TableCell>
                        <TableCell>{row.chequeDate || '-'}</TableCell>
                      </>
                    ) : (
                      <TableCell>{`${row.chequeNo} ${row.bankName} ${row.bankBranch}`.trim() || '-'}</TableCell>
                    )}
                    <TableCell>{row.remarks || '-'}</TableCell>
                    <TableCell>{row.receiptDate || '-'}</TableCell>
                    <TableCell>{row.collectedBy || '-'}</TableCell>
                    <TableCell className="text-right font-semibold">{formatPlainAmount(row.amountPaid)}</TableCell>
                  </TableRow>
                ))
              ) : (
                <EmptyTableRow
                  colSpan={groupBankDetails ? 19 : 16}
                  label={hasSearched ? 'No fees collection rows match the current filters.' : 'Search to load the fees collection report.'}
                />
              )}
            </TableBody>
          </Table>
        </div>
      </SectionPanel>
    </PageFrame>
  );
}

function appendAcademicParams(params: URLSearchParams, filters: Partial<SearchDropdownValues>) {
  const grade = getSingleValue(filters.section);
  const standard = getSingleValue(filters.standard);
  const division = getSingleValue(filters.division);
  if (grade) params.append('grade[]', grade);
  if (standard) params.append('standard[]', standard);
  if (division) params.append('division[]', division);
}

function getSingleValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] || '';
  return value || '';
}

function getFeesCollectionSource(payload: FeesCollectionPayload): FeesCollectionPayload {
  const nested = payload.data;
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    return {
      ...payload,
      ...(nested as Record<string, unknown>),
    };
  }

  if (Array.isArray(nested) && (payload.fees_data == null || readArrayRecords(payload.fees_data).length === 0)) {
    return {
      ...payload,
      fees_data: nested,
    };
  }

  return payload;
}

function mapFeesCollectionRow(record: Record<string, unknown>, monthMap: Record<string, string>, sessionYear: string): FeesCollectionRow {
  const termIds = readString(record.term_ids).split(',').map((value) => value.trim()).filter(Boolean);
  const monthLabel = termIds.map((termId) => monthMap[termId] || fallbackMonthLabel(termId)).join(', ');
  const rowYear = readString(record.syear);
  const remarks = rowYear && sessionYear && rowYear !== sessionYear
    ? `${rowYear} - ${readString(record.remarks)}`
    : readString(record.remarks);

  return {
    studentId: readString(record.student_id),
    enrollmentNo: readString(record.enrollment_no),
    studentName: readString(record.student_name),
    standardName: readString(record.standard_name),
    divisionName: readString(record.division_name),
    batch: `${readString(record.batch)} ${readString(record.place_of_birth)}`.trim(),
    quota: readString(record.quota),
    uniqueId: readString(record.uniqueid),
    monthLabel,
    receiptNo: readString(record.receipt_no),
    paymentMode: readString(record.payment_mode),
    chequeNo: readString(record.cheque_no),
    bankName: readString(record.cheque_bank_name),
    bankBranch: readString(record.bank_branch),
    chequeDate: formatDateDisplay(record.cheque_date),
    remarks,
    receiptDate: formatDateDisplay(record.receiptdate),
    collectedBy: readString(record.user_name),
    amountPaid: readNumber(record.actual_amountpaid),
  };
}

function fallbackMonthLabel(termId: string): string {
  if (!termId) return '';
  const year = termId.slice(-4);
  const month = Number(termId.slice(0, termId.length - 4));
  const labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return month >= 1 && month <= 12 ? `${labels[month - 1]}/${year}` : termId;
}
