'use client';
/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Eye, Loader2, Search } from 'lucide-react';

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
import { PaginationFooter, ReportActions, ReportSummaryBar, SummaryChip } from '@/app/fees/_components/fees-report-shared';
import {
  REPORT_PAGE_SIZE,
  appendIfValue,
  fetchReportProxyText,
  fetchOtherFeesReportGet,
  fetchOtherFeesReportIndex,
  formatPlainAmount,
  paginateRows,
  readArrayRecords,
  type ReportApiPayload,
  type ReportMessage,
} from '@/app/fees/_lib/fees-report-utils';
import { getFeesSession, readNumber, readString } from '@/app/fees/_lib/fees-api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { SearchDropdown, type DropdownField, type SearchDropdownValues } from '@/components/search-dropdown';
import { exportRowsAsCsv, exportRowsAsExcel, exportRowsAsPdf, openPrintPreview, type TableExportColumn, type TableExportRow } from '@/lib/table-export';

type FeesTitleOption = {
  id: string;
  label: string;
};

type OtherFeesRow = {
  studentId: string;
  studentName: string;
  enrollmentNo: string;
  rollNo: string;
  standardDivision: string;
  feesHead: string;
  receiptId: string;
  paymentMode: string;
  amount: number;
  receivedDate: string;
};

type OtherFeesPayload = ReportApiPayload & {
  feesOtherHead_data?: unknown;
  other_feesData?: unknown;
};

const academicFields: DropdownField[] = ['section', 'standard', 'division'];

export default function OtherFeesReportPage() {
  const [message, setMessage] = useState<ReportMessage | null>(null);
  const [loadingFilters, setLoadingFilters] = useState(true);
  const [loading, setLoading] = useState(false);
  const [titles, setTitles] = useState<FeesTitleOption[]>([]);
  const [selectedTitleId, setSelectedTitleId] = useState('');
  const [rows, setRows] = useState<OtherFeesRow[]>([]);
  const [page, setPage] = useState(1);
  const [hasSearched, setHasSearched] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [academicFilters, setAcademicFilters] = useState<Partial<SearchDropdownValues>>({ section: '', standard: '', division: '' });
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const pagination = useMemo(() => paginateRows(rows, page, REPORT_PAGE_SIZE), [page, rows]);
  const totalAmount = useMemo(() => rows.reduce((sum, row) => sum + row.amount, 0), [rows]);
  const exportColumns = useMemo<TableExportColumn[]>(() => [
    { key: 'studentName', label: 'Student name', width: '220px' },
    { key: 'enrollmentNo', label: 'GR No' },
    { key: 'rollNo', label: 'Roll no' },
    { key: 'standardDivision', label: 'Standard / Division' },
    { key: 'feesHead', label: 'Other title', width: '220px' },
    { key: 'receiptId', label: 'Receipt no' },
    { key: 'paymentMode', label: 'Pay mode' },
    { key: 'amount', label: 'Amount', align: 'right' },
    { key: 'receivedDate', label: 'Received date' },
  ], []);
  const exportRows = useMemo<TableExportRow[]>(() => rows.map((row) => ({
    studentName: row.studentName,
    enrollmentNo: row.enrollmentNo,
    rollNo: row.rollNo,
    standardDivision: row.standardDivision,
    feesHead: row.feesHead,
    receiptId: row.receiptId,
    paymentMode: row.paymentMode,
    amount: formatPlainAmount(row.amount),
    receivedDate: row.receivedDate,
  })), [rows]);

  const loadTitles = useCallback(async () => {
    setLoadingFilters(true);
    try {
      const { payload } = await fetchOtherFeesReportIndex<OtherFeesPayload>();
      setTitles(mapTitleOptions(payload.feesOtherHead_data));
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Unable to load other fees heads.' });
    } finally {
      setLoadingFilters(false);
    }
  }, []);

  useEffect(() => {
    void loadTitles();
  }, [loadTitles]);

  const handleSearch = async () => {
    setLoading(true);
    setHasSearched(true);
    setMessage(null);
    try {
      const params = new URLSearchParams();
      appendIfValue(params, 'grade', getSingleValue(academicFilters.section));
      appendIfValue(params, 'standard', getSingleValue(academicFilters.standard));
      appendIfValue(params, 'division', getSingleValue(academicFilters.division));
      appendIfValue(params, 'from_date', fromDate);
      appendIfValue(params, 'to_date', toDate);
      appendIfValue(params, 'otherfeeshead', selectedTitleId);
      const { payload } = await fetchOtherFeesReportGet<OtherFeesPayload>(params);
      const mappedRows = readArrayRecords(payload.other_feesData).map(mapOtherFeesRow);
      setRows(mappedRows);
      setMessage({
        type: mappedRows.length > 0 ? 'success' : 'info',
        text: payload.message || (mappedRows.length > 0 ? `Loaded ${mappedRows.length} other-fee row${mappedRows.length === 1 ? '' : 's'}.` : 'No other-fee data found.'),
      });
    } catch (error) {
      setRows([]);
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Unable to fetch other fees report.' });
    } finally {
      setLoading(false);
    }
  };

  const handleViewLedger = async (studentId: string) => {
    try {
      const session = getFeesSession();
      const params = new URLSearchParams();
      params.set('student_id', studentId);
      const html = await fetchReportProxyText(session, '/api/fees/reports/other-fees/ledger', params);
      setPreviewHtml(html);
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Unable to load ledger preview.' });
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
        title="Other Fees Report"
        description="Review collected other-fee deductions and open the legacy ledger preview for each student."
        action={
          <ReportActions
            onExportCsv={() => exportRowsAsCsv({ filename: 'other-fees-report.csv', columns: exportColumns, rows: exportRows })}
            onExportExcel={() => exportRowsAsExcel({ filename: 'other-fees-report.xls', title: 'Other Fees Report', columns: exportColumns, rows: exportRows })}
            onExportPdf={() => exportRowsAsPdf({ filename: 'other-fees-report.pdf', title: 'Other Fees Report', subtitle: 'Legacy parity export', columns: exportColumns, rows: exportRows })}
            onPrint={() => openPrintPreview({ title: 'Other Fees Report', subtitle: 'Legacy parity print view', columns: exportColumns, rows: exportRows })}
          />
        }
      />

      {message && <InlineMessage type={message.type} text={message.text} />}

      <SectionPanel title="Filters">
        <div className="grid gap-3 lg:grid-cols-4">
          <div className="lg:col-span-4">
            <SearchDropdown fields={academicFields} values={academicFilters} onChange={(values) => setAcademicFilters(values)} />
          </div>
          <Field label="From date">
            <Input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
          </Field>
          <Field label="To date">
            <Input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
          </Field>
          <Field label="Other fees head">
            <NativeSelect value={selectedTitleId} onChange={setSelectedTitleId} disabled={loadingFilters}>
              <option value="">Select other fees head</option>
              {titles.map((title) => (
                <option key={title.id} value={title.id}>{title.label}</option>
              ))}
            </NativeSelect>
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
            <SummaryChip label="Total amount" value={formatPlainAmount(totalAmount)} />
          </ReportSummaryBar>
        )}
        <div className="mt-4">
          <Table className="min-w-[1200px]">
            <TableHeader>
              <TableRow className="bg-slate-100 text-xs uppercase text-slate-700 hover:bg-slate-100">
                <TableHead>Sr no</TableHead>
                <TableHead>Student name</TableHead>
                <TableHead>GR no</TableHead>
                <TableHead>Roll no</TableHead>
                <TableHead>Standard / Division</TableHead>
                <TableHead>Other title</TableHead>
                <TableHead>Receipt no</TableHead>
                <TableHead>Pay mode</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Received date</TableHead>
                <TableHead>Ledger</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <LoadingRows colSpan={11} label="Loading other fees report" />
              ) : pagination.rows.length > 0 ? (
                pagination.rows.map((row, index) => (
                  <TableRow key={`${row.studentId}-${row.receiptId}-${index}`} className="odd:bg-white even:bg-slate-50/70">
                    <TableCell>{pagination.startIndex + index}</TableCell>
                    <TableCell className="font-semibold text-slate-950">{row.studentName || '-'}</TableCell>
                    <TableCell>{row.enrollmentNo || '-'}</TableCell>
                    <TableCell>{row.rollNo || '-'}</TableCell>
                    <TableCell>{row.standardDivision || '-'}</TableCell>
                    <TableCell>{row.feesHead || '-'}</TableCell>
                    <TableCell>{row.receiptId || '-'}</TableCell>
                    <TableCell>{row.paymentMode || '-'}</TableCell>
                    <TableCell className="text-right font-semibold">{formatPlainAmount(row.amount)}</TableCell>
                    <TableCell>{row.receivedDate || '-'}</TableCell>
                    <TableCell>
                      <Button type="button" size="sm" variant="outline" onClick={() => handleViewLedger(row.studentId)}>
                        <Eye className="h-3.5 w-3.5" />
                        View ledger
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <EmptyTableRow colSpan={11} label={hasSearched ? 'No other-fee rows match the current filters.' : 'Search to load the other fees report.'} />
              )}
            </TableBody>
          </Table>
        </div>
      </SectionPanel>

      {previewHtml && (
        <ReceiptPreviewModal title="Student Ledger Report" html={previewHtml} onClose={() => setPreviewHtml('')} />
      )}
    </PageFrame>
  );
}

function mapTitleOptions(value: unknown): FeesTitleOption[] {
  return readArrayRecords(value).map((record) => ({
    id: readString(record.id),
    label: readString(record.display_name),
  })).filter((item) => item.id && item.label);
}

function mapOtherFeesRow(record: Record<string, unknown>): OtherFeesRow {
  return {
    studentId: readString(record.student_id),
    studentName: readString(record.student_name),
    enrollmentNo: readString(record.enrollment_no),
    rollNo: readString(record.roll_no),
    standardDivision: `${readString(record.standard_name)}-${readString(record.division_name)}`,
    feesHead: readString(record.fees_head),
    receiptId: readString(record.receipt_id),
    paymentMode: readString(record.payment_mode || `${readString(record.bank_name)}-${readString(record.cheque_dd_no)}`),
    amount: readNumber(record.deduction_amount),
    receivedDate: readString(record.deduction_date),
  };
}

function getSingleValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] || '';
  return value || '';
}
