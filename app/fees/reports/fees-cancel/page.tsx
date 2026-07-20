'use client';
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useMemo, useState } from 'react';
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
  fetchFeesCancelReportIndex,
  fetchFeesCancelReportPost,
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

type CancelTypeOption = {
  value: string;
  label: string;
};

type FeesCancelRow = {
  receiptId: string;
  enrollmentNo: string;
  studentName: string;
  admissionYear: string;
  quota: string;
  standardName: string;
  amountPaid: number;
  cancelType: string;
  cancelRemark: string;
  cancelledBy: string;
  cancelDate: string;
};

type FeesCancelPayload = ReportApiPayload & {
  fees_cancel_type?: unknown;
  report_data?: unknown;
};

const academicFields: DropdownField[] = ['section', 'standard', 'division'];

export default function FeesCancelReportPage() {
  const [message, setMessage] = useState<ReportMessage | null>(null);
  const [loadingFilters, setLoadingFilters] = useState(true);
  const [loading, setLoading] = useState(false);
  const [cancelTypes, setCancelTypes] = useState<CancelTypeOption[]>([]);
  const [selectedCancelType, setSelectedCancelType] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [rows, setRows] = useState<FeesCancelRow[]>([]);
  const [page, setPage] = useState(1);
  const [hasSearched, setHasSearched] = useState(false);
  const [academicFilters, setAcademicFilters] = useState<Partial<SearchDropdownValues>>({ section: '', standard: '', division: '' });

  const pagination = useMemo(() => paginateRows(rows, page, REPORT_PAGE_SIZE), [page, rows]);
  const totalAmount = useMemo(() => rows.reduce((sum, row) => sum + row.amountPaid, 0), [rows]);
  const exportColumns = useMemo<TableExportColumn[]>(() => [
    { key: 'receiptId', label: 'Receipt no' },
    { key: 'enrollmentNo', label: 'GR No' },
    { key: 'studentName', label: 'Student name', width: '220px' },
    { key: 'admissionYear', label: 'Admission year' },
    { key: 'quota', label: 'Quota' },
    { key: 'standardName', label: 'Standard' },
    { key: 'amountPaid', label: 'Total fees paid', align: 'right' },
    { key: 'cancelType', label: 'Cancellation type' },
    { key: 'cancelRemark', label: 'Cancellation remarks', width: '220px' },
    { key: 'cancelledBy', label: 'Cancel by' },
    { key: 'cancelDate', label: 'Cancellation date' },
  ], []);
  const exportRows = useMemo<TableExportRow[]>(() => rows.map((row) => ({
    receiptId: row.receiptId,
    enrollmentNo: row.enrollmentNo,
    studentName: row.studentName,
    admissionYear: row.admissionYear,
    quota: row.quota,
    standardName: row.standardName,
    amountPaid: formatPlainAmount(row.amountPaid),
    cancelType: row.cancelType,
    cancelRemark: row.cancelRemark,
    cancelledBy: row.cancelledBy,
    cancelDate: row.cancelDate,
  })), [rows]);

  const loadFilters = async () => {
    setLoadingFilters(true);
    try {
      const { payload } = await fetchFeesCancelReportIndex<FeesCancelPayload>();
      const typesRecord = payload.fees_cancel_type && typeof payload.fees_cancel_type === 'object' ? payload.fees_cancel_type as Record<string, unknown> : {};
      setCancelTypes(Object.entries(typesRecord).map(([key, value]) => ({ value: readString(value || key), label: readString(value || key) })));
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Unable to load cancellation types.' });
    } finally {
      setLoadingFilters(false);
    }
  };

  useEffect(() => {
    void loadFilters();
  }, []);

  const handleSearch = async () => {
    setLoading(true);
    setHasSearched(true);
    setPage(1);
    setMessage(null);
    try {
      const params = new URLSearchParams();
      appendIfValue(params, 'grade', getSingleValue(academicFilters.section));
      appendIfValue(params, 'standard', getSingleValue(academicFilters.standard));
      appendIfValue(params, 'division', getSingleValue(academicFilters.division));
      appendIfValue(params, 'cancel_type', selectedCancelType);
      appendIfValue(params, 'from_date', fromDate);
      appendIfValue(params, 'to_date', toDate);
      const { payload } = await fetchFeesCancelReportPost<FeesCancelPayload>(params);
      const mappedRows = readArrayRecords(payload.report_data).map((record) => ({
        receiptId: readString(record.reciept_id),
        enrollmentNo: readString(record.enrollment_no),
        studentName: readString(record.student_name),
        admissionYear: readString(record.admission_year),
        quota: readString(record.student_quota_name),
        standardName: readString(record.std_name),
        amountPaid: readNumber(record.amountpaid),
        cancelType: readString(record.cancel_type),
        cancelRemark: readString(record.cancel_remark),
        cancelledBy: readString(record.cancelled_by),
        cancelDate: readString(record.cancel_date),
      }));
      setRows(mappedRows);
      setMessage({
        type: mappedRows.length > 0 ? 'success' : 'info',
        text: payload.message || (mappedRows.length > 0 ? `Loaded ${mappedRows.length} cancelled receipt row${mappedRows.length === 1 ? '' : 's'}.` : 'No cancelled receipt rows found.'),
      });
    } catch (error) {
      setRows([]);
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Unable to fetch fees cancel report.' });
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
        title="Fees Cancel Report"
        description="Track regular fee receipt cancellations by cancel type, student, date range, and cancelling user."
        action={
          <ReportActions
            onExportCsv={() => exportRowsAsCsv({ filename: 'fees-cancel-report.csv', columns: exportColumns, rows: exportRows })}
            onExportExcel={() => exportRowsAsExcel({ filename: 'fees-cancel-report.xls', title: 'Fees Cancel Report', columns: exportColumns, rows: exportRows })}
            onExportPdf={() => exportRowsAsPdf({ filename: 'fees-cancel-report.pdf', title: 'Fees Cancel Report', subtitle: 'Legacy parity export', columns: exportColumns, rows: exportRows })}
            onPrint={() => openPrintPreview({ title: 'Fees Cancel Report', subtitle: 'Legacy parity print view', columns: exportColumns, rows: exportRows })}
          />
        }
      />

      {message && <InlineMessage type={message.type} text={message.text} />}

      <SectionPanel title="Filters">
        <div className="grid gap-3 lg:grid-cols-4">
          <div className="lg:col-span-4">
            <SearchDropdown fields={academicFields} values={academicFilters} onChange={(values) => setAcademicFilters(values)} />
          </div>
          <Field label="Cancellation type">
            <NativeSelect value={selectedCancelType} onChange={setSelectedCancelType} disabled={loadingFilters}>
              <option value="">Select cancel type</option>
              {cancelTypes.map((type) => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </NativeSelect>
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
            <SummaryChip label="Total amount" value={formatPlainAmount(totalAmount)} />
          </ReportSummaryBar>
        )}
        <div className="mt-4">
          <Table className="min-w-[1320px]">
            <TableHeader>
              <TableRow className="bg-slate-100 text-xs uppercase text-slate-700 hover:bg-slate-100">
                <TableHead>Sr no</TableHead>
                <TableHead>Receipt no</TableHead>
                <TableHead>GR no</TableHead>
                <TableHead>Student name</TableHead>
                <TableHead>Admission year</TableHead>
                <TableHead>Quota</TableHead>
                <TableHead>Standard</TableHead>
                <TableHead className="text-right">Total fees paid</TableHead>
                <TableHead>Cancellation type</TableHead>
                <TableHead>Cancellation remarks</TableHead>
                <TableHead>Cancel by</TableHead>
                <TableHead>Cancellation date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <LoadingRows colSpan={12} label="Loading fees cancel report" />
              ) : pagination.rows.length > 0 ? (
                pagination.rows.map((row, index) => (
                  <TableRow key={`${row.receiptId}-${row.enrollmentNo}-${index}`} className="odd:bg-white even:bg-slate-50/70">
                    <TableCell>{pagination.startIndex + index}</TableCell>
                    <TableCell>{row.receiptId || '-'}</TableCell>
                    <TableCell>{row.enrollmentNo || '-'}</TableCell>
                    <TableCell className="font-semibold text-slate-950">{row.studentName || '-'}</TableCell>
                    <TableCell>{row.admissionYear || '-'}</TableCell>
                    <TableCell>{row.quota || '-'}</TableCell>
                    <TableCell>{row.standardName || '-'}</TableCell>
                    <TableCell className="text-right">{formatPlainAmount(row.amountPaid)}</TableCell>
                    <TableCell>{row.cancelType || '-'}</TableCell>
                    <TableCell>{row.cancelRemark || '-'}</TableCell>
                    <TableCell>{row.cancelledBy || '-'}</TableCell>
                    <TableCell>{row.cancelDate || '-'}</TableCell>
                  </TableRow>
                ))
              ) : (
                <EmptyTableRow colSpan={12} label={hasSearched ? 'No cancelled receipt rows match the current filters.' : 'Search to load the fees cancel report.'} />
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
