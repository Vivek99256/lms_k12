'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, Search } from 'lucide-react';

import { EmptyTableRow, InlineMessage, LoadingRows, PageFrame, PageHeader, SectionPanel } from '@/app/fees/_components/fees-shared';
import { ReportActions } from '@/app/fees/_components/fees-report-shared';
import { appendIfValue, fetchFeesStructureReportPost, formatPlainAmount, type ReportApiPayload, type ReportMessage } from '@/app/fees/_lib/fees-report-utils';
import { readNumber, readString } from '@/app/fees/_lib/fees-api';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { SearchDropdown, type DropdownField, type SearchDropdownValues } from '@/components/search-dropdown';
import { exportRowsAsCsv, exportRowsAsExcel, exportRowsAsPdf, openPrintPreview, type TableExportColumn, type TableExportRow } from '@/lib/table-export';

type StructureRow = {
  standardName: string;
  quotaName: string;
  newAmounts: Record<string, number>;
  oldAmounts: Record<string, number>;
  newTotal: number;
  oldTotal: number;
};

type FeesStructurePayload = ReportApiPayload & {
  months_arr?: unknown;
  report_data?: unknown;
};

const academicFields: DropdownField[] = ['section', 'standard'];

export default function FeesStructureReportPage() {
  const [message, setMessage] = useState<ReportMessage | null>(null);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<StructureRow[]>([]);
  const [months, setMonths] = useState<{ id: string; label: string }[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [academicFilters, setAcademicFilters] = useState<Partial<SearchDropdownValues>>({ section: '', standard: '' });

  const exportColumns = useMemo<TableExportColumn[]>(() => ([
    { key: 'standardName', label: 'Standard' },
    { key: 'quotaName', label: 'Quota' },
    ...months.flatMap((month) => [
      { key: `new_${month.id}`, label: `New ${month.label}`, align: 'right' as const },
      { key: `old_${month.id}`, label: `Old ${month.label}`, align: 'right' as const },
    ]),
    { key: 'newTotal', label: 'New total', align: 'right' },
    { key: 'oldTotal', label: 'Old total', align: 'right' },
  ]), [months]);
  const exportRows = useMemo<TableExportRow[]>(() => rows.map((row) => {
    const item: TableExportRow = {
      standardName: row.standardName,
      quotaName: row.quotaName,
      newTotal: formatPlainAmount(row.newTotal),
      oldTotal: formatPlainAmount(row.oldTotal),
    };
    months.forEach((month) => {
      item[`new_${month.id}`] = row.newAmounts[month.id] ? formatPlainAmount(row.newAmounts[month.id]) : '-';
      item[`old_${month.id}`] = row.oldAmounts[month.id] ? formatPlainAmount(row.oldAmounts[month.id]) : '-';
    });
    return item;
  }), [months, rows]);

  const handleSearch = async () => {
    setLoading(true);
    setHasSearched(true);
    setMessage(null);
    try {
      const params = new URLSearchParams();
      appendIfValue(params, 'grade', getSingleValue(academicFilters.section));
      appendIfValue(params, 'standard', getSingleValue(academicFilters.standard));
      params.set('search', '1');
      const { payload } = await fetchFeesStructureReportPost<FeesStructurePayload>(params);
      const monthsRecord = payload.months_arr && typeof payload.months_arr === 'object' ? payload.months_arr as Record<string, unknown> : {};
      const monthList = Object.entries(monthsRecord).map(([id, label]) => ({ id, label: readString(label) }));
      const reportData = payload.report_data && typeof payload.report_data === 'object' ? payload.report_data as Record<string, unknown> : {};
      const mappedRows: StructureRow[] = [];

      Object.entries(reportData).forEach(([standardName, quotaValue]) => {
        if (quotaValue && typeof quotaValue === 'object') {
          Object.entries(quotaValue as Record<string, unknown>).forEach(([quotaName, typeValue]) => {
            const typeRecord = typeValue && typeof typeValue === 'object' ? typeValue as Record<string, unknown> : {};
            const newAmounts = toNumberMap(typeRecord.NEW);
            const oldAmounts = toNumberMap(typeRecord.OLD);
            mappedRows.push({
              standardName,
              quotaName,
              newAmounts,
              oldAmounts,
              newTotal: Object.values(newAmounts).reduce((sum, amount) => sum + amount, 0),
              oldTotal: Object.values(oldAmounts).reduce((sum, amount) => sum + amount, 0),
            });
          });
        }
      });

      setMonths(monthList);
      setRows(mappedRows);
      setMessage({
        type: mappedRows.length > 0 ? 'success' : 'info',
        text: payload.message || (mappedRows.length > 0 ? `Loaded ${mappedRows.length} fees structure row${mappedRows.length === 1 ? '' : 's'}.` : 'No fees structure rows found.'),
      });
    } catch (error) {
      setRows([]);
      setMonths([]);
      const errorMessage = error instanceof Error ? error.message : 'Unable to fetch fees structure report.';
      setMessage({
        type: 'error',
        text: /session token is missing|sign in again/i.test(errorMessage)
          ? 'Session expired. Please sign in again.'
          : errorMessage,
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
        title="Fees Structure Report"
        description="Compare class-quota fee structures for new and old students across the mapped academic months."
        action={
          <ReportActions
            onExportCsv={() => exportRowsAsCsv({ filename: 'fees-structure-report.csv', columns: exportColumns, rows: exportRows })}
            onExportExcel={() => exportRowsAsExcel({ filename: 'fees-structure-report.xls', title: 'Fees Structure Report', columns: exportColumns, rows: exportRows })}
            onExportPdf={() => exportRowsAsPdf({ filename: 'fees-structure-report.pdf', title: 'Fees Structure Report', subtitle: 'Legacy parity export', columns: exportColumns, rows: exportRows })}
            onPrint={() => openPrintPreview({ title: 'Fees Structure Report', subtitle: 'Legacy parity print view', columns: exportColumns, rows: exportRows })}
          />
        }
      />

      {message && <InlineMessage type={message.type} text={message.text} />}

      <SectionPanel title="Filters">
        <div className="grid gap-3 lg:grid-cols-4">
          <div className="lg:col-span-3">
            <SearchDropdown fields={academicFields} values={academicFilters} onChange={(values) => setAcademicFilters(values)} />
          </div>
          <div className="flex items-end">
            <Button type="button" className="h-10 w-full" onClick={handleSearch} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Search
            </Button>
          </div>
        </div>
      </SectionPanel>

      <SectionPanel>
        <Table className="min-w-[1900px]">
          <TableHeader>
            <TableRow className="bg-slate-100 text-xs uppercase text-slate-700 hover:bg-slate-100">
              <TableHead>Sr no</TableHead>
              <TableHead>Standard</TableHead>
              <TableHead>Quota</TableHead>
              {months.map((month) => (
                <TableHead key={`new-${month.id}`} className="text-right">New {month.label}</TableHead>
              ))}
              <TableHead className="text-right">New total</TableHead>
              {months.map((month) => (
                <TableHead key={`old-${month.id}`} className="text-right">Old {month.label}</TableHead>
              ))}
              <TableHead className="text-right">Old total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <LoadingRows colSpan={4 + (months.length * 2)} label="Loading fees structure report" />
            ) : rows.length > 0 ? (
              rows.map((row, index) => (
                <TableRow key={`${row.standardName}-${row.quotaName}-${index}`} className="odd:bg-white even:bg-slate-50/70">
                  <TableCell>{index + 1}</TableCell>
                  <TableCell className="font-semibold text-slate-950">{row.standardName}</TableCell>
                  <TableCell>{row.quotaName}</TableCell>
                  {months.map((month) => (
                    <TableCell key={`new-${month.id}`} className="text-right">{row.newAmounts[month.id] ? formatPlainAmount(row.newAmounts[month.id]) : '-'}</TableCell>
                  ))}
                  <TableCell className="text-right font-semibold">{formatPlainAmount(row.newTotal)}</TableCell>
                  {months.map((month) => (
                    <TableCell key={`old-${month.id}`} className="text-right">{row.oldAmounts[month.id] ? formatPlainAmount(row.oldAmounts[month.id]) : '-'}</TableCell>
                  ))}
                  <TableCell className="text-right font-semibold">{formatPlainAmount(row.oldTotal)}</TableCell>
                </TableRow>
              ))
            ) : (
              <EmptyTableRow colSpan={4 + (months.length * 2)} label={hasSearched ? 'No fees structure rows match the current filters.' : 'Search to load the fees structure report.'} />
            )}
          </TableBody>
        </Table>
      </SectionPanel>
    </PageFrame>
  );
}

function toNumberMap(value: unknown): Record<string, number> {
  const record = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const result: Record<string, number> = {};
  Object.entries(record).forEach(([key, amount]) => {
    result[key] = readNumber(amount);
  });
  return result;
}

function getSingleValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] || '';
  return value || '';
}
