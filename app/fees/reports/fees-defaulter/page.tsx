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
import { PaginationFooter, ReportActions, ReportSummaryBar, SummaryChip } from '@/app/fees/_components/fees-report-shared';
import {
  REPORT_PAGE_SIZE,
  appendIfValue,
  fetchFeesDefaulterReportPost,
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

type FeesTitle = {
  displayName: string;
};

type FeesDefaulterRow = {
  rollNo: string;
  enrollmentNo: string;
  studentName: string;
  standardDivision: string;
  quota: string;
  mobile: string;
  status: string;
  transportFees: number;
  regularFees: number;
  regularPlusBus: number;
  feeAmounts: Record<string, number>;
  totalBreakoff: number;
  totalPaid: number;
  totalDiscount: number;
  totalUnpaid: number;
};

type FeesDefaulterPayload = ReportApiPayload & {
  fees_data?: unknown;
  fees_titles?: unknown;
  other_fees_titles?: unknown;
};

const academicFields: DropdownField[] = ['section', 'standard', 'division'];

export default function FeesDefaulterReportPage() {
  const [message, setMessage] = useState<ReportMessage | null>(null);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<FeesDefaulterRow[]>([]);
  const [feesTitles, setFeesTitles] = useState<FeesTitle[]>([]);
  const [page, setPage] = useState(1);
  const [hasSearched, setHasSearched] = useState(false);
  const [academicFilters, setAcademicFilters] = useState<Partial<SearchDropdownValues>>({ section: '', standard: '', division: '' });
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [enrollmentNo, setEnrollmentNo] = useState('');
  const [mobileNo, setMobileNo] = useState('');
  const [uniqueId, setUniqueId] = useState('');

  const pagination = useMemo(() => paginateRows(rows, page, REPORT_PAGE_SIZE), [page, rows]);
  const totals = useMemo(() => ({
    transportFees: rows.reduce((sum, row) => sum + row.transportFees, 0),
    regularFees: rows.reduce((sum, row) => sum + row.regularFees, 0),
    regularPlusBus: rows.reduce((sum, row) => sum + row.regularPlusBus, 0),
    totalBreakoff: rows.reduce((sum, row) => sum + row.totalBreakoff, 0),
    totalPaid: rows.reduce((sum, row) => sum + row.totalPaid, 0),
    totalDiscount: rows.reduce((sum, row) => sum + row.totalDiscount, 0),
    totalUnpaid: rows.reduce((sum, row) => sum + row.totalUnpaid, 0),
  }), [rows]);
  const feeTotals = useMemo(() => {
    const totalsMap: Record<string, number> = {};
    feesTitles.forEach((title) => {
      totalsMap[title.displayName] = rows.reduce((sum, row) => sum + (row.feeAmounts[title.displayName] ?? 0), 0);
    });
    return totalsMap;
  }, [feesTitles, rows]);

  const exportColumns = useMemo<TableExportColumn[]>(() => ([
    { key: 'rollNo', label: 'Roll no' },
    { key: 'enrollmentNo', label: 'GR No' },
    { key: 'studentName', label: 'Student name', width: '220px' },
    { key: 'standardDivision', label: 'Std / Div' },
    { key: 'quota', label: 'Quota' },
    { key: 'mobile', label: 'Mobile no' },
    { key: 'status', label: 'Status' },
    { key: 'transportFees', label: 'Bus', align: 'right' },
    { key: 'regularFees', label: 'Regular', align: 'right' },
    { key: 'regularPlusBus', label: 'Reg + Bus', align: 'right' },
    ...feesTitles.map((title) => ({ key: title.displayName, label: title.displayName, align: 'right' as const })),
    { key: 'totalBreakoff', label: 'Total', align: 'right' },
    { key: 'totalPaid', label: 'Total paid', align: 'right' },
    { key: 'totalDiscount', label: 'Discount', align: 'right' },
    { key: 'totalUnpaid', label: 'Total unpaid', align: 'right' },
  ]), [feesTitles]);

  const exportRows = useMemo<TableExportRow[]>(() => rows.map((row) => {
    const item: TableExportRow = {
      rollNo: row.rollNo,
      enrollmentNo: row.enrollmentNo,
      studentName: row.studentName,
      standardDivision: row.standardDivision,
      quota: row.quota,
      mobile: row.mobile,
      status: row.status,
      transportFees: formatPlainAmount(row.transportFees),
      regularFees: formatPlainAmount(row.regularFees),
      regularPlusBus: formatPlainAmount(row.regularPlusBus),
      totalBreakoff: formatPlainAmount(row.totalBreakoff),
      totalPaid: formatPlainAmount(row.totalPaid),
      totalDiscount: formatPlainAmount(row.totalDiscount),
      totalUnpaid: formatPlainAmount(row.totalUnpaid),
    };
    feesTitles.forEach((title) => {
      item[title.displayName] = formatPlainAmount(row.feeAmounts[title.displayName] ?? 0);
    });
    return item;
  }), [feesTitles, rows]);

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
      appendIfValue(params, 'first_name', firstName);
      appendIfValue(params, 'last_name', lastName);
      appendIfValue(params, 'enrollment_no', enrollmentNo);
      appendIfValue(params, 'mobile_no', mobileNo);
      appendIfValue(params, 'uniqueid', uniqueId);

      const { payload } = await fetchFeesDefaulterReportPost<FeesDefaulterPayload>(params);
      const titles = readArrayRecords(payload.fees_titles)
        .map((record) => ({ displayName: readString(record.display_name) }))
        .filter((item) => item.displayName && item.displayName !== 'Transport Fees');
      const mappedRows = Object.values(asFeesDataRecord(payload.fees_data))
        .map((record) => mapDefaulterRow(record, titles))
        .filter(Boolean) as FeesDefaulterRow[];

      setFeesTitles(titles);
      setRows(mappedRows);
      setMessage({
        type: mappedRows.length > 0 ? 'success' : 'info',
        text: payload.message || (mappedRows.length > 0 ? `Loaded ${mappedRows.length} defaulter row${mappedRows.length === 1 ? '' : 's'}.` : 'No defaulter data found.'),
      });
    } catch (error) {
      setRows([]);
      setFeesTitles([]);
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Unable to fetch fees defaulter report.' });
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
        title="Fees Defaulter Report"
        description="Review unpaid, partially paid, and inactive student fee positions exactly from the legacy Laravel calculations."
        action={
          <ReportActions
            onExportCsv={() => exportRowsAsCsv({ filename: 'fees-defaulter-report.csv', columns: exportColumns, rows: exportRows })}
            onExportExcel={() => exportRowsAsExcel({ filename: 'fees-defaulter-report.xls', title: 'Fees Defaulter Report', columns: exportColumns, rows: exportRows })}
            onExportPdf={() => exportRowsAsPdf({ filename: 'fees-defaulter-report.pdf', title: 'Fees Defaulter Report', subtitle: 'Legacy parity export', columns: exportColumns, rows: exportRows })}
            onPrint={() => openPrintPreview({ title: 'Fees Defaulter Report', subtitle: 'Legacy parity print view', columns: exportColumns, rows: exportRows })}
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
          <Field label="GR no">
            <Input value={enrollmentNo} onChange={(event) => setEnrollmentNo(event.target.value)} />
          </Field>
          <Field label="Mobile no">
            <Input value={mobileNo} onChange={(event) => setMobileNo(event.target.value)} />
          </Field>
          <Field label="Unique ID">
            <Input value={uniqueId} onChange={(event) => setUniqueId(event.target.value)} />
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
            <SummaryChip label="Total fees" value={formatPlainAmount(totals.totalBreakoff)} />
            <SummaryChip label="Total paid" value={formatPlainAmount(totals.totalPaid)} />
            <SummaryChip label="Total unpaid" value={formatPlainAmount(totals.totalUnpaid)} />
          </ReportSummaryBar>
        )}
        <div className="mt-4">
          <Table className="min-w-[1700px]">
            <TableHeader>
              <TableRow className="bg-slate-100 text-xs uppercase text-slate-700 hover:bg-slate-100">
                <TableHead>Sr</TableHead>
                <TableHead>Roll no</TableHead>
                <TableHead>GR no</TableHead>
                <TableHead>Student name</TableHead>
                <TableHead>Std / Div</TableHead>
                <TableHead>Quota</TableHead>
                <TableHead>Mobile no</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Bus</TableHead>
                <TableHead className="text-right">Regular</TableHead>
                <TableHead className="text-right">Reg + Bus</TableHead>
                {feesTitles.map((title) => (
                  <TableHead key={title.displayName} className="text-right">{title.displayName}</TableHead>
                ))}
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Total paid</TableHead>
                <TableHead className="text-right">Discount</TableHead>
                <TableHead className="text-right">Total unpaid</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <LoadingRows colSpan={15 + feesTitles.length} label="Loading fees defaulter report" />
              ) : pagination.rows.length > 0 ? (
                <>
                  {pagination.rows.map((row, index) => (
                    <TableRow key={`${row.enrollmentNo}-${index}`} className="odd:bg-white even:bg-slate-50/70">
                      <TableCell>{pagination.startIndex + index}</TableCell>
                      <TableCell>{row.rollNo || '-'}</TableCell>
                      <TableCell>{row.enrollmentNo || '-'}</TableCell>
                      <TableCell className="font-semibold text-slate-950">{row.studentName || '-'}</TableCell>
                      <TableCell>{row.standardDivision || '-'}</TableCell>
                      <TableCell>{row.quota || '-'}</TableCell>
                      <TableCell>{row.mobile || '-'}</TableCell>
                      <TableCell>{row.status || '-'}</TableCell>
                      <TableCell className="text-right">{formatPlainAmount(row.transportFees)}</TableCell>
                      <TableCell className="text-right">{formatPlainAmount(row.regularFees)}</TableCell>
                      <TableCell className="text-right">{formatPlainAmount(row.regularPlusBus)}</TableCell>
                      {feesTitles.map((title) => (
                        <TableCell key={title.displayName} className="text-right">{formatPlainAmount(row.feeAmounts[title.displayName] ?? 0)}</TableCell>
                      ))}
                      <TableCell className="text-right">{formatPlainAmount(row.totalBreakoff)}</TableCell>
                      <TableCell className="text-right">{formatPlainAmount(row.totalPaid)}</TableCell>
                      <TableCell className="text-right">{formatPlainAmount(row.totalDiscount)}</TableCell>
                      <TableCell className="text-right font-semibold">{formatPlainAmount(row.totalUnpaid)}</TableCell>
                    </TableRow>
                  ))}
                  {pagination.page === pagination.totalPages && (
                    <TableRow className="bg-slate-100/70 font-semibold">
                      <TableCell colSpan={8}>Page totals</TableCell>
                      <TableCell className="text-right">{formatPlainAmount(totals.transportFees)}</TableCell>
                      <TableCell className="text-right">{formatPlainAmount(totals.regularFees)}</TableCell>
                      <TableCell className="text-right">{formatPlainAmount(totals.regularPlusBus)}</TableCell>
                      {feesTitles.map((title) => (
                        <TableCell key={title.displayName} className="text-right">{formatPlainAmount(feeTotals[title.displayName] ?? 0)}</TableCell>
                      ))}
                      <TableCell className="text-right">{formatPlainAmount(totals.totalBreakoff)}</TableCell>
                      <TableCell className="text-right">{formatPlainAmount(totals.totalPaid)}</TableCell>
                      <TableCell className="text-right">{formatPlainAmount(totals.totalDiscount)}</TableCell>
                      <TableCell className="text-right">{formatPlainAmount(totals.totalUnpaid)}</TableCell>
                    </TableRow>
                  )}
                </>
              ) : (
                <EmptyTableRow colSpan={15 + feesTitles.length} label={hasSearched ? 'No defaulter rows match the current filters.' : 'Search to load the fees defaulter report.'} />
              )}
            </TableBody>
          </Table>
        </div>
      </SectionPanel>
    </PageFrame>
  );
}

function asFeesDataRecord(value: unknown): Record<string, Record<string, unknown>> {
  const outer = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const result: Record<string, Record<string, unknown>> = {};
  Object.entries(outer).forEach(([key, item]) => {
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      result[key] = item as Record<string, unknown>;
    }
  });
  return result;
}

function mapDefaulterRow(record: Record<string, unknown>, titles: FeesTitle[]): FeesDefaulterRow | null {
  const endDate = readString(record.end_date);
  const totalsRecord = record['-'] && typeof record['-'] === 'object' ? record['-'] as Record<string, unknown> : {};
  const totalPaid = readNumber(totalsRecord.paid);
  if (endDate === 'Inactive' && totalPaid === 0) {
    return null;
  }

  const finalFee = record.final_fee && typeof record.final_fee === 'object' ? record.final_fee as Record<string, unknown> : {};
  const transportFees = readNumber(finalFee['Transport Fees']);
  const totalBreakoff = readNumber(totalsRecord.bk);
  const regularFees = Math.max(totalBreakoff - transportFees, 0);
  const feeAmounts: Record<string, number> = {};
  titles.forEach((title) => {
    feeAmounts[title.displayName] = readNumber(finalFee[title.displayName]);
  });

  return {
    rollNo: readString(record.roll_no),
    enrollmentNo: readString(record.enrollment),
    studentName: readString(record.name),
    standardDivision: readString(record.stddiv),
    quota: readString(record.student_quota),
    mobile: readString(record.mobile),
    status: endDate || '-',
    transportFees,
    regularFees,
    regularPlusBus: transportFees + regularFees,
    feeAmounts,
    totalBreakoff,
    totalPaid,
    totalDiscount: readNumber(totalsRecord.discount),
    totalUnpaid: endDate === 'Inactive' ? 0 : readNumber(totalsRecord.remain),
  };
}

function getSingleValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] || '';
  return value || '';
}
