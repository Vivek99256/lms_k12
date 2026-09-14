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
import { PaginationFooter, ReportActions } from '@/app/fees/_components/fees-report-shared';
import {
  fetchOnlinePaymentsReportGet,
  formatDateDisplay,
  formatPlainAmount,
  readArrayRecords,
  type PaginatedResult,
  type ReportApiPayload,
  type ReportMessage,
} from '@/app/fees/_lib/fees-report-utils';
import { readString } from '@/app/fees/_lib/fees-api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StatusBadge } from '@/components/ui/status-badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { exportRowsAsCsv, exportRowsAsExcel, exportRowsAsPdf, openPrintPreview, type TableExportColumn, type TableExportRow } from '@/lib/table-export';

type OnlinePaymentRow = {
  id: string;
  studentId: string;
  syear: string;
  amount: string;
  gatewayGroup: string;
  gatewayGroupLabel: string;
  orderId: string;
  status: string;
  createdAt: string;
};

type OnlinePaymentsPayload = ReportApiPayload & {
  data?: unknown;
  meta?: { current_page?: number; per_page?: number; total?: number; last_page?: number };
};

const STATUS_VARIANT: Record<string, 'success' | 'pending' | 'error' | 'default'> = {
  success: 'success',
  pending: 'pending',
  failed: 'error',
  refunded: 'default',
  unknown: 'default',
};

export default function OnlinePaymentsReportPage() {
  const [message, setMessage] = useState<ReportMessage | null>(null);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<OnlinePaymentRow[]>([]);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ perPage: 25, total: 0, lastPage: 1 });
  const [hasSearched, setHasSearched] = useState(false);

  const [studentId, setStudentId] = useState('');
  const [gateway, setGateway] = useState('');
  const [status, setStatus] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const pagination: PaginatedResult<OnlinePaymentRow> = useMemo(() => ({
    rows,
    page,
    pageSize: meta.perPage,
    totalPages: Math.max(1, meta.lastPage),
    totalItems: meta.total,
    startIndex: rows.length > 0 ? (page - 1) * meta.perPage + 1 : 0,
    endIndex: rows.length > 0 ? (page - 1) * meta.perPage + rows.length : 0,
  }), [rows, page, meta]);

  const exportColumns = useMemo<TableExportColumn[]>(() => ([
    { key: 'id', label: 'ID' },
    { key: 'studentId', label: 'Student ID' },
    { key: 'syear', label: 'Year' },
    { key: 'gatewayGroupLabel', label: 'Gateway' },
    { key: 'orderId', label: 'Order ID' },
    { key: 'status', label: 'Status' },
    { key: 'amount', label: 'Amount', align: 'right' },
    { key: 'createdAt', label: 'Created' },
  ]), []);

  const exportRows = useMemo<TableExportRow[]>(() => rows.map((row) => ({
    id: row.id,
    studentId: row.studentId,
    syear: row.syear,
    gatewayGroupLabel: row.gatewayGroupLabel,
    orderId: row.orderId || '-',
    status: row.status,
    amount: formatPlainAmount(row.amount),
    createdAt: formatDateDisplay(row.createdAt),
  })), [rows]);

  const handleSearch = async (targetPage = 1) => {
    setLoading(true);
    setHasSearched(true);
    setMessage(null);
    try {
      const params = new URLSearchParams();
      params.set('page', String(targetPage));
      if (studentId.trim()) params.set('student_id', studentId.trim());
      if (gateway) params.set('gateway', gateway);
      if (status) params.set('status', status);
      if (fromDate) params.set('from_date', fromDate);
      if (toDate) params.set('to_date', toDate);

      const { payload } = await fetchOnlinePaymentsReportGet<OnlinePaymentsPayload>(params);
      const mapped = readArrayRecords(payload.data).map(mapRow);

      setRows(mapped);
      setPage(payload.meta?.current_page ?? targetPage);
      setMeta({
        perPage: payload.meta?.per_page ?? 25,
        total: payload.meta?.total ?? mapped.length,
        lastPage: payload.meta?.last_page ?? 1,
      });
      setMessage({
        type: mapped.length > 0 ? 'success' : 'info',
        text: mapped.length > 0 ? `Loaded ${mapped.length} online payment row${mapped.length === 1 ? '' : 's'}.` : 'No online payment records found for these filters.',
      });
    } catch (error) {
      setRows([]);
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Unable to fetch online payments.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (hasSearched) return;
    const timer = window.setTimeout(() => { void handleSearch(1); }, 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasSearched]);

  return (
    <PageFrame>
      <PageHeader
        title="Online payments"
        description="Read-only view of every online gateway payment attempt — pending, successful, and failed — sourced directly from fees_payment. This does not affect the ledger, receipts, or reconciliation in any way."
        action={
          <ReportActions
            onExportCsv={() => exportRowsAsCsv({ filename: 'online-payments.csv', columns: exportColumns, rows: exportRows })}
            onExportExcel={() => exportRowsAsExcel({ filename: 'online-payments.xls', title: 'Online Payments', columns: exportColumns, rows: exportRows })}
            onExportPdf={() => exportRowsAsPdf({ filename: 'online-payments.pdf', title: 'Online Payments', subtitle: 'Gateway transaction log', columns: exportColumns, rows: exportRows })}
            onPrint={() => openPrintPreview({ title: 'Online Payments', subtitle: 'Gateway transaction log', columns: exportColumns, rows: exportRows })}
          />
        }
      />

      {message && <InlineMessage type={message.type} text={message.text} />}

      <SectionPanel title="Filters">
        <div className="grid gap-3 lg:grid-cols-6">
          <Field label="Student ID">
            <Input value={studentId} onChange={(event) => setStudentId(event.target.value)} />
          </Field>
          <Field label="Gateway">
            <select
              value={gateway}
              onChange={(event) => setGateway(event.target.value)}
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-[var(--primary-blue)] focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="">All gateways</option>
              <option value="hdfc">HDFC</option>
              <option value="icici">ICICI</option>
              <option value="axis">Axis</option>
              <option value="aggre_pay">Aggre Pay</option>
              <option value="razorpay">Razorpay</option>
              <option value="payphi">PayPhi</option>
            </select>
          </Field>
          <Field label="Status">
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-[var(--primary-blue)] focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="">All statuses</option>
              <option value="pending">Pending</option>
              <option value="success">Success</option>
              <option value="failed">Failed</option>
              <option value="refunded">Refunded</option>
              <option value="unknown">Unknown</option>
            </select>
          </Field>
          <Field label="From date">
            <Input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
          </Field>
          <Field label="To date">
            <Input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
          </Field>
          <div className="flex items-end">
            <Button type="button" className="h-10 w-full" onClick={() => handleSearch(1)} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Search
            </Button>
          </div>
        </div>
      </SectionPanel>

      <SectionPanel footer={<PaginationFooter pagination={pagination} onPageChange={(nextPage) => handleSearch(nextPage)} />}>
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-100 text-xs uppercase text-slate-700 hover:bg-slate-100">
              <TableHead>ID</TableHead>
              <TableHead>Student ID</TableHead>
              <TableHead>Year</TableHead>
              <TableHead>Gateway</TableHead>
              <TableHead>Order ID</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <LoadingRows colSpan={8} label="Loading online payments" />
            ) : rows.length > 0 ? (
              rows.map((row) => (
                <TableRow key={row.id} className="odd:bg-white even:bg-slate-50/70">
                  <TableCell className="font-mono text-xs">{row.id}</TableCell>
                  <TableCell>{row.studentId}</TableCell>
                  <TableCell>{row.syear}</TableCell>
                  <TableCell title={row.gatewayGroupLabel}>{row.gatewayGroup || '-'}</TableCell>
                  <TableCell className="font-mono text-xs">{row.orderId || '-'}</TableCell>
                  <TableCell>
                    <StatusBadge variant={STATUS_VARIANT[row.status] ?? 'default'} label={row.status} />
                  </TableCell>
                  <TableCell className="text-right">{formatPlainAmount(row.amount)}</TableCell>
                  <TableCell>{formatDateDisplay(row.createdAt)}</TableCell>
                </TableRow>
              ))
            ) : (
              <EmptyTableRow colSpan={8} label={hasSearched ? 'No online payments match the current filters.' : 'Search to load online payments.'} />
            )}
          </TableBody>
        </Table>
      </SectionPanel>
    </PageFrame>
  );
}

function mapRow(record: Record<string, unknown>): OnlinePaymentRow {
  return {
    id: readString(record.id),
    studentId: readString(record.student_id),
    syear: readString(record.syear),
    amount: readString(record.amount),
    gatewayGroup: readString(record.gateway_group),
    gatewayGroupLabel: readString(record.gateway_group_label),
    orderId: readString(record.order_id),
    status: readString(record.status) || 'unknown',
    createdAt: readString(record.created_at),
  };
}
