'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, Search } from 'lucide-react';

import {
  EmptyTableRow,
  Field,
  InlineMessage,
  LoadingRows,
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
  fetchFeesTypeWiseReportGet,
  formatPlainAmount,
  paginateRows,
  readArrayRecords,
  type ReportApiPayload,
  type ReportMessage,
} from '@/app/fees/_lib/fees-report-utils';
import { readNumber, readString } from '@/app/fees/_lib/fees-api';
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
import { SearchDropdown, type DropdownField, type SearchDropdownValues } from '@/components/search-dropdown';
import { exportRowsAsCsv, exportRowsAsExcel, exportRowsAsPdf, openPrintPreview, type TableExportColumn, type TableExportRow } from '@/lib/table-export';

type FeesHead = {
  feesTitle: string;
  displayName: string;
};

type FeesTypeWiseRow = {
  enrollmentNo: string;
  studentName: string;
  standardName: string;
  divisionName: string;
  batch: string;
  quota: string;
  paymentMode: string;
  bankName: string;
  bankBranch: string;
  chequeNo: string;
  chequeDate: string;
  receiptNo: string;
  receiptDate: string;
  totalFine: number;
  totalDiscount: number;
  amount: number;
  feeAmounts: Record<string, number>;
};

type FeesTypeWisePayload = ReportApiPayload & {
  fees_heads?: unknown;
  fees_data?: unknown;
};

const academicFields: DropdownField[] = ['section', 'standard', 'division'];

export default function FeesTypeWiseReportPage() {
  const [message, setMessage] = useState<ReportMessage | null>(null);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<FeesTypeWiseRow[]>([]);
  const [feesHeads, setFeesHeads] = useState<FeesHead[]>([]);
  const [page, setPage] = useState(1);
  const [hasSearched, setHasSearched] = useState(false);
  const [academicFilters, setAcademicFilters] = useState<Partial<SearchDropdownValues>>({ section: '', standard: '', division: '' });
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [enrollmentNo, setEnrollmentNo] = useState('');
  const [mobileNo, setMobileNo] = useState('');
  const [uniqueId, setUniqueId] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const pagination = useMemo(() => paginateRows(rows, page, REPORT_PAGE_SIZE), [page, rows]);
  const feeTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    feesHeads.forEach((head) => {
      totals[head.feesTitle] = rows.reduce((sum, row) => sum + (row.feeAmounts[head.feesTitle] ?? 0), 0);
    });
    return totals;
  }, [feesHeads, rows]);
  const summary = useMemo(() => ({
    totalAmount: rows.reduce((sum, row) => sum + row.amount, 0),
    totalFine: rows.reduce((sum, row) => sum + row.totalFine, 0),
    totalDiscount: rows.reduce((sum, row) => sum + row.totalDiscount, 0),
  }), [rows]);

  const exportColumns = useMemo<TableExportColumn[]>(() => ([
    { key: 'enrollmentNo', label: 'GR No' },
    { key: 'studentName', label: 'Student name', width: '220px' },
    { key: 'standardName', label: 'Standard' },
    { key: 'divisionName', label: 'Division' },
    { key: 'batch', label: 'Batch' },
    { key: 'quota', label: 'Quota' },
    { key: 'paymentMode', label: 'Payment mode' },
    { key: 'bankName', label: 'Bank name' },
    { key: 'bankBranch', label: 'Bank branch' },
    { key: 'chequeNo', label: 'Cheque no' },
    { key: 'chequeDate', label: 'Cheque date' },
    { key: 'receiptNo', label: 'Receipt no' },
    { key: 'receiptDate', label: 'Receipt date' },
    ...feesHeads.map((head) => ({ key: head.feesTitle, label: head.displayName, align: 'right' as const })),
    { key: 'totalFine', label: 'Fine', align: 'right' },
    { key: 'totalDiscount', label: 'Discount', align: 'right' },
    { key: 'amount', label: 'Total', align: 'right' },
  ]), [feesHeads]);

  const exportRows = useMemo<TableExportRow[]>(() => rows.map((row) => {
    const item: TableExportRow = {
      enrollmentNo: row.enrollmentNo,
      studentName: row.studentName,
      standardName: row.standardName,
      divisionName: row.divisionName,
      batch: row.batch,
      quota: row.quota,
      paymentMode: row.paymentMode,
      bankName: row.bankName,
      bankBranch: row.bankBranch,
      chequeNo: row.chequeNo,
      chequeDate: row.chequeDate,
      receiptNo: row.receiptNo,
      receiptDate: row.receiptDate,
      totalFine: formatPlainAmount(row.totalFine),
      totalDiscount: formatPlainAmount(row.totalDiscount),
      amount: formatPlainAmount(row.amount),
    };
    feesHeads.forEach((head) => {
      item[head.feesTitle] = formatPlainAmount(row.feeAmounts[head.feesTitle] ?? 0);
    });
    return item;
  }), [feesHeads, rows]);

  const handleSearch = async () => {
    setLoading(true);
    setHasSearched(true);
    setMessage(null);
    try {
      const params = new URLSearchParams();
      const grade = getSingleValue(academicFilters.section);
      const standard = getSingleValue(academicFilters.standard);
      const division = getSingleValue(academicFilters.division);
      appendIfValue(params, 'grade', grade);
      appendIfValue(params, 'standard', standard);
      appendIfValue(params, 'division', division);
      appendIfValue(params, 'first_name', firstName);
      appendIfValue(params, 'last_name', lastName);
      appendIfValue(params, 'enrollment_no', enrollmentNo);
      appendIfValue(params, 'mobile_no', mobileNo);
      appendIfValue(params, 'uniqueid', uniqueId);
      appendIfValue(params, 'from_date', fromDate);
      appendIfValue(params, 'to_date', toDate);

      const { payload } = await fetchFeesTypeWiseReportGet<FeesTypeWisePayload>(params);
      const heads = readArrayRecords(payload.fees_heads).map((record) => ({
        feesTitle: readString(record.fees_title),
        displayName: readString(record.display_name),
      })).filter((head) => head.feesTitle && head.displayName);
      const mappedRows = readArrayRecords(payload.fees_data).map((record) => mapFeesTypeWiseRow(record, heads));
      setFeesHeads(heads);
      setRows(mappedRows);
      setMessage({
        type: mappedRows.length > 0 ? 'success' : 'info',
        text: payload.message || (mappedRows.length > 0 ? `Loaded ${mappedRows.length} type-wise row${mappedRows.length === 1 ? '' : 's'}.` : 'No type-wise data found.'),
      });
    } catch (error) {
      setRows([]);
      setFeesHeads([]);
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Unable to fetch fees type-wise report.',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (hasSearched) {
      return;
    }
    const timer = window.setTimeout(() => {
      void handleSearch();
    }, 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasSearched]);

  return (
    <PageFrame>
      <PageHeader
        title="Fees Type Wise Report"
        description="Compare collected fee amounts head by head, including fine, discount, and receipt-level totals."
        action={
          <ReportActions
            onExportCsv={() => exportRowsAsCsv({ filename: 'fees-type-wise-report.csv', columns: exportColumns, rows: exportRows })}
            onExportExcel={() => exportRowsAsExcel({ filename: 'fees-type-wise-report.xls', title: 'Fees Type Wise Report', columns: exportColumns, rows: exportRows })}
            onExportPdf={() => exportRowsAsPdf({ filename: 'fees-type-wise-report.pdf', title: 'Fees Type Wise Report', subtitle: 'Legacy parity export', columns: exportColumns, rows: exportRows })}
            onPrint={() => openPrintPreview({ title: 'Fees Type Wise Report', subtitle: 'Legacy parity print view', columns: exportColumns, rows: exportRows })}
          />
        }
      />

      {message && <InlineMessage type={message.type} text={message.text} />}

      <SectionPanel title="Filters">
        <div className="grid gap-3 lg:grid-cols-4">
          <div className="lg:col-span-4">
            <SearchDropdown fields={academicFields} values={academicFilters} onChange={(values) => setAcademicFilters(values)} />
          </div>
          <Field label="First name">
            <Input value={firstName} onChange={(event) => setFirstName(event.target.value)} />
          </Field>
          <Field label="Last name">
            <Input value={lastName} onChange={(event) => setLastName(event.target.value)} />
          </Field>
          <Field label="Enrollment no">
            <Input value={enrollmentNo} onChange={(event) => setEnrollmentNo(event.target.value)} />
          </Field>
          <Field label="Mobile no">
            <Input value={mobileNo} onChange={(event) => setMobileNo(event.target.value)} />
          </Field>
          <Field label="Unique ID">
            <Input value={uniqueId} onChange={(event) => setUniqueId(event.target.value)} />
          </Field>
          <Field label="From date">
            <Input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
          </Field>
          <Field label="To date">
            <Input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
          </Field>
          <div className="flex items-end">
            <Button type="button" className="h-10 w-full" onClick={handleSearch} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Search
            </Button>
          </div>
        </div>
      </SectionPanel>

      <SectionPanel footer={<PaginationFooter pagination={pagination} onPageChange={setPage} />}>
        {rows.length > 0 && (
          <ReportSummaryBar>
            <SummaryChip label="Rows" value={String(rows.length)} />
            <SummaryChip label="Total amount" value={formatPlainAmount(summary.totalAmount)} />
            <SummaryChip label="Total fine" value={formatPlainAmount(summary.totalFine)} />
            <SummaryChip label="Total discount" value={formatPlainAmount(summary.totalDiscount)} />
          </ReportSummaryBar>
        )}

        <div className="mt-4">
          <Table className="min-w-[1600px]">
            <TableHeader>
              <TableRow className="bg-slate-100 text-xs uppercase text-slate-700 hover:bg-slate-100">
                <TableHead>Sr no</TableHead>
                <TableHead>GR no</TableHead>
                <TableHead>Student name</TableHead>
                <TableHead>Standard</TableHead>
                <TableHead>Division</TableHead>
                <TableHead>Batch</TableHead>
                <TableHead>Quota</TableHead>
                <TableHead>Payment mode</TableHead>
                <TableHead>Bank name</TableHead>
                <TableHead>Bank branch</TableHead>
                <TableHead>Cheque no</TableHead>
                <TableHead>Cheque date</TableHead>
                <TableHead>Receipt no</TableHead>
                <TableHead>Receipt date</TableHead>
                {feesHeads.map((head) => (
                  <TableHead key={head.feesTitle} className="text-right">{head.displayName}</TableHead>
                ))}
                <TableHead className="text-right">Fine</TableHead>
                <TableHead className="text-right">Discount</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <LoadingRows colSpan={17 + feesHeads.length} label="Loading fees type-wise report" />
              ) : pagination.rows.length > 0 ? (
                <>
                  {pagination.rows.map((row, index) => (
                    <TableRow key={`${row.receiptNo}-${row.enrollmentNo}-${index}`} className="odd:bg-white even:bg-slate-50/70">
                      <TableCell>{pagination.startIndex + index}</TableCell>
                      <TableCell>{row.enrollmentNo || '-'}</TableCell>
                      <TableCell className="font-semibold text-slate-950">{row.studentName || '-'}</TableCell>
                      <TableCell>{row.standardName || '-'}</TableCell>
                      <TableCell>{row.divisionName || '-'}</TableCell>
                      <TableCell>{row.batch || '-'}</TableCell>
                      <TableCell>{row.quota || '-'}</TableCell>
                      <TableCell>{row.paymentMode || '-'}</TableCell>
                      <TableCell>{row.bankName || '-'}</TableCell>
                      <TableCell>{row.bankBranch || '-'}</TableCell>
                      <TableCell>{row.chequeNo || '-'}</TableCell>
                      <TableCell>{row.chequeDate || '-'}</TableCell>
                      <TableCell>{row.receiptNo || '-'}</TableCell>
                      <TableCell>{row.receiptDate || '-'}</TableCell>
                      {feesHeads.map((head) => (
                        <TableCell key={head.feesTitle} className="text-right">{formatPlainAmount(row.feeAmounts[head.feesTitle] ?? 0)}</TableCell>
                      ))}
                      <TableCell className="text-right">{formatPlainAmount(row.totalFine)}</TableCell>
                      <TableCell className="text-right">{formatPlainAmount(row.totalDiscount)}</TableCell>
                      <TableCell className="text-right font-semibold">{formatPlainAmount(row.amount)}</TableCell>
                    </TableRow>
                  ))}
                  {pagination.page === pagination.totalPages && (
                    <TableRow className="bg-slate-100/70 font-semibold">
                      <TableCell colSpan={14}>Page totals</TableCell>
                      {feesHeads.map((head) => (
                        <TableCell key={head.feesTitle} className="text-right">{formatPlainAmount(feeTotals[head.feesTitle] ?? 0)}</TableCell>
                      ))}
                      <TableCell className="text-right">{formatPlainAmount(summary.totalFine)}</TableCell>
                      <TableCell className="text-right">{formatPlainAmount(summary.totalDiscount)}</TableCell>
                      <TableCell className="text-right">{formatPlainAmount(summary.totalAmount)}</TableCell>
                    </TableRow>
                  )}
                </>
              ) : (
                <EmptyTableRow colSpan={17 + feesHeads.length} label={hasSearched ? 'No type-wise rows match the current filters.' : 'Search to load the fees type-wise report.'} />
              )}
            </TableBody>
          </Table>
        </div>
      </SectionPanel>
    </PageFrame>
  );
}

function mapFeesTypeWiseRow(record: Record<string, unknown>, heads: FeesHead[]): FeesTypeWiseRow {
  const feeAmounts: Record<string, number> = {};
  heads.forEach((head) => {
    feeAmounts[head.feesTitle] = readNumber(record[`total_${head.feesTitle}`]);
  });
  return {
    enrollmentNo: readString(record.enrollment_no),
    studentName: readString(record.student_name),
    standardName: readString(record.std_name),
    divisionName: readString(record.div_name),
    batch: readString(record.student_batch_name),
    quota: readString(record.stu_qouta),
    paymentMode: readString(record.payment_mode),
    bankName: readString(record.cheque_bank_name),
    bankBranch: readString(record.bank_branch),
    chequeNo: readString(record.cheque_no),
    chequeDate: readString(record.cheque_date),
    receiptNo: readString(record.receipt_no),
    receiptDate: readString(record.receiptdate),
    totalFine: readNumber(record.total_fine),
    totalDiscount: readNumber(record.tot_disc),
    amount: readNumber(record.amount),
    feeAmounts,
  };
}

function getSingleValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] || '';
  return value || '';
}
