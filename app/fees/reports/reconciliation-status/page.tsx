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
  fetchReconciliationStatusReportGet,
  formatDateDisplay,
  formatPlainAmount,
  readArrayRecords,
  readBooleanFlag,
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

type ReconciliationRow = {
  id: string;
  studentId: string;
  syear: string;
  amount: string;
  gatewayGroup: string;
  orderId: string;
  status: string;
  ledgerFinalized: boolean;
  looksStuck: boolean;
  createdAt: string;
};

type ReconciliationPayload = ReportApiPayload & {
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

export default function ReconciliationStatusPage() {
  const [message, setMessage] = useState<ReportMessage | null>(null);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<ReconciliationRow[]>([]);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ perPage: 25, total: 0, lastPage: 1 });
  const [hasSearched, setHasSearched] = useState(false);

  const [olderThanMinutes, setOlderThanMinutes] = useState('30');
  const [stuckOnly, setStuckOnly] = useState(true);

  const pagination: PaginatedResult<ReconciliationRow> = useMemo(() => ({
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
    { key: 'gatewayGroup', label: 'Gateway' },
    { key: 'orderId', label: 'Order ID' },
    { key: 'status', label: 'Status' },
    { key: 'ledgerFinalized', label: 'Ledger finalized' },
    { key: 'looksStuck', label: 'Looks stuck' },
    { key: 'amount', label: 'Amount', align: 'right' },
    { key: 'createdAt', label: 'Created' },
  ]), []);

  const exportRows = useMemo<TableExportRow[]>(() => rows.map((row) => ({
    id: row.id,
    studentId: row.studentId,
    gatewayGroup: row.gatewayGroup || '-',
    orderId: row.orderId || '-',
    status: row.status,
    ledgerFinalized: row.ledgerFinalized ? 'Yes' : 'No',
    looksStuck: row.looksStuck ? 'Yes' : 'No',
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
      if (olderThanMinutes.trim()) params.set('older_than_minutes', olderThanMinutes.trim());
      if (stuckOnly) params.set('stuck_only', '1');

      const { payload } = await fetchReconciliationStatusReportGet<ReconciliationPayload>(params);
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
        text: mapped.length > 0 ? `Loaded ${mapped.length} row${mapped.length === 1 ? '' : 's'}.` : 'No payments match these filters.',
      });
    } catch (error) {
      setRows([]);
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Unable to fetch reconciliation status.' });
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
        title="Reconciliation status"
        description="Read-only cross-reference of fees_payment against the fees_collect ledger, flagging payments that look pending with no matching ledger entry. This view performs no action — the existing manual (HDFC-only) confirm flow is unchanged and lives separately."
        action={
          <ReportActions
            onExportCsv={() => exportRowsAsCsv({ filename: 'reconciliation-status.csv', columns: exportColumns, rows: exportRows })}
            onExportExcel={() => exportRowsAsExcel({ filename: 'reconciliation-status.xls', title: 'Reconciliation Status', columns: exportColumns, rows: exportRows })}
            onExportPdf={() => exportRowsAsPdf({ filename: 'reconciliation-status.pdf', title: 'Reconciliation Status', subtitle: 'Read-only status view', columns: exportColumns, rows: exportRows })}
            onPrint={() => openPrintPreview({ title: 'Reconciliation Status', subtitle: 'Read-only status view', columns: exportColumns, rows: exportRows })}
          />
        }
      />

      {message && <InlineMessage type={message.type} text={message.text} />}

      <SectionPanel title="Filters">
        <div className="grid gap-3 lg:grid-cols-4">
          <Field label="Older than (minutes)">
            <Input type="number" min="1" value={olderThanMinutes} onChange={(event) => setOlderThanMinutes(event.target.value)} />
          </Field>
          <div className="flex items-end gap-2 pb-1">
            <input
              id="stuck-only"
              type="checkbox"
              checked={stuckOnly}
              onChange={(event) => setStuckOnly(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            <label htmlFor="stuck-only" className="text-sm font-medium text-slate-700">Stuck only</label>
          </div>
          <div className="flex items-end lg:col-span-2">
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
              <TableHead>Gateway</TableHead>
              <TableHead>Order ID</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Ledger finalized</TableHead>
              <TableHead>Looks stuck</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <LoadingRows colSpan={9} label="Loading reconciliation status" />
            ) : rows.length > 0 ? (
              rows.map((row) => (
                <TableRow key={row.id} className="odd:bg-white even:bg-slate-50/70">
                  <TableCell className="font-mono text-xs">{row.id}</TableCell>
                  <TableCell>{row.studentId}</TableCell>
                  <TableCell>{row.gatewayGroup || '-'}</TableCell>
                  <TableCell className="font-mono text-xs">{row.orderId || '-'}</TableCell>
                  <TableCell>
                    <StatusBadge variant={STATUS_VARIANT[row.status] ?? 'default'} label={row.status} />
                  </TableCell>
                  <TableCell>
                    <StatusBadge variant={row.ledgerFinalized ? 'success' : 'default'} label={row.ledgerFinalized ? 'Yes' : 'No'} />
                  </TableCell>
                  <TableCell>
                    {row.looksStuck ? <StatusBadge variant="error" label="Stuck" /> : <StatusBadge variant="default" label="No" />}
                  </TableCell>
                  <TableCell className="text-right">{formatPlainAmount(row.amount)}</TableCell>
                  <TableCell>{formatDateDisplay(row.createdAt)}</TableCell>
                </TableRow>
              ))
            ) : (
              <EmptyTableRow colSpan={9} label={hasSearched ? 'No payments match the current filters.' : 'Search to load reconciliation status.'} />
            )}
          </TableBody>
        </Table>
      </SectionPanel>
    </PageFrame>
  );
}

function mapRow(record: Record<string, unknown>): ReconciliationRow {
  return {
    id: readString(record.id),
    studentId: readString(record.student_id),
    syear: readString(record.syear),
    amount: readString(record.amount),
    gatewayGroup: readString(record.gateway_group),
    orderId: readString(record.order_id),
    status: readString(record.status) || 'unknown',
    ledgerFinalized: readBooleanFlag(record.ledger_finalized),
    looksStuck: readBooleanFlag(record.looks_stuck),
    createdAt: readString(record.created_at),
  };
}
