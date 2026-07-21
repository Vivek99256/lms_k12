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
import { PaginationFooter, ReportActions, ReportSummaryBar, SummaryChip } from '@/app/fees/_components/fees-report-shared';
import {
  REPORT_PAGE_SIZE,
  appendIfValue,
  fetchOtherFeesCancelReportGet,
  fetchOtherFeesCancelReportIndex,
  formatPlainAmount,
  paginateRows,
  readArrayRecords,
  type ReportApiPayload,
  type ReportMessage,
} from '@/app/fees/_lib/fees-report-utils';
import { readNumber, readString } from '@/app/fees/_lib/fees-api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { SearchDropdown, type DropdownField, type SearchDropdownValues } from '@/components/search-dropdown';
import { exportRowsAsCsv, exportRowsAsExcel, exportRowsAsPdf, openPrintPreview, type TableExportColumn, type TableExportRow } from '@/lib/table-export';

type FeesTitleOption = {
  id: string;
  label: string;
};

type OtherFeesCancelRow = {
  enrollmentNo: string;
  studentName: string;
  standardName: string;
  divisionName: string;
  mobile: string;
  feesHead: string;
  receiptId: string;
  remark: string;
  cancelledDate: string;
  cancelledBy: string;
  amount: number;
};

type OtherFeesCancelPayload = ReportApiPayload & {
  feesOtherHead_data?: unknown;
  other_feesData?: unknown;
};

const academicFields: DropdownField[] = ['section', 'standard', 'division'];

export default function OtherFeesCancelReportPage() {
  const [message, setMessage] = useState<ReportMessage | null>(null);
  const [loadingFilters, setLoadingFilters] = useState(true);
  const [loading, setLoading] = useState(false);
  const [titles, setTitles] = useState<FeesTitleOption[]>([]);
  const [selectedTitleId, setSelectedTitleId] = useState('');
  const [rows, setRows] = useState<OtherFeesCancelRow[]>([]);
  const [page, setPage] = useState(1);
  const [hasSearched, setHasSearched] = useState(false);
  const [academicFilters, setAcademicFilters] = useState<Partial<SearchDropdownValues>>({ section: '', standard: '', division: '' });
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const pagination = useMemo(() => paginateRows(rows, page, REPORT_PAGE_SIZE), [page, rows]);
  const totalAmount = useMemo(() => rows.reduce((sum, row) => sum + row.amount, 0), [rows]);
  const exportColumns = useMemo<TableExportColumn[]>(() => [
    { key: 'enrollmentNo', label: 'GR No' },
    { key: 'studentName', label: 'Student name', width: '220px' },
    { key: 'standardName', label: 'Standard' },
    { key: 'divisionName', label: 'Division' },
    { key: 'mobile', label: 'Mobile no' },
    { key: 'feesHead', label: 'Fees head', width: '220px' },
    { key: 'receiptId', label: 'Receipt no' },
    { key: 'remark', label: 'Remark', width: '220px' },
    { key: 'cancelledDate', label: 'Cancelled date' },
    { key: 'cancelledBy', label: 'Cancelled by' },
    { key: 'amount', label: 'Amount', align: 'right' },
  ], []);
  const exportRows = useMemo<TableExportRow[]>(() => rows.map((row) => ({
    enrollmentNo: row.enrollmentNo,
    studentName: row.studentName,
    standardName: row.standardName,
    divisionName: row.divisionName,
    mobile: row.mobile,
    feesHead: row.feesHead,
    receiptId: row.receiptId,
    remark: row.remark,
    cancelledDate: row.cancelledDate,
    cancelledBy: row.cancelledBy,
    amount: formatPlainAmount(row.amount),
  })), [rows]);

  const loadTitles = useCallback(async () => {
    setLoadingFilters(true);
    try {
      const { payload } = await fetchOtherFeesCancelReportIndex<OtherFeesCancelPayload>();
      setTitles(
        readArrayRecords(payload.feesOtherHead_data).map((record) => ({
          id: readString(record.id),
          label: readString(record.display_name),
        })).filter((item) => item.id && item.label)
      );
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
      const { payload } = await fetchOtherFeesCancelReportGet<OtherFeesCancelPayload>(params);
      const mappedRows = readArrayRecords(payload.other_feesData).map((record) => ({
        enrollmentNo: readString(record.enrollment_no),
        studentName: readString(record.student_name),
        standardName: readString(record.standard_name),
        divisionName: readString(record.division_name),
        mobile: readString(record.mobile),
        feesHead: readString(record.fees_head),
        receiptId: readString(record.receipt_id),
        remark: readString(record.cancellation_remarks) || '-',
        cancelledDate: readString(record.cancellation_date),
        cancelledBy: readString(record.cancelled_by),
        amount: readNumber(record.cancellation_amount),
      }));
      setRows(mappedRows);
      setMessage({
        type: mappedRows.length > 0 ? 'success' : 'info',
        text: payload.message || (mappedRows.length > 0 ? `Loaded ${mappedRows.length} cancelled other-fee row${mappedRows.length === 1 ? '' : 's'}.` : 'No cancelled other-fee rows found.'),
      });
    } catch (error) {
      setRows([]);
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Unable to fetch other fees cancel report.' });
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
        title="Other Fees Cancel Report"
        description="Track cancelled other-fee receipts by date, head, student, and cancelling user."
        action={
          <ReportActions
            onExportCsv={() => exportRowsAsCsv({ filename: 'other-fees-cancel-report.csv', columns: exportColumns, rows: exportRows })}
            onExportExcel={() => exportRowsAsExcel({ filename: 'other-fees-cancel-report.xls', title: 'Other Fees Cancel Report', columns: exportColumns, rows: exportRows })}
            onExportPdf={() => exportRowsAsPdf({ filename: 'other-fees-cancel-report.pdf', title: 'Other Fees Cancel Report', subtitle: 'Legacy parity export', columns: exportColumns, rows: exportRows })}
            onPrint={() => openPrintPreview({ title: 'Other Fees Cancel Report', subtitle: 'Legacy parity print view', columns: exportColumns, rows: exportRows })}
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
          <Table className="min-w-[1320px]">
            <TableHeader>
              <TableRow className="bg-slate-100 text-xs uppercase text-slate-700 hover:bg-slate-100">
                <TableHead>Sr no</TableHead>
                <TableHead>GR no</TableHead>
                <TableHead>Student name</TableHead>
                <TableHead>Standard</TableHead>
                <TableHead>Division</TableHead>
                <TableHead>Mobile no</TableHead>
                <TableHead>Fees head</TableHead>
                <TableHead>Receipt no</TableHead>
                <TableHead>Remark</TableHead>
                <TableHead>Cancelled date</TableHead>
                <TableHead>Cancelled by</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <LoadingRows colSpan={12} label="Loading other fees cancel report" />
              ) : pagination.rows.length > 0 ? (
                pagination.rows.map((row, index) => (
                  <TableRow key={`${row.receiptId}-${row.enrollmentNo}-${index}`} className="odd:bg-white even:bg-slate-50/70">
                    <TableCell>{pagination.startIndex + index}</TableCell>
                    <TableCell>{row.enrollmentNo || '-'}</TableCell>
                    <TableCell className="font-semibold text-slate-950">{row.studentName || '-'}</TableCell>
                    <TableCell>{row.standardName || '-'}</TableCell>
                    <TableCell>{row.divisionName || '-'}</TableCell>
                    <TableCell>{row.mobile || '-'}</TableCell>
                    <TableCell>{row.feesHead || '-'}</TableCell>
                    <TableCell>{row.receiptId || '-'}</TableCell>
                    <TableCell>{row.remark || '-'}</TableCell>
                    <TableCell>{row.cancelledDate || '-'}</TableCell>
                    <TableCell>{row.cancelledBy || '-'}</TableCell>
                    <TableCell className="text-right font-semibold">{formatPlainAmount(row.amount)}</TableCell>
                  </TableRow>
                ))
              ) : (
                <EmptyTableRow colSpan={12} label={hasSearched ? 'No cancelled other-fee rows match the current filters.' : 'Search to load the other fees cancel report.'} />
              )}
            </TableBody>
          </Table>
        </div>
      </SectionPanel>
    </PageFrame>
  );
}

function getSingleValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] || '';
  return value || '';
}
