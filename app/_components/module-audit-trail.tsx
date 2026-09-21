'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Search } from 'lucide-react';

import {
  EmptyTableRow,
  Field,
  InlineMessage,
  LoadingRows,
  NativeSelect,
  SectionPanel,
} from '@/app/fees/_components/fees-shared';
import { PaginationFooter, ReportActions } from '@/app/fees/_components/fees-report-shared';
import {
  paginateRows,
  type PaginatedResult,
  type ReportMessage,
} from '@/app/fees/_lib/fees-report-utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  exportRowsAsCsv,
  exportRowsAsExcel,
  exportRowsAsPdf,
  openPrintPreview,
  type TableExportColumn,
  type TableExportRow,
} from '@/lib/table-export';
import {
  loadUserLogUsers,
  searchUserLogs,
  type UserLogRecord,
  type UserOption,
} from '@/app/user_log/api';

/**
 * One module's audit trail — the body behind the Audit Trail tab, for any
 * module.
 *
 * This is the screen Fees → Audit trail has always shown, lifted out of
 * app/fees/audit-trail/page.tsx so the other 63 bars show it too rather than
 * each getting a copy with its own literal in it.
 *
 * It reads the same access log as the standalone User Log report, through
 * app/user_log/api.ts — same two endpoints, same session handling, same tenant
 * scoping — narrowed to this module. No second client, so the two screens
 * cannot drift apart.
 *
 * WHAT "THIS MODULE" MEANS. `access_log_route.module` is written by
 * LogRouteMiddleware as the first path segment of the URL that was opened, so
 * the narrowing is a match against the prefixes this module's own screens use.
 * They arrive from the category row (`audit_module_keys`) rather than being
 * written here, because one bar can span several — Exam logs under both 'exam'
 * and 'result' — and the Fees page's single `const FEES_MODULE = 'fees'` was
 * Fees being simple rather than the rule.
 *
 * The Module column the User Log report shows is dropped: within one module it
 * carries no information. Everything else — URL, action, timestamp, user — is
 * unchanged.
 *
 * Rendered inside a category page, which has already drawn the page frame and
 * the category heading, so this emits a section heading rather than a second
 * page header — the same arrangement the platform consoles use when embedded.
 */

const COLUMNS: TableExportColumn[] = [
  { key: 'serial', label: 'Sr. No.' },
  { key: 'date', label: 'Date & time' },
  { key: 'user', label: 'User' },
  { key: 'action', label: 'Action' },
  { key: 'url', label: 'URL' },
];

/** A handful of legacy rows append a token to the module: `fees?_token=…`. */
function logPrefix(record: UserLogRecord) {
  const [module] = record.module.split('?');
  return module.trim().toLowerCase();
}

function localIso(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** An audit trail needs the time of day, which formatDateDisplay drops. */
function formatTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value || '-';

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${day}-${month}-${date.getFullYear()} ${hours}:${minutes}:${seconds}`;
}

/** 'Fees' -> 'fees-audit-trail', for the exported files. */
function fileStem(label: string) {
  const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  return `${slug || 'module'}-audit-trail`;
}

export function ModuleAuditTrail({
  moduleKeys,
  label,
}: {
  /** The `access_log_route.module` prefixes this module's screens write. */
  moduleKeys: string[];
  /** The module's own name, for headings, messages and file names. */
  label: string;
}) {
  const today = new Date();
  const [fromDate, setFromDate] = useState(() =>
    localIso(new Date(today.getFullYear(), today.getMonth(), 1))
  );
  const [toDate, setToDate] = useState(() => localIso(today));
  const [selectedUserId, setSelectedUserId] = useState('');

  const [users, setUsers] = useState<UserOption[]>([]);
  const [rows, setRows] = useState<UserLogRecord[]>([]);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<ReportMessage | null>(null);

  // A Set, and stable across renders, because it is both the search's filter
  // and one of its dependencies.
  const prefixes = useMemo(
    () => new Set(moduleKeys.map((key) => key.trim().toLowerCase()).filter(Boolean)),
    [moduleKeys]
  );

  const search = useCallback(
    async (input: { fromDate: string; toDate: string; selectedUserId: string }) => {
      if (!input.fromDate || !input.toDate) {
        setMessage({ type: 'error', text: 'Select both dates.' });
        return;
      }
      if (input.fromDate > input.toDate) {
        setMessage({ type: 'error', text: 'The from date must be on or before the to date.' });
        return;
      }

      setLoading(true);
      setMessage(null);
      setQuery('');
      setPage(1);
      try {
        const logs = await searchUserLogs({
          fromDate: input.fromDate,
          toDate: input.toDate,
          selectedUserId: input.selectedUserId ? Number(input.selectedUserId) : null,
        });
        const moduleLogs = logs.filter((record) => prefixes.has(logPrefix(record)));

        setRows(moduleLogs);
        setMessage({
          type: moduleLogs.length > 0 ? 'success' : 'info',
          text:
            moduleLogs.length > 0
              ? `Loaded ${moduleLogs.length} ${label} activity ${moduleLogs.length === 1 ? 'entry' : 'entries'}.`
              : `No ${label} activity was recorded for these filters.`,
        });
      } catch (error) {
        setRows([]);
        setMessage({
          type: 'error',
          text: error instanceof Error ? error.message : `Unable to load the ${label} audit trail.`,
        });
      } finally {
        setLoading(false);
      }
    },
    [prefixes, label]
  );

  // Session and the user list both live in browser storage, so this can only
  // run after mount.
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const options = await loadUserLogUsers();
        if (!cancelled) setUsers(options);
      } catch {
        // The user filter is optional -- the trail still loads without it.
        if (!cancelled) setUsers([]);
      }
      if (!cancelled) {
        await search({ fromDate, toDate, selectedUserId: '' });
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((record) =>
      [record.url, record.action, record.createdAt, record.userName].some((value) =>
        value.toLowerCase().includes(needle)
      )
    );
  }, [rows, query]);

  const pagination: PaginatedResult<UserLogRecord> = useMemo(
    () => paginateRows(filtered, page),
    [filtered, page]
  );

  const exportRows = useMemo<TableExportRow[]>(
    () =>
      filtered.map((record, index) => ({
        serial: String(index + 1),
        date: formatTimestamp(record.createdAt),
        user: record.userName || '-',
        action: record.action || '-',
        url: record.url,
      })),
    [filtered]
  );

  const title = `${label} audit trail`;
  const subtitle = `${label} activity from ${fromDate} to ${toDate}`;
  const stem = fileStem(label);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          <p className="mt-1 text-sm text-slate-600">
            Every {label} screen this institute&apos;s users opened, with who opened it and when.
            Read-only, drawn from the same access log as the User Log report.
          </p>
        </div>
        <ReportActions
          onExportCsv={() =>
            exportRowsAsCsv({ filename: `${stem}.csv`, columns: COLUMNS, rows: exportRows })
          }
          onExportExcel={() =>
            exportRowsAsExcel({
              filename: `${stem}.xls`,
              title,
              columns: COLUMNS,
              rows: exportRows,
            })
          }
          onExportPdf={() =>
            exportRowsAsPdf({
              filename: `${stem}.pdf`,
              title,
              subtitle,
              columns: COLUMNS,
              rows: exportRows,
            })
          }
          onPrint={() => openPrintPreview({ title, subtitle, columns: COLUMNS, rows: exportRows })}
        />
      </div>

      {message && <InlineMessage type={message.type} text={message.text} />}

      <SectionPanel title="Filters">
        <div className="grid gap-3 lg:grid-cols-4">
          <Field label="From date">
            <Input
              type="date"
              value={fromDate}
              max={toDate}
              onChange={(event) => setFromDate(event.target.value)}
            />
          </Field>
          <Field label="To date">
            <Input
              type="date"
              value={toDate}
              min={fromDate}
              onChange={(event) => setToDate(event.target.value)}
            />
          </Field>
          <Field label="User">
            <NativeSelect value={selectedUserId} onChange={setSelectedUserId}>
              <option value="">All users</option>
              {users.map((user) => (
                <option key={user.id} value={String(user.id)}>
                  {user.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <div className="flex items-end">
            <Button
              type="button"
              className="h-10 w-full"
              disabled={loading}
              onClick={() => void search({ fromDate, toDate, selectedUserId })}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Search
            </Button>
          </div>
        </div>
      </SectionPanel>

      <SectionPanel footer={<PaginationFooter pagination={pagination} onPageChange={setPage} />}>
        <div className="mb-3 max-w-md">
          <Input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
            placeholder="Search this trail..."
            aria-label={`Search the ${label} audit trail`}
          />
        </div>
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-100 text-xs uppercase text-slate-700 hover:bg-slate-100">
              <TableHead className="w-20">Sr. No.</TableHead>
              <TableHead>Date &amp; time</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>URL</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <LoadingRows colSpan={5} label={`Loading ${label} audit trail`} />
            ) : pagination.rows.length > 0 ? (
              pagination.rows.map((record, index) => (
                <TableRow key={record.id} className="odd:bg-white even:bg-slate-50/70">
                  <TableCell>{pagination.startIndex + index}</TableCell>
                  <TableCell className="whitespace-nowrap font-mono text-xs">
                    {formatTimestamp(record.createdAt)}
                  </TableCell>
                  <TableCell>{record.userName || '-'}</TableCell>
                  <TableCell className="font-mono text-xs">{record.action || '-'}</TableCell>
                  <TableCell className="max-w-80 break-all text-xs text-slate-600">
                    {record.url}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <EmptyTableRow
                colSpan={5}
                label={
                  rows.length > 0
                    ? 'No entries match this search.'
                    : `No ${label} activity was recorded for these filters.`
                }
              />
            )}
          </TableBody>
        </Table>
      </SectionPanel>
    </div>
  );
}
