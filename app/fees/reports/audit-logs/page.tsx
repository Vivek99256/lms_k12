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
  fetchFeesAuditLogsReportGet,
  formatDateDisplay,
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

type AuditLogRow = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  actorName: string;
  subInstituteId: string;
  createdAt: string;
};

type AuditLogPayload = ReportApiPayload & {
  data?: unknown;
  meta?: { current_page?: number; per_page?: number; total?: number; last_page?: number };
};

const ACTION_VARIANT: Record<string, 'success' | 'pending' | 'error' | 'default'> = {
  GATEWAY_ORDER_CREATED: 'pending',
  GATEWAY_CALLBACK_RECEIVED: 'pending',
  GATEWAY_PAYMENT_SUCCESS: 'success',
  GATEWAY_PAYMENT_FAILED: 'error',
  GATEWAY_PAYMENT_PENDING: 'pending',
  RECONCILIATION_CONFIRMED: 'success',
  RECEIPT_REPRINTED: 'default',
  RECEIPT_GENERATED: 'success',
  PAYMENT_RECEIVED: 'success',
};

export default function FeesAuditLogsPage() {
  const [message, setMessage] = useState<ReportMessage | null>(null);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<AuditLogRow[]>([]);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ perPage: 25, total: 0, lastPage: 1 });
  const [hasSearched, setHasSearched] = useState(false);

  const [action, setAction] = useState('');
  const [entityId, setEntityId] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const pagination: PaginatedResult<AuditLogRow> = useMemo(() => ({
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
    { key: 'action', label: 'Action' },
    { key: 'entityType', label: 'Entity type' },
    { key: 'entityId', label: 'Entity ID' },
    { key: 'actorName', label: 'Actor' },
    { key: 'createdAt', label: 'Created' },
  ]), []);

  const exportRows = useMemo<TableExportRow[]>(() => rows.map((row) => ({
    id: row.id,
    action: row.action,
    entityType: row.entityType,
    entityId: row.entityId,
    actorName: row.actorName || 'System',
    createdAt: formatDateDisplay(row.createdAt),
  })), [rows]);

  const handleSearch = async (targetPage = 1) => {
    setLoading(true);
    setHasSearched(true);
    setMessage(null);
    try {
      const params = new URLSearchParams();
      params.set('page', String(targetPage));
      if (action) params.set('action', action);
      if (entityId.trim()) params.set('entity_id', entityId.trim());
      if (fromDate) params.set('from_date', fromDate);
      if (toDate) params.set('to_date', toDate);

      const { payload } = await fetchFeesAuditLogsReportGet<AuditLogPayload>(params);
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
        text: mapped.length > 0 ? `Loaded ${mapped.length} audit entr${mapped.length === 1 ? 'y' : 'ies'}.` : 'No audit entries match these filters.',
      });
    } catch (error) {
      setRows([]);
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Unable to fetch audit logs.' });
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
        title="Fees audit log"
        description="Read-only trail of fee-related audit events — gateway callbacks, payment outcomes, reconciliation confirms, receipt reprints, and manual collection receipts. Sourced from system_audit_logs; nothing here can be edited."
        action={
          <ReportActions
            onExportCsv={() => exportRowsAsCsv({ filename: 'fees-audit-log.csv', columns: exportColumns, rows: exportRows })}
            onExportExcel={() => exportRowsAsExcel({ filename: 'fees-audit-log.xls', title: 'Fees Audit Log', columns: exportColumns, rows: exportRows })}
            onExportPdf={() => exportRowsAsPdf({ filename: 'fees-audit-log.pdf', title: 'Fees Audit Log', subtitle: 'Read-only audit trail', columns: exportColumns, rows: exportRows })}
            onPrint={() => openPrintPreview({ title: 'Fees Audit Log', subtitle: 'Read-only audit trail', columns: exportColumns, rows: exportRows })}
          />
        }
      />

      {message && <InlineMessage type={message.type} text={message.text} />}

      <SectionPanel title="Filters">
        <div className="grid gap-3 lg:grid-cols-5">
          <Field label="Action">
            <select
              value={action}
              onChange={(event) => setAction(event.target.value)}
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-[var(--primary-blue)] focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="">All actions</option>
              <option value="GATEWAY_ORDER_CREATED">Gateway order created</option>
              <option value="GATEWAY_CALLBACK_RECEIVED">Gateway callback received</option>
              <option value="GATEWAY_PAYMENT_SUCCESS">Gateway payment success</option>
              <option value="GATEWAY_PAYMENT_FAILED">Gateway payment failed</option>
              <option value="GATEWAY_PAYMENT_PENDING">Gateway payment pending</option>
              <option value="RECONCILIATION_CONFIRMED">Reconciliation confirmed</option>
              <option value="RECEIPT_REPRINTED">Receipt reprinted</option>
              <option value="RECEIPT_GENERATED">Receipt generated</option>
              <option value="PAYMENT_RECEIVED">Payment received</option>
            </select>
          </Field>
          <Field label="Entity ID">
            <Input value={entityId} onChange={(event) => setEntityId(event.target.value)} />
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
              <TableHead>Action</TableHead>
              <TableHead>Entity type</TableHead>
              <TableHead>Entity ID</TableHead>
              <TableHead>Actor</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <LoadingRows colSpan={6} label="Loading audit log" />
            ) : rows.length > 0 ? (
              rows.map((row) => (
                <TableRow key={row.id} className="odd:bg-white even:bg-slate-50/70">
                  <TableCell className="font-mono text-xs">{row.id}</TableCell>
                  <TableCell>
                    <StatusBadge variant={ACTION_VARIANT[row.action] ?? 'default'} label={row.action.replace(/_/g, ' ')} />
                  </TableCell>
                  <TableCell>{row.entityType || '-'}</TableCell>
                  <TableCell className="font-mono text-xs">{row.entityId || '-'}</TableCell>
                  <TableCell>{row.actorName || 'System'}</TableCell>
                  <TableCell>{formatDateDisplay(row.createdAt)}</TableCell>
                </TableRow>
              ))
            ) : (
              <EmptyTableRow colSpan={6} label={hasSearched ? 'No audit entries match the current filters.' : 'Search to load the audit log.'} />
            )}
          </TableBody>
        </Table>
      </SectionPanel>
    </PageFrame>
  );
}

function mapRow(record: Record<string, unknown>): AuditLogRow {
  return {
    id: readString(record.id),
    action: readString(record.action),
    entityType: readString(record.entity_type),
    entityId: readString(record.entity_id),
    actorName: readString(record.actor_name),
    subInstituteId: readString(record.sub_institute_id),
    createdAt: readString(record.created_at),
  };
}
