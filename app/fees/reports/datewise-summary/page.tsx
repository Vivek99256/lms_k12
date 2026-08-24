'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, Search } from 'lucide-react';

import {
  EmptyTableRow,
  Field,
  InlineMessage,
  LoadingRows,
  NativeMultiSelect,
  NativeSelect,
  PageFrame,
  PageHeader,
  SectionPanel,
} from '@/app/fees/_components/fees-shared';
import { ReportActions, ReportSummaryBar, SummaryChip } from '@/app/fees/_components/fees-report-shared';
import {
  appendIfValue,
  fetchDatewiseSummaryFeesTitleGet,
  fetchDatewiseSummaryReportGet,
  fetchDatewiseSummaryReportIndex,
  formatPlainAmount,
  readArrayRecords,
  type ReportApiPayload,
  type ReportMessage,
} from '@/app/fees/_lib/fees-report-utils';
import { readNumber, readString } from '@/app/fees/_lib/fees-api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { exportRowsAsCsv, exportRowsAsExcel, exportRowsAsPdf, openPrintPreview, type TableExportColumn, type TableExportRow } from '@/lib/table-export';

type ReceiptTitleOption = {
  id: string;
  label: string;
  heads: string;
};

type FeesHeadOption = {
  id: string;
  label: string;
};

type DatewiseRow = {
  receiptNo: string;
  studentName: string;
  standardDivision: string;
  bankName: string;
  chequeNo: string;
  remarks: string;
  amount: number;
};

type DatewiseGroup = {
  key: string;
  date: string;
  paymentMode: string;
  rows: DatewiseRow[];
  total: number;
};

type DatewisePayload = ReportApiPayload & {
  receipt_title?: unknown;
  feesHead?: unknown;
  payment_mode?: unknown;
  datewiseData?: unknown;
  school_details?: unknown;
  selfeesHead?: unknown;
};

export default function DatewiseSummaryReportPage() {
  const [message, setMessage] = useState<ReportMessage | null>(null);
  const [loadingFilters, setLoadingFilters] = useState(true);
  const [loadingHeads, setLoadingHeads] = useState(false);
  const [loading, setLoading] = useState(false);
  const [receiptTitles, setReceiptTitles] = useState<ReceiptTitleOption[]>([]);
  const [paymentModes, setPaymentModes] = useState<{ value: string; label: string }[]>([]);
  const [feesHeads, setFeesHeads] = useState<FeesHeadOption[]>([]);
  const [selectedReceiptTitle, setSelectedReceiptTitle] = useState('');
  const [selectedPaymentMode, setSelectedPaymentMode] = useState('');
  const [selectedFeesHeads, setSelectedFeesHeads] = useState<string[]>([]);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [groups, setGroups] = useState<DatewiseGroup[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  const grandTotal = useMemo(() => groups.reduce((sum, group) => sum + group.total, 0), [groups]);

  const exportColumns = useMemo<TableExportColumn[]>(() => [
    { key: 'date', label: 'Date' },
    { key: 'paymentMode', label: 'Payment mode' },
    { key: 'receiptNo', label: 'Receipt no' },
    { key: 'studentName', label: 'Student name', width: '220px' },
    { key: 'standardDivision', label: 'Std / Div' },
    { key: 'bankName', label: 'Bank name' },
    { key: 'chequeNo', label: 'Cheque no / Ref no' },
    { key: 'remarks', label: 'Remarks', width: '220px' },
    { key: 'amount', label: 'Amount', align: 'right' },
  ], []);
  const exportRows = useMemo<TableExportRow[]>(() => groups.flatMap((group) => group.rows.map((row) => ({
    date: group.date,
    paymentMode: group.paymentMode,
    receiptNo: row.receiptNo,
    studentName: row.studentName,
    standardDivision: row.standardDivision,
    bankName: row.bankName,
    chequeNo: row.chequeNo,
    remarks: row.remarks,
    amount: formatPlainAmount(row.amount),
  }))), [groups]);

  async function loadFeesHeads(heads: string, selected?: string[], receiptTitleId?: string) {
    if (!heads) {
      setFeesHeads([]);
      setSelectedFeesHeads([]);
      return;
    }

    setLoadingHeads(true);
    try {
      const params = new URLSearchParams();
      params.set('heads', heads);
      const { payload } = await fetchDatewiseSummaryFeesTitleGet<ReportApiPayload>(params);
      const options = readArrayRecords(payload).map((record) => ({
        id: readString(record.id),
        label: readString(record.display_name),
      })).filter((item) => item.id && item.label);
      setFeesHeads(options);
      const selectedHeadIds = selected && selected.length > 0 ? selected : options.map((option) => option.id);
      setSelectedFeesHeads(selectedHeadIds);
      if (!hasSearched && receiptTitleId && selectedHeadIds.length > 0) {
        await runSearch({
          receiptTitle: receiptTitleId,
          feesHeadIds: selectedHeadIds,
          paymentMode: selectedPaymentMode,
          from: fromDate,
          to: toDate,
        });
      }
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Unable to load fee heads.' });
    } finally {
      setLoadingHeads(false);
    }
  }

  const handleReceiptTitleChange = async (value: string) => {
    setSelectedReceiptTitle(value);
    const selected = receiptTitles.find((item) => item.id === value);
    await loadFeesHeads(selected?.heads || '', undefined, value);
  };

  const runSearch = async ({
    receiptTitle,
    feesHeadIds,
    paymentMode,
    from,
    to,
  }: {
    receiptTitle: string;
    feesHeadIds: string[];
    paymentMode: string;
    from: string;
    to: string;
  }) => {
    if (!receiptTitle) {
      setMessage({ type: 'info', text: 'Select an institute before searching the datewise summary report.' });
      setGroups([]);
      setHasSearched(false);
      return;
    }

    if (feesHeadIds.length === 0) {
      setMessage({ type: 'info', text: 'No fee heads are available for the selected institute and receipt title.' });
      setGroups([]);
      setHasSearched(true);
      return;
    }

    setLoading(true);
    setHasSearched(true);
    setMessage(null);
    try {
      const params = new URLSearchParams();
      appendIfValue(params, 'receipt_title', receiptTitle);
      appendIfValue(params, 'payment_mode', paymentMode);
      appendIfValue(params, 'from_date', from);
      appendIfValue(params, 'to_date', to);
      params.set('search', '1');
      feesHeadIds.forEach((head) => params.append('fees_head[]', head));

      const { payload } = await fetchDatewiseSummaryReportGet<DatewisePayload>(params);
      const groupsRecord = payload.datewiseData && typeof payload.datewiseData === 'object' ? payload.datewiseData as Record<string, unknown> : {};
      const mappedGroups = Object.entries(groupsRecord).map(([key, value]) => {
        const [date, paymentMode] = key.split('||');
        const rows = readArrayRecords(value).map((record) => ({
          receiptNo: readString(record.receipt_no),
          studentName: readString(record.student_name).toUpperCase(),
          standardDivision: `${readString(record.short_standard_name).toUpperCase()} - ${readString(record.div_name)}`,
          bankName: readString(record.cheque_bank_name),
          chequeNo: readString(record.cheque_no),
          remarks: readString(record.remarks),
          amount: readNumber(record.total_amount),
        }));
        return {
          key,
          date,
          paymentMode,
          rows,
          total: rows.reduce((sum, row) => sum + row.amount, 0),
        };
      });
      setGroups(mappedGroups);
      setMessage({
        type: mappedGroups.length > 0 ? 'success' : 'info',
        text: payload.message || (mappedGroups.length > 0 ? `Loaded ${mappedGroups.length} datewise group${mappedGroups.length === 1 ? '' : 's'}.` : 'No datewise summary rows found.'),
      });
    } catch (error) {
      setGroups([]);
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Unable to fetch datewise summary report.' });
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    await runSearch({
      receiptTitle: selectedReceiptTitle,
      feesHeadIds: selectedFeesHeads,
      paymentMode: selectedPaymentMode,
      from: fromDate,
      to: toDate,
    });
  };

  useEffect(() => {
    const load = async () => {
      setLoadingFilters(true);
      try {
        const { payload } = await fetchDatewiseSummaryReportIndex<DatewisePayload>();
        const titles = readArrayRecords(payload.receipt_title).map((record) => ({
          id: readString(record.sort_order),
          label: readString(record.receipt_line_2 || record.receipt_line_3),
          heads: readString(record.heads),
        })).filter((item) => item.id);
        setReceiptTitles(titles);
        const modesRecord = payload.payment_mode && typeof payload.payment_mode === 'object' ? payload.payment_mode as Record<string, unknown> : {};
        setPaymentModes(Object.entries(modesRecord).map(([key, value]) => ({ value: key, label: readString(value) })));
        if (titles.length > 0) {
          setSelectedReceiptTitle(titles[0].id);
          await loadFeesHeads(titles[0].heads, undefined, titles[0].id);
        }
      } catch (error) {
        setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Unable to load datewise summary filters.' });
      } finally {
        setLoadingFilters(false);
      }
    };
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <PageFrame>
      <PageHeader
        title="DateWise Summary Report"
        description="Group fee receipts by date and payment mode with receipt-title driven fee-head selection."
        action={
          <ReportActions
            onExportCsv={() => exportRowsAsCsv({ filename: 'datewise-summary-report.csv', columns: exportColumns, rows: exportRows })}
            onExportExcel={() => exportRowsAsExcel({ filename: 'datewise-summary-report.xls', title: 'DateWise Summary Report', columns: exportColumns, rows: exportRows })}
            onExportPdf={() => exportRowsAsPdf({ filename: 'datewise-summary-report.pdf', title: 'DateWise Summary Report', subtitle: 'Legacy parity export', columns: exportColumns, rows: exportRows })}
            onPrint={() => openPrintPreview({ title: 'DateWise Summary Report', subtitle: 'Legacy parity print view', columns: exportColumns, rows: exportRows })}
          />
        }
      />

      {message && <InlineMessage type={message.type} text={message.text} />}

      <SectionPanel title="Filters">
        <div className="grid gap-3 lg:grid-cols-4">
          <Field label="Select institute">
            <NativeSelect value={selectedReceiptTitle} onChange={(value) => { void handleReceiptTitleChange(value); }} disabled={loadingFilters}>
              <option value="">Select institute</option>
              {receiptTitles.map((item) => (
                <option key={item.id} value={item.id}>{item.label}</option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Fees head">
            <NativeMultiSelect
              value={selectedFeesHeads}
              onChange={setSelectedFeesHeads}
              disabled={loadingHeads || feesHeads.length === 0}
            >
              {feesHeads.map((head) => (
                <option key={head.id} value={head.id}>{head.label}</option>
              ))}
            </NativeMultiSelect>
          </Field>
          <Field label="Payment mode">
            <NativeSelect value={selectedPaymentMode} onChange={setSelectedPaymentMode} disabled={loadingFilters}>
              <option value="">Select mode</option>
              {paymentModes.map((mode) => (
                <option key={mode.value} value={mode.value}>{mode.label}</option>
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

      <SectionPanel>
        {groups.length > 0 && (
          <ReportSummaryBar>
            <SummaryChip label="Groups" value={String(groups.length)} />
            <SummaryChip label="Grand total" value={formatPlainAmount(grandTotal)} />
            <SummaryChip label="Payment mode" value={selectedPaymentMode || 'All'} />
          </ReportSummaryBar>
        )}
        <div className="mt-4 space-y-5">
          {loading ? (
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <Table>
                <TableBody>
                  <LoadingRows colSpan={8} label="Loading datewise summary report" />
                </TableBody>
              </Table>
            </div>
          ) : groups.length > 0 ? (
            groups.map((group) => (
              <section key={group.key} className="overflow-hidden rounded-lg border border-slate-200">
                <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800">
                  Date: {group.date} | Payment mode: {group.paymentMode}
                </div>
                <Table className="min-w-[1100px]">
                  <TableHeader>
                    <TableRow className="bg-slate-100 text-xs uppercase text-slate-700 hover:bg-slate-100">
                      <TableHead>Sr no</TableHead>
                      <TableHead>Receipt no</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Std</TableHead>
                      {selectedPaymentMode.toUpperCase() !== 'CASH' && <TableHead>Bank name</TableHead>}
                      {selectedPaymentMode.toUpperCase() !== 'CASH' && <TableHead>Cheque no / Ref no</TableHead>}
                      <TableHead>Remarks</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {group.rows.map((row, index) => (
                      <TableRow key={`${group.key}-${row.receiptNo}-${index}`} className="odd:bg-white even:bg-slate-50/70">
                        <TableCell>{index + 1}</TableCell>
                        <TableCell>{row.receiptNo}</TableCell>
                        <TableCell className="font-semibold text-slate-950">{row.studentName}</TableCell>
                        <TableCell>{row.standardDivision}</TableCell>
                        {selectedPaymentMode.toUpperCase() !== 'CASH' && <TableCell>{row.bankName || '-'}</TableCell>}
                        {selectedPaymentMode.toUpperCase() !== 'CASH' && <TableCell>{row.chequeNo || '-'}</TableCell>}
                        <TableCell>{row.remarks || '-'}</TableCell>
                        <TableCell className="text-right font-semibold">{formatPlainAmount(row.amount)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-slate-100/70 font-semibold">
                      <TableCell colSpan={selectedPaymentMode.toUpperCase() !== 'CASH' ? 7 : 5} className="text-right">Date wise total fees</TableCell>
                      <TableCell className="text-right">{formatPlainAmount(group.total)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </section>
            ))
          ) : (
            <div className="rounded-lg border border-slate-200 bg-white">
              <Table>
                <TableBody>
                  <EmptyTableRow colSpan={8} label={hasSearched ? 'No datewise summary rows match the current filters.' : 'Search to load the datewise summary report.'} />
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </SectionPanel>
    </PageFrame>
  );
}
