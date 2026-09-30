'use client';

import { useEffect, useMemo, useState } from 'react';
import { Download, FileText, Loader2, Printer, Search } from 'lucide-react';

import SearchDropdown from '@/components/search-dropdown/SearchDropdown';
import type { SearchDropdownValues } from '@/components/search-dropdown/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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
import { appendSessionFormData, appendSessionParams, asRecord, getFeesSession, readString, toArray } from '@/app/fees/_lib/fees-api';
import { downloadFile, escapeCsv, MessageState, normalizePayload, sessionFormFields, submitBackendPost } from '@/app/library/_lib/library-module-utils';

type PrintType = 'member' | 'item_code';
type Row = {
  id: string;
  code: string;
  rollNo: string;
  title: string;
  studentName: string;
  standardDivision: string;
  classification: string;
};

function getSingleValue(value: SearchDropdownValues[keyof SearchDropdownValues] | undefined): string {
  return Array.isArray(value) ? value[0] || '' : value || '';
}

function parseRows(payload: Record<string, unknown>, printType: PrintType): Row[] {
  return toArray(payload.details).map((item, index) => {
    const record = asRecord(item);
    if (printType === 'member') {
      return {
        id: readString(record.enrollment_no) || `${index}`,
        code: readString(record.enrollment_no),
        rollNo: readString(record.roll_no),
        title: '',
        studentName: readString(record.student_name),
        standardDivision: [readString(record.standard), readString(record.division)].filter(Boolean).join('/'),
        classification: '',
      };
    }

    return {
      id: readString(record.item_code) || `${index}`,
      code: readString(record.item_code),
      rollNo: '',
      title: readString(record.book_title),
      studentName: '',
      standardDivision: '',
      classification: readString(record.classification),
    };
  });
}

export default function PrintBarcodePage() {
  const session = useMemo(() => getFeesSession(), []);
  const [printType, setPrintType] = useState<PrintType>('member');
  const [searchBy, setSearchBy] = useState('');
  const [fromItemCode, setFromItemCode] = useState('');
  const [toItemCode, setToItemCode] = useState('');
  const [academicFilters, setAcademicFilters] = useState<Partial<SearchDropdownValues>>({ section: '', standard: '', division: '' });
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [message, setMessage] = useState<MessageState | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [globalSearch, setGlobalSearch] = useState('');

  const filteredRows = useMemo(() => {
    if (!globalSearch) return rows;
    return rows.filter((row) => Object.values(row).join(' ').toLowerCase().includes(globalSearch.toLowerCase()));
  }, [globalSearch, rows]);

  const exportRows = useMemo<Record<string, string>[]>(() => filteredRows.map((row, index) => {
    const exportRow: Record<string, string> = { 'No.': String(index + 1) };
    if (printType === 'member') {
      exportRow['Member Id'] = row.code || '-';
      exportRow['Roll no.'] = row.rollNo || '-';
      exportRow['Student name'] = row.studentName || '-';
      exportRow['Std / Div'] = row.standardDivision || '-';
    } else {
      exportRow['Item Code'] = row.code || '-';
      exportRow.Title = row.title || '-';
      exportRow.Classification = row.classification || '-';
    }
    return exportRow;
  }), [filteredRows, printType]);

  const loadInitial = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ path: 'print_barcode' });
      appendSessionParams(params, session);
      const response = await fetch(`/api/proxy?${params.toString()}`, { headers: { Accept: 'application/json' } });
      const payload = normalizePayload(await response.json());
      setRows(parseRows(payload, 'member'));
      setPrintType('member');
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : "Couldn't load print barcode page. Try again." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadInitial();
    }, 0);

    return () => window.clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearch = async () => {
    setSearching(true);
    setMessage(null);
    try {
      const params = new URLSearchParams({ path: 'print_barcode' });
      const formData = new FormData();
      appendSessionFormData(formData, session);
      formData.set('print_type', printType);
      if (searchBy.trim()) formData.set('search_by', searchBy.trim());
      if (printType === 'member') {
        const grade = getSingleValue(academicFilters.section);
        const standard = getSingleValue(academicFilters.standard);
        const division = getSingleValue(academicFilters.division);
        if (grade) formData.set('grade', grade);
        if (standard) formData.set('standard', standard);
        if (division) formData.set('division', division);
      } else {
        if (fromItemCode.trim()) formData.set('from_item_code', fromItemCode.trim());
        if (toItemCode.trim()) formData.set('to_item_code', toItemCode.trim());
      }

      const response = await fetch(`/api/proxy?${params.toString()}`, { method: 'POST', body: formData });
      const payload = normalizePayload(await response.json());
      const nextRows = parseRows(payload, printType);
      setRows(nextRows);
      setSelectedIds([]);
      setMessage({ type: nextRows.length > 0 ? 'success' : 'info', text: nextRows.length > 0 ? `Loaded ${nextRows.length} row${nextRows.length === 1 ? '' : 's'}.` : 'No barcode rows found.' });
    } catch (error) {
      setRows([]);
      setSelectedIds([]);
      setMessage({ type: 'error', text: error instanceof Error ? error.message : "Couldn't search barcode rows. Try again." });
    } finally {
      setSearching(false);
    }
  };

  const handlePrintPdf = () => {
    const checkedRows = rows.filter((row) => selectedIds.includes(row.id));
    // A row with no member id / item code (Laravel's `code` field came back
    // empty) still renders with a synthetic, index-based `id` so it stays
    // selectable -- but there is nothing to encode as a barcode for it.
    // Sending an empty string in check_id[] crashes
    // LibraryReportController::generateBarcodePdf() ("You should provide a
    // barcode string"), which only reproduces once "select all" happens to
    // sweep one of these rows in alongside valid ones.
    const selectedRows = checkedRows.filter((row) => row.code.trim() !== '');
    const skippedCount = checkedRows.length - selectedRows.length;

    if (selectedRows.length === 0) {
      setMessage({ type: 'info', text: 'Select at least one row before printing.' });
      return;
    }

    if (skippedCount > 0) {
      setMessage({
        type: 'info',
        text: `Skipped ${skippedCount} selected row${skippedCount === 1 ? '' : 's'} with no ${printType === 'member' ? 'member id' : 'item code'} to print.`,
      });
    }

    const fields: Record<string, string | string[]> = {
      ...sessionFormFields(session),
      print_type: printType,
      'check_id[]': selectedRows.map((row) => row.code),
    };

    selectedRows.forEach((row) => {
      fields[`print_text[${row.code}]`] = printType === 'member' ? row.studentName : row.title;
      if (printType === 'item_code') {
        fields[`print_code[${row.code}]`] = row.classification;
      }
    });

    submitBackendPost('api/proxy-file?path=generateBarcodePdf', fields);
  };

  const allFilteredSelected = filteredRows.length > 0 && filteredRows.every((row) => selectedIds.includes(row.id));

  return (
    <PageFrame>
      <PageHeader
        title="Print barcode"
        description="Search member IDs or item codes, select rows and print barcodes."
        action={<div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => {
            if (exportRows.length === 0) return;
            const headers = Object.keys(exportRows[0]);
            const csv = [headers.join(','), ...exportRows.map((row) => headers.map((header) => escapeCsv(row[header] ?? '')).join(','))].join('\n');
            downloadFile('print-barcode.csv', csv, 'text/csv;charset=utf-8;');
          }}><Download className="h-4 w-4" />CSV</Button>
          <Button type="button" variant="outline" onClick={() => {
            if (exportRows.length === 0) return;
            const headers = Object.keys(exportRows[0]);
            const lines = [headers.join('\t'), ...exportRows.map((row) => headers.map((header) => row[header] ?? '').join('\t'))];
            downloadFile('print-barcode.xls', lines.join('\n'), 'application/vnd.ms-excel');
          }}><FileText className="h-4 w-4" />Excel</Button>
          <Button type="button" variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4" />Print</Button>
          <Button type="button" onClick={handlePrintPdf}>Print Barcode PDF</Button>
        </div>}
      />
      {message ? <InlineMessage type={message.type} text={message.text} /> : null}

      <SectionPanel title="Filters">
        <div className="grid gap-4 lg:grid-cols-4">
          <Field label="Search type">
            <NativeSelect value={printType} onChange={(value) => { setPrintType(value as PrintType); setSelectedIds([]); }}>
              <option value="member">Member ID</option>
              <option value="item_code">Item code</option>
            </NativeSelect>
          </Field>
          <Field label="Search by">
            <Input value={searchBy} onChange={(event) => setSearchBy(event.target.value)} placeholder="Search..." />
          </Field>
          {printType === 'member' ? (
            <div className="lg:col-span-2">
              <SearchDropdown
                fields={['section', 'standard', 'division']}
                values={academicFilters}
                labels={{ section: 'Grade', standard: 'Standard', division: 'Division' }}
                placeholders={{ section: 'Select grade', standard: 'Select standard', division: 'Select division' }}
                onChange={(values) => setAcademicFilters(values)}
              />
            </div>
          ) : (
            <>
              <Field label="From item code"><Input value={fromItemCode} onChange={(event) => setFromItemCode(event.target.value)} /></Field>
              <Field label="To item code"><Input value={toItemCode} onChange={(event) => setToItemCode(event.target.value)} /></Field>
            </>
          )}
          <div className="flex items-end">
            <Button type="button" onClick={() => void handleSearch()} disabled={loading || searching}>
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Search
            </Button>
          </div>
        </div>
      </SectionPanel>

      <SectionPanel title="Results">
        <div className="space-y-4">
          <Field label="Global search">
            <div className="relative max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input value={globalSearch} onChange={(event) => setGlobalSearch(event.target.value)} className="pl-9" placeholder="Search all columns" />
            </div>
          </Field>
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <Table className="min-w-[900px]">
              <TableHeader>
                <TableRow className="bg-slate-100 hover:bg-slate-100">
                  <TableHead>
                    <input
                      type="checkbox"
                      checked={allFilteredSelected}
                      onChange={(event) => setSelectedIds(event.target.checked ? filteredRows.map((row) => row.id) : [])}
                    />
                  </TableHead>
                  {printType === 'member' ? (
                    <>
                      <TableHead>Member ID</TableHead>
                      <TableHead>Roll no.</TableHead>
                      <TableHead>Student name</TableHead>
                      <TableHead>Std / Div</TableHead>
                    </>
                  ) : (
                    <>
                      <TableHead>Item code</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Classification</TableHead>
                    </>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? <LoadingRows colSpan={printType === 'member' ? 5 : 4} label="Loading barcode rows" /> : filteredRows.length > 0 ? filteredRows.map((row) => (
                  <TableRow key={row.id} className="odd:bg-white even:bg-slate-50/60">
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(row.id)}
                        onChange={(event) => setSelectedIds((current) => event.target.checked ? [...new Set([...current, row.id])] : current.filter((id) => id !== row.id))}
                      />
                    </TableCell>
                    {printType === 'member' ? (
                      <>
                        <TableCell>{row.code || '-'}</TableCell>
                        <TableCell>{row.rollNo || '-'}</TableCell>
                        <TableCell>{row.studentName || '-'}</TableCell>
                        <TableCell>{row.standardDivision || '-'}</TableCell>
                      </>
                    ) : (
                      <>
                        <TableCell>{row.code || '-'}</TableCell>
                        <TableCell>{row.title || '-'}</TableCell>
                        <TableCell>{row.classification || '-'}</TableCell>
                      </>
                    )}
                  </TableRow>
                )) : <EmptyTableRow colSpan={printType === 'member' ? 5 : 4} label="No barcode rows available." />}
              </TableBody>
            </Table>
          </div>
        </div>
      </SectionPanel>
    </PageFrame>
  );
}
