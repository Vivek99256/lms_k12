'use client';

import { useEffect, useMemo, useState } from 'react';
import { Download, FileText, Loader2, Printer, Search } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
import { downloadFile, escapeCsv, MessageState, normalizePayload, readMessage, readStatus } from '@/app/library/_lib/library-module-utils';

type StatusType = {
  id: string;
  name: string;
};

type RemarkRecord = {
  id: string;
  itemCode: string;
  title: string;
  collectionType: string;
  remarks: string;
  itemStatusId: string;
};

function parseStatusTypes(payload: Record<string, unknown>): StatusType[] {
  return toArray(payload.statusTypes).map((item, index) => {
    const record = asRecord(item);
    return {
      id: readString(record.id) || `${index}`,
      name: readString(record.item_status_name),
    };
  }).filter((item) => item.id && item.name);
}

function parseRecords(payload: Record<string, unknown>): RemarkRecord[] {
  return toArray(payload.bookData).map((item, index) => {
    const record = asRecord(item);
    return {
      id: readString(record.id) || `${index}`,
      itemCode: readString(record.item_code),
      title: readString(record.book_title),
      collectionType: readString(record.collection_type),
      remarks: readString(record.remarks),
      itemStatusId: readString(record.item_status_id),
    };
  });
}

function printRows(rows: RemarkRecord[], statusTypes: StatusType[], remarksMap: Record<string, string>, statusMap: Record<string, string>) {
  const statusLookup = statusTypes.reduce<Record<string, string>>((acc, item) => {
    acc[item.id] = item.name;
    return acc;
  }, {});

  const html = `
    <html>
      <head>
        <title>Add Book Remark</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 24px; }
          table { border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; font-size: 12px; vertical-align: top; }
          th { background: #f1f5f9; }
        </style>
      </head>
      <body>
        <h2>Add Book Remark</h2>
        <table>
          <thead>
            <tr>
              <th>Sr No</th>
              <th>Item Code</th>
              <th>Title</th>
              <th>Collection Type</th>
              <th>Remarks</th>
              <th>Item Status</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((row, index) => `<tr><td>${index + 1}</td><td>${row.itemCode || '-'}</td><td>${row.title || '-'}</td><td>${row.collectionType || '-'}</td><td>${remarksMap[row.id] || row.remarks || '-'}</td><td>${statusLookup[statusMap[row.id] || row.itemStatusId] || '-'}</td></tr>`).join('')}
          </tbody>
        </table>
      </body>
    </html>
  `;

  const printWindow = window.open('', '_blank', 'width=1200,height=900');
  if (!printWindow) return;
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}

export default function AddBookRemarkPage() {
  const session = useMemo(() => getFeesSession(), []);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<MessageState | null>(null);
  const [itemCode, setItemCode] = useState('');
  const [records, setRecords] = useState<RemarkRecord[]>([]);
  const [statusTypes, setStatusTypes] = useState<StatusType[]>([]);
  const [checkedRows, setCheckedRows] = useState<Record<string, boolean>>({});
  const [remarksMap, setRemarksMap] = useState<Record<string, string>>({});
  const [statusMap, setStatusMap] = useState<Record<string, string>>({});
  const [globalSearch, setGlobalSearch] = useState('');
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});

  const loadData = async (searchItem: string) => {
    if (!session.subInstituteId || !session.academicYearId) {
      setLoading(false);
      setMessage({ type: 'error', text: 'Session context is missing. Please sign in again.' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const params = new URLSearchParams({ path: 'scan_books_remarks' });
      if (searchItem.trim()) {
        params.set('item_code', searchItem.trim());
      }
      appendSessionParams(params, session);

      const response = await fetch(`/api/proxy?${params.toString()}`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      const payload = normalizePayload(await response.json());

      if (!response.ok) {
        throw new Error(readMessage(payload, 'Unable to load book remarks.'));
      }

      const nextRecords = parseRecords(payload);
      const nextStatusTypes = parseStatusTypes(payload);
      setRecords(nextRecords);
      setStatusTypes(nextStatusTypes);
      setCheckedRows({});
      setRemarksMap(nextRecords.reduce<Record<string, string>>((acc, record) => {
        acc[record.id] = record.remarks;
        return acc;
      }, {}));
      setStatusMap(nextRecords.reduce<Record<string, string>>((acc, record) => {
        acc[record.id] = record.itemStatusId;
        return acc;
      }, {}));
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Unable to load book remarks.',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadData('');
    }, 0);

    return () => window.clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredRecords = useMemo(() => {
    return records.filter((record) => {
      const statusLabel = statusTypes.find((item) => item.id === (statusMap[record.id] || record.itemStatusId))?.name || '';
      const haystack = [record.itemCode, record.title, record.collectionType, remarksMap[record.id] || record.remarks, statusLabel].join(' ').toLowerCase();
      if (globalSearch && !haystack.includes(globalSearch.toLowerCase())) {
        return false;
      }

      const columns: Record<string, string> = {
        itemCode: record.itemCode,
        title: record.title,
        collectionType: record.collectionType,
        remarks: remarksMap[record.id] || record.remarks,
        status: statusLabel,
      };

      return Object.entries(columnFilters).every(([key, value]) => {
        if (!value.trim()) return true;
        return (columns[key] || '').toLowerCase().includes(value.toLowerCase());
      });
    });
  }, [columnFilters, globalSearch, records, remarksMap, statusMap, statusTypes]);

  const exportRows = useMemo(() => {
    const statusLookup = statusTypes.reduce<Record<string, string>>((acc, item) => {
      acc[item.id] = item.name;
      return acc;
    }, {});

    return filteredRecords.map((record, index) => ({
      'Sr No': String(index + 1),
      'Item Code': record.itemCode || '-',
      Title: record.title || '-',
      'Collection Type': record.collectionType || '-',
      Remarks: remarksMap[record.id] || record.remarks || '-',
      'Item Status': statusLookup[statusMap[record.id] || record.itemStatusId] || '-',
    }));
  }, [filteredRecords, remarksMap, statusMap, statusTypes]);

  const handleSearch = async () => {
    await loadData(itemCode);
  };

  const handleSubmit = async () => {
    const selectedIds = Object.entries(checkedRows).filter(([, checked]) => checked).map(([id]) => id);
    if (selectedIds.length === 0) {
      setMessage({ type: 'info', text: 'Please select at least one row.' });
      return;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      const params = new URLSearchParams({ path: 'scan_books_remarks/store' });
      const formData = new FormData();
      appendSessionFormData(formData, session);

      selectedIds.forEach((id) => {
        formData.set(`checked[${id}]`, '1');
        formData.set(`remarks[${id}]`, remarksMap[id] || '');
        formData.set(`item_status[${id}]`, statusMap[id] || '');
      });

      const response = await fetch(`/api/proxy?${params.toString()}`, {
        method: 'POST',
        body: formData,
      });
      const payload = normalizePayload(await response.json());

      if (!response.ok || readStatus(payload) !== 1) {
        throw new Error(readMessage(payload, 'Unable to save book remarks.'));
      }

      setMessage({ type: 'success', text: readMessage(payload, 'Book verification updated.') });
      await loadData(itemCode);
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Unable to save book remarks.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageFrame>
      <PageHeader
        title="Add Book Remark"
        description="Review scanned books, select rows to update, then save verification remarks and item status."
        action={(
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => {
              if (exportRows.length === 0) return;
              const headers = Object.keys(exportRows[0]);
              const csv = [headers.join(','), ...exportRows.map((row) => headers.map((header) => escapeCsv(row[header as keyof typeof row] ?? '')).join(','))].join('\n');
              downloadFile('book-remark.csv', csv, 'text/csv;charset=utf-8;');
            }}>
              <Download className="h-4 w-4" />
              CSV
            </Button>
            <Button type="button" variant="outline" onClick={() => {
              if (exportRows.length === 0) return;
              const headers = Object.keys(exportRows[0]);
              const lines = [headers.join('\t'), ...exportRows.map((row) => headers.map((header) => String(row[header as keyof typeof row] ?? '')).join('\t'))];
              downloadFile('book-remark.xls', lines.join('\n'), 'application/vnd.ms-excel');
            }}>
              <FileText className="h-4 w-4" />
              Excel
            </Button>
            <Button type="button" variant="outline" onClick={() => printRows(filteredRecords, statusTypes, remarksMap, statusMap)}>
              <Printer className="h-4 w-4" />
              Print
            </Button>
          </div>
        )}
      />

      {message ? <InlineMessage type={message.type} text={message.text} /> : null}

      <SectionPanel title="Search" description="Laravel filters the verification table by item code and lets you update only the checked rows.">
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto]">
          <Field label="Item Code">
            <Input
              value={itemCode}
              onChange={(event) => setItemCode(event.target.value)}
              placeholder="Search Item Code"
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void handleSearch();
                }
              }}
            />
          </Field>
          <div className="flex items-end">
            <Button type="button" variant="outline" onClick={() => void handleSearch()} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Search
            </Button>
          </div>
        </div>
      </SectionPanel>

      <SectionPanel title="Verification Rows" description="Checked rows unlock the remark and status inputs, matching the legacy verification workflow.">
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Field label="Global Search">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={globalSearch}
                  onChange={(event) => setGlobalSearch(event.target.value)}
                  className="pl-9"
                  placeholder="Search all columns"
                />
              </div>
            </Field>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <Table className="min-w-[1200px]">
              <TableHeader>
                <TableRow className="bg-slate-100 hover:bg-slate-100">
                  <TableHead>Sr No</TableHead>
                  <TableHead>Item Code</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Collection Type</TableHead>
                  <TableHead>Remarks</TableHead>
                  <TableHead>Item Status</TableHead>
                </TableRow>
                <TableRow className="bg-white hover:bg-white">
                  <TableHead />
                  {['itemCode', 'title', 'collectionType', 'remarks', 'status'].map((key) => (
                    <TableHead key={key}>
                      <Input
                        value={columnFilters[key] ?? ''}
                        onChange={(event) => setColumnFilters((current) => ({ ...current, [key]: event.target.value }))}
                        placeholder="Filter"
                      />
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <LoadingRows colSpan={6} label="Loading book verification remarks" />
                ) : filteredRecords.length > 0 ? (
                  filteredRecords.map((record, index) => {
                    const enabled = !!checkedRows[record.id];

                    return (
                      <TableRow key={record.id} className="odd:bg-white even:bg-slate-50/60">
                        <TableCell>
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={enabled}
                              onChange={(event) => setCheckedRows((current) => ({ ...current, [record.id]: event.target.checked }))}
                            />
                            <span>{index + 1}</span>
                          </label>
                        </TableCell>
                        <TableCell>{record.itemCode || '-'}</TableCell>
                        <TableCell>{record.title || '-'}</TableCell>
                        <TableCell>{record.collectionType || '-'}</TableCell>
                        <TableCell className="min-w-72">
                          <Textarea
                            value={remarksMap[record.id] ?? ''}
                            onChange={(event) => setRemarksMap((current) => ({ ...current, [record.id]: event.target.value }))}
                            disabled={!enabled}
                            className="min-h-24 resize-y"
                          />
                        </TableCell>
                        <TableCell className="min-w-56">
                          <NativeSelect
                            value={statusMap[record.id] ?? ''}
                            onChange={(value) => setStatusMap((current) => ({ ...current, [record.id]: value }))}
                            disabled={!enabled}
                          >
                            <option value="">Select Status</option>
                            {statusTypes.map((type) => (
                              <option key={type.id} value={type.id}>
                                {type.name}
                              </option>
                            ))}
                          </NativeSelect>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <EmptyTableRow colSpan={6} label="No book verification rows available." />
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex justify-center">
            <Button type="button" onClick={() => void handleSubmit()} disabled={submitting || loading}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Submit
            </Button>
          </div>
        </div>
      </SectionPanel>
    </PageFrame>
  );
}
