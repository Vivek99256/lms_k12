'use client';
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useMemo, useState } from 'react';
import { Loader2, Search } from 'lucide-react';

import {
  EmptyTableRow,
  Field,
  InlineMessage,
  LoadingRows,
  NativeMultiSelect,
  PageFrame,
  PageHeader,
  SectionPanel,
} from '@/app/fees/_components/fees-shared';
import { PaginationFooter, ReportActions, ReportSummaryBar, SummaryChip } from '@/app/fees/_components/fees-report-shared';
import {
  REPORT_PAGE_SIZE,
  appendIfValue,
  fetchStudentBreakoffReportGet,
  fetchStudentBreakoffReportIndex,
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

type MonthOption = {
  id: string;
  label: string;
};

type FeesTitle = {
  feesTitle: string;
  displayName: string;
};

type StudentBreakoffRow = {
  enrollmentNo: string;
  studentName: string;
  standardDivision: string;
  quota: string;
  uniqueId: string;
  feeAmounts: Record<string, number>;
  total: number;
};

type StudentBreakoffPayload = ReportApiPayload & {
  months_arr?: unknown;
  fees_titles?: unknown;
  fees_data?: unknown;
};

const academicFields: DropdownField[] = ['section', 'standard', 'division'];

export default function StudentBreakoffReportPage() {
  const [message, setMessage] = useState<ReportMessage | null>(null);
  const [loadingFilters, setLoadingFilters] = useState(true);
  const [loading, setLoading] = useState(false);
  const [monthOptions, setMonthOptions] = useState<MonthOption[]>([]);
  const [feesTitles, setFeesTitles] = useState<FeesTitle[]>([]);
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [rows, setRows] = useState<StudentBreakoffRow[]>([]);
  const [page, setPage] = useState(1);
  const [hasSearched, setHasSearched] = useState(false);
  const [academicFilters, setAcademicFilters] = useState<Partial<SearchDropdownValues>>({ section: '', standard: '', division: '' });
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [enrollmentNo, setEnrollmentNo] = useState('');
  const [mobileNo, setMobileNo] = useState('');
  const [uniqueId, setUniqueId] = useState('');

  const pagination = useMemo(() => paginateRows(rows, page, REPORT_PAGE_SIZE), [page, rows]);
  const totalAmount = useMemo(() => rows.reduce((sum, row) => sum + row.total, 0), [rows]);
  const feeTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    feesTitles.forEach((title) => {
      totals[title.feesTitle] = rows.reduce((sum, row) => sum + (row.feeAmounts[title.feesTitle] ?? 0), 0);
    });
    return totals;
  }, [feesTitles, rows]);
  const exportColumns = useMemo<TableExportColumn[]>(() => ([
    { key: 'enrollmentNo', label: 'GR No' },
    { key: 'studentName', label: 'Student name', width: '220px' },
    { key: 'standardDivision', label: 'Std / Div' },
    { key: 'quota', label: 'Quota' },
    { key: 'uniqueId', label: 'Unique ID' },
    ...feesTitles.map((title) => ({ key: title.feesTitle, label: title.displayName, align: 'right' as const })),
    { key: 'total', label: 'Total', align: 'right' },
  ]), [feesTitles]);
  const exportRows = useMemo<TableExportRow[]>(() => rows.map((row) => {
    const item: TableExportRow = {
      enrollmentNo: row.enrollmentNo,
      studentName: row.studentName,
      standardDivision: row.standardDivision,
      quota: row.quota,
      uniqueId: row.uniqueId,
      total: formatPlainAmount(row.total),
    };
    feesTitles.forEach((title) => {
      item[title.feesTitle] = formatPlainAmount(row.feeAmounts[title.feesTitle] ?? 0);
    });
    return item;
  }), [feesTitles, rows]);

  const loadFilters = async () => {
    setLoadingFilters(true);
    try {
      const { payload } = await fetchStudentBreakoffReportIndex<StudentBreakoffPayload>();
      setMonthOptions(readArrayRecords(payload.months_arr).map(() => ({ id: '', label: '' })));
      const monthsRecord = payload.months_arr && typeof payload.months_arr === 'object' ? payload.months_arr as Record<string, unknown> : {};
      setMonthOptions(Object.entries(monthsRecord).map(([id, label]) => ({ id, label: readString(label) })));
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Unable to load month filters.' });
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
      appendIfValue(params, 'first_name', firstName);
      appendIfValue(params, 'last_name', lastName);
      appendIfValue(params, 'enrollment_no', enrollmentNo);
      appendIfValue(params, 'mobile_no', mobileNo);
      appendIfValue(params, 'uniqueid', uniqueId);
      selectedMonths.forEach((month) => params.append('month[]', month));

      const { payload } = await fetchStudentBreakoffReportGet<StudentBreakoffPayload>(params);
      const titles = readArrayRecords(payload.fees_titles).map((record) => ({
        feesTitle: readString(record.fees_title),
        displayName: readString(record.display_name),
      })).filter((item) => item.feesTitle && item.displayName);
      const rowsData = readArrayRecords(payload.fees_data).flatMap((outer) =>
        Object.values(outer).map((item) => item && typeof item === 'object' ? item as Record<string, unknown> : {})
      );
      const mappedRows = rowsData.map((record) => mapBreakoffRow(record, titles));
      setFeesTitles(titles);
      setRows(mappedRows);
      setMessage({
        type: mappedRows.length > 0 ? 'success' : 'info',
        text: payload.message || (mappedRows.length > 0 ? `Loaded ${mappedRows.length} breakoff row${mappedRows.length === 1 ? '' : 's'}.` : 'No student breakoff rows found.'),
      });
    } catch (error) {
      setRows([]);
      setFeesTitles([]);
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Unable to fetch student breakoff report.' });
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
        title="Student Breakoff Report"
        description="Aggregate each student's fee breakoff across the selected mapped months and other-fee amounts."
        action={
          <ReportActions
            onExportCsv={() => exportRowsAsCsv({ filename: 'student-breakoff-report.csv', columns: exportColumns, rows: exportRows })}
            onExportExcel={() => exportRowsAsExcel({ filename: 'student-breakoff-report.xls', title: 'Student Breakoff Report', columns: exportColumns, rows: exportRows })}
            onExportPdf={() => exportRowsAsPdf({ filename: 'student-breakoff-report.pdf', title: 'Student Breakoff Report', subtitle: 'Legacy parity export', columns: exportColumns, rows: exportRows })}
            onPrint={() => openPrintPreview({ title: 'Student Breakoff Report', subtitle: 'Legacy parity print view', columns: exportColumns, rows: exportRows })}
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
          <Field label="Months">
            <NativeMultiSelect
              value={selectedMonths}
              onChange={setSelectedMonths}
              disabled={loadingFilters}
            >
              {monthOptions.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </NativeMultiSelect>
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
          <Table className="min-w-[1380px]">
            <TableHeader>
              <TableRow className="bg-slate-100 text-xs uppercase text-slate-700 hover:bg-slate-100">
                <TableHead>Sr no</TableHead>
                <TableHead>GR no</TableHead>
                <TableHead>Student name</TableHead>
                <TableHead>Std / Div</TableHead>
                <TableHead>Quota</TableHead>
                <TableHead>Unique ID</TableHead>
                {feesTitles.map((title) => (
                  <TableHead key={title.feesTitle} className="text-right">{title.displayName}</TableHead>
                ))}
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <LoadingRows colSpan={7 + feesTitles.length} label="Loading student breakoff report" />
              ) : pagination.rows.length > 0 ? (
                <>
                  {pagination.rows.map((row, index) => (
                    <TableRow key={`${row.enrollmentNo}-${index}`} className="odd:bg-white even:bg-slate-50/70">
                      <TableCell>{pagination.startIndex + index}</TableCell>
                      <TableCell>{row.enrollmentNo || '-'}</TableCell>
                      <TableCell className="font-semibold text-slate-950">{row.studentName || '-'}</TableCell>
                      <TableCell>{row.standardDivision || '-'}</TableCell>
                      <TableCell>{row.quota || '-'}</TableCell>
                      <TableCell>{row.uniqueId || '-'}</TableCell>
                      {feesTitles.map((title) => (
                        <TableCell key={title.feesTitle} className="text-right">{formatPlainAmount(row.feeAmounts[title.feesTitle] ?? 0)}</TableCell>
                      ))}
                      <TableCell className="text-right font-semibold">{formatPlainAmount(row.total)}</TableCell>
                    </TableRow>
                  ))}
                  {pagination.page === pagination.totalPages && (
                    <TableRow className="bg-slate-100/70 font-semibold">
                      <TableCell colSpan={6}>Page totals</TableCell>
                      {feesTitles.map((title) => (
                        <TableCell key={title.feesTitle} className="text-right">{formatPlainAmount(feeTotals[title.feesTitle] ?? 0)}</TableCell>
                      ))}
                      <TableCell className="text-right">{formatPlainAmount(totalAmount)}</TableCell>
                    </TableRow>
                  )}
                </>
              ) : (
                <EmptyTableRow colSpan={7 + feesTitles.length} label={hasSearched ? 'No breakoff rows match the current filters.' : 'Search to load the student breakoff report.'} />
              )}
            </TableBody>
          </Table>
        </div>
      </SectionPanel>
    </PageFrame>
  );
}

function mapBreakoffRow(record: Record<string, unknown>, titles: FeesTitle[]): StudentBreakoffRow {
  const breakoff = record.breakoff && typeof record.breakoff === 'object' ? record.breakoff as Record<string, unknown> : {};
  const otherFees = record.otherfees && typeof record.otherfees === 'object' ? record.otherfees as Record<string, unknown> : {};
  const feeAmounts: Record<string, number> = {};
  let total = 0;
  titles.forEach((title) => {
    let amount = 0;
    Object.values(breakoff).forEach((entry) => {
      if (entry && typeof entry === 'object') {
        const recordEntry = entry as Record<string, unknown>;
        const feeEntry = recordEntry[title.feesTitle];
        if (feeEntry && typeof feeEntry === 'object') {
          const feeRecord = feeEntry as Record<string, unknown>;
          amount += readNumber(feeRecord.amount) || readNumber(feeRecord.paid_amount);
        }
      }
    });
    amount += readNumber(otherFees[title.displayName]);
    feeAmounts[title.feesTitle] = amount;
    total += amount;
  });

  return {
    enrollmentNo: readString(record.enrollment_no),
    studentName: `${readString(record.student_name)} ${readString(record.surname)}`.trim(),
    standardDivision: `${readString(record.standard_name)}/${readString(record.division_name)}`,
    quota: readString(record.quota),
    uniqueId: readString(record.uniqueid),
    feeAmounts,
    total,
  };
}

function getSingleValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] || '';
  return value || '';
}
